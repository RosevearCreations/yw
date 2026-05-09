import { auditAdminAction, captureRuntimeIncident, getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

function json(data, status = 200) { return jsonResponse(data, status); }

async function addHistory(db, orderId, oldStatus, newStatus, note) {
  await db.prepare(`
    INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_user_id, note, created_at)
    VALUES (?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)
  `).bind(orderId, oldStatus || null, newStatus || null, note || null).run().catch(() => null);
}

function centsToAmountString(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

async function createStripeRefund(env, payment, amountCents, reason) {
  const secretKey = normalizeText(env.STRIPE_SECRET_KEY);
  const providerPaymentId = normalizeText(payment.provider_payment_id || payment.transaction_reference || '');
  if (!secretKey || !providerPaymentId) {
    return { attempted: false, provider_sync_status: 'local_only', provider_sync_note: 'Stripe secret or provider payment id missing.' };
  }

  const params = new URLSearchParams();
  params.set('payment_intent', providerPaymentId);
  if (Number(amountCents || 0) > 0) params.set('amount', String(Number(amountCents || 0)));
  if (reason) params.set('reason', 'requested_by_customer');
  params.set('metadata[local_order_id]', String(payment.order_id || ''));
  params.set('metadata[local_payment_id]', String(payment.payment_id || ''));

  const response = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    return {
      attempted: true,
      provider_sync_status: 'failed',
      provider_sync_note: data?.error?.message || data?.message || 'Stripe refund request failed.',
      provider_refund_id: null,
      provider_payload: data || null
    };
  }
  return {
    attempted: true,
    provider_sync_status: 'succeeded',
    provider_sync_note: 'Stripe refund created.',
    provider_refund_id: data.id,
    provider_payload: data,
    provider_refund_status: normalizeText(data.status || 'submitted').toLowerCase() || 'submitted'
  };
}

async function getPaypalAccessToken(env) {
  const clientId = normalizeText(env.PAYPAL_CLIENT_ID);
  const secret = normalizeText(env.PAYPAL_SECRET);
  const mode = normalizeText(env.PAYPAL_ENV || 'sandbox').toLowerCase() || 'sandbox';
  if (!clientId || !secret) return null;
  const base = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const basic = btoa(`${clientId}:${secret}`);
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || 'Failed to obtain PayPal access token.');
  }
  return { base, access_token: data.access_token, mode };
}

async function createPaypalRefund(env, payment, amountCents, note) {
  const providerPaymentId = normalizeText(payment.provider_payment_id || '');
  if (!providerPaymentId) {
    return { attempted: false, provider_sync_status: 'local_only', provider_sync_note: 'PayPal capture id missing.' };
  }
  const auth = await getPaypalAccessToken(env).catch(() => null);
  if (!auth) {
    return { attempted: false, provider_sync_status: 'local_only', provider_sync_note: 'PayPal credentials missing.' };
  }

  const payload = {
    amount: {
      value: centsToAmountString(amountCents),
      currency_code: normalizeText(payment.currency || 'CAD').toUpperCase() || 'CAD'
    },
    note_to_payer: note || undefined
  };

  const response = await fetch(`${auth.base}/v2/payments/captures/${encodeURIComponent(providerPaymentId)}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    return {
      attempted: true,
      provider_sync_status: 'failed',
      provider_sync_note: data?.message || data?.details?.[0]?.description || 'PayPal refund request failed.',
      provider_refund_id: null,
      provider_payload: data || null
    };
  }
  return {
    attempted: true,
    provider_sync_status: 'succeeded',
    provider_sync_note: 'PayPal refund created.',
    provider_refund_id: data.id,
    provider_payload: data,
    provider_refund_status: normalizeText(data.status || 'submitted').toLowerCase() || 'submitted'
  };
}

async function attemptProviderRefund(env, payment, amountCents, reason, note) {
  const provider = normalizeText(payment.provider).toLowerCase();
  if (provider === 'stripe') return createStripeRefund(env, payment, amountCents, reason);
  if (provider === 'paypal') return createPaypalRefund(env, payment, amountCents, note || reason);
  return { attempted: false, provider_sync_status: 'local_only', provider_sync_note: 'Provider refund sync is not implemented for this provider.' };
}

async function queueReceipt(db, kind, orderId, paymentId, destination, payload) {
  await db.prepare(`
    INSERT INTO notification_outbox (
      notification_kind, channel, destination, related_order_id, related_payment_id,
      payload_json, status, created_at, updated_at
    ) VALUES (?, 'email', ?, ?, ?, ?, 'queued', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(kind, destination || null, orderId || null, paymentId || null, JSON.stringify(payload || {})).run().catch(() => null);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }

  const action = normalizeText(body.action).toLowerCase();
  const paymentId = Number(body.payment_id || 0);
  if (!['refund', 'dispute'].includes(action)) return json({ ok: false, error: 'Unsupported payment action.' }, 400);
  if (!Number.isInteger(paymentId) || paymentId <= 0) return json({ ok: false, error: 'A valid payment_id is required.' }, 400);

  const payment = await db.prepare(`
    SELECT payment_id, order_id, provider, provider_payment_id, provider_order_id, payment_status,
           amount_cents, currency, transaction_reference, notes
    FROM payments
    WHERE payment_id = ?
    LIMIT 1
  `).bind(paymentId).first();
  if (!payment) return json({ ok: false, error: 'Payment not found.' }, 404);

  const order = await db.prepare(`
    SELECT order_id, order_number, order_status, payment_status, total_cents, currency, customer_email, customer_name
    FROM orders
    WHERE order_id = ?
    LIMIT 1
  `).bind(Number(payment.order_id || 0)).first();
  if (!order) return json({ ok: false, error: 'Order not found for payment.' }, 404);

  const warnings = [];

  if (action === 'refund') {
    const refundAmount = Math.max(0, Number(body.amount_cents || 0));
    const reason = normalizeText(body.reason);
    const note = normalizeText(body.note);
    const syncProvider = body.sync_provider == null ? 1 : (Number(body.sync_provider) === 1 ? 1 : 0);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      return json({ ok: false, error: 'Refund amount must be greater than zero.' }, 400);
    }

    let providerSync = { attempted: false, provider_sync_status: 'local_only', provider_sync_note: 'Refund recorded locally only.' };
    if (syncProvider) {
      providerSync = await attemptProviderRefund(env, payment, refundAmount, reason, note).catch((error) => ({
        attempted: true,
        provider_sync_status: 'failed',
        provider_sync_note: error?.message || 'Provider refund sync failed.'
      }));
    }

    const status = refundAmount >= Number(payment.amount_cents || 0) ? 'refunded' : 'partially_refunded';
    const refundStatus = providerSync.provider_refund_status || (providerSync.provider_sync_status === 'succeeded' ? 'submitted' : 'recorded');

    const refundInsert = await db.prepare(`
      INSERT INTO payment_refunds (
        payment_id, order_id, provider, provider_refund_id, amount_cents, currency, refund_status,
        reason, note, provider_sync_status, provider_sync_note, provider_sync_at,
        created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      paymentId,
      Number(payment.order_id || 0),
      payment.provider || 'other',
      normalizeText(body.provider_refund_id) || providerSync.provider_refund_id || null,
      refundAmount,
      normalizeText(body.currency || payment.currency || order.currency || 'CAD').toUpperCase(),
      refundStatus,
      reason || null,
      note || null,
      providerSync.provider_sync_status || 'local_only',
      providerSync.provider_sync_note || null,
      providerSync.attempted ? new Date().toISOString() : null,
      adminUser.user_id
    ).run();

    try {
      await db.prepare(`
        UPDATE payments
        SET payment_status = ?,
            updated_at = CURRENT_TIMESTAMP,
            notes = TRIM(COALESCE(notes,'') || CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' | ' END || ?)
        WHERE payment_id = ?
      `).bind(status, `Refund logged by admin${reason ? `: ${reason}` : ''}`, paymentId).run();
    } catch (error) {
      warnings.push('Refund recorded, but the payment row note/status was not fully refreshed.');
      await captureRuntimeIncident(env, request, {
        incident_scope: 'admin_payment_actions',
        incident_code: 'refund_payment_update_failed',
        severity: 'warning',
        message: error?.message || 'Refund recorded but payment update failed.',
        related_user_id: adminUser.user_id,
        details: { payment_id: paymentId, order_id: Number(payment.order_id || 0) }
      });
    }

    try {
      await db.prepare(`
        UPDATE orders
        SET payment_status = ?,
            order_status = CASE WHEN ? = 'refunded' THEN 'refunded' ELSE order_status END,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).bind(status, status, Number(payment.order_id || 0)).run();
    } catch (error) {
      warnings.push('Refund recorded, but the parent order status did not refresh cleanly.');
      await captureRuntimeIncident(env, request, {
        incident_scope: 'admin_payment_actions',
        incident_code: 'refund_order_update_failed',
        severity: 'warning',
        message: error?.message || 'Refund recorded but order update failed.',
        related_user_id: adminUser.user_id,
        details: { payment_id: paymentId, order_id: Number(payment.order_id || 0) }
      });
    }

    try {
      await addHistory(
        db,
        Number(payment.order_id || 0),
        order.order_status || null,
        status === 'refunded' ? 'refunded' : order.order_status || null,
        note || `Refund recorded for payment ${paymentId}.`
      );
    } catch (error) {
      warnings.push('Refund recorded, but order history logging failed.');
      await captureRuntimeIncident(env, request, {
        incident_scope: 'admin_payment_actions',
        incident_code: 'refund_history_failed',
        severity: 'warning',
        message: error?.message || 'Refund recorded but history logging failed.',
        related_user_id: adminUser.user_id,
        details: { payment_id: paymentId, order_id: Number(payment.order_id || 0) }
      });
    }

    try {
      await queueReceipt(db, 'refund_receipt', Number(payment.order_id || 0), paymentId, normalizeText(order.customer_email), {
        order_number: order.order_number || '',
        amount_cents: refundAmount,
        currency: normalizeText(body.currency || payment.currency || order.currency || 'CAD').toUpperCase(),
        customer_name: normalizeText(order.customer_name),
        reason,
        note,
        provider: payment.provider || 'other',
        provider_sync_status: providerSync.provider_sync_status || 'local_only'
      });
    } catch (error) {
      warnings.push('Refund recorded, but receipt queueing failed.');
      await captureRuntimeIncident(env, request, {
        incident_scope: 'admin_payment_actions',
        incident_code: 'refund_receipt_queue_failed',
        severity: 'warning',
        message: error?.message || 'Refund recorded but receipt queueing failed.',
        related_user_id: adminUser.user_id,
        details: { payment_id: paymentId, order_id: Number(payment.order_id || 0) }
      });
    }

    await auditAdminAction(env, request, adminUser, {
      action_type: 'payment_refund',
      target_type: 'payment',
      target_id: paymentId,
      target_key: payment.provider_payment_id || payment.provider_order_id || String(paymentId),
      details: {
        refund_id: Number(refundInsert?.meta?.last_row_id || 0),
        refund_amount_cents: refundAmount,
        provider: payment.provider || 'other',
        provider_sync_status: providerSync.provider_sync_status || 'local_only',
        provider_sync_note: providerSync.provider_sync_note || null
      }
    });

    return json({
      ok: true,
      message: warnings.length ? 'Refund recorded with warnings.' : 'Refund recorded.',
      warning: warnings[0] || '',
      warnings,
      action,
      payment_id: paymentId,
      order_id: Number(payment.order_id || 0),
      payment_status: status,
      provider_sync: providerSync,
      fallback_state: warnings.length ? 'refund_recorded_with_partial_followup' : null
    });
  }

  const disputeAmount = Math.max(0, Number(body.amount_cents || payment.amount_cents || 0));
  const disputeStatus = normalizeText(body.dispute_status || 'open').toLowerCase();
  const reason = normalizeText(body.reason || body.dispute_reason);
  const note = normalizeText(body.note);

  const insert = await db.prepare(`
    INSERT INTO payment_disputes (
      payment_id, order_id, provider, provider_dispute_id, dispute_status, amount_cents,
      currency, reason, evidence_due_at, note, provider_sync_status, provider_sync_note,
      provider_sync_at, created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_review', 'Dispute recorded locally pending provider confirmation.', NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    paymentId,
    Number(payment.order_id || 0),
    payment.provider || 'other',
    normalizeText(body.provider_dispute_id) || null,
    ['open', 'under_review', 'won', 'lost', 'closed'].includes(disputeStatus) ? disputeStatus : 'open',
    disputeAmount,
    normalizeText(body.currency || payment.currency || order.currency || 'CAD').toUpperCase(),
    reason || null,
    normalizeText(body.evidence_due_at) || null,
    note || null,
    adminUser.user_id
  ).run();

  try {
    await db.prepare(`
      UPDATE payments
      SET updated_at = CURRENT_TIMESTAMP,
          notes = TRIM(COALESCE(notes,'') || CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' | ' END || ?)
      WHERE payment_id = ?
    `).bind(`Dispute logged by admin${reason ? `: ${reason}` : ''}`, paymentId).run();
  } catch (error) {
    warnings.push('Dispute recorded, but the payment row note was not fully refreshed.');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_payment_actions',
      incident_code: 'dispute_payment_update_failed',
      severity: 'warning',
      message: error?.message || 'Dispute recorded but payment update failed.',
      related_user_id: adminUser.user_id,
      details: { payment_id: paymentId, order_id: Number(payment.order_id || 0) }
    });
  }

  try {
    await db.prepare(`
      UPDATE orders
      SET updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).bind(Number(payment.order_id || 0)).run();
  } catch (error) {
    warnings.push('Dispute recorded, but the parent order update stamp failed.');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_payment_actions',
      incident_code: 'dispute_order_update_failed',
      severity: 'warning',
      message: error?.message || 'Dispute recorded but order update failed.',
      related_user_id: adminUser.user_id,
      details: { payment_id: paymentId, order_id: Number(payment.order_id || 0) }
    });
  }

  try {
    await addHistory(
      db,
      Number(payment.order_id || 0),
      order.order_status || null,
      order.order_status || null,
      note || `Dispute logged for payment ${paymentId}.`
    );
  } catch (error) {
    warnings.push('Dispute recorded, but order history logging failed.');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_payment_actions',
      incident_code: 'dispute_history_failed',
      severity: 'warning',
      message: error?.message || 'Dispute recorded but history logging failed.',
      related_user_id: adminUser.user_id,
      details: { payment_id: paymentId, order_id: Number(payment.order_id || 0) }
    });
  }

  try {
    await queueReceipt(db, 'dispute_notice', Number(payment.order_id || 0), paymentId, normalizeText(order.customer_email), {
      order_number: order.order_number || '',
      amount_cents: disputeAmount,
      currency: normalizeText(body.currency || payment.currency || order.currency || 'CAD').toUpperCase(),
      customer_name: normalizeText(order.customer_name),
      reason,
      note,
      provider: payment.provider || 'other'
    });
  } catch (error) {
    warnings.push('Dispute recorded, but receipt queueing failed.');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_payment_actions',
      incident_code: 'dispute_receipt_queue_failed',
      severity: 'warning',
      message: error?.message || 'Dispute recorded but receipt queueing failed.',
      related_user_id: adminUser.user_id,
      details: { payment_id: paymentId, order_id: Number(payment.order_id || 0) }
    });
  }

  await auditAdminAction(env, request, adminUser, {
    action_type: 'payment_dispute',
    target_type: 'payment',
    target_id: paymentId,
    target_key: payment.provider_payment_id || payment.provider_order_id || String(paymentId),
    details: {
      dispute_id: Number(insert?.meta?.last_row_id || 0),
      dispute_status,
      reason
    }
  });

  return json({
    ok: true,
    message: warnings.length ? 'Dispute recorded with warnings.' : 'Dispute recorded locally.',
    warning: warnings[0] || '',
    warnings,
    action,
    payment_id: paymentId,
    order_id: Number(payment.order_id || 0),
    dispute_status: disputeStatus || 'open',
    fallback_state: warnings.length ? 'dispute_recorded_with_partial_followup' : null
  });
}
