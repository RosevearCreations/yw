// File: /functions/api/admin/mobile-create-product.js
import { captureRuntimeIncident, getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";
import { getNextProductNumber } from './_product-numbering.js';

function json(data, status = 200) {
  return jsonResponse(data, status);
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeFilename(filename) {
  const cleaned = String(filename || 'upload')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned || 'upload';
}

function inferExtension(filename, mimeType) {
  const fromName = String(filename || '').match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif'
  };
  return map[String(mimeType || '').toLowerCase()] || 'bin';
}

const DEFAULT_PRODUCT_MEDIA_PUBLIC_BASE_URL = 'https://assets.devilndove.com';

function getProductMediaPublicBase(env) {
  return normalizeText(
    env.PRODUCT_MEDIA_PUBLIC_BASE_URL ||
    env.R2_PUBLIC_BASE_URL ||
    env.PUBLIC_R2_BASE_URL ||
    env.ASSET_ORIGIN ||
    DEFAULT_PRODUCT_MEDIA_PUBLIC_BASE_URL
  );
}

function buildPublicUrl(env, objectKey) {
  const cleanKey = normalizeText(objectKey);
  if (!cleanKey) return null;
  const base = getProductMediaPublicBase(env);
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/${cleanKey.replace(/^\/+/, '')}`;
}

function normalizeStoredImageUrl(env, value) {
  const cleanValue = normalizeText(value);
  if (!cleanValue) return '';
  if (/^https?:\/\//i.test(cleanValue) || cleanValue.startsWith('data:') || cleanValue.startsWith('blob:')) {
    return cleanValue;
  }
  return buildPublicUrl(env, cleanValue) || cleanValue;
}

function cleanMerchandiseOrigin(value) {
  const raw = normalizeText(value).toLowerCase();
  return ['handmade', 'vintage', 'collectible', 'antique', 'oddity', 'prebuilt'].includes(raw) ? raw : 'handmade';
}

function cleanSaleChannel(value) {
  const raw = normalizeText(value).toLowerCase();
  return ['onsite', 'external_only', 'hybrid'].includes(raw) ? raw : 'onsite';
}

function cleanExternalUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : null;
}

function formatProductNumberLabel(value) {
  const parsed = Number(value || 0);
  if (!Number.isInteger(parsed) || parsed <= 0) return 'DD1000';
  return `DD${String(parsed).padStart(4, '0')}`;
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

function selectColumnSql(columnSet, columnName, alias = columnName) {
  return columnSet.has(columnName) ? columnName : `NULL AS ${alias}`;
}

async function upsertProductSeo(db, payload) {
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
      og_title = excluded.og_title,
      og_description = excluded.og_description,
      og_image_url = excluded.og_image_url,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    payload.product_id,
    payload.meta_title,
    payload.meta_description,
    payload.keywords,
    payload.h1_override,
    payload.canonical_url,
    payload.og_title,
    payload.og_description,
    payload.og_image_url
  ).run();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  if (!db) {
    return json({ ok: false, error: 'Database binding is missing for mobile product capture.' }, 500);
  }

  try {
    const adminUser = await getAdminUserFromRequest(request, env);
    if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: 'Expected multipart/form-data upload.' }, 400);
    }

    const requestedProductId = Number(form.get('product_id') || 0) || 0;
    const name = normalizeText(form.get('name'));
    const captureReference = normalizeText(form.get('capture_reference'));
    const productCategory = normalizeText(form.get('product_category'));
    const colorName = normalizeText(form.get('color_name'));
    const shortDescription = normalizeText(form.get('short_description'));
    const description = normalizeText(form.get('description'));
    const metaTitle = normalizeText(form.get('meta_title'));
    const metaDescription = normalizeText(form.get('meta_description'));
    const keywords = normalizeText(form.get('keywords'));
    const shippingCode = normalizeText(form.get('shipping_code'));
    const merchandiseOrigin = cleanMerchandiseOrigin(form.get('merchandise_origin'));
    const saleChannel = cleanSaleChannel(form.get('sale_channel'));
    const externalListingUrl = cleanExternalUrl(form.get('external_listing_url'));
    const externalListingLabel = normalizeText(form.get('external_listing_label'));
    const conditionSummary = normalizeText(form.get('condition_summary'));
    const eraLabel = normalizeText(form.get('era_label'));
    const sourcingNotes = normalizeText(form.get('sourcing_notes'));
    const currency = normalizeText(form.get('currency') || 'CAD').toUpperCase() || 'CAD';
    const skuOverride = normalizeText(form.get('sku'));
    const taxClassIdRaw = normalizeText(form.get('tax_class_id'));
    const taxClassId = taxClassIdRaw ? Number(taxClassIdRaw) : null;
    const priceCents = Number(form.get('price_cents') || 0);
    const compareAtPriceRaw = normalizeText(form.get('compare_at_price_cents'));
    const compareAtPriceCents = compareAtPriceRaw ? Number(compareAtPriceRaw) : null;
    const inventoryQuantity = Math.max(0, Number(form.get('inventory_quantity') || 1) || 1);
    const requiresShipping = Number(form.get('requires_shipping') || 1) === 1 ? 1 : 0;
    const taxable = Number(form.get('taxable') || 1) === 1 ? 1 : 0;
    const weightGramsRaw = normalizeText(form.get('weight_grams'));
    const weightGrams = weightGramsRaw ? Number(weightGramsRaw) : null;
    const resourceLinksRaw = normalizeText(form.get('resource_links_json'));

    if (!Number.isInteger(priceCents) || priceCents < 0) {
      return json({ ok: false, error: 'price_cents must be a valid whole number.' }, 400);
    }
    if (compareAtPriceCents !== null && (!Number.isInteger(compareAtPriceCents) || compareAtPriceCents < 0)) {
      return json({ ok: false, error: 'compare_at_price_cents must be a valid whole number.' }, 400);
    }
    if (weightGrams !== null && (!Number.isInteger(weightGrams) || weightGrams < 0)) {
      return json({ ok: false, error: 'weight_grams must be a valid whole number.' }, 400);
    }
    if (taxClassId !== null && (!Number.isInteger(taxClassId) || taxClassId <= 0)) {
      return json({ ok: false, error: 'tax_class_id must be a valid id.' }, 400);
    }
    if (saleChannel !== 'onsite' && !externalListingUrl) {
      return json({ ok: false, error: 'Add an external listing URL when using hybrid or external-only selling.' }, 400);
    }

    const files = form.getAll('images').filter((file) => file && typeof file.arrayBuffer === 'function');
    if (!name && !captureReference && !files.length && !requestedProductId) {
      return json({ ok: false, error: 'Add at least a name, a reference, or a photo before saving.' }, 400);
    }

    const productColumns = await getTableColumnSet(db, 'products');
    const supportsCaptureReference = productColumns.has('capture_reference');
    const supportsProductCategory = productColumns.has('product_category');
    const supportsColorName = productColumns.has('color_name');
    const supportsShippingCode = productColumns.has('shipping_code');
    const supportsReviewStatus = productColumns.has('review_status');
    const supportsReadyFlag = productColumns.has('is_ready_for_storefront');
    const supportsReadyNotes = productColumns.has('ready_check_notes');
    const supportsMerchandiseOrigin = productColumns.has('merchandise_origin');
    const supportsSaleChannel = productColumns.has('sale_channel');
    const supportsExternalListingUrl = productColumns.has('external_listing_url');
    const supportsExternalListingLabel = productColumns.has('external_listing_label');
    const supportsConditionSummary = productColumns.has('condition_summary');
    const supportsEraLabel = productColumns.has('era_label');
    const supportsSourcingNotes = productColumns.has('sourcing_notes');
    const resourceColumns = await getTableColumnSet(db, 'product_resource_links');
    const supportsConsumptionMode = resourceColumns.has('consumption_mode');
    const supportsLotSizeUnits = resourceColumns.has('lot_size_units');

    let resolvedProductId = requestedProductId;
    let productNumber = 0;
    let resolvedName = '';
    let slug = '';
    let sku = '';
    let readyNotes = '';

    if (resolvedProductId > 0) {
      const existing = await db.prepare(`
        SELECT product_id, product_number, slug, sku, name,
               ${selectColumnSql(productColumns, 'capture_reference')},
               featured_image_url
        FROM products
        WHERE product_id = ?
        LIMIT 1
      `).bind(resolvedProductId).first();

      if (!existing) return json({ ok: false, error: 'Draft product not found.' }, 404);

      productNumber = Number(existing.product_number || 0);
      resolvedName = name || captureReference || normalizeText(existing.name) || `Draft product ${productNumber || resolvedProductId}`;
      slug = normalizeText(existing.slug) || slugify(`${resolvedName}-${productNumber || resolvedProductId}`) || `product-${productNumber || resolvedProductId}`;
      sku = skuOverride || normalizeText(existing.sku) || `DND-${String(productNumber || resolvedProductId).padStart(5, '0')}`;
      readyNotes = [
        captureReference ? `Capture reference: ${captureReference}` : '',
        !name ? 'Partial draft saved without final product name.' : '',
        !productCategory ? 'Category still needed.' : '',
        priceCents === 0 ? 'Price still needed.' : ''
      ].filter(Boolean).join(' ');

      const updateAssignments = ['name = ?'];
      const updateBindings = [resolvedName];

      if (supportsCaptureReference) {
        updateAssignments.push('capture_reference = ?');
        updateBindings.push(captureReference || null);
      }
      if (supportsProductCategory) {
        updateAssignments.push('product_category = ?');
        updateBindings.push(productCategory || null);
      }
      if (supportsColorName) {
        updateAssignments.push('color_name = ?');
        updateBindings.push(colorName || null);
      }
      if (supportsShippingCode) {
        updateAssignments.push('shipping_code = ?');
        updateBindings.push(shippingCode || null);
      }
      if (supportsMerchandiseOrigin) {
        updateAssignments.push('merchandise_origin = ?');
        updateBindings.push(merchandiseOrigin);
      }
      if (supportsSaleChannel) {
        updateAssignments.push('sale_channel = ?');
        updateBindings.push(saleChannel);
      }
      if (supportsExternalListingUrl) {
        updateAssignments.push('external_listing_url = ?');
        updateBindings.push(externalListingUrl || null);
      }
      if (supportsExternalListingLabel) {
        updateAssignments.push('external_listing_label = ?');
        updateBindings.push(externalListingLabel || null);
      }
      if (supportsConditionSummary) {
        updateAssignments.push('condition_summary = ?');
        updateBindings.push(conditionSummary || null);
      }
      if (supportsEraLabel) {
        updateAssignments.push('era_label = ?');
        updateBindings.push(eraLabel || null);
      }
      if (supportsSourcingNotes) {
        updateAssignments.push('sourcing_notes = ?');
        updateBindings.push(sourcingNotes || null);
      }
      if (supportsReviewStatus) updateAssignments.push(`review_status = 'pending_review'`);
      if (supportsReadyFlag) updateAssignments.push('is_ready_for_storefront = 0');
      if (supportsReadyNotes) {
        updateAssignments.push('ready_check_notes = ?');
        updateBindings.push(readyNotes || null);
      }

      updateAssignments.push(
        'short_description = ?',
        'description = ?',
        'price_cents = ?',
        'compare_at_price_cents = ?',
        'currency = ?',
        'taxable = ?',
        'tax_class_id = ?',
        'requires_shipping = ?',
        'weight_grams = ?',
        'inventory_quantity = ?',
        'updated_at = CURRENT_TIMESTAMP'
      );
      updateBindings.push(
        shortDescription || null,
        description || null,
        priceCents,
        compareAtPriceCents,
        currency,
        taxable,
        taxClassId,
        requiresShipping,
        weightGrams,
        inventoryQuantity,
        resolvedProductId
      );

      await db.prepare(`
        UPDATE products
        SET ${updateAssignments.join(',\n          ')}
        WHERE product_id = ?
      `).bind(...updateBindings).run();
    } else {
      productNumber = await getNextProductNumber(db);
      resolvedName = name || captureReference || `Draft product ${productNumber}`;
      slug = slugify(`${resolvedName}-${productNumber}`) || `product-${productNumber}`;
      sku = skuOverride || `DND-${String(productNumber).padStart(5, '0')}`;
      readyNotes = [
        captureReference ? `Capture reference: ${captureReference}` : '',
        !name ? 'Partial draft saved without final product name.' : '',
        !productCategory ? 'Category still needed.' : '',
        priceCents === 0 ? 'Price still needed.' : ''
      ].filter(Boolean).join(' ');

      const insertColumns = ['product_number', 'slug', 'sku', 'name'];
      const insertPlaceholders = ['?', '?', '?', '?'];
      const insertBindings = [productNumber, slug, sku, resolvedName];

      if (supportsCaptureReference) {
        insertColumns.push('capture_reference');
        insertPlaceholders.push('?');
        insertBindings.push(captureReference || null);
      }
      if (supportsProductCategory) {
        insertColumns.push('product_category');
        insertPlaceholders.push('?');
        insertBindings.push(productCategory || null);
      }
      if (supportsColorName) {
        insertColumns.push('color_name');
        insertPlaceholders.push('?');
        insertBindings.push(colorName || null);
      }
      if (supportsShippingCode) {
        insertColumns.push('shipping_code');
        insertPlaceholders.push('?');
        insertBindings.push(shippingCode || null);
      }
      if (supportsMerchandiseOrigin) {
        insertColumns.push('merchandise_origin');
        insertPlaceholders.push('?');
        insertBindings.push(merchandiseOrigin);
      }
      if (supportsSaleChannel) {
        insertColumns.push('sale_channel');
        insertPlaceholders.push('?');
        insertBindings.push(saleChannel);
      }
      if (supportsExternalListingUrl) {
        insertColumns.push('external_listing_url');
        insertPlaceholders.push('?');
        insertBindings.push(externalListingUrl || null);
      }
      if (supportsExternalListingLabel) {
        insertColumns.push('external_listing_label');
        insertPlaceholders.push('?');
        insertBindings.push(externalListingLabel || null);
      }
      if (supportsConditionSummary) {
        insertColumns.push('condition_summary');
        insertPlaceholders.push('?');
        insertBindings.push(conditionSummary || null);
      }
      if (supportsEraLabel) {
        insertColumns.push('era_label');
        insertPlaceholders.push('?');
        insertBindings.push(eraLabel || null);
      }
      if (supportsSourcingNotes) {
        insertColumns.push('sourcing_notes');
        insertPlaceholders.push('?');
        insertBindings.push(sourcingNotes || null);
      }
      if (supportsReviewStatus) {
        insertColumns.push('review_status');
        insertPlaceholders.push('?');
        insertBindings.push('pending_review');
      }
      if (supportsReadyFlag) {
        insertColumns.push('is_ready_for_storefront');
        insertPlaceholders.push('?');
        insertBindings.push(0);
      }
      if (supportsReadyNotes) {
        insertColumns.push('ready_check_notes');
        insertPlaceholders.push('?');
        insertBindings.push(readyNotes || null);
      }

      insertColumns.push(
        'short_description',
        'description',
        'product_type',
        'status',
        'price_cents',
        'compare_at_price_cents',
        'currency',
        'taxable',
        'tax_class_id',
        'requires_shipping',
        'weight_grams',
        'inventory_tracking',
        'inventory_quantity',
        'featured_image_url',
        'sort_order',
        'created_at',
        'updated_at'
      );
      insertPlaceholders.push(
        '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', 'NULL', '?', 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP'
      );
      insertBindings.push(
        shortDescription || null,
        description || null,
        'physical',
        'draft',
        priceCents,
        compareAtPriceCents,
        currency,
        taxable,
        taxClassId,
        requiresShipping,
        weightGrams,
        1,
        inventoryQuantity,
        0
      );

      const insertResult = await db.prepare(`
        INSERT INTO products (
          ${insertColumns.join(', ')}
        ) VALUES (${insertPlaceholders.join(', ')})
      `).bind(...insertBindings).run();

      resolvedProductId = Number(insertResult?.meta?.last_row_id || 0);
      if (!resolvedProductId) return json({ ok: false, error: 'Product could not be created.' }, 500);
    }

    const bucket = env.PRODUCT_MEDIA_BUCKET || env.MEDIA_BUCKET || env.R2_PRODUCT_MEDIA;
    const uploaded = [];

    const currentMaxSortResult = resolvedProductId
      ? await db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM product_images WHERE product_id = ?`).bind(resolvedProductId).first().catch(() => null)
      : null;
    let nextImageSortOrder = Number(currentMaxSortResult?.max_sort ?? -1) + 1;

    if (bucket && typeof bucket.put === 'function') {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const mimeType = normalizeText(file.type || 'application/octet-stream').toLowerCase();
        if (!mimeType.startsWith('image/')) continue;

        const buffer = await file.arrayBuffer();
        if (!buffer || Number(file.size || 0) <= 0) continue;

        const originalName = sanitizeFilename(file.name || `image-${index + 1}`);
        const extension = inferExtension(originalName, mimeType);
        const objectKey = ['products', String(resolvedProductId), `${Date.now()}-${index + 1}-${crypto.randomUUID()}.${extension}`].join('/');

        await bucket.put(objectKey, buffer, {
          httpMetadata: { contentType: mimeType, cacheControl: 'public, max-age=31536000, immutable' },
          customMetadata: {
            original_name: originalName,
            product_id: String(resolvedProductId),
            uploaded_by_user_id: String(adminUser.user_id || '')
          }
        });

        const publicUrl = buildPublicUrl(env, objectKey);
        const storedImageUrl = normalizeStoredImageUrl(env, publicUrl || objectKey);
        const sortOrder = nextImageSortOrder;
        nextImageSortOrder += 1;

        uploaded.push({
          object_key: objectKey,
          public_url: storedImageUrl,
          original_filename: originalName
        });

        await db.prepare(`
          INSERT INTO product_images (product_id, image_url, alt_text, sort_order, created_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          resolvedProductId,
          storedImageUrl,
          `${resolvedName} photo ${index + 1}`,
          sortOrder
        ).run();

        try {
          await db.prepare(`
            INSERT INTO media_assets (
              product_id, storage_provider, bucket_name, object_key, public_url, original_filename,
              mime_type, file_size_bytes, created_by_user_id, created_at, updated_at
            ) VALUES (?, 'r2', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(
            resolvedProductId,
            normalizeText(env.PRODUCT_MEDIA_BUCKET_NAME || env.R2_BUCKET_NAME || 'product-media'),
            objectKey,
            storedImageUrl || null,
            originalName,
            mimeType,
            Number(file.size || 0),
            adminUser.user_id
          ).run();
        } catch {}
      }
    }

    const featuredImageUrl = normalizeStoredImageUrl(env, uploaded[0]?.public_url || '') || null;
    if (featuredImageUrl) {
      await db.prepare(`
        UPDATE products
        SET featured_image_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `).bind(featuredImageUrl, resolvedProductId).run();
    }

    try {
      const seoTitle = metaTitle || `${resolvedName}${productCategory ? ` ${productCategory}` : ''}${colorName ? ` ${colorName}` : ''} | Devil n Dove`;
      const seoDescription = metaDescription || shortDescription || description || captureReference || `Draft ${productCategory || 'creation'} by Devil n Dove.`;
      await upsertProductSeo(db, {
        product_id: resolvedProductId,
        meta_title: seoTitle,
        meta_description: seoDescription,
        keywords: keywords || [resolvedName, captureReference, productCategory, colorName, 'handmade', 'Devil n Dove', 'Ontario'].filter(Boolean).join(', '),
        h1_override: resolvedName,
        canonical_url: `/shop/product/?slug=${slug}`,
        og_title: seoTitle,
        og_description: seoDescription,
        og_image_url: featuredImageUrl || null
      });
    } catch {}

    try {
      const parsedLinks = JSON.parse(resourceLinksRaw || '[]');
      const links = Array.isArray(parsedLinks) ? parsedLinks : [];

      await db.prepare(`DELETE FROM product_resource_links WHERE product_id = ?`).bind(resolvedProductId).run();

      for (let index = 0; index < links.length; index += 1) {
        const row = links[index] || {};
        const resourceKind = normalizeText(row.resource_kind).toLowerCase();
        const sourceKey = normalizeText(row.source_key);
        if (!['tool', 'supply'].includes(resourceKind) || !sourceKey) continue;

        const insertCols = ['product_id', 'resource_kind', 'source_key', 'quantity_used', 'usage_notes', 'sort_order', 'created_at', 'updated_at'];
        const insertVals = ['?', '?', '?', '?', '?', '?', 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP'];
        const binds = [
          resolvedProductId,
          resourceKind,
          sourceKey,
          Math.max(1, Number(row.quantity_used || 1) || 1),
          normalizeText(row.usage_notes) || null,
          index
        ];
        if (supportsConsumptionMode) {
          insertCols.push('consumption_mode');
          insertVals.push('?');
          binds.push(['per_unit', 'end_of_lot', 'story_only'].includes(String(row.consumption_mode || '').trim()) ? String(row.consumption_mode).trim() : 'per_unit');
        }
        if (supportsLotSizeUnits) {
          insertCols.push('lot_size_units');
          insertVals.push('?');
          binds.push(Math.max(1, Number(row.lot_size_units || 1) || 1));
        }

        await db.prepare(`
          INSERT INTO product_resource_links (${insertCols.join(', ')})
          VALUES (${insertVals.join(', ')})
        `).bind(...binds).run();
      }
    } catch {}

    const createdProduct = await db.prepare(`SELECT * FROM products WHERE product_id = ? LIMIT 1`).bind(resolvedProductId).first();
    const normalizedProduct = createdProduct
      ? {
          ...createdProduct,
          featured_image_url: normalizeStoredImageUrl(env, createdProduct?.featured_image_url || '')
        }
      : createdProduct;

    const nextProductNumber = await getNextProductNumber(db);

    return json({
      ok: true,
      message: requestedProductId > 0 ? 'Draft product updated.' : 'Draft product saved. You can come back later to finish the details.',
      product: normalizedProduct,
      product_number_label: formatProductNumberLabel(normalizedProduct?.product_number || productNumber),
      uploaded_images: uploaded,
      next_product_number: nextProductNumber,
      next_product_number_label: formatProductNumberLabel(nextProductNumber)
    }, requestedProductId > 0 ? 200 : 201);
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_mobile_product',
      incident_code: 'mobile_create_product_failed',
      severity: 'error',
      message: 'Phone product capture save failed.',
      details: { error: error?.message || String(error || 'Unknown error') }
    });
    return json({ ok: false, error: error?.message || 'Phone product capture failed unexpectedly.' }, 500);
  }
}
