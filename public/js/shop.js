// File: /public/js/shop.js
// Brief description: Loads storefront products with advanced search, pricing filters,
// and client-side snapshot fallback so the shop stays usable when the live endpoint drifts.

document.addEventListener("DOMContentLoaded", async () => {
  const loadingEl = document.getElementById("shopLoading");
  const errorEl = document.getElementById("shopError");
  const emptyEl = document.getElementById("shopEmpty");
  const productsEl = document.getElementById("shopProducts");
  const summaryEl = document.getElementById("shopSummary");
  const statusEl = document.getElementById("shopStatus");
  const SNAPSHOT_KEY = 'dd_shop_snapshot_v2';

  function show(el) { if (el) el.style.display = ""; }
  function hide(el) { if (el) el.style.display = "none"; }
  function escapeHtml(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function formatMoney(cents, currency='CAD') {
    const amount = Number(cents || 0) / 100;
    try { return new Intl.NumberFormat(undefined, { style:'currency', currency }).format(amount); }
    catch { return `${amount.toFixed(2)} ${currency}`; }
  }
  function setStatus(message, tone = 'info') {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.style.display = message ? '' : 'none';
    statusEl.className = message ? `status-note ${tone}` : 'status-note';
  }
  function saveSnapshot(key, payload) {
    try {
      const current = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '{}');
      current[key] = { ...payload, cached_at: new Date().toISOString() };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(current));
    } catch {}
  }
  function loadSnapshot(key) {
    try {
      const current = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '{}');
      return current[key] || null;
    } catch {
      return null;
    }
  }
  function readFilters() {
    return {
      q: String(document.getElementById('shopSearchInput')?.value || '').trim(),
      product_type: String(document.getElementById('shopTypeFilter')?.value || '').trim(),
      min_price_cents: String(document.getElementById('shopMinPrice')?.value || '').trim(),
      max_price_cents: String(document.getElementById('shopMaxPrice')?.value || '').trim(),
      requires_shipping: document.getElementById('shopShippingOnly')?.checked ? '1' : ''
    };
  }
  function buildUrl() {
    const filters = readFilters();
    const url = new URL('/api/products', window.location.origin);
    Object.entries(filters).forEach(([key, value]) => { if (value !== '') url.searchParams.set(key, value); });
    return url.pathname + url.search;
  }
  function renderProducts(products) {
    if (!productsEl) return;
    productsEl.innerHTML = products.map(product => {
      const productId = Number(product.product_id);
      const name = escapeHtml(product.name || '');
      const slug = encodeURIComponent(product.slug || '');
      const shortDescription = escapeHtml(product.short_description || product.meta_description || '');
      const productType = escapeHtml(product.product_type || '');
      const price = escapeHtml(formatMoney(product.price_cents, product.currency));
      const imageUrl = String(product.featured_image_url || product.og_image_url || '').trim();
      const imageAlt = escapeHtml(product.seo_h1 || product.h1_override || product.meta_title || product.name || 'Product image');
      const keywordBadge = product.keywords ? `<div class="small" style="opacity:.8">${escapeHtml(product.keywords.split(',').slice(0,3).join(' • '))}</div>` : '';
      const imageMarkup = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${imageAlt}" style="width:100%;aspect-ratio:1 / 1;object-fit:cover;border-radius:12px;margin-bottom:12px" />`
        : `<div style="width:100%;aspect-ratio:1 / 1;border-radius:12px;margin-bottom:12px;display:flex;align-items:center;justify-content:center;border:1px solid #ddd" class="small">No Image</div>`;
      return `
        <article class="card">
          ${imageMarkup}
          <div class="small" style="text-transform:capitalize;opacity:.8">${productType}</div>
          <h3 style="margin:8px 0 6px 0">${name}</h3>
          <div style="font-weight:700;margin-bottom:10px">${price}</div>
          ${keywordBadge}
          <p class="small" style="min-height:48px">${shortDescription || 'No description available yet.'}</p>
          <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
            <a class="btn" href="/shop/product/?slug=${slug}">View</a>
            <button class="btn" type="button" data-add-shop-cart-id="${productId}">Add to Cart</button>
          </div>
        </article>`;
    }).join('');
  }
  function bindCartButtons(products) {
    productsEl?.querySelectorAll('[data-add-shop-cart-id]').forEach(button => {
      button.addEventListener('click', () => {
        if (!window.DDCart) return alert('Cart is not available right now.');
        const productId = Number(button.getAttribute('data-add-shop-cart-id'));
        const product = products.find(item => Number(item.product_id) === productId);
        if (!product) return alert('Product could not be added.');
        try {
          window.DDCart.addToCart(product, 1);
          window.DDAnalytics?.trackCart('cart_updated', { meta: { source: 'shop', product_id: productId } });
          alert('Added to cart.');
        } catch (error) { alert(error.message || 'Failed to add item to cart.'); }
      });
    });
  }
  function renderPayload(data, { fromCache = false } = {}) {
    const products = Array.isArray(data?.products) ? data.products : [];
    const categoryCount = Array.isArray(data?.filter_groups?.categories) ? data.filter_groups.categories.length : 0;
    const colorCount = Array.isArray(data?.filter_groups?.colors) ? data.filter_groups.colors.length : 0;
    if (summaryEl) summaryEl.textContent = `${products.length} product(s) found.${categoryCount || colorCount ? ` ${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'} and ${colorCount} colour option${colorCount === 1 ? '' : 's'} in this result set.` : ''}`;
    if (!products.length) {
      hide(productsEl);
      show(emptyEl);
    } else {
      hide(emptyEl);
      renderProducts(products);
      show(productsEl);
      bindCartButtons(products);
    }
    if (data?.warning) setStatus(data.warning, fromCache ? 'warning' : 'info');
    else if (!fromCache) setStatus('');
    return products;
  }
  async function loadProducts() {
    const url = buildUrl();
    hide(errorEl); hide(emptyEl); hide(productsEl); show(loadingEl); setStatus('');
    try {
      const response = await fetch(url, { method: 'GET' });
      const rawText = await response.text();
      let data = null;
      try { data = JSON.parse(rawText); } catch { throw new Error('Store data returned invalid JSON.'); }
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed to load products.');
      renderPayload(data);
      saveSnapshot(url, { data });
    } catch (error) {
      const cached = loadSnapshot(url);
      if (cached?.data) {
        renderPayload(cached.data, { fromCache: true });
        setStatus(`Live shop data is unavailable. Showing the last saved snapshot from ${cached.cached_at || 'an earlier visit'}.`, 'warning');
      } else {
        if (errorEl) errorEl.textContent = error.message || 'Failed to load products.';
        show(errorEl);
      }
    } finally { hide(loadingEl); }
  }
  document.getElementById('shopSearchButton')?.addEventListener('click', loadProducts);
  document.getElementById('shopResetButton')?.addEventListener('click', () => {
    ['shopSearchInput','shopTypeFilter','shopMinPrice','shopMaxPrice'].forEach((id) => { const el=document.getElementById(id); if (el) el.value=''; });
    const ship=document.getElementById('shopShippingOnly'); if (ship) ship.checked=false; loadProducts();
  });
  await loadProducts();
});
