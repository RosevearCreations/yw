// File: /functions/api/admin/product-seo.js
// Brief description: Gets and updates product SEO fields such as title, description, keywords, and social fields.

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
  const row = await env.DB.prepare(`SELECT * FROM product_seo WHERE product_id = ? LIMIT 1`).bind(product_id).first();
  return json({ ok: true, seo: row ? {
    product_id: Number(row.product_id || 0), meta_title: row.meta_title || '', meta_description: row.meta_description || '',
    keywords: row.keywords || '', h1_override: row.h1_override || '', canonical_url: row.canonical_url || '',
    schema_type: row.schema_type || 'Product', og_title: row.og_title || '', og_description: row.og_description || '',
    og_image_url: row.og_image_url || '', updated_at: row.updated_at || null
  } : null });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  const product_id = Number(body.product_id);
  if (!Number.isInteger(product_id) || product_id <= 0) return json({ ok: false, error: 'A valid product_id is required.' }, 400);
  await env.DB.prepare(`
    INSERT INTO product_seo (
      product_id, meta_title, meta_description, keywords, h1_override, canonical_url,
      schema_type, og_title, og_description, og_image_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(product_id) DO UPDATE SET
      meta_title = excluded.meta_title,
      meta_description = excluded.meta_description,
      keywords = excluded.keywords,
      h1_override = excluded.h1_override,
      canonical_url = excluded.canonical_url,
      schema_type = excluded.schema_type,
      og_title = excluded.og_title,
      og_description = excluded.og_description,
      og_image_url = excluded.og_image_url,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    product_id,
    normalizeText(body.meta_title) || null,
    normalizeText(body.meta_description) || null,
    normalizeText(body.keywords) || null,
    normalizeText(body.h1_override) || null,
    normalizeText(body.canonical_url) || null,
    normalizeText(body.schema_type) || 'Product',
    normalizeText(body.og_title) || null,
    normalizeText(body.og_description) || null,
    normalizeText(body.og_image_url) || null
  ).run();
  return json({ ok: true, message: 'Product SEO saved.' });
}
