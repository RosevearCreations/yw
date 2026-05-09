import { getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

// File: /functions/api/admin/import-products-preview.js
// Brief description: Previews bulk product import rows for admin workflow cleanup. It accepts
// CSV or JSON row data, normalizes important fields, reports validation problems, and surfaces
// duplicate risks so admins can clean data before a full import/insert step.

function json(data, status = 200) {
  return jsonResponse(data, status);
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function normalizeStatus(value) {
  const candidate = normalizeText(value).toLowerCase();
  return ['draft', 'active', 'archived'].includes(candidate) ? candidate : 'draft';
}

function normalizeReviewStatus(value) {
  const candidate = normalizeText(value).toLowerCase();
  return ['pending_review', 'approved', 'needs_changes', 'published'].includes(candidate)
    ? candidate
    : 'pending_review';
}

function normalizeProductType(value) {
  const candidate = normalizeText(value).toLowerCase();
  return ['physical', 'digital'].includes(candidate) ? candidate : '';
}

function validateHttpUrl(value) {
  return /^https?:\/\//i.test(normalizeText(value));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) {
    return json({ ok: false, error: 'rows must contain at least one product row.' }, 400);
  }

  const previewSlugs = new Map();
  const previewSkus = new Map();
  const previewProductNumbers = new Map();
  rows.forEach((row) => {
    const previewSlug = normalizeText(row?.slug) || slugify(normalizeText(row?.name));
    const previewSku = normalizeText(row?.sku);
    const previewProductNumber = parseInteger(row?.product_number);
    if (previewSlug) previewSlugs.set(previewSlug, (previewSlugs.get(previewSlug) || 0) + 1);
    if (previewSku) previewSkus.set(previewSku, (previewSkus.get(previewSku) || 0) + 1);
    if (previewProductNumber != null) previewProductNumbers.set(String(previewProductNumber), (previewProductNumbers.get(String(previewProductNumber)) || 0) + 1);
  });

  const slugCandidates = Array.from(previewSlugs.keys()).slice(0, 300);
  const skuCandidates = Array.from(previewSkus.keys()).slice(0, 300);
  const productNumberCandidates = Array.from(previewProductNumbers.keys()).slice(0, 300);

  const existingSlugMap = new Map();
  const existingSkuMap = new Map();
  const existingProductNumberMap = new Map();

  if (slugCandidates.length) {
    const placeholders = slugCandidates.map(() => '?').join(',');
    const existingRows = await db.prepare(`SELECT slug FROM products WHERE slug IN (${placeholders})`).bind(...slugCandidates).all().catch(() => ({ results: [] }));
    for (const existingRow of Array.isArray(existingRows?.results) ? existingRows.results : []) {
      existingSlugMap.set(normalizeText(existingRow.slug), true);
    }
  }

  if (skuCandidates.length) {
    const placeholders = skuCandidates.map(() => '?').join(',');
    const existingRows = await db.prepare(`SELECT sku FROM products WHERE sku IN (${placeholders})`).bind(...skuCandidates).all().catch(() => ({ results: [] }));
    for (const existingRow of Array.isArray(existingRows?.results) ? existingRows.results : []) {
      existingSkuMap.set(normalizeText(existingRow.sku), true);
    }
  }

  if (productNumberCandidates.length) {
    const placeholders = productNumberCandidates.map(() => '?').join(',');
    const existingRows = await db.prepare(`SELECT product_number FROM products WHERE product_number IN (${placeholders})`).bind(...productNumberCandidates).all().catch(() => ({ results: [] }));
    for (const existingRow of Array.isArray(existingRows?.results) ? existingRows.results : []) {
      existingProductNumberMap.set(String(existingRow.product_number), true);
    }
  }

  const issueCounts = new Map();
  const preview = rows.map((row, index) => {
    const name = normalizeText(row?.name);
    const slug = normalizeText(row?.slug) || slugify(name || captureReference || `draft-product-${index + 1}`);
    const sku = normalizeText(row?.sku);
    const productNumber = parseInteger(row?.product_number);
    const captureReference = normalizeText(row?.capture_reference);
    const productCategory = normalizeText(row?.product_category);
    const colorName = normalizeText(row?.color_name);
    const shippingCode = normalizeText(row?.shipping_code);
    const productType = normalizeProductType(row?.product_type);
    const status = normalizeStatus(row?.status);
    const reviewStatus = normalizeReviewStatus(row?.review_status);
    const price = parseInteger(row?.price_cents);
    const compareAtPrice = parseInteger(row?.compare_at_price_cents);
    const inventoryQuantity = parseInteger(row?.inventory_quantity);
    const sortOrder = parseInteger(row?.sort_order);
    const weightGrams = parseInteger(row?.weight_grams);
    const inventoryTracking = normalizeBooleanFlag(row?.inventory_tracking, 0);
    const requiresShipping = normalizeBooleanFlag(row?.requires_shipping, 0);
    const taxable = normalizeBooleanFlag(row?.taxable, 1);
    const readyFlag = normalizeBooleanFlag(row?.is_ready_for_storefront, 0);
    const featuredImageUrl = normalizeText(row?.featured_image_url);
    const additionalImageUrls = splitMultiValue(row?.additional_image_urls);
    const tags = splitMultiValue(row?.tags);
    const metaTitle = normalizeText(row?.meta_title);
    const metaDescription = normalizeText(row?.meta_description);
    const issues = [];

    const hasMinimumPartialEntry = Boolean(name || captureReference || featuredImageUrl || additionalImageUrls.length);
    if (!hasMinimumPartialEntry) issues.push('Add at least a name, capture_reference, or one image URL.');
    if (!slug) issues.push('Missing slug.');
    if (!productType) issues.push('product_type must be physical or digital.');
    if (price == null || price < 0) issues.push('price_cents must be a whole number at or above zero.');
    if (compareAtPrice != null && compareAtPrice < 0) issues.push('compare_at_price_cents must be zero or higher when provided.');
    if (productNumber != null && productNumber <= 0) issues.push('product_number must be greater than zero when provided.');
    if (inventoryQuantity != null && inventoryQuantity < 0) issues.push('inventory_quantity cannot be negative.');
    if (weightGrams != null && weightGrams < 0) issues.push('weight_grams cannot be negative.');
    if (sortOrder != null && sortOrder < 0) issues.push('sort_order cannot be negative.');
    if (slug && (previewSlugs.get(slug) || 0) > 1) issues.push('Slug is duplicated in this import batch.');
    if (sku && (previewSkus.get(sku) || 0) > 1) issues.push('SKU is duplicated in this import batch.');
    if (productNumber != null && (previewProductNumbers.get(String(productNumber)) || 0) > 1) issues.push('product_number is duplicated in this import batch.');
    if (slug && existingSlugMap.has(slug)) issues.push('Slug already exists in the database.');
    if (sku && existingSkuMap.has(sku)) issues.push('SKU already exists in the database.');
    if (productNumber != null && existingProductNumberMap.has(String(productNumber))) issues.push('product_number already exists in the database.');
    if (featuredImageUrl && !validateHttpUrl(featuredImageUrl)) issues.push('featured_image_url must start with http or https when provided.');
    if (additionalImageUrls.some((url) => !validateHttpUrl(url))) issues.push('additional_image_urls must all start with http or https.');
    if (productType === 'digital' && requiresShipping === 1) issues.push('Digital products should not require shipping.');
    if (productType === 'physical' && requiresShipping == null) issues.push('requires_shipping should be 0 or 1 for physical products.');
    if (inventoryTracking == null) issues.push('inventory_tracking should be 0 or 1.');
    if (requiresShipping == null) issues.push('requires_shipping should be 0 or 1.');
    if (taxable == null) issues.push('taxable should be 0 or 1.');
    if (readyFlag == null) issues.push('is_ready_for_storefront should be 0 or 1.');
    if (metaTitle.length > 70) issues.push('meta_title should stay at or under 70 characters.');
    if (metaDescription.length > 160) issues.push('meta_description should stay at or under 160 characters.');

    issues.forEach((issue) => issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1));

    return {
      row_number: index + 1,
      normalized: {
        product_number: productNumber,
        name,
        capture_reference: captureReference || null,
        slug,
        sku,
        product_category: productCategory || null,
        color_name: colorName || null,
        shipping_code: shippingCode || null,
        product_type: productType || 'physical',
        status,
        review_status: reviewStatus,
        is_ready_for_storefront: readyFlag == null ? null : readyFlag,
        price_cents: price,
        compare_at_price_cents: compareAtPrice,
        currency: normalizeText(row?.currency || 'CAD').toUpperCase() || 'CAD',
        inventory_tracking: inventoryTracking,
        inventory_quantity: inventoryQuantity == null ? 0 : inventoryQuantity,
        requires_shipping: requiresShipping,
        taxable,
        weight_grams: weightGrams,
        sort_order: sortOrder == null ? 0 : sortOrder,
        featured_image_url: featuredImageUrl || null,
        additional_image_urls: additionalImageUrls,
        tags,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null
      },
      issues,
      valid: issues.length === 0
    };
  });

  return json({
    ok: true,
    preview,
    summary: {
      total_rows: preview.length,
      valid_rows: preview.filter((row) => row.valid).length,
      invalid_rows: preview.filter((row) => !row.valid).length,
      duplicate_slug_rows: preview.filter((row) => row.issues.includes('Slug is duplicated in this import batch.')).length,
      duplicate_sku_rows: preview.filter((row) => row.issues.includes('SKU is duplicated in this import batch.')).length,
      duplicate_product_number_rows: preview.filter((row) => row.issues.includes('product_number is duplicated in this import batch.')).length,
      issue_breakdown: Array.from(issueCounts.entries()).map(([issue, count]) => ({ issue, count }))
    },
    requested_by: adminUser
  });
}
