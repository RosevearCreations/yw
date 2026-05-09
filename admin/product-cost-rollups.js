import { getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

function json(data, status = 200) { return jsonResponse(data, status); }
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }
async function getTableColumnSet(db, tableName) { try { const result = await db.prepare(`PRAGMA table_info(${tableName})`).all(); const rows = Array.isArray(result?.results) ? result.results : []; return new Set(rows.map((row) => String(row?.name || '').trim()).filter(Boolean)); } catch { return new Set(); } }

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  const url = new URL(request.url);
  const productId = Number(url.searchParams.get('product_id') || 0);
  const q = normalizeText(url.searchParams.get('q')).toLowerCase();
  const like = `%${q}%`;
  const resourceLinkColumns = await getTableColumnSet(db, 'product_resource_links');
  const hasConsumptionMode = resourceLinkColumns.has('consumption_mode');
  const hasLotSizeUnits = resourceLinkColumns.has('lot_size_units');
  const inventoryColumns = await getTableColumnSet(db, 'site_item_inventory');
  const usageUnitsExpr = inventoryColumns.has('usage_units_per_stock_unit') ? `COALESCE(NULLIF(sii.usage_units_per_stock_unit,0),1)` : `1`;
  const modeExpr = hasConsumptionMode ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`;
  const lotExpr = hasLotSizeUnits ? `COALESCE(NULLIF(prl.lot_size_units,0),1)` : `1`;

  const rows = normalizeResults(await db.prepare(`
    SELECT
      p.product_id,
      p.slug,
      p.name,
      p.status,
      p.review_status,
      p.currency,
      COALESCE(p.price_cents, 0) AS price_cents,
      COUNT(prl.product_resource_link_id) AS linked_resource_count,
      COALESCE(SUM(CASE WHEN ${modeExpr} = 'story_only' THEN 0 WHEN ${modeExpr} = 'end_of_lot' THEN COALESCE(prl.quantity_used, 0) * COALESCE(sii.unit_cost_cents, 0) / ${usageUnitsExpr} / ${lotExpr} ELSE COALESCE(prl.quantity_used, 0) * COALESCE(sii.unit_cost_cents, 0) / ${usageUnitsExpr} END), 0) AS linked_resource_cost_cents,
      SUM(CASE WHEN prl.resource_kind = 'supply' THEN CASE WHEN ${modeExpr} = 'story_only' THEN 0 WHEN ${modeExpr} = 'end_of_lot' THEN COALESCE(prl.quantity_used, 0) * COALESCE(sii.unit_cost_cents, 0) / ${usageUnitsExpr} / ${lotExpr} ELSE COALESCE(prl.quantity_used, 0) * COALESCE(sii.unit_cost_cents, 0) / ${usageUnitsExpr} END ELSE 0 END) AS supply_cost_cents,
      SUM(CASE WHEN prl.resource_kind = 'tool' THEN CASE WHEN ${modeExpr} = 'story_only' THEN 0 WHEN ${modeExpr} = 'end_of_lot' THEN COALESCE(prl.quantity_used, 0) * COALESCE(sii.unit_cost_cents, 0) / ${usageUnitsExpr} / ${lotExpr} ELSE COALESCE(prl.quantity_used, 0) * COALESCE(sii.unit_cost_cents, 0) / ${usageUnitsExpr} END ELSE 0 END) AS tool_usage_cost_cents,
      SUM(CASE WHEN sii.site_item_inventory_id IS NULL THEN 1 ELSE 0 END) AS missing_cost_links,
      MIN(CASE WHEN sii.site_item_inventory_id IS NULL OR ${modeExpr} = 'story_only' THEN NULL WHEN COALESCE(prl.quantity_used, 0) > 0 AND ${modeExpr} = 'end_of_lot' THEN CAST((MAX(0, COALESCE(sii.on_hand_quantity,0) - COALESCE(sii.reserved_quantity,0)) * ${lotExpr}) / COALESCE(NULLIF(prl.quantity_used,0),1) AS INTEGER) WHEN COALESCE(prl.quantity_used, 0) > 0 THEN CAST(MAX(0, COALESCE(sii.on_hand_quantity,0) - COALESCE(sii.reserved_quantity,0)) / prl.quantity_used AS INTEGER) ELSE NULL END) AS buildable_units_from_resources,
      SUM(CASE WHEN sii.site_item_inventory_id IS NULL OR ${modeExpr} = 'story_only' THEN 0 WHEN ${modeExpr} = 'end_of_lot' AND (MAX(0, COALESCE(sii.on_hand_quantity,0) - COALESCE(sii.reserved_quantity,0)) * ${lotExpr}) < COALESCE(prl.quantity_used,0) THEN 1 WHEN ${modeExpr} != 'end_of_lot' AND MAX(0, COALESCE(sii.on_hand_quantity,0) - COALESCE(sii.reserved_quantity,0)) < COALESCE(prl.quantity_used,0) THEN 1 ELSE 0 END) AS resource_shortage_links,
      GROUP_CONCAT(DISTINCT CASE WHEN sii.site_item_inventory_id IS NULL THEN prl.resource_kind || ':' || prl.source_key ELSE NULL END) AS missing_resources
    FROM products p
    LEFT JOIN product_resource_links prl ON prl.product_id = p.product_id
    LEFT JOIN site_item_inventory sii ON sii.source_type = prl.resource_kind AND sii.external_key = prl.source_key
    WHERE (? = 0 OR p.product_id = ?)
      AND (? = '' OR LOWER(COALESCE(p.name,'')) LIKE ? OR LOWER(COALESCE(p.slug,'')) LIKE ? OR LOWER(COALESCE(p.product_category,'')) LIKE ?)
    GROUP BY p.product_id
    ORDER BY p.sort_order ASC, p.created_at DESC, p.product_id DESC
  `).bind(productId, productId, q, like, like, like).all().catch(() => ({ results: [] })));

  const items = rows.map((row) => {
    const price = Number(row.price_cents || 0);
    const cost = Number(row.linked_resource_cost_cents || 0);
    const margin = price - cost;
    return {
      product_id: Number(row.product_id || 0),
      slug: row.slug || '',
      name: row.name || '',
      status: row.status || 'draft',
      review_status: row.review_status || 'pending_review',
      currency: row.currency || 'CAD',
      price_cents: price,
      linked_resource_count: Number(row.linked_resource_count || 0),
      linked_resource_cost_cents: cost,
      supply_cost_cents: Number(row.supply_cost_cents || 0),
      tool_usage_cost_cents: Number(row.tool_usage_cost_cents || 0),
      gross_margin_cents: margin,
      gross_margin_ratio: price > 0 ? Number((margin / price).toFixed(4)) : 0,
      missing_cost_links: Number(row.missing_cost_links || 0),
      buildable_units_from_resources: row.buildable_units_from_resources == null ? null : Number(row.buildable_units_from_resources || 0),
      resource_shortage_links: Number(row.resource_shortage_links || 0),
      missing_resources: row.missing_resources || ''
    };
  });

  return json({
    ok: true,
    requested_by: adminUser,
    items,
    summary: {
      total_products: items.length,
      products_with_costs: items.filter((row) => row.linked_resource_count > 0).length,
      products_missing_cost_links: items.filter((row) => row.missing_cost_links > 0).length,
      products_with_resource_shortages: items.filter((row) => Number(row.resource_shortage_links || 0) > 0).length,
      average_margin_ratio: items.length ? Number((items.reduce((sum, row) => sum + Number(row.gross_margin_ratio || 0), 0) / items.length).toFixed(4)) : 0
    }
  });
}
