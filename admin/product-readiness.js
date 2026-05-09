import { getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

function json(data, status = 200) { return jsonResponse(data, status); }

function buildChecks(row = {}) {
  const imageCount = Number(row.image_count || 0);
  const altCoverage = Number(row.alt_coverage_count || 0);
  const checks = [];
  checks.push({ key: 'name', ok: normalizeText(row.name).length > 0, label: 'Product name present', weight: 10 });
  checks.push({ key: 'slug', ok: normalizeText(row.slug).length > 0, label: 'Slug present', weight: 8 });
  checks.push({ key: 'price', ok: Number(row.price_cents || 0) > 0, label: 'Price set', weight: 12 });
  checks.push({ key: 'featured_image', ok: normalizeText(row.featured_image_url).length > 0, label: 'Featured image present', weight: 12 });
  checks.push({ key: 'image_count', ok: imageCount >= 3, label: 'At least 3 product photos', weight: 12 });
  checks.push({ key: 'image_alt', ok: imageCount > 0 && altCoverage >= Math.min(3, imageCount), label: 'Alt text filled on first product photos', weight: 8 });
  checks.push({ key: 'short_description', ok: normalizeText(row.short_description).length >= 40, label: 'Short description present', weight: 10 });
  checks.push({ key: 'description', ok: normalizeText(row.description).length >= 120, label: 'Full description has enough detail', weight: 8 });
  checks.push({ key: 'seo_title', ok: normalizeText(row.meta_title).length >= 10, label: 'SEO title present', weight: 8 });
  checks.push({ key: 'seo_description', ok: normalizeText(row.meta_description).length >= 50, label: 'SEO description present', weight: 8 });
  checks.push({ key: 'category', ok: normalizeText(row.product_category).length > 0, label: 'Category present', weight: 4 });

  const totalWeight = checks.reduce((sum, item) => sum + item.weight, 0);
  const earnedWeight = checks.reduce((sum, item) => sum + (item.ok ? item.weight : 0), 0);
  const failed = checks.filter((item) => !item.ok);
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  return {
    checks,
    publish_readiness_score: score,
    image_quality_score: Math.round((((normalizeText(row.featured_image_url).length > 0 ? 1 : 0) + Math.min(imageCount, 5) / 5 + (imageCount > 0 ? Math.min(altCoverage / imageCount, 1) : 0)) / 3) * 100),
    is_ready_for_storefront: failed.length === 0 ? 1 : 0,
    ready_check_notes: failed.map((item) => item.label).join('; '),
    photo_completeness_warning: imageCount >= 3 ? '' : 'Add more product photos before publishing.',
    first_image_warning: normalizeText(row.featured_image_url).length > 0 ? '' : 'Choose a first image before publishing.'
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  const productId = Number(new URL(request.url).searchParams.get('product_id') || 0);
  if (!productId) return json({ ok: false, error: 'product_id is required.' }, 400);
  const row = await db.prepare(`
    SELECT p.*, ps.meta_title, ps.meta_description,
           COUNT(DISTINCT pi.product_image_id) AS image_count,
           SUM(CASE WHEN LENGTH(TRIM(COALESCE(pi.alt_text,''))) >= 5 THEN 1 ELSE 0 END) AS alt_coverage_count
    FROM products p
    LEFT JOIN product_seo ps ON ps.product_id = p.product_id
    LEFT JOIN product_images pi ON pi.product_id = p.product_id
    WHERE p.product_id = ?
    GROUP BY p.product_id
    LIMIT 1
  `).bind(productId).first();
  if (!row) return json({ ok: false, error: 'Product not found.' }, 404);
  const readiness = buildChecks(row);
  return json({ ok: true, product_id: productId, ...readiness });
}
