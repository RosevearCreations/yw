function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function getBearerToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || '').trim() : '';
}
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }
async function getMemberUserFromRequest(request, env) {
  const token = getBearerToken(request); if (!token) return null;
  const db = env.DB || env.DD_DB; if (!db) return null;
  const session = await db.prepare(`
    SELECT s.session_id, s.user_id, u.user_id AS resolved_user_id, u.email, u.display_name, u.role, u.is_active
    FROM sessions s
    INNER JOIN users u ON u.user_id = s.user_id
    WHERE (s.session_token = ? OR s.token = ?) AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(token, token).first();
  if (!session || Number(session.is_active || 0) !== 1) return null;
  const role = String(session.role || '').toLowerCase();
  if (!['member','admin'].includes(role)) return null;
  return { user_id: Number(session.resolved_user_id || session.user_id || 0), email: session.email || '', display_name: session.display_name || '', role };
}
async function ensureTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS member_wishlists (
    member_wishlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_member_wishlists_user_created ON member_wishlists(user_id, created_at DESC)`).run();
}
export async function onRequestGet(context) {
  const { request, env } = context; const db = env.DB || env.DD_DB;
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);
  const memberUser = await getMemberUserFromRequest(request, env); if (!memberUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  await ensureTable(db);
  const rows = normalizeResults(await db.prepare(`
    SELECT mw.member_wishlist_id, mw.product_id, mw.created_at,
           p.slug, p.name, p.status, p.price_cents, p.currency, p.featured_image_url, p.short_description
    FROM member_wishlists mw
    LEFT JOIN products p ON p.product_id = mw.product_id
    WHERE mw.user_id = ?
    ORDER BY mw.created_at DESC, mw.member_wishlist_id DESC
  `).bind(memberUser.user_id).all());
  return json({ ok: true, items: rows.map((row) => ({
    member_wishlist_id: Number(row.member_wishlist_id || 0),
    product_id: Number(row.product_id || 0),
    created_at: row.created_at || null,
    slug: row.slug || '',
    name: row.name || '',
    status: row.status || '',
    price_cents: Number(row.price_cents || 0),
    currency: row.currency || 'CAD',
    featured_image_url: row.featured_image_url || '',
    short_description: row.short_description || ''
  })) });
}
export async function onRequestPost(context) {
  const { request, env } = context; const db = env.DB || env.DD_DB;
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);
  const memberUser = await getMemberUserFromRequest(request, env); if (!memberUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  await ensureTable(db);
  let body={}; try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  const productId = Number(body.product_id || 0);
  if (!productId) return json({ ok: false, error: 'product_id is required.' }, 400);
  const product = await db.prepare(`SELECT product_id FROM products WHERE product_id = ? LIMIT 1`).bind(productId).first();
  if (!product) return json({ ok: false, error: 'Product not found.' }, 404);
  await db.prepare(`INSERT INTO member_wishlists (user_id, product_id) VALUES (?, ?) ON CONFLICT(user_id, product_id) DO NOTHING`).bind(memberUser.user_id, productId).run();
  return json({ ok: true, message: 'Saved to wishlist.' });
}
export async function onRequestDelete(context) {
  const { request, env } = context; const db = env.DB || env.DD_DB;
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);
  const memberUser = await getMemberUserFromRequest(request, env); if (!memberUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  await ensureTable(db);
  const url = new URL(request.url);
  const productId = Number(url.searchParams.get('product_id') || 0);
  if (!productId) return json({ ok: false, error: 'product_id is required.' }, 400);
  await db.prepare(`DELETE FROM member_wishlists WHERE user_id = ? AND product_id = ?`).bind(memberUser.user_id, productId).run();
  return json({ ok: true, message: 'Removed from wishlist.' });
}
