function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
function normalizeText(value) { return String(value || '').trim(); }
function getBearerToken(request) { const authHeader = request.headers.get('Authorization') || ''; const match = authHeader.match(/^Bearer\s+(.+)$/i); return match ? String(match[1] || '').trim() : ''; }
async function getOptionalMemberUser(request, env) {
  const token = getBearerToken(request); if (!token) return null; const db = env.DB || env.DD_DB; if (!db) return null;
  const session = await db.prepare(`SELECT s.user_id, u.email, u.display_name, u.role, u.is_active FROM sessions s INNER JOIN users u ON u.user_id = s.user_id WHERE (s.session_token = ? OR s.token = ?) AND s.expires_at > datetime('now') LIMIT 1`).bind(token, token).first();
  if (!session || Number(session.is_active || 0) !== 1) return null; return { user_id: Number(session.user_id || 0), email: session.email || '', display_name: session.display_name || '', role: session.role || 'member' };
}
async function ensureTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS product_interest_requests (
    product_interest_request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    request_type TEXT NOT NULL,
    user_id INTEGER,
    email TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_product_interest_requests_lookup ON product_interest_requests(product_id, request_type, status, created_at DESC)`).run();
}
export async function onRequestPost(context) {
  const { request, env } = context; const db = env.DB || env.DD_DB;
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);
  await ensureTable(db);
  let body={}; try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  const productId = Number(body.product_id || 0); const requestType = normalizeText(body.request_type).toLowerCase();
  if (!productId || !['back_in_stock','wishlist_guest'].includes(requestType)) return json({ ok: false, error: 'A valid product_id and request_type are required.' }, 400);
  const product = await db.prepare(`SELECT product_id, name FROM products WHERE product_id = ? LIMIT 1`).bind(productId).first();
  if (!product) return json({ ok: false, error: 'Product not found.' }, 404);
  const memberUser = await getOptionalMemberUser(request, env);
  const email = normalizeText(body.email || memberUser?.email || '').toLowerCase();
  if (!memberUser && !email) return json({ ok: false, error: 'Email is required when you are not logged in.' }, 400);
  const existing = await db.prepare(`
    SELECT product_interest_request_id
    FROM product_interest_requests
    WHERE product_id = ? AND request_type = ? AND status = 'open'
      AND ((user_id IS NOT NULL AND user_id = ?) OR (LOWER(COALESCE(email,'')) = LOWER(?)))
    LIMIT 1
  `).bind(productId, requestType, Number(memberUser?.user_id || 0), email).first();
  if (!existing) {
    await db.prepare(`INSERT INTO product_interest_requests (product_id, request_type, user_id, email, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).bind(productId, requestType, memberUser?.user_id || null, email || null, normalizeText(body.notes) || null).run();
  }
  return json({ ok: true, message: requestType === 'back_in_stock' ? 'Back-in-stock request saved.' : 'Interest saved.' });
}
