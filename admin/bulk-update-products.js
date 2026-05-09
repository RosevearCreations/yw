// File: /functions/api/admin/bulk-update-products.js
// Brief description: Applies bulk product updates for admin workflow cleanup. It supports
// bulk status changes, inventory updates, shipping/tax flags, and price adjustments by
// selected items, by category, or across the full product catalog.

import {
  getAdminUserFromRequest,
  getDb,
  jsonResponse,
  normalizeText,
  auditAdminAction,
  captureRuntimeIncident
} from "../_lib/adminAudit.js";

function json(data, status = 200) {
  return jsonResponse(data, status);
}

function normalizeStatus(value) {
  const status = normalizeText(value).toLowerCase();
  return ["draft", "active", "archived"].includes(status) ? status : "";
}

function normalizeScope(value, fallback = "ids") {
  const scope = normalizeText(value).toLowerCase();
  return ["ids", "category", "all"].includes(scope) ? scope : fallback;
}

function toInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseIds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function normalizePriceAction(value) {
  const action = normalizeText(value).toLowerCase();
  return [
    "set_price_cents",
    "increase_percent",
    "decrease_percent",
    "increase_cents",
    "decrease_cents"
  ].includes(action) ? action : "";
}

function normalizeCompareAtStrategy(value) {
  const strategy = normalizeText(value).toLowerCase();
  return ["", "no_change", "set_previous_price", "clear"].includes(strategy) ? (strategy || "no_change") : "";
}

function buildSelection(body = {}) {
  const productIds = parseIds(body.product_ids);
  const requestedScope = normalizeScope(body.selection_scope, productIds.length ? "ids" : "all");
  const productCategory = normalizeText(body.product_category || body.category);

  if (requestedScope === "ids") {
    if (!productIds.length) {
      return { error: "At least one valid product_id is required when updating selected items." };
    }
    return {
      scope: "ids",
      label: `${productIds.length} selected product${productIds.length === 1 ? "" : "s"}`,
      whereSql: `product_id IN (${productIds.map(() => "?").join(", ")})`,
      whereBindings: productIds,
      selectionDetails: { product_ids: productIds }
    };
  }

  if (requestedScope === "category") {
    if (!productCategory) {
      return { error: "A product category is required when updating by category." };
    }
    return {
      scope: "category",
      label: `category "${productCategory}"`,
      whereSql: "LOWER(TRIM(COALESCE(product_category, ''))) = LOWER(TRIM(?))",
      whereBindings: [productCategory],
      selectionDetails: { product_category: productCategory }
    };
  }

  return {
    scope: "all",
    label: "all products",
    whereSql: "1=1",
    whereBindings: [],
    selectionDetails: { scope: "all" }
  };
}

function buildPriceChange(updates = {}) {
  const priceAction = normalizePriceAction(updates.price_action);
  if (!priceAction) {
    return { setParts: [], bindings: [], description: null, sampleCalculator: null };
  }

  const compareAtStrategy = normalizeCompareAtStrategy(updates.compare_at_strategy);
  if (!compareAtStrategy) {
    return { error: "Invalid compare-at strategy." };
  }

  const rawValue = updates.price_value;
  const valueNumber = toNumber(rawValue);
  const setParts = [];
  const bindings = [];
  let description = "";
  let sampleCalculator = null;

  if (priceAction === "set_price_cents") {
    const cents = toInteger(rawValue);
    if (cents == null || cents < 0) {
      return { error: "price_value must be a whole number of cents for exact price updates." };
    }
    if (compareAtStrategy === "set_previous_price") {
      setParts.push("compare_at_price_cents = price_cents");
    } else if (compareAtStrategy === "clear") {
      setParts.push("compare_at_price_cents = NULL");
    }
    setParts.push("price_cents = ?");
    bindings.push(cents);
    description = `Set price to ${cents} cents`;
    sampleCalculator = () => Math.max(0, cents);
    return { setParts, bindings, description, sampleCalculator };
  }

  if (valueNumber == null || valueNumber <= 0) {
    return { error: "price_value must be greater than zero for price adjustments." };
  }

  if (compareAtStrategy === "set_previous_price") {
    setParts.push("compare_at_price_cents = price_cents");
  } else if (compareAtStrategy === "clear") {
    setParts.push("compare_at_price_cents = NULL");
  }

  if (priceAction === "increase_percent") {
    if (valueNumber > 500) return { error: "Percent increases above 500 are blocked for safety." };
    setParts.push("price_cents = CAST(ROUND(price_cents * (1 + (? / 100.0)), 0) AS INTEGER)");
    bindings.push(valueNumber);
    description = `Increase price by ${valueNumber}%`;
    sampleCalculator = (current) => Math.max(0, Math.round(Number(current || 0) * (1 + (valueNumber / 100))));
  } else if (priceAction === "decrease_percent") {
    if (valueNumber > 100) return { error: "Percent decreases cannot exceed 100." };
    setParts.push("price_cents = MAX(0, CAST(ROUND(price_cents * (1 - (? / 100.0)), 0) AS INTEGER))");
    bindings.push(valueNumber);
    description = `Decrease price by ${valueNumber}%`;
    sampleCalculator = (current) => Math.max(0, Math.round(Number(current || 0) * (1 - (valueNumber / 100))));
  } else if (priceAction === "increase_cents") {
    const cents = Math.round(valueNumber);
    setParts.push("price_cents = price_cents + ?");
    bindings.push(cents);
    description = `Increase price by ${cents} cents`;
    sampleCalculator = (current) => Math.max(0, Number(current || 0) + cents);
  } else if (priceAction === "decrease_cents") {
    const cents = Math.round(valueNumber);
    setParts.push("price_cents = MAX(0, price_cents - ?)");
    bindings.push(cents);
    description = `Decrease price by ${cents} cents`;
    sampleCalculator = (current) => Math.max(0, Number(current || 0) - cents);
  }

  return { setParts, bindings, description, sampleCalculator };
}

function summarizeRequestedChanges(updates = {}, selectionLabel = "") {
  const pieces = [];
  if (selectionLabel) pieces.push(`Scope: ${selectionLabel}`);
  if (updates.status !== undefined) pieces.push(`Status → ${normalizeText(updates.status) || "unchanged"}`);
  if (updates.inventory_quantity !== undefined) pieces.push(`Inventory quantity → ${updates.inventory_quantity}`);
  if (updates.inventory_tracking !== undefined) pieces.push(`Inventory tracking → ${Number(updates.inventory_tracking) === 1 ? "on" : "off"}`);
  if (updates.requires_shipping !== undefined) pieces.push(`Requires shipping → ${Number(updates.requires_shipping) === 1 ? "yes" : "no"}`);
  if (updates.taxable !== undefined) pieces.push(`Taxable → ${Number(updates.taxable) === 0 ? "no" : "yes"}`);
  if (updates.tax_class_id !== undefined) pieces.push(`Tax class → ${updates.tax_class_id === null ? "cleared" : updates.tax_class_id}`);
  if (normalizePriceAction(updates.price_action)) {
    pieces.push(`Price action → ${normalizePriceAction(updates.price_action)} (${updates.price_value})`);
    pieces.push(`Compare-at → ${normalizeCompareAtStrategy(updates.compare_at_strategy) || "no_change"}`);
  }
  return pieces;
}

async function fetchMatchingProducts(db, selection, limit = 12) {
  const sql = `
    SELECT product_id, name, slug, sku, product_category, status, currency, price_cents, compare_at_price_cents
    FROM products
    WHERE ${selection.whereSql}
    ORDER BY sort_order ASC, created_at DESC, product_id DESC
    LIMIT ${Math.max(1, Math.min(limit, 50))}
  `;
  const result = await db.prepare(sql).bind(...selection.whereBindings).all();
  return Array.isArray(result?.results) ? result.results : [];
}

async function countMatchingProducts(db, selection) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS matched_count
    FROM products
    WHERE ${selection.whereSql}
  `).bind(...selection.whereBindings).first();
  return Number(row?.matched_count || 0);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "Database binding is not configured." }, 500);

  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const updates = body && typeof body.updates === "object" ? body.updates : {};
  const selection = buildSelection(body || {});
  if (selection.error) return json({ ok: false, error: selection.error }, 400);

  const setParts = [];
  const bindings = [];

  if (updates.status !== undefined) {
    const status = normalizeStatus(updates.status);
    if (!status) return json({ ok: false, error: "Invalid bulk status." }, 400);
    setParts.push("status = ?");
    bindings.push(status);
  }

  if (updates.inventory_quantity !== undefined) {
    const inventory = toInteger(updates.inventory_quantity);
    if (inventory == null || inventory < 0) {
      return json({ ok: false, error: "inventory_quantity must be a whole number." }, 400);
    }
    setParts.push("inventory_quantity = ?");
    bindings.push(inventory);
  }

  if (updates.inventory_tracking !== undefined) {
    setParts.push("inventory_tracking = ?");
    bindings.push(Number(updates.inventory_tracking) === 1 ? 1 : 0);
  }

  if (updates.requires_shipping !== undefined) {
    setParts.push("requires_shipping = ?");
    bindings.push(Number(updates.requires_shipping) === 1 ? 1 : 0);
  }

  if (updates.taxable !== undefined) {
    setParts.push("taxable = ?");
    bindings.push(Number(updates.taxable) === 0 ? 0 : 1);
  }

  if (updates.tax_class_id !== undefined) {
    const rawTaxClassId = normalizeText(updates.tax_class_id);
    const taxClassId = rawTaxClassId ? Number(rawTaxClassId) : null;
    if (rawTaxClassId && !Number.isInteger(taxClassId)) {
      return json({ ok: false, error: "tax_class_id must be a whole number when provided." }, 400);
    }
    setParts.push("tax_class_id = ?");
    bindings.push(taxClassId);
  }

  const priceChange = buildPriceChange(updates);
  if (priceChange.error) {
    return json({ ok: false, error: priceChange.error }, 400);
  }
  setParts.push(...priceChange.setParts);
  bindings.push(...priceChange.bindings);

  if (!setParts.length) {
    return json({ ok: false, error: "No valid bulk updates were provided." }, 400);
  }

  let matchedCount = 0;
  let previewRows = [];
  try {
    matchedCount = await countMatchingProducts(db, selection);
    previewRows = await fetchMatchingProducts(db, selection, 10);
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: "admin_bulk_products",
      incident_code: "selection_preview_failed",
      severity: "warning",
      related_user_id: adminUser.user_id,
      message: "Could not preview matched products before bulk update.",
      details: { error: String(error?.message || error || "Unknown error"), selection }
    });
    return json({ ok: false, error: "Could not preview the selected products." }, 500);
  }

  if (!matchedCount) {
    return json({
      ok: false,
      error: "No matching products were found for this bulk update.",
      selection: { scope: selection.scope, label: selection.label }
    }, 404);
  }

  const preview = Number(body.preview || 0) === 1 || body.preview === true;
  const previewProducts = previewRows.map((row) => ({
    product_id: Number(row.product_id || 0),
    name: row.name || "",
    slug: row.slug || "",
    sku: row.sku || "",
    product_category: row.product_category || "",
    status: row.status || "",
    currency: row.currency || "CAD",
    current_price_cents: Number(row.price_cents || 0),
    current_compare_at_price_cents: row.compare_at_price_cents == null ? null : Number(row.compare_at_price_cents || 0),
    preview_price_cents: priceChange.sampleCalculator ? priceChange.sampleCalculator(Number(row.price_cents || 0)) : Number(row.price_cents || 0)
  }));

  if (preview) {
    return json({
      ok: true,
      preview: true,
      matched_count: matchedCount,
      selection: {
        scope: selection.scope,
        label: selection.label,
        ...selection.selectionDetails
      },
      requested_changes: summarizeRequestedChanges(updates, selection.label),
      preview_products: previewProducts
    });
  }

  try {
    const sql = `UPDATE products SET ${[...setParts, "updated_at = CURRENT_TIMESTAMP"].join(", ")} WHERE ${selection.whereSql}`;
    await db.prepare(sql).bind(...bindings, ...selection.whereBindings).run();

    await auditAdminAction(env, request, adminUser, {
      action_type: "bulk_product_update",
      target_type: selection.scope === "ids" ? "product_selection" : "product_scope",
      target_key: selection.scope === "category" ? normalizeText(selection.selectionDetails.product_category) : selection.scope,
      details: {
        matched_count: matchedCount,
        selection,
        requested_changes: summarizeRequestedChanges(updates, selection.label)
      }
    });

    return json({
      ok: true,
      message: "Bulk product update completed.",
      matched_count: matchedCount,
      updated_count: matchedCount,
      selection: {
        scope: selection.scope,
        label: selection.label,
        ...selection.selectionDetails
      },
      requested_changes: summarizeRequestedChanges(updates, selection.label),
      preview_products: previewProducts,
      updated_by: adminUser
    });
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: "admin_bulk_products",
      incident_code: "bulk_update_failed",
      severity: "error",
      related_user_id: adminUser.user_id,
      message: "Bulk product update failed.",
      details: {
        error: String(error?.message || error || "Unknown error"),
        selection,
        requested_changes: summarizeRequestedChanges(updates, selection.label)
      }
    });
    return json({ ok: false, error: "Bulk product update failed." }, 500);
  }
}
