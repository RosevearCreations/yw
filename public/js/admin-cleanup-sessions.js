// File: /public/js/admin-cleanup-sessions.js

document.addEventListener("DOMContentLoaded", () => {
  const mountTargets = [
    document.getElementById("accessTiersAdminMount"),
    document.getElementById("usersAdminMount")
  ].filter(Boolean);

  if (!mountTargets.length || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let hasRendered = false;

  function setMessage(message, isError = false) {
    const el = document.getElementById("adminCleanupSessionsMessage");
    if (!el) return;

    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "#0a7a2f";
  }

  function getMode() {
    const el = document.getElementById("adminCleanupMode");
    return String(el?.value || "expired_only").trim().toLowerCase();
  }

  function toggleUserIdField() {
    const mode = getMode();
    const wrap = document.getElementById("adminCleanupTargetUserWrap");

    if (!wrap) return;

    if (mode === "user_all_sessions" || mode === "all_expired_and_user") {
      wrap.style.display = "";
    } else {
      wrap.style.display = "none";
    }
  }

  function renderUi() {
    if (hasRendered) return;
    hasRendered = true;

    const container = document.createElement("div");
    container.className = "card";
    container.style.marginTop = "18px";
    container.innerHTML = `
      <h3 style="margin-top:0">Session Cleanup</h3>
      <p class="small" style="margin-top:0">
        Remove expired sessions or clear all sessions for a specific user as part of admin security maintenance.
      </p>

      <div class="grid cols-2" style="gap:12px">
        <div>
          <label class="small" for="adminCleanupMode">Cleanup Mode</label>
          <select id="adminCleanupMode">
            <option value="expired_only" selected>Expired sessions only</option>
            <option value="user_all_sessions">All sessions for one user</option>
            <option value="all_expired_and_user">Expired sessions and one user</option>
          </select>
        </div>

        <div id="adminCleanupTargetUserWrap" style="display:none">
          <label class="small" for="adminCleanupTargetUserId">Target User ID</label>
          <input
            id="adminCleanupTargetUserId"
            type="number"
            min="1"
            step="1"
            placeholder="Enter user ID"
          />
        </div>
      </div>

      <label class="small" style="display:flex;gap:8px;align-items:flex-start;margin-top:12px">
        <input id="adminCleanupPreserveCurrentSession" type="checkbox" checked />
        <span>Preserve my current session when cleaning my own user sessions</span>
      </label>

      <div id="adminCleanupSessionsMessage" class="small" style="display:none;margin-top:12px"></div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" type="button" id="adminCleanupSessionsButton">
          Run Session Cleanup
        </button>
      </div>
    `;

    mountTargets[0].appendChild(container);

    const modeEl = document.getElementById("adminCleanupMode");
    const runButton = document.getElementById("adminCleanupSessionsButton");

    if (modeEl) {
      modeEl.addEventListener("change", toggleUserIdField);
    }

    if (runButton) {
      runButton.addEventListener("click", runCleanup);
    }

    toggleUserIdField();
  }

  async function runCleanup() {
    const mode = getMode();
    const targetUserEl = document.getElementById("adminCleanupTargetUserId");
    const preserveEl = document.getElementById("adminCleanupPreserveCurrentSession");
    const button = document.getElementById("adminCleanupSessionsButton");

    const target_user_id = Number(targetUserEl?.value || 0);
    const preserve_current_session = !!preserveEl?.checked;

    if (
      (mode === "user_all_sessions" || mode === "all_expired_and_user") &&
      (!Number.isInteger(target_user_id) || target_user_id <= 0)
    ) {
      setMessage("A valid target user ID is required for this cleanup mode.", true);
      return;
    }

    const originalText = button?.textContent || "Run Session Cleanup";

    try {
      setMessage("Running session cleanup...");

      if (button) {
        button.disabled = true;
        button.textContent = "Running...";
      }

      const response = await window.DDAuth.apiFetch("/api/admin/cleanup-sessions", {
        method: "POST",
        body: JSON.stringify({
          mode,
          target_user_id: target_user_id || null,
          preserve_current_session
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Session cleanup failed.");
      }

      const summary = data.summary || {};
      setMessage(
        `Cleanup complete. Expired removed: ${Number(summary.expired_deleted || 0)}. ` +
        `User sessions removed: ${Number(summary.user_deleted || 0)}. ` +
        `Total removed: ${Number(summary.total_deleted || 0)}.`
      );
    } catch (error) {
      setMessage(error.message || "Session cleanup failed.", true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  document.addEventListener("dd:admin-ready", (event) => {
    if (!event?.detail?.ok) return;
    renderUi();
  });

  renderUi();
});
