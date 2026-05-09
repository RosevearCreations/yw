// File: /functions/api/admin/accounting-overhead-allocations.js
// Brief description: Manage monthly overhead allocations so operating costs can flow into rough P&L and later product costing.

import { getAdminUserFromRequest, getDb, jsonResponse, auditAdminAction, normalizeText } from "../_lib/adminAudit.js";

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function centsFromAmount(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function monthValue(value) {
  const raw = String(value || '').trim();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
}

function validBasis(value) {
  const v = normalizeText(value).toLowerCase();
  return ['manual', 'revenue', 'orders', 'units'].includes(v) ? v : 'manual';
}

async function ensureTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS accounting_overhead_allocations (
    allocation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_month TEXT NOT NULL,
    ledger_code TEXT NOT NULL DEFAULT '',
    ledger_name TEXT NOT NULL DEFAULT '',
    allocation_basis TEXT NOT NULL DEFAULT 'manual',
    amount_cents INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(period_month, ledger_code)
  )`).run();
}

function mapRow(row, period) {
  return {
    allocation_id: Number(row?.allocation_id || 0),
    period_month: row?.period_month || period,
    ledger_code: row?.ledger_code || '',
    ledger_name: row?.ledger_name || '',
    allocation_basis: row?.allocation_basis || 'manual',
    amount_cents: Number(row?.amount_cents || 0),
    amount: Number((Number(row?.amount_cents || 0) / 100).toFixed(2)),
    notes: row?.notes || '',
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

export async function onRequestGet(context) {
  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok: false, error: 'Admin access required.' }, 401);
  const db = getDb(context.env);
  if (!db) return jsonResponse({ ok: false, error: 'Database binding is not configured.' }, 500);

  await ensureTable(db);
  const url = new URL(context.request.url);
  const period = monthValue(url.searchParams.get('month'));
  const result = await db.prepare(`
    SELECT allocation_id, period_month, ledger_code, ledger_name, allocation_basis, amount_cents, notes, created_at, updated_at
    FROM accounting_overhead_allocations
    WHERE period_month = ?
    ORDER BY ledger_code ASC, ledger_name ASC
  `).bind(period).all();

  return jsonResponse({
    ok: true,
    period_month: period,
    allocations: rows(result).map((row) => mapRow(row, period)),
  });
}

export async function onRequestPost(context) {
  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok: false, error: 'Admin access required.' }, 401);
  const db = getDb(context.env);
  if (!db) return jsonResponse({ ok: false, error: 'Database binding is not configured.' }, 500);

  await ensureTable(db);
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const periodMonth = monthValue(body.period_month);
  const ledgerCode = normalizeText(body.ledger_code).toUpperCase();
  const ledgerName = normalizeText(body.ledger_name);
  const allocationBasis = validBasis(body.allocation_basis);
  const amountCents = centsFromAmount(body.amount);
  const notes = normalizeText(body.notes);

  if (!ledgerCode || !ledgerName) {
    return jsonResponse({ ok: false, error: 'Ledger code and ledger name are required.' }, 400);
  }

  await db.prepare(`
    INSERT INTO accounting_overhead_allocations (
      period_month, ledger_code, ledger_name, allocation_basis, amount_cents, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(period_month, ledger_code) DO UPDATE SET
      ledger_name = excluded.ledger_name,
      allocation_basis = excluded.allocation_basis,
      amount_cents = excluded.amount_cents,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(periodMonth, ledgerCode, ledgerName, allocationBasis, amountCents, notes).run();

  await auditAdminAction(context.env, context.request, adminUser, {
    action_type: 'save_accounting_overhead_allocation',
    target_type: 'accounting_overhead_allocation',
    target_key: `${periodMonth}:${ledgerCode}`,
    details: { period_month: periodMonth, ledger_code: ledgerCode, ledger_name: ledgerName, allocation_basis: allocationBasis, amount_cents: amountCents },
  });

  const row = await db.prepare(`
    SELECT allocation_id, period_month, ledger_code, ledger_name, allocation_basis, amount_cents, notes, created_at, updated_at
    FROM accounting_overhead_allocations
    WHERE period_month = ? AND ledger_code = ?
    LIMIT 1
  `).bind(periodMonth, ledgerCode).first();

  return jsonResponse({ ok: true, allocation: mapRow(row, periodMonth) });
}
