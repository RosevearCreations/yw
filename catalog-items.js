// File: /functions/api/catalog-items.js
// Brief description: Public read endpoint for unified catalog items migrated from JSON into D1.
// It supports tools, supplies, and featured creations so public search and collection pages can
// prefer live database-backed records while still allowing static JSON fallbacks.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=120'
    }
  });
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const itemKind = normalizeText(url.searchParams.get('item_kind')).toLowerCase();
  const query = normalizeText(url.searchParams.get('q')).toLowerCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 250), 1), 500);
  const like = `%${query}%`;

  const rows = normalizeResults(await env.DB.prepare(`
    SELECT
      catalog_item_id,
      item_kind,
      source_key,
      slug,
      name,
      brand,
      category,
      subcategory,
      item_type,
      short_description,
      notes,
      image_url,
      r2_object_key,
      amazon_url,
      storage_location,
      quantity_on_hand,
      reorder_point,
      visible_public,
      status,
      sort_order,
      source_record_json,
      updated_at
    FROM catalog_items
    WHERE COALESCE(visible_public, 1) = 1
      AND COALESCE(status, 'active') = 'active'
      AND (? = '' OR item_kind = ?)
      AND (
        ? = ''
        OR LOWER(COALESCE(name, '')) LIKE ?
        OR LOWER(COALESCE(brand, '')) LIKE ?
        OR LOWER(COALESCE(category, '')) LIKE ?
        OR LOWER(COALESCE(subcategory, '')) LIKE ?
        OR LOWER(COALESCE(item_type, '')) LIKE ?
        OR LOWER(COALESCE(short_description, '')) LIKE ?
        OR LOWER(COALESCE(notes, '')) LIKE ?
      )
    ORDER BY COALESCE(sort_order, 0) ASC, LOWER(COALESCE(name, '')) ASC
    LIMIT ?
  `).bind(itemKind, itemKind, query, like, like, like, like, like, like, like, limit).all());

  const items = rows.map((row) => {
    let sourceRecord = null;
    try {
      sourceRecord = row.source_record_json ? JSON.parse(row.source_record_json) : null;
    } catch {
      sourceRecord = null;
    }
    return {
      catalog_item_id: Number(row.catalog_item_id || 0),
      item_kind: row.item_kind || '',
      source_key: row.source_key || '',
      slug: row.slug || '',
      name: row.name || '',
      brand: row.brand || '',
      category: row.category || '',
      subcategory: row.subcategory || '',
      item_type: row.item_type || '',
      short_description: row.short_description || '',
      notes: row.notes || '',
      image_url: row.image_url || '',
      r2_object_key: row.r2_object_key || '',
      amazon_url: row.amazon_url || '',
      storage_location: row.storage_location || '',
      quantity_on_hand: Number(row.quantity_on_hand || 0),
      reorder_point: Number(row.reorder_point || 0),
      visible_public: Number(row.visible_public || 0),
      status: row.status || 'active',
      sort_order: Number(row.sort_order || 0),
      updated_at: row.updated_at || null,
      source_record: sourceRecord
    };
  });

  return json({
    ok: true,
    items,
    summary: {
      total_items: items.length,
      item_kind: itemKind || 'all',
      query
    }
  });
}
