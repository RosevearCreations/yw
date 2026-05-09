// File: /public/js/admin-create-product.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("createProductForm");
  const messageEl = document.getElementById("createProductMessage");
  const taxClassSelect = document.getElementById("create_product_tax_class_id");

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


  function ensureMarketplaceFields() {
    if (!form || form.querySelector('[data-dd-collectibles-fields="1"]') || form.elements.namedItem('merchandise_origin')) return;
    const mount = document.createElement('div');
    mount.className = 'card';
    mount.dataset.ddCollectiblesFields = '1';
    mount.style.marginTop = '14px';
    mount.innerHTML = `
      <h3 style="margin-top:0">Handmade, vintage, and external listing details</h3>
      <div class="small">Use this for collectibles, antiquities, oddities, old tools, and other pre-built stock that is not workshop-made. Hybrid and external-only listings can point to Facebook Marketplace or another selling location.</div>
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
    if (!window.DDAuth || !window.DDAuth.isLoggedIn()) return;
    try {
      const response = await window.DDAuth.apiFetch('/api/admin/product-mobile-bootstrap', { method: 'GET' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load product editor options.');
      setSelectOptions(document.getElementById('create_product_category'), data.category_options || [], null, null, 'Select category');
      setSelectOptions(document.getElementById('create_product_color_name'), data.color_options || [], null, null, 'Select primary colour');
      setSelectOptions(document.getElementById('create_product_shipping_code'), data.shipping_code_options || [], null, null, 'Select shipping code');
      if (taxClassSelect) {
        const currentValue = String(taxClassSelect.value || '').trim();
        taxClassSelect.innerHTML = `<option value="">Select tax class</option>` + (Array.isArray(data.tax_classes) ? data.tax_classes : []).map((taxClass) => {
          const ratePercent = Number(taxClass.tax_rate || 0);
          const friendlyRate = ratePercent > 1 ? ratePercent : Math.round(ratePercent * 100);
          return `<option value="${Number(taxClass.tax_class_id || 0)}">${String(taxClass.name || '')} (${friendlyRate}%)</option>`;
        }).join('');
        if (currentValue) taxClassSelect.value = currentValue;
      }
      return data;
    } catch (error) {
      setMessage(error.message || 'Failed to load product editor options.', true);
      return null;
    }
  }

  function dollarsToCents(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return 0;
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount < 0) return NaN;
    return Math.round(amount * 100);
  }

  async function loadTaxClasses() {
    await loadEditorBootstrap();
  }

  if (!form) {
    loadTaxClasses();
    return;
  }

  ensureMarketplaceFields();

  if (!form.dataset.mode) {
    form.dataset.mode = "create";
  }

  loadTaxClasses();

  form.addEventListener("submit", async (event) => {
    if (form.dataset.mode === "edit") {
      return;
    }

    event.preventDefault();
    clearMessage();

    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    const price_cents = dollarsToCents(formData.get("price"));
    const compareRaw = String(formData.get("compare_at_price") || "").trim();
    const compare_at_price_cents = compareRaw ? dollarsToCents(compareRaw) : null;

    if (Number.isNaN(price_cents)) {
      setMessage("Price must be a valid amount.", true);
      return;
    }

    if (compare_at_price_cents !== null && Number.isNaN(compare_at_price_cents)) {
      setMessage("Compare-at price must be a valid amount.", true);
      return;
    }

    const imageUrls = [
      String(formData.get("image_url_1") || "").trim(),
      String(formData.get("image_url_2") || "").trim(),
      String(formData.get("image_url_3") || "").trim(),
      String(formData.get("image_url_4") || "").trim(),
      String(formData.get("image_url_5") || "").trim()
    ].filter(Boolean);

    const payload = {
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
      merchandise_origin: String(formData.get("merchandise_origin") || "handmade").trim(),
      sale_channel: String(formData.get("sale_channel") || "onsite").trim(),
      external_listing_url: String(formData.get("external_listing_url") || "").trim(),
      external_listing_label: String(formData.get("external_listing_label") || "").trim(),
      condition_summary: String(formData.get("condition_summary") || "").trim(),
      era_label: String(formData.get("era_label") || "").trim(),
      sourcing_notes: String(formData.get("sourcing_notes") || "").trim(),
      image_urls: imageUrls
    };

    if (!payload.name) {
      setMessage("Product name is required.", true);
      return;
    }

    if (!payload.product_type) {
      setMessage("Product type is required.", true);
      return;
    }

    if (["hybrid", "external_only"].includes(payload.sale_channel) && !payload.external_listing_url) {
      setMessage("Add an external listing URL for hybrid or external-only items.", true);
      return;
    }

    const originalButtonText = submitButton ? submitButton.textContent : "";

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Creating...";
      }

      const response = await window.DDAuth.apiFetch("/api/admin/create-product", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to create product.");
      }

      setMessage("Product created successfully.");
      form.reset();
      form.dataset.mode = "create";
      await loadTaxClasses();

      document.dispatchEvent(new CustomEvent("dd:product-created", {
        detail: {
          product: data.product || null
        }
      }));
    } catch (error) {
      setMessage(error.message || "Failed to create product.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText || "Create Product";
      }
    }
  });
});
