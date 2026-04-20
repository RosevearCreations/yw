// File: /public/js/register.js
// Brief description: Handles the registration page flow. It validates the registration form,
// submits the new account through the shared auth helper, stores the returned session when
// registration succeeds, and redirects the user into the member area or requested next page.

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const emailEl = document.getElementById("registerEmail");
  const displayNameEl = document.getElementById("registerDisplayName");
  const passwordEl = document.getElementById("registerPassword");
  const confirmPasswordEl = document.getElementById("registerConfirmPassword");
  const messageEl = document.getElementById("registerMessage");
  const submitButton = document.getElementById("registerSubmitButton");

  if (!form || !window.DDAuth) return;

  function setMessage(message, isError = false) {
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.style.display = message ? "block" : "none";
    messageEl.style.color = isError ? "#b00020" : "";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function getRedirectTarget(user) {
    const url = new URL(window.location.href);
    const next = String(url.searchParams.get("next") || "").trim();

    if (next.startsWith("/") && !next.startsWith("//")) {
      return next;
    }

    const role = String(user?.role || "").trim().toLowerCase();

    if (role === "admin") {
      return "/admin/";
    }

    return "/members/";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const email = String(emailEl?.value || "").trim().toLowerCase();
    const display_name = String(displayNameEl?.value || "").trim();
    const password = String(passwordEl?.value || "");
    const password_confirm = String(confirmPasswordEl?.value || "");

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

    const originalText = submitButton?.textContent || "Create Account";

    try {
      setMessage("Creating your account...");

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Creating...";
      }

      const result = await window.DDAuth.register({
        email,
        display_name,
        password,
        password_confirm
      });

      const user = result?.user || null;

      document.dispatchEvent(new CustomEvent("dd:auth-changed", {
        detail: {
          ok: true,
          logged_in: true,
          user
        }
      }));

      setMessage("Account created successfully.");
      window.location.href = getRedirectTarget(user);
    } catch (error) {
      setMessage(error.message || "Registration failed.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  form.addEventListener("submit", handleSubmit);
});
