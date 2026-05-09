function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function getBearerToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || '').trim() : '';
}
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }
function normalizeText(value) { return String(value || '').trim(); }
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
async function ensureReviewTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS product_reviews (
    product_review_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    order_id INTEGER,
    user_id INTEGER,
    reviewer_name TEXT,
    reviewer_email TEXT,
    rating INTEGER NOT NULL DEFAULT 5,
    review_text TEXT,
    review_kind TEXT NOT NULL DEFAULT 'testimonial',
    status TEXT NOT NULL DEFAULT 'pending_review',
    is_featured INTEGER NOT NULL DEFAULT 0,
    admin_notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function onRequestGet(context) {
  const { request, env } = context; const db = env.DB || env.DD_DB;
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);
  const memberUser = await getMemberUserFromRequest(request, env); if (!memberUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  await ensureReviewTable(db);

  const purchasedProducts = normalizeResults(await db.prepare(`
    SELECT oi.product_id, MAX(oi.product_name) AS product_name, MAX(p.slug) AS product_slug, MAX(o.order_id) AS last_order_id, MAX(o.created_at) AS last_order_at
    FROM orders o
    INNER JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN products p ON p.product_id = oi.product_id
    WHERE (o.user_id = ? OR LOWER(COALESCE(o.customer_email,'')) = LOWER(?))
      AND (LOWER(COALESCE(o.payment_status,'')) IN ('paid','completed','captured','partially_refunded','refunded') OR LOWER(COALESCE(o.order_status,'')) IN ('fulfilled','paid','refunded'))
    GROUP BY oi.product_id
    ORDER BY last_order_at DESC
    LIMIT 50
  `).bind(memberUser.user_id, memberUser.email).all().catch(() => ({ results: [] })));

  const reviews = normalizeResults(await db.prepare(`
    SELECT pr.product_review_id, pr.product_id, pr.order_id, pr.rating, pr.review_text, pr.review_kind, pr.status, pr.is_featured, pr.admin_notes, pr.created_at,
           p.name AS product_name, p.slug AS product_slug
    FROM product_reviews pr
    LEFT JOIN products p ON p.product_id = pr.product_id
    WHERE pr.user_id = ? OR LOWER(COALESCE(pr.reviewer_email,'')) = LOWER(?)
    ORDER BY pr.created_at DESC, pr.product_review_id DESC
  `).bind(memberUser.user_id, memberUser.email).all().catch(() => ({ results: [] })));

  return json({
    ok: true,
    purchased_products: purchasedProducts.map((row) => ({ product_id: Number(row.product_id || 0), product_name: row.product_name || '', product_slug: row.product_slug || '', last_order_id: Number(row.last_order_id || 0), last_order_at: row.last_order_at || null })),
    reviews: reviews.map((row) => ({ product_review_id: Number(row.product_review_id || 0), product_id: Number(row.product_id || 0), order_id: Number(row.order_id || 0), rating: Number(row.rating || 0), review_text: row.review_text || '', review_kind: row.review_kind || 'testimonial', status: row.status || 'pending_review', is_featured: Number(row.is_featured || 0), admin_notes: row.admin_notes || '', created_at: row.created_at || null, product_name: row.product_name || '', product_slug: row.product_slug || '' }))
  });
}

export async function onRequestPost(context) {
  const { request, env } = context; const db = env.DB || env.DD_DB;
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);
  const memberUser = await getMemberUserFromRequest(request, env); if (!memberUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  await ensureReviewTable(db);

  let body={}; try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  const productId = Number(body.product_id || 0) || null;
  const orderId = Number(body.order_id || 0) || null;
  const rating = Math.min(5, Math.max(1, Number(body.rating || 5) || 5));
  const reviewText = normalizeText(body.review_text);
  const reviewKind = ['review', 'testimonial'].includes(String(body.review_kind || '').toLowerCase()) ? String(body.review_kind).toLowerCase() : 'testimonial';
  const reviewerName = normalizeText(body.reviewer_name || memberUser.display_name || '');
  if (!reviewText) return json({ ok: false, error: 'review_text is required.' }, 400);

  await db.prepare(`
    INSERT INTO product_reviews (
      product_id, order_id, user_id, reviewer_name, reviewer_email,
      rating, review_text, review_kind, status, is_featured, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(productId, orderId, memberUser.user_id, reviewerName || null, memberUser.email || null, rating, reviewText, reviewKind).run();

  return json({ ok: true, message: 'Your feedback was saved for review.' }, 201);
}
