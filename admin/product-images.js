// File: /functions/api/admin/product-images.js
// Brief description: Gets and updates ordered product images so product media, annotations,
// and storefront rendering can be managed together from the admin interface.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function normalizeText(value) {
  return String(value || '').trim();
}

function getBearerToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || '').trim() : '';
}

async function getAdminUserFromRequest(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;
  const session = await env.DB.prepare(`
    SELECT s.session_id, s.user_id, u.user_id AS resolved_user_id, u.email, u.display_name, u.role, u.is_active
    FROM sessions s
    INNER JOIN users u ON u.user_id = s.user_id
    WHERE (s.session_token = ? OR s.token = ?)
      AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(token, token).first();

  if (!session) return null;
  if (Number(session.is_active || 0) !== 1) return null;
  if (String(session.role || '').toLowerCase() !== 'admin') return null;
  return { user_id: Number(session.resolved_user_id || session.user_id || 0), email: session.email || '', display_name: session.display_name || '' };
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

  const images = normalizeResults(await env.DB.prepare(`
    SELECT pi.product_image_id, pi.product_id, pi.image_url, pi.alt_text, pi.sort_order, pi.created_at,
           pia.image_title, pia.caption, pia.focal_point_x, pia.focal_point_y, pia.annotation_notes
    FROM product_images pi
    LEFT JOIN product_image_annotations pia ON pia.product_image_id = pi.product_image_id
    WHERE pi.product_id = ?
    ORDER BY pi.sort_order ASC, pi.product_image_id ASC
  `).bind(product_id).all());

  return json({ ok: true, images: images.map((row) => ({
    product_image_id: Number(row.product_image_id || 0),
    product_id: Number(row.product_id || 0),
    image_url: row.image_url || '',
    alt_text: row.alt_text || '',
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at || null,
    image_title: row.image_title || '',
    caption: row.caption || '',
    focal_point_x: row.focal_point_x ?? null,
    focal_point_y: row.focal_point_y ?? null,
    annotation_notes: row.annotation_notes || ''
  })) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }

  const product_id = Number(body.product_id);
  const images = Array.isArray(body.images) ? body.images.slice(0, 20) : [];
  if (!Number.isInteger(product_id) || product_id <= 0) return json({ ok: false, error: 'A valid product_id is required.' }, 400);

  const product = await env.DB.prepare(`SELECT product_id, name, featured_image_url FROM products WHERE product_id = ? LIMIT 1`).bind(product_id).first();
  if (!product) return json({ ok: false, error: 'Product not found.' }, 404);

  await env.DB.prepare(`DELETE FROM product_image_annotations WHERE product_id = ?`).bind(product_id).run();
  await env.DB.prepare(`DELETE FROM product_images WHERE product_id = ?`).bind(product_id).run();

  let featuredImageUrl = null;
  for (let i = 0; i < images.length; i += 1) {
    const row = images[i] || {};
    const imageUrl = normalizeText(row.image_url);
    if (!imageUrl) continue;
    const altText = normalizeText(row.alt_text) || product.name || null;
    const sortOrder = Number.isInteger(Number(row.sort_order)) ? Number(row.sort_order) : i;

    const insert = await env.DB.prepare(`
      INSERT INTO product_images (product_id, image_url, alt_text, sort_order, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(product_id, imageUrl, altText, sortOrder,).run();

    const productImageId = Number(insert?.meta?.last_row_id || 0);
    await env.DB.prepare(`
      INSERT INTO product_image_annotations (
        product_id, product_image_id, image_url, alt_text, image_title, caption,
        focal_point_x, focal_point_y, annotation_notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      product_id,
      productImageId || null,
      imageUrl,
      altText,
      normalizeText(row.image_title) || null,
      normalizeText(row.caption) || null,
      row.focal_point_x == null ? null : Number(row.focal_point_x),
      row.focal_point_y == null ? null : Number(row.focal_point_y),
      normalizeText(row.annotation_notes) || null
    ).run();

    if (featuredImageUrl == null || Number(sortOrder) === 0) {
      featuredImageUrl = imageUrl;
    }
  }

  if (featuredImageUrl) {
    await env.DB.prepare(`
      UPDATE products
      SET featured_image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `).bind(featuredImageUrl, product_id).run();
  }

  return json({ ok: true, message: 'Product images saved.', featured_image_url: featuredImageUrl || product.featured_image_url || null });
}
