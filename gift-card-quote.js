function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function normalizeText(value) {
  return String(value || '').trim();
}

async function ensureTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS gift_cards (
    gift_card_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    currency TEXT NOT NULL DEFAULT 'CAD',
    initial_amount_cents INTEGER NOT NULL DEFAULT 0,
    remaining_amount_cents INTEGER NOT NULL DEFAULT 0,
    issued_to_email TEXT,
    issued_to_name TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TEXT,
    last_redeemed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN purchaser_email TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN purchaser_name TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN recipient_email TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN recipient_name TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN recipient_note TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN purchaser_user_id INTEGER`).run().catch(() => null);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB || env.DD_DB;
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);

  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }

  const code = normalizeText(body.code).toUpperCase();
  const orderTotalCents = Math.max(0, Math.round(Number(body.order_total_cents || 0) || 0));
  const currency = normalizeText(body.currency || 'CAD').toUpperCase() || 'CAD';
  if (!code) return json({ ok: false, error: 'Gift card code is required.' }, 400);

  await ensureTables(db);
  const row = await db.prepare(`
    SELECT gift_card_id, code, currency, initial_amount_cents, remaining_amount_cents, status, expires_at
    FROM gift_cards
    WHERE UPPER(code) = ?
    LIMIT 1
  `).bind(code).first();

  if (!row) return json({ ok: false, error: 'Gift card not found.' }, 404);
  const status = String(row.status || 'active').toLowerCase();
  if (status !== 'active') return json({ ok: false, error: 'Gift card is not active.' }, 400);
  if (row.expires_at && String(row.expires_at) < new Date().toISOString().slice(0, 10)) {
    return json({ ok: false, error: 'Gift card has expired.' }, 400);
  }
  if (String(row.currency || 'CAD').toUpperCase() !== currency) {
    return json({ ok: false, error: 'Gift card currency does not match this checkout.' }, 400);
  }

  const remaining = Math.max(0, Number(row.remaining_amount_cents || 0));
  const applicable = Math.min(remaining, orderTotalCents);
  return json({
    ok: true,
    gift_card: {
      gift_card_id: Number(row.gift_card_id || 0),
      code: row.code || code,
      currency: row.currency || currency,
      initial_amount_cents: Number(row.initial_amount_cents || 0),
      remaining_amount_cents: remaining,
      applicable_discount_cents: applicable
    }
  });
}
