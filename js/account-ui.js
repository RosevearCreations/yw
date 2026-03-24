/* File: js/account-ui.js
   Brief description: In-app account security module.
   Renders the account panel inside Settings, supports password setup/change,
   email verification resend, phone verification request/code entry, and session controls.
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

  function ensureLayout() {
    const section = document.getElementById('settings');
    if (!section) return;
    if (document.getElementById('accountPanel')) return;
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>Settings</h2>
          <p class="section-subtitle">Account security now uses email + password for normal login. Magic link is optional backup only.</p>
        </div>
      </div>
      <div id="accountPanel" class="admin-panel-block" hidden>
        <div class="admin-panel-grid">
          <label>Email
            <input id="account_email" type="email" readonly />
          </label>
          <label>Role
            <input id="account_role" type="text" readonly />
          </label>
          <label>Email status
            <input id="account_email_status" type="text" readonly />
          </label>
          <label>Phone status
            <input id="account_phone_status" type="text" readonly />
          </label>
          <label>Phone number
            <input id="account_phone" type="tel" placeholder="+1 555 555 5555" />
          </label>
          <label>Verification code
            <input id="account_phone_code" type="text" placeholder="SMS code" />
          </label>
          <label>New password
            <input id="account_password" type="password" autocomplete="new-password" placeholder="Choose a strong password" />
          </label>
          <label>Confirm password
            <input id="account_password_confirm" type="password" autocomplete="new-password" placeholder="Confirm password" />
          </label>
        </div>
        <div id="account_password_hint" class="notice" style="margin-top:12px;"></div>
        <div class="form-footer" style="margin-top:14px;flex-wrap:wrap;">
          <button id="account_password_save" class="primary" type="button">Save Password</button>
          <button id="account_resend_email_verification" class="secondary" type="button">Resend Email Verification</button>
          <button id="account_request_phone_verification" class="secondary" type="button">Request Phone Verification</button>
          <button id="account_send_phone_code" class="secondary" type="button">Send SMS Code</button>
          <button id="account_verify_phone_code" class="secondary" type="button">Verify SMS Code</button>
          <button id="account_logout_this" class="secondary" type="button">Log Out</button>
          <button id="account_logout_all" class="secondary" type="button">Log Out Everywhere</button>
        </div>
        <div id="account_summary" class="notice" style="display:none;margin-top:14px;"></div>
      </div>
      <div id="accountSignedOutNotice" class="notice" style="display:none;margin-top:14px;">
        Sign in to manage your account, password, and recovery settings.
      </div>
    `;
  }

  ensureLayout();

  const els = {
    panel: document.getElementById('accountPanel'),
    email: document.getElementById('account_email'),
    role: document.getElementById('account_role'),
    emailStatus: document.getElementById('account_email_status'),
    phoneStatus: document.getElementById('account_phone_status'),
    phone: document.getElementById('account_phone'),
    code: document.getElementById('account_phone_code'),
    resendEmailBtn: document.getElementById('account_resend_email_verification'),
    requestPhoneBtn: document.getElementById('account_request_phone_verification'),
    sendPhoneCodeBtn: document.getElementById('account_send_phone_code'),
    verifyPhoneCodeBtn: document.getElementById('account_verify_phone_code'),
    password: document.getElementById('account_password'),
    confirm: document.getElementById('account_password_confirm'),
    saveBtn: document.getElementById('account_password_save'),
    logoutAllBtn: document.getElementById('account_logout_all'),
    logoutThisBtn: document.getElementById('account_logout_this'),
    summary: document.getElementById('account_summary'),
    hint: document.getElementById('account_password_hint'),
    signedOutNotice: document.getElementById('accountSignedOutNotice')
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
    const phoneVerified = !!(current.profile?.phone_verified || current.profile?.phone_verified_at);

    if (els.panel) els.panel.hidden = !isAuthenticated;
    if (els.signedOutNotice) els.signedOutNotice.style.display = isAuthenticated ? 'none' : 'block';
    if (!isAuthenticated) return;

    if (els.email) els.email.value = current.profile?.email || current.user?.email || '';
    if (els.role) els.role.value = access.roleLabel || role;
    if (els.emailStatus) els.emailStatus.value = emailVerified ? 'Verified' : 'Verification pending';
    if (els.phoneStatus) els.phoneStatus.value = phoneVerified ? 'Verified' : 'Verification pending';
    if (els.phone && !els.phone.value) els.phone.value = current.profile?.phone || '';
    if (els.hint) {
      els.hint.textContent = current.authFlow === 'recovery'
        ? 'Recovery sign-in complete. Save your new password now, then return to normal email + password login.'
        : (emailVerified
          ? 'Your email is verified. Use the password fields below for normal sign-in going forward.'
          : 'Verify your email once, then save a strong password for normal sign-in.');
    }
  }

  async function onSavePassword() {
    const restore = setBusy(els.saveBtn, 'Saving...');
    try {
      const password = String(els.password?.value || '');
      const confirm = String(els.confirm?.value || '');
      validatePassword(password, confirm);
      await auth.changePassword(password);
      if (els.password) els.password.value = '';
      if (els.confirm) els.confirm.value = '';
      setSummary('Password saved. Use email + password for sign-in from now on.', false);
    } catch (err) {
      setSummary(err?.message || 'Failed to save password.', true);
    } finally {
      restore();
    }
  }

  async function onResendEmail() {
    const restore = setBusy(els.resendEmailBtn, 'Sending...');
    try {
      await auth.resendEmailVerification();
      setSummary('Verification email sent.', false);
    } catch (err) {
      setSummary(err?.message || 'Failed to resend email verification.', true);
    } finally {
      restore();
    }
  }

  async function onRequestPhoneVerification() {
    const restore = setBusy(els.requestPhoneBtn, 'Requesting...');
    try {
      if (!api?.requestPhoneVerification) throw new Error('Account maintenance API is not ready.');
      const phone = els.phone?.value?.trim?.() || '';
      await api.requestPhoneVerification({ phone });
      setSummary('Phone verification request sent for admin review.', false);
    } catch (err) {
      setSummary(err?.message || 'Phone verification request failed.', true);
    } finally {
      restore();
    }
  }

  async function onSendPhoneCode() {
    const restore = setBusy(els.sendPhoneCodeBtn, 'Sending...');
    try {
      if (!api?.sendPhoneVerificationCode) throw new Error('SMS verification API is not ready.');
      const phone = els.phone?.value?.trim?.() || '';
      const resp = await api.sendPhoneVerificationCode({ phone });
      setSummary(resp?.provider === 'twilio_verify' ? 'SMS code sent.' : 'SMS provider is not configured. Use admin review instead.', false);
    } catch (err) {
      setSummary(err?.message || 'Failed to send SMS code.', true);
    } finally {
      restore();
    }
  }

  async function onVerifyPhoneCode() {
    const restore = setBusy(els.verifyPhoneCodeBtn, 'Verifying...');
    try {
      if (!api?.verifyPhoneCode) throw new Error('SMS verification API is not ready.');
      const phone = els.phone?.value?.trim?.() || '';
      const code = els.code?.value?.trim?.() || '';
      await api.verifyPhoneCode({ phone, code });
      if (els.code) els.code.value = '';
      setSummary('Phone verified successfully.', false);
      render(auth.getState?.() || {});
    } catch (err) {
      setSummary(err?.message || 'Failed to verify SMS code.', true);
    } finally {
      restore();
    }
  }

  async function onLogout(scope = 'local') {
    try {
      await auth.logout(scope);
      setSummary(scope === 'global' ? 'Logged out of all sessions.' : 'Logged out.', false);
    } catch (err) {
      setSummary(err?.message || 'Logout failed.', true);
    }
  }

  function bind() {
    if (els.saveBtn && els.saveBtn.dataset.bound !== '1') {
      els.saveBtn.dataset.bound = '1';
      els.saveBtn.addEventListener('click', onSavePassword);
    }
    if (els.resendEmailBtn && els.resendEmailBtn.dataset.bound !== '1') {
      els.resendEmailBtn.dataset.bound = '1';
      els.resendEmailBtn.addEventListener('click', onResendEmail);
    }
    if (els.requestPhoneBtn && els.requestPhoneBtn.dataset.bound !== '1') {
      els.requestPhoneBtn.dataset.bound = '1';
      els.requestPhoneBtn.addEventListener('click', onRequestPhoneVerification);
    }
    if (els.sendPhoneCodeBtn && els.sendPhoneCodeBtn.dataset.bound !== '1') {
      els.sendPhoneCodeBtn.dataset.bound = '1';
      els.sendPhoneCodeBtn.addEventListener('click', onSendPhoneCode);
    }
    if (els.verifyPhoneCodeBtn && els.verifyPhoneCodeBtn.dataset.bound !== '1') {
      els.verifyPhoneCodeBtn.dataset.bound = '1';
      els.verifyPhoneCodeBtn.addEventListener('click', onVerifyPhoneCode);
    }
    if (els.logoutThisBtn && els.logoutThisBtn.dataset.bound !== '1') {
      els.logoutThisBtn.dataset.bound = '1';
      els.logoutThisBtn.addEventListener('click', () => onLogout('local'));
    }
    if (els.logoutAllBtn && els.logoutAllBtn.dataset.bound !== '1') {
      els.logoutAllBtn.dataset.bound = '1';
      els.logoutAllBtn.addEventListener('click', () => onLogout('global'));
    }
  }

  bind();
  render(auth.getState?.() || {});
  document.addEventListener('ywi:auth-changed', (e) => render(e.detail?.state || auth.getState?.() || {}));
})();
