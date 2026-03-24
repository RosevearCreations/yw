/* File: js/ui-auth.js
   Brief description: Authentication UI controller for password-first login,
   backup magic-link login, password reset, and clean auth-wall handling.
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
    headerWhoami: document.getElementById('headerWhoami'),
    headerLoginBtn: document.getElementById('headerLoginBtn'),
    headerSettingsBtn: document.getElementById('headerSettingsBtn'),
    headerLogoutBtn: document.getElementById('headerLogoutBtn'),
    authNotice: document.getElementById('authNotice'),
    authLoading: document.getElementById('authLoading'),
    magicForm: document.getElementById('magicLoginForm'),
    magicEmail: document.getElementById('magicLoginEmail'),
    magicBtn: document.getElementById('magicLoginBtn'),
    passwordForm: document.getElementById('passwordLoginForm'),
    passwordEmail: document.getElementById('passwordLoginEmail'),
    passwordPassword: document.getElementById('passwordLoginPassword'),
    passwordBtn: document.getElementById('passwordLoginBtn'),
    passwordForgotBtn: document.getElementById('passwordForgotBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    tabButtons: Array.from(document.querySelectorAll('[data-auth-tab]')),
    panels: Array.from(document.querySelectorAll('[data-auth-panel]'))
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

  function syncHeader(state) {
    const profile = state?.profile || {};
    const user = state?.user || {};
    const displayName = profile.full_name || profile.email || user.email || 'Not signed in';
    if (els.headerWhoami) els.headerWhoami.textContent = state?.isAuthenticated ? `${displayName} · ${state.roleLabel || state.role || 'User'}` : 'Not signed in';
    if (els.headerLoginBtn) els.headerLoginBtn.style.display = state?.isAuthenticated ? 'none' : '';
    if (els.headerSettingsBtn) els.headerSettingsBtn.style.display = state?.isAuthenticated ? '' : 'none';
    if (els.headerLogoutBtn) els.headerLogoutBtn.style.display = state?.isAuthenticated ? '' : 'none';
    if (els.headerSession) els.headerSession.hidden = !state?.isAuthenticated;
  }

  function render(state = auth.getState?.() || {}) {
    const isAuthenticated = !!state.isAuthenticated;
    syncHeader(state);
    if (els.whoami) {
      const profile = state.profile || {};
      const user = state.user || {};
      els.whoami.textContent = profile.full_name || profile.email || user.email || state.roleLabel || 'User';
    }

    if (state.pendingAuthResolution) {
      showLoading(true);
      return;
    }

    showLoading(false);

    if (isAuthenticated) {
      if (els.loginView) els.loginView.style.display = 'none';
      if (els.authInfo) els.authInfo.hidden = false;
      if (state.authFlow === 'recovery') {
        setNotice('Recovery link accepted. Please set a new password in Settings.', false);
        if (window.YWIRouter?.showSection) window.YWIRouter.showSection('settings', { skipFocus: true });
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

    if (state.authError) {
      setNotice(state.authError, true);
    } else {
      setNotice('Use email and password for daily sign-in. Magic link is only a backup or recovery option.', false);
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
      setNotice('Password reset email sent. Open the newest email and then set your new password in Settings.', false);
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
      setNotice('Magic link sent. Use it only when you need backup access or account recovery.', false);
      setTab('password');
    } catch (err) {
      setNotice(err?.message || 'Magic link sign-in failed.', true);
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
    if (els.magicForm && els.magicForm.dataset.bound !== '1') {
      els.magicForm.dataset.bound = '1';
      els.magicForm.addEventListener('submit', onMagicLogin);
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
    if (els.headerSettingsBtn && els.headerSettingsBtn.dataset.boundAuth !== '1') {
      els.headerSettingsBtn.dataset.boundAuth = '1';
      els.headerSettingsBtn.addEventListener('click', () => window.YWIRouter?.showSection?.('settings', { skipFocus: true }));
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

  init();
})();
