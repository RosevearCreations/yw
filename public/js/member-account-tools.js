// File: /public/js/member-account-tools.js
// Brief description: Renders the account tools area inside the members page. It shows
// the current session summary, adds a logout-all button, and works with the shared
// auth/session endpoints so the member area has a clean account-management foundation.

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("memberAccountToolsMount");

  if (!mountEl || !window.DDAuth) return;

  let hasRendered = false;
  let currentUser = null;
  let currentSession = null;
  let isLoadingSessionInfo = false;

  function setMessage(message, isError = false) {
    const el = document.getElementById("memberAccountToolsMessage");
    if (!el) return;

    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "#0a7a2f";
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

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  }

  function renderUi() {
    if (hasRendered) return;
    hasRendered = true;

    mountEl.innerHTML = `
      <div class="card">
        <h4 style="margin-top:0">Session Tools</h4>
        <div id="memberAccountToolsMessage" class="small" style="display:none;margin-bottom:12px"></div>

        <div class="small" style="display:grid;gap:8px">
          <div><strong>Signed In As:</strong> <span id="memberToolsSignedInAs">—</span></div>
          <div><strong>Role:</strong> <span id="memberToolsRole">—</span></div>
          <div><strong>Current Session Expires:</strong> <span id="memberToolsSessionExpires">—</span></div>
          <div><strong>Total Sessions:</strong> <span id="memberToolsTotalSessions">—</span></div>
          <div><strong>Active Sessions:</strong> <span id="memberToolsActiveSessions">—</span></div>
        </div>

        <div class="small" style="margin-top:12px">Need help? <a href="/account-help/index.html?mode=password">Forgot password</a> • <a href="/account-help/index.html?mode=email">Forgot email</a></div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <button class="btn" type="button" id="refreshMemberSessionInfoButton">
            Refresh Session Info
          </button>

          <button class="btn" type="button" id="memberLogoutAllButton">
            Logout All Sessions
          </button>
        </div>
      </div>
    `;

    const refreshButton = document.getElementById("refreshMemberSessionInfoButton");
    const logoutAllButton = document.getElementById("memberLogoutAllButton");

    if (refreshButton) {
      refreshButton.addEventListener("click", async () => {
        await loadSessionInfo();
      });
    }

    if (logoutAllButton) {
      logoutAllButton.addEventListener("click", async () => {
        const originalText = logoutAllButton.textContent || "Logout All Sessions";

        try {
          setMessage("Logging out all sessions...");

          logoutAllButton.disabled = true;
          logoutAllButton.textContent = "Logging Out...";

          await window.DDAuth.logoutAll();

          setMessage("All sessions have been logged out.");
          window.location.href = "/login/";
        } catch (error) {
          setMessage(error.message || "Failed to log out all sessions.", true);
        } finally {
          logoutAllButton.disabled = false;
          logoutAllButton.textContent = originalText;
        }
      });
    }

    renderState();
  }

  function renderState(sessionSummary = null) {
    setText("memberToolsSignedInAs", currentUser?.email || "—");
    setText("memberToolsRole", String(currentUser?.role || "—").replace(/\b\w/g, (ch) => ch.toUpperCase()));
    setText("memberToolsSessionExpires", formatDate(currentSession?.expires_at));

    setText(
      "memberToolsTotalSessions",
      sessionSummary ? String(sessionSummary.total_sessions ?? "—") : "—"
    );

    setText(
      "memberToolsActiveSessions",
      sessionSummary ? String(sessionSummary.active_sessions ?? "—") : "—"
    );
  }

  async function loadSessionInfo() {
    if (isLoadingSessionInfo) return;

    const refreshButton = document.getElementById("refreshMemberSessionInfoButton");
    const originalText = refreshButton?.textContent || "Refresh Session Info";

    try {
      isLoadingSessionInfo = true;
      setMessage("Loading session info...");

      if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
      }

      const data = await window.DDAuth.fetchSessionInfo();

      currentUser = data?.user || currentUser;
      currentSession = data?.session || currentSession;

      renderState(data?.session_summary || null);
      setMessage("Session info loaded.");
    } catch (error) {
      setMessage(error.message || "Failed to load session info.", true);
    } finally {
      isLoadingSessionInfo = false;

      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = originalText;
      }
    }
  }

  document.addEventListener("dd:members-ready", async (event) => {
    if (!event?.detail?.ok) return;

    currentUser = event.detail.user || currentUser;
    currentSession = event.detail.session || currentSession;

    renderUi();
    renderState();
    await loadSessionInfo();
  });

  document.addEventListener("dd:member-access-ready", async (event) => {
    if (!event?.detail?.ok) return;

    currentUser = event.detail.user || currentUser;
    currentSession = event.detail.session || currentSession;

    renderUi();
    renderState();
  });
});
