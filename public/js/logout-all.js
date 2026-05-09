document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll("[data-logout-all]");
  const messageEl = document.getElementById("logoutAllMessage");

  function setMessage(message, isError = false) {
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.style.display = "block";
    messageEl.style.color = isError ? "#b00020" : "#0a7a2f";
  }

  function clearMessage() {
    if (!messageEl) return;
    messageEl.textContent = "";
    messageEl.style.display = "none";
  }

  async function runLogoutAll(button) {
    const originalText = button.textContent;

    try {
      clearMessage();
      button.disabled = true;
      button.textContent = "Signing out...";

      const response = await window.DDAuth.apiFetch("/api/auth/logout-all", {
        method: "POST"
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to log out other sessions.");
      }

      const removed = Number(data.removed_sessions || 0);
      setMessage(`Other sessions signed out successfully. Removed ${removed} session${removed === 1 ? "" : "s"}.`);

      document.dispatchEvent(new CustomEvent("dd:session-changed", {
        detail: {
          type: "logout-all",
          removed_sessions: removed
        }
      }));
    } catch (error) {
      setMessage(error.message || "Failed to log out other sessions.", true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  buttons.forEach(button => {
    button.addEventListener("click", async () => {
      await runLogoutAll(button);
    });
  });
});
