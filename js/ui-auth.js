'use strict';

/* =========================================================
   js/ui-auth.js
   UI controller for authentication screens and session display

   Purpose:
   - manage login panel behavior
   - support magic-link and password sign-in modes
   - display logged-in user and role in app
   - handle logout in-app
   - prepare for future admin-created password onboarding
========================================================= */

(function () {
  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value || '';
  }

  function show(el) {
    if (!el) return;
    el.hidden = false;
    el.style.display = '';
  }

  function hide(el) {
    if (!el) return;
    el.hidden = true;
    el.style.display = 'none';
  }

  function setNotice(el, text, type = 'info') {
    if (!el) return;

    if (!text) {
      el.textContent = '';
      el.style.display = 'none';
      el.removeAttribute('data-state');
      return;
    }

    el.textContent = text;
    el.style.display = 'block';
    el.setAttribute('data-state', type);
  }

  function disableButton(btn, disabled, busyText = '') {
    if (!btn) return;
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent || '';
    }
    btn.disabled = !!disabled;
    btn.textContent = disabled && busyText
      ? busyText
      : (btn.dataset.originalText || btn.textContent || '');
  }

  function normalizeHashRoute() {
    const raw = window.location.hash || '#toolbox';
    const hash = raw.replace(/^#/, '');
    if (/^(access_token|refresh_token|expires_at|expires_in|token_type|type|error|code)=/i.test(hash)) {
      history.replaceState({}, '', window.location.pathname + '#toolbox');
      return '#toolbox';
    }
    return raw || '#toolbox';
  }

  function createAuthUI(config) {
    const auth = config?.auth;
    if (!auth) {
      console.warn('ui-auth requires an auth service instance.');
      return null;
    }

    const els = {
      loginView: $('#loginView'),
      authInfo: $('#authInfo'),
      whoami: $('#whoami'),
      logoutBtn: $('#logoutBtn'),

      authTabs: document.querySelectorAll('[data-auth-tab]'),
      authPanels: document.querySelectorAll('[data-auth-panel]'),

      magicForm: $('#magicLoginForm'),
      magicEmail: $('#magicLoginEmail'),
      magicBtn: $('#magicLoginBtn'),

      passwordForm: $('#passwordLoginForm'),
      passwordEmail: $('#passwordLoginEmail'),
      passwordPassword: $('#passwordLoginPassword'),
      passwordBtn: $('#passwordLoginBtn'),

      forgotBtn: $('#passwordForgotBtn'),

      authNotice: $('#authNotice')
    };

    const state = {
      activeTab: 'magic',
      initialized: false
    };

    function appShell() {
      return $('main.container');
    }

    function setActiveTab(tabName) {
      state.activeTab = tabName === 'password' ? 'password' : 'magic';

      els.authTabs.forEach((btn) => {
        const isActive = btn.getAttribute('data-auth-tab') === state.activeTab;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      els.authPanels.forEach((panel) => {
        const isActive = panel.getAttribute('data-auth-panel') === state.activeTab;
        panel.hidden = !isActive;
        panel.style.display = isActive ? '' : 'none';
      });
    }

    function signedInLabel(authState) {
      const email = authState?.profile?.email || authState?.user?.email || '';
      const role = authState?.roleLabel || 'Worker';
      return email ? `${email} (${role})` : role;
    }

    function renderLoggedOut() {
      show(els.loginView);
      hide(els.authInfo);

      const app = appShell();
      if (app) app.style.display = 'none';

      setText(els.whoami, '');
      setNotice(els.authNotice, '');
    }

    function renderLoggedIn(authState) {
      hide(els.loginView);
      show(els.authInfo);

      const app = appShell();
      if (app) app.style.display = '';

      setText(els.whoami, signedInLabel(authState));
      normalizeHashRoute();
      setNotice(els.authNotice, '');
    }

    function renderFromState(authState) {
      if (authState?.isAuthenticated) {
        renderLoggedIn(authState);
      } else {
        renderLoggedOut();
      }
    }

    async function handleMagicLogin(e) {
      e.preventDefault();

      const email = (els.magicEmail?.value || '').trim();
      if (!email) {
        setNotice(els.authNotice, 'Please enter your email address.', 'error');
        els.magicEmail?.focus();
        return;
      }

      disableButton(els.magicBtn, true, 'Sending...');
      setNotice(els.authNotice, 'Sending magic link...', 'info');

      try {
        await auth.sendMagicLink(email, `${window.location.origin}/#toolbox`);
        setNotice(els.authNotice, 'Magic link sent. Check your email.', 'success');
      } catch (err) {
        console.error(err);
        setNotice(els.authNotice, err?.message || 'Could not send magic link.', 'error');
      } finally {
        disableButton(els.magicBtn, false);
      }
    }

    async function handlePasswordLogin(e) {
      e.preventDefault();

      const email = (els.passwordEmail?.value || '').trim();
      const password = els.passwordPassword?.value || '';

      if (!email) {
        setNotice(els.authNotice, 'Please enter your email address.', 'error');
        els.passwordEmail?.focus();
        return;
      }

      if (!password) {
        setNotice(els.authNotice, 'Please enter your password.', 'error');
        els.passwordPassword?.focus();
        return;
      }

      disableButton(els.passwordBtn, true, 'Signing in...');
      setNotice(els.authNotice, 'Signing in...', 'info');

      try {
        await auth.signInWithPassword(email, password);
        setNotice(els.authNotice, 'Signed in successfully.', 'success');
      } catch (err) {
        console.error(err);
        setNotice(els.authNotice, err?.message || 'Could not sign in with password.', 'error');
      } finally {
        disableButton(els.passwordBtn, false);
      }
    }

    async function handleForgotPassword() {
      const email = (els.passwordEmail?.value || '').trim();

      if (!email) {
        setNotice(els.authNotice, 'Enter your email first, then use reset password.', 'error');
        els.passwordEmail?.focus();
        return;
      }

      setNotice(els.authNotice, 'Sending password reset email...', 'info');

      try {
        await auth.resetPassword(email, `${window.location.origin}/#toolbox`);
        setNotice(els.authNotice, 'Password reset email sent.', 'success');
      } catch (err) {
        console.error(err);
        setNotice(els.authNotice, err?.message || 'Could not send password reset email.', 'error');
      }
    }

    async function handleLogout() {
      try {
        setNotice(els.authNotice, '');
        await auth.signOut();
      } catch (err) {
        console.error(err);
        setNotice(els.authNotice, err?.message || 'Could not log out.', 'error');
      }
    }

    function bindEvents() {
      els.authTabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          setActiveTab(btn.getAttribute('data-auth-tab') || 'magic');
        });
      });

      els.magicForm?.addEventListener('submit', handleMagicLogin);
      els.passwordForm?.addEventListener('submit', handlePasswordLogin);
      els.forgotBtn?.addEventListener('click', handleForgotPassword);
      els.logoutBtn?.addEventListener('click', handleLogout);
    }

    async function init() {
      if (state.initialized) return;
      state.initialized = true;

      bindEvents();
      setActiveTab('magic');

      const currentState = auth.getState();
      renderFromState(currentState);

      auth.onChange((nextState) => {
        renderFromState(nextState);
      });

      await auth.init();
      renderFromState(auth.getState());
    }

    return {
      init,
      setActiveTab,
      renderFromState
    };
  }

  window.YWIAuthUI = {
    create: createAuthUI
  };
})();
