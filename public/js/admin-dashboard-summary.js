// File: /public/js/admin-dashboard-summary.js
// Brief description: Loads the top dashboard summary cards on the admin page.
// It fetches the protected dashboard summary endpoint, fills the
// user/product/order/payment totals, and refreshes automatically
// after admin changes that affect the summary.

document.addEventListener("DOMContentLoaded", () => {
  if (!window.DDAuth) return;

  const messageEl = document.getElementById("dashboardSummaryMessage");
  const refreshButton = document.getElementById("refreshDashboardSummaryButton");

  let isLoading = false;

  function setMessage(message, isError = false) {
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.style.display = message ? "block" : "none";
    messageEl.style.color = isError ? "#b00020" : "";
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  function formatCount(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toLocaleString() : "0";
  }

  function renderEmpty() {
    ["summaryUsersCount","summaryProductsCount","summaryOrdersCount","summaryPaymentsCount","summaryLowStockCount","summaryFailedWebhooksCount","summaryOpenDisputesCount","summaryLiveVisitorsCount","summaryRecentSearchesCount","summaryRuntimeIncidentsCount"].forEach((id) => setValue(id, "—"));
  }

  function renderSummary(summary) {
    setValue("summaryUsersCount", formatCount(summary?.users_count));
    setValue("summaryProductsCount", formatCount(summary?.products_count));
    setValue("summaryOrdersCount", formatCount(summary?.orders_count));
    setValue("summaryPaymentsCount", formatCount(summary?.payments_count));
    setValue("summaryLowStockCount", formatCount(summary?.low_stock_count));
    setValue("summaryFailedWebhooksCount", formatCount(summary?.failed_webhooks_count));
    setValue("summaryOpenDisputesCount", formatCount(summary?.open_disputes_count));
    setValue("summaryLiveVisitorsCount", formatCount(summary?.active_visitor_sessions_count));
    setValue("summaryRecentSearchesCount", formatCount(summary?.recent_searches_count));
    setValue("summaryRuntimeIncidentsCount", formatCount(summary?.recent_runtime_incidents_count));
  }

  async function fetchSummary() {
    const response = await window.DDAuth.apiFetch("/api/admin/dashboard-summary", {
      method: "GET"
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Failed to load dashboard summary.");
    }

    return data.summary || {};
  }

  async function loadSummary() {
    if (isLoading) return;

    const originalText = refreshButton?.textContent || "Refresh Summary";
    isLoading = true;

    try {
      setMessage("Loading dashboard summary...");

      if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
      }

      const summary = await fetchSummary();
      renderSummary(summary);
      setMessage("");
    } catch (error) {
      renderEmpty();
      setMessage(error.message || "Failed to load dashboard summary.", true);
    } finally {
      isLoading = false;

      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = originalText;
      }
    }
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await loadSummary();
    });
  }

  document.addEventListener("dd:admin-ready", async (event) => {
    if (!event?.detail?.ok) {
      renderEmpty();
      return;
    }

    await loadSummary();
  });

  document.addEventListener("dd:user-updated", async () => {
    await loadSummary();
  });

  document.addEventListener("dd:order-updated", async () => {
    await loadSummary();
  });

  document.addEventListener("dd:product-updated", async () => {
    await loadSummary();
  });

  renderEmpty();
});
