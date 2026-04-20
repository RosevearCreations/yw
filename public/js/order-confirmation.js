// File: /public/js/order-confirmation.js
// Brief description: Handles the checkout confirmation page, including guest snapshots
// plus PayPal and Stripe return completion.

document.addEventListener("DOMContentLoaded", () => {
  const messageEl = document.getElementById("orderConfirmationMessage");
  const orderNumberEl = document.getElementById("confirmationOrderNumber");
  const orderIdEl = document.getElementById("confirmationOrderId");
  const orderStatusEl = document.getElementById("confirmationOrderStatus");
  const paymentStatusEl = document.getElementById("confirmationPaymentStatus");
  const paymentProviderEl = document.getElementById("confirmationPaymentProvider");
  const customerNameEl = document.getElementById("confirmationCustomerName");
  const customerEmailEl = document.getElementById("confirmationCustomerEmail");
  const totalEl = document.getElementById("confirmationTotal");
  const createdAtEl = document.getElementById("confirmationCreatedAt");
  const nextStepEl = document.getElementById("confirmationNextStep");
  const CONFIRMATION_KEY = "dd_last_order_confirmation";

  function setMessage(message, isError = false) {
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.style.display = message ? "block" : "none";
    messageEl.style.color = isError ? "#b00020" : "";
  }
  function setText(el, value) { if (el) el.textContent = value; }
  function titleCase(value) {
    const text = String(value || "").trim();
    return text ? text.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (ch) => ch.toUpperCase()) : "—";
  }
  function formatDate(value) {
    if (!value) return "—";
    const raw = String(value).trim();
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
    const fallback = new Date(raw.replace(" ", "T") + "Z");
    return Number.isNaN(fallback.getTime()) ? raw : fallback.toLocaleString();
  }
  function formatMoney(cents, currency = "CAD") {
    const amount = Number(cents || 0) / 100;
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "CAD" }).format(amount); }
    catch { return `${amount.toFixed(2)} ${currency || "CAD"}`; }
  }
  function getUrlState() {
    const url = new URL(window.location.href);
    return {
      order_id: Number(url.searchParams.get("order_id") || 0),
      order_number: String(url.searchParams.get("order_number") || "").trim(),
      payment_provider: String(url.searchParams.get("payment_provider") || url.searchParams.get("provider") || "").trim(),
      payment_status: String(url.searchParams.get("payment_status") || "").trim(),
      paypal_token: String(url.searchParams.get("token") || "").trim(),
      payer_id: String(url.searchParams.get("PayerID") || "").trim(),
      stripe_session_id: String(url.searchParams.get("session_id") || "").trim()
    };
  }
  function loadSavedConfirmation() {
    try {
      const raw = sessionStorage.getItem(CONFIRMATION_KEY) || localStorage.getItem(CONFIRMATION_KEY);
      const parsed = JSON.parse(raw || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch { return null; }
  }
  function confirmationMatchesState(saved, state) {
    if (!saved?.order || !state) return false;
    const savedOrderId = Number(saved.order.order_id || 0);
    const savedOrderNumber = String(saved.order.order_number || "").trim();
    return (state.order_id && savedOrderId && state.order_id === savedOrderId) || (state.order_number && savedOrderNumber && state.order_number === savedOrderNumber);
  }
  async function fetchOrderDetail(orderId) {
    if (!orderId || !window.DDAuth?.apiFetch || !window.DDAuth?.isLoggedIn?.()) return null;
    try {
      const response = await window.DDAuth.apiFetch(`/api/member/order-detail?order_id=${encodeURIComponent(orderId)}`, { method: "GET" });
      const data = await response.json().catch(() => null);
      return (!response.ok || !data?.ok) ? null : data;
    } catch { return null; }
  }

  async function finalizeStripeReturn(state) {
    if (!state.order_id || !state.stripe_session_id) return null;
    try {
      const response = await fetch('/api/stripe-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: state.order_id, session_id: state.stripe_session_id })
      });
      const data = await response.json().catch(() => null);
      return (!response.ok || !data?.ok) ? null : data;
    } catch { return null; }
  }

  async function finalizePaypalReturn(state) {
    if (!state.order_id || !state.paypal_token) return null;
    try {
      const response = await fetch('/api/paypal-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: state.order_id, paypal_order_id: state.paypal_token })
      });
      const data = await response.json().catch(() => null);
      return (!response.ok || !data?.ok) ? null : data;
    } catch { return null; }
  }
  function renderFromUrlState(state) {
    setText(orderNumberEl, state.order_number || "—");
    setText(orderIdEl, state.order_id ? String(state.order_id) : "—");
    setText(orderStatusEl, "Pending");
    setText(paymentStatusEl, titleCase(state.payment_status || "pending"));
    setText(paymentProviderEl, titleCase(state.payment_provider || "pending"));
    setText(customerNameEl, "—");
    setText(customerEmailEl, "—");
    setText(totalEl, "—");
    setText(createdAtEl, "—");
    if (nextStepEl) nextStepEl.textContent = "Your order was created successfully. Payment is currently pending until the payment provider flow is completed.";
  }
  function renderFromSavedConfirmation(saved, fallbackState) {
    const order = saved?.order || {};
    const paymentPreparation = saved?.payment_preparation || {};
    const paymentStub = paymentPreparation?.payment_stub || {};
    const customer = saved?.customer || {};
    setText(orderNumberEl, order.order_number || fallbackState.order_number || "—");
    setText(orderIdEl, order.order_id ? String(order.order_id) : (fallbackState.order_id ? String(fallbackState.order_id) : "—"));
    setText(orderStatusEl, titleCase(order.order_status || "pending"));
    setText(paymentStatusEl, titleCase(paymentStub.payment_status || fallbackState.payment_status || order.payment_status || "pending"));
    setText(paymentProviderEl, titleCase(paymentPreparation.provider || fallbackState.payment_provider || "pending"));
    setText(customerNameEl, customer.customer_name || order.customer_name || "—");
    setText(customerEmailEl, customer.customer_email || order.customer_email || "—");
    setText(totalEl, formatMoney(order.total_cents || paymentStub.amount_cents || 0, order.currency || paymentStub.currency || "CAD"));
    setText(createdAtEl, formatDate(order.created_at || saved?.saved_at));
    if (nextStepEl) nextStepEl.textContent = "Your order has been created and saved locally for confirmation. Payment is still pending until the payment flow is completed or a manual payment is recorded.";
  }
  function renderFromOrderPayload(payload, fallbackState) {
    const order = payload?.order || {};
    const paymentSummary = payload?.payment_summary || payload?.payment_snapshot || {};
    setText(orderNumberEl, order.order_number || fallbackState.order_number || "—");
    setText(orderIdEl, order.order_id ? String(order.order_id) : (fallbackState.order_id ? String(fallbackState.order_id) : "—"));
    setText(orderStatusEl, titleCase(order.order_status || "pending"));
    setText(paymentStatusEl, titleCase(paymentSummary.derived_payment_status || order.payment_status || fallbackState.payment_status || "pending"));
    setText(paymentProviderEl, titleCase(fallbackState.payment_provider || "pending"));
    setText(customerNameEl, order.customer_name || "—");
    setText(customerEmailEl, order.customer_email || "—");
    setText(totalEl, formatMoney(order.total_cents || 0, order.currency || "CAD"));
    setText(createdAtEl, formatDate(order.created_at));
    if (nextStepEl) {
      const paymentState = String(paymentSummary.derived_payment_status || order.payment_status || "pending").toLowerCase();
      if (paymentState === "paid") nextStepEl.textContent = "Payment has been recorded and your order is now marked as paid.";
      else if (paymentState === "authorized") nextStepEl.textContent = "Your payment is authorized and awaiting final completion.";
      else nextStepEl.textContent = "Your order has been created. Payment is still pending and will be completed once the payment flow is finalized.";
    }
  }
  async function init() {
    const state = getUrlState();
    const saved = loadSavedConfirmation();
    if (!state.order_id && !state.order_number) {
      setMessage("No order information was found for this confirmation page.", true);
      renderFromUrlState({});
      return;
    }
    setMessage("Loading your order confirmation...");
    renderFromUrlState(state);
    if (saved && confirmationMatchesState(saved, state)) renderFromSavedConfirmation(saved, state);
    if (state.payment_provider === 'stripe' && state.stripe_session_id && state.order_id) {
      setMessage('Finalizing your Stripe payment...');
      const stripeResult = await finalizeStripeReturn(state);
      if (stripeResult?.payment_status) state.payment_status = stripeResult.payment_status;
    }
    if (state.payment_provider === 'paypal' && state.paypal_token && state.order_id) {
      setMessage('Finalizing your PayPal payment...');
      const paypalResult = await finalizePaypalReturn(state);
      if (paypalResult?.payment_status) state.payment_status = paypalResult.payment_status;
    }
    const payload = state.order_id ? await fetchOrderDetail(state.order_id) : null;
    if (payload?.order) { renderFromOrderPayload(payload, state); setMessage(''); return; }
    if (saved && confirmationMatchesState(saved, state)) { setMessage(''); return; }
    setMessage('');
  }
  init();
});
