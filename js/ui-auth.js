/* File: js/ui-auth.js
   Brief description: Authentication UI controller for magic link, password sign-in,
   password reset, logout, and safe rendering while auth recovery is still in progress.
*/

'use strict';

(function () {
  const auth = window.YWI_AUTH || null;
  const boot = window.YWI_BOOT || null;

  if (!auth) {
    console.error('UI auth module could not find YWI_AUTH.');
    return;
  }

  const els = {
    loginView: document.getElementById('loginView'),
    authInfo: document.getElementById('authInfo'),
    whoami: document.getElementById('whoami'),
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
    activeTab: 'magic',
    bootReady: false,
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

    const originalText = button.textContent;
    button.disabled = true;
    if (busyText) button.textContent = busyText;

    return function restore() {
      button.disabled = false;
      button.textContent = originalText;
    };
  }

  function setTab(tabName) {
    uiState.activeTab = tabName;

    els.tabButtons.forEach((btn) => {
      const isActive = btn.getAttribute('data-auth-tab') === tabName;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    els.panels.forEach((panel) => {
      const isActive = panel.getAttribute('data-auth-panel') === tabName;
      panel.hidden = !isActive;
      panel.style.display = isActive ? '' : 'none';
    });
  }

  function showLoading(show) {
    if (!els.authLoading) return;
    els.authLoading.classList.toggle('is-visible', !!show);
    els.authLoading.setAttribute('aria-busy', show ? 'true' : 'false');
  }

  function showLoggedOut() {
    if (els.loginView) els.loginView.style.display = '';
    if (els.authInfo) els.authInfo.hidden = true;
  }

  function showLoggedIn() {
    if (els.loginView) els.loginView.style.display = 'none';
    if (els.authInfo) els.authInfo.hidden = false;
  }

  function renderWhoAmI(state) {
    if (!els.whoami) return;

    const email = state?.profile?.email || state?.user?.email || '';
    const roleLabel = state?.roleLabel || state?.role || 'Worker';
    els.whoami.textContent = email ? `${email} (${roleLabel})` : roleLabel;
  }

  function shouldHoldOnLoading(state) {
    if (state?.pendingAuthResolution) return true;
    if (!uiState.bootReady && !state?.isAuthenticated) return true;
    return false;
  }

  function render(state) {
    const currentState = state || auth.getState?.() || {};

    if (shouldHoldOnLoading(currentState)) {
      showLoading(true);
      if (els.loginView) els.loginView.style.display = 'none';
      if (els.authInfo) els.authInfo.hidden = true;
      return;
    }

    showLoading(false);
    renderWhoAmI(currentState);

    if (currentState.isAuthenticated) {
      showLoggedIn();
      setNotice('');
      return;
    }

    showLoggedOut();

    const authError = boot?.state?.authError || '';
    if (authError) {
      setNotice(authError, true);
    }
  }

  async function onMagicSubmit(e) {
    e.preventDefault();

    const email = String(els.magicEmail?.value || '').trim();
    if (!email) {
      setNotice('Please enter your email address.', true);
      return;
    }

    const restore = setBusy(els.magicBtn, 'Sending...');
    setNotice('');

    try {
      await auth.signInWithMagicLink(email);
      setNotice('Magic link sent. Check your email.', false);
    } catch (err) {
      console.error(err);
      setNotice(err?.message || 'Failed to send magic link.', true);
    } finally {
      restore();
    }
  }

  async function onPasswordSubmit(e) {
    e.preventDefault();

    const email = String(els.passwordEmail?.value || '').trim();
    const password = String(els.passwordPassword?.value || '');

    if (!email || !password) {
      setNotice('Please enter your email and password.', true);
      return;
    }

    const restore = setBusy(els.passwordBtn, 'Signing In...');
    setNotice('');

    try {
      await auth.signInWithPassword(email, password);
      setNotice('');
    } catch (err) {
      console.error(err);
      setNotice(err?.message || 'Password sign-in failed.', true);
    } finally {
      restore();
    }
  }

  async function onForgotPassword() {
    const email =
      String(els.passwordEmail?.value || '').trim() ||
      String(els.magicEmail?.value || '').trim();

    if (!email) {
      setNotice('Enter your email first, then click Reset Password.', true);
      return;
    }

    const restore = setBusy(els.passwordForgotBtn, 'Sending...');
    setNotice('');

    try {
      await auth.resetPassword(email);
      setNotice('Password reset email sent.', false);
    } catch (err) {
      console.error(err);
      setNotice(err?.message || 'Failed to send password reset email.', true);
    } finally {
      restore();
    }
  }

  async function onLogout() {
    const restore = setBusy(els.logoutBtn, 'Logging out...');
    setNotice('');

    try {
      await auth.logout();
      setTab('magic');
      showLoggedOut();
    } catch (err) {
      console.error(err);
      setNotice(err?.message || 'Logout failed.', true);
    } finally {
      restore();
    }
  }

  function bindEvents() {
    els.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-auth-tab') || 'magic';
        setTab(tab);
        setNotice('');
      });
    });

    els.magicForm?.addEventListener('submit', onMagicSubmit);
    els.passwordForm?.addEventListener('submit', onPasswordSubmit);
    els.passwordForgotBtn?.addEventListener('click', onForgotPassword);
    els.logoutBtn?.addEventListener('click', onLogout);

    document.addEventListener('ywi:boot-ready', (e) => {
      uiState.bootReady = true;
      render(e.detail?.state || auth.getState?.());
    });

    document.addEventListener('ywi:auth-changed', (e) => {
      render(e.detail?.state || auth.getState?.());
    });
  }

  function init() {
    if (uiState.initialized) return;
    uiState.initialized = true;

    setTab('magic');
    bindEvents();
    render(auth.getState?.());
  }

  init();
})();
