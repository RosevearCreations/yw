// File: /functions/api/stripe-return.js
// Brief description: Finalizes a Stripe Checkout return by retrieving the Checkout Session,
// reconciling local payment and order state, and recording history so the confirmation page
// can reflect paid status even before webhook timing catches up.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' }
  });
}

function normalizeText(value) { return String(value || '').trim(); }
function getDb(env) { return env.DB || env.DD_DB; }

async function addHistory(db, orderId, oldStatus, newStatus, note) {
  await db.prepare(`
    INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_user_id, note, created_at)
    VALUES (?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)
  `).bind(orderId, oldStatus || null, newStatus || null, note || null).run().catch(() => null);
}

function deriveOrderStatus(existingOrderStatus, localPaymentStatus) {
  const current = normalizeText(existingOrderStatus).toLowerCase() || 'pending';
  if (localPaymentStatus === 'paid' && ['pending', 'draft'].includes(current)) return 'paid';
  if (['refunded', 'partially_refunded'].includes(localPaymentStatus) && ['paid', 'fulfilled'].includes(current)) return 'refunded';
  return current;
}

function mapCheckoutSessionPaymentStatus(session) {
  const paymentStatus = normalizeText(session?.payment_status || session?.status).toLowerCase();
  if (paymentStatus === 'paid') return 'paid';
  if (['expired', 'unpaid'].includes(paymentStatus)) return 'failed';
  if (['open', 'pending', 'complete'].includes(paymentStatus) || normalizeText(session?.status).toLowerCase() === 'complete') {
    return paymentStatus === 'paid' ? 'paid' : 'pending';
  }
  return 'pending';
}

async function fetchStripeCheckoutSession(env, sessionId) {
  const secretKey = normalizeText(env.STRIPE_SECRET_KEY);
  if (!secretKey) throw new Error('Stripe secret key is not configured.');
  const url = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) throw new Error(data?.error?.message || 'Failed to retrieve Stripe Checkout session.');
  return data;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }

  const orderId = Number(body.order_id || 0);
  const sessionId = normalizeText(body.session_id || body.provider_order_id || body.checkout_session_id);
  if (!Number.isInteger(orderId) || orderId <= 0) return json({ ok: false, error: 'A valid order_id is required.' }, 400);
  if (!sessionId) return json({ ok: false, error: 'A valid session_id is required.' }, 400);

  const localOrder = await db.prepare(`
    SELECT order_id, order_number, order_status, payment_status, total_cents, currency
    FROM orders
    WHERE order_id = ?
    LIMIT 1
  `).bind(orderId).first();
  if (!localOrder) return json({ ok: false, error: 'Order not found.' }, 404);

  const existingPaid = await db.prepare(`
    SELECT payment_id, payment_status, provider_order_id, provider_payment_id, amount_cents, paid_at
    FROM payments
    WHERE order_id = ?
      AND LOWER(COALESCE(provider, '')) = 'stripe'
      AND LOWER(COALESCE(provider_order_id, '')) = LOWER(?)
      AND LOWER(COALESCE(payment_status, '')) = 'paid'
    ORDER BY payment_id DESC
    LIMIT 1
  `).bind(orderId, sessionId).first();

  if (existingPaid) {
    return json({
      ok: true,
      message: 'Stripe payment was already finalized.',
      payment_status: 'paid',
      provider_order_id: existingPaid.provider_order_id || sessionId,
      provider_payment_id: existingPaid.provider_payment_id || null,
      order: {
        order_id: Number(localOrder.order_id || 0),
        order_number: localOrder.order_number || '',
        order_status: localOrder.order_status || 'paid',
        payment_status: 'paid'
      }
    });
  }

  const session = await fetchStripeCheckoutSession(env, sessionId);
  const paymentIntentId = normalizeText(session?.payment_intent?.id || session?.payment_intent || '');
  const amountTotal = Number(session?.amount_total || session?.amount_subtotal || localOrder.total_cents || 0);
  const paidAt = session?.payment_intent?.created ? new Date(Number(session.payment_intent.created) * 1000).toISOString() : new Date().toISOString();
  const localPaymentStatus = mapCheckoutSessionPaymentStatus(session);

  const existingPayment = await db.prepare(`
    SELECT payment_id
    FROM payments
    WHERE order_id = ?
      AND LOWER(COALESCE(provider, '')) = 'stripe'
      AND (LOWER(COALESCE(provider_order_id, '')) = LOWER(?) OR provider_order_id IS NULL OR provider_order_id = '')
    ORDER BY payment_id DESC
    LIMIT 1
  `).bind(orderId, sessionId).first();

  if (existingPayment) {
    await db.prepare(`
      UPDATE payments
      SET provider = 'stripe',
          provider_order_id = ?,
          provider_payment_id = CASE WHEN ? != '' THEN ? ELSE provider_payment_id END,
          payment_status = ?,
          amount_cents = CASE WHEN ? > 0 THEN ? ELSE amount_cents END,
          transaction_reference = ?,
          paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, ?) ELSE paid_at END,
          updated_at = CURRENT_TIMESTAMP,
          notes = TRIM(COALESCE(notes, '') || ' Stripe return finalize processed.')
      WHERE payment_id = ?
    `).bind(sessionId, paymentIntentId, paymentIntentId, localPaymentStatus, amountTotal, amountTotal, paymentIntentId || sessionId || null, localPaymentStatus, paidAt, Number(existingPayment.payment_id || 0)).run();
  } else {
    await db.prepare(`
      INSERT INTO payments (
        order_id, provider, provider_payment_id, provider_order_id, payment_status,
        amount_cents, currency, payment_method_label, transaction_reference,
        paid_at, created_at, updated_at, notes
      ) VALUES (?, 'stripe', ?, ?, ?, ?, ?, 'stripe', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    `).bind(orderId, paymentIntentId || null, sessionId, localPaymentStatus, amountTotal, localOrder.currency || 'CAD', paymentIntentId || sessionId || null, localPaymentStatus === 'paid' ? paidAt : null, 'Stripe return finalize inserted local payment record.').run();
  }

  const nextOrderStatus = deriveOrderStatus(localOrder.order_status, localPaymentStatus);
  await db.prepare(`
    UPDATE orders
    SET payment_status = ?,
        order_status = ?,
        payment_method = 'stripe',
        updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ?
  `).bind(localPaymentStatus, nextOrderStatus, orderId).run();

  await addHistory(db, orderId, normalizeText(localOrder.order_status).toLowerCase() || 'pending', nextOrderStatus, `Stripe return finalize processed for checkout session ${sessionId}.`);

  return json({
    ok: true,
    message: localPaymentStatus === 'paid' ? 'Stripe payment finalized successfully.' : 'Stripe return checked successfully.',
    payment_status: localPaymentStatus,
    provider_order_id: sessionId,
    provider_payment_id: paymentIntentId || null,
    order: {
      order_id: Number(localOrder.order_id || 0),
      order_number: localOrder.order_number || '',
      order_status: nextOrderStatus,
      payment_status: localPaymentStatus
    }
  });
}
