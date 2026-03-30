/* File: js/account-ui.js
   Brief description: In-app account security and onboarding module.
   Renders onboarding + Settings panels, supports account setup after magic-link validation,
   password setup/change/reset, contact/address updates, autosave drafts, phone verification,
   and username/email change request workflows with confirmation history.
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

  const DRAFT_KEY = 'ywi_account_settings_draft_v1';

  function ensureOnboardingSection() {
    if (document.getElementById('onboarding')) return;
    const main = document.querySelector('main') || document.body;
    const section = document.createElement('section');
    section.id = 'onboarding';
    section.className = 'section';
    section.hidden = true;
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>Account Onboarding</h2>
          <p class="section-subtitle">Finish your first-run setup before using the app normally.</p>
        </div>
      </div>
      <div id="onboardingNotice" class="notice" style="display:none;margin-top:12px;"></div>
      <div class="admin-panel-block">
        <ol class="simple-list" style="padding-left:18px;margin:0;">
          <li>Confirm your full name, phone, and address details.</li>
          <li>Choose a username for daily sign-in.</li>
          <li>Save a password so you no longer depend on magic links.</li>
          <li>Complete onboarding, then continue into the app.</li>
        </ol>
        <div class="form-footer" style="margin-top:16px;">
          <button id="onboarding_open_settings" class="primary" type="button">Open Account Setup</button>
          <button id="onboarding_complete" class="secondary" type="button">Mark Onboarding Complete</button>
        </div>
      </div>
    `;
    const settings = document.getElementById('settings');
    if (settings && settings.parentNode) settings.parentNode.insertBefore(section, settings);
    else main.appendChild(section);
  }

  function ensureLayout() {
    ensureOnboardingSection();
    const section = document.getElementById('settings');
    if (!section) return;
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>Settings</h2>
          <p class="section-subtitle">Daily sign-in uses username/email + password. Magic link is only for first validation, recovery, or backup access.</p>
        </div>
      </div>
      <div id="accountSetupNotice" class="notice" style="display:none;margin-top:12px;"></div>
      <div id="accountPanel" class="admin-panel-block" hidden>
        <div class="admin-panel-grid">
          <label>Full name<input id="account_full_name" type="text" placeholder="Full legal or display name" /></label>
          <label>Email<input id="account_email" type="email" readonly /></label>
          <label>Username<input id="account_username" type="text" placeholder="Choose a username" /></label>
          <label>Recovery email<input id="account_recovery_email" type="email" placeholder="Optional backup email" /></label>
          <label>Requested new username<input id="account_requested_username" type="text" placeholder="Optional requested username change" /></label>
          <label>Requested new email<input id="account_requested_email" type="email" placeholder="Optional requested account email change" /></label>
          <label>Role<input id="account_role" type="text" readonly /></label>
          <label>Email status<input id="account_email_status" type="text" readonly /></label>
          <label>Phone status<input id="account_phone_status" type="text" readonly /></label>
          <label>Phone number<input id="account_phone" type="tel" placeholder="+1 555 555 5555" /></label>
          <label>Address line 1<input id="account_address_line1" type="text" placeholder="Street address" /></label>
          <label>Address line 2<input id="account_address_line2" type="text" placeholder="Unit / suite" /></label>
          <label>City<input id="account_city" type="text" /></label>
          <label>Province<input id="account_province" type="text" /></label>
          <label>Postal code<input id="account_postal_code" type="text" placeholder="N0N 0N0" /></label>
          <label>Verification code<input id="account_phone_code" type="text" placeholder="SMS code" /></label>
          <label>New password<input id="account_password" type="password" autocomplete="new-password" placeholder="Choose a strong password" /></label>
          <label>Confirm password<input id="account_password_confirm" type="password" autocomplete="new-password" placeholder="Confirm password" /></label>
        </div>
        <div id="account_password_hint" class="notice" style="margin-top:12px;"></div>
        <div class="form-footer" style="margin-top:14px;flex-wrap:wrap;">
          <button id="account_setup_complete" class="primary" type="button">Complete Account Setup</button>
          <button id="account_recovery_save" class="secondary" type="button">Save Contact Details</button>
          <button id="account_password_save" class="secondary" type="button">Save Password</button>
          <button id="account_request_identity_change" class="secondary" type="button">Request Email / Username Change</button>
          <button id="account_reset_password_email" class="secondary" type="button">Send Password Reset Email</button>
          <button id="account_resend_email_verification" class="secondary" type="button">Resend Email Verification</button>
          <button id="account_request_phone_verification" class="secondary" type="button">Request Phone Verification</button>
          <button id="account_send_phone_code" class="secondary" type="button">Send SMS Code</button>
          <button id="account_verify_phone_code" class="secondary" type="button">Verify SMS Code</button>
          <button id="account_logout_this" class="secondary" type="button">Log Out</button>
          <button id="account_logout_all" class="secondary" type="button">Log Out Everywhere</button>
        </div>
        <div id="account_summary" class="notice" style="display:none;margin-top:14px;"></div>
        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Activity Inbox</h3>
              <p class="section-subtitle">Recent approval results, account-change notifications, and account activity.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="account_retry_sync" class="secondary" type="button">Retry Pending Sync</button>
              <button id="account_reload_notifications" class="secondary" type="button">Reload Inbox</button>
            </div>
          </div>
          <div id="account_notifications_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
          <div class="table-scroll">
            <table id="account_notifications_table">
              <thead><tr><th>Created</th><th>Type</th><th>Title</th><th>Status</th><th>Decision</th><th>Message</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Identity Change History</h3>
              <p class="section-subtitle">Track pending, approved, or rejected username and email change requests.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="account_reload_identity_requests" class="secondary" type="button">Reload</button>
            </div>
          </div>
          <div id="account_identity_requests_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
          <div class="table-scroll">
            <table id="account_identity_requests_table">
              <thead><tr><th>Requested</th><th>Username</th><th>Email</th><th>Status</th><th>Reviewed</th><th>Notes</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
      <div id="accountSignedOutNotice" class="notice" style="display:none;margin-top:14px;">Sign in to manage your account, password, and recovery settings.</div>
    `;
  }

  ensureLayout();

  const els = {
    onboarding: document.getElementById('onboarding'),
    onboardingNotice: document.getElementById('onboardingNotice'),
    onboardingOpenSettings: document.getElementById('onboarding_open_settings'),
    onboardingCompleteBtn: document.getElementById('onboarding_complete'),
    panel: document.getElementById('accountPanel'),
    setupNotice: document.getElementById('accountSetupNotice'),
    fullName: document.getElementById('account_full_name'),
    email: document.getElementById('account_email'),
    role: document.getElementById('account_role'),
    username: document.getElementById('account_username'),
    recoveryEmail: document.getElementById('account_recovery_email'),
    requestedUsername: document.getElementById('account_requested_username'),
    requestedEmail: document.getElementById('account_requested_email'),
    address1: document.getElementById('account_address_line1'),
    address2: document.getElementById('account_address_line2'),
    city: document.getElementById('account_city'),
    province: document.getElementById('account_province'),
    postalCode: document.getElementById('account_postal_code'),
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
    setupCompleteBtn: document.getElementById('account_setup_complete'),
    saveRecoveryBtn: document.getElementById('account_recovery_save'),
    saveBtn: document.getElementById('account_password_save'),
    requestIdentityChangeBtn: document.getElementById('account_request_identity_change'),
    resetPasswordEmailBtn: document.getElementById('account_reset_password_email'),
    logoutAllBtn: document.getElementById('account_logout_all'),
    logoutThisBtn: document.getElementById('account_logout_this'),
    summary: document.getElementById('account_summary'),
    hint: document.getElementById('account_password_hint'),
    signedOutNotice: document.getElementById('accountSignedOutNotice'),
    reloadIdentityRequestsBtn: document.getElementById('account_reload_identity_requests'),
    notificationsSummary: document.getElementById('account_notifications_summary'),
    notificationsBody: document.querySelector('#account_notifications_table tbody'),
    retrySyncBtn: document.getElementById('account_retry_sync'),
    reloadNotificationsBtn: document.getElementById('account_reload_notifications'),
    identityRequestsSummary: document.getElementById('account_identity_requests_summary'),
    identityRequestsBody: document.querySelector('#account_identity_requests_table tbody')
  };

  function setNotice(el, text = '', isError = false) {
    if (!el) return;
    if (!text) {
      el.style.display = 'none';
      el.textContent = '';
      el.dataset.kind = '';
      return;
    }
    el.style.display = 'block';
    el.textContent = text;
    el.dataset.kind = isError ? 'error' : 'info';
  }


  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setTableSummary(text = '', isError = false) {
    setNotice(els.identityRequestsSummary, text, isError);
  }

  function setNotificationsSummary(text = '', isError = false) {
    setNotice(els.notificationsSummary, text, isError);
  }

  async function loadNotifications() {
    if (!els.notificationsBody) return;
    try {
      const outboxSummary = window.YWIOutbox?.getActionSummary?.('account') || { total: 0, conflicts: 0 };
      setNotificationsSummary(outboxSummary.total ? `Loading inbox… Pending local sync: ${outboxSummary.total}.` : 'Loading inbox...');
      const resp = await api.accountRecoveryAction({ action: 'list_my_notifications' });
      if (!resp?.ok) throw new Error(resp?.error || 'Unable to load activity inbox.');
      const rows = Array.isArray(resp.records) ? resp.records : [];
      els.notificationsBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(row.created_at || '')}</td>
          <td>${escHtml(row.notification_type || 'general')}</td>
          <td>${escHtml(row.title || 'Notification')}</td>
          <td>${escHtml(row.status || 'queued')}</td>
          <td>${escHtml(row.decision_status || 'pending')}</td>
          <td>${escHtml(row.message || row.body || '')}</td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="muted">No account activity yet.</td></tr>';
      setNotificationsSummary(rows.length ? `Loaded ${rows.length} activity item(s).${outboxSummary.total ? ` Pending local sync: ${outboxSummary.total}.` : ''}` : 'No account activity yet.');
    } catch (err) {
      els.notificationsBody.innerHTML = '<tr><td colspan="6" class="muted">Unable to load activity inbox.</td></tr>';
      setNotificationsSummary(err?.message || 'Unable to load activity inbox.', true);
    }
  }

  function queueAccountAction(actionType, payload, label) {
    window.YWIOutbox?.queueAction?.({ scope: 'account', action_type: actionType, payload, label });
    const summary = window.YWIOutbox?.getActionSummary?.('account');
    setNotice(els.summary, `Saved locally for retry when the connection returns.${summary?.total ? ` Pending sync items: ${summary.total}.` : ''}`, false);
  }

  async function retryPendingSync() {
    try {
      const result = await window.YWIOutbox?.retryQueuedActions?.({
        scope: 'account',
        handlers: {
          update_recovery_profile: (payload) => api.accountRecoveryAction({ action: 'update_recovery_profile', ...payload }),
          request_identity_change: (payload) => api.accountRecoveryAction({ action: 'request_identity_change', ...payload })
        }
      });
      await auth.refresh();
      await loadIdentityChangeRequests();
      await loadNotifications();
      setNotificationsSummary(result?.remaining ? `Retried sync. ${result.remaining} item(s) still need attention.` : 'All pending account sync items were sent.');
    } catch (err) {
      setNotificationsSummary(err?.message || 'Unable to retry pending account sync.', true);
    }
  }


  async function loadIdentityChangeRequests() {
    if (!els.identityRequestsBody) return;
    try {
      setTableSummary('Loading request history...');
      const resp = await api.accountRecoveryAction({ action: 'list_identity_change_requests' });
      if (!resp?.ok) throw new Error(resp?.error || 'Unable to load identity change history.');
      const rows = Array.isArray(resp.records) ? resp.records : [];
      els.identityRequestsBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(row.created_at || '')}</td>
          <td>${escHtml(row.requested_username || '—')}</td>
          <td>${escHtml(row.requested_email || '—')}</td>
          <td>${escHtml(row.request_status || 'pending')}</td>
          <td>${escHtml(row.reviewed_at || '—')}</td>
          <td>${escHtml(row.notes || '—')}</td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="muted">No identity change requests yet.</td></tr>';
      setTableSummary(rows.length ? `Loaded ${rows.length} identity change request(s).` : 'No identity change requests yet.');
    } catch (err) {
      els.identityRequestsBody.innerHTML = '<tr><td colspan="6" class="muted">Unable to load request history.</td></tr>';
      setTableSummary(err?.message || 'Unable to load identity change request history.', true);
    }
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
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) throw new Error('Password must include upper, lower, and number characters.');
    if (password !== confirm) throw new Error('Password confirmation does not match.');
  }

  function getDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        full_name: els.fullName?.value || '',
        username: els.username?.value || '',
        recovery_email: els.recoveryEmail?.value || '',
        requested_username: els.requestedUsername?.value || '',
        requested_email: els.requestedEmail?.value || '',
        phone: els.phone?.value || '',
        address_line1: els.address1?.value || '',
        address_line2: els.address2?.value || '',
        city: els.city?.value || '',
        province: els.province?.value || '',
        postal_code: els.postalCode?.value || ''
      }));
    } catch {}
  }

  function restoreDraft(state) {
    const draft = getDraft();
    const profile = state.profile || {};
    const pick = (draftValue, profileValue) => draftValue || profileValue || '';
    if (els.fullName) els.fullName.value = pick(draft.full_name, profile.full_name);
    if (els.username) els.username.value = pick(draft.username, profile.username);
    if (els.recoveryEmail) els.recoveryEmail.value = pick(draft.recovery_email, profile.recovery_email);
    if (els.requestedUsername) els.requestedUsername.value = pick(draft.requested_username, profile.pending_username);
    if (els.requestedEmail) els.requestedEmail.value = pick(draft.requested_email, profile.pending_email);
    if (els.phone) els.phone.value = pick(draft.phone, profile.phone);
    if (els.address1) els.address1.value = pick(draft.address_line1, profile.address_line1);
    if (els.address2) els.address2.value = pick(draft.address_line2, profile.address_line2);
    if (els.city) els.city.value = pick(draft.city, profile.city);
    if (els.province) els.province.value = pick(draft.province, profile.province);
    if (els.postalCode) els.postalCode.value = pick(draft.postal_code, profile.postal_code);
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }

  function collectProfilePayload() {
    return {
      full_name: els.fullName?.value?.trim?.() || '',
      username: els.username?.value?.trim?.() || '',
      recovery_email: els.recoveryEmail?.value?.trim?.() || '',
      phone: els.phone?.value?.trim?.() || '',
      address_line1: els.address1?.value?.trim?.() || '',
      address_line2: els.address2?.value?.trim?.() || '',
      city: els.city?.value?.trim?.() || '',
      province: els.province?.value?.trim?.() || '',
      postal_code: els.postalCode?.value?.trim?.() || ''
    };
  }

  function render(state) {
    const current = state || auth.getState?.() || {};
    const isAuthenticated = !!current.isAuthenticated;
    const role = current.role || current.profile?.role || 'worker';
    const access = security?.getAccessProfile ? security.getAccessProfile(role) : { roleLabel: role };
    const emailVerified = !!(current.user?.email_confirmed_at || current.user?.confirmed_at || current.profile?.email_verified);
    const phoneVerified = !!(current.profile?.phone_verified || current.profile?.phone_verified_at);
    const needsOnboarding = !!(isAuthenticated && (current.needsAccountSetup || !current.profile?.onboarding_completed_at));

    if (els.panel) els.panel.hidden = !isAuthenticated;
    if (els.signedOutNotice) els.signedOutNotice.style.display = isAuthenticated ? 'none' : 'block';
    if (els.onboarding) els.onboarding.hidden = !needsOnboarding;
    if (!isAuthenticated) {
      if (els.identityRequestsBody) els.identityRequestsBody.innerHTML = '<tr><td colspan="6" class="muted">Sign in to review identity change history.</td></tr>';
      if (els.notificationsBody) els.notificationsBody.innerHTML = '<tr><td colspan="6" class="muted">Sign in to view account activity.</td></tr>';
      return;
    }

    if (els.email) els.email.value = current.profile?.email || current.user?.email || '';
    if (els.role) els.role.value = access.roleLabel || role;
    if (els.emailStatus) els.emailStatus.value = emailVerified ? 'Verified' : 'Verification pending';
    if (els.phoneStatus) els.phoneStatus.value = phoneVerified ? 'Verified' : 'Verification pending';
    restoreDraft(current);
    if (els.hint) {
      const pending = [];
      if (current.profile?.pending_username) pending.push(`Username change pending: ${current.profile.pending_username}`);
      if (current.profile?.pending_email) pending.push(`Email change pending: ${current.profile.pending_email}`);
      els.hint.textContent = current.authFlow === 'recovery'
        ? 'Recovery sign-in complete. Save your new password now, then complete onboarding if this is your first password setup.'
        : pending.length
          ? pending.join(' • ')
          : (emailVerified ? 'Your email is verified. Use the password fields below for normal sign-in going forward.' : 'Verify your email once, then save a strong password for normal sign-in.');
    }
    setNotice(els.setupNotice, needsOnboarding ? 'First-run onboarding is still required. Complete your profile, choose a username, save a password, then mark onboarding complete.' : '');
    setNotice(els.onboardingNotice, needsOnboarding ? 'New users should finish onboarding before continuing into the rest of the app.' : '');
    loadIdentityChangeRequests();
    loadNotifications();
  }

  async function saveProfile() {
    const restore = setBusy(els.saveRecoveryBtn, 'Saving...');
    try {
      const payload = collectProfilePayload();
      const resp = await api.accountRecoveryAction({ action: 'update_recovery_profile', ...payload });
      if (!resp?.ok) throw new Error(resp?.error || 'Unable to save profile details.');
      clearDraft();
      setNotice(els.summary, 'Contact details saved.', false);
      await auth.refresh();
      await loadIdentityChangeRequests();
    } catch (err) {
      if (String(err?.message || '').toLowerCase().includes('offline') || String(err?.message || '').includes('HTTP 5')) {
        queueAccountAction('update_recovery_profile', collectProfilePayload(), 'Save account profile');
      } else {
        setNotice(els.summary, err?.message || 'Unable to save contact details.', true);
      }
    } finally {
      restore();
    }
  }

  async function savePassword() {
    const restore = setBusy(els.saveBtn, 'Saving...');
    try {
      validatePassword(els.password?.value || '', els.confirm?.value || '');
      await auth.changePassword(els.password?.value || '');
      if (els.password) els.password.value = '';
      if (els.confirm) els.confirm.value = '';
      setNotice(els.summary, 'Password saved. Daily sign-in should now use username/email + password.', false);
    } catch (err) {
      setNotice(els.summary, err?.message || 'Unable to save password.', true);
    } finally {
      restore();
    }
  }

  async function completeSetup() {
    const restore = setBusy(els.setupCompleteBtn, 'Completing...');
    try {
      validatePassword(els.password?.value || '', els.confirm?.value || '');
      await auth.changePassword(els.password?.value || '');
      await auth.refresh();
      const resp = await auth.markAccountSetupComplete(collectProfilePayload());
      if (!resp?.ok) throw new Error(resp?.error || 'Unable to complete account setup.');
      clearDraft();
      if (els.password) els.password.value = '';
      if (els.confirm) els.confirm.value = '';
      setNotice(els.summary, 'Account setup completed. You can now sign in normally with username/email + password.', false);
      if (window.YWIRouter?.showSection) window.YWIRouter.showSection('toolbox', { skipFocus: true });
    } catch (err) {
      setNotice(els.summary, err?.message || 'Unable to complete account setup.', true);
    } finally {
      restore();
    }
  }

  async function sendResetFromSettings() {
    const restore = setBusy(els.resetPasswordEmailBtn, 'Sending...');
    try {
      const login = els.username?.value?.trim?.() || els.email?.value?.trim?.() || '';
      await auth.resetPassword(login);
      setNotice(els.summary, 'Password reset email sent. Use the newest email, then return here to save your new password.', false);
    } catch (err) {
      setNotice(els.summary, err?.message || 'Unable to send password reset email.', true);
    } finally {
      restore();
    }
  }

  async function requestIdentityChange() {
    const restore = setBusy(els.requestIdentityChangeBtn, 'Requesting...');
    try {
      const resp = await api.accountRecoveryAction({
        action: 'request_identity_change',
        requested_username: els.requestedUsername?.value?.trim?.() || '',
        requested_email: els.requestedEmail?.value?.trim?.() || ''
      });
      if (!resp?.ok) throw new Error(resp?.error || 'Unable to request identity change.');
      setNotice(els.summary, resp?.message || 'Identity change request sent.', false);
      await auth.refresh();
      await loadIdentityChangeRequests();
    } catch (err) {
      if (String(err?.message || '').toLowerCase().includes('offline') || String(err?.message || '').includes('HTTP 5')) {
        queueAccountAction('request_identity_change', { requested_username: els.requestedUsername?.value?.trim?.() || '', requested_email: els.requestedEmail?.value?.trim?.() || '' }, 'Request identity change');
      } else {
        setNotice(els.summary, err?.message || 'Unable to request identity change.', true);
      }
    } finally {
      restore();
    }
  }

  async function resendEmailVerification() {
    const restore = setBusy(els.resendEmailBtn, 'Sending...');
    try {
      await auth.resendEmailVerification();
      setNotice(els.summary, 'Email verification sent.', false);
    } catch (err) {
      setNotice(els.summary, err?.message || 'Unable to resend email verification.', true);
    } finally {
      restore();
    }
  }

  async function requestPhoneVerification() {
    const restore = setBusy(els.requestPhoneBtn, 'Requesting...');
    try {
      const resp = await api.requestPhoneVerification({ phone: els.phone?.value?.trim?.() || '' });
      if (!resp?.ok) throw new Error(resp?.error || 'Phone verification request failed.');
      setNotice(els.summary, 'Phone verification requested.', false);
      await auth.refresh();
    } catch (err) {
      setNotice(els.summary, err?.message || 'Phone verification request failed.', true);
    } finally {
      restore();
    }
  }

  async function sendPhoneCode() {
    const restore = setBusy(els.sendPhoneCodeBtn, 'Sending...');
    try {
      const resp = await api.sendPhoneVerificationCode({ phone: els.phone?.value?.trim?.() || '' });
      if (!resp?.ok) throw new Error(resp?.error || 'SMS code send failed.');
      setNotice(els.summary, 'SMS verification code sent.', false);
    } catch (err) {
      setNotice(els.summary, err?.message || 'SMS code send failed.', true);
    } finally {
      restore();
    }
  }

  async function verifyPhoneCode() {
    const restore = setBusy(els.verifyPhoneCodeBtn, 'Verifying...');
    try {
      const resp = await api.verifyPhoneCode({ phone: els.phone?.value?.trim?.() || '', code: els.code?.value?.trim?.() || '' });
      if (!resp?.ok) throw new Error(resp?.error || 'SMS verification failed.');
      setNotice(els.summary, 'Phone verified.', false);
      await auth.refresh();
    } catch (err) {
      setNotice(els.summary, err?.message || 'SMS verification failed.', true);
    } finally {
      restore();
    }
  }

  async function completeOnboarding() {
    const restore = setBusy(els.onboardingCompleteBtn, 'Saving...');
    try {
      const resp = await api.accountRecoveryAction({ action: 'complete_onboarding' });
      if (!resp?.ok) throw new Error(resp?.error || 'Unable to complete onboarding.');
      setNotice(els.onboardingNotice, 'Onboarding complete. You can continue using the app normally.', false);
      await auth.refresh();
      if (window.YWIRouter?.showSection) window.YWIRouter.showSection('settings', { skipFocus: true });
    } catch (err) {
      setNotice(els.onboardingNotice, err?.message || 'Unable to complete onboarding.', true);
    } finally {
      restore();
    }
  }

  async function logoutEverywhere() {
    try { await auth.logoutEverywhere(); } catch (err) { setNotice(els.summary, err?.message || 'Unable to log out everywhere.', true); }
  }

  async function logoutThisDevice() {
    try { await auth.logout(); } catch (err) { setNotice(els.summary, err?.message || 'Unable to log out.', true); }
  }

  function bind() {
    [els.fullName, els.username, els.recoveryEmail, els.requestedUsername, els.requestedEmail, els.phone, els.address1, els.address2, els.city, els.province, els.postalCode].forEach((el) => {
      if (el && el.dataset.boundDraft !== '1') {
        el.dataset.boundDraft = '1';
        el.addEventListener('input', saveDraft);
      }
    });
    if (els.saveRecoveryBtn) els.saveRecoveryBtn.addEventListener('click', saveProfile);
    if (els.saveBtn) els.saveBtn.addEventListener('click', savePassword);
    if (els.setupCompleteBtn) els.setupCompleteBtn.addEventListener('click', completeSetup);
    if (els.requestIdentityChangeBtn) els.requestIdentityChangeBtn.addEventListener('click', requestIdentityChange);
    if (els.resetPasswordEmailBtn) els.resetPasswordEmailBtn.addEventListener('click', sendResetFromSettings);
    if (els.resendEmailBtn) els.resendEmailBtn.addEventListener('click', resendEmailVerification);
    if (els.requestPhoneBtn) els.requestPhoneBtn.addEventListener('click', requestPhoneVerification);
    if (els.sendPhoneCodeBtn) els.sendPhoneCodeBtn.addEventListener('click', sendPhoneCode);
    if (els.verifyPhoneCodeBtn) els.verifyPhoneCodeBtn.addEventListener('click', verifyPhoneCode);
    if (els.logoutAllBtn) els.logoutAllBtn.addEventListener('click', logoutEverywhere);
    if (els.logoutThisBtn) els.logoutThisBtn.addEventListener('click', logoutThisDevice);
    if (els.onboardingOpenSettings) els.onboardingOpenSettings.addEventListener('click', () => window.YWIRouter?.showSection?.('settings', { skipFocus: true }));
    if (els.onboardingCompleteBtn) els.onboardingCompleteBtn.addEventListener('click', completeOnboarding);
    if (els.reloadIdentityRequestsBtn) els.reloadIdentityRequestsBtn.addEventListener('click', loadIdentityChangeRequests);
    if (els.reloadNotificationsBtn) els.reloadNotificationsBtn.addEventListener('click', loadNotifications);
    if (els.retrySyncBtn) els.retrySyncBtn.addEventListener('click', retryPendingSync);
  }

  bind();
  render(auth.getState?.() || {});
  document.addEventListener('ywi:auth-changed', (e) => render(e.detail?.state || auth.getState?.() || {}));
})();
