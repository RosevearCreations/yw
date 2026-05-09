// File: /public/js/admin-orders.js

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("ordersTableBody");
  const refreshButton = document.getElementById("refreshOrdersButton");
  const messageEl = document.getElementById("ordersMessage");
  const summaryEl = document.getElementById("ordersSummary");
  const emptyEl = document.getElementById("ordersEmpty");

  if (!tableBody || !window.DDAuth) return;

  const SNAPSHOT_KEY = "dd_admin_orders_snapshot_v1";
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
      return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "CAD" }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency || "CAD"}`;
    }
  }

  function formatDate(value) {
    if (!value) return "—";
    const raw = String(value).trim();
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
    const fallback = new Date(raw.replace(" ", "T") + "Z");
    if (!Number.isNaN(fallback.getTime())) return fallback.toLocaleString();
    return raw;
  }

  function titleCase(value) {
    const text = String(value || "").trim();
    if (!text) return "—";
    return text.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function setMessage(message, tone = "info") {
    if (!messageEl) return;
    messageEl.textContent = message || "";
    messageEl.style.display = message ? "block" : "none";
    messageEl.className = message ? `status-note ${tone}` : "status-note";
  }

  function saveSnapshot(payload) {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ ...payload, cached_at: new Date().toISOString() }));
    } catch {}
  }

  function loadSnapshot() {
    try {
      return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null");
    } catch {
      return null;
    }
  }

  function getFilterValues() {
    return {
      orderStatus: String(document.getElementById("orderStatusFilter")?.value || "").trim().toLowerCase(),
      paymentStatus: String(document.getElementById("orderPaymentStatusFilter")?.value || "").trim().toLowerCase(),
      fulfillment: String(document.getElementById("orderFulfillmentFilter")?.value || "").trim().toLowerCase(),
      search: String(document.getElementById("orderSearchInput")?.value || "").trim().toLowerCase()
    };
  }

  function matchesFilters(order) {
    const filters = getFilterValues();
    if (filters.orderStatus && String(order.order_status || "").toLowerCase() !== filters.orderStatus) return false;
    const derivedPayment = String(order.derived_payment_status || order.payment_status || "").toLowerCase();
    if (filters.paymentStatus && derivedPayment !== filters.paymentStatus) return false;
    if (filters.fulfillment && String(order.fulfillment_type || "").toLowerCase() !== filters.fulfillment) return false;

    if (filters.search) {
      const haystack = [
        order.order_number,
        order.customer_name,
        order.customer_email,
        order.payment_method,
        order.fulfillment_type,
        order.order_status,
        order.payment_status
      ].map((v) => String(v || "").toLowerCase()).join(" ");
      if (!haystack.includes(filters.search)) return false;
    }
    return true;
  }

  function updateSummary(orders, snapshotLabel = "") {
    if (!summaryEl) return;
    const safeOrders = Array.isArray(orders) ? orders : [];
    const totalValue = safeOrders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0);
    const outstandingValue = safeOrders.reduce((sum, order) => sum + Number(order.outstanding_cents || 0), 0);
    const pendingCount = safeOrders.filter((order) => String(order.order_status || "").toLowerCase() === "pending").length;
    summaryEl.textContent =
      `${safeOrders.length} order${safeOrders.length === 1 ? "" : "s"} shown • ` +
      `Total ${formatMoney(totalValue, safeOrders[0]?.currency || "CAD")} • ` +
      `Outstanding ${formatMoney(outstandingValue, safeOrders[0]?.currency || "CAD")} • ` +
      `${pendingCount} pending${snapshotLabel ? ` • ${snapshotLabel}` : ""}`;
  }

  function paymentLabel(order) {
    return titleCase(order.derived_payment_status || order.payment_status || "pending");
  }

  function renderOrders(orders, options = {}) {
    const safeOrders = Array.isArray(orders) ? orders : [];
    if (emptyEl) emptyEl.style.display = safeOrders.length ? "none" : "block";
    updateSummary(safeOrders, options.snapshotLabel || "");

    if (!safeOrders.length) {
      tableBody.innerHTML = `<tr><td colspan="10" style="padding:12px">No orders found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = safeOrders.map((order) => {
      const currency = order.currency || "CAD";
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd"><div><strong>${escapeHtml(order.order_number || "—")}</strong></div></td>
          <td style="padding:8px;border-bottom:1px solid #ddd"><div>${escapeHtml(order.customer_name || "—")}</div><div class="small">${escapeHtml(order.customer_email || "—")}</div></td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(order.order_status || "pending"))}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(order.fulfillment_type || "shipping"))}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(paymentLabel(order))}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatMoney(order.total_cents || 0, currency))}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatMoney(order.outstanding_cents || 0, currency))}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(String(order.payment_count || 0))}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatDate(order.created_at))}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd"><button class="btn" type="button" data-view-order-id="${escapeHtml(String(order.order_id || ""))}">View</button></td>
        </tr>
      `;
    }).join("");
  }

  async function fetchOrders() {
    const response = await window.DDAuth.apiFetch("/api/admin/orders", { method: "GET" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to load orders.");
    return data;
  }

  async function loadOrders() {
    if (isLoading) return;
    const originalText = refreshButton?.textContent || "Refresh Orders";
    isLoading = true;

    try {
      setMessage("Loading orders...");
      if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
      }

      const payload = await fetchOrders();
      allOrders = Array.isArray(payload.orders) ? payload.orders : [];
      renderOrders(allOrders.filter(matchesFilters));
      saveSnapshot(payload);

      if (payload?.warning) {
        setMessage(payload.warning, "warning");
      } else {
        setMessage(`Loaded ${allOrders.length} order${allOrders.length === 1 ? "" : "s"}.`, "success");
      }
    } catch (error) {
      const cached = loadSnapshot();
      if (Array.isArray(cached?.orders)) {
        allOrders = cached.orders;
        renderOrders(allOrders.filter(matchesFilters), {
          snapshotLabel: cached.cached_at ? `cached ${new Date(cached.cached_at).toLocaleString()}` : "cached snapshot"
        });
        setMessage(
          `Live orders are unavailable. Showing the last saved snapshot from ${cached.cached_at ? new Date(cached.cached_at).toLocaleString() : "an earlier visit"}. ${error.message || ""}`.trim(),
          "warning"
        );
      } else {
        allOrders = [];
        renderOrders([]);
        setMessage(error.message || "Failed to load orders.", "error");
      }
    } finally {
      isLoading = false;
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = originalText;
      }
    }
  }

  function bindFilterEvents() {
    [document.getElementById("orderStatusFilter"), document.getElementById("orderPaymentStatusFilter"), document.getElementById("orderFulfillmentFilter")].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", () => renderOrders(allOrders.filter(matchesFilters)));
    });

    const searchEl = document.getElementById("orderSearchInput");
    if (searchEl) {
      searchEl.addEventListener("input", () => renderOrders(allOrders.filter(matchesFilters)));
    }
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await loadOrders();
    });
  }

  document.addEventListener("dd:admin-ready", async (event) => {
    if (!event?.detail?.ok) return;
    bindFilterEvents();
    await loadOrders();
  });

  document.addEventListener("dd:order-updated", async () => {
    await loadOrders();
  });
});
