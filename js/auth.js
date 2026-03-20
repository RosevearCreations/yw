'use strict';

/* =========================================================
   js/auth.js
   Shared authentication controller

   Purpose:
   - coordinate Supabase auth with bootstrap state
   - expose a simple shared auth API for UI + app shell
   - support magic link, password sign-in, reset, refresh, and logout
========================================================= */

(function () {
  const sb = window.YWI_SB || window._sb || null;
  const boot = window.YWI_BOOT || null;

  if (!sb) {
    console.error('Auth module could not find Supabase client.');
    return;
  }

  const state = {
    initialized: false,
    bootReady: false,
    pendingAuthResolution: true,
    session: null,
    user: null,
    profile: null,
    role: 'worker',
    roleLabel: 'Worker',
    isAuthenticated: false
  };

  function dispatch(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function safeText(value) {
    return String(value ?? '').trim();
  }

  function getRedirectUrl() {
    return `${window.location.origin}/`;
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
      console.warn('Profile lookup error:', err);
      return null;
    }
  }

  async function applySession(session) {
    state.session = session || null;
    state.user = session?.user || null;
    state.isAuthenticated = !!session?.access_token;

    if (state.user?.id) {
      state.profile = await fetchProfile(state.user.id);
    } else {
      state.profile = null;
    }

    state.role = state.profile?.role || 'worker';
    state.roleLabel = getRoleLabel(state.role);
    state.pendingAuthResolution = !state.bootReady && !state.isAuthenticated;
  }

  function applyBootState(bootState = {}) {
    state.session = bootState.session || null;
    state.user = bootState.user || bootState.session?.user || null;
    state.profile = bootState.profile || null;
    state.role = bootState.role || state.profile?.role || 'worker';
    state.roleLabel = bootState.roleLabel || getRoleLabel(state.role);
    state.isAuthenticated = !!bootState.isAuthenticated;
    state.bootReady = true;
    state.pendingAuthResolution = false;
  }

  async function refreshFromSupabase() {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    await applySession(data?.session || null);
    return state.session;
  }

  async function signInWithMagicLink(email) {
    const cleanEmail = safeText(email);
    if (!cleanEmail) {
      throw new Error('Email is required.');
    }

    const { error } = await sb.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: getRedirectUrl(),
        shouldCreateUser: false
      }
    });

    if (error) throw error;
    return true;
  }

  async function signInWithPassword(email, password) {
    const cleanEmail = safeText(email);
    const cleanPassword = String(password ?? '');

    if (!cleanEmail || !cleanPassword) {
      throw new Error('Email and password are required.');
    }

    const { data, error } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword
    });

    if (error) throw error;

    await applySession(data?.session || null);
    state.pendingAuthResolution = false;

    dispatch('ywi:auth-changed', { state: getState() });
    return data;
  }

  async function resetPassword(email) {
    const cleanEmail = safeText(email);
    if (!cleanEmail) {
      throw new Error('Email is required.');
    }

    const { error } = await sb.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: getRedirectUrl()
    });

    if (error) throw error;
    return true;
  }

  async function logout() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;

    await applySession(null);
    state.pendingAuthResolution = false;

    dispatch('ywi:auth-changed', { state: getState() });
    return true;
  }

  async function refresh() {
    const { data, error } = await sb.auth.refreshSession();
    if (error) throw error;

    await applySession(data?.session || null);
    state.pendingAuthResolution = false;

    dispatch('ywi:auth-changed', { state: getState() });
    return data?.session || null;
  }

  function getState() {
    return { ...state };
  }

  function bindBootEvents() {
    document.addEventListener('ywi:boot-ready', async (e) => {
      const bootState = e.detail?.state || {};

      applyBootState(bootState);

      if (!state.profile && state.user?.id) {
        state.profile = await fetchProfile(state.user.id);
        state.role = state.profile?.role || state.role || 'worker';
        state.roleLabel = getRoleLabel(state.role);
      }

      dispatch('ywi:auth-changed', { state: getState() });
    });
  }

  function bindSupabaseAuthEvents() {
    sb.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session || null);

      if (boot?.state?.initialized || state.bootReady) {
        state.pendingAuthResolution = false;
        dispatch('ywi:auth-changed', { state: getState() });
      }
    });
  }

  async function init() {
    if (state.initialized) return;

    bindBootEvents();
    bindSupabaseAuthEvents();

    await refreshFromSupabase();

    if (boot?.state?.initialized) {
      state.bootReady = true;
      state.pendingAuthResolution = false;
    }

    state.initialized = true;
  }

  window.YWI_AUTH = {
    init,
    getState,
    refresh,
    signInWithMagicLink,
    signInWithPassword,
    resetPassword,
    logout
  };

  init().catch((err) => {
    console.error('Auth init failed:', err);
  });
})();
