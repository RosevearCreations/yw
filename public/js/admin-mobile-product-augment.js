document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('mobileProductForm');
  const draftSelect = document.getElementById('mobileDraftSelect');
  const refreshDraftsButton = document.getElementById('mobileRefreshDraftsButton');
  const captureModeInput = document.getElementById('mobileCaptureEntryMode');
  const wizardButton = document.getElementById('mobileWizardModeButton');
  const fullButton = document.getElementById('mobileFullModeButton');
  const wizardSummary = document.getElementById('mobileWizardSummary');
  const wizardActions = document.getElementById('mobileWizardActions');
  const prevButton = document.getElementById('mobileWizardPrevButton');
  const nextButton = document.getElementById('mobileWizardNextButton');
  const stepChips = document.getElementById('mobileWizardStepChips');
  const imageInput = document.getElementById('mobileProductImages');
  const todayRefreshButton = document.getElementById('mobileTodayRefreshButton');
  const todaySummary = document.getElementById('mobileTodaySummary');
  const todayMessage = document.getElementById('mobileTodayMessage');
  const todayBody = document.getElementById('mobileTodayTableBody');
  const selectAll = document.getElementById('mobileTodaySelectAll');
  const bulkCategory = document.getElementById('mobileTodayBulkCategory');
  const bulkPrice = document.getElementById('mobileTodayBulkPrice');
  const bulkQty = document.getElementById('mobileTodayBulkQty');
  const bulkStatus = document.getElementById('mobileTodayBulkStatus');
  const bulkApplyButton = document.getElementById('mobileTodayBulkApplyButton');
  const photoHelp = document.getElementById('mobilePhotoHelp');
  if (!form || !window.DDAuth) return;

  let captureMode = captureModeInput?.value === 'full' ? 'full' : 'wizard';
  let wizardStep = 1;
  let todayDrafts = [];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function formatMoney(cents, currency = 'CAD') {
    const amount = Number(cents || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'CAD' }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  }

  function dollarsToCents(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const number = Number(text);
    if (!Number.isFinite(number) || number < 0) return null;
    return Math.round(number * 100);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function setTodayMessage(message = '', isError = false) {
    if (!todayMessage) return;
    todayMessage.textContent = message;
    todayMessage.style.display = message ? 'block' : 'none';
    todayMessage.style.color = isError ? '#b00020' : '#0a7a2f';
  }

  function parseApiResponse(response, fallback) {
    return response.text().then((raw) => {
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (!response.ok || !data?.ok) throw new Error(data?.error || fallback || 'Request failed.');
      return data;
    });
  }

  function fieldLabel(name) {
    const field = form.elements?.[name];
    return field ? field.closest('label') : null;
  }

  function basicGroups() {
    return {
      step1: [fieldLabel('name'), fieldLabel('short_description'), fieldLabel('capture_reference')],
      step2: [fieldLabel('price'), fieldLabel('inventory_quantity')],
      step3: [fieldLabel('images'), document.getElementById('mobileImagePreview')]
    };
  }

  function advancedBlocks() {
    return [
      fieldLabel('product_category'),
      fieldLabel('color_name'),
      fieldLabel('compare_at_price'),
      fieldLabel('shipping_code'),
      fieldLabel('tax_class_id'),
      fieldLabel('weight_grams'),
      fieldLabel('sku'),
      fieldLabel('description'),
      fieldLabel('meta_title'),
      fieldLabel('keywords'),
      fieldLabel('meta_description'),
      document.querySelector('.mobile-required-note'),
      document.querySelector('.resource-picker-head'),
      document.getElementById('mobileResourceSummary'),
      document.getElementById('mobileSelectedResources'),
      document.getElementById('mobileResourceGrid')
    ].filter(Boolean);
  }

  function setMode(mode) {
    captureMode = mode === 'full' ? 'full' : 'wizard';
    if (captureModeInput) captureModeInput.value = captureMode;
    if (wizardButton) wizardButton.classList.toggle('primary', captureMode === 'wizard');
    if (fullButton) fullButton.classList.toggle('primary', captureMode === 'full');
    if (wizardActions) wizardActions.style.display = captureMode === 'wizard' ? 'flex' : 'none';
    if (wizardSummary) {
      wizardSummary.textContent = captureMode === 'wizard'
        ? 'Basic wizard keeps the phone entry to name, short description, price, quantity, and 1 to 5 pictures before saving a draft.'
        : 'Full form shows category, SEO, resources, shipping, tax, and deeper listing details.';
    }
    if (photoHelp) {
      photoHelp.textContent = captureMode === 'wizard'
        ? 'Basic wizard expects 1 to 5 pictures. The first picture becomes the featured image.'
        : 'Upload phone photos directly. The first image becomes the featured image.';
    }
    renderWizardStep();
  }

  function renderWizardStep() {
    const groups = basicGroups();
    const advanced = advancedBlocks();
    const chipLabels = ['1. Name + short description', '2. Price + quantity', '3. 1 to 5 pictures'];
    if (stepChips) {
      stepChips.innerHTML = chipLabels.map((label, index) => {
        const step = index + 1;
        const state = captureMode === 'full' ? ' is-optional' : (step < wizardStep ? ' is-done' : step === wizardStep ? ' is-missing' : '');
        return `<span class="mobile-readiness-chip${state}">${escapeHtml(label)}</span>`;
      }).join('');
    }
    if (captureMode === 'full') {
      Object.values(groups).flat().forEach((el) => { if (el) el.style.display = ''; });
      advanced.forEach((el) => { el.style.display = ''; });
      if (nextButton) nextButton.textContent = 'Next step';
      if (prevButton) prevButton.disabled = true;
      return;
    }
    advanced.forEach((el) => { el.style.display = 'none'; });
    Object.entries(groups).forEach(([key, list]) => {
      const visible = key === `step${wizardStep}`;
      list.forEach((el) => { if (el) el.style.display = visible ? '' : 'none'; });
    });
    if (prevButton) prevButton.disabled = wizardStep === 1;
    if (nextButton) nextButton.textContent = wizardStep === 3 ? 'Stay on pictures' : 'Next step';
  }

  function validateWizardBeforeSubmit() {
    const name = String(form.elements?.name?.value || '').trim();
    const shortDescription = String(form.elements?.short_description?.value || '').trim();
    const price = String(form.elements?.price?.value || '').trim();
    const qty = Number(form.elements?.inventory_quantity?.value || 0);
    const newImages = Number(imageInput?.files?.length || 0);
    const existingImages = Number(document.querySelectorAll('#mobileImagePreview .mobile-image-preview-card').length || 0);
    const totalImages = Math.max(newImages, existingImages);
    if (!name) return 'Basic wizard still needs a product name.';
    if (!shortDescription) return 'Basic wizard still needs a short description.';
    if (!price || Number(price) < 0) return 'Basic wizard still needs a valid price.';
    if (!Number.isInteger(qty) || qty < 0) return 'Basic wizard still needs a valid quantity.';
    if (totalImages < 1 || totalImages > 5) return 'Basic wizard requires between 1 and 5 pictures.';
    return '';
  }

  function editDraft(productId) {
    if (!draftSelect) return;
    draftSelect.value = String(productId || '');
    draftSelect.dispatchEvent(new Event('change', { bubbles: true }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function applyBulkUpdate(productIds, updates) {
    const body = { selection_scope: 'ids', product_ids: productIds, updates };
    const response = await window.DDAuth.apiFetch('/api/admin/bulk-update-products', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return parseApiResponse(response, 'Bulk product update failed.');
  }

  function selectedTodayIds() {
    return Array.from(document.querySelectorAll('[data-today-select]:checked')).map((input) => Number(input.value)).filter((id) => Number.isInteger(id) && id > 0);
  }

  function rowPayloadFromInputs(rowId) {
    const row = todayDrafts.find((entry) => Number(entry.product_id) === Number(rowId));
    if (!row) return null;
    const category = document.querySelector(`[data-row-category="${rowId}"]`)?.value ?? row.product_category ?? '';
    const priceText = document.querySelector(`[data-row-price="${rowId}"]`)?.value ?? '';
    const qtyText = document.querySelector(`[data-row-qty="${rowId}"]`)?.value ?? '';
    const status = document.querySelector(`[data-row-status="${rowId}"]`)?.value ?? row.status ?? 'draft';
    const updates = { status, inventory_quantity: Number(qtyText || 0), product_category: String(category || '').trim() };
    const priceCents = dollarsToCents(priceText);
    if (priceText !== '' && priceCents != null) {
      updates.price_action = 'set_price_cents';
      updates.price_value = priceCents;
      updates.compare_at_strategy = 'no_change';
    }
    return updates;
  }

  function renderTodayTable() {
    if (!todayBody) return;
    if (!todayDrafts.length) {
      todayBody.innerHTML = '<tr><td colspan="9" style="padding:12px">No draft products were saved today yet.</td></tr>';
      return;
    }
    todayBody.innerHTML = todayDrafts.map((row) => `
      <tr>
        <td><input type="checkbox" data-today-select value="${Number(row.product_id || 0)}"/></td>
        <td>
          <div><strong>${escapeHtml(`DD${String(Number(row.product_number || row.product_id || 0)).padStart(4, '0')}`)}</strong></div>
          <div class="small">${escapeHtml(row.name || row.capture_reference || 'Unnamed draft')}</div>
        </td>
        <td><input class="input" data-row-category="${Number(row.product_id || 0)}" type="text" value="${escapeHtml(row.product_category || '')}" placeholder="Category"/></td>
        <td><input class="input" data-row-price="${Number(row.product_id || 0)}" type="number" min="0" step="0.01" value="${escapeHtml((Number(row.price_cents || 0) / 100).toFixed(2))}"/></td>
        <td><input class="input" data-row-qty="${Number(row.product_id || 0)}" type="number" min="0" step="1" value="${Number(row.inventory_quantity || 0)}"/></td>
        <td>
          <select class="input" data-row-status="${Number(row.product_id || 0)}">
            <option value="draft" ${String(row.status || 'draft') === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="active" ${String(row.status || '') === 'active' ? 'selected' : ''}>Active</option>
            <option value="archived" ${String(row.status || '') === 'archived' ? 'selected' : ''}>Archived</option>
          </select>
        </td>
        <td>${Number(row.image_count || 0)}<div class="small">${escapeHtml(row.capture_entry_mode || 'full')}</div></td>
        <td>${escapeHtml(formatDate(row.capture_last_saved_at || row.updated_at || row.created_at))}</td>
        <td>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn" data-edit-row="${Number(row.product_id || 0)}">Edit</button>
            <button type="button" class="btn" data-save-row="${Number(row.product_id || 0)}">Save row</button>
          </div>
        </td>
      </tr>
    `).join('');

    todayBody.querySelectorAll('[data-edit-row]').forEach((button) => button.addEventListener('click', () => editDraft(button.dataset.editRow)));
    todayBody.querySelectorAll('[data-save-row]').forEach((button) => button.addEventListener('click', async () => {
      const rowId = Number(button.dataset.saveRow || 0);
      const updates = rowPayloadFromInputs(rowId);
      if (!updates) return;
      const original = button.textContent;
      setTodayMessage('');
      button.disabled = true;
      button.textContent = 'Saving…';
      try {
        await applyBulkUpdate([rowId], updates);
        setTodayMessage('Draft row updated.');
        if (refreshDraftsButton) refreshDraftsButton.click();
        await loadTodayDrafts();
      } catch (error) {
        setTodayMessage(error.message || 'Could not update the draft row.', true);
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    }));
  }

  async function loadTodayDrafts() {
    if (!window.DDAuth.isLoggedIn()) return;
    try {
      setTodayMessage('');
      const response = await window.DDAuth.apiFetch('/api/admin/mobile-product-drafts?status=draft&scope=today&limit=100');
      const data = await parseApiResponse(response, 'Could not load today\'s draft products.');
      todayDrafts = Array.isArray(data.drafts) ? data.drafts : [];
      const summary = data.day_summary || {};
      if (todaySummary) {
        todaySummary.textContent = todayDrafts.length
          ? `${summary.draft_count || todayDrafts.length} draft entries today • ${summary.image_count || 0} pictures • ${summary.inventory_quantity_total || 0} total quantity • ${summary.wizard_count || 0} saved from the basic wizard.`
          : 'No draft products were saved today yet.';
      }
      renderTodayTable();
    } catch (error) {
      if (todaySummary) todaySummary.textContent = error.message || 'Could not load today\'s draft products.';
      if (todayBody) todayBody.innerHTML = '<tr><td colspan="9" style="padding:12px">Could not load today\'s draft products.</td></tr>';
    }
  }

  if (wizardButton) wizardButton.addEventListener('click', () => { wizardStep = 1; setMode('wizard'); });
  if (fullButton) fullButton.addEventListener('click', () => setMode('full'));
  if (prevButton) prevButton.addEventListener('click', () => { wizardStep = Math.max(1, wizardStep - 1); renderWizardStep(); });
  if (nextButton) nextButton.addEventListener('click', () => { wizardStep = Math.min(3, wizardStep + 1); renderWizardStep(); });
  if (todayRefreshButton) todayRefreshButton.addEventListener('click', loadTodayDrafts);
  if (selectAll) selectAll.addEventListener('change', () => {
    document.querySelectorAll('[data-today-select]').forEach((input) => { input.checked = !!selectAll.checked; });
  });

  if (bulkApplyButton) bulkApplyButton.addEventListener('click', async () => {
    const ids = selectedTodayIds();
    if (!ids.length) return setTodayMessage('Select at least one draft row first.', true);
    const updates = {};
    if (String(bulkStatus?.value || '').trim()) updates.status = String(bulkStatus.value).trim();
    if (String(bulkCategory?.value || '').trim() || bulkCategory?.value === '') updates.product_category = String(bulkCategory.value || '').trim();
    if (String(bulkQty?.value || '').trim()) updates.inventory_quantity = Number(bulkQty.value || 0);
    const priceCents = dollarsToCents(bulkPrice?.value || '');
    if (String(bulkPrice?.value || '').trim()) {
      if (priceCents == null) return setTodayMessage('Bulk price must be a valid amount.', true);
      updates.price_action = 'set_price_cents';
      updates.price_value = priceCents;
      updates.compare_at_strategy = 'no_change';
    }
    if (!Object.keys(updates).length) return setTodayMessage('Choose at least one bulk field to update.', true);
    bulkApplyButton.disabled = true;
    const original = bulkApplyButton.textContent;
    bulkApplyButton.textContent = 'Applying…';
    try {
      await applyBulkUpdate(ids, updates);
      setTodayMessage(`Updated ${ids.length} draft row${ids.length === 1 ? '' : 's'}.`);
      if (refreshDraftsButton) refreshDraftsButton.click();
      await loadTodayDrafts();
    } catch (error) {
      setTodayMessage(error.message || 'Bulk update failed.', true);
    } finally {
      bulkApplyButton.disabled = false;
      bulkApplyButton.textContent = original;
    }
  });

  if (imageInput) imageInput.addEventListener('change', () => {
    if (captureMode !== 'wizard') return;
    const count = Number(imageInput.files?.length || 0);
    if (count > 5) setTodayMessage('Basic wizard should use 1 to 5 pictures. Extra files will stay selected until you remove them manually.', true);
    else setTodayMessage('');
  });

  form.addEventListener('submit', (event) => {
    if (captureModeInput) captureModeInput.value = captureMode;
    if (captureMode !== 'wizard') return;
    const error = validateWizardBeforeSubmit();
    if (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setTodayMessage(error, true);
      return;
    }
    setTodayMessage('');
  }, true);

  document.addEventListener('dd:mobile-product-saved', loadTodayDrafts);
  document.addEventListener('dd:auth-changed', () => loadTodayDrafts());

  setMode(captureMode);
  loadTodayDrafts();
});
