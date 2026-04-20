// File: /public/js/admin-products.js

document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("productsTableBody");
  const emptyEl = document.getElementById("productsEmpty");
  const errorEl = document.getElementById("productsError");
  const loadingEl = document.getElementById("productsLoading");
  const refreshButtons = document.querySelectorAll("[data-refresh-products]");
  const productsAdminMount = document.getElementById("productsAdminMount");
  const refreshable = tableBody || productsAdminMount;
  if (!refreshable) return;

  const SNAPSHOT_KEY = "dd_admin_products_snapshot_v2";
  const LOCAL_PENDING_KEY = "dd_admin_product_review_pending_actions_v1";
  let currentSharedPendingActions = [];

  function show(el) {
    if (el) el.style.display = "";
  }

  function hide(el) {
    if (el) el.style.display = "none";
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

  function yesNo(value) {
    return Number(value) === 1 ? "Yes" : "No";
  }

  function parseSafeJson(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function saveSnapshot(products) {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
        cached_at: new Date().toISOString(),
        products: Array.isArray(products) ? products : []
      }));
    } catch {}
  }

  function loadSnapshot() {
    return parseSafeJson(localStorage.getItem(SNAPSHOT_KEY) || "null", null);
  }

  function loadLocalPendingActions() {
    const rows = parseSafeJson(localStorage.getItem(LOCAL_PENDING_KEY) || "[]", []);
    return Array.isArray(rows) ? rows : [];
  }

  function saveLocalPendingActions(rows) {
    try {
      localStorage.setItem(LOCAL_PENDING_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
    } catch {}
  }

  function upsertLocalPendingAction(action) {
    const rows = loadLocalPendingActions();
    const key = String(action?.id || action?.client_action_id || "").trim();
    const next = rows.filter((row) => String(row?.id || row?.client_action_id || "") !== key);
    next.unshift(action);
    saveLocalPendingActions(next.slice(0, 30));
  }

  function removeLocalPendingAction(actionId) {
    const key = String(actionId || "").trim();
    if (!key) return;
    const rows = loadLocalPendingActions().filter((row) => String(row?.id || row?.client_action_id || "") !== key);
    saveLocalPendingActions(rows);
  }

  function buildClientActionId(productId, action) {
    return ["product-review", Number(productId || 0), String(action || "").trim(), Date.now()].join(":");
  }

  function setStatus(message, tone = "error") {
    if (!errorEl) return;
    errorEl.textContent = message || "";
    errorEl.className = `status-note ${tone}`;
    if (message) show(errorEl);
    else hide(errorEl);
  }

  function renderRows(products) {
    if (!tableBody) return;

    tableBody.innerHTML = products.map(product => {
      const productId = Number(product.product_id);
      const name = escapeHtml(product.name || "");
      const slug = escapeHtml(product.slug || "");
      const sku = escapeHtml(product.sku || "");
      const type = escapeHtml(product.product_type || "");
      const status = escapeHtml(product.status || "");
      const price = escapeHtml(formatMoney(product.price_cents, product.currency));
      const inventoryQty = Number(product.inventory_quantity || 0);
      const inventory = escapeHtml(String(inventoryQty));
      const shipping = escapeHtml(yesNo(product.requires_shipping));
      const taxClass = escapeHtml(product.tax_class_name || product.tax_class_code || "");
      const isArchived = String(product.status || "").toLowerCase() === "archived";
      const lowStock = Number(product.low_stock_flag || 0) === 1;
      const ready = Number(product.is_ready_for_storefront || 0) === 1;
      const reviewStatusValue = String(product.review_status || "pending_review").toLowerCase();
      const reviewStatus = escapeHtml(product.review_status || "pending_review");
      const readyNotes = escapeHtml(product.ready_check_notes || "");
      const publishScore = Number(product.publish_readiness_score || 0);
      const imageScore = Number(product.image_quality_score || 0);
      const canApprove = ready;
      const canPublish = ready && ["approved", "published"].includes(reviewStatusValue);
      const approveTitle = canApprove ? 'Approve this draft for storefront review.' : `Finish required approval fields first${readyNotes ? `: ${readyNotes}` : '.'}`;
      const publishTitle = canPublish ? 'Publish this product to the storefront.' : (!ready ? `Finish required approval fields first${readyNotes ? `: ${readyNotes}` : '.'}` : 'Approve this product before publishing.');
      const linkedResourceCount = Number(product.linked_resource_count || 0);
      const linkedResourceCost = escapeHtml(formatMoney(product.linked_resource_cost_cents || 0, product.currency));
      const grossMargin = escapeHtml(formatMoney(product.gross_margin_cents || 0, product.currency));
      const missingCostLinks = Number(product.missing_cost_links || 0);
      const buildableUnits = product.buildable_units_from_resources == null ? "" : String(Number(product.buildable_units_from_resources || 0));
      const shortageLinks = Number(product.resource_shortage_links || 0);

      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd">${productId}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${name}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${slug}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${sku}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${type}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${status}<div class="small">Review: ${reviewStatus}</div><div class="small">${ready ? "Ready for storefront" : "Needs review"}</div></td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${price}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${inventory}<div class="small">${lowStock ? "⚠️ low stock" : "healthy"}</div><div class="small">${ready ? "Storefront ready" : readyNotes || "Missing storefront fields"}</div><div class="small">Publish score ${escapeHtml(String(publishScore))}% • Image score ${escapeHtml(String(imageScore))}%</div><div class="small">Cost ${linkedResourceCost} • Margin ${grossMargin}</div><div class="small">${linkedResourceCount} linked resources${missingCostLinks ? ` • ${missingCostLinks} missing costs` : ""}</div><div class="small">${buildableUnits ? `Buildable units ${escapeHtml(buildableUnits)}` : "Buildable units unknown"}${shortageLinks ? ` • ${shortageLinks} shortages` : ""}</div></td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${shipping}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${taxClass}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn" type="button" data-edit-product-id="${productId}">Edit</button>
              <button class="btn" type="button" data-review-action="approve" data-product-id="${productId}" ${canApprove ? '' : 'disabled'} title="${escapeHtml(approveTitle)}">Approve</button>
              <button class="btn" type="button" data-review-action="request_changes" data-product-id="${productId}">Needs Changes</button>
              <button class="btn" type="button" data-review-action="publish" data-product-id="${productId}" ${canPublish ? '' : 'disabled'} title="${escapeHtml(publishTitle)}">Publish</button>
              <button class="btn" type="button" data-resource-action="reserve" data-product-id="${productId}">Reserve Resources</button>
              <button class="btn" type="button" data-resource-action="release" data-product-id="${productId}">Release Resources</button>
              <button class="btn" type="button" data-archive-product-id="${productId}" ${isArchived ? "disabled" : ""}>Archive</button>
              <button class="btn" type="button" data-delete-product-id="${productId}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function normalizeSharedAction(row) {
    if (!row) return null;
    return {
      source: "shared",
      admin_pending_action_id: Number(row.admin_pending_action_id || 0),
      client_action_id: String(row.client_action_id || "").trim(),
      queue_status: row.queue_status || "queued",
      label: row.label || row.action_label || "Pending product review action",
      last_error: row.last_error || row.warning || "",
      created_at: row.created_at || null,
      payload: row.payload || {},
      endpoint: row.endpoint || row.endpoint_path || "/api/admin/product-review-actions",
      method: row.method || row.http_method || "POST"
    };
  }

  function normalizeLocalAction(row) {
    if (!row) return null;
    return {
      source: "local",
      id: String(row.id || row.client_action_id || "").trim(),
      client_action_id: String(row.client_action_id || row.id || "").trim(),
      queue_status: row.queue_status || "queued",
      label: row.label || "Pending product review action",
      last_error: row.last_error || "",
      created_at: row.created_at || null,
      payload: row.payload || {},
      endpoint: row.endpoint || "/api/admin/product-review-actions",
      method: row.method || "POST"
    };
  }

  async function fetchSharedPendingActions() {
    if (!window.DDAuth?.isLoggedIn()) return [];
    try {
      const response = await window.DDAuth.apiFetch("/api/admin/pending-actions?action_scope=product_review&limit=30", { method: "GET" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to load queued product review actions.");
      return (Array.isArray(data.actions) ? data.actions : []).map(normalizeSharedAction).filter(Boolean);
    } catch {
      return [];
    }
  }

  async function saveSharedPendingAction(action) {
    const response = await window.DDAuth.apiFetch("/api/admin/pending-actions", {
      method: "POST",
      body: JSON.stringify({
        client_action_id: action.client_action_id,
        action_scope: "product_review",
        action_label: action.label,
        endpoint_path: action.endpoint,
        http_method: action.method,
        payload: action.payload,
        queue_status: action.queue_status || "queued",
        last_error: action.last_error || "",
        warning: action.warning || "",
        source_device_label: navigator.userAgent || "browser"
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to save queued product review action.");
    return normalizeSharedAction(data.action);
  }

  async function updateSharedPendingActionStatus(action, queueStatus, lastError = "", incrementAttempt = false) {
    const response = await window.DDAuth.apiFetch("/api/admin/pending-actions-status", {
      method: "POST",
      body: JSON.stringify({
        admin_pending_action_id: action.admin_pending_action_id || 0,
        client_action_id: action.client_action_id || "",
        queue_status: queueStatus,
        last_error: lastError,
        increment_attempt: incrementAttempt ? 1 : 0
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to update queued product review action.");
    return data.action || null;
  }

  function mergePendingActions(sharedRows) {
    const localRows = loadLocalPendingActions().map(normalizeLocalAction).filter(Boolean);
    const sharedClientIds = new Set(sharedRows.map((row) => String(row.client_action_id || "")).filter(Boolean));
    return [...sharedRows, ...localRows.filter((row) => !sharedClientIds.has(String(row.client_action_id || "")))];
  }

  function renderPendingActions() {
    if (!productsAdminMount) return;
    const sharedRows = currentSharedPendingActions;
    const mergedRows = mergePendingActions(sharedRows);
    productsAdminMount.innerHTML = `
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h3 style="margin:0 0 6px 0">Queued product review actions</h3>
            <div class="small">Failed approve, publish, and needs-changes actions can now be replayed across devices. Browser-local storage remains the last safety net when the shared queue is unavailable.</div>
          </div>
          <div class="small">Shared: ${escapeHtml(String(sharedRows.length))} · Browser-only: ${escapeHtml(String(loadLocalPendingActions().length))}</div>
        </div>
        <div id="adminProductPendingActions" style="margin-top:12px">${mergedRows.length ? `<div class="mobile-summary-list">${mergedRows.map((row) => {
          const actionText = escapeHtml(row.label || "Pending product review action");
          const statusText = escapeHtml(row.queue_status || "queued");
          const detailText = escapeHtml(row.last_error || "Waiting to retry.");
          const key = escapeHtml(String(row.admin_pending_action_id || row.client_action_id || row.id || ""));
          return `<div class="mobile-summary-list-item">
            <strong>${actionText}</strong>
            <div class="small">${statusText}${row.created_at ? ` · ${escapeHtml(row.created_at)}` : ""}</div>
            <div class="small" style="margin-top:6px">${detailText}</div>
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn" type="button" data-product-pending-retry="${key}" data-product-pending-source="${escapeHtml(row.source || "shared")}">Retry</button>
              <button class="btn" type="button" data-product-pending-dismiss="${key}" data-product-pending-source="${escapeHtml(row.source || "shared")}">Dismiss</button>
            </div>
          </div>`;
        }).join("")}</div>` : `<div class="small">No queued product review actions are waiting right now.</div>`}</div>
      </div>
    `;
  }

  async function refreshPendingActions() {
    currentSharedPendingActions = await fetchSharedPendingActions();
    renderPendingActions();
  }

  async function loadProducts(options = {}) {
    const { silent = false } = options;

    hide(emptyEl);
    if (!silent) show(loadingEl);

    try {
      const response = await window.DDAuth.apiFetch("/api/admin/products", { method: "GET" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to load products.");

      const products = Array.isArray(data.products) ? data.products : [];
      saveSnapshot(products);
      setStatus("");

      if (!products.length) {
        if (tableBody) tableBody.innerHTML = "";
        show(emptyEl);
        return;
      }

      renderRows(products);
    } catch (error) {
      const cached = loadSnapshot();
      if (cached?.products?.length) {
        renderRows(cached.products);
        setStatus(`Live product list is unavailable. Showing the last saved snapshot from ${cached.cached_at || "an earlier visit"}.`, "warning");
      } else {
        if (tableBody) tableBody.innerHTML = "";
        setStatus(error.message || "Failed to load products.", "error");
        show(emptyEl);
      }
    } finally {
      hide(loadingEl);
    }
  }

  refreshButtons.forEach(button => {
    button.addEventListener("click", async () => {
      await loadProducts();
      await refreshPendingActions();
    });
  });

  document.addEventListener("dd:product-created", async () => {
    await loadProducts({ silent: true });
  });

  document.addEventListener("dd:product-updated", async () => {
    await loadProducts({ silent: true });
  });

  document.addEventListener("dd:product-deleted", async () => {
    await loadProducts({ silent: true });
  });

  document.addEventListener("dd:product-archived", async () => {
    await loadProducts({ silent: true });
  });

  async function queueReviewAction(payload, errorMessage) {
    const action = {
      id: buildClientActionId(payload.product_id, payload.action),
      client_action_id: buildClientActionId(payload.product_id, payload.action),
      label: `Product ${String(payload.action || "review").replace(/_/g, " ")} · #${Number(payload.product_id || 0)}`,
      endpoint: "/api/admin/product-review-actions",
      method: "POST",
      payload,
      queue_status: "queued",
      last_error: errorMessage || ""
    };

    try {
      const saved = await saveSharedPendingAction(action);
      removeLocalPendingAction(action.id);
      currentSharedPendingActions = [saved, ...currentSharedPendingActions.filter((row) => String(row.client_action_id || "") !== String(saved.client_action_id || ""))];
      renderPendingActions();
      return { queued: true, shared: true };
    } catch (queueError) {
      upsertLocalPendingAction(action);
      renderPendingActions();
      return { queued: true, shared: false, queueError: queueError?.message || "Failed to save shared queue action." };
    }
  }

  async function executeQueuedAction(action) {
    const payload = action?.payload && typeof action.payload === "object" ? action.payload : {};
    const response = await window.DDAuth.apiFetch(action.endpoint || "/api/admin/product-review-actions", {
      method: action.method || "POST",
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to replay queued product review action.");
    document.dispatchEvent(new CustomEvent("dd:product-updated", { detail: data.product || null }));
    return data;
  }

  async function runReviewAction(productId, action, options = {}) {
    const payload = options.payload ? { ...options.payload } : { product_id: Number(productId || 0), action };
    if (!options.payload) {
      const note = window.prompt("Optional note for this review action:", "");
      payload.note = String(note || "").trim();
      if (action === "publish" || action === "unpublish") {
        const password = window.prompt("Confirm your admin password to continue:");
        if (!password) return { cancelled: true };
        payload.confirm_password = password;
      }
    }

    try {
      const response = await window.DDAuth.apiFetch("/api/admin/product-review-actions", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || `Failed to ${action} product.`);
      document.dispatchEvent(new CustomEvent("dd:product-updated", { detail: data.product || null }));
      if (options.pendingAction) {
        if (options.pendingAction.source === "shared") {
          await updateSharedPendingActionStatus(options.pendingAction, "completed", "", true).catch(() => null);
          currentSharedPendingActions = currentSharedPendingActions.filter((row) => String(row.client_action_id || "") !== String(options.pendingAction.client_action_id || ""));
        } else {
          removeLocalPendingAction(options.pendingAction.id || options.pendingAction.client_action_id);
        }
        renderPendingActions();
      }
      return { queued: false, ok: true };
    } catch (error) {
      if (options.pendingAction) {
        if (options.pendingAction.source === "shared") {
          await updateSharedPendingActionStatus(options.pendingAction, "failed", error.message || "Replay failed.", true).catch(() => null);
        } else {
          upsertLocalPendingAction({ ...options.pendingAction, queue_status: "failed", last_error: error.message || "Replay failed." });
        }
        await refreshPendingActions();
        return { queued: true, ok: false, error: error.message || `Failed to ${action} product.` };
      }

      const queued = await queueReviewAction(payload, error.message || `Failed to ${action} product.`);
      return {
        queued: true,
        ok: false,
        shared: queued.shared,
        error: error.message || `Failed to ${action} product.`
      };
    }
  }

  async function dismissPendingAction(action) {
    if (action.source === "shared") {
      await updateSharedPendingActionStatus(action, "dismissed", "Dismissed by admin.", false).catch(() => null);
      currentSharedPendingActions = currentSharedPendingActions.filter((row) => String(row.client_action_id || "") !== String(action.client_action_id || ""));
    } else {
      removeLocalPendingAction(action.id || action.client_action_id);
    }
    renderPendingActions();
  }

  async function runResourceAction(productId, action) {
    const quantityInput = window.prompt("Quantity multiplier for linked resources:", "1");
    if (quantityInput === null) return;
    const quantityMultiplier = Math.max(1, Number(quantityInput || 1));
    if (!Number.isFinite(quantityMultiplier)) {
      throw new Error("Quantity multiplier must be a valid number.");
    }
    const note = window.prompt(`Optional note for ${action} resources:`, "") || "";
    const response = await window.DDAuth.apiFetch("/api/admin/site-item-inventory", {
      method: "POST",
      body: JSON.stringify({
        action: action === "reserve" ? "reserve_product_resources" : "release_product_resources",
        product_id: Number(productId || 0),
        quantity_multiplier: quantityMultiplier,
        note: String(note).trim()
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || `Failed to ${action} resources.`);
    const summary = data.summary || {};
    window.alert(`${action === "reserve" ? "Reserved" : "Released"} resources for ${data.product?.name || "product"}.\nAffected items: ${Number(summary.affected_items || 0)}\nShortage items: ${Number(summary.shortage_item_count || 0)}`);
    document.dispatchEvent(new CustomEvent("dd:product-updated", { detail: data.product || null }));
  }

  document.addEventListener("click", async (event) => {
    const reviewButton = event.target.closest("[data-review-action]");
    const resourceButton = event.target.closest("[data-resource-action]");
    const retryButton = event.target.closest("[data-product-pending-retry]");
    const dismissButton = event.target.closest("[data-product-pending-dismiss]");
    if (!reviewButton && !resourceButton && !retryButton && !dismissButton) return;
    if (!window.DDAuth || !window.DDAuth.isLoggedIn()) return;

    if (retryButton || dismissButton) {
      const actionKey = String((retryButton || dismissButton).getAttribute(retryButton ? "data-product-pending-retry" : "data-product-pending-dismiss") || "").trim();
      const actionSource = String((retryButton || dismissButton).getAttribute("data-product-pending-source") || "shared").trim();
      const action = actionSource === "shared"
        ? currentSharedPendingActions.find((row) => String(row.admin_pending_action_id || row.client_action_id || "") === actionKey || String(row.client_action_id || "") === actionKey)
        : loadLocalPendingActions().map(normalizeLocalAction).find((row) => String(row.id || row.client_action_id || "") === actionKey);
      if (!action) return;
      try {
        if (retryButton) {
          const payload = action.payload || {};
          const actionName = String(payload.action || "review").trim();
          const result = await runReviewAction(Number(payload.product_id || 0), actionName, { payload, pendingAction: action });
          if (result?.ok) setStatus("Queued product review action replayed successfully.", "success");
          else setStatus(result?.error || "Queued product review action is still waiting.", "warning");
          await loadProducts({ silent: true });
          await refreshPendingActions();
        } else {
          await dismissPendingAction(action);
          setStatus("Queued product review action dismissed.", "success");
        }
      } catch (error) {
        setStatus(error.message || "Failed to process queued product review action.", "error");
      }
      return;
    }

    if (reviewButton) {
      const productId = Number(reviewButton.getAttribute("data-product-id") || 0);
      const action = String(reviewButton.getAttribute("data-review-action") || "").trim();
      if (!productId || !action) return;
      try {
        const result = await runReviewAction(productId, action);
        if (result?.cancelled) return;
        if (result?.queued) {
          const tone = result.shared ? "warning" : "error";
          const suffix = result.shared
            ? "The action was saved to the shared replay queue."
            : "The shared queue was unavailable, so the action was saved only in this browser for later retry.";
          setStatus(`${result.error || `Failed to ${action} product.`} ${suffix}`, tone);
          await refreshPendingActions();
        } else {
          setStatus(`Product ${action.replace(/_/g, " ")} complete.`, "success");
          await loadProducts({ silent: true });
          await refreshPendingActions();
        }
      } catch (error) {
        setStatus(error.message || `Failed to ${action} product.`, "error");
      }
      return;
    }

    const productId = Number(resourceButton.getAttribute("data-product-id") || 0);
    const action = String(resourceButton.getAttribute("data-resource-action") || "").trim();
    if (!productId || !action) return;
    try {
      await runResourceAction(productId, action);
      setStatus(`Product resources ${action} action complete.`, "success");
      await loadProducts({ silent: true });
    } catch (error) {
      setStatus(error.message || `Failed to ${action} product resources.`, "error");
    }
  });

  if (!window.DDAuth || !window.DDAuth.isLoggedIn()) {
    return;
  }

  await loadProducts();
  await refreshPendingActions();
});
