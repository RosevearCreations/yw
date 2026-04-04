/* File: js/account-ui.js
   Brief description: In-app account security and onboarding module.
   Renders onboarding + Settings panels, supports account setup after magic-link validation,
   password setup/change/reset, contact/address updates, autosave drafts, phone verification,
   and username/email change request workflows with confirmation history.
   Includes onboarding-safe guards so authenticated inbox/history calls do not fire too early.
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

  function draftKey() {
    const authState = window.YWI_AUTH?.getState?.() || {};
    const userId = authState.user?.id || authState.profile?.id || 'anonymous';
    return `ywi_account_settings_draft_v1:${userId}`;
  }

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
          <p class="section-subtitle">Finish your account details, save a password, and complete first-run onboarding.</p>
        </div>
      </div>
      <div id="onboardingNotice" class="notice" style="display:none;margin-bottom:12px;"></div>
      <div class="form-footer">
        <button id="onboarding_open_settings" class="secondary" type="button">Open Settings</button>
        <button id="onboarding_complete" class="primary" type="button">Mark Onboarding Complete</button>
      </div>
    `;
    main.prepend(section);
  }

  function ensureLayout() {
    if (document.getElementById('accountPanel')) return;
    const section = document.getElementById('settings') || document.querySelector('main') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'accountPanel';
    wrap.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>Account & Security</h2>
          <p class="section-subtitle">Profile, password, recovery, verification, and identity change tools.</p>
        </div>
      </div>

      <div id="accountSetupNotice" class="notice" style="display:none;margin-bottom:14px;"></div>
      <div id="account_summary" class="notice" style="display:none;margin-bottom:14px;"></div>

      <div class="grid">
        <label>Full Name
          <input id="account_full_name" type="text" placeholder="Full name" />
        </label>
        <label>Email
          <input id="account_email" type="email" readonly />
        </label>
        <label>Role
          <input id="account_role" type="text" readonly />
        </label>
        <label>Username
          <input id="account_username" type="text" placeholder="Choose a username" />
        </label>
        <label>Recovery Email
          <input id="account_recovery_email" type="email" placeholder="Recovery email" />
        </label>
        <label>Phone
          <input id="account_phone" type="text" placeholder="Phone" />
        </label>
        <label>Address Line 1
          <input id="account_address_line1" type="text" placeholder="Address line 1" />
        </label>
        <label>Address Line 2
          <input id="account_address_line2" type="text" placeholder="Address line 2" />
        </label>
        <label>City
          <input id="account_city" type="text" placeholder="City" />
        </label>
        <label>Province
          <input id="account_province" type="text" placeholder="Province" />
        </label>
        <label>Postal Code
          <input id="account_postal_code" type="text" placeholder="Postal code" />
        </label>
      </div>

      <div class="grid" style="margin-top:14px;">
        <label>Email Status
          <input id="account_email_status" type="text" readonly />
        </label>
        <label>Phone Status
          <input id="account_phone_status" type="text" readonly />
        </label>
      </div>

      <form id="account_password_form" autocomplete="on">
        <div class="grid" style="margin-top:14px;">
          <label>New Password
            <input id="account_password" type="password" placeholder="New password" autocomplete="new-password" />
          </label>
          <label>Confirm Password
            <input id="account_password_confirm" type="password" placeholder="Confirm password" autocomplete="new-password" />
          </label>
          <label>Verification Code
            <input id="account_phone_code" type="text" placeholder="SMS code" />
          </label>
        </div>

        <div id="account_password_hint" class="muted" style="margin-top:10px;"></div>

        <div class="form-footer" style="margin-top:14px;">
          <button id="account_recovery_save" class="secondary" type="button">Save Contact Details</button>
          <button id="account_password_save" class="secondary" type="submit">Save Password</button>
          <button id="account_setup_complete" class="primary" type="button">Complete Account Setup</button>
        </div>
      </form>

      <hr style="margin:18px 0;" />

      <div class="section-heading">
        <div>
          <h3 style="margin:0;">Verification</h3>
          <p class="section-subtitle">Email verification, phone review, and device/session actions.</p>
        </div>
      </div>

      <div class="form-footer">
        <button id="account_resend_email_verification" class="secondary" type="button">Resend Email Verification</button>
        <button id="account_request_phone_verification" class="secondary" type="button">Request Phone Verification</button>
        <button id="account_send_phone_code" class="secondary" type="button">Send Phone Code</button>
        <button id="account_verify_phone_code" class="secondary" type="button">Verify Phone Code</button>
        <button id="account_reset_password_email" class="secondary" type="button">Send Password Reset Email</button>
        <button id="account_logout_all" class="secondary" type="button">Log Out Everywhere</button>
        <button id="account_logout_this" class="secondary" type="button">Log Out This Device</button>
      </div>

      <hr style="margin:18px 0;" />

      <div class="section-heading">
        <div>
          <h3 style="margin:0;">Identity Change Request</h3>
          <p class="section-subtitle">Request username or email changes for approval.</p>
        </div>
      </div>

      <div class="grid">
        <label>Requested Username
          <input id="account_requested_username" type="text" placeholder="New username" />
        </label>
        <label>Requested Email
          <input id="account_requested_email" type="email" placeholder="New email" />
        </label>
      </div>
      <div class="form-footer" style="margin-top:12px;">
        <button id="account_request_identity_change" class="secondary" type="button">Request Identity Change</button>
      </div>

      <div class="section-heading" style="margin-top:18px;">
        <div>
          <h3 style="margin:0;">Support & Session Health</h3>
          <p class="section-subtitle">Run a signed-in health check and export diagnostics for troubleshooting.</p>
        </div>
        <div class="admin-heading-actions">
          <button id="account_run_session_health" class="secondary" type="button">Run Session Health Check</button>
          <button id="account_export_support" class="secondary" type="button">Export Support Snapshot</button>
        </div>
      </div>
      <div id="account_session_health_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
      <pre id="account_session_health_output" class="code-block" style="display:none;max-height:260px;overflow:auto;white-space:pre-wrap;"></pre>


      <div class="section-heading" style="margin-top:18px;">
        <div>
          <h3 style="margin:0;">Conflict Review</h3>
          <p class="section-subtitle">Compare queued local account updates against the current server-backed profile and decide whether to retry, keep the local version, or discard it.</p>
        </div>
        <div class="admin-heading-actions">
          <button id="account_reload_conflicts" class="secondary" type="button">Refresh Conflicts</button>
        </div>
      </div>
      <div id="account_conflict_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
      <div class="table-scroll">
        <table id="account_conflicts_table">
          <thead><tr><th>Queued</th><th>Action</th><th>Status</th><th>Local Draft</th><th>Current Server Values</th><th>Actions</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="section-heading" style="margin-top:18px;">
        <div>
          <h3 style="margin:0;">Activity Inbox</h3>
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

      <div class="section-heading" style="margin-top:18px;">
        <div>
          <h3 style="margin:0;">Identity Change History</h3>
        </div>
        <div class="admin-heading-actions">
          <button id="account_reload_identity_requests" class="secondary" type="button">Reload History</button>
        </div>
      </div>
      <div id="account_identity_requests_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
      <div class="table-scroll">
        <table id="account_identity_requests_table">
          <thead><tr><th>Requested</th><th>Username</th><th>Email</th><th>Status</th><th>Reviewed</th><th>Notes</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>

      <div id="accountSignedOutNotice" class="notice" style="display:none;margin-top:14px;">Sign in to manage your account, password, and recovery settings.</div>
    `;
    section.appendChild(wrap);
  }

  ensureOnboardingSection();
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
    passwordForm: document.getElementById('account_password_form'),
    saveBtn: document.getElementById('account_password_save'),
    requestIdentityChangeBtn: document.getElementById('account_request_identity_change'),
    sessionHealthBtn: document.getElementById('account_run_session_health'),
    exportSupportBtn: document.getElementById('account_export_support'),
    sessionHealthSummary: document.getElementById('account_session_health_summary'),
    sessionHealthOutput: document.getElementById('account_session_health_output'),
    resetPasswordEmailBtn: document.getElementById('account_reset_password_email'),
    logoutAllBtn: document.getElementById('account_logout_all'),
    logoutThisBtn: document.getElementById('account_logout_this'),
    summary: document.getElementById('account_summary'),
    hint: document.getElementById('account_password_hint'),
    signedOutNotice: document.getElementById('accountSignedOutNotice'),
    reloadIdentityRequestsBtn: document.getElementById('account_reload_identity_requests'),
    conflictSummary: document.getElementById('account_conflict_summary'),
    conflictBody: document.querySelector('#account_conflicts_table tbody'),
    reloadConflictsBtn: document.getElementById('account_reload_conflicts'),
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


  function setPreformatted(el, value = '') {
    if (!el) return;
    const text = String(value || '').trim();
    if (!text) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'block';
    el.textContent = text;
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


  function buildServerConflictSnapshot(authState = getAuthState()) {
    const profile = authState.profile || {};
    return {
      full_name: profile.full_name || '',
      username: profile.username || '',
      recovery_email: profile.recovery_email || '',
      phone: profile.phone || '',
      address_line1: profile.address_line1 || '',
      address_line2: profile.address_line2 || '',
      city: profile.city || '',
      province: profile.province || '',
      postal_code: profile.postal_code || '',
      pending_username: profile.pending_username || '',
      pending_email: profile.pending_email || ''
    };
  }

  function renderConflictTable() {
    if (!els.conflictBody) return;
    const summary = window.YWIOutbox?.getActionSummary?.('account') || { items: [] };
    const serverSnapshot = buildServerConflictSnapshot();
    const rows = Array.isArray(summary.items) ? summary.items.filter((item) => item.status === 'conflict' || Number(item.merge_count || 0) > 0) : [];
    els.conflictBody.innerHTML = rows.map((item) => `
      <tr>
        <td>${escHtml(item.updated_at || item.queued_at || '')}</td>
        <td>${escHtml(item.label || item.action_type || '')}</td>
        <td>${escHtml(item.status || 'pending')}</td>
        <td><pre class="code-block" style="max-width:260px;white-space:pre-wrap;">${escHtml(JSON.stringify(item.payload || {}, null, 2))}</pre></td>
        <td><pre class="code-block" style="max-width:260px;white-space:pre-wrap;">${escHtml(JSON.stringify(serverSnapshot, null, 2))}</pre></td>
        <td>
          <div class="table-actions" style="display:flex;flex-wrap:wrap;gap:6px;">
            <button class="secondary" data-account-conflict-action="retry" data-id="${escHtml(item.id)}">Retry</button>
            <button class="secondary" data-account-conflict-action="keep_local" data-id="${escHtml(item.id)}">Keep Local</button>
            <button class="secondary" data-account-conflict-action="discard" data-id="${escHtml(item.id)}">Discard</button>
          </div>
          ${item.error ? `<div class="muted" style="margin-top:6px;">${escHtml(item.error)}</div>` : ''}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="muted">No queued account conflicts are waiting for review.</td></tr>';
    setNotice(
      els.conflictSummary,
      rows.length ? `${rows.length} queued account item(s) need review.` : 'No queued account conflicts are waiting for review.',
      rows.length > 0
    );
  }

  async function handleConflictTableClick(event) {
    const btn = event.target.closest('[data-account-conflict-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-account-conflict-action');
    const id = btn.getAttribute('data-id');
    if (!id) return;
    try {
      if (action === 'discard') {
        window.YWIOutbox?.removeActionItem?.(id);
        renderConflictTable();
        return;
      }
      if (action === 'keep_local') {
        window.YWIOutbox?.resolveActionConflict?.(id, { status: 'pending', error: '' });
        renderConflictTable();
        return;
      }
      if (action === 'retry') {
        const item = window.YWIOutbox?.getActionItem?.(id);
        if (!item) throw new Error('Queued item was not found.');
        const handlerMap = {
          update_recovery_profile: (payload) => api.accountRecoveryAction({ action: 'update_recovery_profile', ...payload }),
          request_identity_change: (payload) => api.accountRecoveryAction({ action: 'request_identity_change', ...payload })
        };
        const handler = handlerMap[item.action_type];
        if (!handler) throw new Error('No retry handler is available for this queued item.');
        await handler(item.payload || {});
        window.YWIOutbox?.removeActionItem?.(id);
        await auth.refresh();
        await loadIdentityChangeRequests();
        await loadNotifications();
        renderConflictTable();
      }
    } catch (err) {
      setNotice(els.conflictSummary, err?.message || 'Unable to update the queued conflict item.', true);
    }
  }


  function getAuthState() {
    return window.YWI_AUTH?.getState?.() || auth.getState?.() || {};
  }

  function isSafeForProtectedAccountCalls() {
    const authState = getAuthState();
    return !!(
      authState.isAuthenticated &&
      !authState.pendingAuthResolution &&
      !authState.needsAccountSetup &&
      authState.session?.access_token
    );
  }

  async function loadNotifications() {
    if (!els.notificationsBody) return;

    if (!isSafeForProtectedAccountCalls()) {
      els.notificationsBody.innerHTML = '<tr><td colspan="6" class="muted">Available after account setup is complete.</td></tr>';
      setNotificationsSummary('Inbox will load after account setup is complete.');
      return;
    }

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
      renderConflictTable();
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

    if (!isSafeForProtectedAccountCalls()) {
      els.identityRequestsBody.innerHTML = '<tr><td colspan="6" class="muted">Available after account setup is complete.</td></tr>';
      setTableSummary('Identity change history will load after account setup is complete.');
      return;
    }

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
      renderConflictTable();
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
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new Error('Password must include upper, lower, and number characters.');
    }
    if (password !== confirm) throw new Error('Password confirmation does not match.');
  }

  function getDraft() {
    try {
      return JSON.parse(localStorage.getItem(draftKey()) || '{}');
    } catch {
      return {};
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
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
    try {
      localStorage.removeItem(draftKey());
    } catch {}
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
    const current = state || getAuthState();
    const isAuthenticated = !!current.isAuthenticated;
    const role = current.role || current.profile?.role || 'worker';
    const access = security?.getAccessProfile ? security.getAccessProfile(role) : { roleLabel: role };
    const emailVerified = !!(current.user?.email_confirmed_at || current.user?.confirmed_at || current.profile?.email_verified);
    const phoneVerified = !!(current.profile?.phone_verified || current.profile?.phone_verified_at);
    const usernameReady = !!String(current.profile?.username || '').trim();
    const passwordReady = current.profile?.password_login_ready === true;
    const setupComplete = !!current.profile?.account_setup_completed_at;
    const needsOnboarding = !!(isAuthenticated && (!usernameReady || !passwordReady || !setupComplete));

    if (els.panel) els.panel.hidden = !isAuthenticated;
    if (els.signedOutNotice) els.signedOutNotice.style.display = isAuthenticated ? 'none' : 'block';
    if (els.onboarding) els.onboarding.hidden = !needsOnboarding;
    if (!needsOnboarding) {
      setNotice(els.onboardingNotice, '');
    }

    if (!isAuthenticated) {
      setNotice(els.sessionHealthSummary, '');
      setPreformatted(els.sessionHealthOutput, '');
      if (els.identityRequestsBody) {
        els.identityRequestsBody.innerHTML = '<tr><td colspan="6" class="muted">Sign in to review identity change history.</td></tr>';
      }
      if (els.notificationsBody) {
        els.notificationsBody.innerHTML = '<tr><td colspan="6" class="muted">Sign in to view account activity.</td></tr>';
      }
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

    setNotice(
      els.setupNotice,
      needsOnboarding
        ? 'First-run onboarding is still required. Complete your profile, choose a username, save a password, then mark onboarding complete.'
        : ''
    );

    setNotice(
      els.onboardingNotice,
      needsOnboarding
        ? 'New users should finish onboarding before continuing into the rest of the app.'
        : ''
    );

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
      const message = String(err?.message || '');
      if (message.toLowerCase().includes('offline') || message.includes('HTTP 5')) {
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
      if (window.YWIRouter?.showSection) {
        window.YWIRouter.showSection('toolbox', { skipFocus: true });
      }
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
      const message = String(err?.message || '');
      if (message.toLowerCase().includes('offline') || message.includes('HTTP 5')) {
        queueAccountAction(
          'request_identity_change',
          {
            requested_username: els.requestedUsername?.value?.trim?.() || '',
            requested_email: els.requestedEmail?.value?.trim?.() || ''
          },
          'Request identity change'
        );
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
      const resp = await api.verifyPhoneCode({
        phone: els.phone?.value?.trim?.() || '',
        code: els.code?.value?.trim?.() || ''
      });
      if (!resp?.ok) throw new Error(resp?.error || 'SMS verification failed.');
      setNotice(els.summary, 'Phone verified.', false);
      await auth.refresh();
    } catch (err) {
      setNotice(els.summary, err?.message || 'SMS verification failed.', true);
    } finally {
      restore();
    }
  }


  async function runSessionHealthCheck() {
    const restore = setBusy(els.sessionHealthBtn, 'Checking...');
    try {
      const payload = await api.fetchSessionHealth();
      const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];
      setNotice(
        els.sessionHealthSummary,
        warnings.length
          ? `Session health completed with ${warnings.length} warning(s).`
          : 'Session health completed with no warnings.',
        warnings.length > 0
      );
      setPreformatted(els.sessionHealthOutput, JSON.stringify(payload || {}, null, 2));
    } catch (err) {
      setNotice(els.sessionHealthSummary, err?.message || 'Session health check failed.', true);
      setPreformatted(els.sessionHealthOutput, '');
    } finally {
      restore();
    }
  }

  async function exportSupportSnapshot() {
    const restore = setBusy(els.exportSupportBtn, 'Exporting...');
    try {
      let sessionHealth = null;
      try {
        sessionHealth = await api.fetchSessionHealth();
      } catch (err) {
        sessionHealth = { ok: false, error: err?.message || 'Session health unavailable.' };
      }
      const supportSnapshot = {
        exported_at: new Date().toISOString(),
        location_hash: window.location.hash || '',
        runtime: window.YWI_BOOT?.getState?.() || {},
        auth: window.YWI_AUTH?.getState?.() || {},
        diagnostics: window.YWIAppDiagnostics?.getItems?.() || [],
        module_timings: window.YWIModuleTimings?.getItems?.() || [],
        smoke_check: window.__YWI_LAST_SMOKE_CHECK || null,
        session_health: sessionHealth
      };
      const blob = new Blob([JSON.stringify(supportSnapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ywi-support-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice(els.sessionHealthSummary, 'Support snapshot exported.', false);
      setPreformatted(els.sessionHealthOutput, JSON.stringify({
        exported_at: supportSnapshot.exported_at,
        diagnostics_count: supportSnapshot.diagnostics.length,
        module_timing_count: supportSnapshot.module_timings.length,
        has_smoke_check: !!supportSnapshot.smoke_check,
        session_health_ok: !!supportSnapshot.session_health?.ok
      }, null, 2));
    } catch (err) {
      setNotice(els.sessionHealthSummary, err?.message || 'Support snapshot export failed.', true);
    } finally {
      restore();
    }
  }

  async function completeOnboarding() {
    const restore = setBusy(els.onboardingCompleteBtn, 'Saving...');
    try {
      const current = auth.getState?.() || {};
      const usernameReady = !!String(current.profile?.username || els.username?.value || '').trim();
      const passwordReady = current.profile?.password_login_ready === true;
      if (!usernameReady || !passwordReady) {
        throw new Error('Before completing onboarding, save a username and password first.');
      }
      const resp = await api.accountRecoveryAction({ action: 'complete_onboarding' });
      if (!resp?.ok) throw new Error(resp?.error || 'Unable to complete onboarding.');
      setNotice(els.onboardingNotice, resp?.message || 'Onboarding complete. You can continue using the app normally.', false);
      setNotice(els.summary, 'Onboarding complete. The standard app screens should now be available.', false);
      await auth.refresh();
      render();
      window.dispatchEvent(new CustomEvent('ywi:app-error', { detail: { scope: 'onboarding', message: 'Onboarding completed successfully.' } }));
      if (window.YWIRouter?.showSection) {
        window.YWIRouter.showSection('toolbox', { skipFocus: true });
      }
    } catch (err) {
      setNotice(els.onboardingNotice, err?.message || 'Unable to complete onboarding.', true);
      setNotice(els.summary, err?.message || 'Unable to complete onboarding.', true);
    } finally {
      restore();
    }
  }

  async function logoutEverywhere() {
    try {
      await auth.logoutEverywhere();
    } catch (err) {
      setNotice(els.summary, err?.message || 'Unable to log out everywhere.', true);
    }
  }

  async function logoutThisDevice() {
    try {
      await auth.logout();
    } catch (err) {
      setNotice(els.summary, err?.message || 'Unable to log out.', true);
    }
  }

  function bind() {
    [
      els.fullName,
      els.username,
      els.recoveryEmail,
      els.requestedUsername,
      els.requestedEmail,
      els.phone,
      els.address1,
      els.address2,
      els.city,
      els.province,
      els.postalCode
    ].forEach((el) => {
      if (el && el.dataset.boundDraft !== '1') {
        el.dataset.boundDraft = '1';
        el.addEventListener('input', saveDraft);
      }
    });

    if (els.saveRecoveryBtn) els.saveRecoveryBtn.addEventListener('click', saveProfile);
    if (els.passwordForm && els.passwordForm.dataset.bound !== '1') {
      els.passwordForm.dataset.bound = '1';
      els.passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        savePassword();
      });
    }
    if (els.saveBtn) els.saveBtn.addEventListener('click', savePassword);
    if (els.setupCompleteBtn) els.setupCompleteBtn.addEventListener('click', completeSetup);
    if (els.requestIdentityChangeBtn) els.requestIdentityChangeBtn.addEventListener('click', requestIdentityChange);
    if (els.sessionHealthBtn) els.sessionHealthBtn.addEventListener('click', runSessionHealthCheck);
    if (els.exportSupportBtn) els.exportSupportBtn.addEventListener('click', exportSupportSnapshot);
    if (els.resetPasswordEmailBtn) els.resetPasswordEmailBtn.addEventListener('click', sendResetFromSettings);
    if (els.resendEmailBtn) els.resendEmailBtn.addEventListener('click', resendEmailVerification);
    if (els.requestPhoneBtn) els.requestPhoneBtn.addEventListener('click', requestPhoneVerification);
    if (els.sendPhoneCodeBtn) els.sendPhoneCodeBtn.addEventListener('click', sendPhoneCode);
    if (els.verifyPhoneCodeBtn) els.verifyPhoneCodeBtn.addEventListener('click', verifyPhoneCode);
    if (els.logoutAllBtn) els.logoutAllBtn.addEventListener('click', logoutEverywhere);
    if (els.logoutThisBtn) els.logoutThisBtn.addEventListener('click', logoutThisDevice);
    if (els.onboardingOpenSettings) {
      els.onboardingOpenSettings.addEventListener('click', () => window.YWIRouter?.showSection?.('settings', { skipFocus: true }));
    }
    if (els.onboardingCompleteBtn) els.onboardingCompleteBtn.addEventListener('click', completeOnboarding);
    if (els.reloadIdentityRequestsBtn) els.reloadIdentityRequestsBtn.addEventListener('click', loadIdentityChangeRequests);
    if (els.reloadConflictsBtn) els.reloadConflictsBtn.addEventListener('click', renderConflictTable);
    if (els.conflictBody) els.conflictBody.addEventListener('click', handleConflictTableClick);
    if (els.reloadNotificationsBtn) els.reloadNotificationsBtn.addEventListener('click', loadNotifications);
    if (els.retrySyncBtn) els.retrySyncBtn.addEventListener('click', retryPendingSync);
  }

  bind();
  render(getAuthState());
  document.addEventListener('ywi:auth-changed', (e) => render(e.detail?.state || getAuthState()));
})();
