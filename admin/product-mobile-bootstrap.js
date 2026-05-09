import { getAdminUserFromRequest, getDb, jsonResponse } from "../_lib/adminAudit.js";
import { getNextProductNumber, getProductNumberStart } from "./_product-numbering.js";
import { loadCatalogOptionSets } from "./_catalog-options.js";

function json(data, status = 200) {
  return jsonResponse(data, status);
}
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }
async function getTableColumnSet(db, tableName) { try { const result = await db.prepare(`PRAGMA table_info(${tableName})`).all(); const rows = Array.isArray(result?.results) ? result.results : []; return new Set(rows.map((row) => String(row?.name || '').trim()).filter(Boolean)); } catch { return new Set(); } }

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  const nextProductNumber = await getNextProductNumber(db);
  const productNumberStart = await getProductNumberStart(db);
  const inventoryColumns = await getTableColumnSet(db, 'site_item_inventory');
  const taxClassColumns = await getTableColumnSet(db, 'tax_classes');
  const taxRateExpr = taxClassColumns.has('rate_percent') ? 'COALESCE(rate_percent, tax_rate, 0)' : 'COALESCE(tax_rate, 0)';
  const stockUnitExpr = inventoryColumns.has('stock_unit_label') ? `COALESCE(NULLIF(sii.stock_unit_label,''),'unit')` : `'unit'`;
  const usageLabelExpr = inventoryColumns.has('usage_unit_label') ? `COALESCE(NULLIF(sii.usage_unit_label,''),'unit')` : `'unit'`;
  const usageUnitsExpr = inventoryColumns.has('usage_units_per_stock_unit') ? `COALESCE(NULLIF(sii.usage_units_per_stock_unit,0),1)` : `1`;
  const taxClasses = normalizeResults(await db.prepare(`SELECT tax_class_id, code, name, ${taxRateExpr} AS tax_rate FROM tax_classes WHERE COALESCE(is_active,1)=1 ORDER BY LOWER(name) ASC`).all().catch(() => ({ results: [] })));
  const optionSets = await loadCatalogOptionSets(db);
  const resources = normalizeResults(await db.prepare(`
    SELECT * FROM (
      SELECT ci.item_kind, ci.source_key, ci.name, ci.image_url, ci.category, ci.subcategory,
             COALESCE(sii.on_hand_quantity,0) AS on_hand_quantity,
             COALESCE(sii.incoming_quantity,0) AS incoming_quantity,
             COALESCE(sii.reorder_level,0) AS reorder_level,
             COALESCE(sii.is_on_reorder_list,0) AS is_on_reorder_list,
             COALESCE(sii.do_not_reuse,0) AS do_not_reuse,
             ${stockUnitExpr} AS stock_unit_label,
             ${usageLabelExpr} AS usage_unit_label,
             ${usageUnitsExpr} AS usage_units_per_stock_unit,
             COALESCE(sii.unit_cost_cents,0) AS unit_cost_cents,
             CASE WHEN COALESCE(sii.reorder_level,0) > 0 AND (COALESCE(sii.on_hand_quantity,0) + COALESCE(sii.incoming_quantity,0)) <= COALESCE(sii.reorder_level,0) THEN 1 ELSE 0 END AS reorder_needed
      FROM catalog_items ci
      LEFT JOIN site_item_inventory sii ON sii.source_type = ci.item_kind AND sii.external_key = ci.source_key
      WHERE ci.item_kind IN ('tool','supply') AND COALESCE(ci.status,'active') != 'archived'
      UNION ALL
      SELECT sii.source_type AS item_kind, sii.external_key AS source_key, sii.item_name AS name, sii.image_url, sii.category, '' AS subcategory,
             COALESCE(sii.on_hand_quantity,0) AS on_hand_quantity,
             COALESCE(sii.incoming_quantity,0) AS incoming_quantity,
             COALESCE(sii.reorder_level,0) AS reorder_level,
             COALESCE(sii.is_on_reorder_list,0) AS is_on_reorder_list,
             COALESCE(sii.do_not_reuse,0) AS do_not_reuse,
             ${stockUnitExpr} AS stock_unit_label,
             ${usageLabelExpr} AS usage_unit_label,
             ${usageUnitsExpr} AS usage_units_per_stock_unit,
             COALESCE(sii.unit_cost_cents,0) AS unit_cost_cents,
             CASE WHEN COALESCE(sii.reorder_level,0) > 0 AND (COALESCE(sii.on_hand_quantity,0) + COALESCE(sii.incoming_quantity,0)) <= COALESCE(sii.reorder_level,0) THEN 1 ELSE 0 END AS reorder_needed
      FROM site_item_inventory sii
      WHERE sii.source_type IN ('tool','supply')
        AND COALESCE(sii.is_active,1) = 1
        AND NOT EXISTS (
          SELECT 1 FROM catalog_items ci
          WHERE ci.item_kind = sii.source_type AND ci.source_key = sii.external_key
        )
    ) resource_pool
    ORDER BY item_kind ASC, LOWER(name) ASC
    LIMIT 700
  `).all().catch(() => ({ results: [] })));

  const nextProductNumberValue = Number(nextProductNumber || productNumberStart || 1000);

  return json({
    ok: true,
    next_product_number: nextProductNumberValue,
    next_product_number_label: `DD${String(nextProductNumberValue).padStart(4, '0')}`,
    product_number_start: Number(productNumberStart || 1000),
    category_options: optionSets.category_options || [],
    color_options: optionSets.color_options || [],
    shipping_code_options: optionSets.shipping_code_options || [],
    tax_classes: taxClasses.map((row) => ({ tax_class_id: Number(row.tax_class_id || 0), code: row.code || '', name: row.name || '', tax_rate: Number(row.tax_rate || 0) })),
    resources: resources.map((row) => ({ item_kind: row.item_kind || '', source_key: row.source_key || '', name: row.name || '', image_url: row.image_url || '', category: row.category || '', subcategory: row.subcategory || '', on_hand_quantity: Number(row.on_hand_quantity || 0), incoming_quantity: Number(row.incoming_quantity || 0), reorder_level: Number(row.reorder_level || 0), is_on_reorder_list: Number(row.is_on_reorder_list || 0), do_not_reuse: Number(row.do_not_reuse || 0), stock_unit_label: row.stock_unit_label || 'unit', usage_unit_label: row.usage_unit_label || 'unit', usage_units_per_stock_unit: Number(row.usage_units_per_stock_unit || 1) || 1, unit_cost_cents: Number(row.unit_cost_cents || 0), reorder_needed: Number(row.reorder_needed || 0) }))
  });
}
