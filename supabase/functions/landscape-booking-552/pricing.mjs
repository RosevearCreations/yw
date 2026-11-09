// YW 552: deterministic server-side quote calculation; this is never a booking.
const types = new Set(['service', 'addon', 'disposal']);
const units = new Set(['visit', 'hour', 'square_metre', 'cubic_yard', 'bag', 'load', 'item']);
const seasons = ['winter', 'spring', 'summer', 'fall'];

export function seasonFor(dateText, today = new Date().toISOString().slice(0, 10)) {
  const parse = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Enter a valid requested date.');
    const [y, m, d] = value.split('-').map(Number);
    const time = Date.UTC(y, m - 1, d);
    if (new Date(time).toISOString().slice(0, 10) !== value) throw Error('Enter a real calendar date.');
    return time;
  };
  const todayTime = parse(today);
  const chosen = dateText ? parse(dateText) : todayTime;
  if (chosen < todayTime || chosen > todayTime + 366 * 86400000) {
    throw Error('Requested date must be within the next 12 months.');
  }
  const month = Number(new Date(chosen).toISOString().slice(5, 7));
  return { season: seasons[Math.floor((month % 12) / 3)], requestedDate: dateText || null };
}

export function quoteFor(companyId, catalogue, selections, season) {
  if (typeof companyId !== 'string' || !companyId || !seasons.includes(season)) throw Error('Unverified company or season.');
  if (!Array.isArray(catalogue) || catalogue.length > 100 || !Array.isArray(selections) || selections.length < 1 || selections.length > 15) {
    throw Error('Choose between 1 and 15 service or add-on entries.');
  }
  const byCode = new Map();
  for (const row of catalogue) {
    if (!row || row.company_id !== companyId || !/^[a-z0-9][a-z0-9_-]{1,39}$/.test(row.code) ||
      !types.has(row.item_type) || !units.has(row.unit) || !row.active ||
      !Number.isSafeInteger(row.base_price_cents) || row.base_price_cents < 0 || row.base_price_cents > 100000000 ||
      byCode.has(row.code)) throw Error('Company catalogue is unavailable or invalid.');
    const seasonal = row[season + '_price_cents'];
    if (seasonal != null && (!Number.isSafeInteger(seasonal) || seasonal < 0 || seasonal > 100000000)) {
      throw Error('Seasonal price is invalid.');
    }
    byCode.set(row.code, row);
  }
  const seen = new Set();
  const lines = [];
  let subtotal = 0;
  let disposalEstimate = 0;
  let services = 0;
  for (const selected of selections) {
    if (!selected || typeof selected.code !== 'string' || seen.has(selected.code) ||
      !Number.isSafeInteger(selected.quantity) || selected.quantity < 1 || selected.quantity > 100) {
      throw Error('Each selected item needs a unique code and a whole quantity from 1 to 100.');
    }
    seen.add(selected.code);
    const row = byCode.get(selected.code);
    if (!row) throw Error('A selected item is no longer available. Refresh the catalogue.');
    const unitPrice = row[season + '_price_cents'] ?? row.base_price_cents;
    const lineTotal = unitPrice * selected.quantity;
    subtotal += lineTotal;
    if (!Number.isSafeInteger(subtotal) || subtotal > 100000000) throw Error('Estimated subtotal exceeds the request limit.');
    if (row.item_type === 'service') services++;
    if (row.item_type === 'disposal') disposalEstimate += lineTotal;
    lines.push({ code: row.code, name: row.name, item_type: row.item_type, unit: row.unit,
      quantity: selected.quantity, unit_price_cents: unitPrice, line_total_cents: lineTotal });
  }
  if (!services) throw Error('Choose at least one landscaping service.');
  return { season, currency: 'CAD', subtotal_cents: subtotal, disposal_estimate_cents: disposalEstimate,
    tax_included: false, availability_confirmed: false, lines };
}
