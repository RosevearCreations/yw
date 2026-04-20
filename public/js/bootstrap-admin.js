// File: /public/js/bootstrap-admin.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bootstrapAdminForm");
  const emailEl = document.getElementById("bootstrapEmail");
  const displayNameEl = document.getElementById("bootstrapDisplayName");
  const passwordEl = document.getElementById("bootstrapPassword");
  const confirmPasswordEl = document.getElementById("bootstrapConfirmPassword");
  const tokenEl = document.getElementById("bootstrapToken");
  const messageEl = document.getElementById("bootstrapMessage");
  const submitButton = document.getElementById("bootstrapSubmitButton");
  const statusWrapEl = document.getElementById("bootstrapStatusWrap");
  const formWrapEl = document.getElementById("bootstrapFormWrap");

  function setMessage(message, isError = false) {
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.style.display = message ? "block" : "none";
    messageEl.style.color = isError ? "#b00020" : "";
  }

  function show(el) {
    if (el) el.style.display = "";
  }

  function hide(el) {
    if (el) el.style.display = "none";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  async function checkBootstrapStatus() {
    try {
      setMessage("Checking bootstrap status...");

      const data = await window.DDAuth.fetchBootstrapStatus();
      const bootstrapRequired = !!data?.bootstrap_required;

      if (!bootstrapRequired) {
        hide(formWrapEl);
        show(statusWrapEl);
        setMessage("Bootstrap is already complete. An active admin already exists.");
        return false;
      }

      show(formWrapEl);
      if (statusWrapEl) {
        statusWrapEl.innerHTML = `
          <div class="small">
            No active admin account was found. Create the first admin account below.
          </div>
        `;
        statusWrapEl.style.display = "";
      }
      setMessage("");
      return true;
    } catch (error) {
      hide(formWrapEl);
      show(statusWrapEl);
      setMessage(error.message || "Could not verify bootstrap status.", true);
      return false;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!window.DDAuth) {
      setMessage("Authentication tools are not available.", true);
      return;
    }

    const email = String(emailEl?.value || "").trim().toLowerCase();
    const display_name = String(displayNameEl?.value || "").trim();
    const password = String(passwordEl?.value || "");
    const password_confirm = String(confirmPasswordEl?.value || "");
    const bootstrap_token = String(tokenEl?.value || "").trim();

    if (!email) {
      setMessage("Email is required.", true);
      return;
    }

    if (!isValidEmail(email)) {
      setMessage("Please enter a valid email address.", true);
      return;
    }

    if (!password) {
      setMessage("Password is required.", true);
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.", true);
      return;
    }

    if (password !== password_confirm) {
      setMessage("Passwords do not match.", true);
      return;
    }

    const originalText = submitButton?.textContent || "Create First Admin";

    try {
      setMessage("Creating first admin...");

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Creating...";
      }

      const result = await window.DDAuth.bootstrapAdmin({
        email,
        display_name,
        password,
        password_confirm,
        bootstrap_token
      });

      const token =
        String(result?.session_token || "").trim() ||
        String(result?.token || "").trim() ||
        String(result?.session?.session_token || "").trim() ||
        String(result?.session?.token || "").trim();

      if (!token) {
        throw new Error("Admin was created but no session token was returned.");
      }

      window.DDAuth.setToken(token);
      window.DDAuth.setStoredUser(result?.user || null);

      setMessage("First admin created successfully.");
      document.dispatchEvent(new CustomEvent("dd:auth-changed", {
        detail: { ok: true, logged_in: true, user: result?.user || null }
      }));

      window.location.href = "/admin/";
    } catch (error) {
      setMessage(error.message || "Bootstrap failed.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  if (form) {
    form.addEventListener("submit", handleSubmit);
  }

  checkBootstrapStatus();
});
