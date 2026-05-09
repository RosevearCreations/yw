document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('productStockReportMount');
  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;
  function esc(v){return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#039;');}
  function money(cents, currency='CAD'){ const amount = Number(cents || 0) / 100; try { return new Intl.NumberFormat(undefined, { style:'currency', currency }).format(amount); } catch { return `${amount.toFixed(2)} ${currency}`; } }
  function setMsg(msg, err=false){ const el=document.getElementById('productStockReportMessage'); if(!el) return; el.textContent=msg; el.style.display=msg?'block':'none'; el.style.color=err?'#b00020':'#0a7a2f'; }
  function render(){
    mountEl.innerHTML = `
      <div class="card" style="margin-top:18px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div><h3 style="margin-top:0">Product Stock & Build Readiness</h3><p class="small" style="margin-top:0">See what is on hand, which finished products are running low, and which linked tools/supplies are triggering reorder pressure.</p></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="productStockReportRefresh">Refresh</button></div>
        </div>
        <div id="productStockReportMessage" class="small" style="display:none;margin-bottom:10px"></div>
        <div class="grid cols-4" style="gap:12px;margin-bottom:12px">
          <div class="admin-stat"><div class="admin-stat-label">Products</div><div class="admin-stat-value" id="productStockTotal">—</div></div>
          <div class="admin-stat"><div class="admin-stat-label">Low stock</div><div class="admin-stat-value" id="productStockLow">—</div></div>
          <div class="admin-stat"><div class="admin-stat-label">Tracked</div><div class="admin-stat-value" id="productStockTracked">—</div></div>
          <div class="admin-stat"><div class="admin-stat-label">With build links</div><div class="admin-stat-value" id="productStockLinked">—</div></div>
        </div>
        <div class="grid cols-3" style="gap:12px;align-items:end;margin-bottom:12px">
          <div><label class="small" for="productStockSearch">Search products</label><input id="productStockSearch" class="input" type="search" placeholder="ring, pendant, polymer..."/></div>
          <div><label class="small" for="productStockLowOnly">Filter</label><select id="productStockLowOnly"><option value="0">All products</option><option value="1">Low stock only</option></select></div>
        </div>
        <div class="admin-table-wrap"><table><thead><tr><th>Product</th><th>Stock</th><th>Price</th><th>Build links</th><th>Linked low stock</th><th>Reserve tools/supplies</th></tr></thead><tbody id="productStockRows"><tr><td colspan="6" style="padding:8px">Loading stock report...</td></tr></tbody></table></div>
      </div>`;
    document.getElementById('productStockReportRefresh')?.addEventListener('click', load);
    document.getElementById('productStockSearch')?.addEventListener('input', debounce(load, 250));
    document.getElementById('productStockLowOnly')?.addEventListener('change', load);
  }
  let timer=null; function debounce(fn, wait){ return () => { clearTimeout(timer); timer=setTimeout(fn, wait); }; }
  function setValue(id, value){ const el=document.getElementById(id); if(el) el.textContent=String(value ?? '—'); }
  async function load(){
    try{
      setMsg('Loading product stock report...');
      const q = document.getElementById('productStockSearch')?.value || '';
      const lowOnly = document.getElementById('productStockLowOnly')?.value || '0';
      const response = await window.DDAuth.apiFetch(`/api/admin/product-stock-report?q=${encodeURIComponent(q)}&low_only=${encodeURIComponent(lowOnly)}`);
      const data = await response.json(); if(!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load product stock report.');
      setValue('productStockTotal', data.summary?.total_products || 0); setValue('productStockLow', data.summary?.low_stock_products || 0); setValue('productStockTracked', data.summary?.tracked_products || 0); setValue('productStockLinked', data.summary?.products_with_resources || 0);
      const rows = Array.isArray(data.items) ? data.items : []; const body = document.getElementById('productStockRows'); if(!body) return;
      if(!rows.length){ body.innerHTML='<tr><td colspan="6" style="padding:8px">No products matched the current filter.</td></tr>'; setMsg(''); return; }
      body.innerHTML = rows.map((row) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${row.featured_image_url ? `<img src="${esc(row.featured_image_url)}" alt="${esc(row.name)}" style="width:52px;height:52px;object-fit:cover;border-radius:10px;display:block;margin-bottom:8px"/>` : ''}<strong>${esc(row.name)}</strong><div class="small">${esc(row.slug)} • ${esc(row.status || 'draft')}</div></td><td style="padding:8px;border-bottom:1px solid #ddd">${row.inventory_tracking ? `${Number(row.inventory_quantity || 0)} on hand` : 'Not tracked'}<div class="small">${row.low_stock ? '⚠️ Low stock / build risk' : 'Healthy'}</div></td><td style="padding:8px;border-bottom:1px solid #ddd">${esc(money(row.price_cents || 0, row.currency || 'CAD'))}</td><td style="padding:8px;border-bottom:1px solid #ddd">${Number(row.linked_resource_count || 0)} linked resources<div class="small">${Number(row.linked_inventory_count || 0)} with inventory records</div><div class="small">${row.buildable_units_from_resources == null ? 'Buildable units: —' : `Buildable units: ${Number(row.buildable_units_from_resources || 0)}`}</div></td><td style="padding:8px;border-bottom:1px solid #ddd">${Number(row.linked_low_stock_count || 0)}<div class="small">${esc(row.linked_low_stock_names || '')}</div><div class="small">${Number(row.resource_shortage_links || 0)} direct shortages</div></td><td style="padding:8px;border-bottom:1px solid #ddd"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-reserve-product-id="${Number(row.product_id || 0)}">Reserve</button><button class="btn" type="button" data-release-product-id="${Number(row.product_id || 0)}">Release</button></div><div class="small">Uses linked tool/supply quantities for batch reservation.</div></td></tr>`).join('');
      setMsg('');
    } catch(err){ setMsg(err.message || 'Failed to load product stock report.', true); }
  }
  document.addEventListener('dd:admin-ready', (event) => { if(!event?.detail?.ok) return; render(); load(); });
  render();
});
