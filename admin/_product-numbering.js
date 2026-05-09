export const DEFAULT_PRODUCT_NUMBER_START = 1000;

function parsePositiveInt(value, fallback = DEFAULT_PRODUCT_NUMBER_START) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function getProductNumberStart(db) {
  if (!db || typeof db.prepare !== 'function') return DEFAULT_PRODUCT_NUMBER_START;
  try {
    const row = await db.prepare(`
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = 'site.catalog.product_number_start'
      LIMIT 1
    `).first();
    return parsePositiveInt(row?.setting_value, DEFAULT_PRODUCT_NUMBER_START);
  } catch {
    return DEFAULT_PRODUCT_NUMBER_START;
  }
}

export async function getNextProductNumber(db) {
  const start = await getProductNumberStart(db);
  if (!db || typeof db.prepare !== 'function') return start;
  try {
    const row = await db.prepare(`
      SELECT CASE
        WHEN MAX(product_number) IS NULL OR MAX(product_number) < ? THEN ?
        ELSE MAX(product_number) + 1
      END AS next_product_number
      FROM products
    `).bind(start, start).first();
    return parsePositiveInt(row?.next_product_number, start);
  } catch {
    return start;
  }
}
