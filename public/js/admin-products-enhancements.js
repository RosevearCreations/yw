document.addEventListener('DOMContentLoaded', () => {
  if (!window.DDAuth) return;
  const mount = document.getElementById('productsAdminMount');
  const tableWrap = document.querySelector('.products-admin-table-wrap');
  const tableBody = document.getElementById('productsTableBody');
  if (!mount || !tableWrap || !tableBody) return;
  const PREF_KEY = 'dd_catalog_table_prefs_v1';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function loadPrefs() {
    try { return { hideSlug: 0, hideSku: 0, hideShipping: 0, hideTax: 0, compactInventory: 1, ...(JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}) }; }
    catch { return { hideSlug: 0, hideSku: 0, hideShipping: 0, hideTax: 0, compactInventory: 1 }; }
  }
  function savePrefs(next) { try { localStorage.setItem(PREF_KEY, JSON.stringify(next || {})); } catch {} }
  let prefs = loadPrefs();

  function applyColumnPrefs() {
    const table = document.querySelector('.products-admin-table');
    if (!table) return;
    const rows = table.querySelectorAll('tr');
    const hiddenIndexes = new Set();
    if (prefs.hideSlug) hiddenIndexes.add(2);
    if (prefs.hideSku) hiddenIndexes.add(3);
    if (prefs.hideShipping) hiddenIndexes.add(8);
    if (prefs.hideTax) hiddenIndexes.add(9);
    rows.forEach((row) => {
      row.querySelectorAll('th,td').forEach((cell, idx) => {
        cell.style.display = hiddenIndexes.has(idx) ? 'none' : '';
        if (idx === 7) {
          const smalls = cell.querySelectorAll('.small');
          smalls.forEach((el, sIdx) => {
            el.style.display = prefs.compactInventory && sIdx > 1 ? 'none' : '';
          });
        }
      });
    });
  }

  function ensureMount() {
    if (document.getElementById('catalogEnhancementCard')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'catalogEnhancementCard';
    card.style.marginTop = '16px';
    card.innerHTML = `
      <h3 style="margin-top:0">Catalog dashboard & table preferences</h3>
      <p class="small">Keep the product table easier to work through by collapsing long columns and watching the biggest cleanup queues first.</p>
      <div class="grid cols-4" id="catalogDashboardStats" style="gap:10px"></div>
      <div class="grid cols-5" style="gap:8px;margin-top:12px">
        <label class="small"><input type="checkbox" id="prefHideSlug" /> Hide slug</label>
        <label class="small"><input type="checkbox" id="prefHideSku" /> Hide SKU</label>
        <label class="small"><input type="checkbox" id="prefHideShipping" /> Hide shipping</label>
        <label class="small"><input type="checkbox" id="prefHideTax" /> Hide tax</label>
        <label class="small"><input type="checkbox" id="prefCompactInventory" /> Compact inventory details</label>
      </div>
    `;
    mount.prepend(card);
    document.getElementById('prefHideSlug').checked = !!prefs.hideSlug;
    document.getElementById('prefHideSku').checked = !!prefs.hideSku;
    document.getElementById('prefHideShipping').checked = !!prefs.hideShipping;
    document.getElementById('prefHideTax').checked = !!prefs.hideTax;
    document.getElementById('prefCompactInventory').checked = !!prefs.compactInventory;
    card.addEventListener('change', () => {
      prefs = {
        hideSlug: document.getElementById('prefHideSlug').checked ? 1 : 0,
        hideSku: document.getElementById('prefHideSku').checked ? 1 : 0,
        hideShipping: document.getElementById('prefHideShipping').checked ? 1 : 0,
        hideTax: document.getElementById('prefHideTax').checked ? 1 : 0,
        compactInventory: document.getElementById('prefCompactInventory').checked ? 1 : 0,
      };
      savePrefs(prefs);
      applyColumnPrefs();
    });
  }

  async function loadDashboard() {
    const response = await window.DDAuth.apiFetch('/api/admin/products', { method: 'GET' });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) return;
    const products = Array.isArray(data.products) ? data.products : [];
    const lowStock = products.filter((row) => Number(row.low_stock_flag || 0) === 1).length;
    const drafts = products.filter((row) => String(row.status || '').toLowerCase() === 'draft').length;
    const staleDrafts = products.filter((row) => String(row.status || '').toLowerCase() === 'draft' && String(row.updated_at || row.created_at || '') < new Date(Date.now() - 14*24*60*60*1000).toISOString()).length;
    const externalListings = products.filter((row) => ['external_only','hybrid'].includes(String(row.sale_channel || '').toLowerCase())).length;
    const missingImages = products.filter((row) => !String(row.featured_image_url || '').trim()).length;
    const statsEl = document.getElementById('catalogDashboardStats');
    if (!statsEl) return;
    statsEl.innerHTML = [
      ['Low stock', lowStock, 'Needs reorder or reserve review'],
      ['Drafts', drafts, 'Still not live'],
      ['Stale drafts', staleDrafts, 'Drafts older than 14 days'],
      ['External / hybrid', externalListings, 'Marketplace-linked products'],
      ['Missing lead image', missingImages, 'Still missing featured media'],
    ].map(([label, value, note]) => `<div class="card" style="margin:0"><strong>${esc(label)}</strong><div style="font-size:1.25rem;font-weight:700;margin-top:6px">${esc(String(value))}</div><div class="small" style="margin-top:6px">${esc(note)}</div></div>`).join('');
  }

  ensureMount();
  applyColumnPrefs();
  const observer = new MutationObserver(() => applyColumnPrefs());
  observer.observe(tableBody, { childList: true, subtree: true });
  loadDashboard().catch(() => {});
});
