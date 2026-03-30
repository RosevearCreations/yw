/* File: js/bootstrap.js
   Brief description: Shared bootstrap/auth recovery layer.
   Restores Supabase sessions from PKCE code, token hash, or existing storage,
   preserves route fragments safely, cleans callback URLs, and exposes boot/auth header helpers to the app.
   Now supports local runtime anon-key storage so the login screen can always render a usable config error instead of a blank wall.
*/

'use strict';

(function () {
  const DEFAULT_SUPABASE_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co';
  const AUTH_RESOLUTION_TIMEOUT_MS = 12000;
  const SUPABASE_AUTH_CALL_TIMEOUT_MS = 5000;
  const PROFILE_LOOKUP_TIMEOUT_MS = 5000;

  function getRuntimeConfig() {
    return window.YWI_RUNTIME_CONFIG || window.__YWI_RUNTIME_CONFIG || {};
  }

  function readConfiguredSupabaseUrl() {
    const cfg = getRuntimeConfig();
    return String(
      cfg.SUPABASE_URL ||
      window.SUPABASE_URL ||
      DEFAULT_SUPABASE_URL
    ).trim() || DEFAULT_SUPABASE_URL;
  }

  function isPlaceholderKey(value) {
    const clean = String(value || '').trim();
    if (!clean) return true;
    return /PASTE_SUPABASE_ANON_PUBLIC_KEY_HERE|YOUR_SUPABASE_ANON_KEY|__SUPABASE_ANON_KEY__|changeme/i.test(clean);
  }

  function readStoredAnonKey() {
    const cfg = getRuntimeConfig();
    try {
      const candidate = String(
        cfg.SUPABASE_ANON_KEY ||
        window.SUPABASE_ANON_KEY ||
        window.__SUPABASE_ANON_KEY ||
        localStorage.getItem('ywi_supabase_anon_key') ||
        ''
      ).trim();
      return isPlaceholderKey(candidate) ? '' : candidate;
    } catch {
      const candidate = String(
        cfg.SUPABASE_ANON_KEY ||
        window.SUPABASE_ANON_KEY ||
        window.__SUPABASE_ANON_KEY ||
        ''
      ).trim();
      return isPlaceholderKey(candidate) ? '' : candidate;
    }
  }

  const state = {
    initialized: false,
    recoveredFromUrl: false,
    authError: '',
    authFlow: 'idle',
    session: null,
    user: null,
    profile: null,
    role: 'worker',
    roleLabel: 'Worker',
    isAuthenticated: false,
    lastRouteHash: '#toolbox',
    configError: '',
    supabaseUrl: readConfiguredSupabaseUrl(),
    hasSupabaseKey: false,
    pendingAuthResolution: false,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    needsAccountSetup: false
  };

  function dispatch(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function safeText(value) {
    return String(value ?? '').trim();
  }

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message || `Timed out after ${timeoutMs} ms.`)), timeoutMs))
    ]);
  }

  function getRoleLabel(role) {
    const map = {
      worker: 'Worker',
      staff: 'Staff',
      onsite_admin: 'Onsite Admin',
      job_admin: 'Job Admin',
      site_leader: 'Site Leader',
      supervisor: 'Supervisor',
      hse: 'HSE',
      admin: 'Admin'
    };
    return map[role] || role || 'Worker';
  }

  function getState() {
    return { ...state };
  }

  function parseQueryStringLike(str) {
    const out = {};
    const source = safeText(str).replace(/^[?#&]+/, '');
    if (!source) return out;
    source.split('&').forEach((pair) => {
      if (!pair) return;
      const idx = pair.indexOf('=');
      const key = idx >= 0 ? pair.slice(0, idx) : pair;
      const val = idx >= 0 ? pair.slice(idx + 1) : '';
      out[decodeURIComponent(key)] = decodeURIComponent(val.replace(/\+/g, ' '));
    });
    return out;
  }

  function isAuthParamBlock(text) {
    return /(^|&)(access_token|refresh_token|expires_at|expires_in|token_type|type|error|error_code|error_description|code)=/i.test(String(text || ''));
  }

  function normalizeHashCandidate(value) {
    const clean = String(value || '').replace(/^#+/, '').trim();
    if (!clean || isAuthParamBlock(clean)) return '';
    const first = clean.split('&')[0].split('?')[0].trim();
    const normalized = first.replace(/[^a-zA-Z0-9_-]/g, '');
    return normalized ? `#${normalized}` : '';
  }

  function extractAuthContext() {
    const href = window.location.href || '';
    const url = new URL(href);
    const fragments = href.split('#').slice(1);
    const candidates = [];
    let routeHash = normalizeHashCandidate(url.hash);

    if (url.search) candidates.push(parseQueryStringLike(url.search));
    if (url.hash && isAuthParamBlock(url.hash.replace(/^#/, ''))) candidates.push(parseQueryStringLike(url.hash));

    fragments.forEach((fragment) => {
      const clean = String(fragment || '').trim();
      if (!clean) return;
      if (isAuthParamBlock(clean)) {
        candidates.push(parseQueryStringLike(clean));
      } else if (!routeHash) {
        routeHash = normalizeHashCandidate(clean);
      }
    });

    const params = candidates.reduce((acc, obj) => ({ ...acc, ...obj }), {});
    return { params, routeHash: routeHash || state.lastRouteHash || '#toolbox' };
  }

  function hasTokenSet(params) {
    return !!(params?.access_token && params?.refresh_token);
  }

  function hasAuthCode(params) {
    return !!safeText(params?.code);
  }

  function hasAuthError(params) {
    return !!(params?.error || params?.error_code || params?.error_description);
  }

  function getPostAuthHash(params = {}, fallbackHash = '#toolbox') {
    const type = safeText(params.type).toLowerCase();
    if (type === 'recovery') return '#settings';
    return normalizeHashCandidate(fallbackHash) || '#toolbox';
  }

  function cleanUrlAfterAuth(targetHash = '#toolbox') {
    const cleanHash = normalizeHashCandidate(targetHash) || '#toolbox';
    state.lastRouteHash = cleanHash;
    const clean = `${window.location.origin}${window.location.pathname}${cleanHash}`;
    window.history.replaceState({}, document.title, clean);
  }

  async function authHeader() {
    const token = state.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function refresh() {
    if (!window.YWI_SB?.auth?.refreshSession) throw new Error(state.configError || 'Supabase is not configured.');
    const { data, error } = await window.YWI_SB.auth.refreshSession();
    if (error) throw error;
    state.session = data?.session || null;
    state.user = state.session?.user || null;
    state.isAuthenticated = !!state.session?.access_token;
    return data?.session || null;
  }

  let authResolutionTimer = null;

  function clearAuthResolutionTimer() {
    if (authResolutionTimer) {
      clearTimeout(authResolutionTimer);
      authResolutionTimer = null;
    }
  }

  function startAuthResolutionTimer() {
    clearAuthResolutionTimer();
    authResolutionTimer = setTimeout(() => {
      if (!state.pendingAuthResolution) return;
      console.warn('Auth restore timed out. Falling back to the regular sign-in screen.');
      state.pendingAuthResolution = false;
      state.recoveredFromUrl = false;
      state.session = null;
      state.user = null;
      state.profile = null;
      state.isAuthenticated = false;
      state.authFlow = 'idle';
      state.authError = state.authError || 'Session restore took too long. The sign-in form is ready below. Hard refresh once if cached files are stale, then sign in again.';
      state.initialized = true;
      dispatch('ywi:app-error', { scope: 'auth-restore', message: state.authError });
      dispatch('ywi:boot-ready', { state: getState(), timedOut: true });
    }, AUTH_RESOLUTION_TIMEOUT_MS);
  }

  window.YWI_BOOT = { sb: null, state, init, getState, authHeader, refresh };

  function updateConnectivityState() {
    state.isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    dispatch('ywi:connectivity-changed', { offline: !!state.isOffline, state: getState() });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', updateConnectivityState);
    window.addEventListener('offline', updateConnectivityState);
    window.addEventListener('error', (event) => {
      const message = event?.error?.message || event?.message || 'Unexpected application error.';
      console.error('Global error:', message, event?.error || event);
      dispatch('ywi:app-error', { scope: 'window', message });
    });
    window.addEventListener('unhandledrejection', (event) => {
      const message = event?.reason?.message || String(event?.reason || 'Unhandled promise rejection.');
      console.error('Unhandled promise rejection:', event?.reason || message);
      dispatch('ywi:app-error', { scope: 'promise', message });
    });
  }
  updateConnectivityState();

  async function finishWithoutClient(message) {
    clearAuthResolutionTimer();
    state.initialized = true;
    state.pendingAuthResolution = false;
    state.authError = message || state.authError || '';
    if (message) state.configError = message;
    dispatch('ywi:boot-ready', { state: getState() });
  }

  async function fetchProfile(userId, sb) {
    if (!userId || !sb) return null;
    try {
      const { data, error } = await withTimeout(
        sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
        PROFILE_LOOKUP_TIMEOUT_MS,
        'Profile lookup timed out.'
      );
      if (error) {
        console.warn('Profile lookup failed:', error.message);
        return null;
      }
      return data || null;
    } catch (err) {
      console.warn('Profile lookup error:', err);
      return null;
    }
  }

  async function applySession(session, authError = '', authFlow = state.authFlow, sb = window.YWI_SB) {
    state.session = session || null;
    state.user = session?.user || null;
    state.authError = authError || '';
    state.authFlow = authFlow || 'idle';
    state.isAuthenticated = !!session?.access_token;
    if (state.user?.id) state.profile = await fetchProfile(state.user.id, sb);
    else state.profile = null;
    state.role = state.profile?.role || 'worker';
    state.roleLabel = getRoleLabel(state.role);
    state.needsAccountSetup = !!(state.isAuthenticated && (state.authFlow === 'recovery' || state.profile?.password_login_ready === false || !String(state.profile?.username || '').trim()));
  }

  async function recoverSessionFromUrlIfNeeded(sb) {
    const { params, routeHash } = extractAuthContext();
    state.lastRouteHash = normalizeHashCandidate(routeHash) || '#toolbox';
    const authFlow = safeText(params.type).toLowerCase() || 'signin';

    if (hasAuthCode(params)) {
      const { data, error } = await withTimeout(
        sb.auth.exchangeCodeForSession(params.code),
        SUPABASE_AUTH_CALL_TIMEOUT_MS,
        'Session restore from email link timed out.'
      );
      if (error) {
        console.error('exchangeCodeForSession failed:', error.message);
        await applySession(null, error.message || params.error_description || '', authFlow, sb);
        cleanUrlAfterAuth('#settings');
        return;
      }
      state.recoveredFromUrl = true;
      await applySession(data?.session || null, '', authFlow, sb);
      cleanUrlAfterAuth(getPostAuthHash(params, routeHash));
      return;
    }

    if (hasTokenSet(params)) {
      const { data, error } = await withTimeout(sb.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token
      }),
        SUPABASE_AUTH_CALL_TIMEOUT_MS,
        'Session restore from tokens timed out.'
      );
      if (error) {
        console.error('setSession failed:', error.message);
        await applySession(null, error.message || params.error_description || '', authFlow, sb);
        cleanUrlAfterAuth('#settings');
        return;
      }
      state.recoveredFromUrl = true;
      await applySession(data?.session || null, '', authFlow, sb);
      cleanUrlAfterAuth(getPostAuthHash(params, routeHash));
      return;
    }

    if (hasAuthError(params)) {
      const msg = params.error_description || params.error_code || params.error || 'Authentication failed.';
      await applySession(null, msg, authFlow, sb);
      cleanUrlAfterAuth('#settings');
      return;
    }

    const { data } = await withTimeout(
      sb.auth.getSession(),
      SUPABASE_AUTH_CALL_TIMEOUT_MS,
      'Session check timed out.'
    );
    await applySession(data?.session || null, '', 'idle', sb);
    if (!window.location.hash && state.isAuthenticated) cleanUrlAfterAuth(routeHash || '#toolbox');
  }

  async function init() {
    if (state.initialized) return;
    state.pendingAuthResolution = true;
    startAuthResolutionTimer();
    const anonKey = readStoredAnonKey();
    state.hasSupabaseKey = !!anonKey;

    if (!window.supabase?.createClient) {
      return finishWithoutClient('Supabase library did not load. Refresh the app. If it still fails, clear the service worker cache and try again.');
    }
    if (!anonKey) {
      return finishWithoutClient('App configuration is incomplete. Add the Supabase anon/public key to js/app-config.js or use the emergency login-screen override, then reload the app.');
    }

    const sb = window.supabase.createClient(state.supabaseUrl || readConfiguredSupabaseUrl(), anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    window.YWI_SB = sb;
    window._sb = sb;
    window.YWI_BOOT.sb = sb;

    await recoverSessionFromUrlIfNeeded(sb);
    sb.auth.onAuthStateChange(async (event, session) => {
      const nextFlow = event === 'PASSWORD_RECOVERY' ? 'recovery' : (state.authFlow || 'session');
      await applySession(session || null, '', nextFlow, sb);
      dispatch('ywi:auth-changed', { state: getState() });
    });
    clearAuthResolutionTimer();
    state.pendingAuthResolution = false;
    state.initialized = true;
    dispatch('ywi:boot-ready', { state: getState() });
  }

  init().catch((err) => {
    console.error('Bootstrap init failed:', err);
    state.authError = err?.message || 'Bootstrap failed.';
    state.configError = state.authError;
    clearAuthResolutionTimer();
    clearAuthResolutionTimer();
    state.pendingAuthResolution = false;
    state.initialized = true;
    dispatch('ywi:boot-ready', { state: getState() });
  });
})();
