// File: /public/js/admin-reset-password.js

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("usersAdminMount");

  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let hasRendered = false;

  function setMessage(message, isError = false) {
    const el = document.getElementById("adminResetPasswordMessage");
    if (!el) return;

    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "#0a7a2f";
  }

  function renderUi() {
    if (hasRendered) return;
    hasRendered = true;

    const card = document.createElement("div");
    card.className = "card";
    card.style.marginTop = "18px";
    card.innerHTML = `
      <h3 style="margin-top:0">Reset User Password</h3>
      <p class="small" style="margin-top:0">
        Set a new password for a user account by user ID.
      </p>

      <form id="adminResetPasswordForm" class="grid" style="gap:12px">
        <div class="grid cols-3" style="gap:12px">
          <div>
            <label class="small" for="adminResetPasswordUserId">User ID</label>
            <input
              id="adminResetPasswordUserId"
              name="user_id"
              type="number"
              min="1"
              step="1"
              required
            />
          </div>

          <div>
            <label class="small" for="adminResetPasswordNewPassword">New Password</label>
            <input
              id="adminResetPasswordNewPassword"
              name="new_password"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>

          <div>
            <label class="small" for="adminResetPasswordConfirmPassword">Confirm Password</label>
            <input
              id="adminResetPasswordConfirmPassword"
              name="confirm_password"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>
        </div>

        <label class="small" style="display:flex;gap:8px;align-items:flex-start">
          <input id="adminResetPasswordClearSessions" name="clear_sessions" type="checkbox" checked />
          <span>Clear the user’s other sessions after resetting the password</span>
        </label>

        <div id="adminResetPasswordMessage" class="small" style="display:none"></div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" type="submit" id="adminResetPasswordSubmitButton">
            Reset Password
          </button>
        </div>
      </form>
    `;

    mountEl.appendChild(card);

    const form = document.getElementById("adminResetPasswordForm");
    if (form) {
      form.addEventListener("submit", handleSubmit);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const userIdEl = document.getElementById("adminResetPasswordUserId");
    const newPasswordEl = document.getElementById("adminResetPasswordNewPassword");
    const confirmPasswordEl = document.getElementById("adminResetPasswordConfirmPassword");
    const clearSessionsEl = document.getElementById("adminResetPasswordClearSessions");
    const submitButton = document.getElementById("adminResetPasswordSubmitButton");
    const form = document.getElementById("adminResetPasswordForm");

    const user_id = Number(userIdEl?.value || 0);
    const new_password = String(newPasswordEl?.value || "");
    const confirm_password = String(confirmPasswordEl?.value || "");
    const clear_sessions = !!clearSessionsEl?.checked;

    if (!Number.isInteger(user_id) || user_id <= 0) {
      setMessage("A valid user ID is required.", true);
      return;
    }

    if (!new_password) {
      setMessage("New password is required.", true);
      return;
    }

    if (new_password.length < 8) {
      setMessage("New password must be at least 8 characters.", true);
      return;
    }

    if (new_password !== confirm_password) {
      setMessage("Passwords do not match.", true);
      return;
    }

    const originalText = submitButton?.textContent || "Reset Password";

    try {
      setMessage("Resetting password...");

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Resetting...";
      }

      const response = await window.DDAuth.apiFetch("/api/admin/reset-password", {
        method: "POST",
        body: JSON.stringify({
          user_id,
          new_password,
          confirm_password,
          clear_sessions
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to reset password.");
      }

      if (form) {
        form.reset();
      }

      const clearBox = document.getElementById("adminResetPasswordClearSessions");
      if (clearBox) {
        clearBox.checked = true;
      }

      setMessage(
        `Password reset successfully for ${data?.user?.email || `user #${user_id}`}.`
      );

      document.dispatchEvent(new CustomEvent("dd:user-updated", {
        detail: {
          action: "password_reset",
          user: data?.user || null
        }
      }));
    } catch (error) {
      setMessage(error.message || "Failed to reset password.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  document.addEventListener("dd:admin-ready", (event) => {
    if (!event?.detail?.ok) return;
    renderUi();
  });

  renderUi();
});
