// File: /functions/api/admin/archive-product.js

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function getSessionUser(env, token) {
  if (!token) return null;

  const sessionUser = await env.DB.prepare(`
    SELECT
      users.user_id,
      users.email,
      users.display_name,
      users.role,
      users.is_active
    FROM sessions
    JOIN users ON sessions.user_id = users.user_id
    WHERE sessions.session_token = ?
      AND sessions.expires_at > datetime('now')
    LIMIT 1
  `)
    .bind(token)
    .first();

  return sessionUser || null;
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return { error: json({ ok: false, error: "Unauthorized." }, 401) };
  }

  const token = auth.slice(7).trim();
  if (!token) {
    return { error: json({ ok: false, error: "Missing session token." }, 401) };
  }

  const sessionUser = await getSessionUser(env, token);

  if (!sessionUser) {
    return { error: json({ ok: false, error: "Invalid session." }, 401) };
  }

  if (!sessionUser.is_active) {
    return { error: json({ ok: false, error: "Account is inactive." }, 403) };
  }

  if (sessionUser.role !== "admin") {
    return { error: json({ ok: false, error: "Forbidden." }, 403) };
  }

  return { sessionUser };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const authCheck = await requireAdmin(request, env);
  if (authCheck.error) return authCheck.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const product_id = Number(body.product_id);

  if (!Number.isInteger(product_id) || product_id <= 0) {
    return json({ ok: false, error: "A valid product_id is required." }, 400);
  }

  const existingProduct = await env.DB.prepare(`
    SELECT
      product_id,
      slug,
      sku,
      name,
      product_type,
      status,
      price_cents,
      currency
    FROM products
    WHERE product_id = ?
    LIMIT 1
  `)
    .bind(product_id)
    .first();

  if (!existingProduct) {
    return json({ ok: false, error: "Product not found." }, 404);
  }

  if (existingProduct.status === "archived") {
    return json({
      ok: true,
      message: "Product is already archived.",
      product: existingProduct
    });
  }

  await env.DB.prepare(`
    UPDATE products
    SET
      status = 'archived',
      updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ?
  `)
    .bind(product_id)
    .run();

  const archivedProduct = await env.DB.prepare(`
    SELECT
      product_id,
      slug,
      sku,
      name,
      short_description,
      description,
      product_type,
      status,
      price_cents,
      compare_at_price_cents,
      currency,
      taxable,
      tax_class_id,
      requires_shipping,
      weight_grams,
      inventory_tracking,
      inventory_quantity,
      digital_file_url,
      featured_image_url,
      sort_order,
      created_at,
      updated_at
    FROM products
    WHERE product_id = ?
    LIMIT 1
  `)
    .bind(product_id)
    .first();

  return json({
    ok: true,
    message: "Product archived successfully.",
    product: archivedProduct
  });
}
