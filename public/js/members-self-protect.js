// File: /public/js/members-self-protect.js
// Brief description: Protects the members page on the client side. It checks auth state,
// redirects signed-out users to login with a next return path, and prevents the member
// area from flashing before the shared auth UI finishes loading.

document.addEventListener("DOMContentLoaded", () => {
  const membersSectionEl = document.getElementById("membersSection");
  const accessMessageEl = document.getElementById("membersAccessMessage");

  if (!window.DDAuth) return;

  let resolved = false;

  function showMembersSection(show) {
    if (!membersSectionEl) return;
    membersSectionEl.style.display = show ? "" : "none";
  }

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
    showMembersSection(true);
    setAccessMessage("");
    document.dispatchEvent(new CustomEvent("dd:member-access-granted", {
      detail: {
        ok: true,
        user: user || null
      }
    }));
  }

  function handleDenied(message = "Please log in to access your member area.") {
    if (resolved) return;
    resolved = true;
    showMembersSection(false);
    setAccessMessage(message, true);
    redirectToLogin();
  }

  showMembersSection(false);

  if (!window.DDAuth.isLoggedIn()) {
    handleDenied();
    return;
  }

  document.addEventListener("dd:member-access-ready", (event) => {
    const ok = !!event?.detail?.ok;
    const user = event?.detail?.user || null;

    if (!ok || !user) {
      handleDenied();
      return;
    }

    const role = String(user.role || "").trim().toLowerCase();

    if (!["member", "admin"].includes(role)) {
      handleDenied("Your account does not have access to the member area.");
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
