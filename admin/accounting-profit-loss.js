// File: /functions/api/admin/accounting-profit-loss.js
// Brief description: Returns a simple monthly profit/loss style summary so the
// accounting screen can show revenue, expenses, write-offs, and net movement.

import { getAdminUserFromRequest, getDb, jsonResponse } from '../_lib/adminAudit.js';

function monthRange(monthValue) {
  const raw = String(monthValue || '').trim();
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  const start = `${match[1]}-${match[2]}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${String(nextYear).padStart(4,'0')}-${String(nextMonth).padStart(2,'0')}-01`;
  return { raw, start, end };
}

async function tableExists(db, tableName) {
  try {
    const row = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`).bind(tableName).first();
    return !!row;
  } catch { return false; }
}

async function scalar(db, sql, bindings = []) {
  try {
    const row = await db.prepare(sql).bind(...bindings).first();
    return row || {};
  } catch { return {}; }
}

async function safeAll(db, sql, bindings = []) {
  try {
    const result = await db.prepare(sql).bind(...bindings).all();
    return Array.isArray(result?.results) ? result.results : [];
  } catch { return []; }
}

function centsFromDollars(value) {
  return Math.round(Number(value || 0) * 100);
}

export async function onRequestGet(context) {
  const db = getDb(context.env);
  if (!db) return jsonResponse({ ok:false, error:'Database binding is not configured.' }, 500);
  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok:false, error:'Admin access required.' }, 401);

  const url = new URL(context.request.url);
  const range = monthRange(url.searchParams.get('month') || new Date().toISOString().slice(0,7));
  if (!range) return jsonResponse({ ok:false, error:'Please provide month in YYYY-MM format.' }, 400);

  const hasOrders = await tableExists(db, 'orders');
  const hasExpenses = await tableExists(db, 'accounting_expenses');
  const hasWriteoffs = await tableExists(db, 'accounting_writeoffs');
  const hasGl = await tableExists(db, 'general_ledger_accounts');
  const hasOverhead = await tableExists(db, 'accounting_overhead_allocations');

  const orderSummary = hasOrders ? await scalar(db, `
    SELECT
      COALESCE(SUM(COALESCE(total_amount,total,0)),0) AS booked_amount,
      COALESCE(SUM(COALESCE(tax_amount,tax_total,0)),0) AS booked_tax,
      SUM(CASE WHEN LOWER(COALESCE(status,'')) IN ('paid','fulfilled') THEN COALESCE(total_amount,total,0) ELSE 0 END) AS recognized_amount,
      COUNT(*) AS order_count
    FROM orders
    WHERE substr(COALESCE(created_at, datetime('now')),1,10) >= ?
      AND substr(COALESCE(created_at, datetime('now')),1,10) < ?
  `, [range.start, range.end]) : {};

  const expenseSummary = hasExpenses ? await scalar(db, `
    SELECT
      COALESCE(SUM(CAST(ROUND(COALESCE(amount,0) * 100.0) AS INTEGER)),0) AS expense_cents,
      COALESCE(SUM(CAST(ROUND(COALESCE(tax_amount,0) * 100.0) AS INTEGER)),0) AS expense_tax_cents,
      COUNT(*) AS expense_count
    FROM accounting_expenses
    WHERE substr(COALESCE(expense_date, created_at, datetime('now')),1,10) >= ?
      AND substr(COALESCE(expense_date, created_at, datetime('now')),1,10) < ?
  `, [range.start, range.end]) : {};

  const writeoffSummary = hasWriteoffs ? await scalar(db, `
    SELECT
      COALESCE(SUM(CAST(ROUND(COALESCE(amount,0) * 100.0) AS INTEGER)),0) AS writeoff_cents,
      COUNT(*) AS writeoff_count
    FROM accounting_writeoffs
    WHERE substr(COALESCE(writeoff_date, created_at, datetime('now')),1,10) >= ?
      AND substr(COALESCE(writeoff_date, created_at, datetime('now')),1,10) < ?
  `, [range.start, range.end]) : {};

  const groupedExpenses = hasExpenses ? await safeAll(db, `
    SELECT
      COALESCE(NULLIF(ledger_code,''), 'UNASSIGNED') AS ledger_code,
      COALESCE(NULLIF(ledger_name,''), 'Unassigned') AS ledger_name,
      COALESCE(SUM(CAST(ROUND((COALESCE(amount,0) + COALESCE(tax_amount,0)) * 100.0) AS INTEGER)),0) AS total_cents,
      COUNT(*) AS entry_count
    FROM accounting_expenses
    WHERE substr(COALESCE(expense_date, created_at, datetime('now')),1,10) >= ?
      AND substr(COALESCE(expense_date, created_at, datetime('now')),1,10) < ?
    GROUP BY ledger_code, ledger_name
    ORDER BY total_cents DESC, ledger_name ASC
  `, [range.start, range.end]) : [];

  const overheadSummary = hasOverhead ? await scalar(db, `
    SELECT
      COALESCE(SUM(COALESCE(amount_cents,0)),0) AS overhead_cents,
      COUNT(*) AS overhead_count
    FROM accounting_overhead_allocations
    WHERE period_month = ?
  `, [range.raw]) : {};

  const overheadGroups = hasOverhead ? await safeAll(db, `
    SELECT
      COALESCE(NULLIF(ledger_code,''), 'UNASSIGNED') AS ledger_code,
      COALESCE(NULLIF(ledger_name,''), 'Unassigned') AS ledger_name,
      COALESCE(SUM(COALESCE(amount_cents,0)),0) AS total_cents,
      COUNT(*) AS entry_count,
      COALESCE(MIN(allocation_basis),'manual') AS allocation_basis
    FROM accounting_overhead_allocations
    WHERE period_month = ?
    GROUP BY ledger_code, ledger_name
    ORDER BY total_cents DESC, ledger_name ASC
  `, [range.raw]) : [];

  const glAccounts = hasGl ? await safeAll(db, `
    SELECT code, name, category, parent_group, normal_balance, sort_order
    FROM general_ledger_accounts
    ORDER BY category ASC, sort_order ASC, code ASC
    LIMIT 250
  `) : [];

  const bookedAmount = Number(orderSummary.booked_amount || 0);
  const bookedTax = Number(orderSummary.booked_tax || 0);
  const recognizedAmount = Number(orderSummary.recognized_amount || 0);
  const expenseCents = Number(expenseSummary.expense_cents || 0);
  const expenseTaxCents = Number(expenseSummary.expense_tax_cents || 0);
  const writeoffCents = Number(writeoffSummary.writeoff_cents || 0);
  const overheadCents = Number(overheadSummary.overhead_cents || 0);
  const roughNetBeforeOverheadCents = centsFromDollars(recognizedAmount) - expenseCents - expenseTaxCents - writeoffCents;

  return jsonResponse({
    ok: true,
    period: range.raw,
    summary: {
      order_count: Number(orderSummary.order_count || 0),
      expense_count: Number(expenseSummary.expense_count || 0),
      writeoff_count: Number(writeoffSummary.writeoff_count || 0),
      overhead_count: Number(overheadSummary.overhead_count || 0),
      booked_amount: bookedAmount,
      booked_tax: bookedTax,
      recognized_amount: recognizedAmount,
      operating_expense_cents: expenseCents,
      operating_expense_tax_cents: expenseTaxCents,
      writeoff_cents: writeoffCents,
      rough_net_before_cogs_cents: roughNetBeforeOverheadCents,
      overhead_allocated_cents: overheadCents,
      rough_net_after_overhead_cents: roughNetBeforeOverheadCents - overheadCents
    },
    expense_groups: groupedExpenses.map((row) => ({
      ledger_code: row.ledger_code || 'UNASSIGNED',
      ledger_name: row.ledger_name || 'Unassigned',
      total_cents: Number(row.total_cents || 0),
      entry_count: Number(row.entry_count || 0)
    })),
    overhead_groups: overheadGroups.map((row) => ({
      ledger_code: row.ledger_code || 'UNASSIGNED',
      ledger_name: row.ledger_name || 'Unassigned',
      total_cents: Number(row.total_cents || 0),
      entry_count: Number(row.entry_count || 0),
      allocation_basis: row.allocation_basis || 'manual'
    })),
    general_ledger_accounts: glAccounts.map((row) => ({
      code: row.code || '',
      name: row.name || '',
      category: row.category || '',
      parent_group: row.parent_group || '',
      normal_balance: row.normal_balance || '',
      sort_order: Number(row.sort_order || 0)
    }))
  });
}
