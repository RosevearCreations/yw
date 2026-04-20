/* /js/main.js — Devil n Dove shared helpers + shared navigation/footer */
(() => {
  "use strict";

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function amazonSearchUrl(query) {
    const q = String(query ?? "").trim();
    if (!q) return "";
    return `https://www.amazon.ca/s?k=${encodeURIComponent(q)}`;
  }

  function getDefaultFooterSocialRows() {
    return [
      { key: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@devilndove345', handle: '@devilndove345' },
      { key: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/devilndove', handle: '@devilndove' },
      { key: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@devilanddove', handle: '@devilanddove' },
      { key: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/DevilnDoveOnline', handle: 'DevilnDoveOnline' },
      { key: 'x', label: 'X', url: 'https://x.com/DevilnDove', handle: '@DevilnDove' },
      { key: 'patreon', label: 'Patreon', url: 'https://patreon.com/DevilnDove', handle: 'patreon.com/DevilnDove' }
    ];
  }

  function socialLinksMarkup(rows, { includeHub = true, includeStatus = false } = {}) {
    const safeRows = Array.isArray(rows) ? rows.filter((row) => row && row.url) : [];
    const parts = [];
    if (includeHub) parts.push('<a href="/socials/index.html">Social hub</a>');
    parts.push(...safeRows.map((row) => `<a href="${escapeHtml(row.url || '/socials/index.html')}" rel="noopener" target="_blank">${escapeHtml(row.label || row.handle || 'Social')}</a>`));
    if (includeStatus && !safeRows.length) parts.push('<span class="small">Profile links are temporarily unavailable here.</span>');
    return parts.join('');
  }

  async function fetchFooterSocialRows() {
    const preferredOrder = ['youtube', 'instagram', 'tiktok', 'facebook', 'x', 'patreon'];
    try {
      const response = await fetch('/api/social-feed', { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok && data?.profiles && typeof data.profiles === 'object') {
        const rows = preferredOrder.map((key) => data.profiles[key]).filter(Boolean);
        if (rows.length) return rows;
      }
    } catch {}
    try {
      const response = await fetch('/data/site/social-feed.json', { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.profiles && typeof data.profiles === 'object') {
        const rows = preferredOrder.map((key) => data.profiles[key]).filter(Boolean);
        if (rows.length) return rows;
      }
    } catch {}
    return getDefaultFooterSocialRows();
  }

  function navLinksMarkup() {
    return `
      <a href="/index.html" data-nav="/">Home</a>
      <a href="/about/index.html" data-nav="/about/">About</a>
      <a href="/gallery/index.html" data-nav="/gallery/">Art</a>
      <a href="/creations/index.html" data-nav="/creations/">Creations</a>
      <a href="/tools/index.html" data-nav="/tools/">Tools</a>
      <a href="/supplies/index.html" data-nav="/supplies/">Supplies</a>
      <a href="/shop/index.html" data-nav="/shop/">Shop</a>
      <a href="/search/index.html" data-nav="/search/">Search</a>
      <a href="/movies/index.html" data-nav="/movies/">Movies</a>
      <a href="/socials/index.html" data-nav="/socials/">Socials</a>
      <a href="/contact/index.html" data-nav="/contact/">Contact</a>
      <a href="/cart/index.html" data-nav="/cart/">Cart</a>
      <a href="/login/index.html" data-nav="/login/" data-show-when-logged-out style="display:none">Login</a>
      <a href="/register/index.html" data-nav="/register/" data-show-when-logged-out style="display:none">Register</a>
      <a href="/members/index.html" data-nav="/members/" data-show-when-logged-in style="display:none">Members</a>
      <a href="/admin/index.html" data-nav="/admin/" data-show-when-admin style="display:none">Admin</a>`;
  }

  function buildSharedNav() {
    return `
      <div class="brand">
        <img src="/assets/logo-clear.png" alt="Devil n Dove logo" />
        <div>
          <div style="font-weight:800;letter-spacing:.2px;line-height:1.1">Devil n Dove</div>
          <div class="small">Workshop • Art • Tools • Movies</div>
        </div>
      </div>
      <button class="nav-mobile-toggle" type="button" aria-expanded="false" aria-controls="siteNavPanel">
        <span class="nav-mobile-toggle-icon" aria-hidden="true"><span></span><span></span><span></span></span>
        <span>Menu</span>
      </button>
      <div class="links nav-links-desktop" aria-label="Primary navigation">
        ${navLinksMarkup()}
      </div>
      <div class="nav-mobile-panel" id="siteNavPanel" hidden>
        <div class="nav-mobile-panel-head">
          <div>
            <div style="font-weight:800;letter-spacing:.2px;line-height:1.1">Browse Devil n Dove</div>
            <div class="small">Shop, creations, tools, supplies, movies, and more</div>
          </div>
          <button class="btn nav-mobile-close" type="button">Close</button>
        </div>
        <div class="nav-mobile-grid" aria-label="Mobile navigation">
          ${navLinksMarkup()}
        </div>
      </div>`;
  }

  function buildSharedFooter() {
    const year = new Date().getFullYear();
    return `
      <div class="site-footer-grid">
        <div>
          <h2 class="site-footer-title">Devil n Dove</h2>
          <p class="small">Handmade jewelry, workshop creations, tools, supplies, movies, and maker-life updates from Southern Ontario.</p>
        </div>
        <div>
          <div class="site-footer-heading">Explore</div>
          <div class="site-footer-links">
            <a href="/shop/index.html">Shop</a>
            <a href="/gallery/index.html">Gallery</a>
            <a href="/creations/index.html">Creations</a>
            <a href="/tools/index.html">Tools</a>
            <a href="/supplies/index.html">Supplies</a>
            <a href="/movies/index.html">Movies</a>
            <a href="/socials/index.html">Socials</a>
          </div>
        </div>
        <div>
          <div class="site-footer-heading">Member account</div>
          <div class="site-footer-links">
            <a href="/login/index.html">Login</a>
            <a href="/register/index.html">Register</a>
            <a href="/members/index.html">Settings</a>
            <a href="/account-help/index.html?mode=password">Forgot password</a>
            <a href="/account-help/index.html?mode=email">Forgot email</a>
          </div>
        </div>
        <div>
          <div class="site-footer-heading">Follow</div>
          <div class="site-footer-links" id="siteFooterSocialLinks">
            ${socialLinksMarkup(getDefaultFooterSocialRows())}
          </div>
        </div>
        <div>
          <div class="site-footer-heading">Search the site</div>
          <form action="/search/index.html" class="site-footer-search" method="get" role="search">
            <input aria-label="Search Devil n Dove" name="q" placeholder="Search products, tools, supplies, art..." type="search" />
            <button class="btn" type="submit">Search</button>
          </form>
          <p class="small">Search stays visible in the footer on every public page to improve discovery and crawl paths.</p>
        </div>
      </div>
      <div class="site-footer-bottom small">© ${year} Devil n Dove. Built for storefront discovery, workshop sharing, and member access.</div>`;
  }

  function setActiveLink(navEl) {
    const path = (location.pathname || "/").toLowerCase();
    const links = Array.from(navEl.querySelectorAll("a[data-nav]"));
    let best = null;
    let bestLen = -1;
    for (const a of links) {
      const prefix = String(a.getAttribute("data-nav") || "").toLowerCase();
      if (!prefix) continue;
      if (path === prefix || path.startsWith(prefix)) {
        if (prefix.length > bestLen) { best = a; bestLen = prefix.length; }
      }
    }
    if (best) best.classList.add("active");
  }

  function wireMobileNav(nav) {
    const toggle = nav.querySelector('.nav-mobile-toggle');
    const panel = nav.querySelector('.nav-mobile-panel');
    const closeBtn = nav.querySelector('.nav-mobile-close');
    if (!toggle || !panel) return;

    const open = () => {
      panel.hidden = false;
      nav.classList.add('nav-mobile-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('nav-mobile-open');
    };
    const close = () => {
      panel.hidden = true;
      nav.classList.remove('nav-mobile-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-mobile-open');
    };

    toggle.addEventListener('click', () => {
      if (panel.hidden) open();
      else close();
    });
    closeBtn?.addEventListener('click', close);
    panel.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  function injectSharedNav() {
    const nav = document.querySelector('.nav');
    if (!nav || nav.hasAttribute('data-no-shared-nav')) return;
    nav.innerHTML = buildSharedNav();
    setActiveLink(nav);
    wireMobileNav(nav);
  }

  async function hydrateFooterSocials() {
    const socialWrap = document.getElementById('siteFooterSocialLinks');
    if (!socialWrap) return;
    socialWrap.innerHTML = socialLinksMarkup(getDefaultFooterSocialRows());
    try {
      const rows = await fetchFooterSocialRows();
      socialWrap.innerHTML = socialLinksMarkup(rows, { includeHub: true, includeStatus: true });
    } catch (_error) {
      socialWrap.innerHTML = socialLinksMarkup(getDefaultFooterSocialRows(), { includeHub: true, includeStatus: true });
    }
  }

  function shouldShowFeaturedTestimonials(pathname) {
    const path = String(pathname || location.pathname || '/').toLowerCase();
    return ['/', '/index.html', '/about/', '/about/index.html', '/gallery/', '/gallery/index.html', '/creations/', '/creations/index.html', '/shop/', '/shop/index.html', '/tools/', '/tools/index.html', '/supplies/', '/supplies/index.html', '/contact/', '/contact/index.html'].includes(path);
  }

  async function injectFeaturedTestimonials() {
    if (!shouldShowFeaturedTestimonials(location.pathname)) return;
    const container = document.querySelector('.container') || document.body;
    const footer = container.querySelector('footer.footer, .footer');
    if (!container || !footer || document.getElementById('featuredTestimonialsBlock')) return;
    try {
      const response = await fetch('/api/product-reviews?featured_only=1&limit=3', { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not load testimonials.');
      const reviews = Array.isArray(data.reviews) ? data.reviews : [];
      if (!reviews.length) return;
      const section = document.createElement('section');
      section.id = 'featuredTestimonialsBlock';
      section.className = 'card featured-testimonials-block';
      section.style.marginTop = '18px';
      section.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h2 style="margin:0">What buyers say</h2>
            <p class="small" style="margin:6px 0 0 0">Featured testimonials and approved buyer feedback from the Devil n Dove storefront.</p>
          </div>
          <a class="btn" href="/members/">Leave feedback</a>
        </div>
        <div class="featured-testimonials-grid" style="margin-top:12px">
          ${reviews.map((row) => `
            <article class="featured-testimonial-card">
              <div class="small">${escapeHtml('★'.repeat(Math.max(1, Number(row.rating || 0))))}</div>
              <p style="margin:10px 0">${escapeHtml(row.review_text || '')}</p>
              <div class="small"><strong>${escapeHtml(row.reviewer_name || 'Devil n Dove customer')}</strong>${row.product_slug ? ` • <a href="/shop/product/?slug=${encodeURIComponent(row.product_slug)}">${escapeHtml(row.product_name || 'Product')}</a>` : ''}</div>
            </article>`).join('')}
        </div>`;
      container.insertBefore(section, footer);
    } catch (_error) {}
  }

  function injectSharedFooter() {
    const container = document.querySelector('.container') || document.body;
    let footer = document.querySelector('footer.footer, .footer');
    if (!footer) {
      footer = document.createElement('footer');
      footer.className = 'footer card';
      container.appendChild(footer);
    } else if (footer.tagName.toLowerCase() !== 'footer') {
      const replacement = document.createElement('footer');
      replacement.className = footer.className || 'footer card';
      footer.replaceWith(replacement);
      footer = replacement;
    }
    if (!footer.classList.contains('card')) footer.classList.add('card');
    footer.setAttribute('role', 'contentinfo');
    footer.innerHTML = buildSharedFooter();
  }

  function ensureGlobalScript(src) {
    if (!src || document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.body.appendChild(script);
  }

  window.DD = window.DD || {};
  window.DD.escapeHtml = escapeHtml;
  window.DD.amazonSearchUrl = amazonSearchUrl;

  document.addEventListener('DOMContentLoaded', () => {
    injectSharedNav();
    injectSharedFooter();
    hydrateFooterSocials();
    injectFeaturedTestimonials();
    ensureGlobalScript('/public/js/auth.js');
    ensureGlobalScript('/public/js/site-auth-ui.js');
    ensureGlobalScript('/public/js/site-analytics.js');
  });
})();
