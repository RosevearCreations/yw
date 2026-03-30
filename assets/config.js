// assets/config.js
// Central config for assets + pricing + package imagery.
// Assumes your R2 custom domain is: https://assets.rosiedazzlers.ca
// and your objects are organized like:
//   brand/...
//   packages/...
//   products/...
//   systems/...

export const ASSETS_BASE = "https://assets.rosiedazzlers.ca";

export const PATHS = {
  brand: "brand",
  packages: "packages",
  products: "products",
  systems: "systems",
};

export const CONTACT = {
  phone: "226-752-7613",
  email: "info@rosiedazzlers.ca",
  serviceArea: "Norfolk & Oxford Counties",
};

export function assetUrl(folder, filename) {
  return `${ASSETS_BASE}/${folder}/${encodeURIComponent(filename)}`.replaceAll("%2F", "/");
}

// Must match backend pricing keys in functions/api/checkout.js
// Values are cents (CAD) from your current pricing chart.
export const PRICING = {
  premium_wash: {
    label: "Premium Wash",
    subtitle: "Exterior wash + quick finish",
    small: 8500,
    mid: 10500,
    oversize: 12500,
  },
  basic_detail: {
    label: "Basic Detail",
    subtitle: "Basic interior clean",
    small: 11500,
    mid: 13500,
    oversize: 17000,
  },
  complete_detail: {
    label: "Complete Detail",
    subtitle: "Our most popular",
    small: 31900,
    mid: 36900,
    oversize: 41900,
  },
  interior_detail: {
    label: "Interior Detail",
    subtitle: "Full interior detailing",
    small: 19500,
    mid: 22000,
    oversize: 24500,
  },
  exterior_detail: {
    label: "Exterior Detail",
    subtitle: "Full exterior detailing",
    small: 19500,
    mid: 22000,
    oversize: 24500,
  },
};

// Package images (must exist in R2 under packages/<filename>)
export const PACKAGE_MEDIA = {
  premium_wash: {
    small: "PremiumExternalWash.png",
    mid: "PremiumExternalWashMidSize.png",
    oversize: "PremiumExternalWashLargeSizeExotic.png",
  },
  basic_detail: {
    small: "BasicInteriorDetailSmallSize.png",
    mid: "BasicInteriorDetailMidSize.png",
    oversize: "BasicInteriorDetailExotics.png",
  },
  complete_detail: {
    small: "CompleteDetailSmallCars.png",
    mid: "CompleteDetailMidSizelCars.png",
    oversize: "CompleteDetailOverSizeExoticCars.png",
  },
  interior_detail: {
    small: "FullInteriorDetailSmallCars.png",
    mid: "FullInteriorDetailMidSuvCars.png",
    oversize: "FullInteriorDetailLargeExoticCars.png",
  },
  exterior_detail: {
    small: "FullExteriorDetailSmallSizeCars.png",
    mid: "FullExteriorDetailMidSizeCars.png",
    oversize: "FullExteriorDetailLargeExoticCars.png",
  },
};

// Charts
export const CHARTS = {
  price: "CarPrice2025.PNG",
  includes: "CarPriceDetails2025.PNG",
  size: "CarSizeChart.PNG",
  size_small: "SmallCar.png",
  size_mid: "MidSizedCars.png",
  size_oversize: "ExoticLargeSizedCars.png",
};

// Must match backend addon keys in functions/api/checkout.js
// cents values are stored in cents CAD.
// quote_required items are shown to the customer but not charged online.
export const ADDONS = {
  full_clay_treatment: {
    label: "Full Clay Treatment",
    prices_cents: { small: 7900, mid: 9900, oversize: 12900 },
    quote_required: false,
  },
  two_stage_polish: {
    label: "Two Stage Polish",
    prices_cents: { small: 19900, mid: 27900, oversize: 35900 },
    quote_required: true,
  },
  high_grade_paint_sealant: {
    label: "High Grade Paint Sealant",
    prices_cents: { small: 5900, mid: 7900, oversize: 9900 },
    quote_required: false,
  },
  uv_protectant_applied_on_interior_panels: {
    label: "UV Protectant Applied on Interior Panels",
    prices_cents: { small: 2500, mid: 3500, oversize: 4500 },
    quote_required: false,
  },
  de_ionizing_treatment: {
    label: "De-Ionizing Treatment",
    quote_required: true,
  },
  de_badging: {
    label: "De-Badging",
    quote_required: true,
  },
  engine_cleaning: {
    label: "Engine Cleaning",
    price_cents: 5900,
    quote_required: false,
  },
  external_ceramic_coating: {
    label: "External Ceramic Coating",
    quote_required: true,
  },
  external_graphene_fine_finish: {
    label: "External Graphene Fine Finish",
    quote_required: true,
  },
  external_wax: {
    label: "External Wax",
    prices_cents: { small: 4900, mid: 5900, oversize: 6900 },
    quote_required: false,
  },
  vinyl_wrapping: {
    label: "Vinyl Wrapping",
    quote_required: true,
  },
  window_tinting: {
    label: "Window Tinting",
    quote_required: true,
  },
};

// Must match backend deposit rule
export function calcDepositCents(packageCode) {
  return packageCode === "premium_wash" || packageCode === "basic_detail" ? 5000 : 10000;
}

export function money(cents) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format((cents || 0) / 100);
}
