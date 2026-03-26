/* File: js/auth.js
   Brief description: Shared authentication controller that coordinates Supabase auth with bootstrap state,
   exposes sign-in/logout/reset/password-change helpers, and keeps the app informed of current user/profile/role state.
   Falls back to a readable configuration state when Supabase is not yet configured so the login screen still renders.
*/

'use strict';

(function () {
  const boot = window.YWI_BOOT || null;
  const security = window.YWISecurity || null;
  let sb = window.YWI_SB || window._sb || null;
  function getRuntimeConfig() {
    return window.YWI_RUNTIME_CONFIG || window.__YWI_RUNTIME_CONFIG || {};
  }

  function getSupabaseUrl() {
    return String(getRuntimeConfig().SUPABASE_URL || window.YWI_BOOT?.state?.supabaseUrl || 'https://jmqvkgiqlimdhcofwkxr.supabase.co').trim();
  }

  function getAccountFunctionUrl() {
    return `${getSupabaseUrl()}/functions/v1/account-maintenance`;
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
    isAuthenticated: false,
    authError: '',
    authFlow: 'idle',
    configError: boot?.state?.configError || '',
    needsAccountSetup: false
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
    if (security?.getRoleLabel) return security.getRoleLabel(role);
    const map = {
      worker: 'Worker',
      staff: 'Employee',
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
    if (!userId || !sb) return null;
    try {
      const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) return null;
      return data || null;
    } catch {
      return null;
    }
  }

  async function applySession(session) {
    state.session = session || null;
    state.user = session?.user || null;
    state.isAuthenticated = !!session?.access_token;
    if (state.user?.id) state.profile = await fetchProfile(state.user.id);
    else state.profile = null;
    state.role = state.profile?.role || 'worker';
    state.roleLabel = getRoleLabel(state.role);
    state.needsAccountSetup = !!(state.isAuthenticated && (state.authFlow === 'recovery' || state.profile?.password_login_ready === false || !safeText(state.profile?.username)));
    state.pendingAuthResolution = !state.bootReady && !state.isAuthenticated;
  }

  function applyBootState(bootState = {}) {
    state.session = bootState.session || null;
    state.user = bootState.user || bootState.session?.user || null;
    state.profile = bootState.profile || null;
    state.role = bootState.role || state.profile?.role || 'worker';
    state.roleLabel = bootState.roleLabel || getRoleLabel(state.role);
    state.isAuthenticated = !!bootState.isAuthenticated;
    state.authError = bootState.authError || '';
    state.authFlow = bootState.authFlow || state.authFlow || 'idle';
    state.configError = bootState.configError || state.configError || '';
    state.needsAccountSetup = !!bootState.needsAccountSetup;
    state.bootReady = true;
    state.pendingAuthResolution = false;
  }

  function requireClient() {
    sb = window.YWI_SB || window._sb || sb || null;
    if (!sb) throw new Error(state.configError || boot?.state?.configError || 'Supabase is not configured.');
    return sb;
  }

  async function refreshFromSupabase() {
    const client = requireClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    await applySession(data?.session || null);
    state.authError = boot?.state?.authError || state.authError || '';
    state.authFlow = boot?.state?.authFlow || state.authFlow || 'idle';
    return state.session;
  }


  async function resolveLoginIdentifier(login) {
    const cleanLogin = safeText(login);
    if (!cleanLogin || cleanLogin.includes('@')) return cleanLogin;
    try {
      const res = await fetch(getAccountFunctionUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_login_identifier', login: cleanLogin })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Unable to resolve login identifier.');
      return safeText(payload?.email || cleanLogin);
    } catch (err) {
      throw new Error(err?.message || 'Unable to resolve username.');
    }
  }

  async function signInWithMagicLink(email) {
    const cleanEmail = safeText(email);
    if (!cleanEmail) throw new Error('Email is required.');
    const client = requireClient();
    const { error } = await client.auth.signInWithOtp({
      email: cleanEmail,
      options: { emailRedirectTo: getRedirectUrl(), shouldCreateUser: false }
    });
    if (error) throw error;
    return true;
  }

  async function signInWithPassword(email, password) {
    const cleanLogin = safeText(email);
    const cleanPassword = String(password ?? '');
    if (!cleanLogin || !cleanPassword) throw new Error('Email/username and password are required.');
    const resolvedEmail = await resolveLoginIdentifier(cleanLogin);
    const client = requireClient();
    const { data, error } = await client.auth.signInWithPassword({ email: resolvedEmail, password: cleanPassword });
    if (error) throw error;
    await applySession(data?.session || null);
    state.authError = '';
    state.authFlow = boot?.state?.authFlow || state.authFlow || 'idle';
    state.pendingAuthResolution = false;
    dispatch('ywi:auth-changed', { state: getState() });
    return data;
  }

  async function resetPassword(email) {
    const cleanEmail = safeText(email);
    if (!cleanEmail) throw new Error('Email or username is required.');
    const resolvedEmail = await resolveLoginIdentifier(cleanEmail);
    const client = requireClient();
    const { error } = await client.auth.resetPasswordForEmail(resolvedEmail, { redirectTo: getRedirectUrl() + '#settings' });
    if (error) throw error;
    return true;
  }

  async function resendEmailVerification(emailOverride) {
    const email = safeText(emailOverride || state.profile?.email || state.user?.email || '');
    if (!email) throw new Error('Email is required.');
    const client = requireClient();
    const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: getRedirectUrl() } });
    if (error) throw error;
    return true;
  }

  async function changePassword(newPassword) {
    const cleanPassword = String(newPassword ?? '');
    if (!cleanPassword) throw new Error('New password is required.');
    const client = requireClient();
    const { data, error } = await client.auth.updateUser({ password: cleanPassword });
    if (error) throw error;
    await refreshFromSupabase();
    dispatch('ywi:auth-changed', { state: getState() });
    return data;
  }


  async function markAccountSetupComplete(payload = {}) {
    const client = requireClient();
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Sign in again before finishing account setup.');
    const response = await fetch(getAccountFunctionUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'complete_account_setup', ...payload })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || 'Unable to finish account setup.');
    await refreshFromSupabase();
    dispatch('ywi:auth-changed', { state: getState() });
    return body;
  }

  async function logout(scope = 'local') {
    const signOutScope = scope === 'global' ? 'global' : 'local';
    const client = requireClient();
    const { error } = await client.auth.signOut({ scope: signOutScope });
    if (error) throw error;
    await applySession(null);
    state.pendingAuthResolution = false;
    dispatch('ywi:auth-changed', { state: getState() });
    return true;
  }

  async function logoutEverywhere() {
    return logout('global');
  }

  async function refresh() {
    const client = requireClient();
    const { data, error } = await client.auth.refreshSession();
    if (error) throw error;
    await applySession(data?.session || null);
    state.authError = boot?.state?.authError || state.authError || '';
    state.authFlow = boot?.state?.authFlow || state.authFlow || 'idle';
    state.pendingAuthResolution = false;
    dispatch('ywi:auth-changed', { state: getState() });
    return data?.session || null;
  }

  async function saveRuntimeConfig({ anonKey } = {}) {
    const clean = safeText(anonKey);
    if (!clean) throw new Error('Supabase anon/public key is required.');
    localStorage.setItem('ywi_supabase_anon_key', clean);
    window.__SUPABASE_ANON_KEY = clean;
    return true;
  }

  function clearRuntimeConfig() {
    localStorage.removeItem('ywi_supabase_anon_key');
    window.__SUPABASE_ANON_KEY = '';
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
    sb = window.YWI_SB || window._sb || sb || null;
    if (!sb?.auth?.onAuthStateChange) return;
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
    try {
      if (window.YWI_SB || window._sb) {
        await refreshFromSupabase();
        if (boot?.state?.initialized) {
          state.bootReady = true;
          state.pendingAuthResolution = false;
        }
      } else {
        state.pendingAuthResolution = false;
        state.bootReady = !!boot?.state;
        state.authError = boot?.state?.authError || '';
        state.configError = boot?.state?.configError || state.configError || '';
      }
    } catch (err) {
      state.pendingAuthResolution = false;
      state.authError = err?.message || 'Authentication init failed.';
      state.configError = state.authError;
    }
    state.initialized = true;
    dispatch('ywi:auth-changed', { state: getState() });
  }

  window.YWI_AUTH = {
    init,
    getState,
    refresh,
    signInWithMagicLink,
    signInWithPassword,
    resetPassword,
    resendEmailVerification,
    changePassword,
    markAccountSetupComplete,
    logout,
    logoutEverywhere,
    saveRuntimeConfig,
    clearRuntimeConfig
  };

  init().catch((err) => {
    console.error('Auth init failed:', err);
    state.pendingAuthResolution = false;
    state.authError = err?.message || 'Auth init failed.';
    dispatch('ywi:auth-changed', { state: getState() });
  });
})();
