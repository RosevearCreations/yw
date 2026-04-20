// File: /public/js/admin-order-detail.js

document.addEventListener("DOMContentLoaded", () => {
  const ordersTableBody = document.getElementById("ordersTableBody");

  if (!ordersTableBody || !window.DDAuth) return;

  const SNAPSHOT_KEY = "dd_admin_order_detail_snapshot_v1";
  const PENDING_ACTIONS_KEY = "dd_admin_order_pending_actions_v1";
  let currentServerPendingActions = [];
  let modalEl = null;
  let currentOrderId = null;
  let isLoadingOrder = false;
  let isRecordingPayment = false;

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
    modalEl.id = "adminOrderDetailModal";
    modalEl.style.display = "none";
    modalEl.style.position = "fixed";
    modalEl.style.inset = "0";
    modalEl.style.background = "rgba(0,0,0,0.55)";
    modalEl.style.zIndex = "9999";

    modalEl.innerHTML = `
      <div style="max-width:1200px;margin:24px auto;padding:0 16px;">
        <div class="card" style="max-height:90vh;overflow:auto">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
            <h2 style="margin:0">Order Detail</h2>
            <button class="btn" type="button" id="closeAdminOrderDetailModal">Close</button>
          </div>

          <div id="adminOrderDetailMessage" class="small" style="display:none;margin-top:12px"></div>
          <div id="adminOrderDetailLoading" class="small" style="margin-top:12px">Loading order...</div>

          <div id="adminOrderDetailContent" style="display:none;margin-top:14px">
            <div class="grid cols-2" style="gap:18px">
              <div class="card">
                <h3 style="margin-top:0">Order</h3>
                <div class="small" style="display:grid;gap:8px">
                  <div><strong>Order #:</strong> <span id="adminDetailOrderNumber">—</span></div>
                  <div><strong>Customer:</strong> <span id="adminDetailCustomer">—</span></div>
                  <div><strong>Email:</strong> <span id="adminDetailCustomerEmail">—</span></div>
                  <div><strong>Status:</strong> <span id="adminDetailOrderStatus">—</span></div>
                  <div><strong>Payment Status:</strong> <span id="adminDetailOrderPaymentStatus">—</span></div>
                  <div><strong>Fulfillment:</strong> <span id="adminDetailFulfillmentType">—</span></div>
                  <div><strong>Created:</strong> <span id="adminDetailCreatedAt">—</span></div>
                  <div><strong>Updated:</strong> <span id="adminDetailUpdatedAt">—</span></div>
                </div>
              </div>

              <div class="card">
                <h3 style="margin-top:0">Totals</h3>
                <div class="small" style="display:grid;gap:8px">
                  <div><strong>Subtotal:</strong> <span id="adminDetailSubtotal">—</span></div>
                  <div><strong>Discount:</strong> <span id="adminDetailDiscount">—</span></div>
                  <div><strong>Shipping:</strong> <span id="adminDetailShipping">—</span></div>
                  <div><strong>Tax:</strong> <span id="adminDetailTax">—</span></div>
                  <div><strong>Total:</strong> <span id="adminDetailTotal">—</span></div>
                  <div><strong>Paid:</strong> <span id="adminDetailPaidTotal">—</span></div>
                  <div><strong>Outstanding:</strong> <span id="adminDetailOutstanding">—</span></div>
                  <div><strong>Derived Payment:</strong> <span id="adminDetailDerivedPaymentStatus">—</span></div>
                </div>
              </div>
            </div>

            <div class="grid cols-2" style="gap:18px;margin-top:18px">
              <div class="card">
                <h3 style="margin-top:0">Shipping</h3>
                <div id="adminDetailShippingBlock" class="small">—</div>
              </div>

              <div class="card">
                <h3 style="margin-top:0">Update Order Status</h3>
                <form id="adminUpdateOrderStatusForm" class="grid" style="gap:12px">
                  <div>
                    <label class="small" for="adminUpdateOrderStatusSelect">New Status</label>
                    <select id="adminUpdateOrderStatusSelect">
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="fulfilled">Fulfilled</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>

                  <div>
                    <label class="small" for="adminUpdateOrderStatusNote">Note</label>
                    <input id="adminUpdateOrderStatusNote" type="text" placeholder="Optional note" />
                  </div>

                  <div>
                    <button class="btn" type="submit" id="adminUpdateOrderStatusButton">
                      Update Status
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div class="grid cols-2" style="gap:18px;margin-top:18px">
              <div class="card">
                <h3 style="margin-top:0">Refund / Dispute Workflow</h3>
                <form id="adminPaymentActionForm" class="grid" style="gap:12px">
                  <div class="grid cols-2" style="gap:12px">
                    <div><label class="small" for="adminPaymentActionPaymentId">Payment ID</label><input id="adminPaymentActionPaymentId" type="number" min="1" step="1" /></div>
                    <div><label class="small" for="adminPaymentActionType">Action</label><select id="adminPaymentActionType"><option value="refund">Refund</option><option value="dispute">Dispute</option></select></div>
                  </div>
                  <div class="grid cols-2" style="gap:12px">
                    <div><label class="small" for="adminPaymentActionAmount">Amount (cents)</label><input id="adminPaymentActionAmount" type="number" min="0" step="1" /></div>
                    <div><label class="small" for="adminPaymentActionReason">Reason</label><input id="adminPaymentActionReason" type="text" placeholder="customer request, duplicate, chargeback..." /></div>
                  </div>
                  <div><label class="small" for="adminPaymentActionNote">Note</label><input id="adminPaymentActionNote" type="text" placeholder="Optional admin note" /></div>
                  <div><button class="btn" type="submit" id="adminPaymentActionButton">Record Action</button></div>
                </form>
              </div>

              <div class="card">
                <h3 style="margin-top:0">Refunds & Disputes</h3>
                <div id="adminOrderPaymentActionsSummary" class="small" style="margin-bottom:10px">—</div>
                <div id="adminOrderPaymentActionsList" class="small">No payment actions logged yet.</div>
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
                  <tbody id="adminOrderItemsBody">
                    <tr><td colspan="6" style="padding:8px">No items found.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="grid cols-2" style="gap:18px;margin-top:18px">
              <div class="card">
                <h3 style="margin-top:0">Payments</h3>
                <div id="adminOrderPaymentsSummary" class="small" style="margin-bottom:10px">—</div>
                <div style="overflow:auto">
                  <table style="width:100%;border-collapse:collapse">
                    <thead>
                      <tr>
                        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Provider</th>
                        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Status</th>
                        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Method</th>
                        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Amount</th>
                        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Reference</th>
                        <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Paid At</th>
                      </tr>
                    </thead>
                    <tbody id="adminOrderPaymentsBody">
                      <tr><td colspan="6" style="padding:8px">No payments found.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="card">
                <h3 style="margin-top:0">Record Payment</h3>
                <form id="adminRecordPaymentForm" class="grid" style="gap:12px">
                  <div class="grid cols-2" style="gap:12px">
                    <div>
                      <label class="small" for="adminRecordPaymentProvider">Provider</label>
                      <select id="adminRecordPaymentProvider">
                        <option value="manual" selected>Manual</option>
                        <option value="paypal">PayPal</option>
                        <option value="stripe">Stripe</option>
                        <option value="square">Square</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label class="small" for="adminRecordPaymentStatus">Payment Status</label>
                      <select id="adminRecordPaymentStatus">
                        <option value="paid" selected>Paid</option>
                        <option value="authorized">Authorized</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="refunded">Refunded</option>
                        <option value="partially_refunded">Partially Refunded</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid cols-2" style="gap:12px">
                    <div>
                      <label class="small" for="adminRecordPaymentAmount">Amount (cents)</label>
                      <input id="adminRecordPaymentAmount" type="number" min="0" step="1" />
                    </div>

                    <div>
                      <label class="small" for="adminRecordPaymentCurrency">Currency</label>
                      <input id="adminRecordPaymentCurrency" type="text" maxlength="8" />
                    </div>
                  </div>

                  <div class="grid cols-2" style="gap:12px">
                    <div>
                      <label class="small" for="adminRecordPaymentMethod">Method Label</label>
                      <input id="adminRecordPaymentMethod" type="text" placeholder="Cash, e-transfer, PayPal..." />
                    </div>

                    <div>
                      <label class="small" for="adminRecordPaymentReference">Reference</label>
                      <input id="adminRecordPaymentReference" type="text" placeholder="Transaction reference" />
                    </div>
                  </div>

                  <div>
                    <label class="small" for="adminRecordPaymentNote">Note</label>
                    <input id="adminRecordPaymentNote" type="text" placeholder="Optional note" />
                  </div>

                  <div>
                    <button class="btn" type="submit" id="adminRecordPaymentButton">
                      Record Payment
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div class="card" style="margin-top:18px">
              <h3 style="margin-top:0">Pending Local Fallback Actions</h3>
              <div id="adminOrderPendingActions" class="small">No local fallback actions saved.</div>
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
                  <tbody id="adminOrderHistoryBody">
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

    const closeButton = modalEl.querySelector("#closeAdminOrderDetailModal");
    if (closeButton) {
      closeButton.addEventListener("click", hideModal);
    }

    modalEl.addEventListener("click", (event) => {
      if (event.target === modalEl) {
        hideModal();
      }
    });

    const updateStatusForm = modalEl.querySelector("#adminUpdateOrderStatusForm");
    if (updateStatusForm) {
      updateStatusForm.addEventListener("submit", onSubmitOrderStatusUpdate);
    }

    const recordPaymentForm = modalEl.querySelector("#adminRecordPaymentForm");
    if (recordPaymentForm) {
      recordPaymentForm.addEventListener("submit", onSubmitRecordPayment);
    }

    const paymentActionForm = modalEl.querySelector("#adminPaymentActionForm");
    if (paymentActionForm) {
      paymentActionForm.addEventListener("submit", onSubmitPaymentAction);
    }

    modalEl.addEventListener("click", async (event) => {
      const retryButton = event.target.closest("[data-retry-pending-action]");
      if (retryButton) {
        const actionId = retryButton.getAttribute("data-retry-pending-action");
        await retryPendingAction(actionId);
        return;
      }

      const clearButton = event.target.closest("[data-clear-pending-action]");
      if (clearButton) {
        const actionId = String(clearButton.getAttribute("data-clear-pending-action") || "");
        if (actionId.startsWith("server:")) {
          const lookupId = actionId.split(":").slice(1).join(":");
          const action = currentServerPendingActions.find((row) => String(row.admin_pending_action_id || row.client_action_id || "") === lookupId);
          if (action) {
            updateServerPendingActionStatus(action, "dismissed", "Dismissed by admin.", false)
              .then(() => {
                removeServerPendingAction(action);
                if (action.client_action_id) removePendingAction(action.client_action_id);
                renderPendingActions(currentOrderId);
              })
              .catch(() => renderPendingActions(currentOrderId));
          }
          return;
        }
        const lookupId = actionId.includes(":") ? actionId.split(":").slice(1).join(":") : actionId;
        removePendingAction(lookupId);
        renderPendingActions(currentOrderId);
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

  function setMessage(message, tone = "info") {
    ensureModal();

    const el = document.getElementById("adminOrderDetailMessage");
    if (!el) return;

    el.textContent = message || "";
    el.style.display = message ? "block" : "none";
    el.className = message ? `status-note ${tone}` : "status-note";
  }

  function setLoadingState(isLoading) {
    const loadingEl = document.getElementById("adminOrderDetailLoading");
    const contentEl = document.getElementById("adminOrderDetailContent");

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

  function renderShippingBlock(order) {
    const lines = [
      order.shipping_name || order.customer_name,
      order.shipping_address1,
      order.shipping_address2,
      [order.shipping_city, order.shipping_province].filter(Boolean).join(", "),
      order.shipping_postal_code,
      order.shipping_country
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    setHtml(
      "adminDetailShippingBlock",
      lines.length
        ? lines.map((line) => escapeHtml(line)).join("<br>")
        : "No shipping details saved."
    );
  }

  function renderItems(items, currency) {
    const body = document.getElementById("adminOrderItemsBody");
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

  function renderHistory(history) {
    const body = document.getElementById("adminOrderHistoryBody");
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

  function renderPayments(paymentsPayload, fallbackCurrency = "CAD") {
    const body = document.getElementById("adminOrderPaymentsBody");
    const summaryEl = document.getElementById("adminOrderPaymentsSummary");

    if (!body || !summaryEl) return;

    const payments = Array.isArray(paymentsPayload?.payments) ? paymentsPayload.payments : [];
    const summary = paymentsPayload?.summary || {};
    const currency = paymentsPayload?.order?.currency || fallbackCurrency;

    summaryEl.textContent =
      `${Number(summary.payment_count || 0)} payment(s) • ` +
      `Paid ${formatMoney(summary.paid_total_cents || 0, currency)} • ` +
      `Outstanding ${formatMoney(summary.outstanding_cents || 0, currency)} • ` +
      `${titleCase(summary.derived_payment_status || "pending")}`;

    if (!payments.length) {
      body.innerHTML = `<tr><td colspan="6" style="padding:8px">No payments found.</td></tr>`;
      return;
    }

    body.innerHTML = payments.map((payment) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(payment.provider || "—"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(payment.payment_status || "—"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(payment.payment_method_label || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatMoney(payment.amount_cents || 0, payment.currency || currency))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(payment.transaction_reference || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatDate(payment.paid_at || payment.created_at))}</td>
      </tr>
    `).join("");
  }

  function renderPaymentActions(paymentsPayload, fallbackCurrency = "CAD") {
    const summaryEl = document.getElementById("adminOrderPaymentActionsSummary");
    const listEl = document.getElementById("adminOrderPaymentActionsList");
    if (!summaryEl || !listEl) return;
    const refunds = Array.isArray(paymentsPayload?.refunds) ? paymentsPayload.refunds : [];
    const disputes = Array.isArray(paymentsPayload?.disputes) ? paymentsPayload.disputes : [];
    summaryEl.textContent = `${refunds.length} refund(s) • ${disputes.length} dispute(s)`;
    const items = [];
    refunds.forEach((refund) => {
      items.push(`Refund • payment ${refund.payment_id} • ${formatMoney(refund.amount_cents || 0, refund.currency || fallbackCurrency)} • ${titleCase(refund.refund_status || 'recorded')} • ${escapeHtml(refund.reason || refund.note || '—')}`);
    });
    disputes.forEach((dispute) => {
      items.push(`Dispute • payment ${dispute.payment_id} • ${formatMoney(dispute.amount_cents || 0, dispute.currency || fallbackCurrency)} • ${titleCase(dispute.dispute_status || 'open')} • ${escapeHtml(dispute.reason || dispute.note || '—')}`);
    });
    listEl.innerHTML = items.length ? items.join('<br>') : 'No payment actions logged yet.';
  }

  function fillPaymentForm(order) {
    const amountEl = document.getElementById("adminRecordPaymentAmount");
    const currencyEl = document.getElementById("adminRecordPaymentCurrency");
    const methodEl = document.getElementById("adminRecordPaymentMethod");
    const refEl = document.getElementById("adminRecordPaymentReference");
    const noteEl = document.getElementById("adminRecordPaymentNote");

    if (amountEl) {
      amountEl.value = String(order.total_cents || 0);
    }

    if (currencyEl) {
      currencyEl.value = String(order.currency || "CAD");
    }

    if (methodEl) methodEl.value = "";
    if (refEl) refEl.value = "";
    if (noteEl) noteEl.value = "";

    const paymentIdEl = document.getElementById("adminPaymentActionPaymentId");
    const actionAmountEl = document.getElementById("adminPaymentActionAmount");
    if (paymentIdEl) paymentIdEl.value = "";
    if (actionAmountEl) actionAmountEl.value = String(order.total_cents || 0);
  }

  function loadSnapshot(orderId) {
    try {
      const raw = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "{}");
      return raw?.[String(orderId)] || null;
    } catch {
      return null;
    }
  }

  function saveSnapshot(orderId, detailPayload, paymentsPayload) {
    if (!orderId || (!detailPayload && !paymentsPayload)) return;
    try {
      const raw = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "{}");
      const current = raw?.[String(orderId)] || {};
      raw[String(orderId)] = {
        detailPayload: detailPayload || current.detailPayload || null,
        paymentsPayload: paymentsPayload || current.paymentsPayload || null,
        cached_at: new Date().toISOString()
      };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(raw));
    } catch {}
  }


  function loadPendingActions() {
    try {
      const rows = JSON.parse(localStorage.getItem(PENDING_ACTIONS_KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function savePendingActions(actions) {
    try {
      localStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(Array.isArray(actions) ? actions : []));
    } catch {}
  }

  function setServerPendingActions(actions) {
    currentServerPendingActions = Array.isArray(actions) ? actions : [];
  }

  function getServerPendingActionsForOrder(orderId) {
    return currentServerPendingActions.filter((row) => Number(row.order_id || 0) === Number(orderId || 0));
  }

  function mergePendingActionsForOrder(orderId) {
    const serverRows = getServerPendingActionsForOrder(orderId).map((row) => ({ ...row, storage_scope: "shared_queue" }));
    const serverClientIds = new Set(serverRows.map((row) => String(row.client_action_id || "")).filter(Boolean));
    const localRows = getPendingActionsForOrder(orderId)
      .filter((row) => !serverClientIds.has(String(row.id || "")))
      .map((row) => ({ ...row, storage_scope: "browser_local" }));
    return [...serverRows, ...localRows].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }

  async function fetchServerPendingActions(orderId) {
    const response = await window.DDAuth.apiFetch(`/api/admin/pending-actions?order_id=${encodeURIComponent(orderId)}&limit=50`, {
      method: "GET"
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to load shared pending actions.");
    return data;
  }

  async function queuePendingActionServer(action) {
    const response = await window.DDAuth.apiFetch("/api/admin/pending-actions", {
      method: "POST",
      body: JSON.stringify({
        client_action_id: String(action.id || "").trim(),
        action_scope: String(action.action_scope || "admin_write").trim() || "admin_write",
        order_id: Number(action.order_id || 0),
        label: action.label || "Pending admin action",
        endpoint: action.endpoint || "",
        method: action.method || "POST",
        payload: action.payload || {},
        queue_status: "queued",
        last_error: action.last_error || "",
        warning: action.warning || "",
        source_device_label: "browser-fallback"
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to save action to the shared queue.");
    return data.action || null;
  }

  async function updateServerPendingActionStatus(action, queueStatus, errorMessage = "", incrementAttempt = false) {
    if (!action?.admin_pending_action_id && !action?.client_action_id) return null;
    const response = await window.DDAuth.apiFetch("/api/admin/pending-actions-status", {
      method: "POST",
      body: JSON.stringify({
        admin_pending_action_id: Number(action.admin_pending_action_id || 0),
        client_action_id: action.client_action_id || "",
        queue_status: queueStatus,
        last_error: errorMessage || "",
        increment_attempt: incrementAttempt ? 1 : 0
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to update shared pending action status.");
    return data.action || null;
  }

  function upsertServerPendingAction(action) {
    if (!action) return;
    const rows = Array.isArray(currentServerPendingActions) ? [...currentServerPendingActions] : [];
    const key = Number(action.admin_pending_action_id || 0);
    const index = rows.findIndex((row) => Number(row.admin_pending_action_id || 0) === key || (action.client_action_id && String(row.client_action_id || "") === String(action.client_action_id || "")));
    if (index >= 0) rows.splice(index, 1, action);
    else rows.unshift(action);
    currentServerPendingActions = rows;
  }

  function removeServerPendingAction(action) {
    currentServerPendingActions = currentServerPendingActions.filter((row) => Number(row.admin_pending_action_id || 0) !== Number(action?.admin_pending_action_id || 0) && String(row.client_action_id || "") !== String(action?.client_action_id || ""));
  }

  function getPendingActionsForOrder(orderId) {
    return loadPendingActions().filter((row) => Number(row.order_id || 0) === Number(orderId || 0));
  }

  function upsertPendingAction(action) {
    const rows = loadPendingActions();
    const payloadKey = JSON.stringify(action.payload || {});
    const existingIndex = rows.findIndex((row) =>
      Number(row.order_id || 0) === Number(action.order_id || 0) &&
      String(row.endpoint || '') === String(action.endpoint || '') &&
      JSON.stringify(row.payload || {}) === payloadKey
    );

    const nextRow = {
      id: existingIndex >= 0 ? rows[existingIndex].id : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      order_id: Number(action.order_id || 0),
      label: String(action.label || 'Pending admin action').trim() || 'Pending admin action',
      endpoint: String(action.endpoint || '').trim(),
      method: String(action.method || 'POST').trim().toUpperCase() || 'POST',
      payload: action.payload || {},
      created_at: existingIndex >= 0 ? rows[existingIndex].created_at : new Date().toISOString(),
      last_attempt_at: existingIndex >= 0 ? rows[existingIndex].last_attempt_at || null : null,
      attempt_count: Number(existingIndex >= 0 ? rows[existingIndex].attempt_count || 0 : 0),
      last_error: String(action.last_error || '').trim(),
      warning: String(action.warning || '').trim()
    };

    if (existingIndex >= 0) rows.splice(existingIndex, 1, nextRow);
    else rows.unshift(nextRow);
    savePendingActions(rows);
    return nextRow;
  }

  function removePendingAction(actionId) {
    savePendingActions(loadPendingActions().filter((row) => String(row.id) !== String(actionId || '')));
  }

  function updatePendingActionFailure(actionId, errorMessage) {
    const rows = loadPendingActions();
    const index = rows.findIndex((row) => String(row.id) === String(actionId || ''));
    if (index === -1) return;
    rows[index] = {
      ...rows[index],
      attempt_count: Number(rows[index].attempt_count || 0) + 1,
      last_attempt_at: new Date().toISOString(),
      last_error: String(errorMessage || 'Replay failed.').trim()
    };
    savePendingActions(rows);
  }

  function renderPendingActions(orderId) {
    const el = document.getElementById("adminOrderPendingActions");
    if (!el) return;

    const rows = mergePendingActionsForOrder(orderId);
    if (!rows.length) {
      el.innerHTML = 'No shared or browser-only fallback actions are saved right now.';
      return;
    }

    el.innerHTML = rows.map((row) => {
      const storageScope = row.storage_scope === "shared_queue" ? "Shared queue" : "Browser only";
      const actionKey = row.storage_scope === "shared_queue"
        ? `server:${String(row.admin_pending_action_id || row.client_action_id || '')}`
        : `local:${String(row.id || '')}`;
      return `
        <div class="mobile-summary-list-item" style="margin-bottom:10px">
          <div><strong>${escapeHtml(row.label || 'Pending action')}</strong></div>
          <div class="small">${escapeHtml(storageScope)} • Saved ${escapeHtml(formatDate(row.created_at))}${row.last_attempt_at ? ` • Last retry ${escapeHtml(formatDate(row.last_attempt_at))}` : ''}</div>
          <div class="small">${escapeHtml(row.last_error || row.warning || 'Saved so the action can be replayed later if the live write path fails.')}</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="button" data-retry-pending-action="${escapeHtml(actionKey)}">Retry</button>
            <button class="btn" type="button" data-clear-pending-action="${escapeHtml(actionKey)}">${row.storage_scope === "shared_queue" ? "Dismiss" : "Clear"}</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function retryPendingAction(actionId) {
    const rawId = String(actionId || '');
    const isServerAction = rawId.startsWith('server:');
    const lookupId = rawId.includes(':') ? rawId.split(':').slice(1).join(':') : rawId;
    const action = isServerAction
      ? currentServerPendingActions.find((row) => String(row.admin_pending_action_id || row.client_action_id || '') === lookupId)
      : loadPendingActions().find((row) => String(row.id) === lookupId);

    if (!action) {
      renderPendingActions(currentOrderId);
      return;
    }

    setMessage(`Retrying ${action.label || 'saved action'}...`);
    try {
      if (isServerAction) {
        await updateServerPendingActionStatus(action, 'retrying', '', false);
      }
      const response = await window.DDAuth.apiFetch(action.endpoint, {
        method: action.method || 'POST',
        body: JSON.stringify(action.payload || {})
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || data?.warning || 'Replay failed.');
      }
      if (isServerAction) {
        await updateServerPendingActionStatus(action, 'completed', '', true);
        removeServerPendingAction(action);
        if (action.client_action_id) removePendingAction(action.client_action_id);
      } else {
        removePendingAction(lookupId);
      }
      renderPendingActions(currentOrderId);
      setMessage(`Replayed saved action: ${action.label || 'pending action'}.`, data?.warnings?.length ? 'warning' : 'success');
      if (currentOrderId) {
        await loadOrder(currentOrderId);
        document.dispatchEvent(new CustomEvent("dd:order-updated", { detail: { order_id: currentOrderId } }));
      }
    } catch (error) {
      if (isServerAction) {
        try {
          const updated = await updateServerPendingActionStatus(action, 'failed', error?.message || 'Replay failed.', true);
          upsertServerPendingAction({ ...action, ...(updated || {}), queue_status: 'failed', last_error: error?.message || 'Replay failed.' });
        } catch {}
      } else {
        updatePendingActionFailure(lookupId, error?.message || 'Replay failed.');
      }
      renderPendingActions(currentOrderId);
      setMessage(`${action.label || 'Saved action'} is still pending. ${error?.message || 'Replay failed.'}`, 'warning');
    }
  }

  async function persistPendingAction(action) {
    const localRow = upsertPendingAction(action);
    try {
      const saved = await queuePendingActionServer({ ...localRow, action_scope: action.action_scope || localRow.action_scope || "admin_write" });
      if (saved) {
        upsertServerPendingAction(saved);
        removePendingAction(localRow.id);
        renderPendingActions(currentOrderId || localRow.order_id);
        return { storage: "shared_queue", action: saved };
      }
    } catch {}
    renderPendingActions(currentOrderId || localRow.order_id);
    return { storage: "browser_local", action: localRow };
  }

  function renderOrderDetail(detailPayload, paymentsPayload) {
    const order = detailPayload?.order || {};
    const items = Array.isArray(detailPayload?.items) ? detailPayload.items : [];
    const history = Array.isArray(detailPayload?.status_history) ? detailPayload.status_history : [];
    const paymentSummary = paymentsPayload?.summary || {};
    const currency = order.currency || "CAD";

    setText("adminDetailOrderNumber", order.order_number || "—");
    setText("adminDetailCustomer", order.customer_name || "—");
    setText("adminDetailCustomerEmail", order.customer_email || "—");
    setText("adminDetailOrderStatus", titleCase(order.order_status || "pending"));
    setText("adminDetailOrderPaymentStatus", titleCase(order.payment_status || "pending"));
    setText("adminDetailFulfillmentType", titleCase(order.fulfillment_type || "shipping"));
    setText("adminDetailCreatedAt", formatDate(order.created_at));
    setText("adminDetailUpdatedAt", formatDate(order.updated_at));

    setText("adminDetailSubtotal", formatMoney(order.subtotal_cents || 0, currency));
    setText("adminDetailDiscount", formatMoney(order.discount_cents || 0, currency));
    setText("adminDetailShipping", formatMoney(order.shipping_cents || 0, currency));
    setText("adminDetailTax", formatMoney(order.tax_cents || 0, currency));
    setText("adminDetailTotal", formatMoney(order.total_cents || 0, currency));
    setText("adminDetailPaidTotal", formatMoney(paymentSummary.paid_total_cents || 0, currency));
    setText("adminDetailOutstanding", formatMoney(paymentSummary.outstanding_cents || 0, currency));
    setText("adminDetailDerivedPaymentStatus", titleCase(paymentSummary.derived_payment_status || order.payment_status || "pending"));

    const statusSelect = document.getElementById("adminUpdateOrderStatusSelect");
    if (statusSelect) {
      statusSelect.value = String(order.order_status || "pending").toLowerCase();
    }

    renderShippingBlock(order);
    renderItems(items, currency);
    renderHistory(history);
    renderPayments(paymentsPayload, currency);
    renderPaymentActions(paymentsPayload, currency);
    fillPaymentForm(order);
    renderPendingActions(currentOrderId || order.order_id);
    const firstPayment = Array.isArray(paymentsPayload?.payments) ? paymentsPayload.payments[0] : null;
    const paymentIdEl = document.getElementById("adminPaymentActionPaymentId");
    if (paymentIdEl && firstPayment?.payment_id) paymentIdEl.value = String(firstPayment.payment_id);
  }

  async function fetchOrderDetail(orderId) {
    const response = await window.DDAuth.apiFetch(`/api/admin/order-detail?order_id=${encodeURIComponent(orderId)}`, {
      method: "GET"
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Failed to load order detail.");
    }

    return data;
  }

  async function fetchOrderPayments(orderId) {
    const response = await window.DDAuth.apiFetch(`/api/admin/order-payments?order_id=${encodeURIComponent(orderId)}`, {
      method: "GET"
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Failed to load order payments.");
    }

    return data;
  }

  async function loadOrder(orderId) {
    if (isLoadingOrder) return;

    currentOrderId = orderId;
    isLoadingOrder = true;

    try {
      showModal();
      setMessage("Loading order...");
      setLoadingState(true);

      const cached = loadSnapshot(orderId);
      const [detailState, paymentsState, pendingActionsState] = await Promise.allSettled([
        fetchOrderDetail(orderId),
        fetchOrderPayments(orderId),
        fetchServerPendingActions(orderId)
      ]);

      const liveDetail = detailState.status === "fulfilled" ? detailState.value : null;
      const livePayments = paymentsState.status === "fulfilled" ? paymentsState.value : null;
      setServerPendingActions(pendingActionsState.status === "fulfilled" ? (pendingActionsState.value?.actions || []) : []);
      const detailPayload = liveDetail || cached?.detailPayload || null;
      const paymentsPayload = livePayments || cached?.paymentsPayload || { summary: {}, payments: [], refunds: [], disputes: [] };

      if (!detailPayload) {
        throw new Error((detailState.reason && detailState.reason.message) || "Failed to load order detail.");
      }

      renderOrderDetail(detailPayload, paymentsPayload);
      setLoadingState(false);
      saveSnapshot(orderId, liveDetail, livePayments);

      const warnings = [];
      if (detailState.status !== "fulfilled") warnings.push(detailState.reason?.message || "Order detail used a cached snapshot.");
      if (paymentsState.status !== "fulfilled") warnings.push(paymentsState.reason?.message || "Payments used a cached snapshot.");
      if (pendingActionsState.status !== "fulfilled") warnings.push(pendingActionsState.reason?.message || "Shared pending actions could not be loaded.");
      if (detailPayload?.warning) warnings.push(detailPayload.warning);
      if (paymentsPayload?.warning) warnings.push(paymentsPayload.warning);

      if (warnings.length) {
        const cachedAt = cached?.cached_at ? new Date(cached.cached_at).toLocaleString() : "an earlier visit";
        const snapshotSuffix = cached?.cached_at ? ` Cached snapshot: ${cachedAt}.` : "";
        setMessage(`Showing partial order data. ${warnings.join(" ")}${snapshotSuffix}`, "warning");
      } else {
        setMessage("Order detail loaded.", "success");
      }
    } catch (error) {
      setLoadingState(false);
      renderPendingActions(orderId);
      setMessage(error.message || "Failed to load order.", "error");
    } finally {
      isLoadingOrder = false;
    }
  }

  async function onSubmitOrderStatusUpdate(event) {
    event.preventDefault();
    if (!currentOrderId) return;

    const statusEl = document.getElementById("adminUpdateOrderStatusSelect");
    const noteEl = document.getElementById("adminUpdateOrderStatusNote");
    const button = document.getElementById("adminUpdateOrderStatusButton");

    const new_status = String(statusEl?.value || "").trim().toLowerCase();
    const note = String(noteEl?.value || "").trim();
    const originalText = button?.textContent || "Update Status";

    try {
      setMessage("Updating order status...");

      if (button) {
        button.disabled = true;
        button.textContent = "Updating...";
      }

      const response = await window.DDAuth.apiFetch("/api/admin/update-order-status", {
        method: "POST",
        body: JSON.stringify({
          order_id: currentOrderId,
          new_status,
          note
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to update order status.");
      }

      if (noteEl) {
        noteEl.value = "";
      }

      setMessage("Order status updated.", "success");
      await loadOrder(currentOrderId);
      document.dispatchEvent(new CustomEvent("dd:order-updated", {
        detail: { order: data.order || null }
      }));
    } catch (error) {
      const savedState = await persistPendingAction({
        action_scope: "order_status_update",
        order_id: currentOrderId,
        label: `Update order status to ${new_status || "pending"}`,
        endpoint: "/api/admin/update-order-status",
        method: "POST",
        payload: { order_id: currentOrderId, new_status, note },
        last_error: error.message || "Failed to update order status.",
        warning: "Saved so it can be retried without retyping if the live write path fails."
      });
      setMessage(`Live save failed. The status update was saved to ${savedState.storage === "shared_queue" ? "the shared replay queue" : "this browser only"}. ${error.message || ""}`.trim(), "warning");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  async function onSubmitRecordPayment(event) {
    event.preventDefault();
    if (!currentOrderId || isRecordingPayment) return;

    const providerEl = document.getElementById("adminRecordPaymentProvider");
    const statusEl = document.getElementById("adminRecordPaymentStatus");
    const amountEl = document.getElementById("adminRecordPaymentAmount");
    const currencyEl = document.getElementById("adminRecordPaymentCurrency");
    const methodEl = document.getElementById("adminRecordPaymentMethod");
    const refEl = document.getElementById("adminRecordPaymentReference");
    const noteEl = document.getElementById("adminRecordPaymentNote");
    const button = document.getElementById("adminRecordPaymentButton");

    const payload = {
      order_id: currentOrderId,
      provider: String(providerEl?.value || "manual").trim().toLowerCase(),
      payment_status: String(statusEl?.value || "paid").trim().toLowerCase(),
      amount_cents: Number(amountEl?.value || 0),
      currency: String(currencyEl?.value || "CAD").trim().toUpperCase(),
      payment_method_label: String(methodEl?.value || "").trim(),
      transaction_reference: String(refEl?.value || "").trim(),
      notes: String(noteEl?.value || "").trim()
    };

    const originalText = button?.textContent || "Record Payment";
    isRecordingPayment = true;

    try {
      setMessage("Recording payment...");

      if (button) {
        button.disabled = true;
        button.textContent = "Recording...";
      }

      const response = await window.DDAuth.apiFetch("/api/admin/record-payment", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to record payment.");
      }

      setMessage("Payment recorded.", "success");
      await loadOrder(currentOrderId);
      document.dispatchEvent(new CustomEvent("dd:order-updated", {
        detail: { order: data.order || null }
      }));
    } catch (error) {
      const savedState = await persistPendingAction({
        action_scope: "record_payment",
        order_id: currentOrderId,
        label: `Record ${payload.payment_status || "payment"} payment`,
        endpoint: "/api/admin/record-payment",
        method: "POST",
        payload,
        last_error: error.message || "Failed to record payment.",
        warning: "Saved so the payment record can be retried later if the live write path fails."
      });
      setMessage(`Live save failed. The payment entry was saved to ${savedState.storage === "shared_queue" ? "the shared replay queue" : "this browser only"}. ${error.message || ""}`.trim(), "warning");
    } finally {
      isRecordingPayment = false;

      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  async function onSubmitPaymentAction(event) {
    event.preventDefault();
    if (!currentOrderId) return;
    const paymentIdEl = document.getElementById("adminPaymentActionPaymentId");
    const actionEl = document.getElementById("adminPaymentActionType");
    const amountEl = document.getElementById("adminPaymentActionAmount");
    const reasonEl = document.getElementById("adminPaymentActionReason");
    const noteEl = document.getElementById("adminPaymentActionNote");
    const button = document.getElementById("adminPaymentActionButton");
    const originalText = button?.textContent || "Record Action";
    try {
      setMessage("Recording payment action...");
      if (button) { button.disabled = true; button.textContent = "Saving..."; }
      const response = await window.DDAuth.apiFetch("/api/admin/payment-actions", {
        method: "POST",
        body: JSON.stringify({
          payment_id: Number(paymentIdEl?.value || 0),
          action: String(actionEl?.value || 'refund').trim().toLowerCase(),
          amount_cents: Number(amountEl?.value || 0),
          reason: String(reasonEl?.value || '').trim(),
          note: String(noteEl?.value || '').trim()
        })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to record payment action.");
      if (noteEl) noteEl.value = "";
      if (reasonEl) reasonEl.value = "";
      setMessage(data.message || "Payment action recorded.", "success");
      await loadOrder(currentOrderId);
      document.dispatchEvent(new CustomEvent("dd:order-updated", { detail: { order_id: currentOrderId } }));
    } catch (error) {
      const savedState = await persistPendingAction({
        action_scope: "payment_action",
        order_id: currentOrderId,
        label: `Record ${String(actionEl?.value || "refund").trim().toLowerCase()} action for payment ${String(paymentIdEl?.value || "").trim() || "?"}`,
        endpoint: "/api/admin/payment-actions",
        method: "POST",
        payload: {
          payment_id: Number(paymentIdEl?.value || 0),
          action: String(actionEl?.value || "refund").trim().toLowerCase(),
          amount_cents: Number(amountEl?.value || 0),
          reason: String(reasonEl?.value || "").trim(),
          note: String(noteEl?.value || "").trim()
        },
        last_error: error.message || "Failed to record payment action.",
        warning: "Saved so the refund/dispute action can be retried later if the live write path fails."
      });
      setMessage(`Live save failed. The payment action was saved to ${savedState.storage === "shared_queue" ? "the shared replay queue" : "this browser only"}. ${error.message || ""}`.trim(), "warning");
    } finally {
      if (button) { button.disabled = false; button.textContent = originalText; }
    }
  }

  ordersTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-view-order-id]");
    if (!button) return;

    const orderId = Number(button.getAttribute("data-view-order-id"));
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
