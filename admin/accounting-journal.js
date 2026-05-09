import {
  getAdminUserFromRequest,
  getDb,
  jsonResponse,
  auditAdminAction,
  captureRuntimeIncident,
  normalizeText,
} from "../_lib/adminAudit.js";

function monthRange(monthValue) {
  const raw = String(monthValue || "").trim();
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;

  const start = `${match[1]}-${match[2]}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;

  return { raw, start, end };
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function safeFirst(db, sql, bindings = [], fallback = {}) {
  try {
    const row = await db.prepare(sql).bind(...bindings).first();
    return row || fallback;
  } catch {
    return fallback;
  }
}

async function safeAll(db, sql, bindings = []) {
  try {
    const result = await db.prepare(sql).bind(...bindings).all();
    return normalizeResults(result);
  } catch {
    return [];
  }
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

async function ensureJournalSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS accounting_journal_entries (
      journal_entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_month TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_key TEXT NOT NULL,
      reference_code TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      total_debit_cents INTEGER NOT NULL DEFAULT 0,
      total_credit_cents INTEGER NOT NULL DEFAULT 0,
      imbalance_cents INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (period_month, source_type, source_key)
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS accounting_journal_lines (
      journal_line_id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_entry_id INTEGER NOT NULL,
      line_number INTEGER NOT NULL,
      ledger_code TEXT,
      ledger_name TEXT,
      line_description TEXT,
      debit_cents INTEGER NOT NULL DEFAULT 0,
      credit_cents INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (journal_entry_id, line_number),
      FOREIGN KEY (journal_entry_id) REFERENCES accounting_journal_entries(journal_entry_id) ON DELETE CASCADE
    )
  `).run();

  await db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_period ON accounting_journal_entries(period_month, entry_date DESC, journal_entry_id DESC)"
  ).run();
  await db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_source ON accounting_journal_entries(source_type, source_key)"
  ).run();
  await db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entry ON accounting_journal_lines(journal_entry_id, line_number ASC)"
  ).run();
}

function asInt(value) {
  return Math.round(Number(value || 0));
}

function buildRevenueLines(summary) {
  const cashGross = asInt(summary.cash_gross_cents);
  const taxRecognized = asInt(summary.tax_recognized_cents);
  const salesRecognized = Math.max(0, cashGross - taxRecognized);

  return [
    {
      ledger_code: "1000",
      ledger_name: "Cash Clearing",
      line_description: "Recognized cash receipts",
      debit_cents: cashGross,
      credit_cents: 0,
    },
    {
      ledger_code: "4000",
      ledger_name: "Sales Revenue",
      line_description: "Recognized sales before tax",
      debit_cents: 0,
      credit_cents: salesRecognized,
    },
    {
      ledger_code: "2300",
      ledger_name: "Sales Tax Payable",
      line_description: "Recognized sales tax liability",
      debit_cents: 0,
      credit_cents: taxRecognized,
    },
  ].filter((line) => line.debit_cents > 0 || line.credit_cents > 0);
}

function buildExpenseLines(group) {
  const total = asInt(group.total_cents);
  if (total <= 0) return [];

  return [
    {
      ledger_code: normalizeText(group.ledger_code) || "6100",
      ledger_name: normalizeText(group.ledger_name) || "Operating Expense",
      line_description: `${normalizeText(group.ledger_name) || "Expense"} for ${normalizeText(group.period_month)}`,
      debit_cents: total,
      credit_cents: 0,
    },
    {
      ledger_code: "2100",
      ledger_name: "Accounts Payable",
      line_description: "Expense accrual",
      debit_cents: 0,
      credit_cents: total,
    },
  ];
}

function buildWriteoffLines(group) {
  const total = asInt(group.total_cents);
  if (total <= 0) return [];

  return [
    {
      ledger_code: normalizeText(group.ledger_code) || "6900",
      ledger_name: normalizeText(group.ledger_name) || "Write-Off Expense",
      line_description: `${normalizeText(group.ledger_name) || "Write-Off"} for ${normalizeText(group.period_month)}`,
      debit_cents: total,
      credit_cents: 0,
    },
    {
      ledger_code: "1400",
      ledger_name: "Inventory / Asset Clearing",
      line_description: "Write-off clearing",
      debit_cents: 0,
      credit_cents: total,
    },
  ];
}

function buildOverheadLines(group) {
  const total = asInt(group.total_cents);
  if (total <= 0) return [];

  return [
    {
      ledger_code: normalizeText(group.ledger_code) || "6200",
      ledger_name: normalizeText(group.ledger_name) || "Allocated Overhead",
      line_description: `${normalizeText(group.ledger_name) || "Allocated Overhead"} for ${normalizeText(group.period_month)}`,
      debit_cents: total,
      credit_cents: 0,
    },
    {
      ledger_code: "2190",
      ledger_name: "Overhead Clearing",
      line_description: "Allocated overhead clearing",
      debit_cents: 0,
      credit_cents: total,
    },
  ];
}

function summarizeLines(lines) {
  let totalDebit = 0;
  let totalCredit = 0;

  const normalized = lines.map((line, index) => {
    const debit = Math.max(0, asInt(line.debit_cents));
    const credit = Math.max(0, asInt(line.credit_cents));
    totalDebit += debit;
    totalCredit += credit;

    return {
      line_number: index + 1,
      ledger_code: normalizeText(line.ledger_code) || null,
      ledger_name: normalizeText(line.ledger_name) || null,
      line_description: normalizeText(line.line_description) || null,
      debit_cents: debit,
      credit_cents: credit,
    };
  });

  return {
    lines: normalized,
    total_debit_cents: totalDebit,
    total_credit_cents: totalCredit,
    imbalance_cents: totalDebit - totalCredit,
  };
}

async function upsertEntry(db, periodMonth, entryDate, sourceType, sourceKey, description, lines, referenceCode = null) {
  const summary = summarizeLines(lines);

  await db.prepare(`
    INSERT INTO accounting_journal_entries (
      period_month,
      entry_date,
      source_type,
      source_key,
      reference_code,
      description,
      status,
      total_debit_cents,
      total_credit_cents,
      imbalance_cents,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(period_month, source_type, source_key) DO UPDATE SET
      entry_date = excluded.entry_date,
      reference_code = excluded.reference_code,
      description = excluded.description,
      total_debit_cents = excluded.total_debit_cents,
      total_credit_cents = excluded.total_credit_cents,
      imbalance_cents = excluded.imbalance_cents,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    periodMonth,
    entryDate,
    sourceType,
    sourceKey,
    referenceCode,
    description,
    summary.total_debit_cents,
    summary.total_credit_cents,
    summary.imbalance_cents
  ).run();

  const entry = await db.prepare(`
    SELECT
      journal_entry_id,
      period_month,
      entry_date,
      source_type,
      source_key,
      reference_code,
      description,
      status,
      total_debit_cents,
      total_credit_cents,
      imbalance_cents
    FROM accounting_journal_entries
    WHERE period_month = ? AND source_type = ? AND source_key = ?
    LIMIT 1
  `).bind(periodMonth, sourceType, sourceKey).first();

  if (!entry?.journal_entry_id) return null;

  await db.prepare("DELETE FROM accounting_journal_lines WHERE journal_entry_id = ?")
    .bind(entry.journal_entry_id)
    .run();

  for (const line of summary.lines) {
    await db.prepare(`
      INSERT INTO accounting_journal_lines (
        journal_entry_id,
        line_number,
        ledger_code,
        ledger_name,
        line_description,
        debit_cents,
        credit_cents,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      entry.journal_entry_id,
      line.line_number,
      line.ledger_code,
      line.ledger_name,
      line.line_description,
      line.debit_cents,
      line.credit_cents
    ).run();
  }

  return {
    ...entry,
    lines: summary.lines,
  };
}

async function loadSourceSummaries(db, range) {
  const hasOrders = await tableExists(db, "accounting_order_records");
  const hasExpenses = await tableExists(db, "accounting_expenses");
  const hasWriteoffs = await tableExists(db, "accounting_writeoffs");
  const hasOverhead = await tableExists(db, "accounting_overhead_allocations");

  const revenueSummary = hasOrders
    ? await safeFirst(
        db,
        `
          SELECT
            COALESCE(SUM(COALESCE(amount_paid_cents, 0)), 0) AS cash_gross_cents,
            COALESCE(SUM(COALESCE(tax_liability_cents, 0)), 0) AS tax_recognized_cents,
            COALESCE(SUM(COALESCE(amount_outstanding_cents, 0)), 0) AS outstanding_cents,
            COUNT(*) AS order_count
          FROM accounting_order_records
          WHERE substr(COALESCE(last_synced_at, updated_at, created_at, datetime('now')), 1, 10) >= ?
            AND substr(COALESCE(last_synced_at, updated_at, created_at, datetime('now')), 1, 10) < ?
        `,
        [range.start, range.end],
        { cash_gross_cents: 0, tax_recognized_cents: 0, outstanding_cents: 0, order_count: 0 }
      )
    : { cash_gross_cents: 0, tax_recognized_cents: 0, outstanding_cents: 0, order_count: 0 };

  const expenseGroups = hasExpenses
    ? await safeAll(
        db,
        `
          SELECT
            ? AS period_month,
            COALESCE(NULLIF(ledger_code, ''), '6100') AS ledger_code,
            COALESCE(NULLIF(ledger_name, ''), 'Operating Expense') AS ledger_name,
            COALESCE(SUM(CAST(ROUND((COALESCE(amount, 0) + COALESCE(tax_amount, 0)) * 100.0) AS INTEGER)), 0) AS total_cents,
            COUNT(*) AS entry_count
          FROM accounting_expenses
          WHERE substr(COALESCE(expense_date, created_at, datetime('now')), 1, 10) >= ?
            AND substr(COALESCE(expense_date, created_at, datetime('now')), 1, 10) < ?
          GROUP BY COALESCE(NULLIF(ledger_code, ''), '6100'), COALESCE(NULLIF(ledger_name, ''), 'Operating Expense')
          HAVING COALESCE(SUM(CAST(ROUND((COALESCE(amount, 0) + COALESCE(tax_amount, 0)) * 100.0) AS INTEGER)), 0) > 0
          ORDER BY total_cents DESC, ledger_name ASC
        `,
        [range.raw, range.start, range.end]
      )
    : [];

  const writeoffGroups = hasWriteoffs
    ? await safeAll(
        db,
        `
          SELECT
            ? AS period_month,
            COALESCE(NULLIF(ledger_code, ''), '6900') AS ledger_code,
            COALESCE(NULLIF(ledger_name, ''), 'Write-Off Expense') AS ledger_name,
            COALESCE(SUM(CAST(ROUND(COALESCE(amount, 0) * 100.0) AS INTEGER)), 0) AS total_cents,
            COUNT(*) AS entry_count
          FROM accounting_writeoffs
          WHERE substr(COALESCE(writeoff_date, created_at, datetime('now')), 1, 10) >= ?
            AND substr(COALESCE(writeoff_date, created_at, datetime('now')), 1, 10) < ?
          GROUP BY COALESCE(NULLIF(ledger_code, ''), '6900'), COALESCE(NULLIF(ledger_name, ''), 'Write-Off Expense')
          HAVING COALESCE(SUM(CAST(ROUND(COALESCE(amount, 0) * 100.0) AS INTEGER)), 0) > 0
          ORDER BY total_cents DESC, ledger_name ASC
        `,
        [range.raw, range.start, range.end]
      )
    : [];

  const overheadGroups = hasOverhead
    ? await safeAll(
        db,
        `
          SELECT
            ? AS period_month,
            COALESCE(NULLIF(ledger_code, ''), '6200') AS ledger_code,
            COALESCE(NULLIF(ledger_name, ''), 'Allocated Overhead') AS ledger_name,
            COALESCE(SUM(COALESCE(amount_cents, 0)), 0) AS total_cents,
            COUNT(*) AS entry_count,
            COALESCE(MIN(allocation_basis), 'manual') AS allocation_basis
          FROM accounting_overhead_allocations
          WHERE period_month = ?
          GROUP BY COALESCE(NULLIF(ledger_code, ''), '6200'), COALESCE(NULLIF(ledger_name, ''), 'Allocated Overhead')
          HAVING COALESCE(SUM(COALESCE(amount_cents, 0)), 0) > 0
          ORDER BY total_cents DESC, ledger_name ASC
        `,
        [range.raw, range.raw]
      )
    : [];

  return { revenueSummary, expenseGroups, writeoffGroups, overheadGroups };
}

async function syncJournal(db, range) {
  await ensureJournalSchema(db);

  const { revenueSummary, expenseGroups, writeoffGroups, overheadGroups } = await loadSourceSummaries(db, range);
  const upserts = [];

  const revenueLines = buildRevenueLines(revenueSummary);
  if (revenueLines.length) {
    const entry = await upsertEntry(
      db,
      range.raw,
      range.end,
      "revenue_summary",
      `${range.raw}:revenue`,
      `Recognized cash receipts and sales tax for ${range.raw}`,
      revenueLines,
      `REV-${range.raw}`
    );
    if (entry) upserts.push(entry);
  }

  for (const group of expenseGroups) {
    const sourceKey = `${range.raw}:expense:${normalizeText(group.ledger_code) || "6100"}`;
    const entry = await upsertEntry(
      db,
      range.raw,
      range.end,
      "expense_summary",
      sourceKey,
      `${normalizeText(group.ledger_name) || "Operating Expense"} summary for ${range.raw}`,
      buildExpenseLines(group),
      `EXP-${range.raw}-${normalizeText(group.ledger_code) || "6100"}`
    );
    if (entry) upserts.push(entry);
  }

  for (const group of writeoffGroups) {
    const sourceKey = `${range.raw}:writeoff:${normalizeText(group.ledger_code) || "6900"}`;
    const entry = await upsertEntry(
      db,
      range.raw,
      range.end,
      "writeoff_summary",
      sourceKey,
      `${normalizeText(group.ledger_name) || "Write-Off Expense"} summary for ${range.raw}`,
      buildWriteoffLines(group),
      `WRO-${range.raw}-${normalizeText(group.ledger_code) || "6900"}`
    );
    if (entry) upserts.push(entry);
  }

  for (const group of overheadGroups) {
    const sourceKey = `${range.raw}:overhead:${normalizeText(group.ledger_code) || "6200"}`;
    const entry = await upsertEntry(
      db,
      range.raw,
      range.end,
      "overhead_summary",
      sourceKey,
      `${normalizeText(group.ledger_name) || "Allocated Overhead"} summary for ${range.raw}`,
      buildOverheadLines(group),
      `OVH-${range.raw}-${normalizeText(group.ledger_code) || "6200"}`
    );
    if (entry) upserts.push(entry);
  }

  return {
    synced_entry_count: upserts.length,
    revenue_order_count: Number(revenueSummary.order_count || 0),
    expense_group_count: expenseGroups.length,
    writeoff_group_count: writeoffGroups.length,
    overhead_group_count: overheadGroups.length,
  };
}

async function fetchJournal(db, periodMonth) {
  await ensureJournalSchema(db);

  const entries = await safeAll(
    db,
    `
      SELECT
        journal_entry_id,
        period_month,
        entry_date,
        source_type,
        source_key,
        reference_code,
        description,
        status,
        total_debit_cents,
        total_credit_cents,
        imbalance_cents,
        notes,
        created_at,
        updated_at
      FROM accounting_journal_entries
      WHERE period_month = ?
      ORDER BY entry_date DESC, journal_entry_id DESC
    `,
    [periodMonth]
  );

  const lines = await safeAll(
    db,
    `
      SELECT
        journal_line_id,
        journal_entry_id,
        line_number,
        ledger_code,
        ledger_name,
        line_description,
        debit_cents,
        credit_cents,
        created_at,
        updated_at
      FROM accounting_journal_lines
      WHERE journal_entry_id IN (
        SELECT journal_entry_id
        FROM accounting_journal_entries
        WHERE period_month = ?
      )
      ORDER BY journal_entry_id DESC, line_number ASC
    `,
    [periodMonth]
  );

  const lineMap = new Map();
  for (const line of lines) {
    const key = Number(line.journal_entry_id || 0);
    if (!lineMap.has(key)) lineMap.set(key, []);
    lineMap.get(key).push({
      journal_line_id: Number(line.journal_line_id || 0),
      line_number: Number(line.line_number || 0),
      ledger_code: line.ledger_code || "",
      ledger_name: line.ledger_name || "",
      line_description: line.line_description || "",
      debit_cents: Number(line.debit_cents || 0),
      credit_cents: Number(line.credit_cents || 0),
      created_at: line.created_at || "",
      updated_at: line.updated_at || "",
    });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  let imbalanceEntryCount = 0;

  const normalizedEntries = entries.map((entry) => {
    const debit = Number(entry.total_debit_cents || 0);
    const credit = Number(entry.total_credit_cents || 0);
    const imbalance = Number(entry.imbalance_cents || 0);
    totalDebit += debit;
    totalCredit += credit;
    if (imbalance !== 0) imbalanceEntryCount += 1;

    return {
      journal_entry_id: Number(entry.journal_entry_id || 0),
      period_month: entry.period_month || periodMonth,
      entry_date: entry.entry_date || "",
      source_type: entry.source_type || "",
      source_key: entry.source_key || "",
      reference_code: entry.reference_code || "",
      description: entry.description || "",
      status: entry.status || "draft",
      total_debit_cents: debit,
      total_credit_cents: credit,
      imbalance_cents: imbalance,
      notes: entry.notes || "",
      created_at: entry.created_at || "",
      updated_at: entry.updated_at || "",
      lines: lineMap.get(Number(entry.journal_entry_id || 0)) || [],
    };
  });

  return {
    entries: normalizedEntries,
    summary: {
      entry_count: normalizedEntries.length,
      total_debit_cents: totalDebit,
      total_credit_cents: totalCredit,
      journal_imbalance_cents: totalDebit - totalCredit,
      imbalance_entry_count: imbalanceEntryCount,
    },
  };
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function handleGet(context, db) {
  const url = new URL(context.request.url);
  const range = monthRange(url.searchParams.get("month") || new Date().toISOString().slice(0, 7));
  if (!range) {
    return jsonResponse({ ok: false, error: "Please provide month in YYYY-MM format." }, 400);
  }

  const journal = await fetchJournal(db, range.raw);
  return jsonResponse({
    ok: true,
    period: range.raw,
    ...journal,
  });
}

async function handlePost(context, db, adminUser) {
  const body = await readJsonBody(context.request);
  const range = monthRange(body.month || new Date().toISOString().slice(0, 7));
  if (!range) {
    return jsonResponse({ ok: false, error: "Please provide month in YYYY-MM format." }, 400);
  }

  try {
    const syncResult = await syncJournal(db, range);
    const journal = await fetchJournal(db, range.raw);

    await auditAdminAction(context.env, context.request, adminUser, {
      action_type: "accounting_journal_sync",
      target_type: "accounting_journal",
      target_key: range.raw,
      details: syncResult,
    });

    return jsonResponse({
      ok: true,
      period: range.raw,
      sync_result: syncResult,
      ...journal,
    });
  } catch (error) {
    await captureRuntimeIncident(context.env, context.request, {
      incident_scope: "accounting_journal",
      incident_code: "journal_sync_failed",
      severity: "error",
      message: "Failed to sync monthly accounting journal.",
      related_user_id: adminUser.user_id,
      details: {
        month: range.raw,
        error: String(error?.message || error || "Unknown error"),
      },
    });

    return jsonResponse(
      {
        ok: false,
        error: "Could not sync accounting journal for this month.",
        period: range.raw,
      },
      500
    );
  }
}

export async function onRequestGet(context) {
  const db = getDb(context.env);
  if (!db) return jsonResponse({ ok: false, error: "Database binding is not configured." }, 500);

  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok: false, error: "Admin access required." }, 401);

  return handleGet(context, db);
}

export async function onRequestPost(context) {
  const db = getDb(context.env);
  if (!db) return jsonResponse({ ok: false, error: "Database binding is not configured." }, 500);

  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok: false, error: "Admin access required." }, 401);

  return handlePost(context, db, adminUser);
}
