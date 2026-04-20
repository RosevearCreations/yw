document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('mobileProductForm');
  const messageEl = document.getElementById('mobileProductMessage');
  const accessEl = document.getElementById('mobileProductAccessMessage');
  const nextNumberEl = document.getElementById('mobileNextProductNumber');
  const categorySelect = document.getElementById('mobileProductCategory');
  const colorSelect = document.getElementById('mobileColorName');
  const shippingSelect = document.getElementById('mobileShippingCode');
  const taxSelect = document.getElementById('mobileTaxClassId');
  const imageInput = document.getElementById('mobileProductImages');
  const imagePreviewEl = document.getElementById('mobileImagePreview');
  const resourceGrid = document.getElementById('mobileResourceGrid');
  const selectedResourcesEl = document.getElementById('mobileSelectedResources');
  const resourceSearch = document.getElementById('mobileResourceSearch');
  const resourceKindFilter = document.getElementById('mobileResourceKindFilter');
  const inStockOnly = document.getElementById('mobileInStockOnly');
  const resourceSummary = document.getElementById('mobileResourceSummary');
  const refreshButton = document.getElementById('mobileRefreshBootstrapButton');
  const resetButton = document.getElementById('mobileResetForNextButton');
  const draftProductIdInput = document.getElementById('mobileDraftProductId');
  const draftSearchInput = document.getElementById('mobileDraftSearch');
  const draftSelect = document.getElementById('mobileDraftSelect');
  const draftSummary = document.getElementById('mobileDraftSummary');
  const draftReadiness = document.getElementById('mobileDraftReadiness');
  const refreshDraftsButton = document.getElementById('mobileRefreshDraftsButton');

  let bootstrap = null;
  let drafts = [];
  let selectedMap = new Map();
  let loadedDraft = null;

  function setMessage(message, isError = false) {
    if (!messageEl) return;
    messageEl.textContent = message || '';
    messageEl.style.display = message ? 'block' : 'none';
    messageEl.style.color = isError ? '#b00020' : '#0a7a2f';
  }
  function setAccess(message, isError = false) {
    if (!accessEl) return;
    accessEl.textContent = message || '';
    accessEl.style.display = message ? 'block' : 'none';
    accessEl.style.color = isError ? '#b00020' : '#0a7a2f';
  }
  function dollarsToCents(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return 0;
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount < 0) return NaN;
    return Math.round(amount * 100);
  }
  function centsToDollars(value) {
    const cents = Number(value || 0);
    if (!Number.isFinite(cents) || cents <= 0) return '';
    return (cents / 100).toFixed(2);
  }
  function formatMoney(cents) {
    const amount = Number(cents || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CAD' }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function formatProductNumber(value) {
    const parsed = Number(value || 0);
    if (!Number.isInteger(parsed) || parsed <= 0) return 'DD1000';
    return `DD${String(parsed).padStart(4, '0')}`;
  }
  function normalizeText(value) {
    return String(value ?? '').trim();
  }
  function buildLiveDraft(baseDraft = null) {
    const source = baseDraft || loadedDraft || {};
    const savedImages = Number(source.image_count || (Array.isArray(source.images) ? source.images.length : 0) || 0);
    const pendingImages = Number(imageInput?.files?.length || 0);
    const totalImages = Math.max(savedImages, pendingImages);
    return {
      ...source,
      product_number: Number(source.product_number || bootstrap?.next_product_number || 1000),
      status: source.status || 'draft',
      review_status: source.review_status || 'pending_review',
      updated_at: source.updated_at || null,
      name: normalizeText(form?.elements?.name?.value || source.name || ''),
      product_category: normalizeText(form?.elements?.product_category?.value || source.product_category || ''),
      price_cents: Number.isFinite(Number(form?.elements?.price?.value)) && normalizeText(form?.elements?.price?.value) ? dollarsToCents(form?.elements?.price?.value) : Number(source.price_cents || 0),
      short_description: normalizeText(form?.elements?.short_description?.value || source.short_description || ''),
      description: normalizeText(form?.elements?.description?.value || source.description || ''),
      meta_title: normalizeText(form?.elements?.meta_title?.value || source.meta_title || ''),
      meta_description: normalizeText(form?.elements?.meta_description?.value || source.meta_description || ''),
      image_count: totalImages,
      featured_image_url: totalImages > 0 ? (source.featured_image_url || '__local__') : normalizeText(source.featured_image_url || ''),
      linked_resource_count: selectedList().length,
      resource_links: selectedList(),
      images: totalImages > 0 ? (Array.isArray(source.images) ? source.images : [{}]) : []
    };
  }
  function updateRequiredFieldStates(draft = null) {
    const liveDraft = buildLiveDraft(draft);
    const fieldStates = {
      name: normalizeText(liveDraft.name).length > 0,
      product_category: normalizeText(liveDraft.product_category).length > 0,
      price: Number(liveDraft.price_cents || 0) > 0,
      short_description: normalizeText(liveDraft.short_description).length >= 40,
      meta_title: normalizeText(liveDraft.meta_title).length >= 10,
      meta_description: normalizeText(liveDraft.meta_description).length >= 50,
      photos: Number(liveDraft.image_count || 0) > 0 || normalizeText(liveDraft.featured_image_url).length > 0
    };
    document.querySelectorAll('[data-ready-key]').forEach((label) => {
      const key = String(label.getAttribute('data-ready-key') || '');
      const isReady = !!fieldStates[key];
      label.classList.toggle('is-ready', isReady);
      label.classList.toggle('is-missing', !isReady);
      label.setAttribute('data-ready-state', isReady ? 'ready' : 'missing');
    });
    return fieldStates;
  }

  async function parseApiResponse(response, fallbackMessage) {
    const raw = await response.text().catch(() => '');
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {}
    if (!response.ok || !data?.ok) {
      const cleaned = String(raw || '').trim().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const message = data?.error || (cleaned && !/^<!doctype/i.test(cleaned) ? cleaned.slice(0, 220) : '') || fallbackMessage || `Request failed with status ${response.status}.`;
      throw new Error(message);
    }
    return data;
  }

  function getBootstrapFallback() {
    return {
      next_product_number: 1000,
      product_number_start: 1000,
      category_options: ['Rings','Necklaces','Bracelets','Earrings','Pendants','CNC Components','3D Printed Items','Laser Engraved Items','Polymer Clay Items','Home Decor','Accessories','Other'],
      color_options: ['Silver','Gold','Black','White','Red','Blue','Green','Purple','Pink','Orange','Yellow','Brown','Clear','Multicolor'],
      shipping_code_options: ['standard-jewelry','small-parcel','oversize','pickup-only','digital'],
      tax_classes: [],
      resources: []
    };
  }
  function fillSelect(select, options, placeholder) {
    if (!select) return;
    const rows = Array.isArray(options) ? options : [];
    select.innerHTML = `<option value="">${placeholder || 'Select'}</option>` + rows.map((row) => {
      if (typeof row === 'string') return `<option value="${escapeHtml(row)}">${escapeHtml(row)}</option>`;
      const value = row.value ?? row.tax_class_id ?? row.code ?? row.name ?? '';
      const label = row.label ?? (row.name ? `${row.name}${row.code ? ` (${row.code})` : ''}` : value);
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }).join('');
  }

  function describeUsageMeta(row) {
    return {
      stockLabel: String(row?.stock_unit_label || 'unit').trim() || 'unit',
      usageLabel: String(row?.usage_unit_label || 'unit').trim() || 'unit',
      perStock: Math.max(1, Number(row?.usage_units_per_stock_unit || 1) || 1)
    };
  }

  function calcUsagePreview(row) {
    const meta = describeUsageMeta(row);
    const onHandStock = Math.max(0, Number(row?.on_hand_quantity || 0));
    const qtyUsed = Math.max(1, Number(row?.quantity_used || 1) || 1);
    const lotSize = Math.max(1, Number(row?.lot_size_units || 1) || 1);
    const unitCostCents = Math.max(0, Number(row?.unit_cost_cents || 0));
    const mode = String(row?.consumption_mode || 'per_unit').trim() || 'per_unit';
    const totalUsageUnits = onHandStock * meta.perStock;
    const buildable = mode === 'end_of_lot'
      ? Math.floor((totalUsageUnits * lotSize) / qtyUsed)
      : Math.floor(totalUsageUnits / qtyUsed);
    const costPerUseCents = meta.perStock > 0 ? Math.round((unitCostCents * qtyUsed) / meta.perStock) : 0;
    const costPerFinishedCents = mode === 'end_of_lot' ? Math.round(costPerUseCents / lotSize) : costPerUseCents;
    return { meta, onHandStock, totalUsageUnits, buildable, lotSize, costPerFinishedCents, mode };
  }
  function getResources() { return Array.isArray(bootstrap?.resources) ? bootstrap.resources : []; }
  function selectedList() { return Array.from(selectedMap.values()).sort((a, b) => a.sort_order - b.sort_order); }
  function setField(name, value) {
    const field = form?.elements?.[name];
    if (!field) return;
    field.value = value == null ? '' : String(value);
  }

  function renderImages() {
    if (!imagePreviewEl || !imageInput) return;
    const files = Array.from(imageInput.files || []);
    const existing = loadedDraft?.images || [];
    const fileHtml = files.map((file) => {
      const url = URL.createObjectURL(file);
      return `<div class="mobile-image-preview-card"><img src="${url}" alt="${escapeHtml(file.name)}"/><div class="small">${escapeHtml(file.name)}</div></div>`;
    }).join('');
    const existingHtml = files.length ? '' : existing.map((image) => `<div class="mobile-image-preview-card"><img src="${escapeHtml(image.image_url)}" alt="${escapeHtml(image.alt_text || loadedDraft?.name || 'Draft image')}"/><div class="small">Saved draft image</div></div>`).join('');
    imagePreviewEl.innerHTML = fileHtml || existingHtml;
  }

  function renderSelectedResources() {
    if (!selectedResourcesEl) return;
    const rows = selectedList();
    if (!rows.length) {
      selectedResourcesEl.innerHTML = '<div class="small">No tools or supplies selected yet.</div>';
      return;
    }
    selectedResourcesEl.innerHTML = rows.map((row) => `
      <div class="resource-linked-card">
        <div class="resource-linked-summary">
          <div><strong>${escapeHtml(row.name)}</strong> <span class="small">(${escapeHtml(row.resource_kind)})</span></div>
          <div class="small" style="margin:4px 0 0 0">1 ${escapeHtml(describeUsageMeta(row).stockLabel)} = ${Math.max(1, Number(row.usage_units_per_stock_unit || 1) || 1)} ${escapeHtml(row.usage_unit_label || 'unit')}</div>
          <div class="grid cols-2" style="gap:8px;margin:8px 0">
            <label class="small">Quantity used (${escapeHtml(row.usage_unit_label || 'unit')}) <input class="input mobile-inline-input" data-resource-qty="${escapeHtml(row.key)}" type="number" min="1" step="1" value="${Number(row.quantity_used || 1)}"/></label>
            <label class="small">Inventory use
              <select class="input" data-resource-mode="${escapeHtml(row.key)}">
                <option value="per_unit" ${String(row.consumption_mode || 'per_unit') === 'per_unit' ? 'selected' : ''}>Per product</option>
                <option value="end_of_lot" ${String(row.consumption_mode || 'per_unit') === 'end_of_lot' ? 'selected' : ''}>End of lot</option>
                <option value="story_only" ${String(row.consumption_mode || 'per_unit') === 'story_only' ? 'selected' : ''}>Story only</option>
              </select>
            </label>
          </div>
          <label class="small" style="display:${String(row.consumption_mode || 'per_unit') === 'end_of_lot' ? 'block' : 'none'}">Products per lot / container <input class="input mobile-inline-input" data-resource-lot="${escapeHtml(row.key)}" type="number" min="1" step="1" value="${Math.max(1, Number(row.lot_size_units || 1) || 1)}"/></label>
          <div class="small" style="margin:4px 0 6px 0">${String(row.consumption_mode || 'per_unit') === 'end_of_lot' ? 'Good for wax, resin, clay, and other materials where one lot may cover many finished products.' : (String(row.consumption_mode || 'per_unit') === 'story_only' ? 'Story only keeps the item visible in the making record without touching inventory or cost math.' : 'Per product uses the quantity on every finished item and affects cost / buildable-unit math.')}</div>
          <div class="small" style="margin:4px 0 6px 0">${(() => { const preview = calcUsagePreview(row); return `Current stock ≈ ${preview.totalUsageUnits} ${escapeHtml(preview.meta.usageLabel)} across ${preview.onHandStock} ${escapeHtml(preview.meta.stockLabel)} • cost ≈ ${escapeHtml(formatMoney(preview.costPerFinishedCents))} per finished product • buildable ≈ ${escapeHtml(String(Math.max(0, preview.buildable)))}`; })()}</div>
          <label class="small">Usage notes <input class="input" data-resource-notes="${escapeHtml(row.key)}" type="text" maxlength="180" value="${escapeHtml(row.usage_notes || '')}" placeholder="Optional note for story or workflow"/></label>
        </div>
        <div class="resource-linked-actions"><button class="btn" type="button" data-resource-remove="${escapeHtml(row.key)}">Remove</button></div>
      </div>
    `).join('');
    selectedResourcesEl.querySelectorAll('[data-resource-remove]').forEach((button) => button.addEventListener('click', () => {
      selectedMap.delete(button.dataset.resourceRemove);
      renderSelectedResources();
      renderResourceGrid();
      renderDraftReadiness(loadedDraft);
    }));
    selectedResourcesEl.querySelectorAll('[data-resource-qty]').forEach((input) => input.addEventListener('input', () => {
      const row = selectedMap.get(input.dataset.resourceQty);
      if (row) row.quantity_used = Math.max(1, Number(input.value || 1) || 1);
    }));
    selectedResourcesEl.querySelectorAll('[data-resource-mode]').forEach((input) => input.addEventListener('change', () => {
      const row = selectedMap.get(input.dataset.resourceMode);
      if (row) {
        row.consumption_mode = String(input.value || 'per_unit').trim() || 'per_unit';
        if (row.consumption_mode !== 'end_of_lot') row.lot_size_units = 1;
        renderSelectedResources();
      }
    }));
    selectedResourcesEl.querySelectorAll('[data-resource-lot]').forEach((input) => input.addEventListener('input', () => {
      const row = selectedMap.get(input.dataset.resourceLot);
      if (row) row.lot_size_units = Math.max(1, Number(input.value || 1) || 1);
    }));
    selectedResourcesEl.querySelectorAll('[data-resource-notes]').forEach((input) => input.addEventListener('input', () => {
      const row = selectedMap.get(input.dataset.resourceNotes);
      if (row) row.usage_notes = input.value || '';
    }));
  }

  function renderResourceGrid() {
    if (!resourceGrid) return;
    const q = String(resourceSearch?.value || '').trim().toLowerCase();
    const kind = String(resourceKindFilter?.value || 'all').trim().toLowerCase();
    const onlyInStock = !!inStockOnly?.checked;
    const allRows = getResources();
    const rows = allRows
      .filter((row) => kind === 'all' || row.item_kind === kind)
      .filter((row) => !onlyInStock || Number(row.on_hand_quantity || 0) > 0)
      .filter((row) => !q || [row.name, row.category, row.subcategory, row.item_kind].join(' ').toLowerCase().includes(q))
      .sort((a, b) => {
        const qtyDiff = Number(b.on_hand_quantity || 0) - Number(a.on_hand_quantity || 0);
        return qtyDiff || String(a.name || '').localeCompare(String(b.name || ''));
      });
    if (resourceSummary) {
      const inStockCount = allRows.filter((row) => Number(row.on_hand_quantity || 0) > 0).length;
      resourceSummary.textContent = `Showing ${rows.length} of ${allRows.length} resources. ${inStockCount} currently have stock on hand.`;
    }
    resourceGrid.innerHTML = rows.map((row) => {
      const key = `${row.item_kind}:${row.source_key}`;
      const selected = selectedMap.has(key);
      const qty = Number(row.on_hand_quantity || 0);
      const reorderPoint = Number(row.reorder_point || 0);
      const incomingQty = Number(row.incoming_quantity || 0);
      const statusBits = [qty > 0 ? `On hand: ${qty}` : 'Out of stock'];
      statusBits.push(`1 ${row.stock_unit_label || 'unit'} = ${Math.max(1, Number(row.usage_units_per_stock_unit || 1) || 1)} ${row.usage_unit_label || 'unit'}`);
      if (incomingQty > 0) statusBits.push(`Incoming: ${incomingQty}`);
      if (reorderPoint > 0) statusBits.push(`Reorder at ${reorderPoint}`);
      if (Number(row.is_on_reorder_list || 0) === 1) statusBits.push('On reorder list');
      if (Number(row.do_not_reuse || 0) === 1) statusBits.push('Do not reuse');
      return `<button type="button" class="resource-tile${selected ? ' is-linked' : ''}" data-resource-key="${escapeHtml(key)}"><div class="resource-tile-media">${row.image_url ? `<img src="${escapeHtml(row.image_url)}" alt="${escapeHtml(row.name)}"/>` : `<div class="resource-tile-placeholder">${escapeHtml(row.item_kind)}</div>`}</div><div class="resource-tile-body"><div><strong>${escapeHtml(row.name)}</strong></div><div class="small">${escapeHtml(row.item_kind)} · ${escapeHtml(row.category || row.subcategory || '')}</div><div class="small">${escapeHtml(statusBits.join(' • '))}</div></div></button>`;
    }).join('');
    resourceGrid.querySelectorAll('[data-resource-key]').forEach((button) => button.addEventListener('click', () => {
      const [resourceKind, sourceKey] = String(button.dataset.resourceKey || '').split(':');
      const row = getResources().find((entry) => entry.item_kind === resourceKind && entry.source_key === sourceKey);
      if (!row) return;
      const key = `${resourceKind}:${sourceKey}`;
      if (selectedMap.has(key)) selectedMap.delete(key);
      else selectedMap.set(key, { key, resource_kind: resourceKind, source_key: sourceKey, name: row.name, quantity_used: 1, usage_notes: '', consumption_mode: 'per_unit', lot_size_units: 1, stock_unit_label: row.stock_unit_label || 'unit', usage_unit_label: row.usage_unit_label || 'unit', usage_units_per_stock_unit: Math.max(1, Number(row.usage_units_per_stock_unit || 1) || 1), unit_cost_cents: Number(row.unit_cost_cents || 0), on_hand_quantity: Number(row.on_hand_quantity || 0), sort_order: selectedMap.size });
      renderSelectedResources();
      renderResourceGrid();
      renderDraftReadiness(loadedDraft);
    }));
  }

  function draftChecklist(draft) {
    const liveDraft = buildLiveDraft(draft);
    const imageCount = Number(liveDraft.image_count || (liveDraft.images || []).length || 0);
    const checks = [
      { key: 'name', label: 'Name', done: normalizeText(liveDraft.name).length > 0 },
      { key: 'product_category', label: 'Category', done: normalizeText(liveDraft.product_category).length > 0 },
      { key: 'price', label: 'Price', done: Number(liveDraft.price_cents || 0) > 0 },
      { key: 'photos', label: 'First photo', done: imageCount > 0 || normalizeText(liveDraft.featured_image_url).length > 0 },
      { key: 'short_description', label: 'Short description (40+ chars)', done: normalizeText(liveDraft.short_description).length >= 40 },
      { key: 'meta_title', label: 'SEO title (10+ chars)', done: normalizeText(liveDraft.meta_title).length >= 10 },
      { key: 'meta_description', label: 'SEO description (50+ chars)', done: normalizeText(liveDraft.meta_description).length >= 50 },
      { key: 'linked_resources', label: 'Linked resources (optional)', done: selectedList().length > 0, optional: true }
    ];
    return { checks, imageCount, liveDraft };
  }

  function renderDraftReadiness(draft) {
    if (!draftReadiness) return;
    const { checks, imageCount, liveDraft } = draftChecklist(draft);
    updateRequiredFieldStates(liveDraft);
    const requiredChecks = checks.filter((row) => !row.optional);
    const missing = requiredChecks.filter((row) => !row.done);
    const ready = requiredChecks.filter((row) => row.done).length;
    const optional = checks.filter((row) => row.optional);
    draftReadiness.innerHTML = `
      <div class="mobile-draft-status-head">
        <div>
          <strong>${escapeHtml(liveDraft.name || liveDraft.capture_reference || `DD${liveDraft.product_number || liveDraft.product_id || bootstrap?.next_product_number || 1000}`)}</strong>
          <div class="small">${formatProductNumber(liveDraft.product_number || liveDraft.product_id || bootstrap?.next_product_number || 1000)} · ${escapeHtml(liveDraft.status || 'draft')} · ${escapeHtml(liveDraft.review_status || 'pending_review')} · ${imageCount} images · ${selectedList().length} linked resources</div>
        </div>
        <div class="small">Last updated: ${escapeHtml(liveDraft.updated_at || 'Not saved yet')}</div>
      </div>
      <div class="mobile-readiness-chip-row">${requiredChecks.map((row) => `<span class="mobile-readiness-chip${row.done ? ' is-done' : ' is-missing'}">${escapeHtml(row.label)}</span>`).join('')}</div>
      ${optional.length ? `<div class="mobile-readiness-chip-row">${optional.map((row) => `<span class="mobile-readiness-chip is-optional">${escapeHtml(row.label)}</span>`).join('')}</div>` : ''}
      <div class="small" style="margin-top:8px">${missing.length ? `Still missing before approval: ${escapeHtml(missing.map((row) => row.label).join(', '))}.` : 'All approval-required fields are now filled. This draft is ready for approval and storefront go-live checks.'}</div>
      <div class="small">${ready} of ${requiredChecks.length} approval-required checks complete.</div>
    `;
  }

  function resetFormState(message = 'Ready for the next product.') {
    if (form) form.reset();
    if (draftProductIdInput) draftProductIdInput.value = '';
    loadedDraft = null;
    selectedMap = new Map();
    renderImages();
    renderSelectedResources();
    renderResourceGrid();
    renderDraftReadiness(null);
    if (draftSummary) draftSummary.textContent = 'Choose a draft to load it into the form.';
    setMessage(message);
  }

  function applyDraft(draft) {
    if (!draft || !form) return;
    loadedDraft = draft;
    if (draftProductIdInput) draftProductIdInput.value = String(draft.product_id || '');
    if (draftSelect) draftSelect.value = String(draft.product_id || '');
    setField('name', draft.name);
    setField('product_category', draft.product_category);
    setField('color_name', draft.color_name);
    setField('price', centsToDollars(draft.price_cents));
    setField('compare_at_price', centsToDollars(draft.compare_at_price_cents));
    setField('inventory_quantity', draft.inventory_quantity || 1);
    setField('shipping_code', draft.shipping_code);
    setField('tax_class_id', draft.tax_class_id || '');
    setField('weight_grams', draft.weight_grams || '');
    setField('capture_reference', draft.capture_reference);
    setField('sku', draft.sku);
    setField('short_description', draft.short_description);
    setField('description', draft.description);
    setField('meta_title', draft.meta_title || '');
    setField('keywords', draft.keywords || '');
    setField('meta_description', draft.meta_description || '');
    imageInput.value = '';
    selectedMap = new Map((draft.resource_links || []).map((row, index) => {
      const resource = getResources().find((entry) => entry.item_kind === row.resource_kind && entry.source_key === row.source_key);
      const key = `${row.resource_kind}:${row.source_key}`;
      return [key, {
        key,
        resource_kind: row.resource_kind,
        source_key: row.source_key,
        name: resource?.name || row.source_key,
        quantity_used: Number(row.quantity_used || 1),
        stock_unit_label: resource?.stock_unit_label || 'unit',
        usage_unit_label: resource?.usage_unit_label || 'unit',
        usage_units_per_stock_unit: Math.max(1, Number(resource?.usage_units_per_stock_unit || 1) || 1),
        unit_cost_cents: Number(resource?.unit_cost_cents || 0),
        on_hand_quantity: Number(resource?.on_hand_quantity || 0),
        usage_notes: row.usage_notes || '',
        consumption_mode: row.consumption_mode || 'per_unit',
        lot_size_units: Math.max(1, Number(row.lot_size_units || 1) || 1),
        sort_order: index
      }];
    }));
    renderImages();
    renderSelectedResources();
    renderResourceGrid();
    renderDraftReadiness(draft);
    if (draftSummary) draftSummary.textContent = `Editing draft ${formatProductNumber(draft.product_number)} · ${draft.name || draft.capture_reference || 'Unnamed draft'} · ${draft.image_count || 0} images · ${draft.linked_resource_count || 0} linked resources.`;
    setMessage(`Loaded draft ${formatProductNumber(draft.product_number || draft.product_id)}. Continue working without leaving this screen.`);
  }

  function renderDraftOptions(selectedId = null) {
    if (!draftSelect) return;
    const query = String(draftSearchInput?.value || '').trim().toLowerCase();
    let filtered = drafts.filter((row) => !query || [row.name, row.capture_reference, row.slug, row.sku, `dd${row.product_number}`].join(' ').toLowerCase().includes(query));
    const keepId = String(selectedId || loadedDraft?.product_id || '');
    if (keepId && !filtered.some((row) => String(row.product_id) === keepId)) {
      const current = drafts.find((row) => String(row.product_id) === keepId);
      if (current) filtered = [current, ...filtered];
    }
    draftSelect.innerHTML = '<option value="">Start a new draft</option>' + filtered.map((row) => `<option value="${row.product_id}">${formatProductNumber(row.product_number)} · ${escapeHtml(row.name || row.capture_reference || row.slug || 'Draft')} · ${escapeHtml(row.updated_at || '')}</option>`).join('');
    if (keepId && filtered.some((row) => String(row.product_id) === keepId)) draftSelect.value = keepId;
    if (draftSummary && !loadedDraft) draftSummary.textContent = filtered.length ? `${filtered.length} draft products ready to continue in this screen.` : 'No draft products matched that search yet.';
  }

  async function loadDrafts(selectedId = null) {
    if (!window.DDAuth?.isLoggedIn()) return;
    try {
      const response = await window.DDAuth.apiFetch('/api/admin/mobile-product-drafts?status=draft&limit=50');
      const data = await parseApiResponse(response, 'Failed to load draft products.');
      drafts = Array.isArray(data.drafts) ? data.drafts : [];
      renderDraftOptions(selectedId);
      if (selectedId) {
        const selected = drafts.find((row) => String(row.product_id) === String(selectedId));
        if (selected) applyDraft(selected);
      }
    } catch (error) {
      if (draftSummary) draftSummary.textContent = error.message || 'Could not load draft products.';
    }
  }

  async function loadBootstrap(selectedDraftId = null) {
    setMessage('');
    setAccess('');
    try {
      if (!window.DDAuth?.isLoggedIn()) {
        setAccess('Please log in with an admin account first.', true);
        return;
      }
      const response = await window.DDAuth.apiFetch('/api/admin/product-mobile-bootstrap');
      const data = await parseApiResponse(response, 'Failed to load mobile product tools.');
      bootstrap = { ...getBootstrapFallback(), ...(data || {}) };
      nextNumberEl.textContent = String(bootstrap.next_product_number_label || formatProductNumber(bootstrap.next_product_number));
      fillSelect(categorySelect, bootstrap.category_options || [], 'Select a category');
      fillSelect(colorSelect, bootstrap.color_options || [], 'Choose a colour');
      fillSelect(shippingSelect, bootstrap.shipping_code_options || [], 'Select shipping code');
      fillSelect(taxSelect, (bootstrap.tax_classes || []).map((row) => ({ value: row.tax_class_id, label: `${row.name}${row.code ? ` (${row.code})` : ''}` })), 'No tax class');
      renderSelectedResources();
      renderResourceGrid();
      await loadDrafts(selectedDraftId);
    } catch (error) {
      bootstrap = getBootstrapFallback();
      nextNumberEl.textContent = String(bootstrap.next_product_number_label || formatProductNumber(bootstrap.next_product_number));
      fillSelect(categorySelect, bootstrap.category_options || [], 'Select a category');
      fillSelect(colorSelect, bootstrap.color_options || [], 'Choose a colour');
      fillSelect(shippingSelect, bootstrap.shipping_code_options || [], 'Select shipping code');
      fillSelect(taxSelect, [], 'No tax class');
      renderSelectedResources();
      renderResourceGrid();
      setAccess(error.message || 'Could not load admin mobile product tools.', true);
    }
  }

  if (imageInput) imageInput.addEventListener('change', () => { renderImages(); renderDraftReadiness(loadedDraft); });
  if (form) {
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      field.addEventListener('input', () => renderDraftReadiness(loadedDraft));
      field.addEventListener('change', () => renderDraftReadiness(loadedDraft));
    });
  }
  if (resourceSearch) resourceSearch.addEventListener('input', renderResourceGrid);
  if (resourceKindFilter) resourceKindFilter.addEventListener('change', renderResourceGrid);
  if (inStockOnly) inStockOnly.addEventListener('change', renderResourceGrid);
  if (refreshButton) refreshButton.addEventListener('click', () => loadBootstrap(draftProductIdInput?.value || null));
  if (refreshDraftsButton) refreshDraftsButton.addEventListener('click', () => loadDrafts(draftProductIdInput?.value || null));
  if (draftSearchInput) draftSearchInput.addEventListener('input', () => renderDraftOptions(draftProductIdInput?.value || null));
  if (draftSelect) draftSelect.addEventListener('change', () => {
    const draft = drafts.find((row) => String(row.product_id) === String(draftSelect.value || ''));
    if (!draft) return resetFormState('Ready for a new draft.');
    applyDraft(draft);
  });
  if (resetButton) resetButton.addEventListener('click', async () => {
    resetFormState();
    await loadBootstrap();
  });

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage('');
      const priceCents = dollarsToCents(form.elements.price.value);
      const compareAtPriceCents = String(form.elements.compare_at_price.value || '').trim() ? dollarsToCents(form.elements.compare_at_price.value) : '';
      if (Number.isNaN(priceCents)) return setMessage('Price must be a valid amount.', true);
      if (compareAtPriceCents !== '' && Number.isNaN(compareAtPriceCents)) return setMessage('Compare-at price must be a valid amount.', true);
      const formData = new FormData(form);
      formData.set('price_cents', String(priceCents));
      if (compareAtPriceCents !== '') formData.set('compare_at_price_cents', String(compareAtPriceCents));
      formData.set('resource_links_json', JSON.stringify(selectedList().map((row, index) => ({ resource_kind: row.resource_kind, source_key: row.source_key, quantity_used: row.quantity_used || 1, usage_notes: row.usage_notes || '', consumption_mode: row.consumption_mode || 'per_unit', lot_size_units: Math.max(1, Number(row.lot_size_units || 1) || 1), sort_order: index }))));
      const submitButton = form.querySelector('button[type="submit"]');
      const originalText = submitButton?.textContent || 'Save partial draft';
      const existingProductId = draftProductIdInput?.value || '';
      try {
        if (submitButton) { submitButton.disabled = true; submitButton.textContent = existingProductId ? 'Updating…' : 'Saving…'; }
        const response = await window.DDAuth.apiFetch('/api/admin/mobile-create-product', { method: 'POST', body: formData });
        const data = await parseApiResponse(response, 'Failed to save product.');
        const savedProductId = String(data.product?.product_id || existingProductId || '');
        if (existingProductId) {
          setMessage(`Updated draft product ${formatProductNumber(data.product?.product_number)} and kept it open for continued editing.`);
          await loadBootstrap(savedProductId);
        } else {
          setMessage(`Saved draft ${formatProductNumber(data.product?.product_number)}. Fill the green approval fields before approve / publish.`);
          resetFormState('Ready for the next product.');
          if (draftSearchInput) draftSearchInput.value = '';
          await loadBootstrap();
        }
      } catch (error) {
        setMessage(error.message || 'Failed to save product.', true);
      } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalText; }
      }
    });
  }

  loadBootstrap();
  renderDraftReadiness(null);
});
