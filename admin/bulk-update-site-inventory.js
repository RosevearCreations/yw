// File: /functions/api/admin/bulk-update-site-inventory.js
// Brief description: Applies bulk unit-cost updates for tools, supplies, products,
// and other site inventory items with preview support, audit logging, and movement notes.

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

function normalizeScope(value, fallback = "ids") {
  const scope = normalizeText(value).toLowerCase();
  return ["ids", "category", "source_type", "all"].includes(scope) ? scope : fallback;
}

function normalizeCostAction(value) {
  const action = normalizeText(value).toLowerCase();
  return [
    "set_cost_cents",
    "increase_percent",
    "decrease_percent",
    "increase_cents",
    "decrease_cents"
  ].includes(action) ? action : "";
}

function buildSelection(body = {}) {
  const inventoryIds = parseIds(body.inventory_ids);
  const requestedScope = normalizeScope(body.selection_scope, inventoryIds.length ? "ids" : "all");
  const category = normalizeText(body.category);
  const sourceType = normalizeText(body.source_type).toLowerCase();

  if (requestedScope === "ids") {
    if (!inventoryIds.length) {
      return { error: "At least one valid site_item_inventory_id is required when updating selected items." };
    }
    return {
      scope: "ids",
      label: `${inventoryIds.length} selected inventory item${inventoryIds.length === 1 ? "" : "s"}`,
      whereSql: `site_item_inventory_id IN (${inventoryIds.map(() => "?").join(", ")})`,
      whereBindings: inventoryIds,
      selectionDetails: { inventory_ids: inventoryIds }
    };
  }

  if (requestedScope === "category") {
    if (!category) {
      return { error: "A category is required when updating inventory by category." };
    }
    return {
      scope: "category",
      label: `category \"${category}\"`,
      whereSql: "LOWER(TRIM(COALESCE(category, ''))) = LOWER(TRIM(?))",
      whereBindings: [category],
      selectionDetails: { category }
    };
  }

  if (requestedScope === "source_type") {
    if (!sourceType) {
      return { error: "A source_type is required when updating inventory by source type." };
    }
    return {
      scope: "source_type",
      label: `source type \"${sourceType}\"`,
      whereSql: "LOWER(TRIM(COALESCE(source_type, ''))) = LOWER(TRIM(?))",
      whereBindings: [sourceType],
      selectionDetails: { source_type: sourceType }
    };
  }

  return {
    scope: "all",
    label: "all inventory items",
    whereSql: "1=1",
    whereBindings: [],
    selectionDetails: { scope: "all" }
  };
}

function buildCostChange(updates = {}) {
  const action = normalizeCostAction(updates.cost_action);
  if (!action) {
    return { error: "A valid cost_action is required." };
  }

  const rawValue = updates.cost_value;
  const valueNumber = toNumber(rawValue);
  if (valueNumber == null || valueNumber < 0) {
    return { error: "cost_value must be a valid positive number." };
  }

  const setParts = [];
  const bindings = [];
  let description = "";
  let calculator = null;

  if (action === "set_cost_cents") {
    const cents = toInteger(rawValue);
    if (cents == null || cents < 0) {
      return { error: "cost_value must be a whole number of cents for exact unit cost updates." };
    }
    setParts.push("unit_cost_cents = ?");
    bindings.push(cents);
    description = `Set unit cost to ${cents} cents`;
    calculator = () => Math.max(0, cents);
    return { setParts, bindings, description, calculator };
  }

  if (valueNumber <= 0) {
    return { error: "cost_value must be greater than zero for cost adjustments." };
  }

  if (action === "increase_percent") {
    if (valueNumber > 500) return { error: "Percent increases above 500 are blocked for safety." };
    setParts.push("unit_cost_cents = CAST(ROUND(unit_cost_cents * (1 + (? / 100.0)), 0) AS INTEGER)");
    bindings.push(valueNumber);
    description = `Increase unit cost by ${valueNumber}%`;
    calculator = (current) => Math.max(0, Math.round(Number(current || 0) * (1 + (valueNumber / 100))));
  } else if (action === "decrease_percent") {
    if (valueNumber > 100) return { error: "Percent decreases cannot exceed 100." };
    setParts.push("unit_cost_cents = MAX(0, CAST(ROUND(unit_cost_cents * (1 - (? / 100.0)), 0) AS INTEGER))");
    bindings.push(valueNumber);
    description = `Decrease unit cost by ${valueNumber}%`;
    calculator = (current) => Math.max(0, Math.round(Number(current || 0) * (1 - (valueNumber / 100))));
  } else if (action === "increase_cents") {
    const cents = Math.round(valueNumber);
    setParts.push("unit_cost_cents = unit_cost_cents + ?");
    bindings.push(cents);
    description = `Increase unit cost by ${cents} cents`;
    calculator = (current) => Math.max(0, Number(current || 0) + cents);
  } else if (action === "decrease_cents") {
    const cents = Math.round(valueNumber);
    setParts.push("unit_cost_cents = MAX(0, unit_cost_cents - ?)");
    bindings.push(cents);
    description = `Decrease unit cost by ${cents} cents`;
    calculator = (current) => Math.max(0, Number(current || 0) - cents);
  }

  return { setParts, bindings, description, calculator };
}

function summarizeRequestedChanges(selectionLabel = "", updates = {}, note = "") {
  const pieces = [];
  if (selectionLabel) pieces.push(`Scope: ${selectionLabel}`);
  if (normalizeCostAction(updates.cost_action)) {
    pieces.push(`Cost action → ${normalizeCostAction(updates.cost_action)} (${updates.cost_value})`);
  }
  if (note) pieces.push(`Reason → ${note}`);
  return pieces;
}

async function countMatchingItems(db, selection) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS matched_count
    FROM site_item_inventory
    WHERE ${selection.whereSql}
  `).bind(...selection.whereBindings).first();
  return Number(row?.matched_count || 0);
}

async function fetchMatchingItems(db, selection, limit = 12) {
  const sql = `
    SELECT site_item_inventory_id, item_name, source_type, category, supplier_name, unit_cost_cents
    FROM site_item_inventory
    WHERE ${selection.whereSql}
    ORDER BY LOWER(COALESCE(item_name, '')) ASC, site_item_inventory_id ASC
    LIMIT ${Math.max(1, Math.min(limit, 50))}
  `;
  const result = await db.prepare(sql).bind(...selection.whereBindings).all();
  return Array.isArray(result?.results) ? result.results : [];
}

async function fetchAllMatchingItems(db, selection) {
  const result = await db.prepare(`
    SELECT site_item_inventory_id, item_name, source_type, external_key, category, unit_cost_cents,
           on_hand_quantity, reserved_quantity, incoming_quantity
    FROM site_item_inventory
    WHERE ${selection.whereSql}
    ORDER BY site_item_inventory_id ASC
  `).bind(...selection.whereBindings).all();
  return Array.isArray(result?.results) ? result.results : [];
}

async function logCostUpdateMovements(db, rows = [], adminUser, note = "", calculator = null) {
  if (!rows.length || typeof calculator !== "function") return;
  const baseNote = normalizeText(note);
  for (const row of rows) {
    const previousCost = Number(row.unit_cost_cents || 0);
    const nextCost = Math.max(0, Number(calculator(previousCost) || 0));
    const movementNote = [
      `Unit cost ${previousCost} → ${nextCost} cents`,
      baseNote
    ].filter(Boolean).join(" | ");

    await db.prepare(`
      INSERT INTO site_inventory_movements (
        site_item_inventory_id, source_type, external_key, item_name, movement_type,
        quantity_delta, previous_on_hand_quantity, new_on_hand_quantity,
        previous_reserved_quantity, new_reserved_quantity,
        previous_incoming_quantity, new_incoming_quantity,
        note, actor_user_id, created_at
      ) VALUES (?, ?, ?, ?, 'cost_update', 0, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      Number(row.site_item_inventory_id || 0),
      row.source_type || null,
      row.external_key || null,
      row.item_name || null,
      Number(row.on_hand_quantity || 0),
      Number(row.on_hand_quantity || 0),
      Number(row.reserved_quantity || 0),
      Number(row.reserved_quantity || 0),
      Number(row.incoming_quantity || 0),
      Number(row.incoming_quantity || 0),
      movementNote || null,
      adminUser?.user_id || null
    ).run().catch(() => null);
  }
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

  const costChange = buildCostChange(updates || {});
  if (costChange.error) return json({ ok: false, error: costChange.error }, 400);

  const reasonNote = normalizeText(body.reason_note || body.note);

  let matchedCount = 0;
  let previewRows = [];
  try {
    matchedCount = await countMatchingItems(db, selection);
    previewRows = await fetchMatchingItems(db, selection, 10);
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: "admin_bulk_site_inventory",
      incident_code: "selection_preview_failed",
      severity: "warning",
      related_user_id: adminUser.user_id,
      message: "Could not preview matched inventory items before bulk cost update.",
      details: { error: String(error?.message || error || "Unknown error"), selection }
    });
    return json({ ok: false, error: "Could not preview the selected inventory items." }, 500);
  }

  if (!matchedCount) {
    return json({
      ok: false,
      error: "No matching inventory items were found for this bulk cost update.",
      selection: { scope: selection.scope, label: selection.label }
    }, 404);
  }

  const preview = Number(body.preview || 0) === 1 || body.preview === true;
  const previewItems = previewRows.map((row) => ({
    site_item_inventory_id: Number(row.site_item_inventory_id || 0),
    item_name: row.item_name || "",
    source_type: row.source_type || "",
    category: row.category || "",
    supplier_name: row.supplier_name || "",
    current_unit_cost_cents: Number(row.unit_cost_cents || 0),
    preview_unit_cost_cents: costChange.calculator ? costChange.calculator(Number(row.unit_cost_cents || 0)) : Number(row.unit_cost_cents || 0)
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
      requested_changes: summarizeRequestedChanges(selection.label, updates, reasonNote),
      preview_items: previewItems
    });
  }

  try {
    const affectedRows = await fetchAllMatchingItems(db, selection);
    const sql = `UPDATE site_item_inventory SET ${[...costChange.setParts, "updated_at = CURRENT_TIMESTAMP"].join(", ")} WHERE ${selection.whereSql}`;
    await db.prepare(sql).bind(...costChange.bindings, ...selection.whereBindings).run();
    await logCostUpdateMovements(db, affectedRows, adminUser, reasonNote, costChange.calculator);

    await auditAdminAction(env, request, adminUser, {
      action_type: "bulk_inventory_cost_update",
      target_type: selection.scope === "ids" ? "inventory_selection" : "inventory_scope",
      target_key: selection.scope === "category"
        ? normalizeText(selection.selectionDetails.category)
        : (selection.scope === "source_type" ? normalizeText(selection.selectionDetails.source_type) : selection.scope),
      details: {
        matched_count: matchedCount,
        selection,
        requested_changes: summarizeRequestedChanges(selection.label, updates, reasonNote)
      }
    });

    return json({
      ok: true,
      message: "Bulk inventory cost update completed.",
      matched_count: matchedCount,
      updated_count: matchedCount,
      selection: {
        scope: selection.scope,
        label: selection.label,
        ...selection.selectionDetails
      },
      requested_changes: summarizeRequestedChanges(selection.label, updates, reasonNote),
      preview_items: previewItems,
      updated_by: adminUser
    });
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: "admin_bulk_site_inventory",
      incident_code: "bulk_update_failed",
      severity: "error",
      related_user_id: adminUser.user_id,
      message: "Bulk inventory cost update failed.",
      details: {
        error: String(error?.message || error || "Unknown error"),
        selection,
        requested_changes: summarizeRequestedChanges(selection.label, updates, reasonNote)
      }
    });
    return json({ ok: false, error: "Bulk inventory cost update failed." }, 500);
  }
}
