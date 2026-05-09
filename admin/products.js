import { getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

function json(data, status = 200) {
  return jsonResponse(data, status);
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function tableExists(db, tableName) {
  try {
    const row = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1")
      .bind(tableName)
      .first();
    return !!row;
  } catch {
    return false;
  }
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

function buildReadiness(row = {}) {
  const imageCount = Number(row.image_count || 0);
  const checks = {
    has_name: normalizeText(row.name).length > 0,
    has_slug: normalizeText(row.slug).length > 0,
    has_price: Number(row.price_cents || 0) > 0,
    has_featured_image: normalizeText(row.featured_image_url).length > 0,
    has_short_description: normalizeText(row.short_description).length >= 40,
    has_description: normalizeText(row.description).length >= 120,
    has_meta_title: normalizeText(row.meta_title).length >= 10,
    has_meta_description: normalizeText(row.meta_description).length >= 50,
    has_category: normalizeText(row.product_category).length > 0,
    has_photo_set: imageCount >= 3,
  };
  const weights = {
    has_name: 10,
    has_slug: 8,
    has_price: 12,
    has_featured_image: 12,
    has_short_description: 10,
    has_description: 8,
    has_meta_title: 8,
    has_meta_description: 8,
    has_category: 4,
    has_photo_set: 20,
  };
  const failedKeys = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
  const earned = Object.entries(checks).reduce((sum, [key, ok]) => sum + (ok ? Number(weights[key] || 0) : 0), 0);
  const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0);
  return {
    is_ready_for_storefront: failedKeys.length === 0 ? 1 : 0,
    ready_check_notes: failedKeys.join(", "),
    publish_readiness_score: total > 0 ? Math.round((earned / total) * 100) : 0,
    image_quality_score: imageCount >= 5 ? 100 : imageCount >= 3 ? 80 : imageCount > 0 ? 45 : 0,
    readiness_checks: checks,
  };
}

async function loadProducts(db, q) {
  const hasTaxClasses = await tableExists(db, "tax_classes");
  const hasProductSeo = await tableExists(db, "product_seo");
  const hasProductImages = await tableExists(db, "product_images");
  const hasResourceLinks = await tableExists(db, "product_resource_links");
  const hasInventory = await tableExists(db, "site_item_inventory");
  const resourceLinkColumns = hasResourceLinks ? await getTableColumnSet(db, 'product_resource_links') : new Set();
  const hasConsumptionMode = resourceLinkColumns.has('consumption_mode');
  const hasLotSizeUnits = resourceLinkColumns.has('lot_size_units');
  const inventoryColumns = hasInventory ? await getTableColumnSet(db, 'site_item_inventory') : new Set();
  const usageUnitsExpr = hasInventory && inventoryColumns.has('usage_units_per_stock_unit') ? `COALESCE(NULLIF(sii.usage_units_per_stock_unit,0),1)` : `1`;
  const inventoryUnitCostExpr = hasInventory ? (inventoryColumns.has('unit_cost_cents') ? `COALESCE(sii.unit_cost_cents,0)` : (inventoryColumns.has('cost_cents') ? `COALESCE(sii.cost_cents,0)` : `0`)) : `0`;

  const clauses = ["1=1"];
  const bindings = [];

  if (q) {
    const searchable = [
      "LOWER(COALESCE(p.name, '')) LIKE ?",
      "LOWER(COALESCE(p.slug, '')) LIKE ?",
      "LOWER(COALESCE(p.sku, '')) LIKE ?",
    ];
    if (hasProductSeo) searchable.push("LOWER(COALESCE(ps.keywords, '')) LIKE ?");
    clauses.push(`(${searchable.join(" OR ")})`);
    const like = `%${q}%`;
    bindings.push(like, like, like);
    if (hasProductSeo) bindings.push(like);
  }

  const selectParts = [
    "p.*",
    hasTaxClasses ? "tc.code AS tax_class_code" : "NULL AS tax_class_code",
    hasTaxClasses ? "tc.name AS tax_class_name" : "NULL AS tax_class_name",
    hasTaxClasses ? "tc.tax_rate AS tax_rate" : "NULL AS tax_rate",
    hasProductSeo ? "ps.meta_title" : "NULL AS meta_title",
    hasProductSeo ? "ps.meta_description" : "NULL AS meta_description",
    hasProductSeo ? "ps.keywords" : "NULL AS keywords",
    hasProductSeo ? "ps.h1_override" : "NULL AS h1_override",
    hasProductImages ? "COUNT(DISTINCT pi.product_image_id) AS image_count" : "0 AS image_count",
    hasResourceLinks ? "COUNT(DISTINCT prl.product_resource_link_id) AS linked_resource_count" : "0 AS linked_resource_count",
    hasResourceLinks && hasInventory
      ? `COALESCE(SUM(CASE WHEN ${hasConsumptionMode ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`} = 'story_only' THEN 0 WHEN ${hasConsumptionMode ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`} = 'end_of_lot' THEN COALESCE(prl.quantity_used, 0) * ${inventoryUnitCostExpr} / ${usageUnitsExpr} / COALESCE(NULLIF(${hasLotSizeUnits ? `prl.lot_size_units` : `1`},0),1) ELSE COALESCE(prl.quantity_used, 0) * ${inventoryUnitCostExpr} / ${usageUnitsExpr} END), 0) AS linked_resource_cost_cents`
      : "0 AS linked_resource_cost_cents",
    hasResourceLinks && hasInventory
      ? "SUM(CASE WHEN sii.site_item_inventory_id IS NULL THEN 1 ELSE 0 END) AS missing_cost_links"
      : "0 AS missing_cost_links",
    hasResourceLinks && hasInventory
      ? `MIN(CASE WHEN sii.site_item_inventory_id IS NULL THEN NULL WHEN ${hasConsumptionMode ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`} = 'story_only' THEN NULL WHEN COALESCE(prl.quantity_used, 0) > 0 AND ${hasConsumptionMode ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`} = 'end_of_lot' THEN CAST((MAX(0, COALESCE(sii.on_hand_quantity,0) - COALESCE(sii.reserved_quantity,0)) * ${usageUnitsExpr} * COALESCE(NULLIF(${hasLotSizeUnits ? `prl.lot_size_units` : `1`},0),1)) / COALESCE(NULLIF(prl.quantity_used,0),1) AS INTEGER) WHEN COALESCE(prl.quantity_used, 0) > 0 THEN CAST((MAX(0, COALESCE(sii.on_hand_quantity,0) - COALESCE(sii.reserved_quantity,0)) * ${usageUnitsExpr}) / prl.quantity_used AS INTEGER) ELSE NULL END) AS buildable_units_from_resources`
      : "NULL AS buildable_units_from_resources",
    hasResourceLinks && hasInventory
      ? `SUM(CASE WHEN sii.site_item_inventory_id IS NULL THEN 0 WHEN ${hasConsumptionMode ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`} = 'story_only' THEN 0 WHEN ${hasConsumptionMode ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`} = 'end_of_lot' AND COALESCE(prl.quantity_used,0) > 0 AND (MAX(0, COALESCE(sii.on_hand_quantity,0) - COALESCE(sii.reserved_quantity,0)) * ${usageUnitsExpr} * COALESCE(NULLIF(${hasLotSizeUnits ? `prl.lot_size_units` : `1`},0),1)) < COALESCE(prl.quantity_used,0) THEN 1 WHEN COALESCE(prl.quantity_used,0) > 0 AND (MAX(0, COALESCE(sii.on_hand_quantity,0) - COALESCE(sii.reserved_quantity,0)) * ${usageUnitsExpr}) < COALESCE(prl.quantity_used,0) THEN 1 ELSE 0 END) AS resource_shortage_links`
      : "0 AS resource_shortage_links",
    "CASE WHEN COALESCE(p.inventory_tracking,0)=1 AND COALESCE(p.inventory_quantity,0) <= 2 THEN 1 ELSE 0 END AS low_stock_flag",
  ];

  const joinParts = [];
  if (hasTaxClasses) joinParts.push("LEFT JOIN tax_classes tc ON p.tax_class_id = tc.tax_class_id");
  if (hasProductSeo) joinParts.push("LEFT JOIN product_seo ps ON ps.product_id = p.product_id");
  if (hasProductImages) joinParts.push("LEFT JOIN product_images pi ON pi.product_id = p.product_id");
  if (hasResourceLinks) joinParts.push("LEFT JOIN product_resource_links prl ON prl.product_id = p.product_id");
  if (hasResourceLinks && hasInventory) {
    joinParts.push(
      "LEFT JOIN site_item_inventory sii ON sii.source_type = prl.resource_kind AND sii.external_key = prl.source_key"
    );
  }

  const sql = `
    SELECT ${selectParts.join(",\n           ")}
    FROM products p
    ${joinParts.join("\n    ")}
    WHERE ${clauses.join(" AND ")}
    GROUP BY p.product_id
    ORDER BY p.sort_order ASC, p.created_at DESC, p.product_id DESC
  `;

  const result = bindings.length
    ? await db.prepare(sql).bind(...bindings).all()
    : await db.prepare(sql).all();

  return {
    rawProducts: normalizeResults(result),
    features: {
      hasTaxClasses,
      hasProductSeo,
      hasProductImages,
      hasResourceLinks,
      hasInventory,
    },
  };
}

async function loadProductsFallback(db, q) {
  const clauses = ["1=1"];
  const bindings = [];
  if (q) {
    clauses.push("(LOWER(COALESCE(name, '')) LIKE ? OR LOWER(COALESCE(slug, '')) LIKE ? OR LOWER(COALESCE(sku, '')) LIKE ?)");
    const like = `%${q}%`;
    bindings.push(like, like, like);
  }

  const sql = `
    SELECT
      p.*,
      NULL AS tax_class_code,
      NULL AS tax_class_name,
      NULL AS tax_rate,
      NULL AS meta_title,
      NULL AS meta_description,
      NULL AS keywords,
      NULL AS h1_override,
      0 AS image_count,
      0 AS linked_resource_count,
      0 AS linked_resource_cost_cents,
      0 AS missing_cost_links,
      NULL AS buildable_units_from_resources,
      0 AS resource_shortage_links,
      CASE WHEN COALESCE(p.inventory_tracking,0)=1 AND COALESCE(p.inventory_quantity,0) <= 2 THEN 1 ELSE 0 END AS low_stock_flag
    FROM products p
    WHERE ${clauses.join(" AND ")}
    ORDER BY p.sort_order ASC, p.created_at DESC, p.product_id DESC
  `;

  const result = bindings.length
    ? await db.prepare(sql).bind(...bindings).all()
    : await db.prepare(sql).all();

  return {
    rawProducts: normalizeResults(result),
    features: {
      hasTaxClasses: false,
      hasProductSeo: false,
      hasProductImages: false,
      hasResourceLinks: false,
      hasInventory: false,
      fallbackMode: true,
    },
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "Database binding is not configured." }, 500);

  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);

  const url = new URL(request.url);
  const q = normalizeText(url.searchParams.get("q")).toLowerCase();

  let loaded;
  let warnings = [];

  try {
    loaded = await loadProducts(db, q);
  } catch (error) {
    warnings.push(`Primary product rollup query failed: ${String(error?.message || error || "Unknown error")}`);
    try {
      loaded = await loadProductsFallback(db, q);
    } catch (fallbackError) {
      return json(
        {
          ok: false,
          error: "Could not load admin products.",
          warnings: [
            ...warnings,
            `Fallback query failed: ${String(fallbackError?.message || fallbackError || "Unknown error")}`,
          ],
        },
        500
      );
    }
  }

  const products = loaded.rawProducts.map((row) => {
    const linkedResourceCost = Number(row.linked_resource_cost_cents || 0);
    const priceCents = Number(row.price_cents || 0);
    return {
      ...row,
      low_stock_flag: Number(row.low_stock_flag || 0),
      image_count: Number(row.image_count || 0),
      linked_resource_count: Number(row.linked_resource_count || 0),
      linked_resource_cost_cents: linkedResourceCost,
      gross_margin_cents: priceCents - linkedResourceCost,
      gross_margin_ratio: priceCents > 0 ? Number(((priceCents - linkedResourceCost) / priceCents).toFixed(4)) : 0,
      missing_cost_links: Number(row.missing_cost_links || 0),
      buildable_units_from_resources:
        row.buildable_units_from_resources == null ? null : Number(row.buildable_units_from_resources || 0),
      resource_shortage_links: Number(row.resource_shortage_links || 0),
      ...buildReadiness(row),
    };
  });

  return json({
    ok: true,
    requested_by: adminUser,
    products,
    warnings,
    feature_flags: loaded.features,
    summary: {
      total_products: products.length,
      low_stock_products: products.filter((row) => Number(row.low_stock_flag || 0) === 1).length,
      ready_for_storefront_products: products.filter((row) => Number(row.is_ready_for_storefront || 0) === 1).length,
      pending_review_products: products.filter((row) => String(row.review_status || "").toLowerCase() === "pending_review").length,
      products_with_cost_rollups: products.filter((row) => Number(row.linked_resource_count || 0) > 0).length,
      products_missing_cost_links: products.filter((row) => Number(row.missing_cost_links || 0) > 0).length,
      products_with_resource_shortages: products.filter((row) => Number(row.resource_shortage_links || 0) > 0).length,
    },
  });
}
