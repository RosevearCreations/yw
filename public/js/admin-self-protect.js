// File: /public/js/admin-self-protect.js
// Brief description: Protects the admin dashboard on the client side. It checks auth state,
// redirects non-admin or signed-out users to login with a next return path, and prevents
// the admin area from flashing before the shared auth UI finishes resolving the current session.

document.addEventListener("DOMContentLoaded", () => {
  const accessMessageEl = document.getElementById("adminAccessMessage");

  if (!window.DDAuth) return;

  let resolved = false;

  function setAccessMessage(message, isError = false) {
    if (!accessMessageEl) return;
    accessMessageEl.textContent = message;
    accessMessageEl.style.display = message ? "block" : "none";
    accessMessageEl.style.color = isError ? "#b00020" : "";
  }

  function redirectToLogin() {
    const next = `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`;
    const url = new URL("/login/", window.location.origin);
    url.searchParams.set("next", next);
    window.location.href = url.toString();
  }

  function handleAllowed(user) {
    resolved = true;
    setAccessMessage("");

    document.dispatchEvent(new CustomEvent("dd:admin-access-granted", {
      detail: {
        ok: true,
        user: user || null
      }
    }));
  }

  function handleDenied(message = "Please log in with an admin account to access this page.") {
    if (resolved) return;
    resolved = true;
    setAccessMessage(message, true);
    redirectToLogin();
  }

  if (!window.DDAuth.isLoggedIn()) {
    handleDenied();
    return;
  }

  document.addEventListener("dd:admin-ready", (event) => {
    const ok = !!event?.detail?.ok;
    const user = event?.detail?.user || null;

    if (!ok || !user) {
      handleDenied();
      return;
    }

    const role = String(user.role || "").trim().toLowerCase();

    if (role !== "admin") {
      handleDenied("Your account does not have access to the admin dashboard.");
      return;
    }

    handleAllowed(user);
  });

  document.addEventListener("dd:auth-ready", (event) => {
    if (resolved) return;

    const loggedIn = !!event?.detail?.logged_in;
    const user = event?.detail?.user || null;

    if (!loggedIn || !user) {
      handleDenied();
    }
  });

  setTimeout(() => {
    if (resolved) return;

    if (!window.DDAuth.isLoggedIn()) {
      handleDenied();
    }
  }, 1200);
});
