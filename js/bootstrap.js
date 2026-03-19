'use strict';

/* =========================================================
   js/bootstrap.js
   YWI bootstrap / Supabase session recovery

   Purpose:
   - create shared Supabase client
   - recover auth session from normal or malformed callback URLs
   - handle magic-link token fragments even when URL contains
     both an error hash and a second token hash
   - expose shared boot helpers for the rest of the app
========================================================= */

(function () {
  const SUPABASE_URL = 'https://jmqvkgiqlimdhcofwkxr.supabase.co';
  const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY ||
    window.__SUPABASE_ANON_KEY ||
    '';

  if (!window.supabase || !window.supabase.createClient) {
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
      detectSessionInUrl: true
    }
  });

  window.YWI_SB = sb;
  window._sb = sb;

  const state = {
    initialized: false,
    recoveredFromUrl: false,
    authError: '',
    session: null,
    user: null,
    profile: null,
    role: 'worker',
    roleLabel: 'worker',
    isAuthenticated: false
  };

  function dispatch(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function safeText(value) {
    return String(value ?? '').trim();
  }

  function roleLabel(role) {
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

  function getAllHashSegments() {
    const href = window.location.href || '';
    const parts = href.split('#');
    return parts.length > 1 ? parts.slice(1) : [];
  }

  function extractBestAuthParams() {
    const href = window.location.href || '';
    const url = new URL(href);

    const results = [];

    if (url.hash) {
      results.push(parseQueryStringLike(url.hash));
    }

    getAllHashSegments().forEach((seg) => {
      results.push(parseQueryStringLike(seg));
    });

    if (url.search) {
      results.push(parseQueryStringLike(url.search));
    }

    let merged = {};
    for (const obj of results) {
      merged = { ...merged, ...obj };
    }

    return merged;
  }

  function hasTokenSet(obj) {
    return !!(obj && obj.access_token && obj.refresh_token);
  }

  function hasAuthError(obj) {
    return !!(obj && (obj.error || obj.error_code || obj.error_description));
  }

  function cleanUrlAfterAuth(targetHash = '#toolbox') {
    const clean = `${window.location.origin}${window.location.pathname}${targetHash}`;
    window.history.replaceState({}, document.title, clean);
  }

  async function fetchProfile(userId) {
    if (!userId) return null;

    try {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Profile lookup failed:', error.message);
        return null;
      }

      return data || null;
    } catch (err) {
      console.warn('Profile lookup threw error:', err);
      return null;
    }
  }

  async function refreshStateFromSession(session, authError = '') {
    state.session = session || null;
    state.user = session?.user || null;
    state.authError = authError || '';

    if (state.user?.id) {
      state.profile = await fetchProfile(state.user.id);
    } else {
      state.profile = null;
    }

    state.role = state.profile?.role || 'worker';
    state.roleLabel = roleLabel(state.role);
    state.isAuthenticated = !!session?.access_token;
  }

  async function recoverSessionFromUrlIfNeeded() {
    const params = extractBestAuthParams();
    const tokenPresent = hasTokenSet(params);
    const authErrorPresent = hasAuthError(params);

    if (tokenPresent) {
      const { data, error } = await sb.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token
      });

      if (error) {
        console.error('setSession failed:', error.message);
        await refreshStateFromSession(null, error.message || params.error_description || '');
        return;
      }

      state.recoveredFromUrl = true;
      await refreshStateFromSession(data?.session || null, '');

      cleanUrlAfterAuth('#toolbox');
      return;
    }

    if (authErrorPresent) {
      const msg =
        params.error_description ||
        params.error_code ||
        params.error ||
        'Authentication failed.';
      await refreshStateFromSession(null, msg);
      return;
    }

    const { data } = await sb.auth.getSession();
    await refreshStateFromSession(data?.session || null, '');
  }

  async function authHeader() {
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function refresh() {
    const { data, error } = await sb.auth.refreshSession();
    if (error) throw error;
    await refreshStateFromSession(data?.session || null, '');
    return data?.session || null;
  }

  async function init() {
    if (state.initialized) return;

    await recoverSessionFromUrlIfNeeded();

    sb.auth.onAuthStateChange(async (_event, session) => {
      await refreshStateFromSession(session || null, '');
      dispatch('ywi:auth-changed', {
        state: { ...state }
      });
    });

    state.initialized = true;

    dispatch('ywi:boot-ready', {
      state: { ...state }
    });
  }

  window.YWI_BOOT = {
    sb,
    state,
    init,
    authHeader,
    refresh
  };

  init().catch((err) => {
    console.error('Bootstrap init failed:', err);
    dispatch('ywi:boot-ready', {
      state: { ...state, authError: err?.message || 'Bootstrap failed.' }
    });
  });
})();
