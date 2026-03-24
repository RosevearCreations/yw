/* File: js/account-ui.js
   Brief description: In-app account security module.
   Renders the signed-in account panel, supports password creation/change,
   email verification resend, phone verification request, and session controls.
*/

'use strict';

(function () {
  const auth = window.YWI_AUTH || null;
  const security = window.YWISecurity || null;
  const api = window.YWIAPI || null;

  if (!auth) {
    console.error('Account UI module could not find YWI_AUTH.');
    return;
  }

  const els = {
    panel: document.getElementById('accountPanel'),
    email: document.getElementById('account_email'),
    role: document.getElementById('account_role'),
    emailStatus: document.getElementById('account_email_status'),
    phoneStatus: document.getElementById('account_phone_status'),
    resendEmailBtn: document.getElementById('account_resend_email_verification'),
    requestPhoneBtn: document.getElementById('account_request_phone_verification'),
    password: document.getElementById('account_password'),
    confirm: document.getElementById('account_password_confirm'),
    saveBtn: document.getElementById('account_password_save'),
    logoutAllBtn: document.getElementById('account_logout_all'),
    logoutThisBtn: document.getElementById('account_logout_this'),
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
    const emailVerified = !!(current.user?.email_confirmed_at || current.user?.confirmed_at || current.profile?.email_verified);
    const phoneVerified = !!current.profile?.phone_verified;

    if (els.panel) els.panel.hidden = !isAuthenticated;
    if (!isAuthenticated) return;

    if (els.email) els.email.value = current.profile?.email || current.user?.email || '';
    if (els.role) els.role.value = access.roleLabel || role;
    if (els.badge) els.badge.textContent = access.roleLabel || role;
    if (els.emailStatus) els.emailStatus.value = emailVerified ? 'Verified' : 'Verification pending';
    if (els.phoneStatus) els.phoneStatus.value = phoneVerified ? 'Verified' : 'Verification pending';
    if (els.hint) {
      els.hint.textContent = emailVerified
        ? 'Your email is already verified. You can still change your password and manage sessions here.'
        : 'Verify your email, then create a strong password so you can use email + password and recovery tools.';
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
      } finally { restore(); }
    } catch (err) {
      console.error(err);
      setSummary(err?.message || 'Failed to update password.', true);
    }
  }

  async function onResendEmailVerification() {
    const restore = setBusy(els.resendEmailBtn, 'Sending...');
    setSummary('');
    try {
      await auth.resendEmailVerification();
      setSummary('Verification email sent. Please check your inbox.');
    } catch (err) {
      console.error(err);
      setSummary(err?.message || 'Failed to send verification email.', true);
    } finally { restore(); }
  }

  async function onRequestPhoneVerification() {
    const current = auth.getState?.() || {};
    const phone = current.profile?.phone || '';
    if (!phone) {
      setSummary('Add a phone number in My Profile before requesting verification.', true);
      return;
    }
    const restore = setBusy(els.requestPhoneBtn, 'Requesting...');
    setSummary('');
    try {
      if (!api?.requestPhoneVerification) throw new Error('Account maintenance API is not ready.');
      await api.requestPhoneVerification({ phone });
      setSummary('Phone verification request sent to admins for follow-up.');
    } catch (err) {
      console.error(err);
      setSummary(err?.message || 'Failed to request phone verification.', true);
    } finally { restore(); }
  }

  async function onLogoutThis() {
    const confirmed = window.confirm('Log out of this current session?');
    if (!confirmed) return;
    const restore = setBusy(els.logoutThisBtn, 'Logging out...');
    setSummary('');
    try { await auth.logout(); setSummary('Current session cleared.'); }
    catch (err) { console.error(err); setSummary(err?.message || 'Failed to log out current session.', true); }
    finally { restore(); }
  }

  async function onLogoutAll() {
    const confirmed = window.confirm('Sign out this account from all sessions and devices?');
    if (!confirmed) return;
    const restore = setBusy(els.logoutAllBtn, 'Signing out...');
    setSummary('');
    try { await auth.logoutEverywhere(); setSummary('All sessions have been signed out.'); }
    catch (err) { console.error(err); setSummary(err?.message || 'Failed to sign out all sessions.', true); }
    finally { restore(); }
  }

  function bindEvents() {
    els.saveBtn?.addEventListener('click', onSavePassword);
    els.logoutThisBtn?.addEventListener('click', onLogoutThis);
    els.logoutAllBtn?.addEventListener('click', onLogoutAll);
    els.resendEmailBtn?.addEventListener('click', onResendEmailVerification);
    els.requestPhoneBtn?.addEventListener('click', onRequestPhoneVerification);
    document.addEventListener('ywi:boot-ready', (e) => render(e.detail?.state || auth.getState?.()));
    document.addEventListener('ywi:auth-changed', (e) => render(e.detail?.state || auth.getState?.()));
  }

  function init() { bindEvents(); render(auth.getState?.()); }
  window.YWIAccountUI = { init, render };
  init();
})();
