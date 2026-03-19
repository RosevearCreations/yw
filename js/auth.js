'use strict';

/* =========================================================
   js/auth.js
   Shared authentication controller

   Purpose:
   - coordinate Supabase auth with bootstrap state
   - avoid showing logged-out UI before magic-link recovery finishes
   - support magic link, password sign-in, password reset, and logout
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
    state.roleLabel = roleLabel(state.role);
    state.pendingAuthResolution = !state.bootReady && !state.isAuthenticated;
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
    dispatch('ywi:auth-changed', { state: { ...state } });
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
    dispatch('ywi:auth-changed', { state: { ...state } });
    return true;
  }

  async function refresh() {
    const { data, error } = await sb.auth.refreshSession();
    if (error) throw error;

    await applySession(data?.session || null);
    dispatch('ywi:auth-changed', { state: { ...state } });
    return data?.session || null;
  }

  function getState() {
    return { ...state };
  }

  async function init() {
    if (state.initialized) return;

    document.addEventListener('ywi:boot-ready', async (e) => {
      const bootState = e.detail?.state || {};
      state.bootReady = true;

      await applySession(bootState.session || null);

      if (bootState.profile) {
        state.profile = bootState.profile;
        state.role = bootState.role || bootState.profile.role || 'worker';
        state.roleLabel = bootState.roleLabel || roleLabel(state.role);
      } else if (bootState.user?.id && !state.profile) {
        state.profile = await fetchProfile(bootState.user.id);
        state.role = state.profile?.role || bootState.role || 'worker';
        state.roleLabel = bootState.roleLabel || roleLabel(state.role);
      } else {
        state.role = bootState.role || state.role || 'worker';
        state.roleLabel = bootState.roleLabel || roleLabel(state.role);
      }

      state.user = bootState.user || state.user;
      state.session = bootState.session || state.session;
      state.isAuthenticated = !!(bootState.isAuthenticated ?? state.isAuthenticated);
      state.pendingAuthResolution = false;

      dispatch('ywi:auth-changed', { state: { ...state } });
    });

    sb.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session || null);

      if (boot?.state?.initialized || state.bootReady) {
        state.pendingAuthResolution = false;
        dispatch('ywi:auth-changed', { state: { ...state } });
      }
    });

    await refreshFromSupabase();
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
