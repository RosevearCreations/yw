// File: /functions/api/paypal-return.js
// Brief description: Handles the PayPal approval return flow, captures the PayPal order,
// updates local payment/order records, and records order history so checkout completion
// and later webhook reconciliation stay in sync.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function normalizeText(value) {
  return String(value || '').trim();
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
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || 'Failed to obtain PayPal access token.');
  }
  return { access_token: data.access_token, base, mode };
}

async function addHistory(env, orderId, oldStatus, newStatus, note) {
  await env.DB.prepare(`
    INSERT INTO order_status_history (
      order_id, old_status, new_status, changed_by_user_id, note, created_at
    ) VALUES (?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)
  `).bind(orderId, oldStatus || null, newStatus, note || null).run();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { body = {}; }

  const order_id = Number(body.order_id || 0);
  const paypal_order_id = normalizeText(body.paypal_order_id || body.token || body.provider_order_id);
  if (!Number.isInteger(order_id) || order_id <= 0) return json({ ok: false, error: 'A valid order_id is required.' }, 400);
  if (!paypal_order_id) return json({ ok: false, error: 'A valid paypal_order_id is required.' }, 400);

  const localOrder = await env.DB.prepare(`
    SELECT order_id, order_number, order_status, payment_status, total_cents, currency, customer_email
    FROM orders
    WHERE order_id = ?
    LIMIT 1
  `).bind(order_id).first();
  if (!localOrder) return json({ ok: false, error: 'Order not found.' }, 404);

  const existingPaid = await env.DB.prepare(`
    SELECT payment_id, payment_status, provider_order_id, provider_payment_id, amount_cents, paid_at
    FROM payments
    WHERE order_id = ?
      AND LOWER(COALESCE(provider, '')) = 'paypal'
      AND LOWER(COALESCE(provider_order_id, '')) = LOWER(?)
      AND LOWER(COALESCE(payment_status, '')) = 'paid'
    ORDER BY payment_id DESC
    LIMIT 1
  `).bind(order_id, paypal_order_id).first();

  if (existingPaid) {
    return json({
      ok: true,
      message: 'PayPal payment was already captured.',
      payment_status: 'paid',
      provider_order_id: existingPaid.provider_order_id || paypal_order_id,
      provider_payment_id: existingPaid.provider_payment_id || null,
      order: {
        order_id: Number(localOrder.order_id || 0),
        order_number: localOrder.order_number || '',
        order_status: localOrder.order_status || 'paid',
        payment_status: 'paid'
      }
    });
  }

  const auth = await getPaypalAccessToken(env);
  if (!auth) return json({ ok: false, error: 'PayPal credentials are not configured.' }, 500);

  const captureResponse = await fetch(`${auth.base}/v2/checkout/orders/${encodeURIComponent(paypal_order_id)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json'
    }
  });
  const captureData = await captureResponse.json().catch(() => null);

  if (!captureResponse.ok || !captureData?.status) {
    return json({ ok: false, error: captureData?.message || captureData?.details?.[0]?.description || 'Failed to capture PayPal order.' }, 400);
  }

  const capture = captureData?.purchase_units?.[0]?.payments?.captures?.[0] || null;
  const captureId = normalizeText(capture?.id);
  const captureStatus = normalizeText(capture?.status || captureData?.status).toLowerCase();
  const amountValue = Number(capture?.amount?.value || localOrder.total_cents / 100 || 0);
  const amountCents = Math.round(amountValue * 100);
  const paidAt = capture?.create_time || captureData?.update_time || new Date().toISOString();
  const paymentStatus = captureStatus === 'completed' ? 'paid' : 'authorized';

  const payment = await env.DB.prepare(`
    SELECT payment_id
    FROM payments
    WHERE order_id = ?
      AND LOWER(COALESCE(provider, '')) = 'paypal'
      AND (LOWER(COALESCE(provider_order_id, '')) = LOWER(?) OR provider_order_id IS NULL OR provider_order_id = '')
    ORDER BY payment_id DESC
    LIMIT 1
  `).bind(order_id, paypal_order_id).first();

  if (payment) {
    await env.DB.prepare(`
      UPDATE payments
      SET provider = 'paypal',
          provider_order_id = ?,
          provider_payment_id = ?,
          payment_status = ?,
          amount_cents = CASE WHEN ? > 0 THEN ? ELSE amount_cents END,
          transaction_reference = ?,
          paid_at = ?,
          updated_at = CURRENT_TIMESTAMP,
          notes = COALESCE(notes, '') || ' PayPal return capture processed.'
      WHERE payment_id = ?
    `).bind(paypal_order_id, captureId || null, paymentStatus, amountCents, amountCents, captureId || paypal_order_id || null, paidAt, Number(payment.payment_id || 0)).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO payments (
        order_id, provider, provider_payment_id, provider_order_id, payment_status,
        amount_cents, currency, payment_method_label, transaction_reference,
        paid_at, created_at, updated_at, notes
      ) VALUES (?, 'paypal', ?, ?, ?, ?, ?, 'paypal', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    `).bind(order_id, captureId || null, paypal_order_id, paymentStatus, amountCents, localOrder.currency || 'CAD', captureId || paypal_order_id || null, paidAt, 'PayPal return capture inserted local payment record.').run();
  }

  const nextOrderStatus = paymentStatus === 'paid' && ['draft', 'pending'].includes(normalizeText(localOrder.order_status).toLowerCase())
    ? 'paid'
    : normalizeText(localOrder.order_status).toLowerCase() || 'pending';

  await env.DB.prepare(`
    UPDATE orders
    SET payment_status = ?,
        order_status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ?
  `).bind(paymentStatus, nextOrderStatus, order_id).run();

  await addHistory(env, order_id, normalizeText(localOrder.order_status).toLowerCase() || 'pending', nextOrderStatus, `PayPal return capture completed for provider order ${paypal_order_id}.`);

  return json({
    ok: true,
    message: paymentStatus === 'paid' ? 'PayPal payment captured successfully.' : 'PayPal payment authorized successfully.',
    payment_status: paymentStatus,
    provider_order_id: paypal_order_id,
    provider_payment_id: captureId || null,
    order: {
      order_id: Number(localOrder.order_id || 0),
      order_number: localOrder.order_number || '',
      order_status: nextOrderStatus,
      payment_status: paymentStatus
    }
  });
}
