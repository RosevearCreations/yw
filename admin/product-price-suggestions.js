import { getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

function json(data, status = 200) { return jsonResponse(data, status); }
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }
async function getTableColumnSet(db, tableName) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    return new Set(rows.map((row) => String(row?.name || '').trim()).filter(Boolean));
  } catch { return new Set(); }
}
function cents(value) { return Math.max(0, Math.round(Number(value || 0))); }
function percent(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function safeDivide(n, d) { const bottom = Number(d || 0); return bottom > 0 ? n / bottom : 0; }

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  const url = new URL(request.url);
  const productId = Number(url.searchParams.get('product_id') || 0);
  const q = normalizeText(url.searchParams.get('q')).toLowerCase();
  const like = `%${q}%`;
  const packagingCents = cents(url.searchParams.get('packaging_cents') || 0);
  const shippingPressureCents = cents(url.searchParams.get('shipping_pressure_cents') || 0);
  const overheadPercent = Math.max(0, percent(url.searchParams.get('overhead_percent'), 12));
  const targetMarginPercent = Math.min(95, Math.max(5, percent(url.searchParams.get('target_margin_percent'), 65)));

  const resourceLinkColumns = await getTableColumnSet(db, 'product_resource_links');
  const inventoryColumns = await getTableColumnSet(db, 'site_item_inventory');
  const hasProductCosts = !!(await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='product_costs' LIMIT 1`).first().catch(() => null));
  const modeExpr = resourceLinkColumns.has('consumption_mode') ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`;
  const lotExpr = resourceLinkColumns.has('lot_size_units') ? `COALESCE(NULLIF(prl.lot_size_units,0),1)` : `1`;
  const usageUnitsExpr = inventoryColumns.has('usage_units_per_stock_unit') ? `COALESCE(NULLIF(sii.usage_units_per_stock_unit,0),1)` : `1`;
  const unitCostExpr = inventoryColumns.has('unit_cost_cents') ? `COALESCE(sii.unit_cost_cents,0)` : (inventoryColumns.has('cost_cents') ? `COALESCE(sii.cost_cents,0)` : `0`);
  const productCostsJoin = hasProductCosts
    ? `LEFT JOIN (
      SELECT pcA.product_cost_id, pcA.product_number, pcA.cost_per_unit
      FROM product_costs pcA
    ) pc ON pc.product_cost_id = (
      SELECT pc2.product_cost_id
      FROM product_costs pc2
      WHERE CAST(pc2.product_number AS TEXT) = CAST(p.product_number AS TEXT)
      ORDER BY COALESCE(pc2.effective_date, pc2.created_at, '1970-01-01') DESC, pc2.product_cost_id DESC
      LIMIT 1
    )`
    : `LEFT JOIN (SELECT NULL AS product_cost_id, NULL AS product_number, 0 AS cost_per_unit) pc ON 1 = 0`;

  const rows = normalizeResults(await db.prepare(`
    SELECT
      p.product_id,
      p.product_number,
      p.name,
      p.slug,
      p.status,
      p.review_status,
      p.currency,
      COALESCE(p.price_cents,0) AS price_cents,
      COALESCE(resource_rollup.resource_cost_cents,0) AS resource_cost_cents,
      COALESCE(resource_rollup.supply_cost_cents,0) AS supply_cost_cents,
      COALESCE(resource_rollup.tool_cost_cents,0) AS tool_cost_cents,
      COALESCE(resource_rollup.missing_cost_links,0) AS missing_cost_links,
      COALESCE(pc.cost_per_unit,0) AS manual_cost_per_unit
    FROM products p
    LEFT JOIN (
      SELECT
        prl.product_id,
        SUM(CASE
          WHEN ${modeExpr} = 'story_only' THEN 0
          WHEN ${modeExpr} = 'end_of_lot' THEN COALESCE(prl.quantity_used,0) * ${unitCostExpr} / ${usageUnitsExpr} / ${lotExpr}
          ELSE COALESCE(prl.quantity_used,0) * ${unitCostExpr} / ${usageUnitsExpr}
        END) AS resource_cost_cents,
        SUM(CASE WHEN prl.resource_kind = 'supply' THEN CASE
          WHEN ${modeExpr} = 'story_only' THEN 0
          WHEN ${modeExpr} = 'end_of_lot' THEN COALESCE(prl.quantity_used,0) * ${unitCostExpr} / ${usageUnitsExpr} / ${lotExpr}
          ELSE COALESCE(prl.quantity_used,0) * ${unitCostExpr} / ${usageUnitsExpr}
        END ELSE 0 END) AS supply_cost_cents,
        SUM(CASE WHEN prl.resource_kind = 'tool' THEN CASE
          WHEN ${modeExpr} = 'story_only' THEN 0
          WHEN ${modeExpr} = 'end_of_lot' THEN COALESCE(prl.quantity_used,0) * ${unitCostExpr} / ${usageUnitsExpr} / ${lotExpr}
          ELSE COALESCE(prl.quantity_used,0) * ${unitCostExpr} / ${usageUnitsExpr}
        END ELSE 0 END) AS tool_cost_cents,
        SUM(CASE WHEN sii.site_item_inventory_id IS NULL OR ${unitCostExpr} <= 0 THEN 1 ELSE 0 END) AS missing_cost_links
      FROM product_resource_links prl
      LEFT JOIN site_item_inventory sii ON sii.source_type = prl.resource_kind AND sii.external_key = prl.source_key
      GROUP BY prl.product_id
    ) resource_rollup ON resource_rollup.product_id = p.product_id
    ${productCostsJoin}
    WHERE (? = 0 OR p.product_id = ?)
      AND (? = '' OR LOWER(COALESCE(p.name,'')) LIKE ? OR LOWER(COALESCE(p.slug,'')) LIKE ? OR LOWER(COALESCE(p.product_category,'')) LIKE ?)
    ORDER BY CASE WHEN LOWER(COALESCE(p.status,'draft'))='active' THEN 0 ELSE 1 END, LOWER(COALESCE(p.name,'')) ASC
    LIMIT 200
  `).bind(productId, productId, q, like, like, like).all().catch(() => ({ results: [] })));

  const items = rows.map((row) => {
    const manualCostCents = cents(Number(row.manual_cost_per_unit || 0) * 100);
    const resourceCostCents = cents(row.resource_cost_cents || 0);
    const baseKnownCostCents = Math.max(resourceCostCents, manualCostCents);
    const overheadCents = cents(baseKnownCostCents * safeDivide(overheadPercent, 100));
    const landedCostCents = baseKnownCostCents + packagingCents + shippingPressureCents + overheadCents;
    const makeSuggested = (marginPct) => {
      const marginRatio = safeDivide(marginPct, 100);
      return marginRatio < 1 ? cents(safeDivide(landedCostCents, 1 - marginRatio)) : landedCostCents;
    };
    const targetSuggested = makeSuggested(targetMarginPercent);
    return {
      product_id: Number(row.product_id || 0),
      product_number: row.product_number || '',
      name: row.name || '',
      slug: row.slug || '',
      status: row.status || 'draft',
      review_status: row.review_status || 'pending_review',
      currency: row.currency || 'CAD',
      price_cents: cents(row.price_cents || 0),
      resource_cost_cents: resourceCostCents,
      manual_cost_cents: manualCostCents,
      base_known_cost_cents: baseKnownCostCents,
      packaging_cents: packagingCents,
      shipping_pressure_cents: shippingPressureCents,
      overhead_percent: overheadPercent,
      overhead_cents: overheadCents,
      landed_cost_cents: landedCostCents,
      target_margin_percent: targetMarginPercent,
      suggested_price_cents: targetSuggested,
      suggested_compare_at_cents: cents(targetSuggested * 1.15),
      conservative_price_cents: makeSuggested(Math.max(45, targetMarginPercent - 10)),
      stretch_price_cents: makeSuggested(Math.min(85, targetMarginPercent + 10)),
      missing_cost_links: Number(row.missing_cost_links || 0),
      current_margin_cents: cents(row.price_cents || 0) - landedCostCents,
      current_margin_ratio: Number(row.price_cents || 0) > 0 ? Number(((Number(row.price_cents || 0) - landedCostCents) / Number(row.price_cents || 0)).toFixed(4)) : 0,
      notes: [
        manualCostCents > resourceCostCents ? 'Using latest manual unit-cost snapshot as the stronger base cost.' : '',
        resourceCostCents > 0 ? 'Linked resource costs are included.' : 'No linked resource cost found yet.',
        Number(row.missing_cost_links || 0) > 0 ? `${Number(row.missing_cost_links || 0)} linked item(s) still have no cost.` : ''
      ].filter(Boolean)
    };
  });

  return json({
    ok: true,
    requested_by: adminUser,
    assumptions: {
      packaging_cents: packagingCents,
      shipping_pressure_cents: shippingPressureCents,
      overhead_percent: overheadPercent,
      target_margin_percent: targetMarginPercent
    },
    items,
    summary: {
      total_products: items.length,
      products_needing_cost_work: items.filter((row) => row.missing_cost_links > 0 || row.base_known_cost_cents <= 0).length,
      average_landed_cost_cents: items.length ? Math.round(items.reduce((sum, row) => sum + row.landed_cost_cents, 0) / items.length) : 0
    }
  });
}
