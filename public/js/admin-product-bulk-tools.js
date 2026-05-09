// File: /public/js/admin-product-bulk-tools.js
// Brief description: Adds safer bulk product workflow tools to the admin dashboard. It lets
// admins update selected items, an entire category, or the full catalog, including controlled
// price adjustments for tariffs, packaging changes, and other broad selling-price revisions.

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('productsAdminMount');
  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let rendered = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  }

  function formatMoney(cents, currency = 'CAD') {
    const amount = Number(cents || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'CAD' }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency || 'CAD'}`;
    }
  }

  function setMessage(message, isError = false) {
    const el = document.getElementById('adminBulkProductsMessage');
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
    el.style.color = isError ? '#b00020' : '#0a7a2f';
  }

  function setPreview(html = '') {
    const el = document.getElementById('adminBulkProductsPreview');
    if (!el) return;
    el.innerHTML = html;
    el.style.display = html ? 'block' : 'none';
  }

  function render() {
    if (rendered) return;
    rendered = true;

    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = '18px';
    card.innerHTML = `
      <h3 style="margin-top:0">Bulk Product Tools</h3>
      <p class="small" style="margin-top:0">Change product prices and catalog fields by selected items, by category, or across the full product list. Single-item price edits still remain available from each product row.</p>
      <div id="adminBulkProductsMessage" class="small" style="display:none;margin-bottom:12px"></div>
      <div id="adminBulkProductsPreview" class="small" style="display:none;margin-bottom:12px"></div>
      <div class="grid cols-2" style="gap:18px">
        <form id="bulkProductUpdateForm" class="grid" style="gap:12px">
          <div class="grid cols-3" style="gap:12px">
            <div>
              <label class="small" for="bulkSelectionScope">Selection Scope</label>
              <select id="bulkSelectionScope">
                <option value="ids">Selected product IDs</option>
                <option value="category">Entire category</option>
                <option value="all">Entire product inventory</option>
              </select>
            </div>
            <div>
              <label class="small" for="bulkProductIds">Product IDs</label>
              <input id="bulkProductIds" type="text" placeholder="12, 15, 18" />
            </div>
            <div>
              <label class="small" for="bulkProductCategory">Product Category</label>
              <input id="bulkProductCategory" type="text" placeholder="rings, pendants, supplies..." />
            </div>
          </div>

          <div class="grid cols-3" style="gap:12px">
            <div>
              <label class="small" for="bulkPriceAction">Price Change</label>
              <select id="bulkPriceAction">
                <option value="">No price change</option>
                <option value="set_price_cents">Set exact price</option>
                <option value="increase_percent">Increase by percent</option>
                <option value="decrease_percent">Decrease by percent</option>
                <option value="increase_cents">Increase by fixed amount</option>
                <option value="decrease_cents">Decrease by fixed amount</option>
              </select>
            </div>
            <div>
              <label class="small" for="bulkPriceValue">Price Value</label>
              <input id="bulkPriceValue" type="number" min="0" step="0.01" placeholder="e.g. 10 or 5.00" />
            </div>
            <div>
              <label class="small" for="bulkCompareAtStrategy">Compare-at Handling</label>
              <select id="bulkCompareAtStrategy">
                <option value="no_change">No change</option>
                <option value="set_previous_price">Copy previous live price into compare-at</option>
                <option value="clear">Clear compare-at</option>
              </select>
            </div>
          </div>

          <div class="grid cols-3" style="gap:12px">
            <div>
              <label class="small" for="bulkProductStatus">Bulk Status</label>
              <select id="bulkProductStatus">
                <option value="">No change</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label class="small" for="bulkProductInventory">Inventory Quantity</label>
              <input id="bulkProductInventory" type="number" min="0" step="1" placeholder="Optional" />
            </div>
            <div>
              <label class="small" for="bulkTaxClassId">Tax Class ID</label>
              <input id="bulkTaxClassId" type="number" min="1" step="1" placeholder="Optional" />
            </div>
          </div>

          <div class="grid cols-3" style="gap:12px">
            <div>
              <label class="small" for="bulkInventoryTracking">Inventory Tracking</label>
              <select id="bulkInventoryTracking">
                <option value="">No change</option>
                <option value="1">Track inventory</option>
                <option value="0">Do not track</option>
              </select>
            </div>
            <div>
              <label class="small" for="bulkRequiresShipping">Requires Shipping</label>
              <select id="bulkRequiresShipping">
                <option value="">No change</option>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>
            <div>
              <label class="small" for="bulkTaxable">Taxable</label>
              <select id="bulkTaxable">
                <option value="">No change</option>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn" type="button" id="bulkProductPreviewButton">Preview Bulk Update</button>
            <button class="btn primary" type="submit" id="bulkProductUpdateButton">Apply Bulk Update</button>
          </div>
        </form>

        <form id="productImportPreviewForm" class="grid" style="gap:12px">
          <div>
            <label class="small" for="productImportRows">Import Preview JSON Rows</label>
            <textarea id="productImportRows" rows="10" placeholder='[{"name":"Example","slug":"example","product_type":"physical","price_cents":2500}]'></textarea>
          </div>
          <div><button class="btn" type="submit" id="productImportPreviewButton">Preview Import</button></div>
          <div id="productImportPreviewResults" class="small"></div>
        </form>
      </div>
    `;

    mountEl.appendChild(card);
    document.getElementById('bulkProductUpdateForm')?.addEventListener('submit', onBulkUpdate);
    document.getElementById('bulkProductPreviewButton')?.addEventListener('click', onBulkPreview);
    document.getElementById('productImportPreviewForm')?.addEventListener('submit', onImportPreview);
    document.getElementById('bulkSelectionScope')?.addEventListener('change', updateScopeHelpers);
    document.getElementById('bulkPriceAction')?.addEventListener('change', updatePriceHelperText);
    updateScopeHelpers();
    updatePriceHelperText();
  }

  function parseIds(text) {
    return String(text || '')
      .split(',')
      .map((part) => Number(String(part).trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  function dollarsToCents(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const number = Number(text);
    if (!Number.isFinite(number) || number < 0) return null;
    return Math.round(number * 100);
  }

  function updateScopeHelpers() {
    const scope = String(document.getElementById('bulkSelectionScope')?.value || 'ids');
    const idsEl = document.getElementById('bulkProductIds');
    const categoryEl = document.getElementById('bulkProductCategory');
    if (idsEl) idsEl.disabled = scope !== 'ids';
    if (categoryEl) categoryEl.disabled = scope !== 'category';
  }

  function updatePriceHelperText() {
    const action = String(document.getElementById('bulkPriceAction')?.value || '');
    const valueEl = document.getElementById('bulkPriceValue');
    if (!valueEl) return;
    if (action === 'set_price_cents') {
      valueEl.placeholder = 'Exact price in dollars, e.g. 24.95';
    } else if (action === 'increase_percent' || action === 'decrease_percent') {
      valueEl.placeholder = 'Percent, e.g. 10';
    } else if (action === 'increase_cents' || action === 'decrease_cents') {
      valueEl.placeholder = 'Amount in dollars, e.g. 2.50';
    } else {
      valueEl.placeholder = 'e.g. 10 or 5.00';
    }
  }

  function buildPayload(includePreview = false) {
    const scope = String(document.getElementById('bulkSelectionScope')?.value || 'ids').trim();
    const ids = parseIds(document.getElementById('bulkProductIds')?.value);
    const category = String(document.getElementById('bulkProductCategory')?.value || '').trim();
    const status = String(document.getElementById('bulkProductStatus')?.value || '').trim();
    const inventoryRaw = String(document.getElementById('bulkProductInventory')?.value || '').trim();
    const taxClassRaw = String(document.getElementById('bulkTaxClassId')?.value || '').trim();
    const inventoryTrackingRaw = String(document.getElementById('bulkInventoryTracking')?.value || '').trim();
    const requiresShippingRaw = String(document.getElementById('bulkRequiresShipping')?.value || '').trim();
    const taxableRaw = String(document.getElementById('bulkTaxable')?.value || '').trim();
    const priceAction = String(document.getElementById('bulkPriceAction')?.value || '').trim();
    const priceValueRaw = String(document.getElementById('bulkPriceValue')?.value || '').trim();
    const compareAtStrategy = String(document.getElementById('bulkCompareAtStrategy')?.value || 'no_change').trim();

    const payload = {
      selection_scope: scope,
      product_ids: ids,
      product_category: category,
      preview: includePreview ? 1 : 0,
      updates: {}
    };

    if (scope === 'ids' && !ids.length) {
      throw new Error('Please enter at least one valid product ID.');
    }
    if (scope === 'category' && !category) {
      throw new Error('Please enter a product category for category-wide updates.');
    }

    if (status) payload.updates.status = status;
    if (inventoryRaw !== '') payload.updates.inventory_quantity = Number(inventoryRaw);
    if (taxClassRaw !== '') payload.updates.tax_class_id = Number(taxClassRaw);
    if (inventoryTrackingRaw !== '') payload.updates.inventory_tracking = Number(inventoryTrackingRaw);
    if (requiresShippingRaw !== '') payload.updates.requires_shipping = Number(requiresShippingRaw);
    if (taxableRaw !== '') payload.updates.taxable = Number(taxableRaw);

    if (priceAction) {
      let normalizedValue = null;
      if (priceAction === 'set_price_cents' || priceAction === 'increase_cents' || priceAction === 'decrease_cents') {
        normalizedValue = dollarsToCents(priceValueRaw);
        if (normalizedValue == null) throw new Error('Please enter a valid dollar amount for the selected price change.');
      } else {
        const percentValue = Number(priceValueRaw);
        if (!Number.isFinite(percentValue) || percentValue <= 0) {
          throw new Error('Please enter a valid percentage greater than zero.');
        }
        normalizedValue = percentValue;
      }
      payload.updates.price_action = priceAction;
      payload.updates.price_value = normalizedValue;
      payload.updates.compare_at_strategy = compareAtStrategy || 'no_change';
    }

    if (!Object.keys(payload.updates).length) {
      throw new Error('Please choose at least one field to change before running the bulk update.');
    }

    return payload;
  }

  function renderPreview(data) {
    const rows = Array.isArray(data?.preview_products) ? data.preview_products : [];
    const selectionLabel = escapeHtml(data?.selection?.label || 'Selected products');
    const requested = Array.isArray(data?.requested_changes) ? data.requested_changes.map((row) => `<li>${escapeHtml(row)}</li>`).join('') : '';
    const table = rows.length ? `
      <div class="table-wrap" style="margin-top:10px">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Product</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Category</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Current Price</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Preview Price</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(row.name || '')}</strong><div class="small">#${escapeHtml(row.product_id)} · ${escapeHtml(row.slug || row.sku || '')}</div></td>
                <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(row.product_category || '—')}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatMoney(row.current_price_cents, row.currency || 'CAD'))}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatMoney(row.preview_price_cents, row.currency || 'CAD'))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="small" style="margin-top:10px">No preview rows were returned.</div>';

    setPreview(`
      <div><strong>Preview</strong> · ${escapeHtml(selectionLabel)} · ${escapeHtml(String(Number(data?.matched_count || 0)))} matched product(s)</div>
      ${requested ? `<ul style="margin:8px 0 0 18px">${requested}</ul>` : ''}
      ${table}
    `);
  }

  async function sendBulkRequest(payload, button, actionLabel) {
    const original = button ? button.textContent : '';
    try {
      if (button) {
        button.disabled = true;
        button.textContent = actionLabel;
      }
      const response = await window.DDAuth.apiFetch('/api/admin/bulk-update-products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Bulk product update failed.');
      return data;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  async function onBulkPreview() {
    try {
      const button = document.getElementById('bulkProductPreviewButton');
      setMessage('Building bulk update preview...');
      const payload = buildPayload(true);
      const data = await sendBulkRequest(payload, button, 'Previewing...');
      renderPreview(data);
      setMessage(`Preview ready for ${Number(data?.matched_count || 0)} product(s).`);
    } catch (error) {
      setPreview('');
      setMessage(error.message || 'Bulk preview failed.', true);
    }
  }

  async function onBulkUpdate(event) {
    event.preventDefault();
    try {
      const button = document.getElementById('bulkProductUpdateButton');
      const payload = buildPayload(false);
      const scope = String(payload.selection_scope || 'ids');
      if (scope === 'all' && !window.confirm('Apply this bulk update to the entire product inventory?')) return;
      if (scope === 'category' && !window.confirm(`Apply this bulk update to category "${payload.product_category}"?`)) return;
      setMessage('Running bulk product update...');
      const data = await sendBulkRequest(payload, button, 'Updating...');
      renderPreview(data);
      setMessage(`Bulk update completed for ${Number(data?.updated_count || 0)} product(s).`);
      document.dispatchEvent(new CustomEvent('dd:product-updated', { detail: { bulk: true } }));
    } catch (error) {
      setMessage(error.message || 'Bulk product update failed.', true);
    }
  }

  async function onImportPreview(event) {
    event.preventDefault();
    const outputEl = document.getElementById('productImportPreviewResults');
    if (!outputEl) return;

    let rows;
    try {
      rows = JSON.parse(String(document.getElementById('productImportRows')?.value || '[]'));
    } catch {
      setMessage('Import preview JSON is invalid.', true);
      return;
    }

    try {
      setMessage('Generating import preview...');
      const response = await window.DDAuth.apiFetch('/api/admin/import-products-preview', {
        method: 'POST',
        body: JSON.stringify({ rows })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Import preview failed.');
      outputEl.innerHTML = `Valid rows: ${Number(data.summary?.valid_rows || 0)} • Invalid rows: ${Number(data.summary?.invalid_rows || 0)}<br>${(data.preview || []).slice(0, 5).map((row) => `Row ${row.row_number}: ${row.valid ? 'OK' : row.issues.join(' ')}`).join('<br>')}`;
      setMessage('Import preview generated.');
    } catch (error) {
      outputEl.textContent = '';
      setMessage(error.message || 'Import preview failed.', true);
    }
  }

  document.addEventListener('dd:admin-ready', (event) => {
    if (!event?.detail?.ok) return;
    render();
  });

  render();
});
