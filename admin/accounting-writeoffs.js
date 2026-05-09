// File: /functions/api/admin/accounting-writeoffs.js
import { getAdminUserFromRequest, getDb, jsonResponse, auditAdminAction, normalizeText } from "../_lib/adminAudit.js";

function nr(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function getTableColumnSet(db, tableName) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    return new Set(nr(result).map((row) => String(row?.name || '').trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function colExpr(cols, name) {
  return cols.has(name) ? name : `NULL AS ${name}`;
}

async function ensureTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS accounting_writeoffs (
      writeoff_id INTEGER PRIMARY KEY AUTOINCREMENT,
      writeoff_date TEXT,
      item_name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      reason_code TEXT NOT NULL DEFAULT 'other',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const cols = await getTableColumnSet(db, 'accounting_writeoffs');
  const additions = [
    ['writeoff_date', `ALTER TABLE accounting_writeoffs ADD COLUMN writeoff_date TEXT`],
    ['item_name', `ALTER TABLE accounting_writeoffs ADD COLUMN item_name TEXT`],
    ['amount', `ALTER TABLE accounting_writeoffs ADD COLUMN amount REAL NOT NULL DEFAULT 0`],
    ['reason_code', `ALTER TABLE accounting_writeoffs ADD COLUMN reason_code TEXT NOT NULL DEFAULT 'other'`],
    ['notes', `ALTER TABLE accounting_writeoffs ADD COLUMN notes TEXT`],
    ['created_at', `ALTER TABLE accounting_writeoffs ADD COLUMN created_at TEXT`],
    ['updated_at', `ALTER TABLE accounting_writeoffs ADD COLUMN updated_at TEXT`]
  ];

  for (const [name, sql] of additions) {
    if (!cols.has(name)) {
      await db.prepare(sql).run().catch(() => null);
    }
  }

  return getTableColumnSet(db, 'accounting_writeoffs');
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
        ${colExpr(cols, 'writeoff_id')},
        ${colExpr(cols, 'writeoff_date')},
        ${colExpr(cols, 'item_name')},
        ${colExpr(cols, 'amount')},
        ${colExpr(cols, 'reason_code')},
        ${colExpr(cols, 'notes')},
        ${colExpr(cols, 'created_at')},
        ${colExpr(cols, 'updated_at')}
      FROM accounting_writeoffs
      ORDER BY COALESCE(writeoff_date, created_at, '1970-01-01') DESC, COALESCE(writeoff_id, 0) DESC
    `).all();

    return jsonResponse({ ok: true, writeoffs: nr(result) });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || 'Failed to load writeoffs.' }, 500);
  }
}

export async function onRequestPost(context) {
  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok: false, error: "Admin access required." }, 401);

  const db = getDb(context.env);
  if (!db) return jsonResponse({ ok: false, error: "Database binding is not configured." }, 500);

  let body = {};
  try { body = await context.request.json(); } catch {}

  const writeoff_date = normalizeText(body.writeoff_date);
  const item_name = normalizeText(body.item_name);
  const amount = Number(body.amount || 0);
  const reason_code = normalizeText(body.reason_code).toLowerCase() || 'other';
  const notes = normalizeText(body.notes);

  if (!item_name || !Number.isFinite(amount)) {
    return jsonResponse({ ok: false, error: "Item name and amount are required." }, 400);
  }

  try {
    const cols = await ensureTable(db);
    const insertCols = [];
    const insertVals = [];
    const binds = [];

    if (cols.has('writeoff_date')) { insertCols.push('writeoff_date'); insertVals.push('?'); binds.push(writeoff_date || null); }
    if (cols.has('item_name')) { insertCols.push('item_name'); insertVals.push('?'); binds.push(item_name); }
    if (cols.has('amount')) { insertCols.push('amount'); insertVals.push('?'); binds.push(amount); }
    if (cols.has('reason_code')) { insertCols.push('reason_code'); insertVals.push('?'); binds.push(reason_code || 'other'); }
    if (cols.has('notes')) { insertCols.push('notes'); insertVals.push('?'); binds.push(notes || null); }
    if (cols.has('created_at')) { insertCols.push('created_at'); insertVals.push('CURRENT_TIMESTAMP'); }
    if (cols.has('updated_at')) { insertCols.push('updated_at'); insertVals.push('CURRENT_TIMESTAMP'); }

    await db.prepare(`INSERT INTO accounting_writeoffs (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`).bind(...binds).run();

    await auditAdminAction(context.env, context.request, adminUser, {
      action_type: "create_writeoff",
      target_type: "accounting_writeoff",
      details: { writeoff_date, item_name, amount, reason_code }
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || 'Failed to save writeoff.' }, 500);
  }
}
