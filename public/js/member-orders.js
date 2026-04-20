// File: /public/js/member-orders.js
// Brief description: Loads the member orders list inside the members area.
// It fetches the logged-in user’s orders from the protected member endpoint,
// renders a simple table with status/payment summaries, and provides the View
// button hook used by the member order-detail modal.

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("memberOrdersMount");

  if (!mountEl || !window.DDAuth) return;

  let hasRendered = false;
  let isLoading = false;
  let allOrders = [];

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

  function setMessage(message, isError = false) {
    const el = document.getElementById("memberOrdersMessage");
    if (!el) return;

    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "";
  }

  function updateSummary(orders) {
    const el = document.getElementById("memberOrdersSummary");
    if (!el) return;

    const safeOrders = Array.isArray(orders) ? orders : [];
    const totalValue = safeOrders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0);
    const outstandingValue = safeOrders.reduce((sum, order) => sum + Number(order.outstanding_cents || 0), 0);

    el.textContent =
      `${safeOrders.length} order${safeOrders.length === 1 ? "" : "s"} • ` +
      `Total ${formatMoney(totalValue, safeOrders[0]?.currency || "CAD")} • ` +
      `Outstanding ${formatMoney(outstandingValue, safeOrders[0]?.currency || "CAD")}`;
  }

  function renderTable(orders) {
    const body = document.getElementById("memberOrdersTableBody");
    const emptyEl = document.getElementById("memberOrdersEmpty");

    if (!body) return;

    const safeOrders = Array.isArray(orders) ? orders : [];
    updateSummary(safeOrders);

    if (emptyEl) {
      emptyEl.style.display = safeOrders.length ? "none" : "block";
    }

    if (!safeOrders.length) {
      body.innerHTML = `
        <tr>
          <td colspan="7" style="padding:12px">No orders found yet.</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = safeOrders.map((order) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(order.order_number || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(order.order_status || "pending"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(order.derived_payment_status || order.payment_status || "pending"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(order.fulfillment_type || "shipping"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatMoney(order.total_cents || 0, order.currency || "CAD"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatDate(order.created_at))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">
          <button class="btn" type="button" data-member-view-order-id="${escapeHtml(String(order.order_id || ""))}">
            View
          </button>
        </td>
      </tr>
    `).join("");
  }

  function renderUi() {
    if (hasRendered) return;
    hasRendered = true;

    mountEl.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h3 style="margin:0">My Orders</h3>
            <p class="small" style="margin:8px 0 0 0">
              Review your recent orders, payment state, and fulfillment progress.
            </p>
          </div>

          <button class="btn" type="button" id="refreshMemberOrdersButton">
            Refresh Orders
          </button>
        </div>

        <div id="memberOrdersMessage" class="small" style="display:none;margin-top:12px"></div>
        <div id="memberOrdersSummary" class="small" style="margin-top:10px"></div>
        <div id="memberOrdersEmpty" class="small" style="display:none;margin-top:10px">
          No orders are available yet.
        </div>

        <div style="overflow:auto;margin-top:14px">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Order</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Status</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Payment</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Fulfillment</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Total</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Created</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Action</th>
              </tr>
            </thead>
            <tbody id="memberOrdersTableBody">
              <tr>
                <td colspan="7" style="padding:12px">Loading orders...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const refreshButton = document.getElementById("refreshMemberOrdersButton");
    if (refreshButton) {
      refreshButton.addEventListener("click", async () => {
        await loadOrders();
      });
    }

    renderTable([]);
  }

  async function fetchOrders() {
    const response = await window.DDAuth.apiFetch("/api/member/orders", {
      method: "GET"
    });

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    let data = null;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text().catch(() => "");
      throw new Error(text || "Failed to load your orders.");
    }

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Failed to load your orders.");
    }

    return Array.isArray(data.orders) ? data.orders : [];
  }

  async function loadOrders() {
    if (isLoading) return;

    const refreshButton = document.getElementById("refreshMemberOrdersButton");
    const originalText = refreshButton?.textContent || "Refresh Orders";

    isLoading = true;

    try {
      setMessage("Loading your orders...");

      if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
      }

      allOrders = await fetchOrders();
      renderTable(allOrders);
      setMessage(`Loaded ${allOrders.length} order${allOrders.length === 1 ? "" : "s"}.`);
    } catch (error) {
      allOrders = [];
      renderTable([]);
      setMessage(error.message || "Failed to load your orders.", true);
    } finally {
      isLoading = false;

      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = originalText;
      }
    }
  }

  document.addEventListener("dd:members-ready", async (event) => {
    if (!event?.detail?.ok) return;
    renderUi();
    await loadOrders();
  });

  document.addEventListener("dd:member-access-ready", async (event) => {
    if (!event?.detail?.ok) return;
    renderUi();
  });

  renderUi();
});
