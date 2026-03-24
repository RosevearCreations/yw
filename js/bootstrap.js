/* File: js/bootstrap.js
   Brief description: Shared bootstrap/auth recovery layer.
   Restores Supabase sessions from PKCE code, token hash, or existing storage,
   preserves route fragments safely, cleans callback URLs, and exposes boot/auth header helpers to the app.
*/

'use strict';

(function () {
  const SUPABASE_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co';
  const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY ||
    window.__SUPABASE_ANON_KEY ||
    '';

  if (!window.supabase?.createClient) {
    console.error('Supabase library is not loaded.');
    return;
  }

  if (!SUPABASE_ANON_KEY) {
    console.error('Missing Supabase anon key.');
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  window.YWI_SB = sb;
  window._sb = sb;

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
    lastRouteHash: '#toolbox'
  };

  function dispatch(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function safeText(value) {
    return String(value ?? '').trim();
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

  async function fetchProfile(userId) {
    if (!userId) return null;
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

  async function applySession(session, authError = '', authFlow = state.authFlow) {
    state.session = session || null;
    state.user = session?.user || null;
    state.authError = authError || '';
    state.authFlow = authFlow || 'idle';
    state.isAuthenticated = !!session?.access_token;
    if (state.user?.id) state.profile = await fetchProfile(state.user.id);
    else state.profile = null;
    state.role = state.profile?.role || 'worker';
    state.roleLabel = getRoleLabel(state.role);
  }

  async function recoverSessionFromUrlIfNeeded() {
    const { params, routeHash } = extractAuthContext();
    state.lastRouteHash = normalizeHashCandidate(routeHash) || '#toolbox';
    const authFlow = safeText(params.type).toLowerCase() || 'signin';

    if (hasAuthCode(params)) {
      const { data, error } = await sb.auth.exchangeCodeForSession(params.code);
      if (error) {
        console.error('exchangeCodeForSession failed:', error.message);
        await applySession(null, error.message || params.error_description || '', authFlow);
        cleanUrlAfterAuth('#settings');
        return;
      }
      state.recoveredFromUrl = true;
      await applySession(data?.session || null, '', authFlow);
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
        await applySession(null, error.message || params.error_description || '', authFlow);
        cleanUrlAfterAuth('#settings');
        return;
      }
      state.recoveredFromUrl = true;
      await applySession(data?.session || null, '', authFlow);
      cleanUrlAfterAuth(getPostAuthHash(params, routeHash));
      return;
    }

    if (hasAuthError(params)) {
      const msg = params.error_description || params.error_code || params.error || 'Authentication failed.';
      await applySession(null, msg, authFlow);
      cleanUrlAfterAuth('#settings');
      return;
    }

    const { data } = await sb.auth.getSession();
    await applySession(data?.session || null, '', 'idle');
    if (!window.location.hash && state.isAuthenticated) cleanUrlAfterAuth(routeHash || '#toolbox');
  }

  async function authHeader() {
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function refresh() {
    const { data, error } = await sb.auth.refreshSession();
    if (error) throw error;
    await applySession(data?.session || null, '', 'refresh');
    return data?.session || null;
  }

  function getState() {
    return { ...state };
  }

  async function init() {
    if (state.initialized) return;
    await recoverSessionFromUrlIfNeeded();
    sb.auth.onAuthStateChange(async (event, session) => {
      const nextFlow = event === 'PASSWORD_RECOVERY' ? 'recovery' : (state.authFlow || 'session');
      await applySession(session || null, '', nextFlow);
      dispatch('ywi:auth-changed', { state: getState() });
    });
    state.initialized = true;
    dispatch('ywi:boot-ready', { state: getState() });
  }

  window.YWI_BOOT = { sb, state, init, getState, authHeader, refresh };

  init().catch((err) => {
    console.error('Bootstrap init failed:', err);
    state.authError = err?.message || 'Bootstrap failed.';
    dispatch('ywi:boot-ready', { state: getState() });
  });
})();
