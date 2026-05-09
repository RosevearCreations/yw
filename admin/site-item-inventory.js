// File: /functions/api/admin/site-item-inventory.js
import { auditAdminAction, getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

function json(data, status = 200) { return jsonResponse(data, status); }
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }
async function getTableColumnSet(db, tableName) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    return new Set(rows.map((row) => String(row?.name || '').trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}
async function ensureUsageColumns(db) {
  const cols = await getTableColumnSet(db, 'site_item_inventory');
  if (!cols.has('stock_unit_label')) {
    await db.prepare(`ALTER TABLE site_item_inventory ADD COLUMN stock_unit_label TEXT NOT NULL DEFAULT 'unit'`).run().catch(() => null);
  }
  if (!cols.has('usage_unit_label')) {
    await db.prepare(`ALTER TABLE site_item_inventory ADD COLUMN usage_unit_label TEXT NOT NULL DEFAULT 'unit'`).run().catch(() => null);
  }
  if (!cols.has('usage_units_per_stock_unit')) {
    await db.prepare(`ALTER TABLE site_item_inventory ADD COLUMN usage_units_per_stock_unit REAL NOT NULL DEFAULT 1`).run().catch(() => null);
  }
}

function shape(row = {}) {
  const onHand = Number(row.on_hand_quantity || 0);
  const reserved = Number(row.reserved_quantity || 0);
  const incoming = Number(row.incoming_quantity || 0);
  const reorder = Number(row.reorder_level || 0);

  return {
    site_item_inventory_id: Number(row.site_item_inventory_id || 0),
    source_type: row.source_type || '',
    external_key: row.external_key || '',
    item_name: row.item_name || '',
    category: row.category || '',
    source_url: row.source_url || '',
    amazon_url: row.amazon_url || '',
    image_url: row.image_url || '',
    on_hand_quantity: onHand,
    reserved_quantity: reserved,
    incoming_quantity: incoming,
    available_quantity: Math.max(0, onHand - reserved),
    reorder_level: reorder,
    unit_cost_cents: Number(row.unit_cost_cents || 0),
    stock_unit_label: row.stock_unit_label || 'unit',
    usage_unit_label: row.usage_unit_label || 'unit',
    usage_units_per_stock_unit: Math.max(1, Number(row.usage_units_per_stock_unit || 1) || 1),
    supplier_name: row.supplier_name || '',
    supplier_sku: row.supplier_sku || '',
    supplier_contact: row.supplier_contact || '',
    reorder_notes: row.reorder_notes || '',
    preferred_reorder_quantity: Number(row.preferred_reorder_quantity || 0),
    is_on_reorder_list: Number(row.is_on_reorder_list || 0),
    do_not_reorder: Number(row.do_not_reorder || 0),
    do_not_reuse: Number(row.do_not_reuse || 0),
    reuse_status: row.reuse_status || '',
    reservation_notes: row.reservation_notes || '',
    last_reorder_requested_at: row.last_reorder_requested_at || null,
    last_counted_at: row.last_counted_at || null,
    needs_reorder: reorder > 0 && (onHand + incoming) <= reorder ? 1 : 0,
    is_active: Number(row.is_active || 0),
    linked_product_count: Number(row.linked_product_count || 0),
    linked_product_names: row.linked_product_names || '',
    updated_at: row.updated_at || null
  };
}

async function logMovement(db, payload = {}) {
  await db.prepare(`
    INSERT INTO site_inventory_movements (
      site_item_inventory_id, source_type, external_key, item_name, movement_type,
      quantity_delta, previous_on_hand_quantity, new_on_hand_quantity,
      previous_reserved_quantity, new_reserved_quantity,
      previous_incoming_quantity, new_incoming_quantity,
      note, actor_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    payload.site_item_inventory_id || null,
    payload.source_type || null,
    payload.external_key || null,
    payload.item_name || null,
    payload.movement_type || 'adjustment',
    Number(payload.quantity_delta || 0),
    Number(payload.previous_on_hand_quantity || 0),
    Number(payload.new_on_hand_quantity || 0),
    Number(payload.previous_reserved_quantity || 0),
    Number(payload.new_reserved_quantity || 0),
    Number(payload.previous_incoming_quantity || 0),
    Number(payload.new_incoming_quantity || 0),
    payload.note || null,
    payload.actor_user_id || null
  ).run().catch(() => null);
}

async function getItems(db, { q = '', stockView = '', includeHistory = false } = {}) {
  const like = `%${q}%`;

  const items = normalizeResults(await db.prepare(`
    SELECT
      sii.*,
      COUNT(DISTINCT prl.product_id) AS linked_product_count,
      GROUP_CONCAT(DISTINCT p.name) AS linked_product_names
    FROM site_item_inventory sii
    LEFT JOIN product_resource_links prl
      ON prl.resource_kind = sii.source_type
     AND prl.source_key = sii.external_key
    LEFT JOIN products p
      ON p.product_id = prl.product_id
    WHERE (
      ? = ''
      OR LOWER(COALESCE(sii.item_name, '')) LIKE ?
      OR LOWER(COALESCE(sii.category, '')) LIKE ?
      OR LOWER(COALESCE(sii.supplier_name, '')) LIKE ?
      OR LOWER(COALESCE(sii.supplier_sku, '')) LIKE ?
    )
    AND (
      ? = ''
      OR (? = 'low' AND (COALESCE(sii.on_hand_quantity, 0) + COALESCE(sii.incoming_quantity, 0)) <= COALESCE(sii.reorder_level, 0))
      OR (? = 'reorder' AND COALESCE(sii.is_on_reorder_list, 0) = 1)
      OR (? = 'no_reuse' AND COALESCE(sii.do_not_reuse, 0) = 1)
      OR (? = 'inactive' AND COALESCE(sii.is_active, 1) = 0)
    )
    GROUP BY sii.site_item_inventory_id
    ORDER BY LOWER(COALESCE(sii.item_name, '')) ASC
  `).bind(q, like, like, like, like, stockView, stockView, stockView, stockView, stockView).all().catch(() => ({ results: [] })));

  const summary = {
    total_items: items.length,
    active_items: items.filter((row) => Number(row.is_active || 1) === 1).length,
    low_stock_items: items.filter((row) => (Number(row.on_hand_quantity || 0) + Number(row.incoming_quantity || 0)) <= Number(row.reorder_level || 0)).length,
    total_reserved: items.reduce((sum, row) => sum + Number(row.reserved_quantity || 0), 0),
    total_incoming: items.reduce((sum, row) => sum + Number(row.incoming_quantity || 0), 0),
    reorder_list_items: items.filter((row) => Number(row.is_on_reorder_list || 0) === 1).length
  };

  const movements = includeHistory
    ? normalizeResults(await db.prepare(`
        SELECT
          site_inventory_movement_id,
          site_item_inventory_id,
          source_type,
          external_key,
          item_name,
          movement_type,
          quantity_delta,
          previous_on_hand_quantity,
          new_on_hand_quantity,
          previous_reserved_quantity,
          new_reserved_quantity,
          previous_incoming_quantity,
          new_incoming_quantity,
          note,
          created_at
        FROM site_inventory_movements
        ORDER BY created_at DESC, site_inventory_movement_id DESC
        LIMIT 50
      `).all().catch(() => ({ results: [] })))
    : [];

  const supplier_reorder_groups = items
    .filter((row) => Number(row.do_not_reorder || 0) !== 1)
    .filter((row) =>
      Number(row.is_on_reorder_list || 0) === 1 ||
      ((Number(row.on_hand_quantity || 0) + Number(row.incoming_quantity || 0)) <= Number(row.reorder_level || 0))
    )
    .reduce((acc, row) => {
      const key = normalizeText(row.supplier_name) || 'Unassigned Supplier';
      if (!acc[key]) {
        acc[key] = {
          supplier_name: key,
          supplier_contact: row.supplier_contact || '',
          item_count: 0,
          estimated_total_cents: 0,
          items: []
        };
      }

      const suggested_quantity = Math.max(
        1,
        Number(row.preferred_reorder_quantity || 0) ||
        Math.max(1, Number(row.reorder_level || 0) - (Number(row.on_hand_quantity || 0) + Number(row.incoming_quantity || 0)))
      );

      acc[key].item_count += 1;
      acc[key].estimated_total_cents += suggested_quantity * Number(row.unit_cost_cents || 0);
      acc[key].items.push({
        site_item_inventory_id: Number(row.site_item_inventory_id || 0),
        item_name: row.item_name || '',
        suggested_quantity,
        unit_cost_cents: Number(row.unit_cost_cents || 0)
      });

      return acc;
    }, {});

  return {
    items: items.map(shape),
    summary,
    movements,
    supplier_reorder_groups: Object.values(supplier_reorder_groups)
  };
}

async function adjustProductResourceReservations(db, { productId = 0, quantityMultiplier = 1, release = false, note = '', actorUserId = null } = {}) {
  const resourceLinkColumns = await getTableColumnSet(db, 'product_resource_links');
  const supportsConsumptionMode = resourceLinkColumns.has('consumption_mode');
  const supportsLotSizeUnits = resourceLinkColumns.has('lot_size_units');

  const inventoryColumns = await getTableColumnSet(db, 'site_item_inventory');
  const supportsUsageUnitsPerStockUnit = inventoryColumns.has('usage_units_per_stock_unit');
  const supportsUsageUnitLabel = inventoryColumns.has('usage_unit_label');

  const links = normalizeResults(await db.prepare(`
    SELECT
      prl.product_resource_link_id,
      prl.resource_kind,
      prl.source_key,
      COALESCE(prl.quantity_used, 0) AS quantity_used,
      ${supportsConsumptionMode ? `COALESCE(prl.consumption_mode, 'per_unit')` : `'per_unit' AS consumption_mode`},
      ${supportsLotSizeUnits ? `COALESCE(prl.lot_size_units, 1)` : `1 AS lot_size_units`},
      sii.site_item_inventory_id,
      sii.item_name,
      sii.source_type,
      sii.external_key,
      COALESCE(sii.on_hand_quantity, 0) AS on_hand_quantity,
      COALESCE(sii.reserved_quantity, 0) AS reserved_quantity,
      COALESCE(sii.incoming_quantity, 0) AS incoming_quantity,
      COALESCE(sii.reservation_notes, '') AS reservation_notes,
      ${supportsUsageUnitLabel ? `COALESCE(NULLIF(sii.usage_unit_label, ''), 'unit')` : `'unit' AS usage_unit_label`},
      ${supportsUsageUnitsPerStockUnit ? `COALESCE(NULLIF(sii.usage_units_per_stock_unit, 0), 1)` : `1 AS usage_units_per_stock_unit`}
    FROM product_resource_links prl
    LEFT JOIN site_item_inventory sii
      ON sii.source_type = prl.resource_kind
     AND sii.external_key = prl.source_key
    WHERE prl.product_id = ?
    ORDER BY prl.sort_order ASC, prl.product_resource_link_id ASC
  `).bind(productId).all().catch(() => ({ results: [] })));

  const results = [];

  for (const link of links) {
    const requiredQty = Math.max(0, Number(link.quantity_used || 0) * Math.max(1, Number(quantityMultiplier || 1)));
    const consumptionMode = String(link.consumption_mode || 'per_unit').toLowerCase();

    if (!link.site_item_inventory_id) {
      results.push({
        ok: false,
        missing_inventory: true,
        resource_kind: link.resource_kind,
        source_key: link.source_key,
        required_quantity: requiredQty,
        note: 'Inventory item not linked.'
      });
      continue;
    }

    if (consumptionMode === 'story_only' || consumptionMode === 'end_of_lot' || Number(link.usage_units_per_stock_unit || 1) > 1) {
      results.push({
        ok: true,
        skipped_reservation: true,
        site_item_inventory_id: Number(link.site_item_inventory_id || 0),
        source_type: link.source_type || link.resource_kind || '',
        external_key: link.external_key || link.source_key || '',
        item_name: link.item_name || '',
        required_quantity: requiredQty,
        usage_unit_label: link.usage_unit_label || 'unit',
        usage_units_per_stock_unit: Math.max(1, Number(link.usage_units_per_stock_unit || 1) || 1),
        consumption_mode: consumptionMode
      });
      continue;
    }

    const previousReserved = Number(link.reserved_quantity || 0);
    const newReserved = Math.max(0, previousReserved + (release ? -requiredQty : requiredQty));

    await db.prepare(`
      UPDATE site_item_inventory
      SET reserved_quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE site_item_inventory_id = ?
    `).bind(newReserved, Number(link.site_item_inventory_id || 0)).run();

    await logMovement(db, {
      site_item_inventory_id: Number(link.site_item_inventory_id || 0),
      source_type: link.source_type || link.resource_kind || '',
      external_key: link.external_key || link.source_key || '',
      item_name: link.item_name || '',
      movement_type: release ? 'reservation_release' : 'reservation_add',
      quantity_delta: 0,
      previous_on_hand_quantity: Number(link.on_hand_quantity || 0),
      new_on_hand_quantity: Number(link.on_hand_quantity || 0),
      previous_reserved_quantity: previousReserved,
      new_reserved_quantity: newReserved,
      previous_incoming_quantity: Number(link.incoming_quantity || 0),
      new_incoming_quantity: Number(link.incoming_quantity || 0),
      note: note || (release ? `Released reservation for product ${productId}.` : `Reserved for product ${productId}.`),
      actor_user_id: actorUserId || null
    });

    results.push({
      ok: true,
      skipped_reservation: false,
      site_item_inventory_id: Number(link.site_item_inventory_id || 0),
      source_type: link.source_type || link.resource_kind || '',
      external_key: link.external_key || link.source_key || '',
      item_name: link.item_name || '',
      required_quantity: requiredQty,
      previous_reserved_quantity: previousReserved,
      new_reserved_quantity: newReserved,
      consumption_mode: consumptionMode
    });
  }

  return results;
}


async function runInventoryItemAction(db, { siteItemInventoryId = 0, action = '', quantity = 0, note = '', actorUserId = null } = {}) {
  const id = Number(siteItemInventoryId || 0);
  const qty = Math.max(0, Number(quantity || 0));
  if (!id) throw new Error('site_item_inventory_id is required.');
  if (!qty) throw new Error('A quantity greater than zero is required.');

  const existing = await db.prepare(`SELECT * FROM site_item_inventory WHERE site_item_inventory_id = ? LIMIT 1`).bind(id).first();
  if (!existing) throw new Error('Inventory item not found.');

  const previousOnHand = Number(existing.on_hand_quantity || 0);
  const previousReserved = Number(existing.reserved_quantity || 0);
  const previousIncoming = Number(existing.incoming_quantity || 0);
  let newOnHand = previousOnHand;
  let newReserved = previousReserved;
  let newIncoming = previousIncoming;
  let movementType = action || 'adjustment';
  let quantityDelta = 0;
  let auditDetails = { quantity: qty };

  switch (String(action || '').toLowerCase()) {
    case 'receive':
      newOnHand = previousOnHand + qty;
      newIncoming = Math.max(0, previousIncoming - qty);
      movementType = 'receive';
      quantityDelta = qty;
      break;
    case 'reserve':
      newReserved = previousReserved + qty;
      movementType = 'reserve';
      quantityDelta = 0;
      break;
    case 'release':
      newReserved = Math.max(0, previousReserved - qty);
      movementType = 'release';
      quantityDelta = 0;
      break;
    case 'consume':
      newOnHand = Math.max(0, previousOnHand - qty);
      movementType = 'consume';
      quantityDelta = -qty;
      break;
    case 'reorder_request':
      newIncoming = previousIncoming + qty;
      movementType = 'reorder_request';
      quantityDelta = 0;
      auditDetails.requested_incoming_quantity = qty;
      break;
    default:
      throw new Error('Unsupported inventory action.');
  }

  await db.prepare(`
    UPDATE site_item_inventory
    SET on_hand_quantity = ?, reserved_quantity = ?, incoming_quantity = ?,
        is_on_reorder_list = CASE WHEN ? = 'reorder_request' THEN 1 ELSE is_on_reorder_list END,
        last_reorder_requested_at = CASE WHEN ? = 'reorder_request' THEN CURRENT_TIMESTAMP ELSE last_reorder_requested_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE site_item_inventory_id = ?
  `).bind(
    newOnHand,
    newReserved,
    newIncoming,
    String(action || '').toLowerCase(),
    String(action || '').toLowerCase(),
    id
  ).run();

  await logMovement(db, {
    site_item_inventory_id: id,
    source_type: existing.source_type || null,
    external_key: existing.external_key || null,
    item_name: existing.item_name || null,
    movement_type: movementType,
    quantity_delta: quantityDelta,
    previous_on_hand_quantity: previousOnHand,
    new_on_hand_quantity: newOnHand,
    previous_reserved_quantity: previousReserved,
    new_reserved_quantity: newReserved,
    previous_incoming_quantity: previousIncoming,
    new_incoming_quantity: newIncoming,
    note: note || `Inventory ${movementType}.`,
    actor_user_id: actorUserId || null
  });

  const saved = await db.prepare(`SELECT * FROM site_item_inventory WHERE site_item_inventory_id = ? LIMIT 1`).bind(id).first();
  return {
    item: shape(saved || {}),
    audit_details: {
      ...auditDetails,
      previous_on_hand_quantity: previousOnHand,
      new_on_hand_quantity: newOnHand,
      previous_reserved_quantity: previousReserved,
      new_reserved_quantity: newReserved,
      previous_incoming_quantity: previousIncoming,
      new_incoming_quantity: newIncoming
    },
    existing
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);

  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  await ensureUsageColumns(db);

  const url = new URL(request.url);
  const payload = await getItems(db, {
    q: normalizeText(url.searchParams.get('q')).toLowerCase(),
    stockView: normalizeText(url.searchParams.get('stock_view')).toLowerCase(),
    includeHistory: ['1', 'true', 'yes'].includes(String(url.searchParams.get('include_history') || '').toLowerCase())
  });

  return json({ ok: true, ...payload });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);

  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  await ensureUsageColumns(db);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const action = normalizeText(body.action).toLowerCase();

  if (action === 'reserve_product_resources') {
    const productId = Number(body.product_id || 0);
    if (!productId) return json({ ok: false, error: 'product_id is required.' }, 400);

    const results = await adjustProductResourceReservations(db, {
      productId,
      quantityMultiplier: Math.max(1, Number(body.quantity_multiplier || 1) || 1),
      release: false,
      note: normalizeText(body.note) || '',
      actorUserId: adminUser.user_id
    });

    await auditAdminAction(env, request, adminUser, {
      action_type: 'inventory_reserve_product_resources',
      target_type: 'product',
      target_id: productId,
      details: { results }
    });

    return json({ ok: true, results });
  }

  if (action === 'release_product_resources') {
    const productId = Number(body.product_id || 0);
    if (!productId) return json({ ok: false, error: 'product_id is required.' }, 400);

    const results = await adjustProductResourceReservations(db, {
      productId,
      quantityMultiplier: Math.max(1, Number(body.quantity_multiplier || 1) || 1),
      release: true,
      note: normalizeText(body.note) || '',
      actorUserId: adminUser.user_id
    });

    await auditAdminAction(env, request, adminUser, {
      action_type: 'inventory_release_product_resources',
      target_type: 'product',
      target_id: productId,
      details: { results }
    });

    return json({ ok: true, results });
  }

  if (['receive', 'reserve', 'release', 'consume', 'reorder_request'].includes(action)) {
    const siteItemInventoryId = Number(body.site_item_inventory_id || 0);
    const quantity = Math.max(0, Number(body.quantity || 0));
    const note = normalizeText(body.note) || '';
    const result = await runInventoryItemAction(db, {
      siteItemInventoryId,
      action,
      quantity,
      note,
      actorUserId: adminUser.user_id
    });

    await auditAdminAction(env, request, adminUser, {
      action_type: `inventory_${action}`,
      target_type: 'inventory_item',
      target_id: siteItemInventoryId,
      target_key: `${result.existing?.source_type || ''}:${result.existing?.external_key || ''}`,
      details: result.audit_details
    });

    return json({ ok: true, item: result.item, action, details: result.audit_details });
  }

  const sourceType = normalizeText(body.source_type).toLowerCase();
  const externalKey = normalizeText(body.external_key);
  const itemName = normalizeText(body.item_name);

  if (!sourceType || !externalKey || !itemName) {
    return json({ ok: false, error: 'source_type, external_key, and item_name are required.' }, 400);
  }

  const insert = await db.prepare(`
    INSERT INTO site_item_inventory (
      source_type, external_key, item_name, category, source_url, amazon_url, image_url,
      on_hand_quantity, reserved_quantity, incoming_quantity, reorder_level, unit_cost_cents,
      stock_unit_label, usage_unit_label, usage_units_per_stock_unit,
      supplier_name, supplier_sku, supplier_contact, reorder_notes, preferred_reorder_quantity,
      is_on_reorder_list, do_not_reorder, do_not_reuse, reuse_status, reservation_notes,
      is_active, last_counted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    sourceType,
    externalKey,
    itemName,
    normalizeText(body.category) || null,
    normalizeText(body.source_url) || null,
    normalizeText(body.amazon_url) || null,
    normalizeText(body.image_url) || null,
    Number(body.on_hand_quantity || 0),
    Number(body.reserved_quantity || 0),
    Number(body.incoming_quantity || 0),
    Number(body.reorder_level || 0),
    Number(body.unit_cost_cents || 0),
    normalizeText(body.stock_unit_label) || 'unit',
    normalizeText(body.usage_unit_label) || 'unit',
    Math.max(1, Number(body.usage_units_per_stock_unit || 1) || 1),
    normalizeText(body.supplier_name) || null,
    normalizeText(body.supplier_sku) || null,
    normalizeText(body.supplier_contact) || null,
    normalizeText(body.reorder_notes) || null,
    Number(body.preferred_reorder_quantity || 0),
    Number(body.is_on_reorder_list) === 1 ? 1 : 0,
    Number(body.do_not_reorder) === 1 ? 1 : 0,
    Number(body.do_not_reuse) === 1 ? 1 : 0,
    normalizeText(body.reuse_status) || null,
    normalizeText(body.reservation_notes) || null,
    Number(body.is_active) === 0 ? 0 : 1,
    normalizeText(body.last_counted_at) || null
  ).run();

  const newId = Number(insert?.meta?.last_row_id || 0);
  const saved = await db.prepare(`SELECT * FROM site_item_inventory WHERE site_item_inventory_id = ? LIMIT 1`).bind(newId).first();

  await logMovement(db, {
    site_item_inventory_id: newId,
    source_type: sourceType,
    external_key: externalKey,
    item_name: itemName,
    movement_type: 'create',
    quantity_delta: Number(body.on_hand_quantity || 0),
    previous_on_hand_quantity: 0,
    new_on_hand_quantity: Number(body.on_hand_quantity || 0),
    previous_reserved_quantity: 0,
    new_reserved_quantity: Number(body.reserved_quantity || 0),
    previous_incoming_quantity: 0,
    new_incoming_quantity: Number(body.incoming_quantity || 0),
    note: normalizeText(body.movement_note) || 'Inventory item created.',
    actor_user_id: adminUser.user_id
  });

  await auditAdminAction(env, request, adminUser, {
    action_type: 'inventory_create',
    target_type: 'inventory_item',
    target_id: newId,
    target_key: `${sourceType}:${externalKey}`,
    details: { item_name: itemName }
  });

  return json({ ok: true, item: shape(saved || {}) }, 201);
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);

  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  await ensureUsageColumns(db);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const id = Number(body.site_item_inventory_id || 0);
  if (!id) return json({ ok: false, error: 'site_item_inventory_id is required.' }, 400);

  try {
    const existing = await db.prepare(`
      SELECT *
      FROM site_item_inventory
      WHERE site_item_inventory_id = ?
      LIMIT 1
    `).bind(id).first();

    if (!existing) return json({ ok: false, error: 'Inventory item not found.' }, 404);

    const merged = {
      ...existing,
      ...body,
      item_name: normalizeText(body.item_name || existing.item_name),
      category: normalizeText(body.category ?? existing.category),
      source_url: normalizeText(body.source_url ?? existing.source_url),
      amazon_url: normalizeText(body.amazon_url ?? existing.amazon_url),
      image_url: normalizeText(body.image_url ?? existing.image_url),
      supplier_name: normalizeText(body.supplier_name ?? existing.supplier_name),
      supplier_sku: normalizeText(body.supplier_sku ?? existing.supplier_sku),
      supplier_contact: normalizeText(body.supplier_contact ?? existing.supplier_contact),
      reorder_notes: normalizeText(body.reorder_notes ?? existing.reorder_notes),
      reuse_status: normalizeText(body.reuse_status ?? existing.reuse_status),
      reservation_notes: normalizeText(body.reservation_notes ?? existing.reservation_notes),
      stock_unit_label: normalizeText(body.stock_unit_label ?? existing.stock_unit_label) || 'unit',
      usage_unit_label: normalizeText(body.usage_unit_label ?? existing.usage_unit_label) || 'unit',
      usage_units_per_stock_unit: Math.max(
        1,
        Number((body.usage_units_per_stock_unit ?? existing.usage_units_per_stock_unit) || 1) || 1
      )
    };

    await db.prepare(`
      UPDATE site_item_inventory
      SET item_name = ?, category = ?, source_url = ?, amazon_url = ?, image_url = ?,
          stock_unit_label = ?, usage_unit_label = ?, usage_units_per_stock_unit = ?,
          on_hand_quantity = ?, reserved_quantity = ?, incoming_quantity = ?, reorder_level = ?, unit_cost_cents = ?,
          supplier_name = ?, supplier_sku = ?, supplier_contact = ?, reorder_notes = ?,
          is_active = ?, preferred_reorder_quantity = ?, is_on_reorder_list = ?, do_not_reorder = ?,
          do_not_reuse = ?, reuse_status = ?, reservation_notes = ?, last_counted_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE site_item_inventory_id = ?
    `).bind(
      merged.item_name,
      merged.category || null,
      merged.source_url || null,
      merged.amazon_url || null,
      merged.image_url || null,
      merged.stock_unit_label || 'unit',
      merged.usage_unit_label || 'unit',
      Math.max(1, Number(merged.usage_units_per_stock_unit || 1) || 1),
      Number(merged.on_hand_quantity || 0),
      Number(merged.reserved_quantity || 0),
      Number(merged.incoming_quantity || 0),
      Number(merged.reorder_level || 0),
      Number(merged.unit_cost_cents || 0),
      merged.supplier_name || null,
      merged.supplier_sku || null,
      merged.supplier_contact || null,
      merged.reorder_notes || null,
      Number(merged.is_active) === 0 ? 0 : 1,
      Number(merged.preferred_reorder_quantity || 0),
      Number(merged.is_on_reorder_list) === 1 ? 1 : 0,
      Number(merged.do_not_reorder) === 1 ? 1 : 0,
      Number(merged.do_not_reuse) === 1 ? 1 : 0,
      merged.reuse_status || null,
      merged.reservation_notes || null,
      normalizeText(body.last_counted_at) || existing.last_counted_at || null,
      id
    ).run();

    await logMovement(db, {
      site_item_inventory_id: id,
      source_type: existing.source_type,
      external_key: existing.external_key,
      item_name: merged.item_name,
      movement_type: 'update',
      quantity_delta: Number(merged.on_hand_quantity || 0) - Number(existing.on_hand_quantity || 0),
      previous_on_hand_quantity: Number(existing.on_hand_quantity || 0),
      new_on_hand_quantity: Number(merged.on_hand_quantity || 0),
      previous_reserved_quantity: Number(existing.reserved_quantity || 0),
      new_reserved_quantity: Number(merged.reserved_quantity || 0),
      previous_incoming_quantity: Number(existing.incoming_quantity || 0),
      new_incoming_quantity: Number(merged.incoming_quantity || 0),
      note: normalizeText(body.movement_note) || 'Inventory item updated.',
      actor_user_id: adminUser.user_id
    });

    const saved = await db.prepare(`
      SELECT *
      FROM site_item_inventory
      WHERE site_item_inventory_id = ?
      LIMIT 1
    `).bind(id).first();

    await auditAdminAction(env, request, adminUser, {
      action_type: 'inventory_update',
      target_type: 'inventory_item',
      target_id: id,
      target_key: `${existing.source_type}:${existing.external_key}`,
      details: {
        item_name: merged.item_name,
        previous_on_hand_quantity: Number(existing.on_hand_quantity || 0),
        new_on_hand_quantity: Number(merged.on_hand_quantity || 0),
        previous_reserved_quantity: Number(existing.reserved_quantity || 0),
        new_reserved_quantity: Number(merged.reserved_quantity || 0),
        previous_incoming_quantity: Number(existing.incoming_quantity || 0),
        new_incoming_quantity: Number(merged.incoming_quantity || 0)
      }
    });

    return json({ ok: true, item: shape(saved || {}) });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Failed to update inventory item.' }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);

  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  const id = Number(new URL(request.url).searchParams.get('site_item_inventory_id') || 0);
  if (!id) return json({ ok: false, error: 'site_item_inventory_id is required.' }, 400);

  try {
    const existing = await db.prepare(`
      SELECT *
      FROM site_item_inventory
      WHERE site_item_inventory_id = ?
      LIMIT 1
    `).bind(id).first();

    if (!existing) return json({ ok: false, error: 'Inventory item not found.' }, 404);

    await db.prepare(`
      DELETE FROM site_item_inventory
      WHERE site_item_inventory_id = ?
    `).bind(id).run();

    await logMovement(db, {
      site_item_inventory_id: id,
      source_type: existing.source_type,
      external_key: existing.external_key,
      item_name: existing.item_name,
      movement_type: 'delete',
      quantity_delta: 0,
      previous_on_hand_quantity: Number(existing.on_hand_quantity || 0),
      new_on_hand_quantity: 0,
      previous_reserved_quantity: Number(existing.reserved_quantity || 0),
      new_reserved_quantity: 0,
      previous_incoming_quantity: Number(existing.incoming_quantity || 0),
      new_incoming_quantity: 0,
      note: 'Inventory item deleted.',
      actor_user_id: adminUser.user_id
    });

    await auditAdminAction(env, request, adminUser, {
      action_type: 'inventory_delete',
      target_type: 'inventory_item',
      target_id: id,
      target_key: `${existing.source_type}:${existing.external_key}`,
      details: {
        item_name: existing.item_name,
        on_hand_quantity: Number(existing.on_hand_quantity || 0)
      }
    });

    return json({ ok: true, message: 'Inventory item removed.' });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Failed to remove inventory item.' }, 500);
  }
}
