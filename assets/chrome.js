// /assets/chrome.js

/* =========================
   BRAND / NAV / FOOTER
   ========================= */

const BRAND = {
  name: "Rosie Dazzlers",
  logo: "https://assets.rosiedazzlers.ca/brand/Untitled.png",
  banner: "https://assets.rosiedazzlers.ca/brand/RosieDazzlersBanner.png",
  reviews: "https://assets.rosiedazzlers.ca/brand/RosieReviews.png",
  footerLogo: "https://assets.rosiedazzlers.ca/brand/Untitled.png",
};

const SOCIALS = [
  ["TikTok", "https://www.tiktok.com/@rosiedazzler"],
  ["Instagram", "https://www.instagram.com/rosiedazzlers/"],
  ["Facebook", "https://www.facebook.com/rosiedazzlers"],
  ["YouTube", "https://www.youtube.com/@rosiedazzlers"],
  ["Twitch", "https://www.twitch.tv/rosiedazzlers/"],
  ["X", "https://x.com/RosieDazzlers"],
  ["LinkedIn", "https://www.linkedin.com/in/rosiedazzlers/"],
];

const DEFAULT_NAV_LINKS = [
  ["/services", "Services"],
  ["/pricing", "Pricing"],
  ["/gear", "Gear"],
  ["/consumables", "Consumables"],
  ["/about", "About"],
  ["/contact", "Contact"],
  ["/book", "Book"],
];

function normalizePath(p) {
  const x = (p || "/").replace(/\/+$/, "");
  return x === "" ? "/" : x;
}

function ensureNavLinks() {
  const links = document.querySelector("#navLinks");
  if (!links) return;

  const existing = links.querySelectorAll("a");
  if (existing.length > 0) return;

  links.innerHTML = DEFAULT_NAV_LINKS.map(
    ([href, label]) => `<a href="${href}">${label}</a>`
  ).join("");
}

function setBrandImagesEverywhere() {
  document.querySelectorAll("[data-logo]").forEach((logo) => {
    logo.src = BRAND.logo;
    if (!logo.getAttribute("alt")) {
      logo.alt = `${BRAND.name} logo`;
    }
  });
}

function ensureMainBanner() {
  const path = normalizePath(location.pathname);
  if (["/book","/login","/my-account","/progress","/complete","/detailer-jobs"].includes(path)) return;

  const existingImg =
    document.querySelector("[data-main-banner] img") ||
    document.querySelector("#mainBanner img") ||
    document.querySelector(".main-banner img") ||
    document.querySelector("img[data-main-banner]") ||
    document.querySelector("img[data-banner]") ||
    document.querySelector("#bannerImage");

  if (existingImg) {
    existingImg.src = BRAND.banner;
    existingImg.alt = "Rosie Dazzlers banner";
    existingImg.loading = "eager";
    existingImg.style.display = "block";
    existingImg.style.width = "100%";
    existingImg.style.height = "auto";
    existingImg.style.objectFit = "contain";
    return;
  }

  const existingWrap =
    document.querySelector("[data-main-banner]") ||
    document.querySelector("#mainBanner") ||
    document.querySelector(".main-banner");

  if (existingWrap) {
    existingWrap.innerHTML = `
      <img
        src="${BRAND.banner}"
        alt="Rosie Dazzlers banner"
        loading="eager"
        style="display:block;width:100%;height:auto;object-fit:contain"
      >
    `;
    return;
  }

  if (document.querySelector("#globalMainBanner")) return;

  const nav = document.querySelector(".nav");
  const anchor = nav || document.querySelector("header") || document.body.firstElementChild || document.body;

  const wrap = document.createElement("div");
  wrap.id = "globalMainBanner";
  wrap.className = "container";
  wrap.style.paddingTop = "14px";
  wrap.style.paddingBottom = "8px";

  wrap.innerHTML = `
    <div
      class="panel"
      style="padding:12px;display:flex;align-items:center;justify-content:center;overflow:hidden"
    >
      <img
        src="${BRAND.banner}"
        alt="Rosie Dazzlers banner"
        loading="eager"
        style="display:block;width:100%;max-width:980px;height:auto;object-fit:contain"
      >
    </div>
  `;

  if (anchor && anchor.parentNode) {
    if (anchor === document.body) {
      document.body.insertBefore(wrap, document.body.firstChild);
    } else {
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    }
  } else {
    document.body.insertBefore(wrap, document.body.firstChild);
  }
}

function ensureReviewsPanel() {
  const path = normalizePath(location.pathname);
  if (path !== "/") return;

  const directImg =
    document.querySelector("[data-reviews]") ||
    document.querySelector("#reviewsImage") ||
    document.querySelector(".reviews img") ||
    document.querySelector(".review-banner img") ||
    document.querySelector("img[data-role='reviews']");

  if (directImg && directImg.tagName && directImg.tagName.toLowerCase() === "img") {
    directImg.src = BRAND.reviews;
    directImg.alt = "Rosie Dazzlers reviews";
    directImg.loading = "lazy";
    directImg.style.display = "block";
    directImg.style.width = "100%";
    directImg.style.height = "auto";
    directImg.style.objectFit = "contain";
    return;
  }

  const wrapTarget =
    document.querySelector(".reviews") ||
    document.querySelector(".review-banner") ||
    document.querySelector("[data-reviews-wrap]");

  if (wrapTarget) {
    wrapTarget.innerHTML = `
      <img
        src="${BRAND.reviews}"
        alt="Rosie Dazzlers reviews"
        loading="lazy"
        style="display:block;width:100%;height:auto;object-fit:contain"
      >
    `;
    return;
  }

  if (document.querySelector("#globalReviewsPanel")) return;

  const afterBanner =
    document.querySelector("#globalMainBanner") ||
    document.querySelector("[data-main-banner]") ||
    document.querySelector("#mainBanner") ||
    document.querySelector(".main-banner");

  const homePackages =
    document.querySelector("#homePackages") ||
    document.querySelector("main") ||
    document.querySelector(".container");

  const wrap = document.createElement("div");
  wrap.id = "globalReviewsPanel";
  wrap.className = "container";
  wrap.style.paddingTop = "8px";
  wrap.style.paddingBottom = "8px";

  wrap.innerHTML = `
    <div
      class="panel"
      style="padding:12px;display:flex;align-items:center;justify-content:center;overflow:hidden"
    >
      <img
        src="${BRAND.reviews}"
        alt="Rosie Dazzlers reviews"
        loading="lazy"
        style="display:block;width:100%;max-width:980px;height:auto;object-fit:contain"
      >
    </div>
  `;

  if (afterBanner && afterBanner.parentNode) {
    if (afterBanner.nextSibling) {
      afterBanner.parentNode.insertBefore(wrap, afterBanner.nextSibling);
    } else {
      afterBanner.parentNode.appendChild(wrap);
    }
    return;
  }

  if (homePackages && homePackages.parentNode) {
    homePackages.parentNode.insertBefore(wrap, homePackages);
    return;
  }

  document.body.appendChild(wrap);
}

function setActiveNavLink() {
  const path = normalizePath(location.pathname);
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const href = normalizePath(a.getAttribute("href") || "/");
    const active =
      (href === "/" && path === "/") ||
      (href !== "/" && path.startsWith(href));
    a.classList.toggle("active", active);
  });
}

function initNavToggle() {
  const btn = document.querySelector("#navToggle");
  const links = document.querySelector("#navLinks");
  if (!btn || !links) return;

  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", () => {
    links.classList.toggle("open");
    btn.setAttribute(
      "aria-expanded",
      links.classList.contains("open") ? "true" : "false"
    );
  });

  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => links.classList.remove("open"));
  });
}

function setFooter() {
  const el = document.querySelector("[data-footer]");
  if (!el) return;

  const year = new Date().getFullYear();

  el.innerHTML = `
    <div class="footer-grid">
      <div class="footer-col">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <img
            src="${BRAND.footerLogo}"
            alt="${BRAND.name} logo"
            style="width:72px;height:72px;object-fit:contain;border-radius:14px;flex:0 0 auto;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.10);padding:6px;"
          >
          <div>
            <div class="footer-title">Rosie Dazzlers</div>
            <div class="footer-muted">Mobile Auto Detailing</div>
            <div class="footer-muted">Norfolk & Oxford Counties, Ontario</div>
          </div>
        </div>

        <div class="footer-muted" style="margin-top:12px">
          Email: <a href="mailto:info@rosiedazzlers.ca">info@rosiedazzlers.ca</a><br>
          Backup: <a href="mailto:rosiedazzlers@gmail.com">rosiedazzlers@gmail.com</a>
        </div>

        <div class="footer-note" style="margin-top:10px">
          Driveway required · customer provides power + water (or additional charges may apply).
        </div>
      </div>

      <div class="footer-col">
        <div class="footer-title">Explore</div>
        <a href="/services">Services</a>
        <a href="/pricing">Pricing</a>
        <a href="/book">Book</a>
        <a href="/gear">Gear</a>
        <a href="/consumables">Consumables</a>
      </div>

      <div class="footer-col">
        <div class="footer-title">Company</div>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>

        <div class="footer-title" style="margin-top:12px">Social</div>
        <div class="footer-social">
          ${SOCIALS.map(([name, url]) => `<a href="${url}" target="_blank" rel="noopener">${name}</a>`).join("")}
        </div>
      </div>

      <div class="footer-col">
        <div class="footer-title">Policies</div>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/waiver">Waiver</a>

        <div class="footer-note" style="margin-top:12px">
          Deposits secure booking times. Cancellation fees may apply.
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <div>© ${year} Rosie Dazzlers Mobile Auto Detailing</div>
      <div class="footer-bottom-links">
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/waiver">Waiver</a>
      </div>
    </div>
  `;
}

/* =========================
   PACKAGE CARD HOVER ROTATION
   ========================= */

const PACKAGES_BASE = "https://assets.rosiedazzlers.ca/packages/";

const STATIC_HOVER_FILES = [
  "Exterior Detail.png",
  "Interior Detail.png",
  "CarSizeChart.PNG",
];

const SIZE_ICON_BY_VALUE = {
  small: "SmallCar.png",
  mid: "MidSizedCars.png",
  oversize: "ExoticLargeSizedCars.png",
};

const loadState = new Map();

function fileUrl(fileName) {
  return encodeURI(`${PACKAGES_BASE}${fileName}`);
}

function preload(url) {
  const s = loadState.get(url);
  if (s === "ok" || s === "fail" || s === "pending") return;

  loadState.set(url, "pending");
  const img = new Image();
  img.onload = () => loadState.set(url, "ok");
  img.onerror = () => loadState.set(url, "fail");
  img.src = url;
}

function isOk(url) {
  return loadState.get(url) === "ok";
}

function currentSize() {
  const sel = document.querySelector("#size");
  return sel && sel.value ? sel.value : null;
}

function guessGiftCertUrl(baseSrc) {
  try {
    const u = new URL(baseSrc);
    const file = u.pathname.split("/").pop() || "";
    if (!/\.png$/i.test(file)) return null;

    const giftFile = file.replace(/\.png$/i, "GiftCert.png");
    const giftUrl = `${u.origin}/packages/${encodeURIComponent(giftFile)}`;
    return giftUrl.replace(/%2F/g, "/");
  } catch {
    return null;
  }
}

function buildPlaylist(baseSrc) {
  const urls = [];

  urls.push(baseSrc);

  for (const f of STATIC_HOVER_FILES) urls.push(fileUrl(f));

  const s = currentSize();
  if (s && SIZE_ICON_BY_VALUE[s]) urls.push(fileUrl(SIZE_ICON_BY_VALUE[s]));

  const gift = guessGiftCertUrl(baseSrc);
  if (gift) urls.push(gift);

  return urls.filter((u, i, arr) => arr.indexOf(u) === i);
}

function attachRotators(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  function attach(card) {
    if (!card || card.dataset.hoverInit === "1") return;
    const img = card.querySelector("img");
    if (!img) return;

    card.dataset.hoverInit = "1";

    let timer = null;
    let playlist = [];
    let base = "";

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      if (base) img.src = base;
    }

    card.addEventListener("mouseenter", () => {
      base = img.currentSrc || img.src;

      img.onerror = () => {
        img.style.display = "";
        img.src = base;
      };

      playlist = buildPlaylist(base);
      playlist.forEach(preload);

      if (timer) clearInterval(timer);

      timer = setInterval(() => {
        if (!playlist.length) return;

        const currentIdx = playlist.indexOf(img.src);
        let idx = currentIdx >= 0 ? currentIdx : 0;

        for (let tries = 0; tries < playlist.length; tries++) {
          idx = (idx + 1) % playlist.length;
          const candidate = playlist[idx];

          if (candidate === base) {
            img.src = candidate;
            return;
          }

          if (isOk(candidate)) {
            img.src = candidate;
            return;
          }
        }
      }, 1200);
    });

    card.addEventListener("mouseleave", stop);
  }

  container.querySelectorAll(".card").forEach(attach);

  const mo = new MutationObserver(() => {
    container.querySelectorAll(".card").forEach(attach);
  });
  mo.observe(container, { childList: true, subtree: true });
}

/* =========================
   BOOT
   ========================= */



/* =========================
   PUBLIC ACCOUNT WIDGET
   ========================= */

async function readJsonSafe(url, options = {}) {
  try {
    const res = await fetch(url, { credentials: "include", cache: "no-store", ...options });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err && err.message ? err.message : "Request failed." } };
  }
}

function ensureAccountHost() {
  const navInner = document.querySelector('.nav-inner');
  if (!navInner) return null;
  let host = document.querySelector('#publicAccountWidget');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'publicAccountWidget';
  host.className = 'account-widget';
  const primaryBtn = navInner.querySelector('a.btn.primary[href="/book"]');
  if (primaryBtn && primaryBtn.parentNode === navInner) {
    navInner.insertBefore(host, primaryBtn);
  } else {
    navInner.appendChild(host);
  }
  return host;
}

function widgetButton(href, label, extraClass = 'ghost', attrs = '') {
  return `<a class="btn ${extraClass}" href="${href}" ${attrs}>${label}</a>`;
}

function widgetActionButton(id, label, extraClass = 'ghost') {
  return `<button class="btn ${extraClass}" type="button" id="${id}">${label}</button>`;
}

async function initAccountWidget() {
  const host = ensureAccountHost();
  if (!host) return;
  host.innerHTML = `<span class="account-chip">Checking account…</span>`;

  const [staff, client] = await Promise.all([
    readJsonSafe('/api/admin/auth_me'),
    readJsonSafe('/api/client/auth_me')
  ]);

  const staffActor = staff.ok && staff.data && (staff.data.actor || staff.data.staff_user || staff.data.staff) ? (staff.data.actor || staff.data.staff_user || staff.data.staff) : null;
  const clientCustomer = client.ok && client.data && client.data.authenticated === true ? client.data.customer : null;

  if (staffActor) {
    const role = staffActor.role_code || (staffActor.is_admin ? 'admin' : 'staff');
    host.innerHTML = `
      <div class="account-widget-inner">
        <span class="account-chip">${staffActor.full_name || staffActor.email || 'Staff'} · ${role}</span>
        ${widgetButton('/admin', 'Admin', 'ghost')}
        ${widgetButton('/detailer-jobs', 'Jobs', 'ghost')}
        ${widgetButton('/admin-account', 'Settings', 'ghost')}
        ${widgetActionButton('publicLogoutBtn', 'Sign out', 'primary')}
      </div>
    `;
    host.querySelector('#publicLogoutBtn')?.addEventListener('click', async () => {
      await readJsonSafe('/api/admin/auth_logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      await readJsonSafe('/api/client/auth_logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      location.href = '/login';
    });
    return;
  }

  if (clientCustomer) {
    host.innerHTML = `
      <div class="account-widget-inner">
        <span class="account-chip">${clientCustomer.full_name || clientCustomer.email || 'Customer'}</span>
        ${widgetButton('/my-account', 'Garage & account', 'ghost')}
        ${widgetButton('/book', 'Book again', 'ghost')}
        ${widgetActionButton('publicLogoutBtn', 'Sign out', 'primary')}
      </div>
    `;
    host.querySelector('#publicLogoutBtn')?.addEventListener('click', async () => {
      await readJsonSafe('/api/client/auth_logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      location.href = '/login';
    });
    return;
  }

  host.innerHTML = `
    <div class="account-widget-inner">
      <span class="account-chip">Account</span>
      ${widgetButton('/login', 'Login', 'ghost')}
      ${widgetButton('/login#signupForm', 'Create account', 'primary')}
    </div>
  `;
}

function initChrome() {
  ensureNavLinks();
  setBrandImagesEverywhere();
  ensureMainBanner();
  ensureReviewsPanel();
  setActiveNavLink();
  initNavToggle();
  setFooter();
  initAccountWidget();

  attachRotators("#homePackages");
  attachRotators("#packageCards");
  attachRotators("#pricingCards");
  attachRotators("#packagesGrid");
  attachRotators("#pricingPackages");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChrome);
} else {
  initChrome();
}
