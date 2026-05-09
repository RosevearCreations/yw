// File: /public/js/login.js
// Brief description: Handles the login page flow. It validates the login form,
// submits credentials through the shared auth helper, stores the returned session,
// and redirects the user into the correct protected area after sign-in.

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("loginEmail");
  const passwordEl = document.getElementById("loginPassword");
  const messageEl = document.getElementById("loginMessage");
  const submitButton = document.getElementById("loginSubmitButton");

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
    const password = String(passwordEl?.value || "");

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

    const originalText = submitButton?.textContent || "Login";

    try {
      setMessage("Signing you in...");

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Signing In...";
      }

      const result = await window.DDAuth.login(email, password);
      const user = result?.user || null;

      document.dispatchEvent(new CustomEvent("dd:auth-changed", {
        detail: {
          ok: true,
          logged_in: true,
          user
        }
      }));

      setMessage("Login successful.");
      window.location.href = getRedirectTarget(user);
    } catch (error) {
      setMessage(error.message || "Login failed.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  form.addEventListener("submit", handleSubmit);
});
