// File: /public/js/auth.js
// Brief description: Shared client-side auth helper for the site. It stores the session token,
// mirrors it into a first-party cookie for same-site continuity, exposes login/register/logout/account
// methods, and provides the authenticated apiFetch wrapper used across public, member, and admin flows.

(function () {
  const TOKEN_KEY = "dd_auth_token";
  const USER_KEY = "dd_auth_user";
  const TOKEN_COOKIE = "dd_auth_token";
  const USER_COOKIE = "dd_auth_user";
  const TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function getCookie(name) {
    try {
      const safeName = String(name || "").trim();
      if (!safeName) return "";
      const parts = String(document.cookie || "").split(/;\s*/);
      for (const part of parts) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        const key = part.slice(0, eq).trim();
        if (key !== safeName) continue;
        return decodeURIComponent(part.slice(eq + 1));
      }
    } catch {}
    return "";
  }

  function setCookie(name, value, maxAgeSeconds = TOKEN_COOKIE_MAX_AGE) {
    try {
      const safeName = String(name || "").trim();
      if (!safeName) return;
      const encoded = encodeURIComponent(String(value || ""));
      if (!value) {
        document.cookie = `${safeName}=; path=/; max-age=0; SameSite=Lax`;
        return;
      }
      document.cookie = `${safeName}=${encoded}; path=/; max-age=${Number(maxAgeSeconds || 0)}; SameSite=Lax`;
    } catch {}
  }

  function getToken() {
    try {
      const fromLocal = normalizeText(localStorage.getItem(TOKEN_KEY));
      if (fromLocal) return fromLocal;
    } catch {}
    return normalizeText(getCookie(TOKEN_COOKIE));
  }

  function setToken(token) {
    const safeToken = normalizeText(token);
    try {
      if (safeToken) localStorage.setItem(TOKEN_KEY, safeToken);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setCookie(TOKEN_COOKIE, safeToken, safeToken ? TOKEN_COOKIE_MAX_AGE : 0);
    return safeToken;
  }

  function getStoredUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      const parsed = JSON.parse(raw || 'null');
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    try {
      const raw = getCookie(USER_COOKIE);
      const parsed = JSON.parse(raw || 'null');
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {}
    return null;
  }

  function setStoredUser(user) {
    try {
      if (user && typeof user === 'object') localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch {}
    try {
      if (user && typeof user === 'object') setCookie(USER_COOKIE, JSON.stringify({
        user_id: Number(user.user_id || 0),
        email: user.email || '',
        display_name: user.display_name || '',
        role: user.role || 'member'
      }), TOKEN_COOKIE_MAX_AGE);
      else setCookie(USER_COOKIE, '', 0);
    } catch {}
    return user || null;
  }

  function clearAuth() {
    setToken('');
    setStoredUser(null);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { ...options, headers, credentials: 'same-origin' });
    if (response.status === 401 && !String(url).includes('/api/auth/login')) {
      clearAuth();
      document.dispatchEvent(new CustomEvent('dd:auth-changed', { detail: { ok: false, logged_in: false, user: null } }));
    }
    return response;
  }

  async function parseJson(response) {
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Request failed.');
    return data;
  }

  async function handleAuthResponse(response, successFallback) {
    const data = await parseJson(response);
    const token = normalizeText(data?.session_token) || normalizeText(data?.token) || normalizeText(data?.session?.session_token) || normalizeText(data?.session?.token);
    if (!token && successFallback !== 'allow-no-token') throw new Error('Authentication succeeded but no session token was returned.');
    if (token) setToken(token);
    setStoredUser(data?.user || null);
    document.dispatchEvent(new CustomEvent('dd:auth-changed', { detail: { ok: true, logged_in: !!token, user: data?.user || null } }));
    return data;
  }

  async function login(email, password) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: normalizeText(email).toLowerCase(), password: String(password || '') })
    });
    return handleAuthResponse(response);
  }

  async function register(payload) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        email: normalizeText(payload?.email).toLowerCase(),
        display_name: normalizeText(payload?.display_name),
        password: String(payload?.password || ''),
        password_confirm: String(payload?.password_confirm || '')
      })
    });
    return handleAuthResponse(response);
  }

  async function logout() {
    try {
      const response = await apiFetch('/api/auth/logout', { method: 'POST' });
      await response.json().catch(() => null);
    } finally {
      clearAuth();
      document.dispatchEvent(new CustomEvent('dd:auth-changed', { detail: { ok: true, logged_in: false, user: null } }));
    }
    return { ok: true };
  }

  async function logoutAll() {
    const response = await apiFetch('/api/auth/logout-all', { method: 'POST' });
    const data = await parseJson(response);
    clearAuth();
    document.dispatchEvent(new CustomEvent('dd:auth-changed', { detail: { ok: true, logged_in: false, user: null } }));
    return data;
  }

  async function me() {
    const response = await apiFetch('/api/auth/me', { method: 'GET' });
    const data = await parseJson(response);
    setStoredUser(data?.user || null);
    return data;
  }

  async function changePassword(current_password, new_password) {
    const response = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: String(current_password || ''), new_password: String(new_password || '') })
    });
    return parseJson(response);
  }

  async function fetchSessionInfo() {
    const response = await apiFetch('/api/auth/session-info', { method: 'GET' });
    return parseJson(response);
  }

  async function fetchBootstrapStatus() {
    const response = await fetch('/api/auth/bootstrap-status', { method: 'GET', credentials: 'same-origin' });
    return parseJson(response);
  }

  async function bootstrapAdmin(payload) {
    const response = await fetch('/api/auth/bootstrap-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        email: normalizeText(payload?.email).toLowerCase(),
        display_name: normalizeText(payload?.display_name),
        password: String(payload?.password || ''),
        password_confirm: String(payload?.password_confirm || ''),
        bootstrap_token: normalizeText(payload?.bootstrap_token)
      })
    });
    return handleAuthResponse(response);
  }

  window.DDAuth = {
    getToken,
    setToken,
    getStoredUser,
    setStoredUser,
    clearAuth,
    isLoggedIn,
    apiFetch,
    login,
    register,
    logout,
    logoutAll,
    me,
    changePassword,
    fetchSessionInfo,
    fetchBootstrapStatus,
    bootstrapAdmin
  };
})();
