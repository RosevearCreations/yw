// assets/admin-auth.js
//
// Shared frontend helper for staff auth/session.
//
// What this file does:
// - signs staff in through /api/admin/auth_login
// - signs staff out through /api/admin/auth_logout
// - loads current actor through /api/admin/auth_me
// - provides simple page guard helpers
// - provides simple role/capability checks for admin/detailer UI
//
// Notes:
// - this file is intentionally framework-free
// - it can be loaded by any admin/detailer page
// - it expects the backend auth/session files already added

(function attachAdminAuth(globalScope) {
  const API = {
    login: "/api/admin/auth_login",
    me: "/api/admin/auth_me",
    logout: "/api/admin/auth_logout"
  };

  const state = {
    actor: null,
    authenticated: false,
    loaded: false
  };

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      response
    };
  }

  async function loadCurrentActor() {
    const result = await requestJson(API.me, {
      method: "GET"
    });

    if (!result.ok && result.status >= 500) {
      throw new Error(
        (result.data && result.data.error) || "Could not load current staff session."
      );
    }

    const authenticated =
      !!result.data &&
      result.data.authenticated === true &&
      !!result.data.actor;

    state.actor = authenticated ? result.data.actor : null;
    state.authenticated = authenticated;
    state.loaded = true;

    return {
      authenticated: state.authenticated,
      actor: state.actor
    };
  }

  async function signIn({ email, password }) {
    const result = await requestJson(API.login, {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!result.ok) {
      throw new Error(
        (result.data && result.data.error) || "Sign-in failed."
      );
    }

    state.actor = result.data && result.data.actor ? result.data.actor : null;
    state.authenticated = !!state.actor;
    state.loaded = true;

    return {
      authenticated: state.authenticated,
      actor: state.actor
    };
  }

  async function signOut() {
    const result = await requestJson(API.logout, {
      method: "POST",
      body: JSON.stringify({})
    });

    state.actor = null;
    state.authenticated = false;
    state.loaded = true;

    if (!result.ok && result.status >= 500) {
      throw new Error(
        (result.data && result.data.error) || "Sign-out failed."
      );
    }

    return {
      authenticated: false,
      actor: null
    };
  }

  function getActor() {
    return state.actor;
  }

  function isAuthenticated() {
    return state.authenticated === true;
  }

  function hasRole(roleCode) {
    const actor = state.actor;
    if (!actor) return false;
    return String(actor.role_code || "").trim() === String(roleCode || "").trim();
  }

  function hasCapability(capability) {
    const actor = state.actor;
    if (!actor) return false;

    if (actor.is_admin === true) return true;

    const caps = actor.capabilities || {};

    switch (String(capability || "")) {
      case "can_override_lower_entries":
        return caps.can_override_lower_entries === true;
      case "can_manage_bookings":
        return caps.can_manage_bookings === true;
      case "can_manage_blocks":
        return caps.can_manage_blocks === true;
      case "can_manage_progress":
        return caps.can_manage_progress === true;
      case "can_manage_promos":
        return caps.can_manage_promos === true;
      case "can_manage_staff":
        return caps.can_manage_staff === true;
      default:
        return false;
    }
  }

  function canAccessPage(pageKey) {
    const actor = state.actor;
    if (!actor) return false;
    if (actor.is_admin === true) return true;

    switch (String(pageKey || "")) {
      case "admin":
      case "admin-booking":
        return hasCapability("can_manage_bookings");

      case "admin-blocks":
        return hasCapability("can_manage_blocks");

      case "admin-progress":
        return hasCapability("can_manage_progress") || actor.is_senior_detailer === true || actor.is_detailer === true;

      case "admin-jobsite":
        return (
          hasCapability("can_manage_bookings") ||
          hasCapability("can_manage_progress") ||
          actor.is_senior_detailer === true ||
          actor.is_detailer === true
        );

      case "admin-live":
        return (
          hasCapability("can_manage_bookings") ||
          hasCapability("can_manage_progress") ||
          actor.is_senior_detailer === true ||
          actor.is_detailer === true
        );

      case "admin-staff":
        return actor.is_admin === true || hasCapability("can_manage_staff");
      case "admin-app":
        return actor.is_admin === true || hasCapability("can_manage_staff");

      case "admin-catalog":
        return actor.is_admin === true || hasCapability("can_manage_staff");

      case "admin-customers":
        return hasCapability("can_manage_bookings");

      case "admin-notifications":
        return (
          hasCapability("can_manage_bookings") ||
          hasCapability("can_manage_progress") ||
          hasCapability("can_manage_staff")
        );

      case "admin-analytics":
        return actor.is_admin === true || hasCapability("can_manage_staff");

      case "admin-promos":
        return hasCapability("can_manage_promos");

      default:
        return false;
    }
  }

  async function requireAuth({
    redirectTo = "/admin-login",
    pageKey = null
  } = {}) {
    if (!state.loaded) {
      await loadCurrentActor();
    }

    if (!state.authenticated || !state.actor) {
      redirectWithReturn(redirectTo);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    if (pageKey && !canAccessPage(pageKey)) {
      redirectToSafeHome();
      return {
        ok: false,
        reason: "forbidden"
      };
    }

    return {
      ok: true,
      actor: state.actor
    };
  }

  function redirectWithReturn(path) {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const url = new URL(path, window.location.origin);
    url.searchParams.set("next", next);
    window.location.replace(url.toString());
  }

  function redirectToSafeHome() {
    window.location.replace("/admin");
  }

  function readNextUrl(fallback = "/admin") {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (!next) return fallback;

    // keep redirects same-origin and relative
    if (!next.startsWith("/")) return fallback;
    if (next.startsWith("//")) return fallback;

    return next;
  }

  function applyVisibility(root = document) {
    if (!root) return;

    const authOnly = root.querySelectorAll("[data-auth-only]");
    authOnly.forEach((node) => {
      node.hidden = !state.authenticated;
    });

    const guestOnly = root.querySelectorAll("[data-guest-only]");
    guestOnly.forEach((node) => {
      node.hidden = state.authenticated;
    });

    const roleNodes = root.querySelectorAll("[data-role]");
    roleNodes.forEach((node) => {
      const role = node.getAttribute("data-role");
      node.hidden = !hasRole(role);
    });

    const capabilityNodes = root.querySelectorAll("[data-capability]");
    capabilityNodes.forEach((node) => {
      const capability = node.getAttribute("data-capability");
      node.hidden = !hasCapability(capability);
    });

    const pageNodes = root.querySelectorAll("[data-page-access]");
    pageNodes.forEach((node) => {
      const pageKey = node.getAttribute("data-page-access");
      node.hidden = !canAccessPage(pageKey);
    });
  }

  function renderActorText(root = document) {
    if (!root) return;

    const nameNodes = root.querySelectorAll("[data-actor-name]");
    nameNodes.forEach((node) => {
      node.textContent = state.actor && state.actor.full_name ? state.actor.full_name : "";
    });

    const roleNodes = root.querySelectorAll("[data-actor-role]");
    roleNodes.forEach((node) => {
      node.textContent = state.actor ? humanizeRole(state.actor.role_code) : "";
    });

    const emailNodes = root.querySelectorAll("[data-actor-email]");
    emailNodes.forEach((node) => {
      node.textContent = state.actor && state.actor.email ? state.actor.email : "";
    });
  }

  function humanizeRole(roleCode) {
    switch (String(roleCode || "").trim()) {
      case "admin":
        return "Admin";
      case "senior_detailer":
        return "Senior Detailer";
      case "detailer":
        return "Detailer";
      default:
        return "Staff";
    }
  }

  function getState() {
    return {
      loaded: state.loaded,
      authenticated: state.authenticated,
      actor: state.actor
    };
  }

  globalScope.AdminAuth = {
    loadCurrentActor,
    signIn,
    signOut,
    getActor,
    getState,
    isAuthenticated,
    hasRole,
    hasCapability,
    canAccessPage,
    requireAuth,
    applyVisibility,
    renderActorText,
    readNextUrl,
    humanizeRole
  };
})(window);
