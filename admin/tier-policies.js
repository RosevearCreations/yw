import { getAdminUserFromRequest, getDb, jsonResponse } from "../_lib/adminAudit.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCode(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBenefits(value) {
  if (Array.isArray(value)) {
    return value.map((v) => normalizeText(v)).filter(Boolean);
  }

  return String(value || "")
    .split(/\r?\n|,/)
    .map((v) => normalizeText(v))
    .filter(Boolean);
}

async function tableExists(db, tableName) {
  try {
    const row = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`)
      .bind(tableName)
      .first();
    return !!row;
  } catch {
    return false;
  }
}

async function ensureTierPolicyTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS membership_tier_policies (
      policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
      tier_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      short_description TEXT NOT NULL DEFAULT '',
      benefits_json TEXT NOT NULL DEFAULT '[]',
      badge_color TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function seedDefaultPolicies(db) {
  const defaults = [
    {
      tier_code: "bronze",
      title: "Bronze",
      short_description: "Entry membership tier for basic perks and updates.",
      benefits_json: JSON.stringify([
        "Member badge",
        "News and updates",
        "Occasional coupon access",
      ]),
      badge_color: "#8c6239",
      sort_order: 10,
      is_visible: 1,
    },
    {
      tier_code: "silver",
      title: "Silver",
      short_description: "Mid-tier membership with stronger savings and earlier access.",
      benefits_json: JSON.stringify([
        "Everything in Bronze",
        "Better member discounts",
        "Early access to select releases",
      ]),
      badge_color: "#a7adb5",
      sort_order: 20,
      is_visible: 1,
    },
    {
      tier_code: "gold",
      title: "Gold",
      short_description: "Top starter tier with best discounts and premium extras.",
      benefits_json: JSON.stringify([
        "Everything in Silver",
        "Best member discounts",
        "Priority early access",
        "Premium bonus perks",
      ]),
      badge_color: "#c9a227",
      sort_order: 30,
      is_visible: 1,
    },
  ];

  for (const item of defaults) {
    await db
      .prepare(`
        INSERT INTO membership_tier_policies (
          tier_code, title, short_description, benefits_json, badge_color, sort_order, is_visible
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tier_code) DO NOTHING
      `)
      .bind(
        item.tier_code,
        item.title,
        item.short_description,
        item.benefits_json,
        item.badge_color,
        item.sort_order,
        item.is_visible
      )
      .run();
  }
}

function mapPolicyRow(row) {
  let benefits = [];
  try {
    benefits = JSON.parse(row?.benefits_json || "[]");
    if (!Array.isArray(benefits)) benefits = [];
  } catch {
    benefits = [];
  }

  return {
    policy_id: Number(row?.policy_id || 0),
    tier_code: normalizeCode(row?.tier_code),
    title: normalizeText(row?.title),
    short_description: normalizeText(row?.short_description),
    benefits,
    badge_color: normalizeText(row?.badge_color),
    sort_order: Number(row?.sort_order || 0),
    is_visible: Number(row?.is_visible || 0) === 1,
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
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

  await ensureTierPolicyTable(db);
  await seedDefaultPolicies(db);

  const rows = await db
    .prepare(`
      SELECT
        policy_id,
        tier_code,
        title,
        short_description,
        benefits_json,
        badge_color,
        sort_order,
        is_visible,
        created_at,
        updated_at
      FROM membership_tier_policies
      ORDER BY sort_order ASC, tier_code ASC
    `)
    .all();

  return jsonResponse({
    ok: true,
    items: (rows?.results || []).map(mapPolicyRow),
  });
}

export async function onRequestPost(context) {
  const db = getDb(context.env);
  if (!db) {
    return jsonResponse({ ok: false, error: "Database binding is not configured." }, 500);
  }

  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) {
    return jsonResponse({ ok: false, error: "Admin access required." }, 401);
  }

  await ensureTierPolicyTable(db);
  await seedDefaultPolicies(db);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const tierCode = normalizeCode(body?.tier_code);
  const title = normalizeText(body?.title);
  const shortDescription = normalizeText(body?.short_description);
  const benefits = normalizeBenefits(body?.benefits);
  const badgeColor = normalizeText(body?.badge_color);
  const sortOrder = Number(body?.sort_order || 0);
  const isVisible = body?.is_visible === false ? 0 : 1;

  if (!tierCode) {
    return jsonResponse({ ok: false, error: "tier_code is required." }, 400);
  }

  if (!title) {
    return jsonResponse({ ok: false, error: "title is required." }, 400);
  }

  await db
    .prepare(`
      INSERT INTO membership_tier_policies (
        tier_code,
        title,
        short_description,
        benefits_json,
        badge_color,
        sort_order,
        is_visible,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(tier_code) DO UPDATE SET
        title = excluded.title,
        short_description = excluded.short_description,
        benefits_json = excluded.benefits_json,
        badge_color = excluded.badge_color,
        sort_order = excluded.sort_order,
        is_visible = excluded.is_visible,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      tierCode,
      title,
      shortDescription,
      JSON.stringify(benefits),
      badgeColor,
      sortOrder,
      isVisible
    )
    .run();

  const row = await db
    .prepare(`
      SELECT
        policy_id,
        tier_code,
        title,
        short_description,
        benefits_json,
        badge_color,
        sort_order,
        is_visible,
        created_at,
        updated_at
      FROM membership_tier_policies
      WHERE tier_code = ?
      LIMIT 1
    `)
    .bind(tierCode)
    .first();

  return jsonResponse({
    ok: true,
    item: mapPolicyRow(row),
  });
}
