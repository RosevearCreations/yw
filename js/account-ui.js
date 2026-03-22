/* File: js/account-ui.js
   Brief description: In-app account security module.
   Renders the signed-in account panel, supports first-time password creation/change,
   and allows the current user to sign out all sessions for stronger account control.
*/

'use strict';

(function () {
  const auth = window.YWI_AUTH || null;
  const security = window.YWISecurity || null;

  if (!auth) {
    console.error('Account UI module could not find YWI_AUTH.');
    return;
  }

  const els = {
    panel: document.getElementById('accountPanel'),
    email: document.getElementById('account_email'),
    role: document.getElementById('account_role'),
    password: document.getElementById('account_password'),
    confirm: document.getElementById('account_password_confirm'),
    saveBtn: document.getElementById('account_password_save'),
    logoutAllBtn: document.getElementById('account_logout_all'),
    summary: document.getElementById('account_summary'),
    badge: document.getElementById('account_role_badge'),
    hint: document.getElementById('account_password_hint')
  };

  function setSummary(text = '', isError = false) {
    if (!els.summary) return;
    if (!text) {
      els.summary.style.display = 'none';
      els.summary.textContent = '';
      els.summary.dataset.kind = '';
      return;
    }
    els.summary.style.display = 'block';
    els.summary.textContent = text;
    els.summary.dataset.kind = isError ? 'error' : 'info';
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

  function validatePassword(password, confirm) {
    if (!password) throw new Error('Enter a new password.');
    if (password.length < 10) throw new Error('Password must be at least 10 characters long.');
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new Error('Password must include upper, lower, and number characters.');
    }
    if (password !== confirm) throw new Error('Password confirmation does not match.');
  }

  function render(state) {
    const current = state || auth.getState?.() || {};
    const isAuthenticated = !!current.isAuthenticated;
    const role = current.role || current.profile?.role || 'worker';
    const access = security?.getAccessProfile ? security.getAccessProfile(role) : { roleLabel: role };

    if (els.panel) els.panel.hidden = !isAuthenticated;

    if (!isAuthenticated) {
      setSummary('');
      if (els.password) els.password.value = '';
      if (els.confirm) els.confirm.value = '';
      return;
    }

    if (els.email) els.email.value = current.profile?.email || current.user?.email || '';
    if (els.role) els.role.value = access.roleLabel || role;
    if (els.badge) els.badge.textContent = access.roleLabel || role;
    if (els.hint) {
      const stronger = access.rank >= 30;
      els.hint.textContent = stronger
        ? 'Supervisor, HSE, Job Admin, and Admin accounts should set a strong password immediately after first magic-link sign-in.'
        : 'After your first magic-link sign-in, you can create a password here for faster future login.';
    }
  }

  async function onSavePassword() {
    try {
      const password = String(els.password?.value || '');
      const confirm = String(els.confirm?.value || '');
      validatePassword(password, confirm);
      const restore = setBusy(els.saveBtn, 'Saving...');
      setSummary('');
      try {
        await auth.changePassword(password);
        if (els.password) els.password.value = '';
        if (els.confirm) els.confirm.value = '';
        setSummary('Password saved. You can now use email + password as well as magic link.');
      } finally {
        restore();
      }
    } catch (err) {
      console.error(err);
      setSummary(err?.message || 'Failed to update password.', true);
    }
  }

  async function onLogoutAll() {
    const confirmed = window.confirm('Sign out this account from all sessions and devices?');
    if (!confirmed) return;
    const restore = setBusy(els.logoutAllBtn, 'Signing out...');
    setSummary('');
    try {
      await auth.logoutEverywhere();
      setSummary('All sessions have been signed out.');
    } catch (err) {
      console.error(err);
      setSummary(err?.message || 'Failed to sign out all sessions.', true);
    } finally {
      restore();
    }
  }

  function bindEvents() {
    els.saveBtn?.addEventListener('click', onSavePassword);
    els.logoutAllBtn?.addEventListener('click', onLogoutAll);
    document.addEventListener('ywi:boot-ready', (e) => render(e.detail?.state || auth.getState?.()));
    document.addEventListener('ywi:auth-changed', (e) => render(e.detail?.state || auth.getState?.()));
  }

  function init() {
    bindEvents();
    render(auth.getState?.());
  }

  window.YWIAccountUI = { init, render };
  init();
})();
