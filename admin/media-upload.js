import { auditAdminAction, getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

// File: /functions/api/admin/media-upload.js
// Brief description: Accepts admin-authenticated image uploads and stores them in the configured
// R2 bucket so product media can be uploaded directly instead of only pasting URLs.
// This pass also allows one-step attachment to product_images/product_image_annotations.

function json(data, status = 200) { return jsonResponse(data, status); }

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

function buildPublicUrl(env, objectKey) {
  const base = normalizeText(env.PRODUCT_MEDIA_PUBLIC_BASE_URL || env.R2_PUBLIC_BASE_URL || env.PUBLIC_R2_BASE_URL);
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/${String(objectKey || '').replace(/^\/+/, '')}`;
}

function parseFlag(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  if ([1, '1', true, 'true', 'yes', 'y', 'on'].includes(value)) return 1;
  if ([0, '0', false, 'false', 'no', 'n', 'off'].includes(value)) return 0;
  return fallback;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  const bucket = env.PRODUCT_MEDIA_BUCKET || env.MEDIA_BUCKET || env.R2_PRODUCT_MEDIA;
  if (!bucket || typeof bucket.put !== 'function') {
    return json({ ok: false, error: 'R2 media bucket binding is missing.' }, 500);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Expected multipart/form-data upload.' }, 400);
  }

  const file = form.get('file');
  const productId = Number(form.get('product_id') || 0);
  if (!file || typeof file.arrayBuffer !== 'function') {
    return json({ ok: false, error: 'An image file is required.' }, 400);
  }

  const mimeType = normalizeText(file.type || 'application/octet-stream').toLowerCase();
  if (!mimeType.startsWith('image/')) {
    return json({ ok: false, error: 'Only image uploads are supported.' }, 400);
  }

  const fileSize = Number(file.size || 0);
  if (fileSize <= 0) {
    return json({ ok: false, error: 'Uploaded file is empty.' }, 400);
  }
  if (fileSize > 10 * 1024 * 1024) {
    return json({ ok: false, error: 'Image uploads must be 10 MB or smaller.' }, 400);
  }

  const originalName = sanitizeFilename(file.name || 'upload');
  const extension = inferExtension(originalName, mimeType);
  const safeProductId = Number.isInteger(productId) && productId > 0 ? productId : null;
  const attachToProduct = parseFlag(form.get('attach_to_product'), safeProductId ? 1 : 0) === 1;
  const setFeatured = parseFlag(form.get('set_featured'), 0) === 1;
  const altTextInput = normalizeText(form.get('alt_text'));
  const caption = normalizeText(form.get('caption'));
  const imageTitle = normalizeText(form.get('image_title'));
  const variantRole = normalizeText(form.get('variant_role') || 'gallery');
  const uploadScopeRaw = normalizeText(form.get('upload_scope') || (safeProductId ? 'product' : 'brand')).toLowerCase();
  const uploadScope = ['product', 'brand', 'creation', 'social', 'general'].includes(uploadScopeRaw) ? uploadScopeRaw : (safeProductId ? 'product' : 'general');
  const assetTag = normalizeText(form.get('asset_tag'));
  const annotationNotes = normalizeText(form.get('annotation_notes')) || [assetTag, uploadScope !== 'product' ? `${uploadScope}_asset` : '', variantRole ? `variant_role:${variantRole}` : ''].filter(Boolean).join(' | ');

  let product = null;
  if (safeProductId) {
    product = await db.prepare(`SELECT product_id, name, featured_image_url FROM products WHERE product_id = ? LIMIT 1`).bind(safeProductId).first().catch(() => null);
    if (!product && attachToProduct) {
      return json({ ok: false, error: 'Product not found for attachment.' }, 404);
    }
  }

  const objectPrefix = uploadScope === 'product'
    ? ['products', safeProductId ? String(safeProductId) : 'unassigned'].join('/')
    : uploadScope === 'brand'
      ? 'brand'
      : uploadScope === 'creation'
        ? 'creations'
        : uploadScope === 'social'
          ? 'social'
          : 'uploads';

  const objectKey = `${objectPrefix}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const buffer = await file.arrayBuffer();
  await bucket.put(objectKey, buffer, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable'
    },
    customMetadata: {
      original_name: originalName,
      product_id: safeProductId ? String(safeProductId) : '',
      uploaded_by_user_id: String(adminUser.user_id || ''),
      variant_role: variantRole || '',
      upload_scope: uploadScope || ''
    }
  });

  const publicUrl = buildPublicUrl(env, objectKey);
  let mediaAssetId = null;
  let productImageId = null;

  try {
    const insert = await db.prepare(`
      INSERT INTO media_assets (
        product_id,
        storage_provider,
        bucket_name,
        object_key,
        public_url,
        original_filename,
        mime_type,
        file_size_bytes,
        variant_role,
        annotation_notes,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, 'r2', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      safeProductId,
      normalizeText(env.PRODUCT_MEDIA_BUCKET_NAME || env.R2_BUCKET_NAME || 'product-media'),
      objectKey,
      publicUrl || null,
      originalName,
      mimeType,
      fileSize,
      variantRole || null,
      annotationNotes || null,
      adminUser.user_id
    ).run();
    mediaAssetId = Number(insert?.meta?.last_row_id || 0) || null;
  } catch {
    // schema may not be migrated yet; upload itself already succeeded
  }

  if (attachToProduct && safeProductId && publicUrl) {
    const currentMaxSort = await db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM product_images WHERE product_id = ?`).bind(safeProductId).first().catch(() => null);
    const nextSort = Number(currentMaxSort?.max_sort ?? -1) + 1;
    const altText = altTextInput || normalizeText(product?.name) || originalName;

    const productImageInsert = await db.prepare(`
      INSERT INTO product_images (product_id, image_url, alt_text, sort_order, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(safeProductId, publicUrl, altText, setFeatured ? 0 : nextSort).run().catch(() => null);

    productImageId = Number(productImageInsert?.meta?.last_row_id || 0) || null;

    if (productImageId) {
      await db.prepare(`
        INSERT INTO product_image_annotations (
          product_id, product_image_id, image_url, alt_text, image_title, caption, annotation_notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        safeProductId,
        productImageId,
        publicUrl,
        altText,
        imageTitle || null,
        caption || null,
        annotationNotes || null
      ).run().catch(() => null);
    }

    if (setFeatured) {
      await db.prepare(`
        UPDATE products
        SET featured_image_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `).bind(publicUrl, safeProductId).run().catch(() => null);

      await db.prepare(`
        UPDATE product_images
        SET sort_order = sort_order + 1
        WHERE product_id = ? AND product_image_id != ?
      `).bind(safeProductId, productImageId || 0).run().catch(() => null);
    }
  }

  await auditAdminAction(env, request, adminUser, {
    action_type: "media_upload",
    target_type: "media_asset",
    target_key: objectKey,
    target_id: safeProductId || mediaAssetId || null,
    details: {
      product_id: safeProductId,
      mime_type: mimeType,
      file_size_bytes: fileSize,
      public_url: publicUrl || null,
      attached_to_product: attachToProduct,
      set_featured: setFeatured,
      variant_role: variantRole || null,
      upload_scope: uploadScope || null,
      asset_tag: assetTag || null,
      media_asset_id: mediaAssetId,
      product_image_id: productImageId
    }
  });

  return json({
    ok: true,
    message: 'Image uploaded successfully.',
    asset: {
      media_asset_id: mediaAssetId,
      product_image_id: productImageId,
      product_id: safeProductId,
      object_key: objectKey,
      public_url: publicUrl,
      original_filename: originalName,
      mime_type: mimeType,
      file_size_bytes: fileSize,
      attached_to_product: attachToProduct,
      set_featured: setFeatured,
      variant_role: variantRole || null,
      upload_scope: uploadScope || null,
      asset_tag: assetTag || null
    }
  });
}
