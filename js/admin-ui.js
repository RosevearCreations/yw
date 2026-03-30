/* File: js/admin-ui.js
   Brief description: Admin Dashboard UI controller.
   Renders a live approval/notification panel with approve/reject/resolve actions,
   email preview/test-send/retry controls, and lightweight directory counts.
*/

'use strict';

(function () {
  function $(sel, root = document) { return root.querySelector(sel); }
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
      counts: { users: 0, sites: 0, assignments: 0 }
    };


    const DRAFT_KEY = 'ywi_admin_workspace_draft_v1';
    function loadDraft() {
      try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
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
          queue_status: e.filterStatus?.value || ''
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
            <p class="section-subtitle">Visible approval queue, notification email tools, and high-level directory counts.</p>
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
        </div>
        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Deploy Smoke Check</h3>
              <p class="section-subtitle">Check shell version, runtime config reachability, and bootstrap endpoint health before release.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="ad_run_smoke" class="secondary" type="button">Run Smoke Check</button>
              <button id="ad_retry_sync" class="secondary" type="button">Retry Pending Admin Sync</button>
            </div>
          </div>
          <div id="ad_smoke_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
          <div class="table-scroll">
            <table id="ad_smoke_table">
              <thead><tr><th>Check</th><th>Status</th><th>Details</th></tr></thead>
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
        search: document.getElementById('ad_notification_search'),
        filterStatus: document.getElementById('ad_notification_filter_status'),
        notificationsBody: document.querySelector('#ad_notifications_table tbody'),
        smokeBtn: document.getElementById('ad_run_smoke'),
        retrySyncBtn: document.getElementById('ad_retry_sync'),
        smokeSummary: document.getElementById('ad_smoke_summary'),
        smokeBody: document.querySelector('#ad_smoke_table tbody'),
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
      if (state.locked) setSummary('Supervisor, HSE, Job Admin, or Admin access is required to use this screen.', true);
      restoreDraft();
    }

    function filteredNotifications() {
      const e = els();
      const search = String(e.search?.value || '').trim().toLowerCase();
      const status = String(e.filterStatus?.value || '').trim().toLowerCase();
      return state.notifications.filter((row) => {
        const hay = [row.id, row.notification_type, row.title, row.message, row.status, row.decision_status, row.created_by_name].join(' ').toLowerCase();
        const statusMatch = !status || String(row.decision_status || row.status || '').toLowerCase() === status || String(row.email_status || '').toLowerCase() === status;
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
              <button class="secondary" data-notification-action="retry_send" data-id="${escHtml(row.id)}">Retry</button>`}
            </div>
          </td>
        `;
        e.notificationsBody.appendChild(tr);
      });
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
      const resp = await manageAdminEntity({ entity: 'notification', action, notification_id: notificationId, ...extra });
      if (!resp?.ok) throw new Error(resp?.error || `Notification ${action} failed`);
      return resp;
    }

    async function onNotificationTableClick(event) {
      const btn = event.target.closest('[data-notification-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-notification-action');
      const notificationId = btn.getAttribute('data-id');
      if (!notificationId) return;
      try {
        let decisionNotes = '';
        if (action === 'approve' || action === 'reject' || action === 'resolve') {
          decisionNotes = window.prompt(`Optional note for ${action}:`, '') || '';
        }
        const resp = await runNotificationAction(action, notificationId, { decision_notes: decisionNotes });
        if (resp?.preview) hydratePreview(notificationId, resp.preview);
        setSummary(`Notification ${notificationId} ${action.replace('_', ' ')} complete.`);
        await loadDirectory();
      } catch (err) {
        const msg = String(err?.message || 'Notification action failed.');
        if (msg.toLowerCase().includes('offline') || msg.includes('HTTP 5')) {
          window.YWIOutbox?.queueAction?.({ scope: 'admin', action_type: 'admin_notification_action', payload: { entity: 'notification', action, notification_id: notificationId, decision_notes: decisionNotes }, label: `Notification ${action}` });
          setSummary('Notification action saved to the admin outbox for retry.', false);
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
        setSummary(action === 'preview_email' ? `Preview ready for notification ${notificationId}.` : `Notification ${notificationId} ${action.replace('_', ' ')} complete.`);
        await loadDirectory();
      } catch (err) {
        const msg = String(err?.message || 'Email action failed.');
        if (msg.toLowerCase().includes('offline') || msg.includes('HTTP 5')) {
          window.YWIOutbox?.queueAction?.({ scope: 'admin', action_type: 'admin_notification_action', payload: { entity: 'notification', action, notification_id: notificationId, email_to: e.emailTo?.value || '', email_subject: e.emailSubject?.value || '', email_body: e.emailBody?.value || '' }, label: `Email ${action}` });
          setSummary('Email action saved to the admin outbox for retry.', false);
        } else {
          setSummary(msg, true);
        }
      }
    }

    async function loadDirectory() {
      applyRoleAccess();
      if (state.locked) return;
      try {
        const resp = await loadAdminDirectory({ scope: 'all', limit: 200 });
        state.notifications = Array.isArray(resp?.notifications) ? resp.notifications : [];
        state.counts = {
          users: Array.isArray(resp?.users) ? resp.users.length : 0,
          sites: Array.isArray(resp?.sites) ? resp.sites.length : 0,
          assignments: Array.isArray(resp?.assignments) ? resp.assignments.length : 0
        };
        const e = els();
        if (e.usersCount) e.usersCount.textContent = String(state.counts.users);
        if (e.sitesCount) e.sitesCount.textContent = String(state.counts.sites);
        if (e.assignmentsCount) e.assignmentsCount.textContent = String(state.counts.assignments);
        renderNotifications();
        const outboxSummary = window.YWIOutbox?.getActionSummary?.('admin') || { total: 0, conflicts: 0 };
        setSummary(state.manageLocked ? 'Read-only admin view loaded. Admin role is required for approval actions.' : `Admin view loaded.${outboxSummary.total ? ` Pending admin sync: ${outboxSummary.total} item(s), ${outboxSummary.conflicts || 0} conflict(s).` : ''}`);
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
      hydratePreview('', {});
    }

    async function refreshSelectors() {
      return true;
    }

    function bind() {
      const e = els();
      ['emailTo','emailSubject','emailBody'].forEach((key) => {
        const field = e[key];
        if (field && field.dataset.boundDraft !== '1') {
          field.dataset.boundDraft = '1';
          field.addEventListener('input', saveDraft);
        }
      });
      if (e.reloadBtn && e.reloadBtn.dataset.bound !== '1') {
        e.reloadBtn.dataset.bound = '1';
        e.reloadBtn.addEventListener('click', loadDirectory);
      }
      if (e.search && e.search.dataset.bound !== '1') {
        e.search.dataset.bound = '1';
        e.search.addEventListener('input', renderNotifications);
      }
      if (e.filterStatus && e.filterStatus.dataset.bound !== '1') {
        e.filterStatus.dataset.bound = '1';
        e.filterStatus.addEventListener('change', renderNotifications);
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
      if (e.smokeBtn && e.smokeBtn.dataset.bound !== '1') {
        e.smokeBtn.dataset.bound = '1';
        e.smokeBtn.addEventListener('click', runSmokeCheck);
      }
      if (e.retrySyncBtn && e.retrySyncBtn.dataset.bound !== '1') {
        e.retrySyncBtn.dataset.bound = '1';
        e.retrySyncBtn.addEventListener('click', retryPendingAdminSync);
      }
    }

    async function init() {
      ensureLayout();
      bind();
      applyRoleAccess();
      renderSmokeChecks({ checks: [] });
      await loadDirectory();
    }

    return { state, init, loadDirectory, clearDirectory, refreshSelectors, applyRoleAccess };
  }

  window.YWIAdminUI = { create: createAdminUI };
})();
