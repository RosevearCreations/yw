import { auditAdminAction, getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";
import { loadCatalogOptionSets, saveCatalogOptionSet, uniqueSortedOptions } from "./_catalog-options.js";

function json(data, status = 200) { return jsonResponse(data, status); }
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }

const OPTION_KEY_MAP = {
  categories: 'site.catalog.product_category_options',
  colors: 'site.catalog.color_options',
  shipping_codes: 'site.catalog.shipping_code_options',
};

async function ensureTaxClassesTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tax_classes (
      tax_class_id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      tax_rate REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function loadTaxClasses(db) {
  await ensureTaxClassesTable(db);
  const rows = normalizeResults(await db.prepare(`
    SELECT tax_class_id, code, name, description, tax_rate, is_active, created_at
    FROM tax_classes
    ORDER BY CASE WHEN COALESCE(is_active,1)=1 THEN 0 ELSE 1 END, LOWER(name) ASC, tax_class_id ASC
  `).all().catch(() => ({ results: [] })));
  return rows.map((row) => ({
    tax_class_id: Number(row.tax_class_id || 0),
    code: row.code || '',
    name: row.name || '',
    description: row.description || '',
    tax_rate: Number(row.tax_rate || 0),
    is_active: Number(row.is_active || 0),
    created_at: row.created_at || null,
  }));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);

  const [optionSets, taxClasses] = await Promise.all([
    loadCatalogOptionSets(db),
    loadTaxClasses(db),
  ]);

  return json({ ok: true, option_sets: optionSets, tax_classes: taxClasses });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);

  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  const action = normalizeText(body.action).toLowerCase();

  if (action === 'save_option_set') {
    const optionSetName = normalizeText(body.option_set).toLowerCase();
    const key = OPTION_KEY_MAP[optionSetName];
    if (!key) return json({ ok: false, error: 'Unknown option_set.' }, 400);
    const values = uniqueSortedOptions(Array.isArray(body.values) ? body.values : []);
    const saved = await saveCatalogOptionSet(db, key, values, adminUser.user_id);
    await auditAdminAction(env, request, adminUser, {
      action_type: 'catalog_option_set_save',
      target_type: 'app_setting',
      target_key: key,
      details: { option_set: optionSetName, value_count: saved.length }
    });
    const optionSets = await loadCatalogOptionSets(db);
    return json({ ok: true, option_sets: optionSets, saved_option_set: optionSetName });
  }

  if (action === 'save_tax_class') {
    await ensureTaxClassesTable(db);
    const taxClassId = Number(body.tax_class_id || 0);
    const code = normalizeText(body.code).toUpperCase();
    const name = normalizeText(body.name);
    const description = normalizeText(body.description);
    const rawTaxRate = Number(body.tax_rate || 0);
    const taxRate = Number.isFinite(rawTaxRate) && rawTaxRate > 1 ? rawTaxRate / 100 : rawTaxRate;
    const isActive = Number(body.is_active) === 0 ? 0 : 1;
    if (!code || !name) return json({ ok: false, error: 'Tax code and name are required.' }, 400);
    if (!Number.isFinite(taxRate) || taxRate < 0) return json({ ok: false, error: 'Tax rate must be 0 or greater.' }, 400);

    if (taxClassId > 0) {
      await db.prepare(`
        UPDATE tax_classes
        SET code = ?, name = ?, description = ?, tax_rate = ?, is_active = ?
        WHERE tax_class_id = ?
      `).bind(code, name, description || null, taxRate, isActive, taxClassId).run();
    } else {
      await db.prepare(`
        INSERT INTO tax_classes (code, name, description, tax_rate, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(code, name, description || null, taxRate, isActive).run();
    }

    await auditAdminAction(env, request, adminUser, {
      action_type: taxClassId > 0 ? 'tax_class_update' : 'tax_class_create',
      target_type: 'tax_class',
      target_id: taxClassId || null,
      target_key: code,
      details: { code, name, tax_rate: taxRate, is_active: isActive }
    });

    return json({ ok: true, tax_classes: await loadTaxClasses(db), option_sets: await loadCatalogOptionSets(db) });
  }

  if (action === 'delete_tax_class') {
    await ensureTaxClassesTable(db);
    const taxClassId = Number(body.tax_class_id || 0);
    if (!taxClassId) return json({ ok: false, error: 'tax_class_id is required.' }, 400);
    const usage = await db.prepare(`SELECT COUNT(*) AS usage_count FROM products WHERE tax_class_id = ?`).bind(taxClassId).first().catch(() => ({ usage_count: 0 }));
    if (Number(usage?.usage_count || 0) > 0) {
      await db.prepare(`UPDATE tax_classes SET is_active = 0 WHERE tax_class_id = ?`).bind(taxClassId).run();
    } else {
      await db.prepare(`DELETE FROM tax_classes WHERE tax_class_id = ?`).bind(taxClassId).run();
    }
    await auditAdminAction(env, request, adminUser, {
      action_type: 'tax_class_delete_or_disable',
      target_type: 'tax_class',
      target_id: taxClassId,
      details: { usage_count: Number(usage?.usage_count || 0) }
    });
    return json({ ok: true, tax_classes: await loadTaxClasses(db), option_sets: await loadCatalogOptionSets(db) });
  }

  return json({ ok: false, error: 'Unknown action.' }, 400);
}
