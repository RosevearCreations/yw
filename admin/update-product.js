import { auditAdminAction, captureRuntimeIncident, getAdminUserFromRequest, getDb, jsonResponse } from "../_lib/adminAudit.js";

function json(data, status = 200) { return jsonResponse(data, status); }

async function requireAdmin(request, env) {
  const sessionUser = await getAdminUserFromRequest(request, env);
  if (!sessionUser) return { error: json({ ok: false, error: "Unauthorized." }, 401) };
  return { sessionUser };
}

function normalizeSlug(value) {
  return String(value || "").trim().toLowerCase().replace(/["']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function normalizeImageUrls(imageUrls) {
  if (!Array.isArray(imageUrls)) return [];
  return imageUrls.map((url) => String(url || "").trim()).filter(Boolean).slice(0, 5);
}

function computeReadiness(fields = {}) {
  const failures = [];
  if (!String(fields.name || '').trim()) failures.push('name');
  if (!String(fields.slug || '').trim()) failures.push('slug');
  if (Number(fields.price_cents || 0) <= 0) failures.push('price');
  if (!String(fields.featured_image_url || '').trim()) failures.push('featured_image');
  if (!String(fields.product_category || '').trim()) failures.push('category');
  if (!String(fields.meta_title || '').trim()) failures.push('meta_title');
  if (!String(fields.meta_description || '').trim()) failures.push('meta_description');
  return { is_ready_for_storefront: failures.length === 0 ? 1 : 0, ready_check_notes: failures.join(', ') };
}

async function getTableColumnSet(db, tableName) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    return new Set(rows.map((row) => String(row?.name || '').trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function cleanMerchandiseOrigin(value) {
  const raw = String(value || '').trim().toLowerCase();
  return ['handmade', 'vintage', 'collectible', 'antique', 'oddity', 'prebuilt'].includes(raw) ? raw : 'handmade';
}
function cleanSaleChannel(value) {
  const raw = String(value || '').trim().toLowerCase();
  return ['onsite', 'external_only', 'hybrid'].includes(raw) ? raw : 'onsite';
}
function cleanExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : null;
}
function cleanText(value, max = 255) {
  const raw = String(value || '').trim();
  return raw ? raw.slice(0, max) : null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const authCheck = await requireAdmin(request, env);
  if (authCheck.error) return authCheck.error;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);
  const productColumns = await getTableColumnSet(db, 'products');

  try {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON body." }, 400); }

    const product_id = Number(body.product_id);
    const product_number = body.product_number == null || body.product_number === "" ? null : Number(body.product_number);
    const name = String(body.name || "").trim();
    const slug = normalizeSlug(body.slug || body.name || "");
    const sku = String(body.sku || "").trim() || null;
    const product_category = String(body.product_category || "").trim() || null;
    const color_name = String(body.color_name || "").trim() || null;
    const shipping_code = String(body.shipping_code || "").trim() || null;
    const review_status = String(body.review_status || "pending_review").trim().toLowerCase();
    const short_description = String(body.short_description || "").trim() || null;
    const description = String(body.description || "").trim() || null;
    const product_type = String(body.product_type || "").trim().toLowerCase();
    const status = String(body.status || "draft").trim().toLowerCase();
    const price_cents = Number(body.price_cents);
    const compare_at_price_cents = body.compare_at_price_cents == null || body.compare_at_price_cents === "" ? null : Number(body.compare_at_price_cents);
    const currency = String(body.currency || "CAD").trim().toUpperCase();
    const taxable = Number(body.taxable) === 0 ? 0 : 1;
    const tax_class_id = body.tax_class_id == null || body.tax_class_id === "" ? null : Number(body.tax_class_id);
    const requires_shipping = Number(body.requires_shipping) === 1 ? 1 : 0;
    const weight_grams = body.weight_grams == null || body.weight_grams === "" ? null : Number(body.weight_grams);
    const inventory_tracking = Number(body.inventory_tracking) === 1 ? 1 : 0;
    const inventory_quantity = body.inventory_quantity == null || body.inventory_quantity === "" ? 0 : Number(body.inventory_quantity);
    const digital_file_url = String(body.digital_file_url || "").trim() || null;
    const featured_image_url = String(body.featured_image_url || "").trim() || null;
    const sort_order = body.sort_order == null || body.sort_order === "" ? 0 : Number(body.sort_order);
    const image_urls = normalizeImageUrls(body.image_urls);
    const meta_title = String(body.meta_title || '').trim() || null;
    const meta_description = String(body.meta_description || '').trim() || null;
    const keywords = String(body.keywords || '').trim() || null;
    const h1_override = String(body.h1_override || '').trim() || null;
    const canonical_url = String(body.canonical_url || '').trim() || null;
    const og_title = String(body.og_title || '').trim() || null;
    const og_description = String(body.og_description || '').trim() || null;
    const og_image_url = String(body.og_image_url || '').trim() || null;
    const merchandise_origin = cleanMerchandiseOrigin(body.merchandise_origin);
    const sale_channel = cleanSaleChannel(body.sale_channel);
    const external_listing_url = cleanExternalUrl(body.external_listing_url);
    const external_listing_label = cleanText(body.external_listing_label, 120);
    const condition_summary = cleanText(body.condition_summary, 255);
    const era_label = cleanText(body.era_label, 120);
    const sourcing_notes = cleanText(body.sourcing_notes, 2000);
    const readiness = computeReadiness({ name, slug, price_cents, featured_image_url, product_category, meta_title, meta_description });

    if (!Number.isInteger(product_id) || product_id <= 0) return json({ ok: false, error: "A valid product_id is required." }, 400);
    if (product_number !== null && (!Number.isInteger(product_number) || product_number <= 0)) return json({ ok: false, error: "product_number must be a valid whole number." }, 400);
    if (!name) return json({ ok: false, error: "Product name is required." }, 400);
    if (!slug) return json({ ok: false, error: "A valid slug is required." }, 400);
    if (!['physical', 'digital'].includes(product_type)) return json({ ok: false, error: "Product type must be physical or digital." }, 400);
    if (!['draft', 'active', 'archived'].includes(status)) return json({ ok: false, error: "Status must be draft, active, or archived." }, 400);
    if (!['pending_review', 'approved', 'needs_changes', 'published'].includes(review_status)) return json({ ok: false, error: "review_status must be pending_review, approved, needs_changes, or published." }, 400);
    if (!Number.isInteger(price_cents) || price_cents < 0) return json({ ok: false, error: "price_cents must be a valid whole number of cents." }, 400);
    if (compare_at_price_cents !== null && (!Number.isInteger(compare_at_price_cents) || compare_at_price_cents < 0)) return json({ ok: false, error: "compare_at_price_cents must be a valid whole number of cents." }, 400);
    if (tax_class_id !== null && (!Number.isInteger(tax_class_id) || tax_class_id <= 0)) return json({ ok: false, error: "tax_class_id must be a valid id." }, 400);
    if (weight_grams !== null && (!Number.isInteger(weight_grams) || weight_grams < 0)) return json({ ok: false, error: "weight_grams must be a valid whole number." }, 400);
    if (!Number.isInteger(inventory_quantity) || inventory_quantity < 0) return json({ ok: false, error: "inventory_quantity must be a valid whole number." }, 400);
    if (!Number.isInteger(sort_order)) return json({ ok: false, error: "sort_order must be a valid whole number." }, 400);
    if (sale_channel !== 'onsite' && !external_listing_url) return json({ ok: false, error: 'Add an external listing URL when sale_channel is external_only or hybrid.' }, 400);

    const existingProduct = await db.prepare(`SELECT product_id, slug, sku FROM products WHERE product_id = ? LIMIT 1`).bind(product_id).first();
    if (!existingProduct) return json({ ok: false, error: "Product not found." }, 404);

    if (product_number !== null) {
      const existingProductNumber = await db.prepare(`SELECT product_id FROM products WHERE product_number = ? AND product_id != ? LIMIT 1`).bind(product_number, product_id).first();
      if (existingProductNumber) return json({ ok: false, error: "That product number already exists." }, 409);
    }

    const existingSlug = await db.prepare(`SELECT product_id FROM products WHERE slug = ? AND product_id != ? LIMIT 1`).bind(slug, product_id).first();
    if (existingSlug) return json({ ok: false, error: "That product slug already exists." }, 409);

    if (sku) {
      const existingSku = await db.prepare(`SELECT product_id FROM products WHERE sku = ? AND product_id != ? LIMIT 1`).bind(sku, product_id).first();
      if (existingSku) return json({ ok: false, error: "That SKU already exists." }, 409);
    }

    if (tax_class_id !== null) {
      const taxClass = await db.prepare(`SELECT tax_class_id FROM tax_classes WHERE tax_class_id = ? AND is_active = 1 LIMIT 1`).bind(tax_class_id).first();
      if (!taxClass) return json({ ok: false, error: "Selected tax class was not found." }, 400);
    }

    const assignments = [
      ['product_number', product_number], ['slug', slug], ['sku', sku], ['name', name], ['product_category', product_category], ['color_name', color_name], ['shipping_code', shipping_code],
      ['review_status', review_status], ['is_ready_for_storefront', readiness.is_ready_for_storefront], ['ready_check_notes', readiness.ready_check_notes || null], ['short_description', short_description], ['description', description],
      ['product_type', product_type], ['status', status], ['price_cents', price_cents], ['compare_at_price_cents', compare_at_price_cents], ['currency', currency], ['taxable', taxable], ['tax_class_id', tax_class_id],
      ['requires_shipping', requires_shipping], ['weight_grams', weight_grams], ['inventory_tracking', inventory_tracking], ['inventory_quantity', inventory_quantity], ['digital_file_url', digital_file_url],
      ['featured_image_url', featured_image_url], ['sort_order', sort_order], ['merchandise_origin', merchandise_origin], ['sale_channel', sale_channel], ['external_listing_url', external_listing_url], ['external_listing_label', external_listing_label], ['condition_summary', condition_summary], ['era_label', era_label], ['sourcing_notes', sourcing_notes]
    ];
    const setParts = [];
    const bindValues = [];
    assignments.forEach(([column, value]) => {
      if (productColumns.has(column)) {
        setParts.push(`${column} = ?`);
        bindValues.push(value);
      }
    });
    setParts.push('updated_at = CURRENT_TIMESTAMP');
    bindValues.push(product_id);

    await db.prepare(`UPDATE products SET ${setParts.join(', ')} WHERE product_id = ?`).bind(...bindValues).run();

    try {
      await db.prepare(`
        INSERT INTO product_seo (
          product_id, meta_title, meta_description, keywords, h1_override, canonical_url, schema_type, og_title, og_description, og_image_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'Product', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
      `).bind(product_id, meta_title, meta_description, keywords, h1_override, canonical_url, og_title, og_description, og_image_url).run();
    } catch {}

    await db.prepare(`DELETE FROM product_images WHERE product_id = ?`).bind(product_id).run();
    for (let i = 0; i < image_urls.length; i += 1) {
      await db.prepare(`INSERT INTO product_images (product_id, image_url, alt_text, sort_order, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(product_id, image_urls[i], name, i).run();
    }

    const updatedProduct = await db.prepare(`SELECT * FROM products WHERE product_id = ? LIMIT 1`).bind(product_id).first();
    const updatedImagesResult = await db.prepare(`SELECT product_image_id, product_id, image_url, alt_text, sort_order, created_at FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, product_image_id ASC`).bind(product_id).all();

    await auditAdminAction(env, request, authCheck.sessionUser, {
      action_type: "product_update",
      target_type: "product",
      target_id: Number(updatedProduct?.product_id || product_id),
      target_key: updatedProduct?.slug || slug,
      details: { name, status, review_status, inventory_quantity, has_images: image_urls.length > 0, merchandise_origin, sale_channel, has_external_listing: !!external_listing_url }
    });

    return json({ ok: true, message: "Product updated successfully.", product: updatedProduct, images: updatedImagesResult.results || [] });
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_product_update',
      incident_code: 'product_update_failed',
      severity: 'warning',
      message: error?.message || 'Product update failed.',
      related_user_id: authCheck.sessionUser?.user_id,
      details: { error: String(error?.message || error || 'Unknown error') }
    });
    return json({ ok: false, error: error?.message || 'Failed to update product.' }, 500);
  }
}
