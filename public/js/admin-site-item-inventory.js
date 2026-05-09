// File: /public/js/admin-site-item-inventory.js
// Brief description: Admin editor for tools and supplies inventory, reorder queues,
// do-not-reuse flags, supplier details, item images, movement history, and bulk cost updates.

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('siteInventoryAdminMount');
  if (!mountEl) return;

  let rendered = false;

  function setMessage(message, isError = false) {
    const el = document.getElementById('siteInventoryMessage');
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
    el.style.color = isError ? '#b00020' : '#0a7a2f';
  }

  function fmtMoney(cents) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CAD' }).format(Number(cents || 0) / 100);
  }

  function describeStockUsage(item = {}) {
    const stockLabel = String(item?.stock_unit_label || 'unit').trim() || 'unit';
    const usageLabel = String(item?.usage_unit_label || 'unit').trim() || 'unit';
    const perStock = Math.max(1, Number(item?.usage_units_per_stock_unit || 1) || 1);
    return { stockLabel, usageLabel, perStock };
  }

  function escapeHtml(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function debounce(fn, wait) {
    let t = null;
    return () => {
      clearTimeout(t);
      t = setTimeout(() => fn(), wait);
    };
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value ?? '—');
  }

  function parseInventoryIds(text) {
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

  function setBulkPreview(html) {
    const el = document.getElementById('siteInventoryBulkCostPreview');
    if (!el) return;
    el.innerHTML = html || '';
    el.style.display = html ? 'block' : 'none';
  }

  function updateBulkCostScopeHelpers() {
    const scope = String(document.getElementById('siteInventoryBulkScope')?.value || 'ids');
    const idsEl = document.getElementById('siteInventoryBulkIds');
    const categoryEl = document.getElementById('siteInventoryBulkCategory');
    const sourceTypeEl = document.getElementById('siteInventoryBulkSourceType');
    if (idsEl) idsEl.disabled = scope !== 'ids';
    if (categoryEl) categoryEl.disabled = scope !== 'category';
    if (sourceTypeEl) sourceTypeEl.disabled = scope !== 'source_type';
  }

  function updateBulkCostPlaceholder() {
    const action = String(document.getElementById('siteInventoryBulkCostAction')?.value || '');
    const valueEl = document.getElementById('siteInventoryBulkCostValue');
    if (!valueEl) return;
    if (action === 'set_cost_cents') {
      valueEl.placeholder = 'Exact unit cost in dollars, e.g. 4.95';
    } else if (action === 'increase_percent' || action === 'decrease_percent') {
      valueEl.placeholder = 'Percent, e.g. 12';
    } else if (action === 'increase_cents' || action === 'decrease_cents') {
      valueEl.placeholder = 'Amount in dollars, e.g. 0.40';
    } else {
      valueEl.placeholder = 'e.g. 10 or 1.25';
    }
  }

  function buildBulkCostPayload(includePreview = false) {
    const scope = String(document.getElementById('siteInventoryBulkScope')?.value || 'ids').trim();
    const ids = parseInventoryIds(document.getElementById('siteInventoryBulkIds')?.value || '');
    const category = String(document.getElementById('siteInventoryBulkCategory')?.value || '').trim();
    const sourceType = String(document.getElementById('siteInventoryBulkSourceType')?.value || '').trim();
    const action = String(document.getElementById('siteInventoryBulkCostAction')?.value || '').trim();
    const valueRaw = String(document.getElementById('siteInventoryBulkCostValue')?.value || '').trim();
    const reasonNote = String(document.getElementById('siteInventoryBulkReason')?.value || '').trim();

    if (scope === 'ids' && !ids.length) {
      throw new Error('Please enter at least one valid inventory item ID.');
    }
    if (scope === 'category' && !category) {
      throw new Error('Please enter a category for category-wide cost updates.');
    }
    if (scope === 'source_type' && !sourceType) {
      throw new Error('Please choose a source type for source-type cost updates.');
    }
    if (!action) {
      throw new Error('Please choose a cost change before running the bulk update.');
    }

    let normalizedValue = null;
    if (action === 'set_cost_cents' || action === 'increase_cents' || action === 'decrease_cents') {
      normalizedValue = dollarsToCents(valueRaw);
      if (normalizedValue == null) {
        throw new Error('Please enter a valid dollar amount for the selected cost change.');
      }
    } else {
      const percentValue = Number(valueRaw);
      if (!Number.isFinite(percentValue) || percentValue <= 0) {
        throw new Error('Please enter a valid percentage greater than zero.');
      }
      normalizedValue = percentValue;
    }

    return {
      selection_scope: scope,
      inventory_ids: ids,
      category,
      source_type: sourceType,
      reason_note: reasonNote,
      preview: includePreview ? 1 : 0,
      updates: {
        cost_action: action,
        cost_value: normalizedValue
      }
    };
  }

  function renderBulkCostPreview(data) {
    const rows = Array.isArray(data?.preview_items) ? data.preview_items : [];
    const selectionLabel = escapeHtml(data?.selection?.label || 'Selected inventory');
    const requested = Array.isArray(data?.requested_changes)
      ? data.requested_changes.map((row) => `<li>${escapeHtml(row)}</li>`).join('')
      : '';

    const table = rows.length ? `
      <div class="table-wrap" style="margin-top:10px">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Item</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Type</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Current Cost</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Preview Cost</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(row.item_name || '')}</strong><div class="small">#${escapeHtml(row.site_item_inventory_id)} · ${escapeHtml(row.category || '—')}</div></td>
                <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(row.source_type || '—')}<div class="small">${escapeHtml(row.supplier_name || '')}</div></td>
                <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(fmtMoney(row.current_unit_cost_cents || 0))}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(fmtMoney(row.preview_unit_cost_cents || 0))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="small" style="margin-top:10px">No preview rows were returned.</div>';

    setBulkPreview(`
      <div><strong>Preview</strong> · ${selectionLabel} · ${escapeHtml(String(Number(data?.matched_count || 0)))} matched inventory item(s)</div>
      ${requested ? `<ul style="margin:8px 0 0 18px">${requested}</ul>` : ''}
      ${table}
    `);
  }

  async function sendBulkCostRequest(payload, button, actionLabel) {
    const original = button ? button.textContent : '';
    try {
      if (button) {
        button.disabled = true;
        button.textContent = actionLabel;
      }
      const response = await window.DDAuth.apiFetch('/api/admin/bulk-update-site-inventory', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Bulk inventory cost update failed.');
      return data;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  async function onBulkCostPreview() {
    try {
      const button = document.getElementById('siteInventoryBulkPreviewButton');
      setMessage('Building inventory cost preview...');
      const payload = buildBulkCostPayload(true);
      const data = await sendBulkCostRequest(payload, button, 'Previewing...');
      renderBulkCostPreview(data);
      setMessage(`Inventory cost preview ready for ${Number(data?.matched_count || 0)} item(s).`);
    } catch (error) {
      setBulkPreview('');
      setMessage(error.message || 'Bulk inventory cost preview failed.', true);
    }
  }

  async function onBulkCostApply(event) {
    event.preventDefault();
    try {
      const button = document.getElementById('siteInventoryBulkApplyButton');
      const payload = buildBulkCostPayload(false);
      const scope = String(payload.selection_scope || 'ids');
      if (scope === 'all' && !window.confirm('Apply this unit-cost update to the entire site inventory?')) return;
      if (scope === 'category' && !window.confirm(`Apply this unit-cost update to category "${payload.category}"?`)) return;
      if (scope === 'source_type' && !window.confirm(`Apply this unit-cost update to source type "${payload.source_type}"?`)) return;
      setMessage('Running bulk inventory cost update...');
      const data = await sendBulkCostRequest(payload, button, 'Updating...');
      renderBulkCostPreview(data);
      setMessage(`Bulk inventory cost update completed for ${Number(data?.updated_count || 0)} item(s).`);
      await loadList();
    } catch (error) {
      setMessage(error.message || 'Bulk inventory cost update failed.', true);
    }
  }

  function render() {
    if (rendered) return;
    rendered = true;
    mountEl.innerHTML = `
      <div class="card" style="margin-top:18px">
        <h3 style="margin-top:0">Tools &amp; Supplies Inventory Operations</h3>
        <p class="small" style="margin-top:0">Track quantities, reorder lists, do-not-reuse flags, supplier details, item images, movement history, and bulk unit-cost changes for tariffs, shipping, or packaging increases.</p>
        <div id="siteInventoryMessage" class="small" style="display:none;margin-bottom:12px"></div>
        <div class="grid cols-6" style="gap:12px;margin-bottom:12px">
          <div class="card"><div class="small">Items</div><div id="siteInventoryTotalItems" style="font-size:1.15rem;font-weight:800">—</div></div>
          <div class="card"><div class="small">Active</div><div id="siteInventoryActiveItems" style="font-size:1.15rem;font-weight:800">—</div></div>
          <div class="card"><div class="small">Low Stock</div><div id="siteInventoryLowStock" style="font-size:1.15rem;font-weight:800">—</div></div>
          <div class="card"><div class="small">Reserved</div><div id="siteInventoryReserved" style="font-size:1.15rem;font-weight:800">—</div></div>
          <div class="card"><div class="small">Incoming</div><div id="siteInventoryIncoming" style="font-size:1.15rem;font-weight:800">—</div></div>
          <div class="card"><div class="small">Reorder List</div><div id="siteInventoryReorderListCount" style="font-size:1.15rem;font-weight:800">—</div></div>
        </div>

        <form id="siteInventoryForm" class="grid" style="gap:12px">
          <div class="grid cols-4" style="gap:12px">
            <div><label class="small" for="siteInventorySourceType">Source Type</label><select id="siteInventorySourceType"><option value="tool">Tool</option><option value="supply">Supply</option><option value="product">Product</option><option value="other">Other</option></select></div>
            <div><label class="small" for="siteInventoryExternalKey">External Key</label><input id="siteInventoryExternalKey" type="text" placeholder="sku, source key, item id" /></div>
            <div><label class="small" for="siteInventoryItemName">Item Name</label><input id="siteInventoryItemName" type="text" /></div>
            <div><label class="small" for="siteInventoryCategory">Category</label><input id="siteInventoryCategory" type="text" /></div>
          </div>
          <div class="grid cols-4" style="gap:12px">
            <div><label class="small" for="siteInventoryImageUrl">Image URL</label><input id="siteInventoryImageUrl" type="url" placeholder="https://..." /></div>
            <div><label class="small" for="siteInventorySourceUrl">Source URL</label><input id="siteInventorySourceUrl" type="url" placeholder="https://..." /></div>
            <div><label class="small" for="siteInventoryAmazonUrl">Amazon URL</label><input id="siteInventoryAmazonUrl" type="url" placeholder="https://..." /></div>
            <div><label class="small" for="siteInventoryIsActive">Status</label><select id="siteInventoryIsActive"><option value="1">Active</option><option value="0">Inactive</option></select></div>
          </div>
          <div class="grid cols-5" style="gap:12px">
            <div><label class="small" for="siteInventoryOnHand">On Hand</label><input id="siteInventoryOnHand" type="number" min="0" step="1" value="0" /></div>
            <div><label class="small" for="siteInventoryReservedInput">Reserved</label><input id="siteInventoryReservedInput" type="number" min="0" step="1" value="0" /></div>
            <div><label class="small" for="siteInventoryIncomingInput">Incoming</label><input id="siteInventoryIncomingInput" type="number" min="0" step="1" value="0" /></div>
            <div><label class="small" for="siteInventoryReorder">Reorder At</label><input id="siteInventoryReorder" type="number" min="0" step="1" value="0" /></div>
            <div><label class="small" for="siteInventoryPreferredReorderQty">Preferred Reorder Qty</label><input id="siteInventoryPreferredReorderQty" type="number" min="0" step="1" value="0" /></div>
          </div>
          <div class="grid cols-6" style="gap:12px">
            <div><label class="small" for="siteInventoryUnitCost">Unit Cost (cents)</label><input id="siteInventoryUnitCost" type="number" min="0" step="1" value="0" /></div>
            <div><label class="small" for="siteInventoryStockUnitLabel">Stock Unit</label><input id="siteInventoryStockUnitLabel" type="text" placeholder="block, spool, bag, bottle" value="unit" /></div>
            <div><label class="small" for="siteInventoryUsageUnitLabel">Usage Unit</label><input id="siteInventoryUsageUnitLabel" type="text" placeholder="cup, wick, gram, use" value="unit" /></div>
            <div><label class="small" for="siteInventoryUsageUnitsPerStock">Usage Units Per Stock Unit</label><input id="siteInventoryUsageUnitsPerStock" type="number" min="1" step="0.001" value="1" /></div>
            <div><label class="small" for="siteInventorySupplierName">Supplier</label><input id="siteInventorySupplierName" type="text" /></div>
            <div><label class="small" for="siteInventorySupplierSku">Supplier SKU</label><input id="siteInventorySupplierSku" type="text" /></div>
          </div>
          <div class="grid cols-3" style="gap:12px">
            <div><label class="small" for="siteInventorySupplierContact">Supplier Contact</label><input id="siteInventorySupplierContact" type="text" placeholder="email or phone" /></div>
            <div><label class="small" for="siteInventoryReuseStatus">Reuse Status</label><input id="siteInventoryReuseStatus" type="text" placeholder="wash, refill, one-time use" /></div>
            <div class="small" style="align-self:end">Examples: candle wax block = 20 cups per stock unit, wick bag = 100 wicks, PLA spool = 1000 grams.</div>
          </div>
          <div class="grid cols-4" style="gap:12px">
            <label class="small" style="display:flex;gap:8px;align-items:center"><input id="siteInventoryOnReorderList" type="checkbox" /> On reorder list</label>
            <label class="small" style="display:flex;gap:8px;align-items:center"><input id="siteInventoryDoNotReorder" type="checkbox" /> Do not reorder</label>
            <label class="small" style="display:flex;gap:8px;align-items:center"><input id="siteInventoryDoNotReuse" type="checkbox" /> Do not reuse</label>
            <div></div>
          </div>
          <div class="grid cols-2" style="gap:12px">
            <div><label class="small" for="siteInventoryNotes">Reorder / Usage Notes</label><input id="siteInventoryNotes" type="text" /></div>
            <div><label class="small" for="siteInventoryMovementNote">Movement Note</label><input id="siteInventoryMovementNote" type="text" placeholder="restock, count correction, incoming order..." /></div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit">Save Inventory Item</button><button class="btn" type="button" id="siteInventoryResetButton">Reset Form</button></div>
        </form>

        <div class="grid cols-4" style="gap:12px;align-items:end;margin-top:16px">
          <div><label class="small" for="siteInventorySearch">Search</label><input id="siteInventorySearch" type="text" placeholder="name, category, supplier" /></div>
          <div><label class="small" for="siteInventoryStockView">Stock view</label><select id="siteInventoryStockView"><option value="">All items</option><option value="low">Low stock</option><option value="reorder">Reorder list</option><option value="no_reuse">Do not reuse</option><option value="inactive">Inactive</option></select></div>
          <div style="align-self:end;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="siteInventoryRefreshButton">Refresh</button><button class="btn" type="button" id="siteInventorySyncToolsButton">Sync tools</button><button class="btn" type="button" id="siteInventorySyncSuppliesButton">Sync supplies</button></div>
        </div>

        <div class="card" style="margin-top:16px">
          <h4 style="margin-top:0">Bulk unit-cost updates</h4>
          <p class="small" style="margin-top:0">Use this for supplier increases, tariff changes, shipping and packaging cost shifts, or one-time cost corrections before repricing finished products.</p>
          <form id="siteInventoryBulkCostForm" class="grid" style="gap:12px">
            <div class="grid cols-4" style="gap:12px">
              <div>
                <label class="small" for="siteInventoryBulkScope">Selection Scope</label>
                <select id="siteInventoryBulkScope">
                  <option value="ids">Selected inventory IDs</option>
                  <option value="category">Entire category</option>
                  <option value="source_type">Entire source type</option>
                  <option value="all">Entire site inventory</option>
                </select>
              </div>
              <div>
                <label class="small" for="siteInventoryBulkIds">Inventory IDs</label>
                <input id="siteInventoryBulkIds" type="text" placeholder="12, 15, 18" />
              </div>
              <div>
                <label class="small" for="siteInventoryBulkCategory">Category</label>
                <input id="siteInventoryBulkCategory" type="text" placeholder="packaging, resin, cleaning..." />
              </div>
              <div>
                <label class="small" for="siteInventoryBulkSourceType">Source Type</label>
                <select id="siteInventoryBulkSourceType">
                  <option value="">Choose type</option>
                  <option value="tool">Tool</option>
                  <option value="supply">Supply</option>
                  <option value="product">Product</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div class="grid cols-3" style="gap:12px">
              <div>
                <label class="small" for="siteInventoryBulkCostAction">Cost Change</label>
                <select id="siteInventoryBulkCostAction">
                  <option value="">No change selected</option>
                  <option value="set_cost_cents">Set exact unit cost</option>
                  <option value="increase_percent">Increase by percent</option>
                  <option value="decrease_percent">Decrease by percent</option>
                  <option value="increase_cents">Increase by fixed amount</option>
                  <option value="decrease_cents">Decrease by fixed amount</option>
                </select>
              </div>
              <div>
                <label class="small" for="siteInventoryBulkCostValue">Cost Value</label>
                <input id="siteInventoryBulkCostValue" type="number" min="0" step="0.01" placeholder="e.g. 10 or 1.25" />
              </div>
              <div>
                <label class="small" for="siteInventoryBulkReason">Reason / note</label>
                <input id="siteInventoryBulkReason" type="text" maxlength="180" placeholder="Tariff increase, vendor shipping surcharge, packaging correction" />
              </div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn" type="button" id="siteInventoryBulkPreviewButton">Preview Cost Update</button>
              <button class="btn primary" type="submit" id="siteInventoryBulkApplyButton">Apply Cost Update</button>
            </div>
          </form>
          <div id="siteInventoryBulkCostPreview" class="small" style="display:none;margin-top:12px"></div>
        </div>

        <div class="admin-table-wrap" style="margin-top:12px"><table><thead><tr><th>Item</th><th>Stock</th><th>Rules</th><th>Supplier</th><th>Linked Products</th><th>Cost</th><th>Actions</th></tr></thead><tbody id="siteInventoryList"><tr><td colspan="7" style="padding:8px">Loading inventory...</td></tr></tbody></table></div>
        <div class="card" style="margin-top:16px"><h4 style="margin-top:0">Recent Inventory Movements</h4><div class="admin-table-wrap"><table><thead><tr><th>When</th><th>Item</th><th>Type</th><th>On Hand</th><th>Note</th></tr></thead><tbody id="siteInventoryMovementList"><tr><td colspan="5" style="padding:8px">Loading movement history...</td></tr></tbody></table></div></div>
      </div>`;

    document.getElementById('siteInventoryForm')?.addEventListener('submit', saveItem);
    document.getElementById('siteInventoryRefreshButton')?.addEventListener('click', loadList);
    document.getElementById('siteInventoryStockView')?.addEventListener('change', loadList);
    document.getElementById('siteInventorySyncToolsButton')?.addEventListener('click', () => syncCatalog(['tool']));
    document.getElementById('siteInventorySyncSuppliesButton')?.addEventListener('click', () => syncCatalog(['supply']));
    document.getElementById('siteInventorySearch')?.addEventListener('input', debounce(loadList, 250));
    document.getElementById('siteInventoryResetButton')?.addEventListener('click', () => document.getElementById('siteInventoryForm')?.reset());
    document.getElementById('siteInventoryBulkCostForm')?.addEventListener('submit', onBulkCostApply);
    document.getElementById('siteInventoryBulkPreviewButton')?.addEventListener('click', onBulkCostPreview);
    document.getElementById('siteInventoryBulkScope')?.addEventListener('change', updateBulkCostScopeHelpers);
    document.getElementById('siteInventoryBulkCostAction')?.addEventListener('change', updateBulkCostPlaceholder);
    updateBulkCostScopeHelpers();
    updateBulkCostPlaceholder();
    mountEl.addEventListener('click', onTableClick);
  }

  function readForm() {
    return {
      source_type: document.getElementById('siteInventorySourceType')?.value || 'other',
      external_key: document.getElementById('siteInventoryExternalKey')?.value || '',
      item_name: document.getElementById('siteInventoryItemName')?.value || '',
      category: document.getElementById('siteInventoryCategory')?.value || '',
      image_url: document.getElementById('siteInventoryImageUrl')?.value || '',
      source_url: document.getElementById('siteInventorySourceUrl')?.value || '',
      amazon_url: document.getElementById('siteInventoryAmazonUrl')?.value || '',
      is_active: document.getElementById('siteInventoryIsActive')?.value || '1',
      on_hand_quantity: Number(document.getElementById('siteInventoryOnHand')?.value || 0),
      reserved_quantity: Number(document.getElementById('siteInventoryReservedInput')?.value || 0),
      incoming_quantity: Number(document.getElementById('siteInventoryIncomingInput')?.value || 0),
      reorder_level: Number(document.getElementById('siteInventoryReorder')?.value || 0),
      preferred_reorder_quantity: Number(document.getElementById('siteInventoryPreferredReorderQty')?.value || 0),
      unit_cost_cents: Number(document.getElementById('siteInventoryUnitCost')?.value || 0),
      stock_unit_label: document.getElementById('siteInventoryStockUnitLabel')?.value || 'unit',
      usage_unit_label: document.getElementById('siteInventoryUsageUnitLabel')?.value || 'unit',
      usage_units_per_stock_unit: Math.max(1, Number(document.getElementById('siteInventoryUsageUnitsPerStock')?.value || 1) || 1),
      supplier_name: document.getElementById('siteInventorySupplierName')?.value || '',
      supplier_sku: document.getElementById('siteInventorySupplierSku')?.value || '',
      supplier_contact: document.getElementById('siteInventorySupplierContact')?.value || '',
      reuse_status: document.getElementById('siteInventoryReuseStatus')?.value || '',
      is_on_reorder_list: document.getElementById('siteInventoryOnReorderList')?.checked ? 1 : 0,
      do_not_reorder: document.getElementById('siteInventoryDoNotReorder')?.checked ? 1 : 0,
      do_not_reuse: document.getElementById('siteInventoryDoNotReuse')?.checked ? 1 : 0,
      reorder_notes: document.getElementById('siteInventoryNotes')?.value || '',
      movement_note: document.getElementById('siteInventoryMovementNote')?.value || ''
    };
  }

  function renderMovements(movements) {
    const body = document.getElementById('siteInventoryMovementList');
    if (!body) return;
    if (!Array.isArray(movements) || !movements.length) {
      body.innerHTML = '<tr><td colspan="5" style="padding:8px">No inventory movements recorded yet.</td></tr>';
      return;
    }
    body.innerHTML = movements.map((row) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(row.created_at || '—')}</td><td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(row.item_name || 'Item')}</strong><div class="small">${escapeHtml(row.source_type || '—')} • ${escapeHtml(row.external_key || '—')}</div></td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(row.movement_type || 'adjustment')}<div class="small">Δ ${row.quantity_delta || 0}</div></td><td style="padding:8px;border-bottom:1px solid #ddd">${row.previous_on_hand_quantity || 0} → ${row.new_on_hand_quantity || 0}<div class="small">Res ${row.previous_reserved_quantity || 0} → ${row.new_reserved_quantity || 0} • In ${row.previous_incoming_quantity || 0} → ${row.new_incoming_quantity || 0}</div></td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(row.note || '—')}</td></tr>`).join('');
  }

  async function syncCatalog(sourceTypes) {
    try {
      setMessage(`Syncing ${sourceTypes.join(', ')} catalog items into inventory...`);
      const response = await window.DDAuth.apiFetch('/api/admin/site-item-inventory', {
        method: 'POST',
        body: JSON.stringify({ action: 'sync_catalog', source_types: sourceTypes })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to sync catalog items.');
      setMessage(`Synced ${Number(data.synced || 0)} ${sourceTypes.join('/')} inventory items.`);
      await loadList();
    } catch (err) {
      setMessage(err.message || 'Failed to sync catalog items.', true);
    }
  }

  async function saveItem(event) {
    event.preventDefault();
    try {
      setMessage('Saving inventory item...');
      const response = await window.DDAuth.apiFetch('/api/admin/site-item-inventory', {
        method: 'POST',
        body: JSON.stringify(readForm())
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to save inventory item.');
      setMessage('Inventory item saved.');
      document.getElementById('siteInventoryForm')?.reset();
      const stockUnitEl = document.getElementById('siteInventoryStockUnitLabel'); if (stockUnitEl) stockUnitEl.value = 'unit';
      const usageUnitEl = document.getElementById('siteInventoryUsageUnitLabel'); if (usageUnitEl) usageUnitEl.value = 'unit';
      const usageUnitsEl = document.getElementById('siteInventoryUsageUnitsPerStock'); if (usageUnitsEl) usageUnitsEl.value = '1';
      await loadList();
    } catch (err) {
      setMessage(err.message || 'Failed to save inventory item.', true);
    }
  }

  function populateFormFromItem(item = {}) {
    const mapping = {
      siteInventoryId: item.site_item_inventory_id || '',
      siteInventorySourceType: item.source_type || 'other',
      siteInventoryExternalKey: item.external_key || '',
      siteInventoryItemName: item.item_name || '',
      siteInventoryCategory: item.category || '',
      siteInventoryImageUrl: item.image_url || '',
      siteInventorySourceUrl: item.source_url || '',
      siteInventoryAmazonUrl: item.amazon_url || '',
      siteInventoryOnHand: item.on_hand_quantity || 0,
      siteInventoryReservedInput: item.reserved_quantity || 0,
      siteInventoryIncomingInput: item.incoming_quantity || 0,
      siteInventoryReorder: item.reorder_level || 0,
      siteInventoryPreferredReorderQty: item.preferred_reorder_quantity || 0,
      siteInventoryUnitCost: item.unit_cost_cents || 0,
      siteInventoryStockUnitLabel: item.stock_unit_label || 'unit',
      siteInventoryUsageUnitLabel: item.usage_unit_label || 'unit',
      siteInventoryUsageUnitsPerStock: item.usage_units_per_stock_unit || 1,
      siteInventorySupplierName: item.supplier_name || '',
      siteInventorySupplierSku: item.supplier_sku || '',
      siteInventorySupplierContact: item.supplier_contact || '',
      siteInventoryReuseStatus: item.reuse_status || '',
      siteInventoryNotes: item.reorder_notes || '',
      siteInventoryMovementNote: ''
    };
    Object.entries(mapping).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
    const isActiveEl = document.getElementById('siteInventoryIsActive'); if (isActiveEl) isActiveEl.value = String(Number(item.is_active) === 0 ? 0 : 1);
    const reorderEl = document.getElementById('siteInventoryOnReorderList'); if (reorderEl) reorderEl.checked = Number(item.is_on_reorder_list || 0) === 1;
    const dnrEl = document.getElementById('siteInventoryDoNotReorder'); if (dnrEl) dnrEl.checked = Number(item.do_not_reorder || 0) === 1;
    const dnuEl = document.getElementById('siteInventoryDoNotReuse'); if (dnuEl) dnuEl.checked = Number(item.do_not_reuse || 0) === 1;
  }

  async function loadList() {
    try {
      setMessage('Loading inventory list...');
      const q = document.getElementById('siteInventorySearch')?.value || '';
      const stockView = document.getElementById('siteInventoryStockView')?.value || '';
      const response = await window.DDAuth.apiFetch(`/api/admin/site-item-inventory?q=${encodeURIComponent(q)}&include_history=1&stock_view=${encodeURIComponent(stockView)}`);
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load inventory list.');
      const summary = data.summary || {};
      setValue('siteInventoryTotalItems', summary.total_items || 0);
      setValue('siteInventoryActiveItems', summary.active_items || 0);
      setValue('siteInventoryLowStock', summary.low_stock_items || 0);
      setValue('siteInventoryReserved', summary.total_reserved || 0);
      setValue('siteInventoryIncoming', summary.total_incoming || 0);
      setValue('siteInventoryReorderListCount', summary.reorder_list_items || 0);

      const items = Array.isArray(data.items) ? data.items : [];
      const body = document.getElementById('siteInventoryList');
      if (!body) return;

      if (!items.length) {
        body.innerHTML = '<tr><td colspan="7" style="padding:8px">No site inventory items matched the current view.</td></tr>';
      } else {
        body.innerHTML = items.map((x) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #ddd">
              ${x.image_url ? `<img src="${escapeHtml(x.image_url)}" alt="${escapeHtml(x.item_name)}" style="width:52px;height:52px;object-fit:cover;border-radius:10px;display:block;margin-bottom:8px"/>` : ''}
              ${x.needs_reorder ? '⚠️ ' : ''}<strong>${escapeHtml(x.item_name)}</strong>
              <div class="small">#${x.site_item_inventory_id} · ${escapeHtml(x.source_type)} • ${escapeHtml(x.category || '—')}</div>
            </td>
            <td style="padding:8px;border-bottom:1px solid #ddd">On hand ${x.on_hand_quantity} ${escapeHtml(x.stock_unit_label || 'unit')}<div class="small">Reserved ${x.reserved_quantity} • Incoming ${x.incoming_quantity} • Reorder ${x.reorder_level}</div><div class="small">1 ${escapeHtml(x.stock_unit_label || 'unit')} = ${Number(x.usage_units_per_stock_unit || 1)} ${escapeHtml(x.usage_unit_label || 'unit')}</div><div class="small">Preferred reorder ${x.preferred_reorder_quantity || 0}</div></td>
            <td style="padding:8px;border-bottom:1px solid #ddd"><div class="small">${x.is_on_reorder_list ? 'On reorder list' : 'Not queued'}</div><div class="small">${x.do_not_reorder ? 'Do not reorder' : 'Can reorder'}</div><div class="small">${x.do_not_reuse ? 'Do not reuse' : (x.reuse_status || 'Reusable/normal')}</div></td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(x.supplier_name || '—')}<div class="small">${escapeHtml(x.supplier_sku || '')}</div><div class="small">${escapeHtml(x.supplier_contact || '')}</div></td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${Number(x.linked_product_count || 0)}<div class="small">${escapeHtml(x.linked_product_names || '')}</div></td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${fmtMoney(x.unit_cost_cents || 0)}<div class="small">per ${escapeHtml(x.stock_unit_label || 'unit')}</div><div class="small">≈ ${fmtMoney(Math.round((Number(x.unit_cost_cents || 0)) / Math.max(1, Number(x.usage_units_per_stock_unit || 1))))} per ${escapeHtml(x.usage_unit_label || 'unit')}</div></td>
            <td style="padding:8px;border-bottom:1px solid #ddd"><button class="btn" type="button" data-edit-id="${x.site_item_inventory_id}" data-item='${escapeHtml(JSON.stringify(x))}'>Quick Update</button> <button class="btn" type="button" data-load-form-id="${x.site_item_inventory_id}" data-item='${escapeHtml(JSON.stringify(x))}'>Load Form</button> <button class="btn" type="button" data-adjust-action="reserve" data-id="${x.site_item_inventory_id}">Reserve</button> <button class="btn" type="button" data-adjust-action="release" data-id="${x.site_item_inventory_id}">Release</button> <button class="btn" type="button" data-adjust-action="receive" data-id="${x.site_item_inventory_id}">Receive</button> <button class="btn" type="button" data-adjust-action="consume" data-id="${x.site_item_inventory_id}">Consume</button> <button class="btn" type="button" data-adjust-action="reorder_request" data-id="${x.site_item_inventory_id}">Reorder</button> <button class="btn" type="button" data-delete-id="${x.site_item_inventory_id}">Delete</button></td>
          </tr>
        `).join('');
      }

      renderMovements(data.movements || []);
      setMessage('');
    } catch (err) {
      setMessage(err.message || 'Failed to load inventory list.', true);
    }
  }

  async function onTableClick(event) {
    const editBtn = event.target.closest('[data-edit-id]');
    const deleteBtn = event.target.closest('[data-delete-id]');
    const loadFormBtn = event.target.closest('[data-load-form-id]');


    if (loadFormBtn) {
      let item = null;
      try { item = JSON.parse(loadFormBtn.getAttribute('data-item') || '{}'); } catch { item = null; }
      if (item) {
        populateFormFromItem(item);
        setMessage(`Loaded ${item.item_name || 'inventory item'} into the form.`);
        document.getElementById('siteInventoryForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (editBtn) {
      let item = null;
      try {
        item = JSON.parse(editBtn.getAttribute('data-item') || '{}');
      } catch {
        item = null;
      }
      const id = Number(item?.site_item_inventory_id || editBtn.getAttribute('data-edit-id') || 0);
      if (!id) return;

      const onHandRaw = window.prompt('New on-hand quantity?', String(item?.on_hand_quantity ?? 0));
      if (onHandRaw === null) return;
      const onHand = Number(onHandRaw);
      if (!Number.isFinite(onHand) || onHand < 0) return;
      const unitCostRaw = window.prompt('New unit cost in dollars?', String((Number(item?.unit_cost_cents || 0) / 100).toFixed(2)));
      if (unitCostRaw === null) return;
      const unitCostDollars = Number(unitCostRaw);
      if (!Number.isFinite(unitCostDollars) || unitCostDollars < 0) return;
      const stockLabel = String(window.prompt('Stock unit label?', String(item?.stock_unit_label || 'unit')) || '').trim() || 'unit';
      const usageLabel = String(window.prompt('Usage unit label?', String(item?.usage_unit_label || 'unit')) || '').trim() || 'unit';
      const usageUnitsRaw = window.prompt(`How many ${usageLabel} are in one ${stockLabel}?`, String(Number(item?.usage_units_per_stock_unit || 1)));
      if (usageUnitsRaw === null) return;
      const usageUnitsPerStock = Math.max(1, Number(usageUnitsRaw || 1) || 1);
      const reorderList = window.confirm('Put this item on the reorder list? Click Cancel to leave it off.');
      const doNotReuse = window.confirm('Mark this item as DO NOT REUSE? Click Cancel to leave reusable/normal.');
      const movementNote = String(window.prompt('Movement note?', 'Manual stock / cost correction') || '').trim();

      try {
        setMessage('Updating inventory item...');
        const response = await window.DDAuth.apiFetch('/api/admin/site-item-inventory', {
          method: 'PATCH',
          body: JSON.stringify({
            site_item_inventory_id: id,
            item_name: item?.item_name || '',
            on_hand_quantity: onHand,
            unit_cost_cents: Math.round(unitCostDollars * 100),
            stock_unit_label: stockLabel,
            usage_unit_label: usageLabel,
            usage_units_per_stock_unit: usageUnitsPerStock,
            is_on_reorder_list: reorderList ? 1 : 0,
            do_not_reuse: doNotReuse ? 1 : 0,
            movement_note: movementNote || 'Inventory quantity / cost updated.'
          })
        });
        const data = await response.json();
        if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to update inventory item.');
        await loadList();
      } catch (error) {
        setMessage(error.message || 'Failed to update inventory item.', true);
      }
      return;
    }

    const adjustBtn = event.target.closest('[data-adjust-action]');
    if (adjustBtn) {
      const id = Number(adjustBtn.getAttribute('data-id') || 0);
      const action = String(adjustBtn.getAttribute('data-adjust-action') || '').trim();
      if (!id || !action) return;
      const qtyRaw = window.prompt('Quantity?', '1');
      if (qtyRaw === null) return;
      const qty = Number(qtyRaw);
      if (!Number.isFinite(qty) || qty <= 0) return;
      const defaultNotes = { reserve: 'Manual reservation', release: 'Manual reservation release', receive: 'Received stock', consume: 'Consumed in production', reorder_request: 'Manual reorder request' };
      const note = String(window.prompt('Note?', defaultNotes[action] || `Inventory ${action}`) || '').trim();
      try {
        setMessage(`Running ${action}...`);
        const response = await window.DDAuth.apiFetch('/api/admin/site-item-inventory', {
          method: 'POST',
          body: JSON.stringify({ action, site_item_inventory_id: id, quantity: qty, note })
        });
        const data = await response.json();
        if (!response.ok || !data?.ok) throw new Error(data?.error || `Failed to ${action}.`);
        await loadList();
      } catch (error) {
        setMessage(error.message || `Failed to ${action}.`, true);
      }
      return;
    }

    if (deleteBtn) {
      const id = Number(deleteBtn.getAttribute('data-delete-id') || 0);
      if (!id || !window.confirm('Delete this inventory item?')) return;
      try {
        setMessage('Deleting inventory item...');
        const response = await window.DDAuth.apiFetch(`/api/admin/site-item-inventory?site_item_inventory_id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to delete inventory item.');
        await loadList();
      } catch (error) {
        setMessage(error.message || 'Failed to delete inventory item.', true);
      }
    }
  }

  document.addEventListener('dd:admin-ready', (event) => {
    if (!event?.detail?.ok) return;
    render();
    loadList();
  });

  render();
  if (window.DDAuth?.isLoggedIn()) loadList();
});
