const VPIC_API_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';

export function allowedYears() {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current + 1; y >= current - 20; y -= 1) years.push(y);
  return years;
}

export async function fetchVehicleMakes() {
  const seen = new Map();
  for (const type of ['car','truck','multipurpose passenger vehicle']) {
    const url = `${VPIC_API_BASE}/GetMakesForVehicleType/${encodeURIComponent(type)}?format=json`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Could not load vehicle makes from vPIC. ${await res.text()}`);
    const json = await res.json().catch(() => ({}));
    const rows = Array.isArray(json.Results) ? json.Results : [];
    for (const row of rows) {
      const name = String(row.MakeName || '').trim();
      const id = Number(row.MakeId || 0) || null;
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = seen.get(key);
      if (!existing) seen.set(key, { make_id: id, make: name });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.make.localeCompare(b.make));
}

export async function fetchVehicleModelsForMakeYear({ make, year }) {
  const safeMake = String(make || '').trim();
  const safeYear = Number(year || 0);
  if (!safeMake) throw new Error('Missing make.');
  if (!Number.isFinite(safeYear) || safeYear < 2006 || safeYear > new Date().getFullYear() + 1) throw new Error('Year out of supported range.');

  const out = [];
  const seen = new Set();
  for (const type of ['Passenger Car','Truck','Multipurpose Passenger Vehicle']) {
    const url = `${VPIC_API_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(safeMake)}/modelyear/${safeYear}/vehicletype/${encodeURIComponent(type)}?format=json`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) continue;
    const json = await res.json().catch(() => ({}));
    const rows = Array.isArray(json.Results) ? json.Results : [];
    for (const row of rows) {
      const model = String(row.Model_Name || row.ModelName || '').trim();
      const makeName = String(row.Make_Name || row.MakeName || safeMake).trim();
      if (!model) continue;
      const size = inferVehicleSize({ make: makeName, model, vehicleType: type });
      const key = `${makeName.toLowerCase()}|${model.toLowerCase()}|${type.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        make: makeName,
        model,
        vehicle_type: type,
        size_bucket: size.size_bucket,
        is_exotic: size.is_exotic,
        category_label: size.category_label,
        sort_group: size.sort_group
      });
    }
  }
  return out.sort((a, b) => a.model.localeCompare(b.model));
}

export function inferVehicleSize({ make, model, vehicleType }) {
  const hay = `${make || ''} ${model || ''} ${vehicleType || ''}`.toLowerCase();
  const exoticMakes = ['aston martin','bentley','bugatti','ferrari','lamborghini','lotus','mclaren','pagani','rolls-royce','rimac','koenigsegg'];
  const luxuryExoticModels = ['911 gt3','911 turbo','amg gt','db11','huracan','aventador','roma','488','720s','artura','revuelto','urus performante'];
  const oversizeWords = ['expedition','suburban','escalade esv','yukon xl','navigator l','sprinter','transit','silverado','sierra','f-150','f-250','f-350','ram 1500','ram 2500','tundra','titan','sequoia','wagoneer','grand wagoneer'];
  const midWords = ['suv','crossover','cr-v','rav4','cx-5','cx-50','rogue','escape','equinox','santa fe','sorento','sportage','outback','edge','pilot','highlander','model y','mach-e','passport','telluride','palisade','taos','tiguan'];
  const smallWords = ['civic','corolla','mazda3','elantra','jetta','sentra','golf','fit','yaris','rio','versa','forte','mini cooper','miata','mx-5','2 series','3 series','a3','a4'];
  const isExotic = exoticMakes.some((x) => hay.includes(x)) || luxuryExoticModels.some((x) => hay.includes(x));
  if (isExotic) return { size_bucket: 'oversize', is_exotic: true, category_label: 'Exotic', sort_group: 4 };
  if (oversizeWords.some((x) => hay.includes(x)) || /truck|van/i.test(vehicleType || '')) return { size_bucket: 'oversize', is_exotic: false, category_label: 'Oversized', sort_group: 3 };
  if (midWords.some((x) => hay.includes(x)) || /multipurpose/i.test(vehicleType || '')) return { size_bucket: 'mid', is_exotic: false, category_label: 'Mid-sized', sort_group: 2 };
  if (smallWords.some((x) => hay.includes(x)) || /passenger car/i.test(vehicleType || '')) return { size_bucket: 'small', is_exotic: false, category_label: 'Small car', sort_group: 1 };
  return { size_bucket: 'mid', is_exotic: false, category_label: 'Mid-sized', sort_group: 2 };
}

export async function cacheVehicleModels({ env, rows, year }) {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY || !Array.isArray(rows) || !rows.length) return;
  const payload = rows.map((row) => ({
    model_year: Number(year),
    make: row.make,
    model: row.model,
    vehicle_type: row.vehicle_type,
    size_bucket: row.size_bucket,
    is_exotic: row.is_exotic === true,
    source: 'nhtsa_vpic',
    last_seen_at: new Date().toISOString()
  }));
  await fetch(`${env.SUPABASE_URL}/rest/v1/vehicle_catalog_cache`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(payload)
  }).catch(() => null);
}
