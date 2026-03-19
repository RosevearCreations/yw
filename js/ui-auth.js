'use strict';

/* =========================================================
   js/ui-auth.js
   Authentication UI controller

   Purpose:
   - control login / logged-in screen visibility
   - wait for bootstrap + auth recovery before showing logout state
   - support magic link, password login, reset password, and logout
========================================================= */

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
    ready: false,
    activeTab: 'magic'
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
    const label = state?.roleLabel || state?.role || 'Worker';

    els.whoami.textContent = email ? `${email} (${label})` : label;
  }

  function render(state) {
    const pending =
      !!state?.pendingAuthResolution ||
      (!state?.isAuthenticated && !state?.bootReady && !uiState.ready);

    if (pending) {
      if (els.loginView) els.loginView.style.display = 'none';
      if (els.authInfo) els.authInfo.hidden = true;
      return;
    }

    renderWhoAmI(state);

    if (state?.isAuthenticated) {
      showLoggedIn();
      setNotice('');
    } else {
      showLoggedOut();

      const authError = boot?.state?.authError || '';
      if (authError) {
        setNotice(authError, true);
      }
    }
  }

  async function onMagicSubmit(e) {
    e.preventDefault();

    const email = String(els.magicEmail?.value || '').trim();
    if (!email) {
      setNotice('Please enter your email address.', true);
      return;
    }

    const done = setBusy(els.magicBtn, 'Sending...');
    setNotice('');

    try {
      await auth.signInWithMagicLink(email);
      setNotice('Magic link sent. Check your email.', false);
    } catch (err) {
      console.error(err);
      setNotice(err?.message || 'Failed to send magic link.', true);
    } finally {
      done();
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

    const done = setBusy(els.passwordBtn, 'Signing In...');
    setNotice('');

    try {
      await auth.signInWithPassword(email, password);
      setNotice('');
    } catch (err) {
      console.error(err);
      setNotice(err?.message || 'Password sign-in failed.', true);
    } finally {
      done();
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

    const done = setBusy(els.passwordForgotBtn, 'Sending...');
    setNotice('');

    try {
      await auth.resetPassword(email);
      setNotice('Password reset email sent.', false);
    } catch (err) {
      console.error(err);
      setNotice(err?.message || 'Failed to send password reset email.', true);
    } finally {
      done();
    }
  }

  async function onLogout() {
    const done = setBusy(els.logoutBtn, 'Logging out...');
    setNotice('');

    try {
      await auth.logout();
      setTab('magic');
      showLoggedOut();
    } catch (err) {
      console.error(err);
      setNotice(err?.message || 'Logout failed.', true);
    } finally {
      done();
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
      uiState.ready = true;
      render(e.detail?.state || auth.getState());
    });

    document.addEventListener('ywi:auth-changed', (e) => {
      uiState.ready = true;
      render(e.detail?.state || auth.getState());
    });
  }

  function init() {
    setTab('magic');
    bindEvents();

    const current = auth.getState?.() || {};
    render(current);
  }

  init();
})();
