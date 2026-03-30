// functions/api/_lib/pricing-catalog.js
// Canonical pricing catalog loader.
// Reads app_management_settings.pricing_catalog first, then falls back to bundled JSON.

import { serviceHeaders } from "./staff-session.js";

const FALLBACK_CATALOG = {"charts":[{"filename":"CarPrice2025.PNG","title":"Vehicle Price Chart 2025","r2_url":"https://assets.rosiedazzlers.ca/brand/CarPrice2025.PNG"},{"filename":"CarPriceDetails2025.PNG","title":"Package Service Details Chart","r2_url":"https://assets.rosiedazzlers.ca/brand/CarPriceDetails2025.PNG"},{"filename":"CarSizeChart.PNG","title":"Vehicle Size Chart","r2_url":"https://assets.rosiedazzlers.ca/packages/CarSizeChart.PNG"}],"packages":[{"code":"premium_wash","name":"Premium Wash","subtitle":"Quick exterior clean","prices_cad":{"small":85,"mid":105,"oversize":125},"deposit_cad":50,"images_by_size":{"small":"https://assets.rosiedazzlers.ca/packages/PremiumExternalWash.png","mid":"https://assets.rosiedazzlers.ca/packages/PremiumExternalWashMidSize.png","oversize":"https://assets.rosiedazzlers.ca/packages/PremiumExternalWashLargeSizeExotic.png"},"included_services":[{"name":"Hand Wash & Dry"},{"name":"Clean Dash & Centre Console"},{"name":"Clean Windows (In/Out)"},{"name":"Door Jambs"},{"name":"Wash Tires & Wheel Wells"}],"notes":["Quick exterior-focused clean","Main image changes with vehicle size"]},{"code":"basic_detail","name":"Basic Detail","subtitle":"Quick interior clean","prices_cad":{"small":115,"mid":135,"oversize":170},"deposit_cad":50,"images_by_size":{"small":"https://assets.rosiedazzlers.ca/packages/BasicInteriorDetailSmallSize.png","mid":"https://assets.rosiedazzlers.ca/packages/BasicInteriorDetailMidSize.png","oversize":"https://assets.rosiedazzlers.ca/packages/BasicInteriorDetailExotics.png"},"included_services":[{"name":"Full Vacuum (Seats, Carpets, Mats, Trunk)"},{"name":"Clean Dash & Centre Console"},{"name":"Clean Windows (In/Out)"},{"name":"Clean Leather / Vinyl Seats","optional_condition_note":"Where equipped"},{"name":"Door Jambs"},{"name":"Wash Tires & Wheel Wells"}],"notes":["Quick interior-focused package","Main image changes with vehicle size"]},{"code":"complete_detail","name":"Complete Detail","subtitle":"Our #1 choice","prices_cad":{"small":319,"mid":369,"oversize":419},"deposit_cad":100,"images_by_size":{"small":"https://assets.rosiedazzlers.ca/packages/CompleteDetailSmallCars.png","mid":"https://assets.rosiedazzlers.ca/packages/CompleteDetailMidSizelCars.png","oversize":"https://assets.rosiedazzlers.ca/packages/CompleteDetailOverSizeExoticCars.png"},"included_services":[{"name":"Hand Wash & Dry"},{"name":"Full Vacuum (Seats, Carpets, Mats, Trunk)"},{"name":"Clean Dash & Centre Console"},{"name":"Clean Windows (In/Out)"},{"name":"Door Jambs"},{"name":"Wash Tires & Wheel Wells"},{"name":"Clean Leather / Vinyl Seats","optional_condition_note":"Where equipped"},{"name":"Shampoo Carpets & Mats"},{"name":"Shampoo Cloth Seats","optional_condition_note":"Where equipped"}],"notes":["Best all-around package","Main image changes with vehicle size"]},{"code":"interior_detail","name":"Interior Detail","subtitle":"Full interior detailing","prices_cad":{"small":195,"mid":220,"oversize":245},"deposit_cad":100,"images_by_size":{"small":"https://assets.rosiedazzlers.ca/packages/FullInteriorDetailSmallCars.png","mid":"https://assets.rosiedazzlers.ca/packages/FullInteriorDetailMidSuvCars.png","oversize":"https://assets.rosiedazzlers.ca/packages/FullInteriorDetailLargeExoticCars.png"},"included_services":[{"name":"Full Vacuum (Seats, Carpets, Mats, Trunk)"},{"name":"Clean Dash & Centre Console"},{"name":"Clean Windows (In/Out)"},{"name":"Clean Leather / Vinyl Seats","optional_condition_note":"Where equipped"},{"name":"Shampoo Carpets & Mats"},{"name":"Shampoo Cloth Seats","optional_condition_note":"Where equipped"}],"notes":["Interior-only full detailing package","Main image changes with vehicle size"]},{"code":"exterior_detail","name":"Exterior Detail","subtitle":"Full exterior detailing","prices_cad":{"small":195,"mid":220,"oversize":245},"deposit_cad":100,"images_by_size":{"small":"https://assets.rosiedazzlers.ca/packages/FullExteriorDetailSmallSizeCars.png","mid":"https://assets.rosiedazzlers.ca/packages/FullExteriorDetailMidSizeCars.png","oversize":"https://assets.rosiedazzlers.ca/packages/FullExteriorDetailLargeExoticCars.png"},"included_services":[{"name":"Hand Wash & Dry"},{"name":"Clean Windows (In/Out)"},{"name":"Door Jambs"},{"name":"Wash Tires & Wheel Wells"}],"notes":["Exterior-only full detailing package","Main image changes with vehicle size"]}],"service_matrix":[{"service":"Hand Wash & Dry","included_in":{"premium_wash":true,"basic_detail":false,"complete_detail":true,"interior_detail":false,"exterior_detail":true}},{"service":"Full Vacuum (Seats, Carpets, Mats, Trunk)","included_in":{"premium_wash":false,"basic_detail":true,"complete_detail":true,"interior_detail":true,"exterior_detail":false}},{"service":"Clean Dash & Centre Console","included_in":{"premium_wash":true,"basic_detail":true,"complete_detail":true,"interior_detail":true,"exterior_detail":false}},{"service":"Clean Windows (In/Out)","included_in":{"premium_wash":true,"basic_detail":true,"complete_detail":true,"interior_detail":true,"exterior_detail":true}},{"service":"Door Jambs","included_in":{"premium_wash":true,"basic_detail":true,"complete_detail":true,"interior_detail":false,"exterior_detail":true}},{"service":"Wash Tires & Wheel Wells","included_in":{"premium_wash":true,"basic_detail":true,"complete_detail":true,"interior_detail":false,"exterior_detail":true}},{"service":"Clean Leather / Vinyl Seats","conditional_note":"Where equipped","included_in":{"premium_wash":false,"basic_detail":true,"complete_detail":true,"interior_detail":true,"exterior_detail":false}},{"service":"Shampoo Carpets & Mats","included_in":{"premium_wash":false,"basic_detail":false,"complete_detail":true,"interior_detail":true,"exterior_detail":false}},{"service":"Shampoo Cloth Seats","conditional_note":"Where equipped","included_in":{"premium_wash":false,"basic_detail":false,"complete_detail":true,"interior_detail":true,"exterior_detail":false}}],"addons":[{"code":"full_clay_treatment","name":"Full Clay Treatment","prices_cad":{"small":79,"mid":99,"oversize":129},"quote_required":false,"source":"interpreted_pricing","notes":["Add-on service not included in any package"]},{"code":"two_stage_polish","name":"Two Stage Polish","prices_cad":{"small":199,"mid":279,"oversize":359},"quote_required":true,"source":"interpreted_pricing","notes":["Quote required because paint condition varies"]},{"code":"high_grade_paint_sealant","name":"High Grade Paint Sealant","prices_cad":{"small":59,"mid":79,"oversize":99},"quote_required":false,"source":"interpreted_pricing"},{"code":"uv_protectant_applied_on_interior_panels","name":"UV Protectant Applied on Interior Panels","prices_cad":{"small":25,"mid":35,"oversize":45},"quote_required":false,"source":"interpreted_pricing"},{"code":"de_ionizing_treatment","name":"De-Ionizing Treatment","prices_cad":{"small":59,"mid":79,"oversize":99},"quote_required":true,"source":"package_asset"},{"code":"de_badging","name":"De-Badging","quote_required":true,"source":"package_asset"},{"code":"engine_cleaning","name":"Engine Cleaning","price_cad":59,"quote_required":false,"source":"package_asset"},{"code":"external_ceramic_coating","name":"External Ceramic Coating","price_cad":299,"quote_required":true,"source":"package_asset","notes":["Starting price only"]},{"code":"external_graphene_fine_finish","name":"External Graphene Fine Finish","price_cad":249,"quote_required":true,"source":"package_asset","notes":["Starting price only"]},{"code":"external_wax","name":"External Wax","prices_cad":{"small":49,"mid":59,"oversize":69},"quote_required":false,"source":"package_asset"},{"code":"vinyl_wrapping","name":"Vinyl Wrapping","quote_required":true,"source":"package_asset"},{"code":"window_tinting","name":"Window Tinting","quote_required":true,"source":"package_asset"}]};

export async function loadPricingCatalog(env) {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
    return normalizeCatalog(FALLBACK_CATALOG);
  }

  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/app_management_settings?select=key,value&key=eq.pricing_catalog&limit=1`,
      { headers: serviceHeaders(env) }
    );

    if (res.ok) {
      const rows = await res.json().catch(() => []);
      const row = Array.isArray(rows) ? rows[0] || null : null;
      if (row && row.value && typeof row.value === "object") {
        return normalizeCatalog(row.value);
      }
    }
  } catch {}

  return normalizeCatalog(FALLBACK_CATALOG);
}

export function normalizeCatalog(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const charts = Array.isArray(source.charts) ? source.charts : [];
  const packages = Array.isArray(source.packages) ? source.packages : [];
  const addons = Array.isArray(source.addons) ? source.addons : [];

  const packageMap = Object.create(null);
  const addonMap = Object.create(null);

  for (const pkg of packages) {
    const code = String(pkg?.code || "").trim();
    if (!code) continue;
    packageMap[code] = {
      code,
      name: String(pkg?.name || code).trim(),
      subtitle: String(pkg?.subtitle || "").trim() || null,
      deposit_cad: toMoney(pkg?.deposit_cad),
      prices_cad: normalizeSizeMap(pkg?.prices_cad)
    };
  }

  for (const addon of addons) {
    const code = String(addon?.code || "").trim();
    if (!code) continue;
    addonMap[code] = {
      code,
      name: String(addon?.name || code).trim(),
      quote_required: addon?.quote_required === true,
      prices_cad: normalizeSizeMap(addon?.prices_cad),
      notes: Array.isArray(addon?.notes) ? addon.notes.map((v) => String(v || "").trim()).filter(Boolean) : []
    };
  }

  return {
    charts,
    packages,
    addons,
    package_map: packageMap,
    addon_map: addonMap
  };
}

function normalizeSizeMap(value) {
  const map = value && typeof value === "object" ? value : {};
  return {
    small: toMoney(map.small),
    mid: toMoney(map.mid),
    oversize: toMoney(map.oversize)
  };
}

function toMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
