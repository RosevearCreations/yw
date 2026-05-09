// File: /functions/api/admin/_catalog-options.js
import { normalizeText } from "../_lib/adminAudit.js";

export const DEFAULT_CATEGORY_OPTIONS = [
  'Rings',
  'Necklaces',
  'Bracelets',
  'Earrings',
  'Pendants',
  'CNC Components',
  '3D Printed Items',
  'Laser Engraved Items',
  'Polymer Clay Items',
  'Home Decor',
  'Accessories',
  'Other'
];

export const DEFAULT_COLOR_OPTIONS = [
  'Silver',
  'Gold',
  'Black',
  'White',
  'Red',
  'Blue',
  'Green',
  'Purple',
  'Pink',
  'Orange',
  'Yellow',
  'Brown',
  'Clear',
  'Multicolor'
];

export const DEFAULT_SHIPPING_CODE_OPTIONS = [
  'standard-jewelry',
  'small-parcel',
  'oversize',
  'pickup-only',
  'digital'
];

function normalizeArrayValue(value) {
  return normalizeText(value).replace(/\s+/g, ' ');
}

export function uniqueSortedOptions(values = []) {
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map(normalizeArrayValue).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

async function readSetting(db, key) {
  try {
    const row = await db
      .prepare(`SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`)
      .bind(key)
      .first();
    return row?.setting_value || '';
  } catch {
    return '';
  }
}

async function readProductDistinctValues(db, columnName) {
  try {
    const rows = await db
      .prepare(`
        SELECT DISTINCT TRIM(${columnName}) AS option_value
        FROM products
        WHERE TRIM(COALESCE(${columnName}, '')) != ''
        ORDER BY LOWER(TRIM(${columnName})) ASC
      `)
      .all();

    return (Array.isArray(rows?.results) ? rows.results : [])
      .map((row) => normalizeArrayValue(row?.option_value))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function parseSettingArray(db, key) {
  const raw = normalizeText(await readSetting(db, key));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return uniqueSortedOptions(Array.isArray(parsed) ? parsed : []);
  } catch {
    return uniqueSortedOptions(raw.split(/[\r\n,]+/g));
  }
}

export async function loadCatalogOptionSets(db) {
  const [
    savedCategories,
    savedColors,
    savedShipping,
    productCategories,
    productColors,
    productShipping
  ] = await Promise.all([
    parseSettingArray(db, 'site.catalog.product_category_options'),
    parseSettingArray(db, 'site.catalog.color_options'),
    parseSettingArray(db, 'site.catalog.shipping_code_options'),
    readProductDistinctValues(db, 'product_category'),
    readProductDistinctValues(db, 'color_name'),
    readProductDistinctValues(db, 'shipping_code')
  ]);

  return {
    category_options: uniqueSortedOptions([
      ...DEFAULT_CATEGORY_OPTIONS,
      ...savedCategories,
      ...productCategories
    ]),
    color_options: uniqueSortedOptions([
      ...DEFAULT_COLOR_OPTIONS,
      ...savedColors,
      ...productColors
    ]),
    shipping_code_options: uniqueSortedOptions([
      ...DEFAULT_SHIPPING_CODE_OPTIONS,
      ...savedShipping,
      ...productShipping
    ])
  };
}

export async function saveCatalogOptionSet(db, key, values, updatedByUserId = null) {
  const normalized = uniqueSortedOptions(values);

  await db
    .prepare(`
      INSERT INTO app_settings (
        setting_key,
        setting_value,
        is_public,
        updated_by_user_id,
        updated_at
      )
      VALUES (?, ?, 0, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(key, JSON.stringify(normalized), updatedByUserId || null)
    .run();

  return normalized;
}
