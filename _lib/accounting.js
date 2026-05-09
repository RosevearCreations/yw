// Shared accounting shadow helpers for order-linked bookkeeping records.

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

export function getDb(env) {
  return env.DB || env.DD_DB;
}

export async function ensureAccountingSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS accounting_order_records (
      accounting_order_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      order_number TEXT NOT NULL,
      entry_status TEXT NOT NULL DEFAULT 'open' CHECK (entry_status IN ('open','partially_paid','paid','refunded','cancelled','archived')),
      customer_name TEXT,
      customer_email TEXT,
      currency TEXT NOT NULL DEFAULT 'CAD',
      subtotal_cents INTEGER NOT NULL DEFAULT 0,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      shipping_cents INTEGER NOT NULL DEFAULT 0,
      tax_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL DEFAULT 0,
      amount_paid_cents INTEGER NOT NULL DEFAULT 0,
      amount_outstanding_cents INTEGER NOT NULL DEFAULT 0,
      revenue_cents INTEGER NOT NULL DEFAULT 0,
      tax_liability_cents INTEGER NOT NULL DEFAULT 0,
      source_order_status TEXT,
      source_payment_status TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_accounting_order_records_status ON accounting_order_records(entry_status, created_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_accounting_order_records_customer_email ON accounting_order_records(customer_email, created_at DESC)`).run();
}

function deriveEntryStatus(orderStatus, paymentStatus, totalCents, netPaidCents) {
  const order = normalizeText(orderStatus).toLowerCase();
  const payment = normalizeText(paymentStatus).toLowerCase();
  const total = Math.max(0, Number(totalCents || 0));
  const net = Math.max(0, Number(netPaidCents || 0));
  if (['cancelled', 'void'].includes(order) || payment === 'cancelled') return 'cancelled';
  if (payment === 'refunded') return 'refunded';
  if (total > 0 && net >= total) return 'paid';
  if (net > 0) return 'partially_paid';
  return 'open';
}

export async function syncAccountingForOrder(env, orderId, opts = {}) {
  const db = getDb(env);
  const id = Number(orderId || 0);
  if (!Number.isInteger(id) || id <= 0) return null;

  await ensureAccountingSchema(db);

  const order = await db.prepare(`
    SELECT order_id, order_number, customer_name, customer_email, currency,
           subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
           order_status, payment_status
    FROM orders
    WHERE order_id = ?
    LIMIT 1
  `).bind(id).first();
  if (!order) return null;

  const payments = normalizeResults(await db.prepare(`
    SELECT payment_status, amount_cents
    FROM payments
    WHERE order_id = ?
  `).bind(id).all());

  const refunds = await db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS total_refunded_cents
    FROM payment_refunds
    WHERE order_id = ?
  `).bind(id).first().catch(() => ({ total_refunded_cents: 0 }));

  let grossPaidCents = 0;
  for (const row of payments) {
    const status = normalizeText(row.payment_status).toLowerCase();
    if (['paid', 'partially_refunded', 'refunded'].includes(status)) {
      grossPaidCents += Math.max(0, Number(row.amount_cents || 0));
    }
  }

  const totalRefundedCents = Math.max(0, Number(refunds?.total_refunded_cents || 0));
  const netPaidCents = Math.max(0, grossPaidCents - totalRefundedCents);
  const totalCents = Math.max(0, Number(order.total_cents || 0));
  const taxCents = Math.max(0, Number(order.tax_cents || 0));
  const outstandingCents = Math.max(0, totalCents - netPaidCents);
  const entryStatus = deriveEntryStatus(order.order_status, order.payment_status, totalCents, netPaidCents);
  const revenueCents = Math.max(0, Math.min(totalCents, netPaidCents));
  const taxLiabilityCents = totalCents > 0
    ? Math.round(taxCents * Math.min(netPaidCents, totalCents) / totalCents)
    : 0;
  const note = normalizeText(opts.note) || null;

  await db.prepare(`
    INSERT INTO accounting_order_records (
      order_id, order_number, entry_status, customer_name, customer_email, currency,
      subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
      amount_paid_cents, amount_outstanding_cents, revenue_cents, tax_liability_cents,
      source_order_status, source_payment_status, notes, created_at, updated_at, last_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(order_id) DO UPDATE SET
      order_number = excluded.order_number,
      entry_status = excluded.entry_status,
      customer_name = excluded.customer_name,
      customer_email = excluded.customer_email,
      currency = excluded.currency,
      subtotal_cents = excluded.subtotal_cents,
      discount_cents = excluded.discount_cents,
      shipping_cents = excluded.shipping_cents,
      tax_cents = excluded.tax_cents,
      total_cents = excluded.total_cents,
      amount_paid_cents = excluded.amount_paid_cents,
      amount_outstanding_cents = excluded.amount_outstanding_cents,
      revenue_cents = excluded.revenue_cents,
      tax_liability_cents = excluded.tax_liability_cents,
      source_order_status = excluded.source_order_status,
      source_payment_status = excluded.source_payment_status,
      notes = CASE
        WHEN excluded.notes IS NULL OR excluded.notes = '' THEN accounting_order_records.notes
        WHEN accounting_order_records.notes IS NULL OR accounting_order_records.notes = '' THEN excluded.notes
        ELSE excluded.notes
      END,
      updated_at = CURRENT_TIMESTAMP,
      last_synced_at = CURRENT_TIMESTAMP
  `).bind(
    id,
    order.order_number || `Order ${id}`,
    entryStatus,
    normalizeText(order.customer_name) || null,
    normalizeText(order.customer_email) || null,
    normalizeText(order.currency || 'CAD').toUpperCase() || 'CAD',
    Math.max(0, Number(order.subtotal_cents || 0)),
    Math.max(0, Number(order.discount_cents || 0)),
    Math.max(0, Number(order.shipping_cents || 0)),
    taxCents,
    totalCents,
    netPaidCents,
    outstandingCents,
    revenueCents,
    taxLiabilityCents,
    normalizeText(order.order_status).toLowerCase() || null,
    normalizeText(order.payment_status).toLowerCase() || null,
    note
  ).run();

  return {
    order_id: id,
    entry_status: entryStatus,
    amount_paid_cents: netPaidCents,
    amount_outstanding_cents: outstandingCents,
    revenue_cents: revenueCents,
    tax_liability_cents: taxLiabilityCents
  };
}
