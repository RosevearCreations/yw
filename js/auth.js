/* File: js/auth.js
   Brief description: Shared authentication controller that coordinates Supabase auth with bootstrap state,
   exposes sign-in/logout/reset/password-change helpers, and keeps the app informed of current user/profile/role state.
   This version avoids hanging getSession()/refreshSession() calls during onboarding and account setup.
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
    return String(
      getRuntimeConfig().SB_URL ||
      getRuntimeConfig().SUPABASE_URL ||
      window.YWI_BOOT?.state?.supabaseUrl ||
      'https://jmqvkgiqlimdhcofwkxr.supabase.co'
    ).trim();
  }

  function getSupabaseAnonKey() {
    return String(
      getRuntimeConfig().SB_ANON_KEY ||
      getRuntimeConfig().SUPABASE_ANON_KEY ||
      window.__SUPABASE_ANON_KEY ||
      localStorage.getItem('ywi_supabase_anon_key') ||
      ''
    ).trim();
  }

  function getAccountFunctionUrl() {
    return `${getSupabaseUrl()}/functions/v1/account-maintenance`;
  }

  function getAccountCompatibilityUrl() {
    return `${window.location.origin}/api/auth/account-maintenance`;
  }

  async function postAccountMaintenance(body, { token = '', allowFallback = true } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(getSupabaseAnonKey() ? { apikey: getSupabaseAnonKey() } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const response = await fetch(getAccountFunctionUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (response.status !== 404 || !allowFallback) return response;

    return fetch(getAccountCompatibilityUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
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
    return `${window.location.origin}/#settings`;
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

  function withTimeout(promise, ms, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
    ]);
  }

  async function fetchProfile(userId) {
    if (!userId || !sb) return null;
    try {
      const { data, error } = await withTimeout(
        sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
        5000,
        'Profile lookup timed out.'
      );
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
    const username = safeText(state.profile?.username);
    const passwordReady = state.profile?.password_login_ready === true;
    const setupComplete = !!state.profile?.account_setup_completed_at;
    state.needsAccountSetup = !!(
      state.isAuthenticated &&
      (!username || !passwordReady || !setupComplete)
    );
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

  async function getStableSession() {
    const client = requireClient();
    const { data, error } = await withTimeout(
      client.auth.getSession(),
      5000,
      'Session read timed out.'
    );
    if (error) throw error;
    return data?.session || null;
  }

  async function refreshFromSupabase() {
    const session = await getStableSession();
    await applySession(session);
    state.authError = boot?.state?.authError || state.authError || '';
    state.authFlow = 'password';
    state.pendingAuthResolution = false;
    return state.session;
  }

  async function resolveLoginIdentifier(login) {
    const cleanLogin = safeText(login);
    if (!cleanLogin || cleanLogin.includes('@')) return cleanLogin;
    try {
      const res = await postAccountMaintenance({ action: 'resolve_login_identifier', login: cleanLogin });
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
    const { error } = await client.auth.resetPasswordForEmail(resolvedEmail, { redirectTo: getRedirectUrl() + '#onboarding' });
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
    const { data, error } = await withTimeout(
      client.auth.updateUser({ password: cleanPassword }),
      8000,
      'Password update timed out.'
    );
    if (error) throw error;

    await refreshFromSupabase().catch(() => null);
    state.authFlow = 'password';
    state.pendingAuthResolution = false;
    dispatch('ywi:auth-changed', { state: getState() });
    return data;
  }

  async function markAccountSetupComplete(payload = {}) {
    const client = requireClient();

    let session = await getStableSession().catch(() => null);
    let token = session?.access_token || '';

    if (!token) {
      const refreshed = await withTimeout(
        client.auth.refreshSession(),
        8000,
        'Session refresh timed out.'
      ).catch(() => ({ data: { session: null } }));
      token = refreshed?.data?.session?.access_token || '';
    }

    if (!token) throw new Error('Sign in again before finishing account setup.');

    const response = await withTimeout(
      postAccountMaintenance({ action: 'complete_account_setup', ...payload }, { token }),
      10000,
      'Account setup request timed out.'
    );

    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || 'Unable to finish account setup.');

    state.authFlow = 'password';
    state.pendingAuthResolution = false;
    state.needsAccountSetup = false;

    await refreshFromSupabase().catch(() => {
      state.needsAccountSetup = false;
      state.pendingAuthResolution = false;
      state.profile = {
        ...(state.profile || {}),
        ...(body?.record || {}),
        password_login_ready: true,
        onboarding_completed_at: body?.record?.onboarding_completed_at || new Date().toISOString(),
        account_setup_completed_at: body?.record?.account_setup_completed_at || new Date().toISOString()
      };
      state.role = state.profile?.role || state.role || 'worker';
      state.roleLabel = getRoleLabel(state.role);
      state.isAuthenticated = true;
    });

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
    try {
      const session = await getStableSession();
      await applySession(session);
      state.authError = boot?.state?.authError || state.authError || '';
      state.authFlow = boot?.state?.authFlow || state.authFlow || 'idle';
      state.pendingAuthResolution = false;
      dispatch('ywi:auth-changed', { state: getState() });
      return session;
    } catch {
      state.pendingAuthResolution = false;
      dispatch('ywi:auth-changed', { state: getState() });
      return state.session || null;
    }
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
        await refreshFromSupabase().catch(() => null);
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
