// File: /public/js/admin-product-resources.js
document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('productResourcesAdminMount');
  if (!mountEl) return;

  let state = {
    products: [],
    resources: [],
    links: [],
    selectedProductId: 0
  };

  function escapeHtml(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setMessage(msg, err = false) {
    const el = document.getElementById('productResourcesMessage');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
    el.style.color = err ? '#b00020' : '#0a7a2f';
  }

  async function readJsonResponse(response, fallbackMessage) {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || fallbackMessage);
      return data;
    }
    const text = await response.text().catch(() => '');
    throw new Error(text ? `${fallbackMessage} Server returned HTML instead of JSON.` : fallbackMessage);
  }

  function describeUsageUnit(item) {
    const stockLabel = String(item?.stock_unit_label || 'unit').trim() || 'unit';
    const label = String(item?.usage_unit_label || item?.usage_unit_name || 'unit').trim() || 'unit';
    const perStock = Math.max(1, Number(item?.usage_units_per_stock_unit || 1) || 1);
    return { stockLabel, label, perStock };
  }

  function buildUsagePreview(link) {
    const resource = link?.resource || {};
    const usage = describeUsageUnit(resource);
    const onHandStock = Math.max(0, Number(resource?.on_hand_quantity || 0));
    const unitCostCents = Math.max(0, Number(resource?.unit_cost_cents || 0));
    const qtyUsed = Math.max(1, Number(link?.quantity_used || 1) || 1);
    const lotSize = Math.max(1, Number(link?.lot_size_units || 1) || 1);
    const mode = String(link?.consumption_mode || 'per_unit').trim() || 'per_unit';
    const totalUsageUnits = onHandStock * usage.perStock;
    const buildable = mode === 'end_of_lot'
      ? Math.floor((totalUsageUnits * lotSize) / qtyUsed)
      : Math.floor(totalUsageUnits / qtyUsed);
    const costPerUseCents = usage.perStock > 0 ? Math.round((unitCostCents * qtyUsed) / usage.perStock) : 0;
    const costPerFinishedCents = mode === 'end_of_lot' ? Math.round(costPerUseCents / lotSize) : costPerUseCents;
    return { usage, onHandStock, totalUsageUnits, buildable, costPerUseCents, costPerFinishedCents, mode, qtyUsed, lotSize };
  }

  function formatMoney(cents) {
    const amount = Number(cents || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CAD' }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  }

  function render() {
    mountEl.innerHTML = `
      <div class="card" style="margin-top:18px">
        <h3 style="margin-top:0">Product Tools & Supplies Used</h3>
        <p class="small" style="margin-top:0">Visually link the tools and supplies used to create a finished product. This stores a reusable making-story in D1 so each finished piece can explain what materials and tools shaped it.</p>
        <div id="productResourcesMessage" class="small" style="display:none;margin-bottom:12px"></div>
        <div class="grid cols-2" style="gap:12px;margin-bottom:12px">
          <div>
            <label class="small" for="productResourcesProduct">Product</label>
            <select id="productResourcesProduct"></select>
          </div>
          <div>
            <label class="small" for="productResourcesSearch">Search tools/supplies</label>
            <input id="productResourcesSearch" type="search" placeholder="wax, pliers, resin, clay, file..." />
          </div>
        </div>
        <div class="grid cols-2" style="gap:16px">
          <div>
            <h4 style="margin-top:0">Available Items</h4>
            <div id="productResourcesGrid" class="resource-tile-grid"></div>
          </div>
          <div>
            <h4 style="margin-top:0">Linked To Product</h4>
            <div id="productResourcesLinked" class="resource-linked-list"></div>
            <div style="margin-top:12px">
              <button class="btn" type="button" id="productResourcesSaveButton">Save Product Links</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('productResourcesProduct')?.addEventListener('change', onProductChange);
    document.getElementById('productResourcesSearch')?.addEventListener('input', loadData);
    document.getElementById('productResourcesSaveButton')?.addEventListener('click', saveLinks);
    mountEl.addEventListener('click', onClick);
    mountEl.addEventListener('change', onInputChange);
    mountEl.addEventListener('input', onInputChange);
  }

  function renderProducts() {
    const sel = document.getElementById('productResourcesProduct');
    if (!sel) return;
    sel.innerHTML = `<option value="">Choose a product...</option>` +
      state.products.map((p) => `
        <option value="${p.product_id}" ${Number(p.product_id) === Number(state.selectedProductId) ? 'selected' : ''}>
          ${escapeHtml(p.name)} (${escapeHtml(p.status || '')})
        </option>
      `).join('');
  }

  function renderResources() {
    const el = document.getElementById('productResourcesGrid');
    if (!el) return;
    if (!state.resources.length) {
      el.innerHTML = `<div class="small">No matching tools or supplies were found.</div>`;
      return;
    }
    el.innerHTML = state.resources.map((item) => {
      const linked = state.links.find((x) => x.resource_kind === item.item_kind && x.source_key === item.source_key);
      const usageMeta = describeUsageUnit(item);
      return `
        <button type="button" class="resource-tile ${linked ? 'is-linked' : ''}" data-add-resource="1" data-kind="${escapeHtml(item.item_kind)}" data-key="${escapeHtml(item.source_key)}">
          <div class="resource-tile-media">
            ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy" />` : `<div class="resource-tile-placeholder">${escapeHtml(item.item_kind)}</div>`}
          </div>
          <div class="resource-tile-body">
            <strong>${escapeHtml(item.name)}</strong>
            <div class="small">${escapeHtml(item.item_kind)} • ${escapeHtml(item.category || item.subcategory || '')}</div>
            <div class="small">On hand ${Number(item.on_hand_quantity || 0)} ${escapeHtml(usageMeta.stockLabel)} • 1 ${escapeHtml(usageMeta.stockLabel)} = ${usageMeta.perStock} ${escapeHtml(usageMeta.label)}</div>
            <div class="small">${Number(item.is_on_reorder_list || 0) === 1 ? 'On reorder list' : 'Normal stock'}${Number(item.do_not_reuse || 0) === 1 ? ' • do not reuse' : ''}</div>
          </div>
        </button>`;
    }).join('');
  }

  function renderLinks() {
    const el = document.getElementById('productResourcesLinked');
    if (!el) return;
    if (!state.links.length) {
      el.innerHTML = '<div class="small">No tools or supplies linked yet.</div>';
      return;
    }
    el.innerHTML = state.links.map((link, idx) => {
      const usagePreview = buildUsagePreview(link);
      const usageMeta = usagePreview.usage;
      const mode = String(link.consumption_mode || 'per_unit');
      return `
        <div class="resource-linked-card">
          <div class="resource-linked-summary">
            <strong>${escapeHtml(link.name || link.source_key)}</strong>
            <div class="small">${escapeHtml(link.resource_kind)} • 1 ${escapeHtml(usageMeta.stockLabel)} holds ${escapeHtml(String(usageMeta.perStock))} ${escapeHtml(usageMeta.label)}</div>
            <label class="small" style="display:block;margin-top:6px">How much per use / batch <input class="input" data-link-qty="${idx}" type="number" min="1" step="1" value="${Math.max(1, Number(link.quantity_used || 1) || 1)}" /></label>
            <div class="small">Enter how many ${escapeHtml(usageMeta.label)} this product uses${mode === 'end_of_lot' ? ' per batch/lot' : ' per finished item'}.</div>
            <div class="small" style="margin-top:4px">Current stock ≈ ${escapeHtml(String(usagePreview.totalUsageUnits))} ${escapeHtml(usageMeta.label)} across ${escapeHtml(String(usagePreview.onHandStock))} ${escapeHtml(usageMeta.stockLabel)}.</div>
            <label class="small" style="display:block;margin-top:6px">Inventory handling
              <select class="input" data-link-mode="${idx}">
                <option value="per_unit" ${mode === 'per_unit' ? 'selected' : ''}>Per product</option>
                <option value="end_of_lot" ${mode === 'end_of_lot' ? 'selected' : ''}>End of lot</option>
                <option value="story_only" ${mode === 'story_only' ? 'selected' : ''}>Story only</option>
              </select>
            </label>
            <label class="small" style="display:${mode === 'end_of_lot' ? 'block' : 'none'};margin-top:6px" data-link-lot-wrap="${idx}">Products per lot / container
              <input class="input" data-link-lot="${idx}" type="number" min="1" step="1" value="${Math.max(1, Number(link.lot_size_units || 1) || 1)}" />
            </label>
            <div class="small" style="margin-top:4px">${mode === 'end_of_lot' ? `End-of-lot spreads ${escapeHtml(usageMeta.label)} usage across multiple finished products without per-item reservation.` : (mode === 'story_only' ? 'Story only keeps this item in the making record without touching cost or stock math.' : `Per product treats the quantity as ${escapeHtml(usageMeta.label)} used on every finished item.`)}</div>
            <div class="small">Estimated cost ${escapeHtml(formatMoney(usagePreview.costPerFinishedCents))} per finished product${mode === 'end_of_lot' ? ` • lot covers about ${escapeHtml(String(usagePreview.lotSize))} finished products` : ''} • buildable now ≈ ${escapeHtml(String(Math.max(0, usagePreview.buildable)))}.</div>
            <textarea class="input" data-link-note="${idx}" rows="2" placeholder="How was this item used for the story of this product?">${escapeHtml(link.usage_notes || '')}</textarea>
          </div>
          <div class="resource-linked-actions">
            <button class="btn" type="button" data-remove-link="${idx}">Remove</button>
          </div>
        </div>`;
    }).join('');
  }

  async function loadData() {
    if (!window.DDAuth?.isLoggedIn()) return;
    try {
      const q = document.getElementById('productResourcesSearch')?.value || '';
      const url = `/api/admin/product-resources?product_id=${encodeURIComponent(state.selectedProductId || 0)}&q=${encodeURIComponent(q)}`;
      const response = await window.DDAuth.apiFetch(url);
      const data = await readJsonResponse(response, 'Failed to load product resources.');
      state.products = Array.isArray(data.products) ? data.products : [];
      state.resources = Array.isArray(data.resources) ? data.resources : [];
      const links = Array.isArray(data.links) ? data.links : [];
      state.links = links.map((x) => {
        const resource = state.resources.find((r) => r.item_kind === x.resource_kind && r.source_key === x.source_key) || {};
        return {
          ...x,
          resource,
          name: resource.name || x.source_key,
          consumption_mode: x.consumption_mode || 'per_unit',
          lot_size_units: Math.max(1, Number(x.lot_size_units || 1) || 1),
          quantity_used: Math.max(1, Number(x.quantity_used || 1) || 1)
        };
      });
      renderProducts();
      renderResources();
      renderLinks();
      setMessage('');
    } catch (err) {
      setMessage(err.message || 'Failed to load product resources.', true);
    }
  }

  function onProductChange(event) {
    state.selectedProductId = Number(event.target.value || 0);
    loadData();
  }

  function onInputChange(event) {
    const qtyIndex = event.target.getAttribute('data-link-qty');
    if (qtyIndex != null) {
      const row = state.links[Number(qtyIndex)];
      if (row) row.quantity_used = Math.max(1, Number(event.target.value || 1) || 1);
      return;
    }
    const noteIndex = event.target.getAttribute('data-link-note');
    if (noteIndex != null) {
      const row = state.links[Number(noteIndex)];
      if (row) row.usage_notes = String(event.target.value || '').trim();
      return;
    }
    const modeIndex = event.target.getAttribute('data-link-mode');
    if (modeIndex != null) {
      const row = state.links[Number(modeIndex)];
      if (row) {
        row.consumption_mode = String(event.target.value || 'per_unit').trim() || 'per_unit';
        if (row.consumption_mode !== 'end_of_lot') row.lot_size_units = 1;
        renderLinks();
      }
      return;
    }
    const lotIndex = event.target.getAttribute('data-link-lot');
    if (lotIndex != null) {
      const row = state.links[Number(lotIndex)];
      if (row) row.lot_size_units = Math.max(1, Number(event.target.value || 1) || 1);
    }
  }

  function onClick(event) {
    const add = event.target.closest('[data-add-resource]');
    const remove = event.target.closest('[data-remove-link]');
    if (add) {
      const kind = add.getAttribute('data-kind') || '';
      const key = add.getAttribute('data-key') || '';
      const item = state.resources.find((x) => x.item_kind === kind && x.source_key === key);
      if (!item) return;
      if (!state.links.find((x) => x.resource_kind === kind && x.source_key === key)) {
        state.links.push({
          resource_kind: kind,
          source_key: key,
          quantity_used: 1,
          usage_notes: '',
          sort_order: state.links.length,
          name: item.name,
          resource: item,
          consumption_mode: 'per_unit',
          lot_size_units: 1
        });
      }
      renderResources();
      renderLinks();
      return;
    }
    if (remove) {
      const idx = Number(remove.getAttribute('data-remove-link') || -1);
      if (idx >= 0) {
        state.links.splice(idx, 1);
        renderResources();
        renderLinks();
      }
    }
  }

  async function saveLinks() {
    if (!state.selectedProductId) {
      setMessage('Choose a product first.', true);
      return;
    }
    try {
      setMessage('Saving product links...');
      const response = await window.DDAuth.apiFetch('/api/admin/product-resources', {
        method: 'POST',
        body: JSON.stringify({
          product_id: state.selectedProductId,
          links: state.links.map((x, i) => ({
            resource_kind: x.resource_kind,
            source_key: x.source_key,
            quantity_used: Math.max(1, Number(x.quantity_used || 1) || 1),
            usage_notes: x.usage_notes || '',
            consumption_mode: x.consumption_mode || 'per_unit',
            lot_size_units: Math.max(1, Number(x.lot_size_units || 1) || 1),
            sort_order: i
          }))
        })
      });
      const data = await readJsonResponse(response, 'Failed to save product links.');
      setMessage(`Saved ${Number(data.saved_links || 0)} linked items.`);
      await loadData();
    } catch (err) {
      setMessage(err.message || 'Failed to save product links.', true);
    }
  }

  document.addEventListener('dd:catalog-options-updated', () => { if (window.DDAuth?.isLoggedIn()) loadData(); });
  document.addEventListener('dd:admin-ready', (event) => { if (!event?.detail?.ok) return; render(); loadData(); });
  render();
  if (window.DDAuth?.isLoggedIn()) loadData();
});
