/* File: js/admin-ui.js
   Brief description: Admin Dashboard UI controller.
   Renders a live approval/notification panel with approve/reject/resolve actions,
   deploy smoke checks, queued admin action retry, and lightweight directory counts.
*/

'use strict';

(function () {
  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function createAdminUI(config = {}) {
    const loadAdminDirectory = config.loadAdminDirectory;
    const manageAdminEntity = window.YWIAPI?.manageAdminEntity;
    const manageSummary = config.manageSummary || function () {};
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const getAccessProfile = config.getAccessProfile || (() => ({
      canViewAdminDirectory: false,
      canManageAdminDirectory: false,
      roleLabel: 'Worker'
    }));

    const state = {
      locked: true,
      manageLocked: true,
      notifications: [],
      counts: { users: 0, sites: 0, assignments: 0, orders: 0 },
      users: [],
      salesOrders: [],
      accountingEntries: [],
      smokeChecks: []
    };

    const DRAFT_KEY = 'ywi_admin_workspace_draft_v2';

    function loadDraft() {
      try {
        return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      } catch {
        return {};
      }
    }

    function saveDraft() {
      const e = els();
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          notification_id: e.emailNotificationId?.value || '',
          email_to: e.emailTo?.value || '',
          email_subject: e.emailSubject?.value || '',
          email_body: e.emailBody?.value || '',
          queue_search: e.search?.value || '',
          queue_status: e.filterStatus?.value || '',
          smoke_summary: e.smokeSummary?.textContent || '',
          target_profile_id: e.passwordProfileId?.value || '',
          order_customer_name: e.orderCustomerName?.value || '',
          order_customer_email: e.orderCustomerEmail?.value || ''
        }));
      } catch {}
    }

    function restoreDraft() {
      const e = els();
      const draft = loadDraft();
      if (e.emailNotificationId && !e.emailNotificationId.value) e.emailNotificationId.value = draft.notification_id || '';
      if (e.emailTo && !e.emailTo.value) e.emailTo.value = draft.email_to || '';
      if (e.emailSubject && !e.emailSubject.value) e.emailSubject.value = draft.email_subject || '';
      if (e.emailBody && !e.emailBody.value) e.emailBody.value = draft.email_body || '';
      if (e.search && !e.search.value) e.search.value = draft.queue_search || '';
      if (e.filterStatus && !e.filterStatus.value) e.filterStatus.value = draft.queue_status || '';
      if (e.passwordProfileId && !e.passwordProfileId.value) e.passwordProfileId.value = draft.target_profile_id || '';
      if (e.orderCustomerName && !e.orderCustomerName.value) e.orderCustomerName.value = draft.order_customer_name || '';
      if (e.orderCustomerEmail && !e.orderCustomerEmail.value) e.orderCustomerEmail.value = draft.order_customer_email || '';
    }

    function ensureLayout() {
      const section = document.getElementById('admin');
      if (!section) return;
      if (section.dataset.adminLayoutReady === '1') return;
      section.dataset.adminLayoutReady = '1';
      section.innerHTML = `
        <div class="section-heading">
          <div>
            <h2>Admin</h2>
            <p class="section-subtitle">Visible approval queue, notification tools, retry controls, and high-level directory counts.</p>
          </div>
          <div class="admin-heading-actions">
            <button id="ad_reload" class="secondary" type="button">Reload</button>
          </div>
        </div>

        <div id="ad_summary" class="notice" style="display:none;margin-bottom:14px;"></div>

        <div class="admin-stats-grid" id="ad_stats_grid">
          <div class="admin-stat-card"><span>Users</span><strong id="ad_users_count">0</strong></div>
          <div class="admin-stat-card"><span>Sites</span><strong id="ad_sites_count">0</strong></div>
          <div class="admin-stat-card"><span>Assignments</span><strong id="ad_assignments_count">0</strong></div>
          <div class="admin-stat-card"><span>Queue</span><strong id="ad_notifications_count">0</strong></div>
          <div class="admin-stat-card"><span>Orders</span><strong id="ad_orders_count">0</strong></div>
        </div>



        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Admin Password Control</h3>
              <p class="section-subtitle">Allow an Admin to set a new password for any profile, including another Admin, with audit logging.</p>
            </div>
          </div>
          <form id="ad_password_form" autocomplete="on">
            <div class="grid">
              <label>Target Profile
                <select id="ad_password_profile_id"></select>
              </label>
              <label>New Password
                <input id="ad_password_new" type="password" placeholder="New password" autocomplete="new-password" />
              </label>
              <label>Confirm Password
                <input id="ad_password_confirm" type="password" placeholder="Confirm password" autocomplete="new-password" />
              </label>
            </div>
            <div class="grid" style="margin-top:12px;">
              <label>Reason
                <input id="ad_password_reason" type="text" placeholder="Reason for reset" />
              </label>
              <label style="display:flex;align-items:end;gap:8px;">
                <input id="ad_password_force_change" type="checkbox" />
                <span>Flag as temporary / force change at next sign-in</span>
              </label>
            </div>
            <div class="form-footer" style="margin-top:12px;">
              <button id="ad_password_set" class="secondary" type="submit">Set Password</button>
            </div>
          </form>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Orders and Accounting Stub</h3>
              <p class="section-subtitle">Create a basic order record and automatically create its first accounting row so later inventory, cost, revenue, and tax workflows have a clean starting point.</p>
            </div>
          </div>
          <div class="grid">
            <label>Customer Name
              <input id="ad_order_customer_name" type="text" placeholder="Customer name" />
            </label>
            <label>Customer Email
              <input id="ad_order_customer_email" type="email" placeholder="customer@example.com" />
            </label>
            <label>Order Status
              <select id="ad_order_status">
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
            </label>
          </div>
          <div class="grid" style="margin-top:12px;">
            <label>Subtotal
              <input id="ad_order_subtotal" type="number" step="0.01" min="0" value="0" />
            </label>
            <label>Tax
              <input id="ad_order_tax" type="number" step="0.01" min="0" value="0" />
            </label>
            <label>Total
              <input id="ad_order_total" type="number" step="0.01" min="0" value="0" />
            </label>
          </div>
          <label style="display:block;margin-top:12px;">Notes
            <textarea id="ad_order_notes" rows="3" placeholder="Basic accounting/order notes"></textarea>
          </label>
          <div class="form-footer" style="margin-top:12px;">
            <button id="ad_order_create" class="secondary" type="button">Create Order + Accounting Record</button>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_orders_table">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Created</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_accounting_table">
              <thead><tr><th>Entry</th><th>Source</th><th>Status</th><th>Total</th><th>Created</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Deploy Smoke Check</h3>
              <p class="section-subtitle">Check shell files, runtime config reachability, diagnostics state, startup timing, and bootstrap endpoints.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="ad_run_smoke" class="secondary" type="button">Run Smoke Check</button>
              <button id="ad_retry_sync" class="secondary" type="button">Retry Pending Admin Sync</button>
            </div>
          </div>
          <div id="ad_smoke_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
          <div class="table-scroll">
            <table id="ad_smoke_table">
              <thead>
                <tr><th>Check</th><th>Status</th><th>Details</th></tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Conflict Review</h3>
              <p class="section-subtitle">Review queued admin sync conflicts, compare local payloads, and decide whether to retry, keep the local draft, or discard it.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="ad_reload_conflicts" class="secondary" type="button">Refresh Conflicts</button>
            </div>
          </div>
          <div id="ad_conflict_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
          <div class="table-scroll">
            <table id="ad_conflicts_table">
              <thead><tr><th>Queued</th><th>Action</th><th>Status</th><th>Local Payload</th><th>Conflict</th><th>Actions</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Approval Queue</h3>
              <p class="section-subtitle">Approve, reject, resolve, preview email, test send, or retry failed delivery.</p>
            </div>
          </div>
          <div class="grid" style="margin-bottom:12px;">
            <label>Search
              <input id="ad_notification_search" type="text" placeholder="Search title, type, status, creator" />
            </label>
            <label>Status
              <select id="ad_notification_filter_status">
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="resolved">Resolved</option>
                <option value="failed">Failed delivery</option>
                <option value="dead_letter">Dead letter</option>
              </select>
            </label>
          </div>
          <div class="table-scroll">
            <table id="ad_notifications_table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Decision</th>
                  <th>Delivery</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Email Preview / Test Send</h3>
              <p class="section-subtitle">Choose a notification from the queue, preview the message, then test-send or retry it.</p>
            </div>
          </div>
          <div class="grid">
            <label>Notification ID
              <input id="ad_email_notification_id" type="text" readonly />
            </label>
            <label>To
              <input id="ad_email_to" type="text" placeholder="admin@example.com" />
            </label>
            <label>Subject
              <input id="ad_email_subject" type="text" placeholder="Notification subject" />
            </label>
          </div>
          <label style="display:block;margin-top:12px;">Body
            <textarea id="ad_email_body" rows="8" placeholder="Preview body will load here."></textarea>
          </label>
          <div class="form-footer" style="margin-top:12px;">
            <button id="ad_preview_email" class="secondary" type="button">Preview Email</button>
            <button id="ad_test_send_email" class="primary" type="button">Test Send</button>
            <button id="ad_retry_email" class="secondary" type="button">Retry Failed Send</button>
          </div>
        </div>
      `;
    }

    function els() {
      return {
        section: document.getElementById('admin'),
        summary: document.getElementById('ad_summary'),
        reloadBtn: document.getElementById('ad_reload'),
        usersCount: document.getElementById('ad_users_count'),
        sitesCount: document.getElementById('ad_sites_count'),
        assignmentsCount: document.getElementById('ad_assignments_count'),
        notificationsCount: document.getElementById('ad_notifications_count'),
        ordersCount: document.getElementById('ad_orders_count'),
        passwordForm: document.getElementById('ad_password_form'),
        passwordProfileId: document.getElementById('ad_password_profile_id'),
        passwordNew: document.getElementById('ad_password_new'),
        passwordConfirm: document.getElementById('ad_password_confirm'),
        passwordReason: document.getElementById('ad_password_reason'),
        passwordForceChange: document.getElementById('ad_password_force_change'),
        passwordSetBtn: document.getElementById('ad_password_set'),
        orderCustomerName: document.getElementById('ad_order_customer_name'),
        orderCustomerEmail: document.getElementById('ad_order_customer_email'),
        orderStatus: document.getElementById('ad_order_status'),
        orderSubtotal: document.getElementById('ad_order_subtotal'),
        orderTax: document.getElementById('ad_order_tax'),
        orderTotal: document.getElementById('ad_order_total'),
        orderNotes: document.getElementById('ad_order_notes'),
        orderCreateBtn: document.getElementById('ad_order_create'),
        ordersBody: document.querySelector('#ad_orders_table tbody'),
        accountingBody: document.querySelector('#ad_accounting_table tbody'),
        search: document.getElementById('ad_notification_search'),
        filterStatus: document.getElementById('ad_notification_filter_status'),
        notificationsBody: document.querySelector('#ad_notifications_table tbody'),
        smokeBtn: document.getElementById('ad_run_smoke'),
        retrySyncBtn: document.getElementById('ad_retry_sync'),
        smokeSummary: document.getElementById('ad_smoke_summary'),
        smokeBody: document.querySelector('#ad_smoke_table tbody'),
        conflictSummary: document.getElementById('ad_conflict_summary'),
        conflictBody: document.querySelector('#ad_conflicts_table tbody'),
        reloadConflictsBtn: document.getElementById('ad_reload_conflicts'),
        emailNotificationId: document.getElementById('ad_email_notification_id'),
        emailTo: document.getElementById('ad_email_to'),
        emailSubject: document.getElementById('ad_email_subject'),
        emailBody: document.getElementById('ad_email_body'),
        previewBtn: document.getElementById('ad_preview_email'),
        testSendBtn: document.getElementById('ad_test_send_email'),
        retryBtn: document.getElementById('ad_retry_email')
      };
    }

    function setSummary(text = '', isError = false) {
      const e = els();
      if (!e.summary) return;
      if (!text) {
        e.summary.style.display = 'none';
        e.summary.textContent = '';
        e.summary.dataset.kind = '';
      } else {
        e.summary.style.display = 'block';
        e.summary.textContent = text;
        e.summary.dataset.kind = isError ? 'error' : 'info';
      }
      manageSummary(text);
    }

    function applyRoleAccess() {
      const access = getAccessProfile(getCurrentRole());
      state.locked = !access.canViewAdminDirectory;
      state.manageLocked = !access.canManageAdminDirectory;
      const e = els();
      if (e.section) e.section.dataset.adminLocked = state.locked ? 'true' : 'false';
      if (state.locked) {
        setSummary('Supervisor, HSE, Job Admin, or Admin access is required to use this section.', true);
      }
    }

    function filteredNotifications() {
      const e = els();
      const search = String(e.search?.value || '').trim().toLowerCase();
      const status = String(e.filterStatus?.value || '').trim().toLowerCase();
      return state.notifications.filter((row) => {
        const hay = [
          row.id,
          row.notification_type,
          row.title,
          row.message,
          row.status,
          row.decision_status,
          row.created_by_name
        ].join(' ').toLowerCase();
        const statusValue = String(row.decision_status || row.status || row.email_status || '').toLowerCase();
        const statusMatch = !status || statusValue === status;
        return (!search || hay.includes(search)) && statusMatch;
      });
    }

    function renderNotifications() {
      const e = els();
      if (!e.notificationsBody) return;
      const rows = filteredNotifications();
      if (e.notificationsCount) e.notificationsCount.textContent = String(rows.length);
      e.notificationsBody.innerHTML = '';
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(row.id)}</td>
          <td>${escHtml(row.notification_type)}</td>
          <td><strong>${escHtml(row.title || '')}</strong><div class="muted">${escHtml((row.message || '').slice(0, 120))}</div></td>
          <td>${escHtml(row.decision_status || row.status || '')}</td>
          <td>${escHtml(row.email_status || 'pending')}</td>
          <td>${escHtml(row.created_at || '')}</td>
          <td>
            <div class="table-actions" style="display:flex;flex-wrap:wrap;gap:6px;">
              ${state.manageLocked ? `<span class="muted">View only</span>` : `
                <button class="secondary" data-notification-action="approve" data-id="${escHtml(row.id)}">Approve</button>
                <button class="secondary" data-notification-action="reject" data-id="${escHtml(row.id)}">Reject</button>
                <button class="secondary" data-notification-action="resolve" data-id="${escHtml(row.id)}">Resolve</button>
                <button class="secondary" data-notification-action="preview_email" data-id="${escHtml(row.id)}">Preview</button>
                <button class="secondary" data-notification-action="test_send" data-id="${escHtml(row.id)}">Test Send</button>
                <button class="secondary" data-notification-action="retry_send" data-id="${escHtml(row.id)}">Retry</button>
              `}
            </div>
          </td>
        `;
        e.notificationsBody.appendChild(tr);
      });
    }

    function renderProfileOptions() {
      const e = els();
      if (!e.passwordProfileId) return;
      const current = e.passwordProfileId.value || '';
      e.passwordProfileId.innerHTML = '<option value="">Select profile</option>' + state.users.map((row) => `<option value="${escHtml(row.id)}">${escHtml(row.full_name || row.email || row.id)} (${escHtml(row.role || 'worker')})</option>`).join('');
      if (current) e.passwordProfileId.value = current;
    }

    function renderOrders() {
      const e = els();
      if (e.ordersBody) {
        e.ordersBody.innerHTML = state.salesOrders.map((row) => `<tr><td><strong>${escHtml(row.order_code || row.id)}</strong></td><td>${escHtml(row.customer_name || row.customer_email || '')}</td><td>${escHtml(row.order_status || '')}</td><td>${escHtml(row.currency_code || 'CAD')} ${escHtml(row.total_amount || 0)}</td><td>${escHtml(row.created_at || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No orders created yet.</td></tr>';
      }
      if (e.accountingBody) {
        e.accountingBody.innerHTML = state.accountingEntries.map((row) => `<tr><td><strong>${escHtml(row.entry_type || row.id)}</strong></td><td>${escHtml(row.source_type || '')} #${escHtml(row.source_id || '')}</td><td>${escHtml(row.entry_status || '')}</td><td>${escHtml(row.currency_code || 'CAD')} ${escHtml(row.total_amount || 0)}</td><td>${escHtml(row.created_at || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No accounting records created yet.</td></tr>';
      }
    }

    async function setAdminPassword() {
      const e = els();
      const profileId = e.passwordProfileId?.value?.trim?.() || '';
      const password = e.passwordNew?.value || '';
      const confirm = e.passwordConfirm?.value || '';
      if (!profileId) return setSummary('Choose a target profile for the password change.', true);
      if (!password) return setSummary('Enter a new password.', true);
      if (password !== confirm) return setSummary('Password confirmation does not match.', true);
      try {
        const resp = await manageAdminEntity({ entity: 'credential', action: 'set_password', profile_id: profileId, new_password: password, reason: e.passwordReason?.value || '', force_password_change: !!e.passwordForceChange?.checked });
        if (!resp?.ok) throw new Error(resp?.error || 'Password reset failed.');
        if (e.passwordNew) e.passwordNew.value = '';
        if (e.passwordConfirm) e.passwordConfirm.value = '';
        setSummary('Admin password change completed and audited.');
        await loadDirectory();
      } catch (err) {
        setSummary(String(err?.message || 'Password reset failed.'), true);
      }
    }

    async function createSalesOrder() {
      const e = els();
      try {
        const subtotal = Number(e.orderSubtotal?.value || 0);
        const tax = Number(e.orderTax?.value || 0);
        const total = Number(e.orderTotal?.value || subtotal + tax);
        const resp = await manageAdminEntity({ entity: 'sales_order', action: 'create', customer_name: e.orderCustomerName?.value || '', customer_email: e.orderCustomerEmail?.value || '', order_status: e.orderStatus?.value || 'draft', subtotal_amount: subtotal, tax_amount: tax, total_amount: total, notes: e.orderNotes?.value || '' });
        if (!resp?.ok) throw new Error(resp?.error || 'Order create failed.');
        setSummary(`Order ${resp?.record?.order_code || resp?.record?.id || ''} created with accounting entry ${resp?.accounting_record?.id || ''}.`);
        await loadDirectory();
      } catch (err) {
        setSummary(String(err?.message || 'Order create failed.'), true);
      }
    }

    function renderSmokeChecks(result = {}) {
      const e = els();
      if (!e.smokeBody) return;
      const checks = Array.isArray(result.checks) ? result.checks : [];
      state.smokeChecks = checks;
      e.smokeBody.innerHTML = '';
      for (const row of checks) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(row.scope || row.name || 'check')}</td>
          <td>${row.ok ? 'OK' : 'Fail'}</td>
          <td>${escHtml(row.message || row.details || '')}</td>
        `;
        e.smokeBody.appendChild(tr);
      }
      if (e.smokeSummary) {
        if (!checks.length) {
          e.smokeSummary.style.display = 'none';
          e.smokeSummary.textContent = '';
        } else {
          const failures = checks.filter((row) => !row.ok).length;
          e.smokeSummary.style.display = 'block';
          e.smokeSummary.dataset.kind = failures ? 'error' : 'info';
          e.smokeSummary.textContent = failures
            ? `Smoke check found ${failures} failing item(s).`
            : 'Smoke check passed.';
        }
      }
      saveDraft();
    }

    function hydratePreview(notificationId, preview = {}) {
      const e = els();
      if (e.emailNotificationId) e.emailNotificationId.value = notificationId ? String(notificationId) : '';
      if (e.emailTo) e.emailTo.value = preview.to || '';
      if (e.emailSubject) e.emailSubject.value = preview.subject || '';
      if (e.emailBody) e.emailBody.value = preview.body || '';
      saveDraft();
    }

    async function runNotificationAction(action, notificationId, extra = {}) {
      if (!manageAdminEntity) throw new Error('Admin manage API is unavailable.');
      const resp = await manageAdminEntity({
        entity: 'notification',
        action,
        notification_id: notificationId,
        ...extra
      });
      if (!resp?.ok) throw new Error(resp?.error || `Notification ${action} failed`);
      return resp;
    }

    async function onNotificationTableClick(event) {
      const btn = event.target.closest('[data-notification-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-notification-action');
      const notificationId = btn.getAttribute('data-id');
      if (!notificationId) return;

      let decisionNotes = '';
      try {
        if (action === 'approve' || action === 'reject' || action === 'resolve') {
          decisionNotes = window.prompt(`Optional note for ${action}:`, '') || '';
        }
        const resp = await runNotificationAction(action, notificationId, { decision_notes: decisionNotes });
        if (resp?.preview) hydratePreview(notificationId, resp.preview);
        setSummary(`Notification ${notificationId} ${action.replace('_', ' ')} complete.`);
        renderConflictTable();
      await loadDirectory();
      } catch (err) {
        const msg = String(err?.message || 'Notification action failed.');
        if (msg.toLowerCase().includes('offline') || msg.includes('HTTP 5')) {
          window.YWIOutbox?.queueAction?.({
            scope: 'admin',
            action_type: 'admin_notification_action',
            payload: {
              entity: 'notification',
              action,
              notification_id: notificationId,
              decision_notes: decisionNotes
            },
            label: `Notification ${action}`
          });
          setSummary('Notification action saved to the admin outbox for retry.');
        } else {
          setSummary(msg, true);
        }
      }
    }

    async function onPreviewButton(action) {
      const e = els();
      const notificationId = e.emailNotificationId?.value?.trim?.() || '';
      if (!notificationId) {
        setSummary('Choose a notification first from the approval queue.', true);
        return;
      }
      try {
        const resp = await runNotificationAction(action, notificationId, {
          email_to: e.emailTo?.value || '',
          email_subject: e.emailSubject?.value || '',
          email_body: e.emailBody?.value || ''
        });
        if (resp?.preview) hydratePreview(notificationId, resp.preview);
        saveDraft();
        setSummary(
          action === 'preview_email'
            ? `Preview ready for notification ${notificationId}.`
            : `Notification ${notificationId} ${action.replace('_', ' ')} complete.`
        );
        await loadDirectory();
      } catch (err) {
        const msg = String(err?.message || 'Email action failed.');
        if (msg.toLowerCase().includes('offline') || msg.includes('HTTP 5')) {
          window.YWIOutbox?.queueAction?.({
            scope: 'admin',
            action_type: 'admin_notification_action',
            payload: {
              entity: 'notification',
              action,
              notification_id: notificationId,
              email_to: e.emailTo?.value || '',
              email_subject: e.emailSubject?.value || '',
              email_body: e.emailBody?.value || ''
            },
            label: `Email ${action}`
          });
          setSummary('Email action saved to the admin outbox for retry.');
        } else {
          setSummary(msg, true);
        }
      }
    }

    async function runSmokeCheck() {
      const e = els();
      if (e.smokeBtn) {
        e.smokeBtn.disabled = true;
        e.smokeBtn.textContent = 'Running...';
      }

      try {
        if (typeof window.YWIAPI?.runSmokeCheck === 'function') {
          const result = await window.YWIAPI.runSmokeCheck();
          renderSmokeChecks(result);
          setSummary(result?.ok ? 'Smoke check completed successfully.' : 'Smoke check completed with failures.', !result?.ok);
          return result;
        }

        const checks = [];
        const loadedScripts = Array.from(document.scripts || [])
          .map((script) => script.src || '')
          .filter(Boolean);
        checks.push({
          scope: 'shell-scripts',
          ok: loadedScripts.some((src) => src.includes('/js/bootstrap.js')),
          message: `Loaded ${loadedScripts.length} script(s).`
        });

        try {
          const cfgResp = await fetch('/js/app-config.js', { cache: 'no-store' });
          checks.push({
            scope: 'app-config',
            ok: cfgResp.ok,
            status: cfgResp.status,
            message: cfgResp.ok ? 'app-config.js reachable.' : 'app-config.js missing.'
          });
        } catch (err) {
          checks.push({
            scope: 'app-config',
            ok: false,
            message: err?.message || 'app-config.js check failed.'
          });
        }

        try {
          const compatResp = await fetch('/api/auth/bootstrap-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ smoke: true })
          });
          checks.push({
            scope: 'bootstrap-compat',
            ok: compatResp.ok,
            status: compatResp.status,
            message: compatResp.ok
              ? 'Compatibility bootstrap endpoint reachable.'
              : 'Compatibility bootstrap endpoint failed.'
          });
        } catch (err) {
          checks.push({
            scope: 'bootstrap-compat',
            ok: false,
            message: err?.message || 'Compatibility bootstrap check failed.'
          });
        }

        const diagItems = Array.isArray(window.YWIAppDiagnostics?.getItems?.())
          ? window.YWIAppDiagnostics.getItems()
          : [];
        const timingItems = Array.isArray(window.YWIModuleTimings?.getItems?.())
          ? window.YWIModuleTimings.getItems()
          : [];
        checks.push({
          scope: 'diagnostics-banner',
          ok: diagItems.length === 0,
          message: diagItems.length
            ? `${diagItems.length} diagnostic item(s) are present.`
            : 'Diagnostics banner is empty on the current boot.'
        });
        checks.push({
          scope: 'module-timings',
          ok: timingItems.length > 0,
          message: timingItems.length
            ? `Captured ${timingItems.length} timing trace(s). Latest: ${timingItems[0]?.scope || 'n/a'} in ${timingItems[0]?.duration_ms || 0} ms.`
            : 'No module timing traces have been captured yet.'
        });

        const result = { ok: checks.every((row) => row.ok), checks };
        renderSmokeChecks(result);
        setSummary(result.ok ? 'Smoke check completed successfully.' : 'Smoke check completed with failures.', !result.ok);
        return result;
      } catch (err) {
        const message = String(err?.message || 'Smoke check failed.');
        renderSmokeChecks({ ok: false, checks: [{ scope: 'smoke-check', ok: false, message }] });
        setSummary(message, true);
        return { ok: false, checks: [{ scope: 'smoke-check', ok: false, message }] };
      } finally {
        if (e.smokeBtn) {
          e.smokeBtn.disabled = false;
          e.smokeBtn.textContent = 'Run Smoke Check';
        }
      }
    }

    async function retryPendingAdminSync() {
      const e = els();
      if (e.retrySyncBtn) {
        e.retrySyncBtn.disabled = true;
        e.retrySyncBtn.textContent = 'Retrying...';
      }

      try {
        const result = await window.YWIOutbox?.retryQueuedActions?.({
          scope: 'admin',
          handlers: {
            admin_notification_action: async (payload = {}) => {
              if (!manageAdminEntity) {
                throw new Error('Admin manage API is unavailable.');
              }
              const resp = await manageAdminEntity(payload);
              if (!resp?.ok) {
                const err = new Error(resp?.error || 'Admin notification retry failed.');
                err.details = resp?.details || [];
                throw err;
              }
              return resp;
            }
          }
        });

        const summary = result || { total: 0, retried: 0, remaining: 0, conflicts: [] };
        const conflictCount = Array.isArray(summary.conflicts) ? summary.conflicts.length : 0;
        setSummary(
          summary.total
            ? `Admin sync retried ${summary.retried} of ${summary.total}. Remaining: ${summary.remaining}. Conflicts: ${conflictCount}.`
            : 'No pending admin sync items were queued.'
        );
        await loadDirectory();
        return summary;
      } catch (err) {
        setSummary(String(err?.message || 'Failed to retry pending admin sync.'), true);
        return { ok: false };
      } finally {
        if (e.retrySyncBtn) {
          e.retrySyncBtn.disabled = false;
          e.retrySyncBtn.textContent = 'Retry Pending Admin Sync';
        }
      }
    }

    async function loadDirectory() {
      applyRoleAccess();
      if (state.locked) return;

      try {
        const resp = await loadAdminDirectory({ scope: 'all', limit: 200 });
        state.notifications = Array.isArray(resp?.notifications) ? resp.notifications : [];
        state.users = Array.isArray(resp?.users) ? resp.users : [];
        state.salesOrders = Array.isArray(resp?.sales_orders) ? resp.sales_orders : [];
        state.accountingEntries = Array.isArray(resp?.accounting_entries) ? resp.accounting_entries : [];
        state.counts = {
          users: state.users.length,
          sites: Array.isArray(resp?.sites) ? resp.sites.length : 0,
          assignments: Array.isArray(resp?.assignments) ? resp.assignments.length : 0,
          orders: state.salesOrders.length
        };

        const e = els();
        if (e.usersCount) e.usersCount.textContent = String(state.counts.users);
        if (e.sitesCount) e.sitesCount.textContent = String(state.counts.sites);
        if (e.assignmentsCount) e.assignmentsCount.textContent = String(state.counts.assignments);
        if (e.ordersCount) e.ordersCount.textContent = String(state.counts.orders);

        renderProfileOptions();
        renderNotifications();
        renderOrders();

        const outboxSummary = window.YWIOutbox?.getActionSummary?.('admin') || { total: 0, conflicts: 0 };
        setSummary(
          state.manageLocked
            ? 'Read-only admin view loaded. Admin role is required for approval actions.'
            : `Admin view loaded.${outboxSummary.total ? ` Pending admin sync: ${outboxSummary.total} item(s), ${outboxSummary.conflicts || 0} conflict(s).` : ''}`
        );
      } catch (err) {
        setSummary(err?.message || 'Failed to load admin data.', true);
      }
    }

    function clearDirectory() {
      state.notifications = [];
      renderNotifications();
      const e = els();
      if (e.usersCount) e.usersCount.textContent = '0';
      if (e.sitesCount) e.sitesCount.textContent = '0';
      if (e.assignmentsCount) e.assignmentsCount.textContent = '0';
      if (e.notificationsCount) e.notificationsCount.textContent = '0';
      if (e.ordersCount) e.ordersCount.textContent = '0';
      hydratePreview('', {});
      renderOrders();
      renderSmokeChecks({ checks: [] });
    }

    async function refreshSelectors() {
      return true;
    }


    function renderConflictTable() {
      const e = els();
      if (!e.conflictBody) return;
      const summary = window.YWIOutbox?.getActionSummary?.('admin') || { items: [], conflicts: 0, total: 0 };
      const rows = Array.isArray(summary.items) ? summary.items.filter((item) => item.status === 'conflict' || Number(item.merge_count || 0) > 0) : [];
      e.conflictBody.innerHTML = rows.map((item) => `
        <tr>
          <td>${escHtml(item.updated_at || item.queued_at || '')}</td>
          <td>${escHtml(item.label || item.action_type || '')}</td>
          <td>${escHtml(item.status || 'pending')}</td>
          <td><pre class="code-block" style="max-width:280px;white-space:pre-wrap;">${escHtml(JSON.stringify(item.payload || {}, null, 2))}</pre></td>
          <td><div>${escHtml(item.error || 'Merged local change pending review.')}</div>${Array.isArray(item.conflict_details) && item.conflict_details.length ? `<ul>${item.conflict_details.map((detail) => `<li>${escHtml(detail)}</li>`).join('')}</ul>` : ''}</td>
          <td>
            <div class="table-actions" style="display:flex;flex-wrap:wrap;gap:6px;">
              <button class="secondary" data-conflict-action="retry" data-id="${escHtml(item.id)}">Retry</button>
              <button class="secondary" data-conflict-action="keep_local" data-id="${escHtml(item.id)}">Keep Local</button>
              <button class="secondary" data-conflict-action="discard" data-id="${escHtml(item.id)}">Discard</button>
            </div>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="muted">No admin conflicts are waiting for review.</td></tr>';
      setSummary(rows.length ? `Conflict review shows ${rows.length} admin item(s) needing attention.` : 'No admin conflicts are waiting for review.');
      if (e.conflictSummary) {
        e.conflictSummary.style.display = 'block';
        e.conflictSummary.dataset.kind = rows.length ? 'error' : 'info';
        e.conflictSummary.textContent = rows.length
          ? `${rows.length} queued admin item(s) need review before the next retry.`
          : 'No admin conflicts are waiting for review.';
      }
    }

    async function handleConflictClick(event) {
      const btn = event.target.closest('[data-conflict-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-conflict-action');
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
          await retryQueuedActions({ scope: 'admin', handlers: { admin_notification_action: (payload) => manageAdminEntity(payload) } });
          renderConflictTable();
        }
      } catch (err) {
        setSummary(err?.message || 'Unable to update the conflict item.', true);
      }
    }

    function bind() {
      const e = els();

      ['emailTo', 'emailSubject', 'emailBody'].forEach((key) => {
        const field = e[key];
        if (field && field.dataset.boundDraft !== '1') {
          field.dataset.boundDraft = '1';
          field.addEventListener('input', saveDraft);
        }
      });

      if (e.reloadBtn && e.reloadBtn.dataset.bound !== '1') {
        e.reloadBtn.dataset.bound = '1';
        e.reloadBtn.addEventListener('click', () => loadDirectory());
      }
      if (e.search && e.search.dataset.bound !== '1') {
        e.search.dataset.bound = '1';
        e.search.addEventListener('input', () => {
          saveDraft();
          renderNotifications();
        });
      }
      if (e.filterStatus && e.filterStatus.dataset.bound !== '1') {
        e.filterStatus.dataset.bound = '1';
        e.filterStatus.addEventListener('change', () => {
          saveDraft();
          renderNotifications();
        });
      }
      if (e.notificationsBody && e.notificationsBody.dataset.bound !== '1') {
        e.notificationsBody.dataset.bound = '1';
        e.notificationsBody.addEventListener('click', onNotificationTableClick);
      }
      if (e.previewBtn && e.previewBtn.dataset.bound !== '1') {
        e.previewBtn.dataset.bound = '1';
        e.previewBtn.addEventListener('click', () => onPreviewButton('preview_email'));
      }
      if (e.testSendBtn && e.testSendBtn.dataset.bound !== '1') {
        e.testSendBtn.dataset.bound = '1';
        e.testSendBtn.addEventListener('click', () => onPreviewButton('test_send'));
      }
      if (e.retryBtn && e.retryBtn.dataset.bound !== '1') {
        e.retryBtn.dataset.bound = '1';
        e.retryBtn.addEventListener('click', () => onPreviewButton('retry_send'));
      }
      if (e.passwordForm && e.passwordForm.dataset.bound !== '1') {
        e.passwordForm.dataset.bound = '1';
        e.passwordForm.addEventListener('submit', (event) => {
          event.preventDefault();
          setAdminPassword();
        });
      }
      if (e.passwordSetBtn && e.passwordSetBtn.dataset.bound !== '1') {
        e.passwordSetBtn.dataset.bound = '1';
        e.passwordSetBtn.addEventListener('click', () => setAdminPassword());
      }
      if (e.orderCreateBtn && e.orderCreateBtn.dataset.bound !== '1') {
        e.orderCreateBtn.dataset.bound = '1';
        e.orderCreateBtn.addEventListener('click', () => createSalesOrder());
      }
      if (e.smokeBtn && e.smokeBtn.dataset.bound !== '1') {
        e.smokeBtn.dataset.bound = '1';
        e.smokeBtn.addEventListener('click', () => runSmokeCheck());
      }
      if (e.conflictBody && e.conflictBody.dataset.bound !== '1') {
        e.conflictBody.dataset.bound = '1';
        e.conflictBody.addEventListener('click', handleConflictClick);
      }
      if (e.reloadConflictsBtn && e.reloadConflictsBtn.dataset.bound !== '1') {
        e.reloadConflictsBtn.dataset.bound = '1';
        e.reloadConflictsBtn.addEventListener('click', () => renderConflictTable());
      }
      if (e.retrySyncBtn && e.retrySyncBtn.dataset.bound !== '1') {
        e.retrySyncBtn.dataset.bound = '1';
        e.retrySyncBtn.addEventListener('click', () => retryPendingAdminSync());
      }
    }

    async function init() {
      ensureLayout();
      restoreDraft();
      bind();
      applyRoleAccess();
      renderSmokeChecks({ checks: [] });
      await loadDirectory();
    }

    return {
      state,
      init,
      loadDirectory,
      clearDirectory,
      refreshSelectors,
      applyRoleAccess,
      runSmokeCheck,
      retryPendingAdminSync
    };
  }

  window.YWIAdminUI = { create: createAdminUI };
})();
