function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function normalizeText(value) {
  return String(value || '').trim();
}

function safeEmail(value) {
  return normalizeText(value).toLowerCase();
}

async function ensureTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS checkout_recovery_leads (
    checkout_recovery_lead_id INTEGER PRIMARY KEY AUTOINCREMENT,
    browser_session_token TEXT,
    visitor_token TEXT,
    customer_email TEXT,
    customer_name TEXT,
    cart_count INTEGER NOT NULL DEFAULT 0,
    cart_value_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'CAD',
    checkout_path TEXT,
    checkout_state_json TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    last_recovery_email_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(browser_session_token, customer_email)
  )`).run();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB || env.DD_DB;
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);

  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }

  const customerEmail = safeEmail(body.customer_email);
  const browserSessionToken = normalizeText(body.browser_session_token);
  const visitorToken = normalizeText(body.visitor_token);
  const customerName = normalizeText(body.customer_name);
  const checkoutPath = normalizeText(body.checkout_path || '/checkout/');
  const cartCount = Math.max(0, Number(body.cart_count || 0) || 0);
  const cartValueCents = Math.max(0, Math.round(Number(body.cart_value_cents || 0) || 0));
  const currency = normalizeText(body.currency || 'CAD').toUpperCase() || 'CAD';

  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return json({ ok: false, error: 'A valid customer_email is required.' }, 400);
  }
  if (!browserSessionToken) {
    return json({ ok: false, error: 'browser_session_token is required.' }, 400);
  }

  await ensureTable(db);
  const payloadJson = JSON.stringify({
    customer_name: customerName,
    checkout_path: checkoutPath,
    cart_count: cartCount,
    cart_value_cents: cartValueCents,
    currency
  });

  await db.prepare(`
    INSERT INTO checkout_recovery_leads (
      browser_session_token, visitor_token, customer_email, customer_name,
      cart_count, cart_value_cents, currency, checkout_path, checkout_state_json,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(browser_session_token, customer_email) DO UPDATE SET
      visitor_token = excluded.visitor_token,
      customer_name = excluded.customer_name,
      cart_count = excluded.cart_count,
      cart_value_cents = excluded.cart_value_cents,
      currency = excluded.currency,
      checkout_path = excluded.checkout_path,
      checkout_state_json = excluded.checkout_state_json,
      status = CASE WHEN checkout_recovery_leads.status = 'converted' THEN 'converted' ELSE 'open' END,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    browserSessionToken,
    visitorToken || null,
    customerEmail,
    customerName || null,
    cartCount,
    cartValueCents,
    currency,
    checkoutPath || '/checkout/',
    payloadJson
  ).run();

  return json({ ok: true, message: 'Checkout recovery lead captured.' });
}
