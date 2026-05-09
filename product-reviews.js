function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }
async function tableExists(db, tableName) {
  try {
    const row = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`).bind(tableName).first();
    return !!row;
  } catch { return false; }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB || env.DD_DB;
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);
  if (!(await tableExists(db, 'product_reviews'))) return json({ ok: true, reviews: [], summary: { average_rating: 0, review_count: 0 } });
  const url = new URL(request.url);
  const productId = Number(url.searchParams.get('product_id') || 0);
  const featuredOnly = ['1', 'true', 'yes'].includes(String(url.searchParams.get('featured_only') || '').toLowerCase());
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get('limit') || 20) || 20));
  const rows = normalizeResults(await db.prepare(`
    SELECT pr.product_review_id, pr.product_id, pr.rating, pr.review_text, pr.review_kind, pr.is_featured, pr.created_at,
           pr.reviewer_name, p.name AS product_name, p.slug AS product_slug
    FROM product_reviews pr
    LEFT JOIN products p ON p.product_id = pr.product_id
    WHERE pr.status = 'approved'
      AND (? = 0 OR pr.product_id = ?)
      AND (? = 0 OR pr.is_featured = 1)
    ORDER BY pr.is_featured DESC, pr.created_at DESC, pr.product_review_id DESC
    LIMIT ?
  `).bind(productId, productId, featuredOnly ? 1 : 0, limit).all().catch(() => ({ results: [] })));
  const avg = rows.length ? Number((rows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / rows.length).toFixed(2)) : 0;
  return json({ ok: true, reviews: rows.map((row) => ({ product_review_id: Number(row.product_review_id || 0), product_id: Number(row.product_id || 0), rating: Number(row.rating || 0), review_text: row.review_text || '', review_kind: row.review_kind || 'testimonial', is_featured: Number(row.is_featured || 0), created_at: row.created_at || null, reviewer_name: row.reviewer_name || 'Devil n Dove customer', product_name: row.product_name || '', product_slug: row.product_slug || '' })), summary: { average_rating: avg, review_count: rows.length } });
}
