// File: /functions/api/admin/product-resources.js

import {
  getAdminUserFromRequest,
  getDb,
  jsonResponse,
  normalizeText
} from "../_lib/adminAudit.js";

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

const DEFAULT_PRODUCT_MEDIA_PUBLIC_BASE_URL = "https://assets.devilndove.com";

function getProductMediaPublicBase(env) {
  return normalizeText(
    env.PRODUCT_MEDIA_PUBLIC_BASE_URL ||
    env.R2_PUBLIC_BASE_URL ||
    env.PUBLIC_R2_BASE_URL ||
    env.ASSET_ORIGIN ||
    DEFAULT_PRODUCT_MEDIA_PUBLIC_BASE_URL
  );
}

function normalizeImageUrl(env, value) {
  const cleanValue = normalizeText(value);
  if (!cleanValue) return "";
  if (/^https?:\/\//i.test(cleanValue) || cleanValue.startsWith("data:") || cleanValue.startsWith("blob:")) {
    return cleanValue;
  }
  const base = getProductMediaPublicBase(env);
  return base ? `${base.replace(/\/$/, "")}/${cleanValue.replace(/^\/+/, "")}` : cleanValue;
}

function json(data, status = 200) {
  return jsonResponse(data, status);
}

async function getTableColumnSet(db, tableName) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    return new Set(rows.map((row) => String(row?.name || "").trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function coalesceSql(expressions, fallback = "NULL") {
  const usable = expressions.filter(Boolean);
  if (!usable.length) return fallback;
  if (usable.length === 1) return usable[0];
  return `COALESCE(${usable.join(", ")})`;
}

function parseMoneyCents(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeConsumptionMode(value) {
  const mode = normalizeText(value).toLowerCase();
  if (["per_unit", "end_of_lot", "story_only"].includes(mode)) return mode;
  return "per_unit";
}

function buildResourcePreview(resource, link) {
  const unitCostCents = parseMoneyCents(resource.unit_cost_cents);
  const onHandQuantity = Math.max(0, parseNumber(resource.on_hand_quantity, 0));
  const usageUnitsPerStockUnit = Math.max(1, parseNumber(resource.usage_units_per_stock_unit, 1));
  const quantityUsed = Math.max(0, parseNumber(link?.quantity_used ?? 1, 1));
  const productsPerLot = Math.max(1, parseNumber(link?.lot_size_units ?? 1, 1));
  const consumptionMode = normalizeConsumptionMode(link?.consumption_mode);

  const totalUsageUnitsAvailable = onHandQuantity * usageUnitsPerStockUnit;

  let estimatedCostPerProductCents = 0;
  let buildableProducts = 0;

  if (consumptionMode === "story_only") {
    estimatedCostPerProductCents = 0;
    buildableProducts = 0;
  } else if (consumptionMode === "end_of_lot") {
    estimatedCostPerProductCents = productsPerLot > 0 ? Math.round(unitCostCents / productsPerLot) : unitCostCents;
    buildableProducts = productsPerLot > 0 ? onHandQuantity * productsPerLot : 0;
  } else {
    estimatedCostPerProductCents =
      usageUnitsPerStockUnit > 0
        ? Math.round((unitCostCents / usageUnitsPerStockUnit) * quantityUsed)
        : unitCostCents;

    buildableProducts =
      quantityUsed > 0
        ? Math.floor(totalUsageUnitsAvailable / quantityUsed)
        : 0;
  }

  return {
    stock_unit_label: resource.stock_unit_label || "stock unit",
    usage_unit_label: resource.usage_unit_label || "unit",
    usage_units_per_stock_unit: usageUnitsPerStockUnit,
    estimated_cost_per_product_cents: Math.max(0, estimatedCostPerProductCents),
    buildable_products: Math.max(0, buildableProducts)
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  if (!db) {
    return json({ ok: false, error: "Database binding is not configured." }, 500);
  }

  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  try {
    const [inventoryColumns, catalogColumns, linkColumns] = await Promise.all([
      getTableColumnSet(db, "site_item_inventory"),
      getTableColumnSet(db, "catalog_items"),
      getTableColumnSet(db, "product_resource_links")
    ]);

    const url = new URL(request.url);
    const productId = Number(url.searchParams.get("product_id") || 0);
    const query = normalizeText(url.searchParams.get("q")).toLowerCase();
    const like = `%${query}%`;

    const inventoryKindExpr = coalesceSql(
      [
        inventoryColumns.has("item_kind") ? "sii.item_kind" : "",
        inventoryColumns.has("source_type") ? "sii.source_type" : ""
      ],
      "'supply'"
    );

    const inventorySourceTypeExpr = coalesceSql(
      [
        inventoryColumns.has("source_type") ? "sii.source_type" : "",
        inventoryColumns.has("item_kind") ? "sii.item_kind" : ""
      ],
      "'supply'"
    );

    const inventoryExternalKeyExpr = coalesceSql(
      [
        inventoryColumns.has("external_key") ? "sii.external_key" : "",
        inventoryColumns.has("source_key") ? "sii.source_key" : ""
      ],
      "NULL"
    );

    const inventoryNameExpr = coalesceSql(
      [
        inventoryColumns.has("item_name") ? "sii.item_name" : "",
        inventoryColumns.has("name") ? "sii.name" : "",
        inventoryExternalKeyExpr !== "NULL" ? inventoryExternalKeyExpr : ""
      ],
      "''"
    );

    const inventoryCategoryExpr = inventoryColumns.has("category") ? "sii.category" : "''";
    const inventorySubcategoryExpr = inventoryColumns.has("subcategory") ? "sii.subcategory" : "''";
    const inventoryOnHandExpr = coalesceSql(
      [
        inventoryColumns.has("on_hand_quantity") ? "sii.on_hand_quantity" : "",
        inventoryColumns.has("quantity_on_hand") ? "sii.quantity_on_hand" : "",
        inventoryColumns.has("quantity") ? "sii.quantity" : ""
      ],
      "0"
    );
    const inventoryReorderExpr = coalesceSql(
      [
        inventoryColumns.has("is_on_reorder_list") ? "sii.is_on_reorder_list" : "",
        inventoryColumns.has("reorder_flag") ? "sii.reorder_flag" : ""
      ],
      "0"
    );
    const inventoryDoNotReuseExpr = inventoryColumns.has("do_not_reuse") ? "sii.do_not_reuse" : "0";
    const inventoryImageExpr = coalesceSql(
      [
        inventoryColumns.has("image_url") ? "sii.image_url" : "",
        inventoryColumns.has("featured_image_url") ? "sii.featured_image_url" : ""
      ],
      "''"
    );
    const inventoryIdExpr = inventoryColumns.has("site_item_inventory_id") ? "sii.site_item_inventory_id" : "0";
    const inventoryUnitCostExpr = coalesceSql(
      [
        inventoryColumns.has("unit_cost_cents") ? "sii.unit_cost_cents" : "",
        inventoryColumns.has("cost_cents") ? "sii.cost_cents" : "",
        inventoryColumns.has("unit_cost") ? "ROUND(sii.unit_cost * 100)" : ""
      ],
      "0"
    );
    const inventoryUsageUnitLabelExpr = coalesceSql(
      [
        inventoryColumns.has("usage_unit_label") ? "NULLIF(sii.usage_unit_label, '')" : ""
      ],
      "'unit'"
    );
    const inventoryStockUnitLabelExpr = coalesceSql(
      [
        inventoryColumns.has("stock_unit_label") ? "NULLIF(sii.stock_unit_label, '')" : ""
      ],
      "'stock unit'"
    );
    const inventoryUsageUnitsPerStockUnitExpr = coalesceSql(
      [
        inventoryColumns.has("usage_units_per_stock_unit") ? "NULLIF(sii.usage_units_per_stock_unit, 0)" : ""
      ],
      "1"
    );

    const canJoinCatalogInventory =
      catalogColumns.has("item_kind") &&
      catalogColumns.has("source_key") &&
      (inventoryColumns.has("source_type") || inventoryColumns.has("item_kind")) &&
      (inventoryColumns.has("external_key") || inventoryColumns.has("source_key"));

    const catalogInventoryJoinSql = canJoinCatalogInventory
      ? `
        LEFT JOIN site_item_inventory sii
          ON ${inventorySourceTypeExpr} = ci.item_kind
         AND ${inventoryExternalKeyExpr} = ci.source_key
      `
      : `
        LEFT JOIN site_item_inventory sii
          ON 1 = 0
      `;

    const products = normalizeResults(
      await db.prepare(`
        SELECT product_id, name, slug, featured_image_url, status
        FROM products
        ORDER BY LOWER(COALESCE(name, '')) ASC
        LIMIT 300
      `).all()
    ).map((row) => ({
      product_id: Number(row.product_id || 0),
      name: row.name || "",
      slug: row.slug || "",
      featured_image_url: normalizeImageUrl(env, row.featured_image_url || ""),
      status: row.status || ""
    }));

    const catalogResources = normalizeResults(
      await db.prepare(`
        SELECT
          ci.item_kind,
          ci.source_key,
          ci.name,
          ci.image_url,
          ci.category,
          ci.subcategory,
          ${inventoryIdExpr} AS site_item_inventory_id,
          ${inventoryOnHandExpr} AS on_hand_quantity,
          ${inventoryReorderExpr} AS is_on_reorder_list,
          ${inventoryDoNotReuseExpr} AS do_not_reuse,
          ${inventoryUnitCostExpr} AS unit_cost_cents,
          ${inventoryUsageUnitLabelExpr} AS usage_unit_label,
          ${inventoryStockUnitLabelExpr} AS stock_unit_label,
          ${inventoryUsageUnitsPerStockUnitExpr} AS usage_units_per_stock_unit
        FROM catalog_items ci
        ${catalogInventoryJoinSql}
        WHERE ci.item_kind IN ('tool', 'supply')
          AND COALESCE(ci.status, 'active') != 'archived'
          AND (
            ? = ''
            OR LOWER(COALESCE(ci.name, '')) LIKE ?
            OR LOWER(COALESCE(ci.category, '')) LIKE ?
            OR LOWER(COALESCE(ci.subcategory, '')) LIKE ?
          )
        ORDER BY ci.item_kind ASC, LOWER(COALESCE(ci.name, '')) ASC
        LIMIT 500
      `).bind(query, like, like, like).all()
    ).map((row) => ({
      item_kind: row.item_kind || "",
      source_key: row.source_key || "",
      name: row.name || "",
      image_url: normalizeImageUrl(env, row.image_url || ""),
      category: row.category || "",
      subcategory: row.subcategory || "",
      site_item_inventory_id: Number(row.site_item_inventory_id || 0),
      on_hand_quantity: parseNumber(row.on_hand_quantity, 0),
      is_on_reorder_list: Number(row.is_on_reorder_list || 0),
      do_not_reuse: Number(row.do_not_reuse || 0),
      unit_cost_cents: parseMoneyCents(row.unit_cost_cents),
      usage_unit_label: row.usage_unit_label || "unit",
      stock_unit_label: row.stock_unit_label || "stock unit",
      usage_units_per_stock_unit: Math.max(1, parseNumber(row.usage_units_per_stock_unit, 1))
    }));

    const canReadInventoryOnly =
      inventoryColumns.size > 0 &&
      (inventoryColumns.has("item_name") || inventoryColumns.has("name") || inventoryColumns.has("external_key") || inventoryColumns.has("source_key"));

    const inventoryOnlySql = canReadInventoryOnly
      ? `
        SELECT
          ${inventoryIdExpr} AS site_item_inventory_id,
          ${inventoryNameExpr} AS item_name,
          ${inventoryKindExpr} AS item_kind,
          ${inventorySourceTypeExpr} AS source_type,
          ${inventoryExternalKeyExpr} AS external_key,
          ${inventoryCategoryExpr} AS category,
          ${inventorySubcategoryExpr} AS subcategory,
          ${inventoryOnHandExpr} AS on_hand_quantity,
          ${inventoryReorderExpr} AS is_on_reorder_list,
          ${inventoryDoNotReuseExpr} AS do_not_reuse,
          ${inventoryImageExpr} AS image_url,
          ${inventoryUnitCostExpr} AS unit_cost_cents,
          ${inventoryUsageUnitLabelExpr} AS usage_unit_label,
          ${inventoryStockUnitLabelExpr} AS stock_unit_label,
          ${inventoryUsageUnitsPerStockUnitExpr} AS usage_units_per_stock_unit
        FROM site_item_inventory sii
        WHERE ${inventoryKindExpr} IN ('tool', 'supply')
          AND (
            ? = ''
            OR LOWER(COALESCE(${inventoryNameExpr}, '')) LIKE ?
            OR LOWER(COALESCE(${inventoryCategoryExpr}, '')) LIKE ?
            OR LOWER(COALESCE(${inventorySubcategoryExpr}, '')) LIKE ?
          )
          ${canJoinCatalogInventory ? `
          AND NOT EXISTS (
            SELECT 1
            FROM catalog_items ci
            WHERE ci.item_kind = ${inventoryKindExpr}
              AND ci.source_key = ${inventoryExternalKeyExpr}
          )` : ""}
        ORDER BY LOWER(COALESCE(${inventoryNameExpr}, '')) ASC
        LIMIT 300
      `
      : null;

    const inventoryOnlyResources = inventoryOnlySql
      ? normalizeResults(
          await db.prepare(inventoryOnlySql).bind(query, like, like, like).all()
        ).map((row) => {
          const itemKind = row.item_kind || row.source_type || "supply";
          const sourceKey = row.external_key || `inventory:${row.site_item_inventory_id}`;
          return {
            item_kind: itemKind,
            source_key: sourceKey,
            name: row.item_name || sourceKey,
            image_url: normalizeImageUrl(env, row.image_url || ""),
            category: row.category || "",
            subcategory: row.subcategory || "",
            site_item_inventory_id: Number(row.site_item_inventory_id || 0),
            on_hand_quantity: parseNumber(row.on_hand_quantity, 0),
            is_on_reorder_list: Number(row.is_on_reorder_list || 0),
            do_not_reuse: Number(row.do_not_reuse || 0),
            unit_cost_cents: parseMoneyCents(row.unit_cost_cents),
            usage_unit_label: row.usage_unit_label || "unit",
            stock_unit_label: row.stock_unit_label || "stock unit",
            usage_units_per_stock_unit: Math.max(1, parseNumber(row.usage_units_per_stock_unit, 1))
          };
        })
      : [];

    const resourceMap = new Map();
    [...catalogResources, ...inventoryOnlyResources].forEach((item) => {
      const key = `${item.item_kind}::${item.source_key}`;
      if (!resourceMap.has(key)) resourceMap.set(key, item);
    });

    const resources = Array.from(resourceMap.values());

    const links = productId
      ? normalizeResults(
          await db.prepare(`
            SELECT
              product_resource_link_id,
              product_id,
              resource_kind,
              source_key,
              quantity_used,
              usage_notes,
              sort_order,
              ${linkColumns.has("consumption_mode") ? "COALESCE(consumption_mode, 'per_unit')" : "'per_unit'"} AS consumption_mode,
              ${linkColumns.has("lot_size_units") ? "COALESCE(lot_size_units, 1)" : "1"} AS lot_size_units
            FROM product_resource_links
            WHERE product_id = ?
            ORDER BY sort_order ASC, product_resource_link_id ASC
          `).bind(productId).all()
        )
      : [];

    const hydratedLinks = links.map((row) => {
      const resource = resources.find(
        (item) =>
          item.item_kind === (row.resource_kind || "") &&
          item.source_key === (row.source_key || "")
      );

      const shaped = {
        product_resource_link_id: Number(row.product_resource_link_id || 0),
        product_id: Number(row.product_id || 0),
        resource_kind: row.resource_kind || "",
        source_key: row.source_key || "",
        quantity_used: Math.max(0, parseNumber(row.quantity_used, 0)),
        usage_notes: row.usage_notes || "",
        sort_order: Number(row.sort_order || 0),
        consumption_mode: normalizeConsumptionMode(row.consumption_mode),
        lot_size_units: Math.max(1, parseNumber(row.lot_size_units, 1))
      };

      return {
        ...shaped,
        preview: buildResourcePreview(resource || {}, shaped)
      };
    });

    return json({
      ok: true,
      products,
      resources: resources.map((resource) => ({
        ...resource,
        preview: buildResourcePreview(resource, null)
      })),
      links: hydratedLinks
    });
  } catch (error) {
    return json({
      ok: false,
      error: error?.message || "Failed to load product tools and supplies."
    }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  if (!db) {
    return json({ ok: false, error: "Database binding is not configured." }, 500);
  }

  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  try {
    const productId = Number(body.product_id || 0);
    const links = Array.isArray(body.links) ? body.links : [];
    const linkColumns = await getTableColumnSet(db, "product_resource_links");
    const supportsConsumptionMode = linkColumns.has("consumption_mode");
    const supportsLotSizeUnits = linkColumns.has("lot_size_units");

    if (!productId) {
      return json({ ok: false, error: "product_id is required." }, 400);
    }

    const product = await db
      .prepare(`SELECT product_id FROM products WHERE product_id = ? LIMIT 1`)
      .bind(productId)
      .first();

    if (!product) {
      return json({ ok: false, error: "Product not found." }, 404);
    }

    await db.prepare(`DELETE FROM product_resource_links WHERE product_id = ?`).bind(productId).run();

    let saved = 0;
    for (let i = 0; i < links.length; i += 1) {
      const row = links[i] || {};
      const resourceKind = normalizeText(row.resource_kind).toLowerCase();
      const sourceKey = normalizeText(row.source_key);

      if (!["tool", "supply"].includes(resourceKind) || !sourceKey) continue;

      const insertColumns = [
        "product_id",
        "resource_kind",
        "source_key",
        "quantity_used",
        "usage_notes",
        "sort_order",
        "created_at",
        "updated_at"
      ];
      const insertValues = ["?", "?", "?", "?", "?", "?", "CURRENT_TIMESTAMP", "CURRENT_TIMESTAMP"];
      const insertBindings = [
        productId,
        resourceKind,
        sourceKey,
        Math.max(0, parseNumber(row.quantity_used, 0)),
        normalizeText(row.usage_notes) || null,
        Number(row.sort_order ?? i)
      ];

      if (supportsConsumptionMode) {
        insertColumns.splice(4, 0, "consumption_mode");
        insertValues.splice(4, 0, "?");
        insertBindings.splice(4, 0, normalizeConsumptionMode(row.consumption_mode));
      }

      if (supportsLotSizeUnits) {
        const lotSizeValue = Math.max(1, parseNumber(row.lot_size_units, 1));
        const targetIndex = supportsConsumptionMode ? 5 : 4;
        insertColumns.splice(targetIndex, 0, "lot_size_units");
        insertValues.splice(targetIndex, 0, "?");
        insertBindings.splice(targetIndex, 0, lotSizeValue);
      }

      await db.prepare(`
        INSERT INTO product_resource_links (
          ${insertColumns.join(", ")}
        ) VALUES (${insertValues.join(", ")})
      `).bind(...insertBindings).run();

      saved += 1;
    }

    return json({ ok: true, saved_links: saved });
  } catch (error) {
    return json({
      ok: false,
      error: error?.message || "Failed to save product links."
    }, 500);
  }
}
