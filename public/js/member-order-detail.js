// File: /public/js/member-order-detail.js
// Brief description: Handles the member order-detail modal inside the members area.
// It loads one order from the protected member endpoint, shows core order details,
// items, and status history, and lets members review their own order progress
// without exposing admin-only payment controls.

document.addEventListener("DOMContentLoaded", () => {
  const ordersTableBody = document.getElementById("memberOrdersTableBody");

  if (!ordersTableBody || !window.DDAuth) return;

  let modalEl = null;
  let currentOrderId = null;
  let isLoadingOrder = false;

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

  function formatDate(value) {
    if (!value) return "—";

    const raw = String(value).trim();
    const parsed = new Date(raw);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString();
    }

    const fallback = new Date(raw.replace(" ", "T") + "Z");
    if (!Number.isNaN(fallback.getTime())) {
      return fallback.toLocaleString();
    }

    return raw;
  }

  function titleCase(value) {
    const text = String(value || "").trim();
    if (!text) return "—";

    return text
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement("div");
    modalEl.id = "memberOrderDetailModal";
    modalEl.style.display = "none";
    modalEl.style.position = "fixed";
    modalEl.style.inset = "0";
    modalEl.style.background = "rgba(0,0,0,0.55)";
    modalEl.style.zIndex = "9999";

    modalEl.innerHTML = `
      <div style="max-width:1100px;margin:24px auto;padding:0 16px;">
        <div class="card" style="max-height:90vh;overflow:auto">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
            <h2 style="margin:0">My Order Detail</h2>
            <button class="btn" type="button" id="closeMemberOrderDetailModal">Close</button>
          </div>

          <div id="memberOrderDetailMessage" class="small" style="display:none;margin-top:12px"></div>
          <div id="memberOrderDetailLoading" class="small" style="margin-top:12px">Loading order...</div>

          <div id="memberOrderDetailContent" style="display:none;margin-top:14px">
            <div class="grid cols-2" style="gap:18px">
              <div class="card">
                <h3 style="margin-top:0">Order</h3>
                <div class="small" style="display:grid;gap:8px">
                  <div><strong>Order #:</strong> <span id="memberDetailOrderNumber">—</span></div>
                  <div><strong>Status:</strong> <span id="memberDetailOrderStatus">—</span></div>
                  <div><strong>Payment:</strong> <span id="memberDetailPaymentStatus">—</span></div>
                  <div><strong>Fulfillment:</strong> <span id="memberDetailFulfillmentType">—</span></div>
                  <div><strong>Created:</strong> <span id="memberDetailCreatedAt">—</span></div>
                  <div><strong>Updated:</strong> <span id="memberDetailUpdatedAt">—</span></div>
                </div>
              </div>

              <div class="card">
                <h3 style="margin-top:0">Totals</h3>
                <div class="small" style="display:grid;gap:8px">
                  <div><strong>Subtotal:</strong> <span id="memberDetailSubtotal">—</span></div>
                  <div><strong>Discount:</strong> <span id="memberDetailDiscount">—</span></div>
                  <div><strong>Shipping:</strong> <span id="memberDetailShipping">—</span></div>
                  <div><strong>Tax:</strong> <span id="memberDetailTax">—</span></div>
                  <div><strong>Total:</strong> <span id="memberDetailTotal">—</span></div>
                  <div><strong>Paid:</strong> <span id="memberDetailPaidTotal">—</span></div>
                  <div><strong>Outstanding:</strong> <span id="memberDetailOutstanding">—</span></div>
                </div>
              </div>
            </div>

            <div class="grid cols-2" style="gap:18px;margin-top:18px">
              <div class="card">
                <h3 style="margin-top:0">Shipping</h3>
                <div id="memberDetailShippingBlock" class="small">—</div>
              </div>

              <div class="card">
                <h3 style="margin-top:0">Billing</h3>
                <div id="memberDetailBillingBlock" class="small">—</div>
              </div>
            </div>

            <div class="card" style="margin-top:18px">
              <h3 style="margin-top:0">Items</h3>
              <div style="overflow:auto">
                <table style="width:100%;border-collapse:collapse">
                  <thead>
                    <tr>
                      <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Product</th>
                      <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Type</th>
                      <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">SKU</th>
                      <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Qty</th>
                      <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Unit</th>
                      <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Line Total</th>
                    </tr>
                  </thead>
                  <tbody id="memberOrderItemsBody">
                    <tr><td colspan="6" style="padding:8px">No items found.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="card" id="memberGiftCardsCard" style="margin-top:18px;display:none">
              <h3 style="margin-top:0">Gift Cards</h3>
              <div class="small" id="memberGiftCardsSummary"></div>
              <div id="memberGiftCardsList" style="margin-top:12px"></div>
            </div>

            <div class="card" style="margin-top:18px">
              <h3 style="margin-top:0">Status History</h3>
              <div style="overflow:auto">
                <table style="width:100%;border-collapse:collapse">
                  <thead>
                    <tr>
                      <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">When</th>
                      <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Old</th>
                      <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">New</th>
                      <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Note</th>
                    </tr>
                  </thead>
                  <tbody id="memberOrderHistoryBody">
                    <tr><td colspan="4" style="padding:8px">No history found.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    const closeButton = modalEl.querySelector("#closeMemberOrderDetailModal");
    if (closeButton) {
      closeButton.addEventListener("click", hideModal);
    }

    modalEl.addEventListener("click", (event) => {
      if (event.target === modalEl) {
        hideModal();
      }
    });

    return modalEl;
  }

  function showModal() {
    ensureModal();
    modalEl.style.display = "block";
  }

  function hideModal() {
    if (!modalEl) return;
    modalEl.style.display = "none";
  }

  function setMessage(message, isError = false) {
    ensureModal();

    const el = document.getElementById("memberOrderDetailMessage");
    if (!el) return;

    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "";
  }

  function setLoadingState(isLoading) {
    const loadingEl = document.getElementById("memberOrderDetailLoading");
    const contentEl = document.getElementById("memberOrderDetailContent");

    if (loadingEl) {
      loadingEl.style.display = isLoading ? "" : "none";
    }

    if (contentEl) {
      contentEl.style.display = isLoading ? "none" : "";
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = html;
  }

  function renderAddressBlock(lines, targetId, emptyText) {
    const clean = lines
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    setHtml(
      targetId,
      clean.length
        ? clean.map((line) => escapeHtml(line)).join("<br>")
        : emptyText
    );
  }

  function renderItems(items, currency) {
    const body = document.getElementById("memberOrderItemsBody");
    if (!body) return;

    const safeItems = Array.isArray(items) ? items : [];

    if (!safeItems.length) {
      body.innerHTML = `<tr><td colspan="6" style="padding:8px">No items found.</td></tr>`;
      return;
    }

    body.innerHTML = safeItems.map((item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(item.product_name || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(item.product_type || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(item.sku || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(String(item.quantity || 0))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatMoney(item.unit_price_cents || 0, item.currency || currency))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatMoney(item.line_subtotal_cents || 0, item.currency || currency))}</td>
      </tr>
    `).join("");
  }


  function renderGiftCards(giftCards, auditRows, currency) {
    const cardEl = document.getElementById("memberGiftCardsCard");
    const summaryEl = document.getElementById("memberGiftCardsSummary");
    const listEl = document.getElementById("memberGiftCardsList");
    if (!cardEl || !summaryEl || !listEl) return;

    const safeCards = Array.isArray(giftCards) ? giftCards : [];
    const safeAudit = Array.isArray(auditRows) ? auditRows : [];
    if (!safeCards.length) {
      cardEl.style.display = "none";
      summaryEl.textContent = "";
      listEl.innerHTML = "";
      return;
    }

    cardEl.style.display = "block";
    summaryEl.textContent = `${safeCards.length} gift card(s) were created from this order.`;
    listEl.innerHTML = safeCards.map((card) => {
      const rows = safeAudit.filter((row) => Number(row.gift_card_id || 0) === Number(card.gift_card_id || 0));
      const auditHtml = rows.length ? `
        <div class="small" style="margin-top:10px"><strong>Delivery history</strong></div>
        <div class="small" style="margin-top:6px;display:grid;gap:6px">${rows.map((row) => `<div><strong>${escapeHtml(titleCase(row.audience || 'recipient'))}</strong> • ${escapeHtml(titleCase(row.action_type || 'queued'))} • ${escapeHtml(row.destination || '—')} • ${escapeHtml(formatDate(row.created_at))}</div>`).join('')}</div>
      ` : `<div class="small" style="margin-top:10px">No delivery history has been logged yet for this card.</div>`;
      return `
        <div class="card" style="margin-top:10px">
          <div class="small"><strong>Code:</strong> ${escapeHtml(card.code || '—')}</div>
          <div class="small"><strong>Status:</strong> ${escapeHtml(titleCase(card.status || 'pending_activation'))}</div>
          <div class="small"><strong>Value:</strong> ${escapeHtml(formatMoney(card.initial_amount_cents || 0, card.currency || currency || 'CAD'))} • <strong>Remaining:</strong> ${escapeHtml(formatMoney(card.remaining_amount_cents || 0, card.currency || currency || 'CAD'))}</div>
          <div class="small"><strong>Recipient:</strong> ${escapeHtml(card.recipient_name || '—')} ${card.recipient_email ? `&lt;${escapeHtml(card.recipient_email)}&gt;` : ''}</div>
          <div class="small"><strong>Purchaser:</strong> ${escapeHtml(card.purchaser_name || '—')} ${card.purchaser_email ? `&lt;${escapeHtml(card.purchaser_email)}&gt;` : ''}</div>
          ${card.recipient_note ? `<div class="small"><strong>Message:</strong> ${escapeHtml(card.recipient_note)}</div>` : ''}
          ${card.expires_at ? `<div class="small"><strong>Expires:</strong> ${escapeHtml(formatDate(card.expires_at))}</div>` : ''}
          ${auditHtml}
        </div>
      `;
    }).join('');
  }

  function renderHistory(history) {
    const body = document.getElementById("memberOrderHistoryBody");
    if (!body) return;

    const safeHistory = Array.isArray(history) ? history : [];

    if (!safeHistory.length) {
      body.innerHTML = `<tr><td colspan="4" style="padding:8px">No history found.</td></tr>`;
      return;
    }

    body.innerHTML = safeHistory.map((row) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatDate(row.created_at))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(row.old_status || "—"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(row.new_status || "—"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(row.note || "—")}</td>
      </tr>
    `).join("");
  }

  function renderOrderDetail(payload) {
    const order = payload?.order || {};
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const history = Array.isArray(payload?.status_history) ? payload.status_history : [];
    const paymentSummary = payload?.payment_summary || payload?.payment_snapshot || {};
    const giftCards = Array.isArray(payload?.gift_cards) ? payload.gift_cards : [];
    const giftCardAudit = Array.isArray(payload?.gift_card_delivery_audit) ? payload.gift_card_delivery_audit : [];
    const currency = order.currency || "CAD";

    setText("memberDetailOrderNumber", order.order_number || "—");
    setText("memberDetailOrderStatus", titleCase(order.order_status || "pending"));
    setText(
      "memberDetailPaymentStatus",
      titleCase(paymentSummary.derived_payment_status || order.payment_status || "pending")
    );
    setText("memberDetailFulfillmentType", titleCase(order.fulfillment_type || "shipping"));
    setText("memberDetailCreatedAt", formatDate(order.created_at));
    setText("memberDetailUpdatedAt", formatDate(order.updated_at));

    setText("memberDetailSubtotal", formatMoney(order.subtotal_cents || 0, currency));
    setText("memberDetailDiscount", formatMoney(order.discount_cents || 0, currency));
    setText("memberDetailShipping", formatMoney(order.shipping_cents || 0, currency));
    setText("memberDetailTax", formatMoney(order.tax_cents || 0, currency));
    setText("memberDetailTotal", formatMoney(order.total_cents || 0, currency));
    setText("memberDetailPaidTotal", formatMoney(paymentSummary.paid_total_cents || 0, currency));
    setText("memberDetailOutstanding", formatMoney(paymentSummary.outstanding_cents || 0, currency));

    renderAddressBlock(
      [
        order.shipping_name || order.customer_name,
        order.shipping_company,
        order.shipping_address1,
        order.shipping_address2,
        [order.shipping_city, order.shipping_province].filter(Boolean).join(", "),
        order.shipping_postal_code,
        order.shipping_country
      ],
      "memberDetailShippingBlock",
      "No shipping details saved."
    );

    renderAddressBlock(
      [
        order.billing_name,
        order.billing_company,
        order.billing_address1,
        order.billing_address2,
        [order.billing_city, order.billing_province].filter(Boolean).join(", "),
        order.billing_postal_code,
        order.billing_country
      ],
      "memberDetailBillingBlock",
      "No billing details saved."
    );

    renderItems(items, currency);
    renderGiftCards(giftCards, giftCardAudit, currency);
    renderHistory(history);
  }

  async function fetchOrderDetail(orderId) {
    const response = await window.DDAuth.apiFetch(`/api/member/order-detail?order_id=${encodeURIComponent(orderId)}`, {
      method: "GET"
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Failed to load your order.");
    }

    return data;
  }

  async function loadOrder(orderId) {
    if (isLoadingOrder) return;

    currentOrderId = orderId;
    isLoadingOrder = true;

    try {
      showModal();
      setMessage("");
      setLoadingState(true);

      const detailPayload = await fetchOrderDetail(orderId);
      renderOrderDetail(detailPayload);
      setLoadingState(false);
    } catch (error) {
      setLoadingState(false);
      setMessage(error.message || "Failed to load your order.", true);
    } finally {
      isLoadingOrder = false;
    }
  }

  ordersTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-member-view-order-id]");
    if (!button) return;

    const orderId = Number(button.getAttribute("data-member-view-order-id"));
    if (!Number.isInteger(orderId) || orderId <= 0) return;

    const originalText = button.textContent;

    try {
      button.disabled = true;
      button.textContent = "Loading...";
      await loadOrder(orderId);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
});
