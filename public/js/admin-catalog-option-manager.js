// File: /public/js/admin-catalog-option-manager.js
// Admin editor for product dropdown master data and tax codes.

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('catalogOptionManagerMount');
  if (!mountEl) return;

  const state = {
    option_sets: { category_options: [], color_options: [], shipping_code_options: [] },
    tax_classes: []
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[ch]));
  }

  function setMessage(message, isError = false) {
    const el = document.getElementById('catalogOptionManagerMessage');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
    el.style.color = isError ? '#b00020' : '#0a7a2f';
  }

  function splitLines(value) {
    return Array.from(new Set(String(value || '')
      .split(/\n|,/g)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  function formatPercent(value) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? (numeric * 100).toFixed(3).replace(/\.0+$|(?<=\.\d*[1-9])0+$/g, '') : '0';
  }

  function taxRateFromPercentInput(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return numeric > 1 ? numeric / 100 : numeric;
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

  function renderTaxClassRows() {
    const rows = Array.isArray(state.tax_classes) ? state.tax_classes : [];
    if (!rows.length) return '<tr><td colspan="5" style="padding:8px">No tax codes saved yet.</td></tr>';
    return rows.map((row) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(row.code || '')}</strong></td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(row.name || '')}<div class="small">${escapeHtml(row.description || '')}</div></td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatPercent(row.tax_rate || 0))}%</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${Number(row.is_active || 0) === 1 ? 'Active' : 'Inactive'}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd"><button class="btn" type="button" data-edit-tax-class="${Number(row.tax_class_id || 0)}">Edit</button> <button class="btn" type="button" data-delete-tax-class="${Number(row.tax_class_id || 0)}">Remove / Disable</button></td>
      </tr>`).join('');
  }

  function render() {
    mountEl.innerHTML = `
      <div class="card" style="margin-top:18px">
        <h3 style="margin-top:0">Dropdowns, Tax Codes & Lookup Values</h3>
        <p class="small" style="margin-top:0">Maintain the values used by product dropdowns here. Categories, colours, and shipping codes save into app settings, while tax codes save into the tax-classes table. Every list can be added to or trimmed back without touching code.</p>
        <div id="catalogOptionManagerMessage" class="small" style="display:none;margin-bottom:12px"></div>
        <div class="grid cols-3" style="gap:12px">
          <div class="card" style="padding:12px">
            <h4 style="margin-top:0">Categories</h4>
            <textarea id="catalogCategoriesTextarea" class="input" rows="10" placeholder="One category per line">${escapeHtml((state.option_sets.category_options || []).join('\n'))}</textarea>
            <div class="small" style="margin-top:6px">Used by phone capture and future product edit forms.</div>
            <div style="margin-top:10px"><button class="btn" type="button" data-save-option-set="categories">Save Categories</button></div>
          </div>
          <div class="card" style="padding:12px">
            <h4 style="margin-top:0">Colours</h4>
            <textarea id="catalogColorsTextarea" class="input" rows="10" placeholder="One colour per line">${escapeHtml((state.option_sets.color_options || []).join('\n'))}</textarea>
            <div class="small" style="margin-top:6px">Keep common finish and colour choices here.</div>
            <div style="margin-top:10px"><button class="btn" type="button" data-save-option-set="colors">Save Colours</button></div>
          </div>
          <div class="card" style="padding:12px">
            <h4 style="margin-top:0">Shipping codes</h4>
            <textarea id="catalogShippingTextarea" class="input" rows="10" placeholder="One shipping code per line">${escapeHtml((state.option_sets.shipping_code_options || []).join('\n'))}</textarea>
            <div class="small" style="margin-top:6px">Examples: standard-jewelry, pickup-only, oversize.</div>
            <div style="margin-top:10px"><button class="btn" type="button" data-save-option-set="shipping_codes">Save Shipping Codes</button></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px;padding:12px">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <div>
              <h4 style="margin:0 0 6px 0">Tax codes</h4>
              <div class="small">Create, update, disable, or remove the tax classes used in product pricing.</div>
            </div>
            <button class="btn" type="button" id="catalogTaxClassNewButton">New Tax Code</button>
          </div>
          <div id="catalogTaxClassFormWrap" style="display:none;margin-top:12px"></div>
          <div class="admin-table-wrap" style="margin-top:12px">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Rate</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody id="catalogTaxClassList">${renderTaxClassRows()}</tbody>
            </table>
          </div>
        </div>
      </div>`;

    mountEl.querySelectorAll('[data-save-option-set]').forEach((button) => {
      button.addEventListener('click', () => saveOptionSet(button.getAttribute('data-save-option-set') || ''));
    });
    document.getElementById('catalogTaxClassNewButton')?.addEventListener('click', () => openTaxClassForm());
    mountEl.querySelectorAll('[data-edit-tax-class]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.getAttribute('data-edit-tax-class') || 0);
        openTaxClassForm(state.tax_classes.find((row) => Number(row.tax_class_id || 0) === id) || null);
      });
    });
    mountEl.querySelectorAll('[data-delete-tax-class]').forEach((button) => {
      button.addEventListener('click', () => deleteTaxClass(Number(button.getAttribute('data-delete-tax-class') || 0)));
    });
  }

  function openTaxClassForm(row = null) {
    const wrap = document.getElementById('catalogTaxClassFormWrap');
    if (!wrap) return;
    wrap.style.display = 'block';
    wrap.innerHTML = `
      <form id="catalogTaxClassForm" class="grid cols-4" style="gap:12px;align-items:end">
        <input type="hidden" id="catalogTaxClassId" value="${escapeHtml(row?.tax_class_id || '')}" />
        <div><label class="small" for="catalogTaxClassCode">Code</label><input id="catalogTaxClassCode" class="input" type="text" value="${escapeHtml(row?.code || '')}" /></div>
        <div><label class="small" for="catalogTaxClassName">Name</label><input id="catalogTaxClassName" class="input" type="text" value="${escapeHtml(row?.name || '')}" /></div>
        <div><label class="small" for="catalogTaxClassRate">Rate %</label><input id="catalogTaxClassRate" class="input" type="number" min="0" step="0.001" value="${escapeHtml(formatPercent(row?.tax_rate || 0))}" /></div>
        <div><label class="small" for="catalogTaxClassActive">Active</label><select id="catalogTaxClassActive" class="input"><option value="1" ${Number(row?.is_active ?? 1) === 1 ? 'selected' : ''}>Yes</option><option value="0" ${Number(row?.is_active ?? 1) === 0 ? 'selected' : ''}>No</option></select></div>
        <div class="cols-4" style="grid-column:1/-1"><label class="small" for="catalogTaxClassDescription">Description</label><input id="catalogTaxClassDescription" class="input" type="text" value="${escapeHtml(row?.description || '')}" /></div>
        <div style="grid-column:1/-1;display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit">Save Tax Code</button><button class="btn" type="button" id="catalogTaxClassCancelButton">Cancel</button></div>
      </form>`;
    document.getElementById('catalogTaxClassCancelButton')?.addEventListener('click', () => {
      wrap.innerHTML = '';
      wrap.style.display = 'none';
    });
    document.getElementById('catalogTaxClassForm')?.addEventListener('submit', saveTaxClass);
  }

  function broadcastUpdate() {
    document.dispatchEvent(new CustomEvent('dd:catalog-options-updated', {
      detail: { option_sets: state.option_sets, tax_classes: state.tax_classes }
    }));
  }

  async function load() {
    if (!window.DDAuth?.isLoggedIn()) return;
    try {
      setMessage('Loading dropdown values...');
      const response = await window.DDAuth.apiFetch('/api/admin/catalog-option-sets');
      const data = await readJsonResponse(response, 'Failed to load dropdown values.');
      state.option_sets = data.option_sets || state.option_sets;
      state.tax_classes = Array.isArray(data.tax_classes) ? data.tax_classes : [];
      render();
      setMessage('');
      broadcastUpdate();
    } catch (error) {
      render();
      setMessage(error.message || 'Failed to load dropdown values.', true);
    }
  }

  async function saveOptionSet(optionSet) {
    const map = { categories: 'catalogCategoriesTextarea', colors: 'catalogColorsTextarea', shipping_codes: 'catalogShippingTextarea' };
    const field = document.getElementById(map[optionSet]);
    if (!field) return;
    try {
      setMessage(`Saving ${optionSet.replace('_', ' ')}...`);
      const response = await window.DDAuth.apiFetch('/api/admin/catalog-option-sets', {
        method: 'POST',
        body: JSON.stringify({ action: 'save_option_set', option_set: optionSet, values: splitLines(field.value) })
      });
      const data = await readJsonResponse(response, 'Failed to save option set.');
      state.option_sets = data.option_sets || state.option_sets;
      render();
      setMessage('Dropdown values saved.');
      broadcastUpdate();
    } catch (error) {
      setMessage(error.message || 'Failed to save option set.', true);
    }
  }

  async function saveTaxClass(event) {
    event.preventDefault();
    try {
      setMessage('Saving tax code...');
      const payload = {
        action: 'save_tax_class',
        tax_class_id: Number(document.getElementById('catalogTaxClassId')?.value || 0),
        code: document.getElementById('catalogTaxClassCode')?.value || '',
        name: document.getElementById('catalogTaxClassName')?.value || '',
        description: document.getElementById('catalogTaxClassDescription')?.value || '',
        tax_rate: taxRateFromPercentInput(document.getElementById('catalogTaxClassRate')?.value || 0),
        is_active: Number(document.getElementById('catalogTaxClassActive')?.value || 1)
      };
      const response = await window.DDAuth.apiFetch('/api/admin/catalog-option-sets', { method: 'POST', body: JSON.stringify(payload) });
      const data = await readJsonResponse(response, 'Failed to save tax code.');
      state.option_sets = data.option_sets || state.option_sets;
      state.tax_classes = Array.isArray(data.tax_classes) ? data.tax_classes : [];
      render();
      setMessage('Tax code saved.');
      broadcastUpdate();
    } catch (error) {
      setMessage(error.message || 'Failed to save tax code.', true);
    }
  }

  async function deleteTaxClass(taxClassId) {
    if (!taxClassId) return;
    if (!window.confirm('Remove this tax code? If products already use it, it will be disabled instead of deleted.')) return;
    try {
      setMessage('Removing tax code...');
      const response = await window.DDAuth.apiFetch('/api/admin/catalog-option-sets', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_tax_class', tax_class_id: taxClassId })
      });
      const data = await readJsonResponse(response, 'Failed to remove tax code.');
      state.option_sets = data.option_sets || state.option_sets;
      state.tax_classes = Array.isArray(data.tax_classes) ? data.tax_classes : [];
      render();
      setMessage('Tax code removed or disabled.');
      broadcastUpdate();
    } catch (error) {
      setMessage(error.message || 'Failed to remove tax code.', true);
    }
  }

  document.addEventListener('dd:admin-ready', async (event) => { if (!event?.detail?.ok) return; await load(); });
  render();
  if (window.DDAuth?.isLoggedIn()) load();
});
