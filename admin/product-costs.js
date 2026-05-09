// File: /functions/api/admin/product-costs.js
import { getAdminUserFromRequest, getDb, jsonResponse, auditAdminAction, normalizeText } from "../_lib/adminAudit.js";

function nr(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function getTableColumnSet(db, tableName) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    return new Set(nr(result).map((row) => String(row?.name || "").trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function colExpr(cols, name) {
  return cols.has(name) ? name : `NULL AS ${name}`;
}

async function ensureTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS product_costs (
      product_cost_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_number TEXT NOT NULL,
      cost_per_unit REAL NOT NULL DEFAULT 0,
      effective_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const cols = await getTableColumnSet(db, 'product_costs');
  const additions = [
    ['product_number', `ALTER TABLE product_costs ADD COLUMN product_number TEXT`],
    ['cost_per_unit', `ALTER TABLE product_costs ADD COLUMN cost_per_unit REAL NOT NULL DEFAULT 0`],
    ['effective_date', `ALTER TABLE product_costs ADD COLUMN effective_date TEXT`],
    ['notes', `ALTER TABLE product_costs ADD COLUMN notes TEXT`],
    ['created_at', `ALTER TABLE product_costs ADD COLUMN created_at TEXT`],
    ['updated_at', `ALTER TABLE product_costs ADD COLUMN updated_at TEXT`]
  ];

  for (const [name, sql] of additions) {
    if (!cols.has(name)) {
      await db.prepare(sql).run().catch(() => null);
    }
  }

  return getTableColumnSet(db, 'product_costs');
}

export async function onRequestGet(context) {
  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok: false, error: "Admin access required." }, 401);

  const db = getDb(context.env);
  if (!db) return jsonResponse({ ok: false, error: "Database binding is not configured." }, 500);

  try {
    const cols = await ensureTable(db);
    const result = await db.prepare(`
      SELECT
        ${colExpr(cols, 'product_cost_id')},
        ${colExpr(cols, 'product_number')},
        ${colExpr(cols, 'cost_per_unit')},
        ${colExpr(cols, 'effective_date')},
        ${colExpr(cols, 'notes')},
        ${colExpr(cols, 'created_at')},
        ${colExpr(cols, 'updated_at')}
      FROM product_costs
      ORDER BY COALESCE(effective_date, created_at, '1970-01-01') DESC, COALESCE(product_cost_id, 0) DESC
    `).all();

    return jsonResponse({ ok: true, product_costs: nr(result) });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || 'Failed to load product costs.' }, 500);
  }
}

export async function onRequestPost(context) {
  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok: false, error: "Admin access required." }, 401);

  const db = getDb(context.env);
  if (!db) return jsonResponse({ ok: false, error: "Database binding is not configured." }, 500);

  let body = {};
  try { body = await context.request.json(); } catch {}

  const product_number = normalizeText(body.product_number).toUpperCase();
  const cost_per_unit = Number(body.cost_per_unit || 0);
  const effective_date = normalizeText(body.effective_date);
  const notes = normalizeText(body.notes);

  if (!product_number || !Number.isFinite(cost_per_unit)) {
    return jsonResponse({ ok: false, error: "Product number and cost are required." }, 400);
  }

  try {
    const cols = await ensureTable(db);
    const insertCols = [];
    const insertVals = [];
    const binds = [];

    if (cols.has('product_number')) { insertCols.push('product_number'); insertVals.push('?'); binds.push(product_number); }
    if (cols.has('cost_per_unit')) { insertCols.push('cost_per_unit'); insertVals.push('?'); binds.push(cost_per_unit); }
    if (cols.has('effective_date')) { insertCols.push('effective_date'); insertVals.push('?'); binds.push(effective_date || null); }
    if (cols.has('notes')) { insertCols.push('notes'); insertVals.push('?'); binds.push(notes || null); }
    if (cols.has('created_at')) { insertCols.push('created_at'); insertVals.push('CURRENT_TIMESTAMP'); }
    if (cols.has('updated_at')) { insertCols.push('updated_at'); insertVals.push('CURRENT_TIMESTAMP'); }

    await db.prepare(`INSERT INTO product_costs (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`).bind(...binds).run();

    await auditAdminAction(context.env, context.request, adminUser, {
      action_type: "create_product_cost",
      target_type: "product_cost",
      target_key: product_number,
      details: { cost_per_unit, effective_date }
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || 'Failed to save product cost.' }, 500);
  }
}
