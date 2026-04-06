/* File: js/bootstrap.js
   Brief description: Shared bootstrap/auth recovery layer.
   Restores Supabase sessions from PKCE code, token hash, or existing storage,
   preserves route fragments safely, cleans callback URLs, and exposes boot/auth header helpers to the app.
   Includes safer live-session header retrieval and more forgiving auth resolution timing.
*/

'use strict';

(function () {
  const DEFAULT_SUPABASE_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co';
  const AUTH_RESOLUTION_TIMEOUT_MS = 25000;

  function getRuntimeConfig() {
    return window.YWI_RUNTIME_CONFIG || window.__YWI_RUNTIME_CONFIG || {};
  }

  function readConfiguredSupabaseUrl() {
    const cfg = getRuntimeConfig();
    return String(
      cfg.SB_URL ||
      cfg.SUPABASE_URL ||
      window.SB_URL ||
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
        cfg.SB_ANON_KEY ||
        cfg.SUPABASE_ANON_KEY ||
        window.SB_ANON_KEY ||
        window.SUPABASE_ANON_KEY ||
        window.__SUPABASE_ANON_KEY ||
        localStorage.getItem('ywi_supabase_anon_key') ||
        ''
      ).trim();
      return isPlaceholderKey(candidate) ? '' : candidate;
    } catch {
      const candidate = String(
        cfg.SB_ANON_KEY ||
        cfg.SUPABASE_ANON_KEY ||
        window.SB_ANON_KEY ||
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
    role: 'employee',
    roleLabel: 'Employee',
    isAuthenticated: false,
    lastRouteHash: '#toolbox',
    configError: '',
    supabaseUrl: readConfiguredSupabaseUrl(),
    hasSupabaseKey: false,
    pendingAuthResolution: false,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    needsAccountSetup: false,
    identityKey: ''
  };

  function dispatch(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function emitTiming(scope, startedAt, extra = {}) {
    const start = Number(startedAt || performance.now());
    const end = performance.now();
    const detail = {
      scope,
      duration_ms: Number((end - start).toFixed(2)),
      started_at_ms: start,
      finished_at_ms: end,
      at: new Date().toISOString(),
      ...extra
    };
    window.dispatchEvent(new CustomEvent('ywi:timing', { detail }));
    return detail;
  }

  function safeText(value) {
    return String(value ?? '').trim();
  }

  function roleRank(role) {
    const clean = String(role || '').trim().toLowerCase();
    const map = { employee: 10, worker: 10, staff: 10, onsite_admin: 18, site_leader: 20, supervisor: 30, hse: 40, job_admin: 45, admin: 50 };
    return map[clean] || 0;
  }

  function normalizeRole(role, profile = null, user = null) {
  const clean = String(role || '').trim().toLowerCase();
  const tier = String(profile?.staff_tier || user?.user_metadata?.staff_tier || '').trim().toLowerCase();
  if (clean === 'worker' || clean === 'staff') return 'employee';
  if (clean) return clean;
  if (tier === 'admin') return 'admin';
  if (tier === 'supervisor') return 'supervisor';
  if (tier === 'employee' || tier === 'worker' || tier === 'staff') return 'employee';
  return 'employee';
}

function getRoleLabel(role) {
    const map = {
      worker: 'Employee',
      employee: 'Employee',
      staff: 'Employee',
      onsite_admin: 'Onsite Admin',
      job_admin: 'Job Admin',
      site_leader: 'Site Leader',
      supervisor: 'Supervisor',
      hse: 'HSE',
      admin: 'Admin'
    };
    return map[role] || role || 'Employee';
  }

  function getEffectiveRole(profile = null, user = null) {
    const candidates = [
      normalizeRole(profile?.role, profile, user),
      normalizeRole(profile?.staff_tier, profile, user),
      normalizeRole(user?.user_metadata?.role, profile, user),
      normalizeRole(user?.user_metadata?.staff_tier, profile, user),
      normalizeRole(user?.app_metadata?.role, profile, user),
      normalizeRole(user?.app_metadata?.staff_tier, profile, user)
    ].filter(Boolean);
    return candidates.sort((a, b) => roleRank(b) - roleRank(a))[0] || 'employee';
  }

  function clearResolvedState() {
    state.session = null;
    state.user = null;
    state.profile = null;
    state.role = 'employee';
    state.roleLabel = 'Employee';
    state.isAuthenticated = false;
    state.needsAccountSetup = false;
    state.identityKey = '';
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
    if (url.hash && isAuthParamBlock(url.hash.replace(/^#/, ''))) {
      candidates.push(parseQueryStringLike(url.hash));
    }

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
    try {
      const sb = window.YWI_SB || window._sb;
      if (sb?.auth?.getSession) {
        const { data } = await sb.auth.getSession();
        const token = data?.session?.access_token || state.session?.access_token || '';
        return token ? { Authorization: `Bearer ${token}` } : {};
      }
    } catch {}
    const token = state.session?.access_token || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
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
      state.authError = state.authError || 'Session restore took too long. You can sign in again below.';
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
    emitTiming('bootstrap.init', initStartedAt, { ok: true, isAuthenticated: !!state.isAuthenticated, needsAccountSetup: !!state.needsAccountSetup });
    dispatch('ywi:boot-ready', { state: getState() });
  }

  async function fetchProfile(userId, sb) {
    if (!userId || !sb) return null;
    try {
      const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
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

  let applySessionVersion = 0;

  async function applySession(session, authError = '', authFlow = state.authFlow, sb = window.YWI_SB) {
    const currentVersion = ++applySessionVersion;
    state.session = session || null;
    state.user = session?.user || null;
    state.authError = authError || '';
    state.authFlow = authFlow || 'idle';
    state.isAuthenticated = !!session?.access_token;
    state.identityKey = state.user?.id || '';

    if (!state.user?.id) {
      clearResolvedState();
      state.authError = authError || '';
      state.authFlow = authFlow || 'idle';
      return;
    }

    const fetchedProfile = await fetchProfile(state.user.id, sb);
    if (currentVersion != applySessionVersion) return;

    state.profile = fetchedProfile || null;
    state.role = getEffectiveRole(state.profile, state.user);
    state.roleLabel = getRoleLabel(state.role);
    const username = String(state.profile?.username || state.user?.user_metadata?.username || state.user?.app_metadata?.username || '').trim();
    const passwordReady = state.profile?.password_login_ready === true;
    const onboardingComplete = !!(state.profile?.onboarding_completed_at || state.profile?.account_setup_completed_at);
    state.needsAccountSetup = !!(
      state.isAuthenticated &&
      !onboardingComplete &&
      (!username || !passwordReady || !state.profile?.account_setup_completed_at)
    );
  }

  async function refresh() {
    if (!window.YWI_SB?.auth?.refreshSession) {
      throw new Error(state.configError || 'Supabase is not configured.');
    }
    const { data, error } = await window.YWI_SB.auth.refreshSession();
    if (error) throw error;
    await applySession(data?.session || null, '', state.authFlow || 'session', window.YWI_SB);
    return data?.session || null;
  }

  async function recoverSessionFromUrlIfNeeded(sb) {
    const { params, routeHash } = extractAuthContext();
    state.lastRouteHash = normalizeHashCandidate(routeHash) || '#toolbox';
    const authFlow = safeText(params.type).toLowerCase() || 'signin';

    if (hasAuthCode(params)) {
      const { data, error } = await sb.auth.exchangeCodeForSession(params.code);
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
      const { data, error } = await sb.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token
      });
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

    const { data } = await sb.auth.getSession();
    await applySession(data?.session || null, '', 'idle', sb);
    if (!window.location.hash && state.isAuthenticated) {
      cleanUrlAfterAuth(routeHash || '#toolbox');
    }
  }

  async function init() {
    const initStartedAt = performance.now();
    if (state.initialized) return;
    state.pendingAuthResolution = true;
    startAuthResolutionTimer();

    const anonKey = readStoredAnonKey();
    state.hasSupabaseKey = !!anonKey;

    if (!window.supabase?.createClient) {
      return finishWithoutClient('Supabase library did not load. Refresh the app. If it still fails, clear the service worker cache and try again.');
    }

    if (!anonKey) {
      emitTiming('bootstrap.init', initStartedAt, { ok: false, message: 'App configuration is incomplete.' });
      return finishWithoutClient('App configuration is incomplete. Add the Supabase anon/public key to js/app-config.js or use the emergency login-screen override, then reload the app.');
    }

    const sb = window.supabase.createClient(state.supabaseUrl || readConfiguredSupabaseUrl(), anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
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
    state.pendingAuthResolution = false;
    state.initialized = true;
    dispatch('ywi:boot-ready', { state: getState() });
  });
})();
