// File: /functions/api/track/cart.js
// Brief description: Logs cart and checkout activity such as cart updates, checkout starts,
// and abandoned carts for admin analytics and monitoring.

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
function normalizeText(value) { return String(value || "").trim(); }
function getBearerToken(request) { const authHeader = request.headers.get("Authorization") || ""; const match = authHeader.match(/^Bearer\s+(.+)$/i); return match ? String(match[1] || "").trim() : ""; }
async function getSessionUser(env, token) { if (!token) return null; return env.DB.prepare(`SELECT s.user_id, u.email, u.display_name, u.role, u.is_active FROM sessions s INNER JOIN users u ON u.user_id = s.user_id WHERE (s.session_token = ? OR s.token = ?) AND s.expires_at > datetime('now') LIMIT 1`).bind(token, token).first(); }
export async function onRequestPost(context) {
  const { request, env } = context; let body = {}; try { body = await request.json(); } catch { body = {}; }
  const visitor_token = normalizeText(body.visitor_token); const session_token = normalizeText(body.browser_session_token || body.session_token); const event_type = normalizeText(body.event_type || 'cart_event').toLowerCase(); const path = normalizeText(body.path || '/'); const cart_count = Number.isInteger(Number(body.cart_count)) ? Number(body.cart_count) : 0; const cart_value_cents = Number.isInteger(Number(body.cart_value_cents)) ? Number(body.cart_value_cents) : 0; const order_id = Number.isInteger(Number(body.order_id)) ? Number(body.order_id) : null; const meta_json = body.meta ? JSON.stringify(body.meta).slice(0, 5000) : null;
  if (!visitor_token) return json({ ok: false, error: 'visitor_token is required.' }, 400);
  const token = getBearerToken(request); const sessionUser = await getSessionUser(env, token); const user_id = Number(sessionUser?.user_id || 0) || null;
  await env.DB.prepare(`INSERT INTO cart_activity (visitor_token, session_token, user_id, order_id, event_type, path, cart_count, cart_value_cents, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(visitor_token, session_token || null, user_id, order_id, event_type, path || null, cart_count, cart_value_cents, meta_json).run();
  if (session_token) await env.DB.prepare(`UPDATE site_visitor_sessions SET is_checkout_started = CASE WHEN ? = 1 THEN 1 ELSE is_checkout_started END, is_abandoned_cart = CASE WHEN ? = 1 THEN 1 ELSE is_abandoned_cart END, last_path = COALESCE(?, last_path), last_seen_at = CURRENT_TIMESTAMP WHERE session_token = ?`).bind(path.includes('/checkout') ? 1 : 0, event_type === 'cart_abandoned' ? 1 : 0, path || null, session_token).run();
  return json({ ok: true, event_type, visitor_token, session_token: session_token || null });
}
