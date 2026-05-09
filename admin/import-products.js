import { auditAdminAction, getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

// File: /functions/api/admin/import-products.js
// Brief description: Imports validated product rows in bulk so finished products can be seeded faster.
// This pass now supports more finished-product fields, optional SEO rows, tags, and extra image rows
// so imports can produce cleaner draft records instead of partial shells.

function json(data, status = 200) {
  return jsonResponse(data, status);
}

function normalizeSlug(value) {
  return String(value || '')
    .trim().toLowerCase().replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseInteger(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
}

function normalizeBooleanFlag(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  if ([1, '1', true, 'true', 'yes', 'y'].includes(value)) return 1;
  if ([0, '0', false, 'false', 'no', 'n'].includes(value)) return 0;
  return null;
}

function splitMultiValue(value) {
  return String(value || '')
    .split(/[|,]/)
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

function normalizeReviewStatus(value) {
  const candidate = normalizeText(value).toLowerCase();
  return ['pending_review', 'approved', 'needs_changes', 'published'].includes(candidate)
    ? candidate
    : 'pending_review';
}

function normalizeStatus(value) {
  const candidate = normalizeText(value).toLowerCase();
  return ['draft', 'active', 'archived'].includes(candidate) ? candidate : 'draft';
}

function normalizeProductType(value) {
  const candidate = normalizeText(value).toLowerCase();
  return ['physical', 'digital'].includes(candidate) ? candidate : '';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return json({ ok: false, error: 'rows are required.' }, 400);

  let inserted = 0;
  const errors = [];
  const importedProductIds = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const name = normalizeText(row.name);
    const slug = normalizeSlug(row.slug || row.name || row.capture_reference || `draft-product-${i + 1}`);
    const captureReference = normalizeText(row.capture_reference);
    const productType = normalizeProductType(row.product_type || 'physical');
    const status = normalizeStatus(row.status);
    const reviewStatus = normalizeReviewStatus(row.review_status);
    const priceCents = parseInteger(row.price_cents);
    const compareAtPriceCents = parseInteger(row.compare_at_price_cents);
    const inventoryQuantity = parseInteger(row.inventory_quantity);
    const productNumber = parseInteger(row.product_number);
    const weightGrams = parseInteger(row.weight_grams);
    const sortOrder = parseInteger(row.sort_order);
    const inventoryTracking = normalizeBooleanFlag(row.inventory_tracking, 0);
    const requiresShipping = normalizeBooleanFlag(row.requires_shipping, productType === 'physical' ? 1 : 0);
    const taxable = normalizeBooleanFlag(row.taxable, 1);
    const readyForStorefront = normalizeBooleanFlag(row.is_ready_for_storefront, 0);
    const featuredImageUrl = normalizeText(row.featured_image_url) || null;
    const additionalImageUrls = splitMultiValue(row.additional_image_urls);
    const tags = splitMultiValue(row.tags);
    const metaTitle = normalizeText(row.meta_title);
    const metaDescription = normalizeText(row.meta_description);
    const keywords = normalizeText(row.keywords || tags.join(', '));

    const hasMinimumPartialEntry = Boolean(name || captureReference || featuredImageUrl || additionalImageUrls.length);
    const resolvedName = name || captureReference || `Draft product ${i + 1}`;
    if (!hasMinimumPartialEntry || !slug || !['physical', 'digital'].includes(productType) || priceCents == null || priceCents < 0) {
      errors.push({ row_number: i + 1, error: 'Missing required slug/product_type/price_cents or there is no name/reference/image clue.' });
      continue;
    }

    try {
      const insert = await db.prepare(`
        INSERT INTO products (
          slug, product_number, sku, name, capture_reference, product_category, color_name, shipping_code,
          review_status, is_ready_for_storefront, ready_check_notes,
          short_description, description, product_type, status, price_cents,
          compare_at_price_cents, currency, taxable, tax_class_id, tax_class_code,
          requires_shipping, weight_grams, inventory_tracking, inventory_quantity,
          digital_file_url, featured_image_url, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        slug,
        productNumber,
        normalizeText(row.sku) || null,
        resolvedName,
        captureReference || null,
        normalizeText(row.product_category) || null,
        normalizeText(row.color_name) || null,
        normalizeText(row.shipping_code) || null,
        reviewStatus,
        readyForStorefront == null ? 0 : readyForStorefront,
        normalizeText(row.ready_check_notes) || (captureReference ? `Capture reference: ${captureReference}` : null),
        normalizeText(row.short_description) || null,
        normalizeText(row.description) || null,
        productType,
        status,
        priceCents,
        compareAtPriceCents,
        normalizeText(row.currency || 'CAD').toUpperCase() || 'CAD',
        taxable == null ? 1 : taxable,
        parseInteger(row.tax_class_id),
        normalizeText(row.tax_class_code) || null,
        requiresShipping == null ? (productType === 'physical' ? 1 : 0) : requiresShipping,
        weightGrams,
        inventoryTracking == null ? 0 : inventoryTracking,
        inventoryQuantity == null ? 0 : inventoryQuantity,
        normalizeText(row.digital_file_url) || null,
        featuredImageUrl,
        sortOrder == null ? 0 : sortOrder
      ).run();

      const productId = Number(insert?.meta?.last_row_id || 0);
      importedProductIds.push(productId);

      if (featuredImageUrl) {
        await db.prepare(`
          INSERT INTO product_images (product_id, image_url, alt_text, sort_order, created_at)
          VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
        `).bind(productId, featuredImageUrl, normalizeText(row.featured_image_alt || resolvedName) || resolvedName).run().catch(() => null);
      }

      for (let imageIndex = 0; imageIndex < additionalImageUrls.length; imageIndex += 1) {
        const imageUrl = additionalImageUrls[imageIndex];
        await db.prepare(`
          INSERT INTO product_images (product_id, image_url, alt_text, sort_order, created_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(productId, imageUrl, resolvedName, imageIndex + 1).run().catch(() => null);
      }

      for (const tag of tags) {
        await db.prepare(`
          INSERT INTO product_tags (product_id, tag, created_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).bind(productId, tag).run().catch(() => null);
      }

      if (metaTitle || metaDescription || keywords || featuredImageUrl) {
        await db.prepare(`
          INSERT INTO product_seo (
            product_id, meta_title, meta_description, keywords, og_title, og_description, og_image_url,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          productId,
          metaTitle || null,
          metaDescription || null,
          keywords || null,
          metaTitle || resolvedName,
          metaDescription || normalizeText(row.short_description) || null,
          featuredImageUrl || null
        ).run().catch(() => null);
      }

      inserted += 1;
    } catch (error) {
      errors.push({ row_number: i + 1, error: error.message || 'Insert failed.' });
    }
  }

  await auditAdminAction(env, request, adminUser, {
    action_type: 'product_import',
    target_type: 'product_batch',
    target_key: `rows:${rows.length}`,
    details: {
      inserted_count: inserted,
      error_count: errors.length,
      imported_product_ids: importedProductIds.slice(0, 50)
    }
  });

  return json({ ok: true, inserted_count: inserted, error_count: errors.length, errors, imported_product_ids: importedProductIds });
}
