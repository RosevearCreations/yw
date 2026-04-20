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

  function dollarsToCents(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return 0;
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount < 0) return NaN;
    return Math.round(amount * 100);
  }

  async function loadTaxClasses() {
    if (!taxClassSelect || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

    const currentValue = String(taxClassSelect.value || "").trim();
    taxClassSelect.innerHTML = `<option value="">Loading tax classes...</option>`;

    try {
      const response = await window.DDAuth.apiFetch("/api/admin/tax-classes", {
        method: "GET"
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load tax classes.");
      }

      const taxClasses = Array.isArray(data.tax_classes) ? data.tax_classes : [];

      taxClassSelect.innerHTML = `
        <option value="">Select tax class</option>
        ${taxClasses.map(taxClass => `
          <option value="${taxClass.tax_class_id}">
            ${taxClass.name} (${Math.round(Number(taxClass.tax_rate || 0) * 100)}%)
          </option>
        `).join("")}
      `;

      if (currentValue) {
        taxClassSelect.value = currentValue;
      }
    } catch (error) {
      taxClassSelect.innerHTML = `<option value="">Unable to load tax classes</option>`;
      setMessage(error.message || "Failed to load tax classes.", true);
    }
  }

  if (!form) {
    loadTaxClasses();
    return;
  }

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
