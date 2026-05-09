// File: /public/js/admin-edit-product.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("createProductForm");
  const messageEl = document.getElementById("createProductMessage");
  const submitButton = form ? form.querySelector('button[type="submit"]') : null;
  const productsTableBody = document.getElementById("productsTableBody");
  const existingProductSelect = document.getElementById("existingProductSelect");
  const loadExistingProductButton = document.getElementById("loadExistingProductButton");
  const clearExistingProductButton = document.getElementById("clearExistingProductButton");

  if (!form || !productsTableBody || !window.DDAuth) return;

  ensureMarketplaceFields();
  loadEditorBootstrap().catch(() => {});

  const LOCAL_PENDING_KEY = 'dd_admin_product_update_pending_actions_v1';
  const PRICING_CONSOLE_KEY = 'dd_admin_pricing_console_v2';
  let editingProductId = null;
  let currentSharedPendingActions = [];
  let pendingMount = null;
  let latestPriceSuggestion = null;

  function setMessage(message, isError = false) {
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.style.display = "block";
    messageEl.style.color = isError ? "#b00020" : "#0a7a2f";
  }

  function clearMessage() {
    if (!messageEl) return;
    messageEl.textContent = "";
    messageEl.style.display = "none";
  }

  function loadPricingConsoleState() { try { const raw = JSON.parse(localStorage.getItem(PRICING_CONSOLE_KEY) || '{}'); return raw && typeof raw === 'object' ? raw : {}; } catch { return {}; } }

  function savePricingConsoleState(payload) { try { localStorage.setItem(PRICING_CONSOLE_KEY, JSON.stringify(payload || {})); } catch {} }

  function centsToDollars(value) {
    const cents = Number(value || 0);
    if (!Number.isFinite(cents)) return "";
    return (cents / 100).toFixed(2);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function parseSafeJson(value, fallback = null) { try { return JSON.parse(value); } catch { return fallback; } }
  function loadLocalPendingActions() { const rows = parseSafeJson(localStorage.getItem(LOCAL_PENDING_KEY) || '[]', []); return Array.isArray(rows) ? rows : []; }
  function saveLocalPendingActions(rows) { try { localStorage.setItem(LOCAL_PENDING_KEY, JSON.stringify(Array.isArray(rows) ? rows : [])); } catch {} }
  function upsertLocalPendingAction(action) {
    const key = String(action?.id || action?.client_action_id || '').trim();
    const rows = loadLocalPendingActions().filter((row) => String(row?.id || row?.client_action_id || '') !== key);
    rows.unshift(action);
    saveLocalPendingActions(rows.slice(0, 30));
  }
  function removeLocalPendingAction(actionId) {
    const key = String(actionId || '').trim();
    saveLocalPendingActions(loadLocalPendingActions().filter((row) => String(row?.id || row?.client_action_id || '') !== key));
  }

  function setField(name, value) {
    const field = form.elements.namedItem(name);
    if (!field) return;
    field.value = value == null ? "" : String(value);
  }

  function setSelectOptions(select, items, valueKey = null, labelBuilder = null, placeholder = 'Select an option') {
    if (!select) return;
    const rows = Array.isArray(items) ? items : [];
    const currentValue = String(select.value || '').trim();
    select.innerHTML = `<option value="">${placeholder}</option>` + rows.map((item) => {
      const rawValue = valueKey ? item?.[valueKey] : item;
      const value = String(rawValue == null ? '' : rawValue).trim();
      const label = labelBuilder ? labelBuilder(item) : value;
      return `<option value="${value.replace(/"/g, '&quot;')}">${String(label || value || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</option>`;
    }).join('');
    if (currentValue) select.value = currentValue;
  }

  async function loadEditorBootstrap() {
    try {
      const response = await window.DDAuth.apiFetch('/api/admin/product-mobile-bootstrap', { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load product editor options.');
      setSelectOptions(document.getElementById('create_product_category'), data.category_options || [], null, null, 'Select category');
      setSelectOptions(document.getElementById('create_product_color_name'), data.color_options || [], null, null, 'Select primary colour');
      setSelectOptions(document.getElementById('create_product_shipping_code'), data.shipping_code_options || [], null, null, 'Select shipping code');
      const taxSelect = document.getElementById('create_product_tax_class_id');
      if (taxSelect) {
        const currentValue = String(taxSelect.value || '').trim();
        taxSelect.innerHTML = `<option value="">Select tax class</option>` + (Array.isArray(data.tax_classes) ? data.tax_classes : []).map((taxClass) => {
          const ratePercent = Number(taxClass.tax_rate || 0);
          const friendlyRate = ratePercent > 1 ? ratePercent : Math.round(ratePercent * 100);
          return `<option value="${Number(taxClass.tax_class_id || 0)}">${escapeHtml(taxClass.name || '')} (${escapeHtml(String(friendlyRate))}%)</option>`;
        }).join('');
        if (currentValue) taxSelect.value = currentValue;
      }
      return data;
    } catch (error) {
      setMessage(error.message || 'Failed to load product editor options.', true);
      return null;
    }
  }

  function startExistingProductLoad(productId) {
    const safeProductId = Number(productId || 0);
    if (!safeProductId) {
      setMessage('Choose an existing product first.', true);
      return;
    }
    const rowButton = productsTableBody.querySelector(`[data-edit-product-id="${safeProductId}"]`);
    if (rowButton) {
      rowButton.click();
      return;
    }
    loadProduct(safeProductId).then(async (data) => {
      editingProductId = safeProductId;
      fillForm(data.product || {}, data.images || []);
      try { const suggestion = await fetchPriceSuggestion(safeProductId); latestPriceSuggestion = suggestion.item; } catch {}
      renderPricingInsight();
      setFormModeEdit();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMessage('Product loaded for editing.');
    }).catch((error) => setMessage(error.message || 'Failed to load product.', true));
  }

  function resetProductPicker() {
    if (existingProductSelect) existingProductSelect.value = '';
  }

  function ensureMarketplaceFields() {
    if (!form || form.querySelector('[data-dd-collectibles-fields="1"]') || form.elements.namedItem('merchandise_origin')) return;
    const mount = document.createElement('div');
    mount.className = 'card';
    mount.dataset.ddCollectiblesFields = '1';
    mount.style.marginTop = '16px';
    mount.innerHTML = `
      <h3 style="margin-top:0">Handmade, vintage, and external listing details</h3>
      <div class="small">Use this when the item is a vintage find, collectible, antiquity, oddity, or old tool rather than a handmade Devil n Dove piece.</div>
      <div class="grid cols-3" style="gap:10px;margin-top:12px">
        <label><span class="small">Merchandise origin</span><select name="merchandise_origin"><option value="handmade">Handmade</option><option value="vintage">Vintage</option><option value="collectible">Collectible</option><option value="antique">Antique</option><option value="oddity">Oddity / curiosity</option><option value="prebuilt">Pre-built / found item</option></select></label>
        <label><span class="small">Sale channel</span><select name="sale_channel"><option value="onsite">Sell on Devil n Dove</option><option value="hybrid">Sell here + external listing</option><option value="external_only">External listing only</option></select></label>
        <label><span class="small">External listing label</span><input type="text" name="external_listing_label" maxlength="120" placeholder="Facebook Marketplace" /></label>
      </div>
      <div class="grid cols-2" style="gap:10px;margin-top:12px">
        <label><span class="small">External listing URL</span><input type="url" name="external_listing_url" placeholder="https://www.facebook.com/marketplace/..." /></label>
        <label><span class="small">Era / period</span><input type="text" name="era_label" maxlength="120" placeholder="1960s, Edwardian, mid-century" /></label>
      </div>
      <div class="grid cols-2" style="gap:10px;margin-top:12px">
        <label><span class="small">Condition summary</span><input type="text" name="condition_summary" maxlength="255" placeholder="Patina, wear, tested, cleaned, original box" /></label>
        <label><span class="small">Sourcing notes</span><textarea name="sourcing_notes" rows="3" placeholder="Estate find, antique mall, workshop rescue, oddity shelf note"></textarea></label>
      </div>
      <div class="grid cols-2" style="gap:10px;margin-top:12px">
        <label><span class="small">Primary colour</span><input type="text" name="color_name" maxlength="80" placeholder="Silver" /></label>
        <label><span class="small">Additional colours</span><input type="text" name="color_names_text" maxlength="255" placeholder="Black, turquoise, bronze" /></label>
      </div>`;
    form.appendChild(mount);
  }

  function getImageUrlFields() {
    return [form.elements.namedItem("image_url_1"), form.elements.namedItem("image_url_2"), form.elements.namedItem("image_url_3"), form.elements.namedItem("image_url_4"), form.elements.namedItem("image_url_5")].filter(Boolean);
  }

  function resetImageUrlFields() { getImageUrlFields().forEach(field => { field.value = ""; }); }

  function resetFormState() {
    form.reset();
    if (existingProductSelect) existingProductSelect.value = String(product.product_id || '');
    resetImageUrlFields();
    editingProductId = null;
    latestPriceSuggestion = null;
    form.dataset.mode = "create";
    if (submitButton) { submitButton.textContent = "Create Product"; submitButton.disabled = false; }
    const cancelButton = document.getElementById("cancelProductEdit");
    if (cancelButton) cancelButton.style.display = "none";
    ensurePricingControlsMount();
    renderPricingInsight();
    resetProductPicker();
  }

  function ensureCancelButton() {
    let cancelButton = document.getElementById("cancelProductEdit");
    if (cancelButton) return cancelButton;
    cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.id = "cancelProductEdit";
    cancelButton.className = "btn";
    cancelButton.textContent = "Cancel Edit";
    cancelButton.style.marginLeft = "10px";
    if (submitButton && submitButton.parentNode) submitButton.parentNode.appendChild(cancelButton);
    cancelButton.addEventListener("click", () => { clearMessage(); resetFormState(); });
    return cancelButton;
  }


  function ensurePricingInsightMount() {
    let mount = document.getElementById("productPricingInsightMount");
    if (mount) return mount;
    mount = document.createElement("div");
    mount.id = "productPricingInsightMount";
    mount.className = "card product-pricing-insight-card";
    mount.style.display = "none";
    form.parentNode?.insertBefore(mount, form.nextSibling);
    return mount;
  }


  function ensurePricingControlsMount() {
    let mount = document.getElementById("productPricingControlsMount");
    if (mount) return mount;
    mount = document.createElement("div");
    mount.id = "productPricingControlsMount";
    mount.className = "card";
    mount.style.marginTop = "16px";
    mount.innerHTML = `
      <h3 style="margin-top:0">Pricing operating console</h3>
      <div class="small">Use these assumptions to calculate suggested pricing, planned increases, and landed-cost pressure before saving.</div>
      <div class="grid cols-5" style="gap:10px;margin-top:12px">
        <div><label class="small">Packaging $</label><input id="pricingPackaging" type="number" min="0" step="0.01" value="0.00" /></div>
        <div><label class="small">Shipping pressure $</label><input id="pricingShippingPressure" type="number" min="0" step="0.01" value="0.00" /></div>
        <div><label class="small">Overhead %</label><input id="pricingOverheadPercent" type="number" min="0" step="0.1" value="12" /></div>
        <div><label class="small">Target margin %</label><input id="pricingTargetMargin" type="number" min="5" step="0.1" value="65" /></div>
        <div><label class="small">Markup %</label><input id="pricingMarkupPercent" type="number" min="5" step="0.1" value="120" /></div>
      </div>
      <div class="grid cols-3" style="gap:10px;margin-top:12px">
        <div><label class="small">Transaction fee %</label><input id="pricingTransactionFee" type="number" min="0" step="0.1" value="0" /></div>
        <div><label class="small">Receiving change $</label><input id="pricingReceivingChange" type="number" min="0" step="0.01" value="0.00" /></div>
        <div style="display:flex;align-items:end;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="recalculatePricingButton">Recalculate pricing</button></div>
      </div>`;
    ensurePricingInsightMount().parentNode?.insertBefore(mount, ensurePricingInsightMount());
    const savedConsole = loadPricingConsoleState();
    ['pricingPackaging','pricingShippingPressure','pricingOverheadPercent','pricingTargetMargin','pricingMarkupPercent','pricingTransactionFee','pricingReceivingChange'].forEach((id) => {
      const field = mount.querySelector('#' + id);
      if (!field) return;
      if (savedConsole[id] !== undefined && savedConsole[id] !== null && savedConsole[id] !== '') field.value = String(savedConsole[id]);
      field.addEventListener('input', () => {
        const state = loadPricingConsoleState();
        state[id] = field.value;
        savePricingConsoleState(state);
        if (editingProductId) renderPricingInsight();
      });
    });
    mount.querySelector('#recalculatePricingButton')?.addEventListener('click', async () => {
      if (!editingProductId) return setMessage('Load a product first before recalculating pricing.', true);
      try {
        const data = await fetchPriceSuggestion(editingProductId);
        latestPriceSuggestion = data?.item || null;
        renderPricingInsight();
        setMessage('Pricing guidance recalculated. Review the pricing panel below.');
      } catch (error) {
        setMessage(error.message || 'Failed to recalculate pricing guidance.', true);
      }
    });
    return mount;
  }

  function getPricingControls() {
    ensurePricingControlsMount();
    const num = (id, fallback) => {
      const value = Number(document.getElementById(id)?.value || fallback);
      return Number.isFinite(value) ? value : fallback;
    };
    return {
      packaging_cents: Math.round(num('pricingPackaging', 0) * 100),
      shipping_pressure_cents: Math.round(num('pricingShippingPressure', 0) * 100),
      overhead_percent: num('pricingOverheadPercent', 12),
      target_margin_percent: num('pricingTargetMargin', 65),
      markup_percent: num('pricingMarkupPercent', 120),
      transaction_fee_percent: num('pricingTransactionFee', 0),
      receiving_change_cents: Math.round(num('pricingReceivingChange', 0) * 100)
    };
  }

  async function fetchPriceSuggestion(productId) {
    const controls = getPricingControls();
    const query = new URLSearchParams({
      product_id: String(productId || 0),
      packaging_cents: String(controls.packaging_cents || 0),
      shipping_pressure_cents: String(controls.shipping_pressure_cents || 0),
      overhead_percent: String(controls.overhead_percent || 0),
      target_margin_percent: String(controls.target_margin_percent || 0),
      markup_percent: String(controls.markup_percent || 0),
      transaction_fee_percent: String(controls.transaction_fee_percent || 0)
    });
    const response = await window.DDAuth.apiFetch(`/api/admin/product-price-suggestions?${query.toString()}`, { method: 'GET' });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load price suggestions.');
    const item = Array.isArray(data.items) ? data.items.find((row) => Number(row.product_id || 0) === Number(productId || 0)) : null;
    if (!item) throw new Error('Price suggestion for this product was not returned.');
    const receivingChangeCents = controls.receiving_change_cents || 0;
    item.receiving_change_cents = Number(item.receiving_change_cents || 0) + receivingChangeCents;
    item.landed_cost_cents = Number(item.landed_cost_cents || 0) + receivingChangeCents;
    item.suggested_price_cents = Number(item.suggested_price_cents || 0) + receivingChangeCents;
    item.conservative_price_cents = Number(item.conservative_price_cents || 0) + receivingChangeCents;
    item.stretch_price_cents = Number(item.stretch_price_cents || 0) + receivingChangeCents;
    item.markup_price_cents = Number(item.markup_price_cents || 0) + receivingChangeCents;
    item.suggested_compare_at_cents = Number(item.suggested_compare_at_cents || 0) + receivingChangeCents;
    item.planned_price_increase_cents = Math.max(0, Number(item.suggested_price_cents || 0) - parseDollarField('price'));
    item.planned_price_increase_percent = parseDollarField('price') > 0 ? Number((((Math.max(0, Number(item.suggested_price_cents || 0) - parseDollarField('price'))) / parseDollarField('price')) * 100).toFixed(2)) : 0;
    item.assumptions = { ...(data.assumptions || {}), ...controls };
    return { item };
  }

  function parseDollarField(name) {
    const field = form.elements.namedItem(name);
    if (!field) return 0;
    const raw = String(field.value || "").trim();
    if (!raw) return 0;
    const amount = Number(raw);
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  }

  function renderPricingInsight() {
    const mount = ensurePricingInsightMount();
    if (!latestPriceSuggestion || !editingProductId || Number(latestPriceSuggestion.product_id || 0) !== Number(editingProductId || 0)) {
      mount.style.display = "none";
      mount.innerHTML = "";
      return;
    }

    const currentPrice = parseDollarField("price");
    const compareAt = parseDollarField("compare_at_price");
    const landed = Number(latestPriceSuggestion.landed_cost_cents || 0);
    const suggested = Number(latestPriceSuggestion.suggested_price_cents || 0);
    const conservative = Number(latestPriceSuggestion.conservative_price_cents || 0);
    const stretch = Number(latestPriceSuggestion.stretch_price_cents || 0);
    const suggestedCompareAt = Number(latestPriceSuggestion.suggested_compare_at_cents || 0);
    const markupPrice = Number(latestPriceSuggestion.markup_price_cents || 0);
    const plannedIncrease = Number(latestPriceSuggestion.planned_price_increase_cents || 0);
    const plannedIncreasePercent = Number(latestPriceSuggestion.planned_price_increase_percent || 0);
    const transactionFee = Number(latestPriceSuggestion.transaction_fee_cents || 0);
    const receivingChange = Number(latestPriceSuggestion.receiving_change_cents || 0);
    const packaging = Number(latestPriceSuggestion.packaging_cents || 0);
    const shippingPressure = Number(latestPriceSuggestion.shipping_pressure_cents || 0);
    const marginRatio = currentPrice > 0 ? ((currentPrice - landed) / currentPrice) : 0;
    const targetMarginPercent = Number(latestPriceSuggestion.target_margin_percent || latestPriceSuggestion.assumptions?.target_margin_percent || 0);
    const markupPercent = Number(latestPriceSuggestion.markup_percent || latestPriceSuggestion.assumptions?.markup_percent || 0);
    let tone = "product-pricing-insight-card";
    let headline = "Pricing guidance loaded";
    if (currentPrice <= landed) {
      tone += " danger";
      headline = "Current price is below landed cost";
    } else if ((marginRatio * 100) < targetMarginPercent) {
      tone += " warning";
      headline = "Current price is below the target margin";
    }

    mount.className = tone;
    mount.style.display = "";
    mount.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h3 style="margin:0">${escapeHtml(headline)}</h3>
          <div class="small">Use this to write suggested prices back into the main editor, compare price bands, and spot margin pressure before saving live.</div>
        </div>
        <div class="small">Target margin ${escapeHtml(String(targetMarginPercent || 0))}% • Markup ${escapeHtml(String(markupPercent || 0))}%</div>
      </div>
      <div class="product-pricing-insight-metrics">
        <div class="card"><div class="small">Current price</div><strong>${escapeHtml(centsToDollars(currentPrice))}</strong></div>
        <div class="card"><div class="small">Landed cost</div><strong>${escapeHtml(centsToDollars(landed))}</strong></div>
        <div class="card"><div class="small">Current margin</div><strong>${escapeHtml(((marginRatio || 0) * 100).toFixed(1))}%</strong></div>
        <div class="card"><div class="small">Suggested price</div><strong>${escapeHtml(centsToDollars(suggested))}</strong></div>
        <div class="card"><div class="small">Markup price</div><strong>${escapeHtml(centsToDollars(markupPrice))}</strong></div>
        <div class="card"><div class="small">Planned increase</div><strong>${escapeHtml(centsToDollars(plannedIncrease))}</strong><div class="small">${escapeHtml(plannedIncreasePercent.toFixed(1))}%</div></div>
      </div>
      <div class="small" style="margin-top:10px">Safe range ${escapeHtml(centsToDollars(conservative))} → ${escapeHtml(centsToDollars(stretch))}. Compare-at suggestion ${escapeHtml(centsToDollars(suggestedCompareAt))}. Current compare-at ${escapeHtml(centsToDollars(compareAt))}. Packaging ${escapeHtml(centsToDollars(packaging))} • shipping pressure ${escapeHtml(centsToDollars(shippingPressure))} • receiving change ${escapeHtml(centsToDollars(receivingChange))} • fees ${escapeHtml(centsToDollars(transactionFee))}.</div>
      <div class="small" style="margin-top:6px">Save-time planning: current price ${currentPrice > suggested ? 'is above' : 'is below'} the suggested target by ${escapeHtml(centsToDollars(Math.abs(currentPrice - suggested)))}. Planned increase from the current stored price is ${escapeHtml(plannedIncreasePercent.toFixed(1))}%.</div>
      ${(Array.isArray(latestPriceSuggestion.notes) && latestPriceSuggestion.notes.length) ? `<div class="small" style="margin-top:8px">${latestPriceSuggestion.notes.map((note) => escapeHtml(note)).join(" • ")}</div>` : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" type="button" data-apply-price-preset="conservative">Use conservative</button>
        <button class="btn" type="button" data-apply-price-preset="suggested">Use suggested</button>
        <button class="btn" type="button" data-apply-price-preset="stretch">Use stretch</button>
        <button class="btn" type="button" data-apply-price-preset="compare">Use compare-at</button>
        <button class="btn" type="button" data-apply-price-preset="suggested-save">Use suggested and save</button>
      </div>`;
  }

  function ensurePendingMount() {
    if (pendingMount && pendingMount.isConnected) return pendingMount;
    pendingMount = document.getElementById('productUpdatePendingActionsMount');
    if (pendingMount) return pendingMount;
    pendingMount = document.createElement('div');
    pendingMount.id = 'productUpdatePendingActionsMount';
    pendingMount.className = 'card';
    pendingMount.style.marginTop = '16px';
    form.parentNode?.insertBefore(pendingMount, form.nextSibling);
    return pendingMount;
  }

  function setFormModeEdit() {
    form.dataset.mode = "edit";
    if (submitButton) submitButton.textContent = "Update Product";
    ensureCancelButton().style.display = "";
  }

  function fillForm(product, images) {
    setField("name", product.name || "");
    setField("slug", product.slug || "");
    setField("sku", product.sku || "");
    setField("short_description", product.short_description || "");
    setField("product_category", product.product_category || "");
    setField("shipping_code", product.shipping_code || "");
    setField("review_status", product.review_status || "pending_review");
    setField("description", product.description || "");
    setField("product_type", product.product_type || "physical");
    setField("status", product.status || "draft");
    setField("currency", product.currency || "CAD");
    setField("price", centsToDollars(product.price_cents));
    setField("compare_at_price", product.compare_at_price_cents == null ? "" : centsToDollars(product.compare_at_price_cents));
    setField("taxable", Number(product.taxable) === 0 ? "0" : "1");
    setField("tax_class_id", product.tax_class_id == null ? "" : product.tax_class_id);
    setField("requires_shipping", Number(product.requires_shipping) === 1 ? "1" : "0");
    setField("weight_grams", product.weight_grams == null ? "" : product.weight_grams);
    setField("inventory_tracking", Number(product.inventory_tracking) === 1 ? "1" : "0");
    setField("inventory_quantity", product.inventory_quantity == null ? "0" : product.inventory_quantity);
    setField("digital_file_url", product.digital_file_url || "");
    setField("featured_image_url", product.featured_image_url || "");
    setField("sort_order", product.sort_order == null ? "0" : product.sort_order);
    setField("meta_title", product.meta_title || "");
    setField("meta_description", product.meta_description || "");
    setField("keywords", product.keywords || "");
    setField("h1_override", product.h1_override || "");
    setField("canonical_url", product.canonical_url || "");
    setField("og_title", product.og_title || "");
    setField("og_description", product.og_description || "");
    setField("og_image_url", product.og_image_url || "");
    setField("color_name", product.color_name || "");
    setField("color_names_text", product.color_names_text || "");
    setField("merchandise_origin", product.merchandise_origin || "handmade");
    setField("sale_channel", product.sale_channel || "onsite");
    setField("external_listing_url", product.external_listing_url || "");
    setField("external_listing_label", product.external_listing_label || "");
    setField("condition_summary", product.condition_summary || "");
    setField("era_label", product.era_label || "");
    setField("sourcing_notes", product.sourcing_notes || "");
    if (existingProductSelect) existingProductSelect.value = String(product.product_id || '');
    resetImageUrlFields();
    const imageFields = getImageUrlFields();
    const safeImages = Array.isArray(images) ? images.slice(0, 5) : [];
    for (let i = 0; i < imageFields.length; i += 1) imageFields[i].value = safeImages[i]?.image_url || "";
  }

  async function loadProduct(productId) {
    const response = await window.DDAuth.apiFetch(`/api/admin/product-detail?product_id=${encodeURIComponent(productId)}`, { method: "GET" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Failed to load product.");
    return data;
  }

  async function liveUpdateProduct(payload) {
    const response = await window.DDAuth.apiFetch("/api/admin/update-product", { method: "POST", body: JSON.stringify(payload) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to update product.");
    return data;
  }

  function buildClientActionId(productId) { return ['product-update', Number(productId || 0), Date.now()].join(':'); }

  function normalizeSharedAction(row) {
    if (!row) return null;
    return {
      source: 'shared',
      admin_pending_action_id: Number(row.admin_pending_action_id || 0),
      client_action_id: String(row.client_action_id || '').trim(),
      queue_status: row.queue_status || 'queued',
      label: row.label || row.action_label || 'Pending product update',
      last_error: row.last_error || row.warning || '',
      created_at: row.created_at || null,
      payload: row.payload || {},
      endpoint: row.endpoint || row.endpoint_path || '/api/admin/update-product',
      method: row.method || row.http_method || 'POST'
    };
  }

  function normalizeLocalAction(row) {
    if (!row) return null;
    return {
      source: 'local',
      id: String(row.id || row.client_action_id || '').trim(),
      client_action_id: String(row.client_action_id || row.id || '').trim(),
      queue_status: row.queue_status || 'queued',
      label: row.label || 'Pending product update',
      last_error: row.last_error || '',
      created_at: row.created_at || null,
      payload: row.payload || {},
      endpoint: row.endpoint || '/api/admin/update-product',
      method: row.method || 'POST'
    };
  }

  async function fetchSharedPendingActions() {
    try {
      const response = await window.DDAuth.apiFetch('/api/admin/pending-actions?action_scope=product_update&limit=20', { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load queued product updates.');
      return (Array.isArray(data.actions) ? data.actions : []).map(normalizeSharedAction).filter(Boolean);
    } catch { return []; }
  }

  async function saveSharedPendingAction(action) {
    const response = await window.DDAuth.apiFetch('/api/admin/pending-actions', {
      method: 'POST',
      body: JSON.stringify({
        client_action_id: action.client_action_id,
        action_scope: 'product_update',
        action_label: action.label,
        endpoint_path: action.endpoint,
        http_method: action.method,
        payload: action.payload,
        queue_status: action.queue_status || 'queued',
        last_error: action.last_error || '',
        warning: action.warning || '',
        source_device_label: navigator.userAgent || 'browser'
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to save queued product update.');
    return normalizeSharedAction(data.action);
  }

  async function updateSharedPendingActionStatus(action, queueStatus, lastError = '', incrementAttempt = false) {
    const response = await window.DDAuth.apiFetch('/api/admin/pending-actions-status', {
      method: 'POST',
      body: JSON.stringify({
        admin_pending_action_id: action.admin_pending_action_id || 0,
        client_action_id: action.client_action_id || '',
        queue_status: queueStatus,
        last_error: lastError,
        increment_attempt: incrementAttempt ? 1 : 0
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to update queued product update action.');
    return data.action || null;
  }

  function mergePendingActions(sharedRows) {
    const localRows = loadLocalPendingActions().map(normalizeLocalAction).filter(Boolean);
    const sharedClientIds = new Set(sharedRows.map((row) => String(row.client_action_id || '')).filter(Boolean));
    return [...sharedRows, ...localRows.filter((row) => !sharedClientIds.has(String(row.client_action_id || '')))];
  }

  function renderPendingActions() {
    const mount = ensurePendingMount();
    const mergedRows = mergePendingActions(currentSharedPendingActions);
    mount.innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h3 style="margin:0 0 6px 0">Queued product updates</h3><div class="small">Failed product edits are now saved to the shared replay queue first, with this browser as the last safety net only when the shared queue cannot be reached.</div></div><button class="btn" type="button" id="refreshProductUpdatePendingButton">Refresh queue</button></div><div style="margin-top:12px">${mergedRows.length ? `<div class="table-wrap"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Action</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Status</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Saved</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Replay</th></tr></thead><tbody>${mergedRows.map((row) => `<tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>${escapeHtml(row.label || 'Pending product update')}</strong>${row.last_error ? `<div class="small">${escapeHtml(row.last_error)}</div>` : ''}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.queue_status || 'queued')}<div class="small">${row.source === 'shared' ? 'Shared queue' : 'Browser only'}</div></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(row.created_at || '—')}</td><td style="padding:8px;border-bottom:1px solid #eee"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-replay-product-update="${escapeHtml(String(row.client_action_id || row.id || ''))}">Retry</button><button class="btn" type="button" data-dismiss-product-update="${escapeHtml(String(row.client_action_id || row.id || ''))}">Dismiss</button></div></td></tr>`).join('')}</tbody></table></div>` : `<div class="small">No queued product updates are waiting right now.</div>`}</div>`;
    mount.querySelector('#refreshProductUpdatePendingButton')?.addEventListener('click', loadPendingActions);
  }

  async function loadPendingActions() {
    currentSharedPendingActions = await fetchSharedPendingActions();
    renderPendingActions();
  }

  async function queueProductUpdate(payload, errorMessage) {
    const action = {
      client_action_id: buildClientActionId(payload.product_id),
      queue_status: 'queued',
      label: `Update product: ${payload.name || `#${payload.product_id}`}`,
      payload,
      endpoint: '/api/admin/update-product',
      method: 'POST',
      last_error: errorMessage || 'Failed to update product.',
      created_at: new Date().toISOString()
    };
    try {
      const shared = await saveSharedPendingAction(action);
      currentSharedPendingActions = await fetchSharedPendingActions();
      renderPendingActions();
      return { queued: true, shared: true, action: shared };
    } catch (queueError) {
      upsertLocalPendingAction({ ...action, id: action.client_action_id });
      renderPendingActions();
      return { queued: true, shared: false, queueError: queueError?.message || 'Failed to save shared queue action.' };
    }
  }

  async function replayPendingAction(action) {
    const payload = action?.payload || {};
    if (!payload || !Number(payload.product_id || 0)) throw new Error('Queued product update is missing product_id.');
    if (action.source === 'shared') await updateSharedPendingActionStatus(action, 'retrying', '', true);
    try {
      const result = await liveUpdateProduct(payload);
      if (action.source === 'shared') await updateSharedPendingActionStatus(action, 'completed', '');
      else removeLocalPendingAction(action.id || action.client_action_id);
      currentSharedPendingActions = await fetchSharedPendingActions();
      renderPendingActions();
      document.dispatchEvent(new CustomEvent('dd:product-updated', { detail: { product: result.product || null } }));
      return result;
    } catch (error) {
      if (action.source === 'shared') {
        await updateSharedPendingActionStatus(action, 'failed', error.message || 'Replay failed.', true).catch(() => null);
      } else {
        upsertLocalPendingAction({ ...action, queue_status: 'failed', last_error: error.message || 'Replay failed.' });
      }
      currentSharedPendingActions = await fetchSharedPendingActions();
      renderPendingActions();
      throw error;
    }
  }

  async function dismissPendingAction(action) {
    if (action.source === 'shared') {
      await updateSharedPendingActionStatus(action, 'dismissed', 'Dismissed by admin.').catch(() => null);
      currentSharedPendingActions = await fetchSharedPendingActions();
    } else {
      removeLocalPendingAction(action.id || action.client_action_id);
    }
    renderPendingActions();
  }

  loadExistingProductButton?.addEventListener('click', () => {
    startExistingProductLoad(existingProductSelect?.value || 0);
  });

  existingProductSelect?.addEventListener('change', () => {
    const help = document.getElementById('existingProductHelp');
    if (help) help.textContent = existingProductSelect.value ? 'Ready to load this record into the editor.' : 'Use this picker when the product table is long or you already know which record you want to edit.';
  });

  clearExistingProductButton?.addEventListener('click', () => {
    clearMessage();
    resetFormState();
  });

  productsTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-edit-product-id]");
    if (!button) return;
    const productId = Number(button.getAttribute("data-edit-product-id"));
    if (!productId) return setMessage("Invalid product id.", true);
    const originalText = button.textContent;
    try {
      clearMessage();
      button.disabled = true;
      button.textContent = "Loading...";
      const data = await loadProduct(productId);
      editingProductId = productId;
      fillForm(data.product || {}, data.images || []);
      try { const suggestion = await fetchPriceSuggestion(productId); latestPriceSuggestion = suggestion.item; } catch {}
      renderPricingInsight();
      setFormModeEdit();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      setMessage("Product loaded for editing.");
    } catch (error) {
      setMessage(error.message || "Failed to load product.", true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  form.addEventListener("submit", async (event) => {
    if (form.dataset.mode !== "edit") return;
    event.preventDefault();
    clearMessage();
    if (!editingProductId) return setMessage("No product selected for editing.", true);

    const formData = new FormData(form);
    const parseMoney = (value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return 0;
      const amount = Number(normalized);
      if (!Number.isFinite(amount) || amount < 0) return NaN;
      return Math.round(amount * 100);
    };

    const price_cents = parseMoney(formData.get("price"));
    const compareRaw = String(formData.get("compare_at_price") || "").trim();
    const compare_at_price_cents = compareRaw ? parseMoney(compareRaw) : null;
    if (Number.isNaN(price_cents)) return setMessage("Price must be a valid amount.", true);
    if (compare_at_price_cents !== null && Number.isNaN(compare_at_price_cents)) return setMessage("Compare-at price must be a valid amount.", true);

    const image_urls = [String(formData.get("image_url_1") || "").trim(), String(formData.get("image_url_2") || "").trim(), String(formData.get("image_url_3") || "").trim(), String(formData.get("image_url_4") || "").trim(), String(formData.get("image_url_5") || "").trim()].filter(Boolean);
    const payload = {
      product_id: editingProductId,
      name: String(formData.get("name") || "").trim(),
      slug: String(formData.get("slug") || "").trim(),
      sku: String(formData.get("sku") || "").trim(),
      short_description: String(formData.get("short_description") || "").trim(),
      product_category: String(formData.get("product_category") || "").trim(),
      color_name: String(formData.get("color_name") || "").trim(),
      color_names_text: String(formData.get("color_names_text") || "").trim(),
      shipping_code: String(formData.get("shipping_code") || "").trim(),
      review_status: String(formData.get("review_status") || "pending_review").trim(),
      description: String(formData.get("description") || "").trim(),
      product_type: String(formData.get("product_type") || "physical").trim(),
      status: String(formData.get("status") || "draft").trim(),
      price_cents,
      compare_at_price_cents,
      currency: String(formData.get("currency") || "CAD").trim().toUpperCase(),
      taxable: formData.get("taxable") === "0" ? 0 : 1,
      tax_class_id: String(formData.get("tax_class_id") || "").trim() || null,
      requires_shipping: formData.get("requires_shipping") === "1" ? 1 : 0,
      weight_grams: String(formData.get("weight_grams") || "").trim() || null,
      inventory_tracking: formData.get("inventory_tracking") === "1" ? 1 : 0,
      inventory_quantity: String(formData.get("inventory_quantity") || "").trim() || 0,
      digital_file_url: String(formData.get("digital_file_url") || "").trim(),
      featured_image_url: String(formData.get("featured_image_url") || "").trim(),
      sort_order: String(formData.get("sort_order") || "").trim() || 0,
      meta_title: String(formData.get("meta_title") || "").trim(),
      meta_description: String(formData.get("meta_description") || "").trim(),
      keywords: String(formData.get("keywords") || "").trim(),
      h1_override: String(formData.get("h1_override") || "").trim(),
      canonical_url: String(formData.get("canonical_url") || "").trim(),
      og_title: String(formData.get("og_title") || "").trim(),
      og_description: String(formData.get("og_description") || "").trim(),
      og_image_url: String(formData.get("og_image_url") || "").trim(),
      image_urls
    };

    try {
      const currentSuggestion = editingProductId ? await fetchPriceSuggestion(editingProductId).catch(() => null) : null;
      if (currentSuggestion?.item) {
        latestPriceSuggestion = currentSuggestion.item;
        renderPricingInsight();
        const landed = Number(latestPriceSuggestion.landed_cost_cents || 0);
        const suggested = Number(latestPriceSuggestion.suggested_price_cents || 0);
        const receivingChange = Number(latestPriceSuggestion.receiving_change_cents || 0);
        const plannedIncreasePercent = Number(latestPriceSuggestion.planned_price_increase_percent || 0);
        const warnings = [];
        if (price_cents <= landed) warnings.push('This price is at or below landed cost.');
        if (receivingChange > 0) warnings.push(`Receiving-cost pressure is ${centsToDollars(receivingChange)} higher than the linked resource baseline.`);
        if (suggested > 0 && price_cents < suggested) warnings.push(`This save is below the suggested target by ${centsToDollars(suggested - price_cents)}.`);
        if (plannedIncreasePercent >= 20) warnings.push(`The current planning model suggests a price increase of ${plannedIncreasePercent.toFixed(1)}% from the stored price.`);
        if (warnings.length && !window.confirm(`${warnings.join(' ')} Save anyway?`)) return;
      }
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Updating..."; }
      const data = await liveUpdateProduct(payload);
      setMessage(data.message || "Product updated successfully.");
      resetFormState();
      document.dispatchEvent(new CustomEvent("dd:product-updated", { detail: { product: data.product || null } }));
      await loadPendingActions();
    } catch (error) {
      const queued = await queueProductUpdate(payload, error.message || 'Failed to update product.');
      setMessage(`${error.message || 'Failed to update product.'} The edit was saved to ${queued.shared ? 'the shared replay queue' : 'this browser only'} for later retry.`, true);
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = "Update Product"; }
    }
  });

  ensurePendingMount().addEventListener('click', async (event) => {
    const replayButton = event.target.closest('[data-replay-product-update]');
    if (replayButton) {
      const actionId = String(replayButton.getAttribute('data-replay-product-update') || '');
      const actions = mergePendingActions(currentSharedPendingActions);
      const action = actions.find((row) => String(row.client_action_id || row.id || '') === actionId);
      if (!action) return;
      const original = replayButton.textContent;
      replayButton.disabled = true;
      replayButton.textContent = 'Retrying...';
      try {
        const result = await replayPendingAction(action);
        setMessage(result?.message || 'Queued product update replayed successfully.');
      } catch (error) {
        setMessage(error.message || 'Failed to replay queued product update.', true);
      } finally {
        replayButton.disabled = false;
        replayButton.textContent = original;
      }
      return;
    }
    const dismissButton = event.target.closest('[data-dismiss-product-update]');
    if (dismissButton) {
      const actionId = String(dismissButton.getAttribute('data-dismiss-product-update') || '');
      const actions = mergePendingActions(currentSharedPendingActions);
      const action = actions.find((row) => String(row.client_action_id || row.id || '') === actionId);
      if (!action) return;
      dismissButton.disabled = true;
      try {
        await dismissPendingAction(action);
        setMessage('Queued product update dismissed.');
      } catch (error) {
        setMessage(error.message || 'Failed to dismiss queued product update.', true);
      } finally {
        dismissButton.disabled = false;
      }
    }
  });


  ensurePricingInsightMount().addEventListener("click", (event) => {
    const action = event.target.closest('[data-apply-price-preset]');
    if (!action || !latestPriceSuggestion) return;
    const mode = String(action.getAttribute('data-apply-price-preset') || 'suggested');
    if (mode === 'compare') {
      const compareAt = Number(latestPriceSuggestion.suggested_compare_at_cents || 0);
      if (compareAt > 0) setField('compare_at_price', centsToDollars(compareAt));
      renderPricingInsight();
      setMessage('Suggested compare-at price written into the editor. Save when ready.');
      return;
    }
    const presets = {
      conservative: Number(latestPriceSuggestion.conservative_price_cents || 0),
      suggested: Number(latestPriceSuggestion.suggested_price_cents || 0),
      stretch: Number(latestPriceSuggestion.stretch_price_cents || 0)
    };
    const selected = Number(presets[mode] || 0);
    if (selected > 0) {
      setField('price', centsToDollars(selected));
      renderPricingInsight();
      setMessage(`${mode.charAt(0).toUpperCase() + mode.slice(1)} price written into the editor. Save when ready.`);
    }
  });

  document.addEventListener('dd:product-price-suggestion-load', async (event) => {
    const productId = Number(event?.detail?.product_id || 0);
    if (!productId) return;
    try {
      clearMessage();
      const data = await loadProduct(productId);
      editingProductId = productId;
      fillForm(data.product || {}, data.images || []);
      const safeSuggestedPrice = Number(event?.detail?.suggested_price_cents || event?.detail?.recommended_price_cents || 0);
      const safeSuggestedCompare = Number(event?.detail?.suggested_compare_at_cents || event?.detail?.recommended_compare_at_cents || 0);
      latestPriceSuggestion = { ...(event?.detail || {}), suggested_price_cents: safeSuggestedPrice, suggested_compare_at_cents: safeSuggestedCompare };
      if (Number.isFinite(safeSuggestedPrice) && safeSuggestedPrice > 0) {
        setField('price', centsToDollars(safeSuggestedPrice));
      }
      if (Number.isFinite(safeSuggestedCompare) && safeSuggestedCompare > 0) {
        setField('compare_at_price', centsToDollars(safeSuggestedCompare));
      }
      renderPricingInsight();
      setFormModeEdit();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMessage('Recommended pricing loaded into the product editor. Review the margin warning box and save when ready.');
    } catch (error) {
      setMessage(error.message || 'Failed to load price suggestion into editor.', true);
    }
  });

  form.addEventListener("input", (event) => {
    const fieldName = event?.target?.name || "";
    if (["price", "compare_at_price"].includes(fieldName)) {
      renderPricingInsight();
    }
  });

  document.addEventListener("dd:product-deleted", (event) => {
    const deletedProductId = Number(event?.detail?.product_id || 0);
    if (editingProductId && deletedProductId === editingProductId) {
      clearMessage();
      resetFormState();
      setMessage("The product being edited was deleted.");
    }
  });

  resetFormState();
  loadPendingActions();
});
