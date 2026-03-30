const DATA_URL = "/api/pricing_catalog_public";

const BRAND = {
  logo: "https://assets.rosiedazzlers.ca/brand/Untitled.png",
  banner: "https://assets.rosiedazzlers.ca/brand/RosieDazzlersBanner.png",
  reviews: "https://assets.rosiedazzlers.ca/brand/RosieReviews.png"
};

const CONTACT = {
  phone: "226-752-7613",
  email: "info@rosiedazzlers.ca",
  serviceArea: "Norfolk & Oxford Counties"
};

// Base URL for package media in R2 (filenames include spaces)
const PACKAGES_BASE = "https://assets.rosiedazzlers.ca/packages/";
const pkgFile = (filename) => encodeURI(`${PACKAGES_BASE}${filename}`);

// Hover/rotation images shown on package cards (these filenames MUST match R2 exactly)
const HOVER_MEDIA = {
  exterior: pkgFile("Exterior Detail.png"),
  interior: pkgFile("Interior Detail.png"),
  size: pkgFile("CarSizeChart.PNG")
};

const ADDON_MEDIA = {
  full_clay_treatment: '/assets/addons/full_clay_treatment.svg',
  two_stage_polish: '/assets/addons/two_stage_polish.svg',
  high_grade_paint_sealant: '/assets/addons/high_grade_paint_sealant.svg',
  uv_protectant_applied_on_interior_panels: '/assets/addons/uv_protectant_applied_on_interior_panels.svg',
  de_ionizing_treatment: '/assets/addons/de_ionizing_treatment.svg',
  de_badging: '/assets/addons/de_badging.svg',
  engine_cleaning: '/assets/addons/engine_cleaning.svg',
  external_ceramic_coating: '/assets/addons/external_ceramic_coating.svg',
  external_graphene_fine_finish: '/assets/addons/external_graphene_fine_finish.svg',
  external_wax: '/assets/addons/external_wax.svg',
  vinyl_wrapping: '/assets/addons/vinyl_wrapping.svg',
  window_tinting: '/assets/addons/window_tinting.svg'
};

let _servicesData = null;

async function loadServicesData() {
  if (_servicesData) return _servicesData;
  const res = await fetch(`${DATA_URL}?v=20260301e`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load ${DATA_URL}`);
  _servicesData = await res.json();
  return _servicesData;
}

function money(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD"
  }).format(Number(value || 0));
}

function getPackageByCode(data, code) {
  return (data.packages || []).find((p) => p.code === code) || null;
}

function packagePrice(pkg, size) {
  return Number(pkg?.prices_cad?.[size] || 0);
}

function packageImageForSize(pkg, size) {
  return pkg?.images_by_size?.[size] || "";
}

function addonImageForCode(code) {
  return ADDON_MEDIA[code] || "";
}

function addonDisplay(addon, size) {
  if (addon.quote_required === true) {
    if (addon.prices_cad?.[size] != null) return `From ${money(addon.prices_cad[size])} · Quote required`;
    if (addon.price_cad != null) return `From ${money(addon.price_cad)} · Quote required`;
    return "Quote required";
  }
  if (addon.prices_cad?.[size] != null) return money(addon.prices_cad[size]);
  if (addon.price_cad != null) return money(addon.price_cad);
  return "Quote required";
}

function addonCharge(addon, size) {
  if (!addon || addon.quote_required === true) return 0;
  if (addon.prices_cad?.[size] != null) return Number(addon.prices_cad[size]);
  if (addon.price_cad != null) return Number(addon.price_cad);
  return 0;
}

function calcDeposit(pkg) {
  return Number(pkg?.deposit_cad || 0);
}

function ensureLightbox() {
  let lb = document.querySelector("#lightbox");
  if (lb) return lb;

  lb = document.createElement("div");
  lb.id = "lightbox";
  lb.className = "lightbox";
  lb.innerHTML = `
    <div class="lightbox-inner">
      <div class="lightbox-top">
        <div class="title" id="lbTitle"></div>
        <button class="btn small ghost" id="lbClose" type="button">Close</button>
      </div>
      <img id="lbImg" alt="">
      <div class="kicker">Tip: right-click → open image in new tab</div>
    </div>
  `;
  document.body.appendChild(lb);

  const close = () => lb.classList.remove("open");
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  lb.querySelector("#lbClose").addEventListener("click", close);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  return lb;
}

export function openLightbox(title, src) {
  const lb = ensureLightbox();
  lb.querySelector("#lbTitle").textContent = title || "";
  const img = lb.querySelector("#lbImg");
  img.src = src;
  img.alt = title || "";
  lb.classList.add("open");
}

export function setBrandImages() {
  const logo = document.querySelector("[data-logo]");
  if (logo) logo.src = BRAND.logo;

  const banner = document.querySelector("[data-banner]");
  if (banner) banner.src = BRAND.banner;

  const reviews = document.querySelector("[data-reviews]");
  if (reviews) reviews.src = BRAND.reviews;
}

export function setFooter() {
  const el = document.querySelector("[data-footer]");
  if (!el) return;
  el.innerHTML = `
    <div><strong>Rosie Dazzlers Mobile Auto Detailing</strong> — ${CONTACT.serviceArea}</div>
    <div>Phone: <a href="tel:${CONTACT.phone}">${CONTACT.phone}</a> · Email: <a href="mailto:${CONTACT.email}">${CONTACT.email}</a></div>
    <div class="kicker">Driveway required · customer provides power + water (or additional charges may apply).</div>
  `;
}

export function handleCheckoutReturn() {
  const params = new URLSearchParams(location.search);
  const state = params.get("checkout");
  const bid = params.get("bid");

  const box = document.querySelector("[data-checkout-status]");
  if (!box || !state) return;

  if (state === "success") {
    box.className = "notice ok";
    box.innerHTML = `<strong>Deposit received.</strong> Booking ID: <code>${bid || ""}</code><br>We’ll confirm details by email.`;
  } else if (state === "cancel") {
    box.className = "notice warn";
    box.innerHTML = `<strong>Checkout cancelled.</strong> Booking ID: <code>${bid || ""}</code><br>No deposit was taken. You can try again.`;
  }
}

function chartButtons(data, selectorMap) {
  const charts = data.charts || [];
  const byName = Object.fromEntries(charts.map((c) => [c.filename, c]));

  // Fallbacks (some charts exist in /packages, and some may not exist in /brand)
  const FALLBACK = {
    "CarPrice2025.PNG": "https://assets.rosiedazzlers.ca/brand/CarPrice2025.PNG",
    "CarPriceDetails2025.PNG": "https://assets.rosiedazzlers.ca/brand/CarPriceDetails2025.PNG",
    // IMPORTANT: Size chart is served from /packages (brand/CarSizeChart.PNG may be missing)
    "CarSizeChart.PNG": pkgFile("CarSizeChart.PNG")
  };

  const resolveSrc = (name) => {
    // Force the packages copy for the size chart
    if (name === "CarSizeChart.PNG") return FALLBACK[name];

    const src = byName[name]?.r2_url || FALLBACK[name] || "";
    return src;
  };

  const bind = (selector, name, title) => {
    const el = document.querySelector(selector);
    const src = resolveSrc(name);
    if (!el || !src) return;
    el.addEventListener("click", () => openLightbox(title, src));
  };

  if (selectorMap.price) bind(selectorMap.price, "CarPrice2025.PNG", "Vehicle Price Chart 2025");
  if (selectorMap.details) bind(selectorMap.details, "CarPriceDetails2025.PNG", "Package Service Details Chart");
  if (selectorMap.size) bind(selectorMap.size, "CarSizeChart.PNG", "Vehicle Size Chart");
}

function buildMainCardGallery(pkg, size) {
  const gallery = [];
  const main = packageImageForSize(pkg, size);
  if (main) gallery.push(main);
  gallery.push(HOVER_MEDIA.exterior, HOVER_MEDIA.interior, HOVER_MEDIA.size);
  return [...new Set(gallery.filter(Boolean))];
}

function attachHoverCarousel(root) {
  const wraps = root.querySelectorAll("[data-carousel]");
  wraps.forEach((wrap) => {
    const imgs = [...wrap.querySelectorAll("img")];
    if (imgs.length <= 1) return;

    let current = 0;
    let timer = null;

    const show = (idx) => {
      imgs.forEach((img, i) => img.classList.toggle("active", i === idx));
    };

    show(0);

    wrap.addEventListener("mouseenter", () => {
      if (timer) return;
      timer = setInterval(() => {
        current = (current + 1) % imgs.length;
        show(current);
      }, 1200);
    });

    wrap.addEventListener("mouseleave", () => {
      clearInterval(timer);
      timer = null;
      current = 0;
      show(0);
    });
  });
}

function renderMainPackages(cardsEl, data, size) {
  if (!cardsEl) return;
  cardsEl.innerHTML = "";

  for (const pkg of data.packages || []) {
    const price = packagePrice(pkg, size);
    const deposit = calcDeposit(pkg);
    const gallery = buildMainCardGallery(pkg, size);

    const included = (pkg.included_services || [])
      .map((s) => {
        const note = s.optional_condition_note ? ` <span class="note">${s.optional_condition_note}</span>` : "";
        return `<li>${s.name}${note}</li>`;
      })
      .join("");

    const notes = (pkg.notes || []).map((n) => `<div class="tag">${n}</div>`).join("");

    const mediaHtml = `
      <div class="service-media" data-carousel>
        ${gallery.map((src, i) => `<img loading="lazy" src="${src}" alt="${pkg.name}" class="${i === 0 ? "active" : ""}" onerror="this.style.display='none'">`).join("")}
      </div>
    `;

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      ${mediaHtml}
      <h3>${pkg.name}</h3>
      <p>${pkg.subtitle || ""}</p>
      <div class="price">${money(price)} <span class="kicker">(${size.toUpperCase()})</span></div>
      <div class="kicker">Deposit: ${money(deposit)}</div>
      <div class="hr"></div>
      <ul class="list">${included}</ul>
      <div class="hr"></div>
      ${notes}
      <div class="hr"></div>
      <a class="btn primary" href="/book?package=${encodeURIComponent(pkg.code)}&size=${encodeURIComponent(size)}">Book this</a>
    `;
    cardsEl.appendChild(div);
  }

  attachHoverCarousel(cardsEl);
}

function renderAddons(cardsEl, data, size) {
  if (!cardsEl) return;
  cardsEl.innerHTML = "";

  for (const addon of data.addons || []) {
    const img = addonImageForCode(addon.code);
    const display = addonDisplay(addon, size);

    const tags = [];
    if (addon.quote_required) tags.push(`<span class="tag quote">Quote</span>`);
    if (addon.source) tags.push(`<span class="tag">${addon.source}</span>`);

    const notes = (addon.notes || []).map((n) => `<div class="kicker">${n}</div>`).join("");

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      ${img ? `<img class="img" loading="lazy" src="${img}" alt="${addon.name}" onerror="this.style.display='none'">` : ""}
      <h3>${addon.name}</h3>
      <p class="kicker">${display}</p>
      ${tags.length ? `<div class="hr"></div><div>${tags.join(" ")}</div>` : ""}
      ${notes ? `<div class="hr"></div>${notes}` : ""}
    `;
    cardsEl.appendChild(div);
  }
}

export async function initServicesPage() {
  const data = await loadServicesData();

  const sizeSel = document.querySelector("#size");
  const cardsEl = document.querySelector("#packageCards");

  const render = () => {
    const size = sizeSel?.value || "small";
    renderMainPackages(cardsEl, data, size);
  };

  sizeSel?.addEventListener("change", render);
  render();

  chartButtons(data, {
    price: "#openPrice",
    details: "#openDetails",
    size: "#openSize"
  });
}

export async function initPricingPage() {
  const data = await loadServicesData();

  const sizeSel = document.querySelector("#size");
  const cardsEl = document.querySelector("#pricingCards");
  const addonsEl = document.querySelector("#pricingAddons");

  const render = () => {
    const size = sizeSel?.value || "small";
    renderMainPackages(cardsEl, data, size);
    renderAddons(addonsEl, data, size);
  };

  sizeSel?.addEventListener("change", render);
  render();

  chartButtons(data, {
    price: "#openPrice",
    details: "#openDetails",
    size: "#openSize"
  });
}

// ---------- Booking page (legacy form-based) ----------
export async function initBookingPage() {
  const data = await loadServicesData();

  const form = document.querySelector("#bookingForm");
  if (!form) return;

  const packageSummary = document.querySelector("#packageSummary");
  const addonPicker = document.querySelector("#addonPicker");
  const availBox = document.querySelector("#availBox");
  const priceBox = document.querySelector("#priceBox");
  const submitBtn = document.querySelector("#submitBtn");

  const params = new URLSearchParams(location.search);
  const qpPackage = params.get("package");
  const qpSize = params.get("size");

  if (form.package_code && !form.package_code.dataset.built) {
    form.package_code.innerHTML = (data.packages || [])
      .map((p) => `<option value="${p.code}">${p.name}</option>`)
      .join("");
    form.package_code.dataset.built = "1";
  }

  if (qpPackage && form.package_code) form.package_code.value = qpPackage;
  if (qpSize && form.vehicle_size) form.vehicle_size.value = qpSize;

  const redraw = async (checkDate = false) => {
    const previouslySelected = selectedAddonCodes(form);
    const size = currentSize(form);
    const pkg = getPackageByCode(data, currentPackageCode(form));

    renderPackageSummary(packageSummary, pkg);
    renderAddonPicker(addonPicker, data, size, previouslySelected);

    const totals = calcBookingTotals(form, data);

    priceBox.className = "notice";
    priceBox.innerHTML = `
      <div><strong>Estimate</strong></div>
      <div>Base: ${money(totals.base)} · Priced add-ons: ${money(totals.pricedAddons)} · <strong>Total: ${money(totals.total)}</strong></div>
      <div class="kicker">Deposit due now: <strong>${money(totals.deposit)}</strong></div>
      ${totals.quoteAddons.length ? `<div class="kicker">Quote add-ons selected: ${totals.quoteAddons.join(", ")} (not included in online total)</div>` : ""}
    `;

    if (checkDate && form.service_date?.value) {
      const avail = await checkAvailability(form.service_date.value);
      if (avail?.blocked) {
        availBox.className = "notice bad";
        availBox.innerHTML = `This date is blocked: ${avail.reason || "Blocked"}`;
      } else if (avail) {
        availBox.className = "notice ok";
        availBox.innerHTML = `
          <strong>Availability for ${avail.date}</strong><br>
          AM: ${avail.AM ? "✅ Available" : "❌ Not available"} ·
          PM: ${avail.PM ? "✅ Available" : "❌ Not available"}
          <div class="kicker">Pending holds expire after ~${avail.hold_minutes || 30} minutes.</div>
        `;
      }
    }
  };

  await redraw(false);

  form.package_code?.addEventListener("change", () => redraw(false));
  form.vehicle_size?.addEventListener("change", () => redraw(false));
  addonPicker.addEventListener("change", () => redraw(false));
  form.service_date?.addEventListener("change", () => redraw(true));

  chartButtons(data, {
    price: "[data-open-price]",
    details: "[data-open-details]",
    size: "[data-open-size]"
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating checkout…";

    try {
      const totals = calcBookingTotals(form, data);

      const payload = {
        service_date: form.service_date.value,
        start_slot: form.start_slot.value,
        duration_slots: Number(form.duration_slots.value),
        service_area: form.service_area.value,

        package_code: form.package_code.value,
        vehicle_size: form.vehicle_size.value,

        customer_name: form.customer_name.value,
        customer_email: form.customer_email.value,
        customer_phone: form.customer_phone.value,

        address_line1: form.address_line1.value,
        city: form.city.value,
        postal_code: form.postal_code.value,

        addon_codes: totals.selectedCodes,

        ack_driveway: form.ack_driveway.checked,
        ack_power_water: form.ack_power_water.checked,
        ack_bylaw: form.ack_bylaw.checked,
        ack_cancellation: form.ack_cancellation.checked
      };

      if (!payload.ack_driveway || !payload.ack_power_water || !payload.ack_bylaw || !payload.ack_cancellation) {
        throw new Error("Please confirm all required acknowledgements.");
      }

      const avail = await checkAvailability(payload.service_date);
      if (avail?.blocked) throw new Error(avail.reason || "This date is blocked.");

      if (payload.duration_slots === 2 && (!avail?.AM || !avail?.PM)) {
        throw new Error("Full day not available. Please choose another date.");
      }
      if (payload.duration_slots === 1 && payload.start_slot === "AM" && !avail?.AM) {
        throw new Error("AM not available. Please choose another date.");
      }
      if (payload.duration_slots === 1 && payload.start_slot === "PM" && !avail?.PM) {
        throw new Error("PM not available. Please choose another date.");
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Checkout failed.");

      window.location.href = json.checkout_url;
    } catch (err) {
      priceBox.className = "notice bad";
      priceBox.innerHTML = `<strong>Error:</strong> ${String(err.message || err)}`;
      submitBtn.disabled = false;
      submitBtn.textContent = "Pay deposit & book";
    }
  });
}

function titleFromName(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function amazonSearchUrl(query) {
  return `https://www.amazon.ca/s?k=${encodeURIComponent(query)}`;
}

async function fetchJsonSafe(url) {
  try {
    const r = await fetch(`${url}?v=20260301e`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function initGearPage() {
  const grid = document.querySelector("#gearGrid");
  if (!grid) return;

  const [catalog, manifest] = await Promise.all([
    fetchJsonSafe("/data/systems_catalog.json"),
    fetchJsonSafe("/data/systems_manifest.json")
  ]);

  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  const files = Array.isArray(manifest?.files) ? manifest.files : [];

  const bySlug = new Map(
    files.map((f) => [
      (f?.slug || "").toLowerCase(),
      f?.r2_url || ""
    ])
  );

  grid.innerHTML = items.map((it) => {
    const img = it.image_url || bySlug.get((it.slug || "").toLowerCase()) || "";
    const title = it.title || titleFromName(it.name || it.slug || "Gear Item");
    const desc = it.description || it.category || "Detailing equipment";
    const searchHref = amazonSearchUrl(title);

    return `
      <article class="card">
        ${img ? `<img class="img" loading="lazy" src="${img}" alt="${title}" onerror="this.style.display='none'">` : ""}
        <h3>${title}</h3>
        <p>${desc}</p>
        <div class="hr"></div>
        <a class="btn small ghost" href="${searchHref}" target="_blank" rel="noopener">Search on Amazon</a>
      </article>
    `;
  }).join("");
}

export async function initConsumablesPage() {
  const grid = document.querySelector("#consumablesGrid");
  if (!grid) return;

  const [catalog, manifest] = await Promise.all([
    fetchJsonSafe("/data/rosie_products_catalog.json"),
    fetchJsonSafe("/data/RosieProducts_manifest.json")
  ]);

  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  const files = Array.isArray(manifest?.files) ? manifest.files : [];

  const bySlug = new Map(
    files.map((f) => [
      (f?.slug || "").toLowerCase(),
      f?.r2_url || ""
    ])
  );

  grid.innerHTML = items.map((it) => {
    const img = it.image_url || bySlug.get((it.slug || "").toLowerCase()) || "";
    const title = it.title || titleFromName(it.name || it.slug || "Consumable");
    const desc = it.description || it.category || "Detailing consumable";
    const searchHref = amazonSearchUrl(title);

    return `
      <article class="card">
        ${img ? `<img class="img" loading="lazy" src="${img}" alt="${title}" onerror="this.style.display='none'">` : ""}
        <h3>${title}</h3>
        <p>${desc}</p>
        <div class="hr"></div>
        <a class="btn small ghost" href="${searchHref}" target="_blank" rel="noopener">Search on Amazon</a>
      </article>
    `;
  }).join("");
}

function currentPackageCode(form) {
  return form.package_code?.value || "";
}

function currentSize(form) {
  return form.vehicle_size?.value || "small";
}

function selectedAddonCodes(form) {
  return [...form.querySelectorAll('input[name="addon_codes"]:checked')].map((el) => el.value);
}

function calcBookingTotals(form, data) {
  const pkg = getPackageByCode(data, currentPackageCode(form));
  const size = currentSize(form);
  const selectedCodes = selectedAddonCodes(form);

  const base = packagePrice(pkg, size);
  const deposit = calcDeposit(pkg);

  const selectedAddons = (data.addons || []).filter((a) => selectedCodes.includes(a.code));
  const pricedAddons = selectedAddons.reduce((sum, a) => sum + addonCharge(a, size), 0);
  const quoteAddons = selectedAddons.filter((a) => a.quote_required).map((a) => a.name);

  return {
    pkg,
    size,
    base,
    deposit,
    pricedAddons,
    quoteAddons,
    total: base + pricedAddons,
    selectedCodes
  };
}

function renderPackageSummary(el, pkg) {
  if (!el || !pkg) return;

  const small = packageImageForSize(pkg, "small");
  const mid = packageImageForSize(pkg, "mid");
  const over = packageImageForSize(pkg, "oversize");

  el.innerHTML = `
    <div class="panel">
      <h3>${pkg.name}</h3>
      <p>${pkg.subtitle || ""}</p>
      <div class="grid cards">
        ${small ? `<img class="img" loading="lazy" src="${small}" alt="${pkg.name} small" onerror="this.style.display='none'">` : ""}
        ${mid ? `<img class="img" loading="lazy" src="${mid}" alt="${pkg.name} mid" onerror="this.style.display='none'">` : ""}
        ${over ? `<img class="img" loading="lazy" src="${over}" alt="${pkg.name} oversize" onerror="this.style.display='none'">` : ""}
      </div>
    </div>
  `;
}

function renderAddonPicker(el, data, size, selected = []) {
  if (!el) return;

  el.innerHTML = (data.addons || []).map((addon) => {
    const checked = selected.includes(addon.code) ? "checked" : "";
    const display = addonDisplay(addon, size);
    return `
      <label class="checkbox">
        <input type="checkbox" name="addon_codes" value="${addon.code}" ${checked}>
        <span><strong>${addon.name}</strong> — ${display}</span>
      </label>
    `;
  }).join("");
}

async function checkAvailability(date) {
  const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error("Could not check availability.");
  return await res.json();
}

document.addEventListener("DOMContentLoaded", async () => {
  setBrandImages();
  setFooter();
  handleCheckoutReturn();

  const page = document.body.dataset.page;

  try {
    if (page === "services") await initServicesPage();
    if (page === "pricing") await initPricingPage();
    if (page === "booking") await initBookingPage();
    if (page === "gear") await initGearPage();
    if (page === "consumables") await initConsumablesPage();
  } catch (err) {
    console.error(err);
    const box = document.querySelector("[data-page-error]");
    if (box) {
      box.className = "notice bad";
      box.textContent = String(err.message || err);
    }
  }
});
