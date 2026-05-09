// File: /public/js/members.js
// Brief description: Handles the members page shell. It fills the visible profile/status
// fields from the authenticated session, shows access messaging when the user is not signed in,
// and keeps the member dashboard synchronized with the shared auth UI events.

document.addEventListener("DOMContentLoaded", () => {
  const accessMessageEl = document.getElementById("membersAccessMessage");
  const membersSectionEl = document.getElementById("membersSection");

  function setAccessMessage(message, isError = false) {
    if (!accessMessageEl) return;

    accessMessageEl.textContent = message;
    accessMessageEl.style.display = message ? "block" : "none";
    accessMessageEl.style.color = isError ? "#b00020" : "";
  }

  function showMembersSection(show) {
    if (!membersSectionEl) return;
    membersSectionEl.style.display = show ? "" : "none";
  }

  function setAll(selector, value) {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value;
    });
  }

  function titleCase(value) {
    const text = String(value || "").trim();
    if (!text) return "—";

    return text
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
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

  function getSafeName(user) {
    const displayName = String(user?.display_name || "").trim();
    const email = String(user?.email || "").trim();

    if (displayName) return displayName;
    if (email) return email;
    return "Member";
  }

  function renderSignedOut() {
    setAll("[data-member-name]", "Member");
    setAll("[data-member-email]", "—");
    setAll("[data-member-role]", "—");
    setAll("[data-member-status]", "Signed Out");
    setAll("[data-member-created-at]", "—");
    setAll("[data-member-updated-at]", "—");
    setAll("[data-member-session-expires]", "—");

    setAccessMessage("Please log in to access your member area.", true);
    showMembersSection(false);
  }

  function renderSignedIn(user, session = null) {
    const role = String(user?.role || "").trim().toLowerCase();
    const status = Number(user?.is_active || 0) === 1 ? "Active" : "Inactive";

    setAll("[data-member-name]", getSafeName(user));
    setAll("[data-member-email]", user?.email || "—");
    setAll("[data-member-role]", titleCase(role || "member"));
    setAll("[data-member-status]", status);
    setAll("[data-member-created-at]", formatDate(user?.created_at));
    setAll("[data-member-updated-at]", formatDate(user?.updated_at));
    setAll("[data-member-session-expires]", formatDate(session?.expires_at));

    setAccessMessage("");
    showMembersSection(true);
  }

  document.addEventListener("dd:members-ready", (event) => {
    const ok = !!event?.detail?.ok;
    const user = event?.detail?.user || null;
    const session = event?.detail?.session || null;

    if (!ok || !user) {
      renderSignedOut();
      return;
    }

    renderSignedIn(user, session);
  });

  document.addEventListener("dd:member-access-ready", (event) => {
    const ok = !!event?.detail?.ok;
    const user = event?.detail?.user || null;
    const session = event?.detail?.session || null;

    if (!ok || !user) {
      renderSignedOut();
      return;
    }

    renderSignedIn(user, session);
  });

  renderSignedOut();
});
