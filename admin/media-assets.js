import { auditAdminAction, getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";
import { requireAdminStepUp } from "../_lib/adminStepUp.js";

function json(data, status = 200) { return jsonResponse(data, status); }
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }
function deriveVariantUrls(publicUrl = '') {
  const url = normalizeText(publicUrl);
  if (!url) return [];
  const dotIndex = url.lastIndexOf('.');
  if (dotIndex <= url.lastIndexOf('/')) return [];
  const base = url.slice(0, dotIndex);
  const ext = url.slice(dotIndex);
  return ['thumb', 'medium', 'large', 'webp'].map((variant) => ({
    variant,
    url: variant === 'webp' ? `${base}.webp` : `${base}_${variant}${ext}`
  }));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  const url = new URL(request.url);
  const productId = Number(url.searchParams.get('product_id') || 0);
  const q = normalizeText(url.searchParams.get('q')).toLowerCase();
  const includeDeleted = Number(url.searchParams.get('include_deleted') || 0) === 1 ? 1 : 0;
  const limit = Math.max(1, Math.min(250, Number(url.searchParams.get('limit') || 80)));
  const rows = normalizeResults(await db.prepare(`
    SELECT ma.media_asset_id, ma.product_id, ma.storage_provider, ma.bucket_name, ma.object_key, ma.public_url,
           ma.original_filename, ma.mime_type, ma.file_size_bytes, ma.variant_role, ma.sort_order,
           ma.annotation_notes, ma.created_at, ma.updated_at, ma.deleted_at,
           p.name AS product_name,
           (SELECT COUNT(*) FROM media_assets ma2 WHERE ma2.deleted_at IS NULL AND COALESCE(ma2.public_url,'') = COALESCE(ma.public_url,'')) AS duplicate_public_url_count
    FROM media_assets ma
    LEFT JOIN products p ON p.product_id = ma.product_id
    WHERE (? = 0 OR ma.product_id = ?)
      AND (? = 1 OR ma.deleted_at IS NULL)
      AND (
        ? = ''
        OR LOWER(COALESCE(ma.original_filename,'')) LIKE ?
        OR LOWER(COALESCE(ma.object_key,'')) LIKE ?
        OR LOWER(COALESCE(ma.annotation_notes,'')) LIKE ?
        OR LOWER(COALESCE(p.name,'')) LIKE ?
      )
    ORDER BY COALESCE(ma.sort_order, 999999) ASC, ma.created_at DESC, ma.media_asset_id DESC
    LIMIT ?
  `).bind(productId, productId, includeDeleted, q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit).all().catch(() => ({ results: [] })));
  return json({ ok: true, requested_by: adminUser, assets: rows.map((row) => ({
    media_asset_id: Number(row.media_asset_id || 0),
    product_id: row.product_id == null ? null : Number(row.product_id),
    product_name: row.product_name || null,
    storage_provider: row.storage_provider || 'r2',
    bucket_name: row.bucket_name || null,
    object_key: row.object_key || '',
    public_url: row.public_url || null,
    original_filename: row.original_filename || '',
    mime_type: row.mime_type || '',
    file_size_bytes: Number(row.file_size_bytes || 0),
    variant_role: row.variant_role || null,
    sort_order: Number(row.sort_order || 0),
    annotation_notes: row.annotation_notes || null,
    duplicate_public_url_count: Number(row.duplicate_public_url_count || 0),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    deleted_at: row.deleted_at || null,
    derived_variant_urls: deriveVariantUrls(row.public_url || null)
  })) });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  const action = normalizeText(body.action).toLowerCase();

  if (Array.isArray(body.asset_updates) && body.asset_updates.length) {
    const updates = body.asset_updates.slice(0, 100);
    let saved = 0;
    for (const row of updates) {
      const mediaAssetId = Number(row?.media_asset_id || 0);
      if (!Number.isInteger(mediaAssetId) || mediaAssetId <= 0) continue;
      await db.prepare(`
        UPDATE media_assets
        SET sort_order = ?,
            variant_role = COALESCE(?, variant_role),
            annotation_notes = COALESCE(?, annotation_notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE media_asset_id = ?
      `).bind(
        Number(row?.sort_order || 0),
        normalizeText(row?.variant_role) || null,
        normalizeText(row?.annotation_notes) || null,
        mediaAssetId
      ).run();
      saved += 1;
    }
    await auditAdminAction(env, request, adminUser, { action_type: 'media_bulk_update', target_type: 'media_asset', target_key: `count:${saved}`, details: { saved } });
    return json({ ok: true, message: 'Media assets updated.', saved });
  }

  const mediaAssetId = Number(body.media_asset_id || 0);
  if (!Number.isInteger(mediaAssetId) || mediaAssetId <= 0) return json({ ok: false, error: 'A valid media_asset_id is required.' }, 400);
  const confirmPassword = normalizeText(body.confirm_password || request.headers.get('x-confirm-password'));
  const requiresStepUp = ['replace', 'delete'].includes(action);
  if (requiresStepUp) {
    const stepUp = await requireAdminStepUp(request, env, adminUser, { confirm_password: confirmPassword }, 'media replacement');
    if (!stepUp.ok) return stepUp.response;
  }
  const existing = await db.prepare(`SELECT * FROM media_assets WHERE media_asset_id = ? LIMIT 1`).bind(mediaAssetId).first();
  if (!existing) return json({ ok: false, error: 'Media asset not found.' }, 404);
  if (action === 'restore') {
    await db.prepare(`UPDATE media_assets SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE media_asset_id = ?`).bind(mediaAssetId).run();
    await auditAdminAction(env, request, adminUser, { action_type: 'media_restore', target_type: 'media_asset', target_id: mediaAssetId, target_key: existing.object_key || String(mediaAssetId), details: { product_id: existing.product_id || null } });
    return json({ ok: true, message: 'Media asset restored.', media_asset_id: mediaAssetId });
  }
  await db.prepare(`
    UPDATE media_assets
    SET product_id = ?,
        variant_role = ?,
        sort_order = ?,
        annotation_notes = ?,
        public_url = COALESCE(?, public_url),
        object_key = COALESCE(?, object_key),
        updated_at = CURRENT_TIMESTAMP
    WHERE media_asset_id = ?
  `).bind(
    body.product_id == null || body.product_id === '' ? null : Number(body.product_id),
    normalizeText(body.variant_role) || null,
    Number(body.sort_order || 0),
    normalizeText(body.annotation_notes) || null,
    normalizeText(body.public_url) || null,
    normalizeText(body.object_key) || null,
    mediaAssetId
  ).run();
  await auditAdminAction(env, request, adminUser, { action_type: action === 'replace' ? 'media_replace' : 'media_update', target_type: 'media_asset', target_id: mediaAssetId, target_key: normalizeText(body.object_key) || existing.object_key || String(mediaAssetId), details: { product_id: body.product_id ?? existing.product_id ?? null, variant_role: normalizeText(body.variant_role) || existing.variant_role || null, sort_order: Number(body.sort_order || existing.sort_order || 0), replaced_public_url: normalizeText(body.public_url) || null } });
  return json({ ok: true, message: action === 'replace' ? 'Media asset replaced.' : 'Media asset updated.', media_asset_id: mediaAssetId });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  const url = new URL(request.url);
  const mediaAssetId = Number(url.searchParams.get('media_asset_id') || 0);
  const confirmPassword = normalizeText(url.searchParams.get('confirm_password') || request.headers.get('x-confirm-password'));
  if (!Number.isInteger(mediaAssetId) || mediaAssetId <= 0) return json({ ok: false, error: 'A valid media_asset_id is required.' }, 400);
  const asset = await db.prepare(`SELECT media_asset_id, product_id, object_key, public_url FROM media_assets WHERE media_asset_id = ? LIMIT 1`).bind(mediaAssetId).first();
  if (!asset) return json({ ok: false, error: 'Media asset not found.' }, 404);
  const stepUp = await requireAdminStepUp(request, env, adminUser, { confirm_password: confirmPassword }, 'media deletion');
  if (!stepUp.ok) return stepUp.response;
  const bucket = env.PRODUCT_MEDIA_BUCKET || env.MEDIA_BUCKET || env.R2_PRODUCT_MEDIA;
  if (bucket && typeof bucket.delete === 'function' && asset.object_key) {
    try { await bucket.delete(asset.object_key); } catch {}
  }
  await db.prepare(`UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE media_asset_id = ?`).bind(mediaAssetId).run();
  await auditAdminAction(env, request, adminUser, { action_type: 'media_delete', target_type: 'media_asset', target_id: mediaAssetId, target_key: asset.object_key || String(mediaAssetId), details: { product_id: asset.product_id || null, public_url: asset.public_url || null } });
  return json({ ok: true, message: 'Media asset deleted.', media_asset_id: mediaAssetId });
}
