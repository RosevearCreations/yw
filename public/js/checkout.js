// File: /public/js/checkout.js
// Brief description: Handles the checkout page flow. It loads cart items from browser storage,
// calculates totals, validates customer and shipping fields, creates the order through
// /api/checkout-create-order, prepares payment through /api/checkout-prepare-payment,
// captures checkout-recovery leads, supports gift-card discounts, and stores a
// confirmation snapshot so guest checkout can render the confirmation page cleanly.

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("checkoutForm");
  const messageEl = document.getElementById("checkoutMessage");
  const submitButton = document.getElementById("checkoutSubmitButton");
  const summaryItemsEl = document.getElementById("checkoutSummaryItems");
  const summarySubtotalEl = document.getElementById("checkoutSummarySubtotal");
  const summaryShippingEl = document.getElementById("checkoutSummaryShipping");
  const summaryDiscountEl = document.getElementById("checkoutSummaryDiscount");
  const summaryTaxEl = document.getElementById("checkoutSummaryTax");
  const summaryTotalEl = document.getElementById("checkoutSummaryTotal");
  const paymentProviderStatusEl = document.getElementById("paymentProviderStatus");
  const giftCardInputEl = document.getElementById("gift_card_code");
  const giftCardButtonEl = document.getElementById("applyGiftCardButton");
  const giftCardMessageEl = document.getElementById("giftCardMessage");

  const CART_KEY = "dd_cart";
  const CHECKOUT_FORM_KEY = "dd_checkout_form";
  const CONFIRMATION_KEY = "dd_last_order_confirmation";

  let appliedGiftCard = null;

  function getGiftCardPurchase() {
    return window.DDGiftCardPurchase?.read ? (window.DDGiftCardPurchase.read() || null) : null;
  }

  function clearGiftCardPurchase() {
    try { window.DDGiftCardPurchase?.clear?.(); } catch {}
  }

  function setMessage(message, isError = false) {
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.style.display = message ? "block" : "none";
    messageEl.style.color = isError ? "#b00020" : "";
  }

  function setGiftCardMessage(message, isError = false) {
    if (!giftCardMessageEl) return;
    giftCardMessageEl.textContent = message;
    giftCardMessageEl.style.display = message ? "block" : "none";
    giftCardMessageEl.style.color = isError ? "#b00020" : "#0a7a2f";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMoney(cents, currency = "CAD") {
    const amount = Number(cents || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "CAD"
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency || "CAD"}`;
    }
  }

  function getCartItems() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCheckoutForm(data) {
    try {
      localStorage.setItem(CHECKOUT_FORM_KEY, JSON.stringify(data || {}));
    } catch {}
  }

  function loadCheckoutForm() {
    try {
      const raw = localStorage.getItem(CHECKOUT_FORM_KEY);
      const parsed = JSON.parse(raw || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveConfirmationSnapshot(data) {
    try {
      sessionStorage.setItem(CONFIRMATION_KEY, JSON.stringify(data || {}));
    } catch {
      try {
        localStorage.setItem(CONFIRMATION_KEY, JSON.stringify(data || {}));
      } catch {}
    }
  }

  function fillFormFromSavedData() {
    const saved = loadCheckoutForm();
    const fieldIds = [
      "customer_name",
      "customer_email",
      "shipping_name",
      "shipping_company",
      "shipping_address1",
      "shipping_address2",
      "shipping_city",
      "shipping_province",
      "shipping_postal_code",
      "shipping_country",
      "billing_name",
      "billing_company",
      "billing_address1",
      "billing_address2",
      "billing_city",
      "billing_province",
      "billing_postal_code",
      "billing_country",
      "notes",
      "payment_method",
      "gift_card_code"
    ];

    fieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (saved[id] !== undefined && saved[id] !== null && saved[id] !== "") {
        el.value = saved[id];
      }
    });
  }

  function readFormData() {
    const ids = [
      "customer_name",
      "customer_email",
      "shipping_name",
      "shipping_company",
      "shipping_address1",
      "shipping_address2",
      "shipping_city",
      "shipping_province",
      "shipping_postal_code",
      "shipping_country",
      "billing_name",
      "billing_company",
      "billing_address1",
      "billing_address2",
      "billing_city",
      "billing_province",
      "billing_postal_code",
      "billing_country",
      "notes",
      "payment_method",
      "gift_card_code"
    ];

    const data = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      data[id] = String(el?.value || "").trim();
    });

    return data;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function calculateCartSummary(cartItems) {
    const safeItems = Array.isArray(cartItems) ? cartItems : [];
    const giftCardPurchase = getGiftCardPurchase();
    const giftCardPurchaseCents = Number(giftCardPurchase?.amount_cents || 0);
    const subtotal_cents = safeItems.reduce((sum, item) => sum + (Number(item.price_cents || 0) * Number(item.quantity || 0)), 0) + giftCardPurchaseCents;
    const requiresShipping = safeItems.some((item) => Number(item.requires_shipping || 0) === 1);
    const shipping_cents = requiresShipping ? 1500 : 0;
    const gift_card_discount_cents = Math.min(Number(appliedGiftCard?.applicable_discount_cents || 0), subtotal_cents + shipping_cents);
    const tax_cents = Math.round(Math.max(0, subtotal_cents + shipping_cents - gift_card_discount_cents) * 0.13);
    const total_cents = Math.max(0, subtotal_cents + shipping_cents + tax_cents - gift_card_discount_cents);

    return {
      subtotal_cents,
      shipping_cents,
      gift_card_discount_cents,
      tax_cents,
      total_cents,
      requires_shipping: requiresShipping
    };
  }

  function validateRequiredShippingFields(formData, summary) {
    if (!summary?.requires_shipping) return "";
    if (!formData.shipping_address1) return "Shipping address line 1 is required for physical orders.";
    if (!formData.shipping_city) return "Shipping city is required for physical orders.";
    if (!formData.shipping_province) return "Shipping province or state is required for physical orders.";
    if (!formData.shipping_postal_code) return "Shipping postal or ZIP code is required for physical orders.";
    if (!formData.shipping_country) return "Shipping country is required for physical orders.";
    return "";
  }

  function renderSummary() {
    const cartItems = getCartItems();
    const giftCardPurchase = getGiftCardPurchase();
    const summary = calculateCartSummary(cartItems);

    if (summaryItemsEl) {
      const rows = [];
      if (cartItems.length) {
        rows.push(...cartItems.map((item) => {
          const qty = Number(item.quantity || 0);
          const unit = Number(item.price_cents || 0);
          const line = qty * unit;
          return `
            <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px">
              <div>
                <div>${escapeHtml(item.name || "Item")}</div>
                <div class="small">Qty: ${escapeHtml(String(qty))}</div>
              </div>
              <div>${escapeHtml(formatMoney(line, item.currency || "CAD"))}</div>
            </div>`;
        }));
      }
      if (giftCardPurchase?.amount_cents) {
        rows.push(`
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px">
            <div>
              <div>Storefront gift card</div>
              <div class="small">For ${escapeHtml(giftCardPurchase.recipient_name || giftCardPurchase.recipient_email || 'recipient')}</div>
            </div>
            <div>${escapeHtml(formatMoney(giftCardPurchase.amount_cents, giftCardPurchase.currency || "CAD"))}</div>
          </div>`);
      }
      summaryItemsEl.innerHTML = rows.length ? rows.join("") : `<div class="small">Your cart is empty.</div>`;
    }

    if (summarySubtotalEl) summarySubtotalEl.textContent = formatMoney(summary.subtotal_cents, "CAD");
    if (summaryShippingEl) summaryShippingEl.textContent = formatMoney(summary.shipping_cents, "CAD");
    if (summaryDiscountEl) summaryDiscountEl.textContent = appliedGiftCard ? `-${formatMoney(summary.gift_card_discount_cents, "CAD")}` : formatMoney(0, "CAD");
    if (summaryTaxEl) summaryTaxEl.textContent = formatMoney(summary.tax_cents, "CAD");
    if (summaryTotalEl) summaryTotalEl.textContent = formatMoney(summary.total_cents, "CAD");

    return summary;
  }

  function normalizeCartForApi(cartItems) {
    return (Array.isArray(cartItems) ? cartItems : []).map((item) => ({
      product_id: Number(item.product_id || 0),
      quantity: Number(item.quantity || 0)
    }));
  }

  async function createOrder(payload) {
    const headers = { "Content-Type": "application/json" };
    if (window.DDAuth?.isLoggedIn?.()) {
      const token = window.DDAuth.getToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch("/api/checkout-create-order", { method: "POST", headers, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to create order.");
    return data;
  }

  async function preparePayment(order_id, provider) {
    const headers = { "Content-Type": "application/json" };
    if (window.DDAuth?.isLoggedIn?.()) {
      const token = window.DDAuth.getToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch("/api/checkout-prepare-payment", {
      method: "POST",
      headers,
      body: JSON.stringify({ order_id, provider })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to prepare payment.");
    return data;
  }

  async function applyGiftCard() {
    const code = String(giftCardInputEl?.value || '').trim();
    if (!code) {
      appliedGiftCard = null;
      renderSummary();
      setGiftCardMessage('Enter a gift card code first.', true);
      return;
    }
    try {
      setGiftCardMessage('Checking gift card...');
      const summary = calculateCartSummary(getCartItems());
      const response = await fetch('/api/gift-card-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, order_total_cents: summary.subtotal_cents + summary.shipping_cents + summary.tax_cents, currency: 'CAD' })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Gift card could not be applied.');
      appliedGiftCard = data.gift_card || null;
      renderSummary();
      setGiftCardMessage(`Applied ${formatMoney(appliedGiftCard?.applicable_discount_cents || 0, appliedGiftCard?.currency || 'CAD')} from ${appliedGiftCard?.code || code}.`);
    } catch (error) {
      appliedGiftCard = null;
      renderSummary();
      setGiftCardMessage(error.message || 'Gift card could not be applied.', true);
    }
  }

  async function captureRecoveryLead() {
    try {
      const formData = readFormData();
      if (!isValidEmail(formData.customer_email)) return;
      const cartSummary = calculateCartSummary(getCartItems());
      if (cartSummary.subtotal_cents <= 0) return;
      await fetch('/api/checkout-recovery-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: formData.customer_email,
          customer_name: formData.customer_name,
          browser_session_token: window.DDAnalytics?.browser_session_token || '',
          visitor_token: window.DDAnalytics?.visitor_token || '',
          checkout_path: '/checkout/',
          cart_count: getCartItems().reduce((sum, item) => sum + Number(item.quantity || 0), 0),
          cart_value_cents: cartSummary.subtotal_cents,
          currency: 'CAD'
        })
      });
    } catch {}
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cartItems = getCartItems();
    const giftCardPurchase = getGiftCardPurchase();
    if (!cartItems.length && !giftCardPurchase) {
      setMessage("Your cart is empty.", true);
      return;
    }

    const formData = readFormData();
    saveCheckoutForm(formData);

    if (!formData.customer_name) {
      setMessage("Customer name is required.", true);
      return;
    }
    if (!formData.customer_email || !isValidEmail(formData.customer_email)) {
      setMessage("A valid email is required.", true);
      return;
    }

    const summary = renderSummary();
    const shippingError = validateRequiredShippingFields(formData, summary);
    if (shippingError) {
      setMessage(shippingError, true);
      return;
    }

    const originalText = submitButton?.textContent || "Place Order";

    try {
      setMessage("Creating your order...");
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Creating Order...";
      }

      const payload = {
        ...formData,
        items: normalizeCartForApi(cartItems),
        shipping_cents: summary.shipping_cents,
        currency: "CAD",
        gift_card_code: appliedGiftCard?.code || formData.gift_card_code || '',
        gift_card_discount_cents: Number(summary.gift_card_discount_cents || 0),
        gift_card_purchase: giftCardPurchase || null
      };

      const orderData = await createOrder(payload);
      const order = orderData.order || null;
      if (!order?.order_id) throw new Error("Order was created, but the response did not include an order id.");

      setMessage("Order created. Preparing payment...");
      const paymentData = await preparePayment(order.order_id, formData.payment_method || "paypal");

      saveConfirmationSnapshot({ order: orderData.order, order_items: orderData.items || [], storefront_gift_card: orderData.storefront_gift_card || null, payment: paymentData.payment || null, provider_payload: paymentData.provider_payload || null });
      try { localStorage.removeItem(CART_KEY); } catch {}
      clearGiftCardPurchase();
      if (window.DDCart?.clearCart) {
        try { window.DDCart.clearCart(); } catch {}
      }

      if (paymentProviderStatusEl) {
        paymentProviderStatusEl.textContent = paymentData.message || "Payment was prepared.";
        paymentProviderStatusEl.style.display = "block";
      }

      const nextUrl = paymentData?.provider_payload?.redirect_url || `/checkout/confirmation/?order_id=${encodeURIComponent(order.order_id)}`;
      window.location.href = nextUrl;
    } catch (error) {
      setMessage(error.message || "Failed to complete checkout.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  function bindAutoSaveAndRecovery() {
    if (!form) return;
    const saveFields = Array.from(form.querySelectorAll('input, select, textarea'));
    let timer = null;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const data = readFormData();
        saveCheckoutForm(data);
        captureRecoveryLead();
      }, 350);
    };
    saveFields.forEach((field) => {
      field.addEventListener('input', schedule);
      field.addEventListener('change', schedule);
      field.addEventListener('blur', schedule);
    });
  }

  fillFormFromSavedData();
  renderSummary();
  bindAutoSaveAndRecovery();

  form?.addEventListener("submit", handleSubmit);
  giftCardButtonEl?.addEventListener('click', applyGiftCard);
  window.addEventListener('beforeunload', () => { captureRecoveryLead(); });
});
