/* File: js/ui-auth.js
   Brief description: Authentication UI controller for password-first login,
   backup magic-link login, password reset, runtime app-config storage, and clean auth-wall handling.
*/

'use strict';

(function () {
  const auth = window.YWI_AUTH || null;
  if (!auth) {
    console.error('UI auth module could not find YWI_AUTH.');
    return;
  }

  const els = {
    loginView: document.getElementById('loginView'),
    authInfo: document.getElementById('authInfo'),
    whoami: document.getElementById('whoami'),
    headerSession: document.getElementById('headerSession'),
    headerSessionName: document.getElementById('headerSessionName'),
    headerLoginBtn: document.getElementById('headerLoginBtn'),
    headerSettingsLink: document.getElementById('headerSettingsLink'),
    headerLogoutBtn: document.getElementById('headerLogoutBtn'),
    authNotice: document.getElementById('authNotice'),
    authRestoreWarning: document.getElementById('authRestoreWarning'),
    offlineBanner: document.getElementById('offlineBanner'),
    authLoading: document.getElementById('authLoading'),
    magicForm: document.getElementById('magicLoginForm'),
    magicEmail: document.getElementById('magicLoginEmail'),
    magicBtn: document.getElementById('magicLoginBtn'),
    passwordForm: document.getElementById('passwordLoginForm'),
    passwordEmail: document.getElementById('passwordLoginEmail'),
    passwordPassword: document.getElementById('passwordLoginPassword'),
    passwordBtn: document.getElementById('passwordLoginBtn'),
    passwordForgotBtn: document.getElementById('passwordForgotBtn'),
    forgotEmailBtn: document.getElementById('forgotEmailBtn'),
    recoveryEmployeeNumber: document.getElementById('recoveryEmployeeNumber'),
    recoveryPhoneLast4: document.getElementById('recoveryPhoneLast4'),
    recoveryLastName: document.getElementById('recoveryLastName'),
    accountLookupBtn: document.getElementById('accountLookupBtn'),
    accountRecoverySendBtn: document.getElementById('accountRecoverySendBtn'),
    accountRecoveryResult: document.getElementById('accountRecoveryResult'),
    logoutBtn: document.getElementById('logoutBtn'),
    configPanel: document.getElementById('runtimeConfigPanel'),
    configForm: document.getElementById('runtimeConfigForm'),
    configAnonKey: document.getElementById('runtimeSupabaseAnonKey'),
    configSaveBtn: document.getElementById('runtimeConfigSaveBtn'),
    configClearBtn: document.getElementById('runtimeConfigClearBtn'),
    configStatus: document.getElementById('runtimeConfigStatus'),
    tabButtons: Array.from(document.querySelectorAll('[data-auth-tab]')),
    panels: Array.from(document.querySelectorAll('[data-auth-panel]')),
    headerNav: document.querySelector('.app-header nav'),
    appMain: document.querySelector('main.container')
  };

  const uiState = {
    activeTab: localStorage.getItem('ywi_auth_preferred_tab') || 'password',
    initialized: false
  };

  function setNotice(message = '', isError = false) {
    if (!els.authNotice) return;
    if (!message) {
      els.authNotice.style.display = 'none';
      els.authNotice.textContent = '';
      els.authNotice.dataset.kind = '';
      return;
    }
    els.authNotice.style.display = 'block';
    els.authNotice.textContent = message;
    els.authNotice.dataset.kind = isError ? 'error' : 'info';
  }


  function setRecoveryResult(message = '', isError = false) {
    if (!els.accountRecoveryResult) return;
    if (!message) {
      els.accountRecoveryResult.style.display = 'none';
      els.accountRecoveryResult.textContent = '';
      els.accountRecoveryResult.dataset.kind = '';
      return;
    }
    els.accountRecoveryResult.style.display = 'block';
    els.accountRecoveryResult.textContent = message;
    els.accountRecoveryResult.dataset.kind = isError ? 'error' : 'info';
  }

  function getRecoveryPayload() {
    return {
      employee_number: els.recoveryEmployeeNumber?.value?.trim?.() || '',
      phone_last4: els.recoveryPhoneLast4?.value?.trim?.() || '',
      last_name: els.recoveryLastName?.value?.trim?.() || ''
    };
  }

  function setConfigStatus(message = '', isError = false) {
    if (!els.configStatus) return;
    if (!message) {
      els.configStatus.style.display = 'none';
      els.configStatus.textContent = '';
      els.configStatus.dataset.kind = '';
      return;
    }
    els.configStatus.style.display = 'block';
    els.configStatus.textContent = message;
    els.configStatus.dataset.kind = isError ? 'error' : 'info';
  }


  function setRestoreWarning(message = '', isError = false) {
    if (!els.authRestoreWarning) return;
    if (!message) {
      els.authRestoreWarning.style.display = 'none';
      els.authRestoreWarning.textContent = '';
      els.authRestoreWarning.dataset.kind = '';
      return;
    }
    els.authRestoreWarning.style.display = 'block';
    els.authRestoreWarning.textContent = message;
    els.authRestoreWarning.dataset.kind = isError ? 'error' : 'info';
  }

  function syncOfflineBanner() {
    if (!els.offlineBanner) return;
    const offline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    els.offlineBanner.style.display = offline ? 'block' : 'none';
  }

  function getCacheOrRestoreMessage(state = {}) {
    const hasController = !!navigator.serviceWorker?.controller;
    if (state.pendingAuthResolution) {
      return 'Still restoring sign-in. If this does not clear in a moment, hard refresh the app. If the old wall keeps appearing, unregister the service worker and reload.';
    }
    if (!state.isAuthenticated && (state.authError || state.configError) && hasController) {
      return 'You may be viewing cached files or an auth callback was not restored cleanly. Hard refresh the app. If needed, unregister the service worker, reload, then sign in again.';
    }
    return '';
  }

  function setBusy(button, busyText) {
    if (!button) return () => {};
    const original = button.textContent;
    button.disabled = true;
    if (busyText) button.textContent = busyText;
    return () => {
      button.disabled = false;
      button.textContent = original;
    };
  }

  function setTab(tabName) {
    uiState.activeTab = tabName || 'password';
    try { localStorage.setItem('ywi_auth_preferred_tab', uiState.activeTab); } catch {}
    els.tabButtons.forEach((btn) => {
      const isActive = btn.getAttribute('data-auth-tab') === uiState.activeTab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    els.panels.forEach((panel) => {
      const isActive = panel.getAttribute('data-auth-panel') === uiState.activeTab;
      panel.hidden = !isActive;
      panel.style.display = isActive ? '' : 'none';
    });
  }

  function showLoading(show) {
    if (!els.authLoading) return;
    els.authLoading.classList.toggle('is-visible', !!show);
    els.authLoading.setAttribute('aria-busy', show ? 'true' : 'false');
  }


function syncAuthWall(state = {}) {
  const isAuthenticated = !!state.isAuthenticated;
  document.body.dataset.authenticated = isAuthenticated ? 'true' : 'false';
  document.body.dataset.authPending = state.pendingAuthResolution ? 'true' : 'false';
  if (els.headerNav) els.headerNav.style.display = isAuthenticated ? '' : 'none';
  if (els.appMain) els.appMain.style.display = isAuthenticated ? '' : 'none';
  if (els.authInfo) {
    if (isAuthenticated) {
      els.authInfo.hidden = false;
    } else {
      els.authInfo.hidden = true;
      els.authInfo.style.display = 'none';
    }
  }
}

  function syncHeader(state) {
    const profile = state?.profile || {};
    const user = state?.user || {};
    const displayName = profile.full_name || profile.email || user.email || 'Not signed in';
    if (els.headerSessionName) {
      els.headerSessionName.textContent = state?.isAuthenticated ? `${displayName} · ${state.roleLabel || state.role || 'User'}` : 'Not signed in';
    }
    if (els.headerLoginBtn) els.headerLoginBtn.style.display = state?.isAuthenticated ? 'none' : '';
    if (els.headerSettingsLink) els.headerSettingsLink.style.display = state?.isAuthenticated ? '' : 'none';
    if (els.headerLogoutBtn) els.headerLogoutBtn.style.display = state?.isAuthenticated ? '' : 'none';
    if (els.headerSession) els.headerSession.classList.toggle('hidden', !state?.isAuthenticated);
  }

  function render(state = auth.getState?.() || {}) {
    syncOfflineBanner();
    const isAuthenticated = !!state.isAuthenticated;
    syncHeader(state);
    syncAuthWall(state);
    if (els.whoami) {
      const profile = state.profile || {};
      const user = state.user || {};
      els.whoami.textContent = profile.full_name || profile.email || user.email || state.roleLabel || 'User';
    }

    showLoading(!!state.pendingAuthResolution);
    setRestoreWarning(getCacheOrRestoreMessage(state), !!(state.authError || state.configError));

    if (els.configPanel) {
      const showConfig = !!state.configError || !window.YWI_SB;
      els.configPanel.hidden = !showConfig;
      els.configPanel.style.display = showConfig ? '' : 'none';
      if (els.configAnonKey && !els.configAnonKey.value) {
        try { els.configAnonKey.value = localStorage.getItem('ywi_supabase_anon_key') || ''; } catch {}
      }
    }

    if (isAuthenticated) {
      if (els.loginView) els.loginView.style.display = 'none';
      if (els.authInfo) {
        els.authInfo.hidden = false;
        els.authInfo.style.display = '';
        const quick = document.getElementById('dashboardQuickLinks');
        if (quick) quick.style.display = '';
      }
      if (state.needsAccountSetup) {
        setNotice('Finish first-run onboarding now. Confirm your profile details, choose a username, and save a password.', true);
        if (window.YWIRouter?.showSection) window.YWIRouter.showSection('settings', { skipFocus: true });
      } else if (state.authFlow === 'recovery') {
        setNotice('Recovery link accepted. You can continue using the app normally.', false);
      } else if (state.recoveredFromUrl) {
        setNotice('Signed in successfully.', false);
      } else if (state.authError) {
        setNotice(state.authError, true);
      } else {
        setNotice('');
      }
      return;
    }

    if (els.loginView) els.loginView.style.display = '';
    if (els.authInfo) els.authInfo.hidden = true;

    if (state.configError) {
      setNotice(state.configError, true);
      setConfigStatus('Add the Supabase anon/public key to js/app-config.js for normal use. The save box below is only an emergency fallback.');
    } else if (state.authError) {
      setNotice(state.authError, true);
      setConfigStatus('');
    } else if (state.pendingAuthResolution) {
      setNotice('The login form is ready below even while the app finishes checking your session.', false);
      setConfigStatus('');
    } else {
      setNotice('Use username/email and password for daily sign-in. Magic link is only for first validation, backup access, or recovery. Normal deployments should load the Supabase key from js/app-config.js.', false);
      setConfigStatus('');
    }
  }

  async function onPasswordLogin(e) {
    e.preventDefault();
    const restore = setBusy(els.passwordBtn, 'Signing in...');
    try {
      setNotice('');
      await auth.signInWithPassword(els.passwordEmail?.value || '', els.passwordPassword?.value || '');
      if (els.passwordPassword) els.passwordPassword.value = '';
      setTab('password');
      if (window.YWIRouter?.showSection) window.YWIRouter.showSection('toolbox', { skipFocus: true });
    } catch (err) {
      setNotice(err?.message || 'Password sign-in failed.', true);
    } finally {
      restore();
    }
  }

  async function onForgotPassword() {
    const email = els.passwordEmail?.value?.trim?.() || els.magicEmail?.value?.trim?.() || '';
    const restore = setBusy(els.passwordForgotBtn, 'Sending reset...');
    try {
      await auth.resetPassword(email);
      setNotice('Password reset email sent. Open the newest email, let the app finish signing you in, then set your new password in Settings.', false);
    } catch (err) {
      setNotice(err?.message || 'Password reset failed.', true);
    } finally {
      restore();
    }
  }

  async function onMagicLogin(e) {
    e.preventDefault();
    const restore = setBusy(els.magicBtn, 'Sending link...');
    try {
      await auth.signInWithMagicLink(els.magicEmail?.value || '');
      setNotice('Magic link sent. Use it only for backup access, first-time validation, or recovery.', false);
      setTab('password');
    } catch (err) {
      setNotice(err?.message || 'Magic link sign-in failed.', true);
    } finally {
      restore();
    }
  }

  async function onSaveConfig(e) {
    e.preventDefault();
    const restore = setBusy(els.configSaveBtn, 'Saving...');
    try {
      await auth.saveRuntimeConfig({ anonKey: els.configAnonKey?.value || '' });
      setConfigStatus('Emergency fallback key saved. Reloading app...');
      window.location.reload();
    } catch (err) {
      setConfigStatus(err?.message || 'Failed to save runtime config.', true);
    } finally {
      restore();
    }
  }

  function onClearConfig() {
    try {
      auth.clearRuntimeConfig();
      if (els.configAnonKey) els.configAnonKey.value = '';
      setConfigStatus('Emergency fallback key removed.', false);
    } catch (err) {
      setConfigStatus(err?.message || 'Failed to clear runtime config.', true);
    }
  }

  function onForgotEmail() {
    setNotice('Use the account recovery box below to look up your masked email or request a reset email.', false);
    els.recoveryEmployeeNumber?.focus?.();
  }

  async function onAccountLookup() {
    const api = window.YWIAPI;
    const restore = setBusy(els.accountLookupBtn, 'Checking...');
    try {
      const payload = await api.accountRecoveryAction({ action: 'lookup_account_help', ...getRecoveryPayload() });
      const parts = [];
      if (payload?.masked_email) parts.push(`Email: ${payload.masked_email}`);
      if (payload?.masked_username) parts.push(`Username: ${payload.masked_username}`);
      if (!parts.length) parts.push('Account found. Use Forgot Password if you remember the email, or ask admin to review your recovery details.');
      setRecoveryResult(parts.join(' • '), false);
      if (payload?.masked_email && els.passwordEmail && !els.passwordEmail.value) els.passwordEmail.value = payload.masked_email;
    } catch (err) {
      setRecoveryResult(err?.message || 'Recovery lookup failed.', true);
    } finally {
      restore();
    }
  }

  async function onAccountRecoverySend() {
    const api = window.YWIAPI;
    const restore = setBusy(els.accountRecoverySendBtn, 'Sending...');
    try {
      const payload = await api.accountRecoveryAction({ action: 'send_recovery_email', ...getRecoveryPayload(), redirect_to: `${window.location.origin}/#settings` });
      setRecoveryResult(payload?.message || 'Recovery email sent.', false);
    } catch (err) {
      setRecoveryResult(err?.message || 'Recovery email failed.', true);
    } finally {
      restore();
    }
  }

  async function onLogout() {
    try {
      await auth.logout();
      setNotice('Logged out.', false);
      setTab('password');
      if (window.YWIRouter?.showSection) window.YWIRouter.showSection('toolbox', { skipFocus: true });
    } catch (err) {
      setNotice(err?.message || 'Logout failed.', true);
    }
  }

  function bind() {
    if (els.passwordForm && els.passwordForm.dataset.bound !== '1') {
      els.passwordForm.dataset.bound = '1';
      els.passwordForm.addEventListener('submit', onPasswordLogin);
    }
    if (els.passwordForgotBtn && els.passwordForgotBtn.dataset.bound !== '1') {
      els.passwordForgotBtn.dataset.bound = '1';
      els.passwordForgotBtn.addEventListener('click', onForgotPassword);
    }
    if (els.forgotEmailBtn && els.forgotEmailBtn.dataset.bound !== '1') {
      els.forgotEmailBtn.dataset.bound = '1';
      els.forgotEmailBtn.addEventListener('click', onForgotEmail);
    }
    if (els.accountLookupBtn && els.accountLookupBtn.dataset.bound !== '1') {
      els.accountLookupBtn.dataset.bound = '1';
      els.accountLookupBtn.addEventListener('click', onAccountLookup);
    }
    if (els.accountRecoverySendBtn && els.accountRecoverySendBtn.dataset.bound !== '1') {
      els.accountRecoverySendBtn.dataset.bound = '1';
      els.accountRecoverySendBtn.addEventListener('click', onAccountRecoverySend);
    }
    if (els.magicForm && els.magicForm.dataset.bound !== '1') {
      els.magicForm.dataset.bound = '1';
      els.magicForm.addEventListener('submit', onMagicLogin);
    }
    if (els.configForm && els.configForm.dataset.bound !== '1') {
      els.configForm.dataset.bound = '1';
      els.configForm.addEventListener('submit', onSaveConfig);
    }
    if (els.configClearBtn && els.configClearBtn.dataset.bound !== '1') {
      els.configClearBtn.dataset.bound = '1';
      els.configClearBtn.addEventListener('click', onClearConfig);
    }
    if (els.logoutBtn && els.logoutBtn.dataset.bound !== '1') {
      els.logoutBtn.dataset.bound = '1';
      els.logoutBtn.addEventListener('click', onLogout);
    }
    if (els.headerLogoutBtn && els.headerLogoutBtn.dataset.boundAuth !== '1') {
      els.headerLogoutBtn.dataset.boundAuth = '1';
      els.headerLogoutBtn.addEventListener('click', onLogout);
    }
    if (els.headerLoginBtn && els.headerLoginBtn.dataset.boundAuth !== '1') {
      els.headerLoginBtn.dataset.boundAuth = '1';
      els.headerLoginBtn.addEventListener('click', () => {
        setTab('password');
        if (window.YWIRouter?.showSection) window.YWIRouter.showSection('toolbox', { skipFocus: true });
      });
    }
    els.tabButtons.forEach((btn) => {
      if (btn.dataset.bound !== '1') {
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => setTab(btn.getAttribute('data-auth-tab') || 'password'));
      }
    });
  }

  function init() {
    if (uiState.initialized) return;
    uiState.initialized = true;
    bind();
    setTab(uiState.activeTab || 'password');
    render(auth.getState?.() || {});
    document.addEventListener('ywi:auth-changed', (e) => render(e.detail?.state || auth.getState?.() || {}));
    document.addEventListener('ywi:boot-ready', (e) => render(e.detail?.state || auth.getState?.() || {}));
  }

  window.addEventListener('online', () => render(auth.getState?.() || {}));
  window.addEventListener('offline', () => render(auth.getState?.() || {}));
  document.addEventListener('ywi:connectivity-changed', (event) => render(event.detail?.state || auth.getState?.() || {}));

  init();
})();
