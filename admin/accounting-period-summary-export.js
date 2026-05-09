import { getAdminUserFromRequest, getDb, jsonResponse } from "../_lib/adminAudit.js";

function csvCell(value) {
  if (value === null || value === undefined) return "";

  const str = String(value);
  const needsQuotes = [",", "\"", String.fromCharCode(10), String.fromCharCode(13)].some((token) =>
    str.includes(token)
  );

  if (!needsQuotes) return str;

  return `"${str.replace(/"/g, "\"\"")}"`;
}

function toCsv(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map((header) => csvCell(header)).join(","),
    ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")),
  ];

  return lines.join("\n");
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function tableExists(db, tableName) {
  try {
    const row = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
      .bind(tableName)
      .first();
    return !!row;
  } catch {
    return false;
  }
}

async function safeQuery(db, sql, bindings = []) {
  try {
    const result = await db.prepare(sql).bind(...bindings).all();
    return normalizeResults(result);
  } catch {
    return [];
  }
}

function getRange(scope, period) {
  const raw = String(period || "").trim();

  if (scope === "year") {
    const match = /^(\d{4})$/.exec(raw);
    if (!match) return null;

    const year = Number(match[1]);
    return {
      label: match[1],
      start: `${match[1]}-01-01`,
      end: `${String(year + 1).padStart(4, "0")}-01-01`,
    };
  }

  if (scope === "quarter") {
    const match = /^(\d{4})-Q([1-4])$/i.exec(raw);
    if (!match) return null;

    const year = Number(match[1]);
    const quarter = Number(match[2]);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonthRaw = startMonth + 3;
    const endYear = endMonthRaw > 12 ? year + 1 : year;
    const endMonth = endMonthRaw > 12 ? 1 : endMonthRaw;

    return {
      label: `${year}-Q${quarter}`,
      start: `${String(year).padStart(4, "0")}-${String(startMonth).padStart(2, "0")}-01`,
      end: `${String(endYear).padStart(4, "0")}-${String(endMonth).padStart(2, "0")}-01`,
    };
  }

  return null;
}

async function loadOrders(db, range) {
  const hasAccountingOrders = await tableExists(db, "accounting_order_records");
  if (hasAccountingOrders) {
    return safeQuery(
      db,
      `
        SELECT
          'order' AS row_type,
          substr(COALESCE(order_date, created_at, datetime('now')), 1, 10) AS entry_date,
          COALESCE(order_number, CAST(id AS TEXT)) AS reference_code,
          COALESCE(customer_name, customer_email, '') AS party,
          COALESCE(status, payment_status, fulfillment_status, '') AS status,
          ROUND(COALESCE(total_amount, grand_total, subtotal_amount, 0), 2) AS amount,
          ROUND(COALESCE(tax_amount, tax_total, 0), 2) AS tax_amount,
          '' AS ledger_code,
          '' AS ledger_name,
          COALESCE(notes, '') AS notes
        FROM accounting_order_records
        WHERE substr(COALESCE(order_date, created_at, datetime('now')), 1, 10) >= ?
          AND substr(COALESCE(order_date, created_at, datetime('now')), 1, 10) < ?
        ORDER BY COALESCE(order_date, created_at, datetime('now')) DESC
      `,
      [range.start, range.end]
    );
  }

  const hasOrders = await tableExists(db, "orders");
  if (!hasOrders) return [];

  return safeQuery(
    db,
    `
      SELECT
        'order' AS row_type,
        substr(COALESCE(created_at, datetime('now')), 1, 10) AS entry_date,
        COALESCE(order_number, CAST(id AS TEXT)) AS reference_code,
        COALESCE(customer_email, '') AS party,
        COALESCE(status, '') AS status,
        ROUND(COALESCE(total_amount, total, 0), 2) AS amount,
        ROUND(COALESCE(tax_amount, tax_total, 0), 2) AS tax_amount,
        '' AS ledger_code,
        '' AS ledger_name,
        COALESCE(notes, '') AS notes
      FROM orders
      WHERE substr(COALESCE(created_at, datetime('now')), 1, 10) >= ?
        AND substr(COALESCE(created_at, datetime('now')), 1, 10) < ?
      ORDER BY COALESCE(created_at, datetime('now')) DESC
    `,
    [range.start, range.end]
  );
}

async function loadExpenses(db, range) {
  const hasExpenses = await tableExists(db, "accounting_expenses");
  if (!hasExpenses) return [];

  return safeQuery(
    db,
    `
      SELECT
        'expense' AS row_type,
        substr(COALESCE(expense_date, created_at, datetime('now')), 1, 10) AS entry_date,
        COALESCE(reference_number, CAST(expense_id AS TEXT)) AS reference_code,
        COALESCE(vendor_name, payee_name, '') AS party,
        COALESCE(status, '') AS status,
        ROUND(COALESCE(amount, 0), 2) AS amount,
        ROUND(COALESCE(tax_amount, 0), 2) AS tax_amount,
        COALESCE(ledger_code, '') AS ledger_code,
        COALESCE(ledger_name, '') AS ledger_name,
        COALESCE(notes, '') AS notes
      FROM accounting_expenses
      WHERE substr(COALESCE(expense_date, created_at, datetime('now')), 1, 10) >= ?
        AND substr(COALESCE(expense_date, created_at, datetime('now')), 1, 10) < ?
      ORDER BY COALESCE(expense_date, created_at, datetime('now')) DESC
    `,
    [range.start, range.end]
  );
}

async function loadWriteoffs(db, range) {
  const hasWriteoffs = await tableExists(db, "accounting_writeoffs");
  if (!hasWriteoffs) return [];

  return safeQuery(
    db,
    `
      SELECT
        'writeoff' AS row_type,
        substr(COALESCE(writeoff_date, created_at, datetime('now')), 1, 10) AS entry_date,
        COALESCE(reference_number, CAST(writeoff_id AS TEXT)) AS reference_code,
        COALESCE(item_name, product_name, reason_code, '') AS party,
        COALESCE(status, reason_code, '') AS status,
        ROUND(COALESCE(total_amount, amount, 0), 2) AS amount,
        ROUND(COALESCE(tax_amount, 0), 2) AS tax_amount,
        COALESCE(ledger_code, 'WRITEOFF') AS ledger_code,
        COALESCE(ledger_name, 'Write-Offs') AS ledger_name,
        COALESCE(notes, '') AS notes
      FROM accounting_writeoffs
      WHERE substr(COALESCE(writeoff_date, created_at, datetime('now')), 1, 10) >= ?
        AND substr(COALESCE(writeoff_date, created_at, datetime('now')), 1, 10) < ?
      ORDER BY COALESCE(writeoff_date, created_at, datetime('now')) DESC
    `,
    [range.start, range.end]
  );
}

async function loadRows(db, range) {
  const [orders, expenses, writeoffs] = await Promise.all([
    loadOrders(db, range),
    loadExpenses(db, range),
    loadWriteoffs(db, range),
  ]);

  return [...orders, ...expenses, ...writeoffs];
}

export async function onRequestGet(context) {
  const db = getDb(context.env);
  if (!db) {
    return jsonResponse({ ok: false, error: "Database binding is not configured." }, 500);
  }

  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) {
    return jsonResponse({ ok: false, error: "Admin access required." }, 401);
  }

  const url = new URL(context.request.url);
  const scope = String(url.searchParams.get("scope") || "").trim().toLowerCase();
  const period = url.searchParams.get("period");

  const range = getRange(scope, period);
  if (!range) {
    return jsonResponse(
      { ok: false, error: "Provide a valid quarter like 2026-Q2 or year like 2026." },
      400
    );
  }

  const rows = await loadRows(db, range);

  const csv = toCsv(
    rows.length
      ? rows
      : [
          {
            row_type: "empty",
            entry_date: range.start,
            reference_code: "",
            party: "",
            status: "",
            amount: 0,
            tax_amount: 0,
            ledger_code: "",
            ledger_name: "",
            notes: "",
          },
        ]
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="accounting-${scope}-${range.label}.csv"`,
      "cache-control": "no-store",
    },
  });
}
