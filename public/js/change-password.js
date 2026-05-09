// File: /public/js/change-password.js
// Brief description: Handles the member change-password tool inside the members area.
// It renders a small password form, validates the inputs, submits through the shared
// auth helper, and gives clear success/error feedback without leaving the page.

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("memberAccountToolsMount");

  if (!mountEl || !window.DDAuth) return;

  let hasRendered = false;

  function setMessage(message, isError = false) {
    const el = document.getElementById("memberChangePasswordMessage");
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
      <h4 style="margin-top:0">Change Password</h4>
      <p class="small" style="margin-top:0">
        Update your password for this account.
      </p>

      <form id="memberChangePasswordForm" class="grid" style="gap:12px">
        <input
          id="memberChangePasswordUsername"
          name="username"
          type="email"
          autocomplete="username"
          hidden
          tabindex="-1"
          aria-hidden="true"
          value=""
        />

        <div>
          <label class="small" for="memberCurrentPassword">Current Password</label>
          <input
            id="memberCurrentPassword"
            name="current_password"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>

        <div>
          <label class="small" for="memberNewPassword">New Password</label>
          <input
            id="memberNewPassword"
            name="new_password"
            type="password"
            autocomplete="new-password"
            required
          />
        </div>

        <div>
          <label class="small" for="memberConfirmNewPassword">Confirm New Password</label>
          <input
            id="memberConfirmNewPassword"
            name="confirm_new_password"
            type="password"
            autocomplete="new-password"
            required
          />
        </div>

        <div id="memberChangePasswordMessage" class="small" style="display:none"></div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" type="submit" id="memberChangePasswordButton">
            Change Password
          </button>
        </div>
      </form>
    `;

    mountEl.appendChild(card);

    const form = document.getElementById("memberChangePasswordForm");
    if (form) {
      form.addEventListener("submit", handleSubmit);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const currentPasswordEl = document.getElementById("memberCurrentPassword");
    const newPasswordEl = document.getElementById("memberNewPassword");
    const confirmNewPasswordEl = document.getElementById("memberConfirmNewPassword");
    const usernameEl = document.getElementById("memberChangePasswordUsername");
    const button = document.getElementById("memberChangePasswordButton");
    const form = document.getElementById("memberChangePasswordForm");

    const current_password = String(currentPasswordEl?.value || "");
    const new_password = String(newPasswordEl?.value || "");
    const confirm_new_password = String(confirmNewPasswordEl?.value || "");

    if (!current_password) {
      setMessage("Current password is required.", true);
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

    if (new_password !== confirm_new_password) {
      setMessage("New passwords do not match.", true);
      return;
    }

    const originalText = button?.textContent || "Change Password";

    try {
      setMessage("Changing password...");

      if (button) {
        button.disabled = true;
        button.textContent = "Saving...";
      }

      const sessionInfo = await window.DDAuth.fetchSessionInfo().catch(() => null);
      const email = String(sessionInfo?.user?.email || "");
      if (usernameEl) {
        usernameEl.value = email;
      }

      await window.DDAuth.changePassword(current_password, new_password);

      if (form) {
        form.reset();
      }

      if (usernameEl) {
        usernameEl.value = email;
      }

      setMessage("Password changed successfully.");
    } catch (error) {
      setMessage(error.message || "Failed to change password.", true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  document.addEventListener("dd:members-ready", async (event) => {
    if (!event?.detail?.ok) return;
    renderUi();

    const usernameEl = document.getElementById("memberChangePasswordUsername");
    if (usernameEl) {
      usernameEl.value = String(event.detail?.user?.email || "");
    }
  });

  document.addEventListener("dd:member-access-ready", async (event) => {
    if (!event?.detail?.ok) return;
    renderUi();

    const usernameEl = document.getElementById("memberChangePasswordUsername");
    if (usernameEl) {
      usernameEl.value = String(event.detail?.user?.email || "");
    }
  });
});
