document.addEventListener("DOMContentLoaded", async () => {
  const sessionCard = document.getElementById("sessionInfoCard");
  const expiresEl = document.getElementById("sessionExpiresAt");
  const activeCountEl = document.getElementById("sessionActiveCount");
  const errorEl = document.getElementById("sessionInfoError");

  function show(el) {
    if (el) el.style.display = "";
  }

  function hide(el) {
    if (el) el.style.display = "none";
  }

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value.replace(" ", "T") + "Z");
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  async function loadSessionInfo() {
    hide(errorEl);

    try {
      const response = await window.DDAuth.apiFetch("/api/auth/session-info", {
        method: "GET"
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load session info.");
      }

      const session = data.session || {};

      if (expiresEl) {
        expiresEl.textContent = formatDate(session.expires_at) || "";
      }

      if (activeCountEl) {
        activeCountEl.textContent = String(Number(session.active_sessions || 0));
      }

      show(sessionCard);
    } catch (error) {
      hide(sessionCard);
      if (errorEl) {
        errorEl.textContent = error.message || "Failed to load session info.";
      }
      show(errorEl);
    }
  }

  if (!window.DDAuth || !window.DDAuth.isLoggedIn()) {
    return;
  }

  document.addEventListener("dd:session-changed", async () => {
    await loadSessionInfo();
  });

  await loadSessionInfo();
});
