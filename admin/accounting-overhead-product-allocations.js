import {
  auditAdminAction,
  getAdminUserFromRequest,
  getDb,
  jsonResponse,
  normalizeText,
} from "../_lib/adminAudit.js";

function json(data, status = 200) {
  return jsonResponse(data, status, { "Cache-Control": "no-store" });
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function ensureTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS accounting_overhead_product_allocations (
      overhead_product_allocation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_month TEXT NOT NULL,
      ledger_code TEXT NOT NULL DEFAULT '',
      product_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(period_month, ledger_code, product_id)
    )
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_accounting_overhead_product_allocations_month
    ON accounting_overhead_product_allocations(period_month, ledger_code, product_id)
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_accounting_overhead_product_allocations_product
    ON accounting_overhead_product_allocations(product_id, period_month DESC)
  `).run();
}

function mapRow(row) {
  return {
    overhead_product_allocation_id: Number(row?.overhead_product_allocation_id || 0),
    period_month: row?.period_month || "",
    ledger_code: row?.ledger_code || "",
    product_id: Number(row?.product_id || 0),
    product_number: row?.product_number == null ? null : Number(row.product_number || 0),
    product_name: row?.product_name || "",
    product_status: row?.product_status || "",
    review_status: row?.review_status || "",
    amount_cents: Number(row?.amount_cents || 0),
    notes: row?.notes || "",
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

export async function onRequestGet(context) {
  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return json({ ok: false, error: "Admin access required." }, 401);

  const db = getDb(context.env);
  if (!db) return json({ ok: false, error: "Database binding is not configured." }, 500);

  await ensureTable(db);

  const url = new URL(context.request.url);
  const periodMonth = normalizeText(url.searchParams.get("month"));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 150), 1), 500);

  const where = [];
  const bindings = [];

  if (periodMonth) {
    where.push("opa.period_month = ?");
    bindings.push(periodMonth);
  }

  bindings.push(limit);

  const result = await db.prepare(`
    SELECT
      opa.overhead_product_allocation_id,
      opa.period_month,
      opa.ledger_code,
      opa.product_id,
      opa.amount_cents,
      opa.notes,
      opa.created_at,
      opa.updated_at,
      p.product_number,
      p.name AS product_name,
      p.status AS product_status,
      p.review_status
    FROM accounting_overhead_product_allocations opa
    LEFT JOIN products p ON p.product_id = opa.product_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY opa.period_month DESC, opa.ledger_code ASC, LOWER(COALESCE(p.name, '')) ASC, opa.product_id ASC
    LIMIT ?
  `).bind(...bindings).all();

  const rows = normalizeResults(result);
  const allocations = rows.map(mapRow);

  return json({
    ok: true,
    allocations,
    summary: {
      allocation_count: allocations.length,
      total_amount_cents: allocations.reduce((sum, row) => sum + Number(row.amount_cents || 0), 0),
      period_month: periodMonth || null,
    },
  });
}

export async function onRequestPost(context) {
  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return json({ ok: false, error: "Admin access required." }, 401);

  const db = getDb(context.env);
  if (!db) return json({ ok: false, error: "Database binding is not configured." }, 500);

  await ensureTable(db);

  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const periodMonth = normalizeText(body.period_month || body.month);
  const ledgerCode = normalizeText(body.ledger_code).toUpperCase();
  const productId = Number(body.product_id || 0);
  const amountCents = Number(body.amount_cents ?? body.allocated_cents ?? 0);
  const notes = normalizeText(body.notes || "");
  const mode = normalizeText(body.mode || "upsert").toLowerCase();

  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    return json({ ok: false, error: "period_month must be YYYY-MM." }, 400);
  }

  if (!ledgerCode) {
    return json({ ok: false, error: "ledger_code is required." }, 400);
  }

  if (!Number.isInteger(productId) || productId <= 0) {
    return json({ ok: false, error: "product_id is required." }, 400);
  }

  if (!Number.isInteger(amountCents) || amountCents < 0) {
    return json({ ok: false, error: "amount_cents must be a whole number of cents." }, 400);
  }

  const product = await db.prepare(`
    SELECT product_id, product_number, name, status, review_status
    FROM products
    WHERE product_id = ?
    LIMIT 1
  `).bind(productId).first();

  if (!product) {
    return json({ ok: false, error: "Product not found." }, 404);
  }

  if (mode === "delete" || amountCents === 0) {
    await db.prepare(`
      DELETE FROM accounting_overhead_product_allocations
      WHERE period_month = ? AND ledger_code = ? AND product_id = ?
    `).bind(periodMonth, ledgerCode, productId).run();

    await auditAdminAction(context.env, context.request, adminUser, {
      action_type: "delete_overhead_product_allocation",
      target_type: "accounting_overhead_product_allocation",
      target_id: productId,
      target_key: `${periodMonth}:${ledgerCode}:${productId}`,
      details: {
        period_month: periodMonth,
        ledger_code: ledgerCode,
        product_id: productId,
      },
    });

    return json({ ok: true, deleted: true });
  }

  await db.prepare(`
    INSERT INTO accounting_overhead_product_allocations (
      period_month,
      ledger_code,
      product_id,
      amount_cents,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(period_month, ledger_code, product_id) DO UPDATE SET
      amount_cents = excluded.amount_cents,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    periodMonth,
    ledgerCode,
    productId,
    amountCents,
    notes || null
  ).run();

  const saved = await db.prepare(`
    SELECT
      opa.overhead_product_allocation_id,
      opa.period_month,
      opa.ledger_code,
      opa.product_id,
      opa.amount_cents,
      opa.notes,
      opa.created_at,
      opa.updated_at,
      p.product_number,
      p.name AS product_name,
      p.status AS product_status,
      p.review_status
    FROM accounting_overhead_product_allocations opa
    LEFT JOIN products p ON p.product_id = opa.product_id
    WHERE opa.period_month = ? AND opa.ledger_code = ? AND opa.product_id = ?
    LIMIT 1
  `).bind(periodMonth, ledgerCode, productId).first();

  await auditAdminAction(context.env, context.request, adminUser, {
    action_type: "save_overhead_product_allocation",
    target_type: "accounting_overhead_product_allocation",
    target_id: productId,
    target_key: `${periodMonth}:${ledgerCode}:${productId}`,
    details: {
      period_month: periodMonth,
      ledger_code: ledgerCode,
      product_id: productId,
      amount_cents: amountCents,
    },
  });

  return json({ ok: true, allocation: mapRow(saved) });
}
