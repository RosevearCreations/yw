import {
  auditAdminAction,
  captureRuntimeIncident,
  getAdminUserFromRequest,
  getDb,
  jsonResponse,
  normalizeText
} from "../_lib/adminAudit.js";

function json(data, status = 200) {
  return jsonResponse(data, status);
}

function normalizeProvider(value) {
  const provider = normalizeText(value).toLowerCase();
  return ["paypal", "stripe", "square", "manual", "other"].includes(provider) ? provider : "";
}

function normalizePaymentStatus(value) {
  const status = normalizeText(value).toLowerCase();
  return [
    "pending",
    "authorized",
    "paid",
    "completed",
    "captured",
    "failed",
    "cancelled",
    "refunded",
    "partially_refunded"
  ].includes(status)
    ? status
    : "";
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function summarizePayments(orderTotalCents, payments) {
  const safePayments = Array.isArray(payments) ? payments : [];
  let paid_total_cents = 0;
  let refunded_total_cents = 0;
  let pending_total_cents = 0;
  let hasRefunded = false;
  let hasPartiallyRefunded = false;
  let hasAuthorized = false;
  let hasPending = false;
  let allFailedOrCancelled = safePayments.length > 0;

  for (const payment of safePayments) {
    const status = String(payment.payment_status || "").toLowerCase();
    const amount = Number(payment.amount_cents || 0);
    if (["paid", "completed", "captured"].includes(status)) paid_total_cents += amount;
    if (["pending", "authorized"].includes(status)) pending_total_cents += amount;
    if (status === 'refunded') {
      hasRefunded = true;
      refunded_total_cents += amount;
    }
    if (status === 'partially_refunded') {
      hasPartiallyRefunded = true;
      refunded_total_cents += amount;
    }
    if (status === 'authorized') hasAuthorized = true;
    if (status === 'pending') hasPending = true;
    if (!["failed", "cancelled"].includes(status)) allFailedOrCancelled = false;
  }

  let derived_payment_status = 'pending';
  if (!safePayments.length) derived_payment_status = 'pending';
  else if (hasRefunded) derived_payment_status = 'refunded';
  else if (hasPartiallyRefunded) derived_payment_status = 'partially_refunded';
  else if (paid_total_cents >= Number(orderTotalCents || 0) && Number(orderTotalCents || 0) > 0) derived_payment_status = 'paid';
  else if (hasAuthorized) derived_payment_status = 'authorized';
  else if (hasPending) derived_payment_status = 'pending';
  else if (allFailedOrCancelled) derived_payment_status = 'failed';

  return {
    payment_count: safePayments.length,
    paid_total_cents,
    pending_total_cents,
    refunded_total_cents,
    outstanding_cents: Math.max(Number(orderTotalCents || 0) - paid_total_cents, 0),
    derived_payment_status
  };
}

function deriveStoredOrderPaymentStatus(derivedPaymentStatus, existingPaymentStatus) {
  if (["refunded", "partially_refunded"].includes(derivedPaymentStatus)) return derivedPaymentStatus;
  if (derivedPaymentStatus === 'paid') return 'paid';
  if (derivedPaymentStatus === 'authorized') return 'authorized';
  if (derivedPaymentStatus === 'failed') return 'failed';
  if (derivedPaymentStatus === 'pending') return 'pending';
  return existingPaymentStatus || 'pending';
}

function maybeAdvanceOrderStatus(currentOrderStatus, storedPaymentStatus) {
  const current = String(currentOrderStatus || '').toLowerCase();
  if (current === 'pending' && storedPaymentStatus === 'paid') return 'paid';
  if (current === 'paid' && storedPaymentStatus === 'refunded') return 'refunded';
  if (current === 'fulfilled' && storedPaymentStatus === 'refunded') return 'refunded';
  return current || 'pending';
}

async function safeHistoryInsert(db, orderId, oldStatus, newStatus, changedByUserId, note) {
  try {
    await db.prepare(`
      INSERT INTO order_status_history (
        order_id,
        old_status,
        new_status,
        changed_by_user_id,
        note,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(orderId, oldStatus || null, newStatus || null, changedByUserId || null, note || null).run();
    return true;
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);

  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) {
    return json({ ok: false, error: 'Unauthorized.' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const order_id = Number(body.order_id);
  const provider = normalizeProvider(body.provider || 'manual');
  const payment_status = normalizePaymentStatus(body.payment_status);
  const amount_cents = Number(body.amount_cents);
  const currency = normalizeText(body.currency || 'CAD').toUpperCase();
  const payment_method_label = normalizeText(body.payment_method_label || '');
  const transaction_reference = normalizeText(body.transaction_reference || '');
  const provider_payment_id = normalizeText(body.provider_payment_id || '');
  const provider_order_id = normalizeText(body.provider_order_id || '');
  const paid_at = normalizeText(body.paid_at || '');
  const notes = normalizeText(body.notes || '');

  if (!Number.isInteger(order_id) || order_id <= 0) return json({ ok: false, error: 'A valid order_id is required.' }, 400);
  if (!provider) return json({ ok: false, error: 'A valid provider is required.' }, 400);
  if (!payment_status) return json({ ok: false, error: 'A valid payment_status is required.' }, 400);
  if (!Number.isInteger(amount_cents) || amount_cents < 0) return json({ ok: false, error: 'amount_cents must be a whole number of cents.' }, 400);
  if (!currency || currency.length < 3) return json({ ok: false, error: 'A valid currency is required.' }, 400);

  let order;
  try {
    order = await db.prepare(`
      SELECT order_id, order_number, order_status, payment_status, total_cents, currency, created_at, updated_at
      FROM orders
      WHERE order_id = ?
      LIMIT 1
    `).bind(order_id).first();
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_record_payment',
      incident_code: 'order_lookup_failed',
      severity: 'error',
      message: error?.message || 'Failed loading order for payment record.',
      related_user_id: adminUser.user_id,
      details: { order_id, provider, payment_status }
    });
    return json({ ok: false, error: 'Failed to load order for payment.' }, 500);
  }

  if (!order) return json({ ok: false, error: 'Order not found.' }, 404);

  let paymentInsertMeta = null;
  try {
    paymentInsertMeta = await db.prepare(`
      INSERT INTO payments (
        order_id,
        provider,
        provider_payment_id,
        provider_order_id,
        payment_status,
        amount_cents,
        currency,
        payment_method_label,
        transaction_reference,
        paid_at,
        created_at,
        updated_at,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    `).bind(
      order_id,
      provider,
      provider_payment_id || null,
      provider_order_id || null,
      payment_status,
      amount_cents,
      currency || order.currency || 'CAD',
      payment_method_label || null,
      transaction_reference || null,
      paid_at || null,
      notes || null
    ).run();
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_record_payment',
      incident_code: 'payment_insert_failed',
      severity: 'error',
      message: error?.message || 'Failed to insert payment record.',
      related_user_id: adminUser.user_id,
      details: { order_id, provider, payment_status, amount_cents }
    });
    return json({ ok: false, error: 'Failed to record payment.' }, 500);
  }

  const recordedPaymentId = Number(paymentInsertMeta?.meta?.last_row_id || 0) || null;
  const warnings = [];
  let payments = [{ payment_status, amount_cents }];
  let summary = summarizePayments(order.total_cents, payments);
  let storedPaymentStatus = deriveStoredOrderPaymentStatus(summary.derived_payment_status, String(order.payment_status || 'pending').toLowerCase());
  let nextOrderStatus = maybeAdvanceOrderStatus(order.order_status, storedPaymentStatus);

  try {
    const paymentsResult = await db.prepare(`
      SELECT payment_id, payment_status, amount_cents
      FROM payments
      WHERE order_id = ?
      ORDER BY payment_id DESC
    `).bind(order_id).all();
    payments = normalizeResults(paymentsResult);
    summary = summarizePayments(order.total_cents, payments);
    storedPaymentStatus = deriveStoredOrderPaymentStatus(summary.derived_payment_status, String(order.payment_status || 'pending').toLowerCase());
    nextOrderStatus = maybeAdvanceOrderStatus(order.order_status, storedPaymentStatus);
  } catch (error) {
    warnings.push('Payment was recorded, but payment-summary refresh failed.');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_record_payment',
      incident_code: 'payment_summary_refresh_failed',
      severity: 'warning',
      message: error?.message || 'Payment recorded but summary refresh failed.',
      related_user_id: adminUser.user_id,
      details: { order_id, payment_id: recordedPaymentId }
    });
  }

  try {
    await db.prepare(`
      UPDATE orders
      SET payment_status = ?, order_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).bind(storedPaymentStatus, nextOrderStatus, order_id).run();
  } catch (error) {
    warnings.push('Payment was recorded, but the parent order totals/status were not refreshed.');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_record_payment',
      incident_code: 'order_refresh_failed',
      severity: 'warning',
      message: error?.message || 'Payment recorded but order refresh failed.',
      related_user_id: adminUser.user_id,
      details: { order_id, payment_id: recordedPaymentId, storedPaymentStatus, nextOrderStatus }
    });
  }

  const actorLabel = adminUser.display_name || adminUser.email || `Admin #${adminUser.user_id}`;
  const historyNote = [
    `${actorLabel} recorded payment.`,
    `Provider: ${provider}.`,
    `Status: ${payment_status}.`,
    `Amount: ${amount_cents} ${currency || order.currency || 'CAD'}.`,
    transaction_reference ? `Reference: ${transaction_reference}.` : '',
    notes ? `Note: ${notes}` : ''
  ].filter(Boolean).join(' ');

  const historySaved = await safeHistoryInsert(
    db,
    order_id,
    String(order.order_status || '').toLowerCase(),
    nextOrderStatus,
    adminUser.user_id,
    historyNote
  );
  if (!historySaved) {
    warnings.push('Payment was recorded, but order history logging failed.');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_record_payment',
      incident_code: 'history_insert_failed',
      severity: 'warning',
      message: 'Payment recorded but order history insert failed.',
      related_user_id: adminUser.user_id,
      details: { order_id, payment_id: recordedPaymentId }
    });
  }

  await auditAdminAction(env, request, adminUser, {
    action_type: 'record_payment',
    target_type: 'order',
    target_id: order_id,
    target_key: order.order_number || String(order_id),
    details: {
      payment_id: recordedPaymentId,
      provider,
      payment_status,
      amount_cents,
      currency,
      payment_method_label,
      transaction_reference
    }
  });

  let updatedOrder = null;
  try {
    updatedOrder = await db.prepare(`
      SELECT order_id, order_number, order_status, payment_status, total_cents, currency, created_at, updated_at
      FROM orders
      WHERE order_id = ?
      LIMIT 1
    `).bind(order_id).first();
  } catch (error) {
    warnings.push('Payment was recorded, but the refreshed order row could not be loaded.');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_record_payment',
      incident_code: 'updated_order_lookup_failed',
      severity: 'warning',
      message: error?.message || 'Payment recorded but updated order lookup failed.',
      related_user_id: adminUser.user_id,
      details: { order_id, payment_id: recordedPaymentId }
    });
  }

  return json({
    ok: true,
    message: warnings.length ? 'Payment recorded with warnings.' : 'Payment recorded successfully.',
    warning: warnings[0] || '',
    warnings,
    payment_id: recordedPaymentId,
    order: {
      order_id: Number(updatedOrder?.order_id || order_id || 0),
      order_number: updatedOrder?.order_number || order.order_number || '',
      order_status: updatedOrder?.order_status || nextOrderStatus,
      payment_status: updatedOrder?.payment_status || storedPaymentStatus,
      total_cents: Number(updatedOrder?.total_cents || order.total_cents || 0),
      currency: updatedOrder?.currency || order.currency || currency || 'CAD',
      created_at: updatedOrder?.created_at || order.created_at || null,
      updated_at: updatedOrder?.updated_at || new Date().toISOString()
    },
    payment_summary: summary,
    recorded_by: {
      user_id: adminUser.user_id,
      email: adminUser.email,
      display_name: adminUser.display_name
    },
    fallback_state: warnings.length ? 'payment_recorded_with_partial_refresh' : null
  });
}
