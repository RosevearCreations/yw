// File: /functions/api/admin/product-detail.js
// Brief description: Returns one product with images, SEO, and image annotations for admin editing.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

async function getAdminUserFromRequest(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;

  const session = await env.DB.prepare(`
    SELECT
      s.session_id,
      s.user_id,
      u.user_id AS resolved_user_id,
      u.email,
      u.display_name,
      u.role,
      u.is_active
    FROM sessions s
    INNER JOIN users u ON u.user_id = s.user_id
    WHERE (s.session_token = ? OR s.token = ?)
      AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(token, token).first();

  if (!session) return null;
  if (Number(session.is_active || 0) !== 1) return null;
  if (String(session.role || '').toLowerCase() !== 'admin') return null;

  return {
    user_id: Number(session.resolved_user_id || session.user_id || 0),
    email: session.email || '',
    display_name: session.display_name || '',
    role: 'admin'
  };
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}


export async function onRequestGet(context) {
  const { request, env } = context;
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  const product_id = Number(new URL(request.url).searchParams.get('product_id'));
  if (!Number.isInteger(product_id) || product_id <= 0) return json({ ok: false, error: 'A valid product_id is required.' }, 400);

  const product = await env.DB.prepare(`
    SELECT p.*, tc.code AS tax_class_code, tc.name AS tax_class_name, tc.tax_rate AS tax_rate,
           ps.meta_title, ps.meta_description, ps.keywords, ps.h1_override, ps.canonical_url,
           ps.schema_type, ps.og_title, ps.og_description, ps.og_image_url
    FROM products p
    LEFT JOIN tax_classes tc ON p.tax_class_id = tc.tax_class_id
    LEFT JOIN product_seo ps ON ps.product_id = p.product_id
    WHERE p.product_id = ?
    LIMIT 1
  `).bind(product_id).first();

  if (!product) return json({ ok: false, error: 'Product not found.' }, 404);

  const images = normalizeResults(await env.DB.prepare(`
    SELECT product_image_id, product_id, image_url, alt_text, sort_order, created_at
    FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, product_image_id ASC
  `).bind(product_id).all());

  const image_annotations = normalizeResults(await env.DB.prepare(`
    SELECT product_image_annotation_id, product_id, product_image_id, image_url, alt_text, image_title, caption,
           focal_point_x, focal_point_y, annotation_notes, updated_at
    FROM product_image_annotations WHERE product_id = ? ORDER BY product_image_annotation_id ASC
  `).bind(product_id).all());

  return json({ ok: true, product, images, image_annotations });
}
