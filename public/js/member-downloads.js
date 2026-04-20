// File: /public/js/member-downloads.js
// Brief description: Loads the member downloads list inside the members area.
// It fetches the logged-in user’s available digital downloads from the protected
// member endpoint and renders a simple download table for paid digital items.

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("memberDownloadsMount");

  if (!mountEl || !window.DDAuth) return;

  let hasRendered = false;
  let isLoading = false;
  let allDownloads = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function setMessage(message, isError = false) {
    const el = document.getElementById("memberDownloadsMessage");
    if (!el) return;

    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "";
  }

  function updateSummary(downloads) {
    const el = document.getElementById("memberDownloadsSummary");
    if (!el) return;

    const safeDownloads = Array.isArray(downloads) ? downloads : [];
    el.textContent = `${safeDownloads.length} download${safeDownloads.length === 1 ? "" : "s"} available`;
  }

  function renderTable(downloads) {
    const body = document.getElementById("memberDownloadsTableBody");
    const emptyEl = document.getElementById("memberDownloadsEmpty");

    if (!body) return;

    const safeDownloads = Array.isArray(downloads) ? downloads : [];
    updateSummary(safeDownloads);

    if (emptyEl) {
      emptyEl.style.display = safeDownloads.length ? "none" : "block";
    }

    if (!safeDownloads.length) {
      body.innerHTML = `
        <tr>
          <td colspan="6" style="padding:12px">No downloads are available yet.</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = safeDownloads.map((item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(item.product_name || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(item.sku || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(item.order_number || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(item.order_status || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(formatDate(item.order_created_at || item.order_item_created_at))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">
          <a class="btn" href="${escapeHtml(item.digital_file_url || "#")}" target="_blank" rel="noopener noreferrer">
            Download
          </a>
        </td>
      </tr>
    `).join("");
  }

  function renderUi() {
    if (hasRendered) return;
    hasRendered = true;

    mountEl.innerHTML = `
      <div class="card" style="margin-top:18px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h3 style="margin:0">My Downloads</h3>
            <p class="small" style="margin:8px 0 0 0">
              Access your available digital items from paid orders.
            </p>
          </div>

          <button class="btn" type="button" id="refreshMemberDownloadsButton">
            Refresh Downloads
          </button>
        </div>

        <div id="memberDownloadsMessage" class="small" style="display:none;margin-top:12px"></div>
        <div id="memberDownloadsSummary" class="small" style="margin-top:10px"></div>
        <div id="memberDownloadsEmpty" class="small" style="display:none;margin-top:10px">
          No downloads are available yet.
        </div>

        <div style="overflow:auto;margin-top:14px">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Product</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">SKU</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Order</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Status</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Purchased</th>
                <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Action</th>
              </tr>
            </thead>
            <tbody id="memberDownloadsTableBody">
              <tr>
                <td colspan="6" style="padding:12px">Loading downloads...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const refreshButton = document.getElementById("refreshMemberDownloadsButton");
    if (refreshButton) {
      refreshButton.addEventListener("click", async () => {
        await loadDownloads();
      });
    }

    renderTable([]);
  }

  async function fetchDownloads() {
    const response = await window.DDAuth.apiFetch("/api/member/downloads", {
      method: "GET"
    });

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "Failed to load your downloads.");
    }

    return Array.isArray(data.downloads) ? data.downloads : [];
  }

  async function loadDownloads() {
    if (isLoading) return;

    const refreshButton = document.getElementById("refreshMemberDownloadsButton");
    const originalText = refreshButton?.textContent || "Refresh Downloads";

    isLoading = true;

    try {
      setMessage("Loading your downloads...");

      if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
      }

      allDownloads = await fetchDownloads();
      renderTable(allDownloads);
      setMessage(`Loaded ${allDownloads.length} download${allDownloads.length === 1 ? "" : "s"}.`);
    } catch (error) {
      allDownloads = [];
      renderTable([]);
      setMessage(error.message || "Failed to load your downloads.", true);
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
    await loadDownloads();
  });

  document.addEventListener("dd:member-access-ready", async (event) => {
    if (!event?.detail?.ok) return;
    renderUi();
  });

  renderUi();
});
