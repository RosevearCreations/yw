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
    const loadAdminSelectors = config.loadAdminSelectors || window.YWIAPI?.loadAdminSelectors;
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
      sites: [],
      assignments: [],
      selectors: { profiles: [], sites: [], assignments: [], positions: [], trades: [], staffTiers: [], seniorityLevels: [], employmentStatuses: [], jobTypes: [] },
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
            <p class="section-subtitle">Administrative backend for staff accounts, approvals, password control, orders, accounting, and workflow oversight.</p>
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
              <h3 style="margin:0;">Staff Directory and Access</h3>
              <p class="section-subtitle">Create staff accounts, assign Admin/Supervisor/Employee tiers, block or delete users, manage verification flags, and prepare the personnel backend for work-order assignment.</p>
            </div>
          </div>
          <div class="grid">
            <label>Selected User
              <select id="ad_staff_profile_id"></select>
            </label>
            <label>Full Name<input id="ad_staff_full_name" type="text" placeholder="Full name" /></label>
            <label>Email<input id="ad_staff_email" type="email" placeholder="user@example.com" /></label>
            <label>Phone<input id="ad_staff_phone" type="text" placeholder="Phone" /></label>
            <label>Role
              <select id="ad_staff_role">
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>Staff Tier<select id="ad_staff_tier"></select></label>
            <label>Seniority Level<select id="ad_staff_seniority"></select></label>
            <label>Employment Status
              <select id="ad_staff_status"><option value="active">Active</option><option value="blocked">Blocked</option><option value="inactive">Inactive</option></select>
            </label>
            <label>Employee Number<input id="ad_staff_employee_number" type="text" /></label>
            <label>Position<select id="ad_staff_position"></select></label>
            <label>Trade<select id="ad_staff_trade"></select></label>
            <label>Start Date<input id="ad_staff_start_date" type="date" /></label>
            <form id="ad_staff_new_password_form" autocomplete="on"><input type="text" name="username" autocomplete="username" style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;" tabindex="-1" aria-hidden="true"><label>New Password<input id="ad_staff_new_password" type="password" name="new-password" autocomplete="new-password" placeholder="Required for new user" /></label></form>
            <label style="display:flex;align-items:end;gap:8px;"><input id="ad_staff_phone_verified" type="checkbox" /><span>Phone verified</span></label>
            <label style="display:flex;align-items:end;gap:8px;"><input id="ad_staff_email_verified" type="checkbox" /><span>Email verified</span></label>
            <label style="display:flex;align-items:end;gap:8px;"><input id="ad_staff_active" type="checkbox" checked /><span>Active</span></label>
          </div>
          <label style="display:block;margin-top:12px;">Notes<textarea id="ad_staff_notes" rows="3" placeholder="Staff notes"></textarea></label>
          <div class="form-footer" style="margin-top:12px;">
            <button id="ad_staff_create" class="secondary" type="button">Create Staff User</button>
            <button id="ad_staff_save" class="secondary" type="button">Save Staff Details</button>
            <button id="ad_staff_reset_email" class="secondary" type="button">Send Password Reset</button>
            <button id="ad_staff_block" class="secondary" type="button">Block / Unblock</button>
            <button id="ad_staff_delete" class="secondary" type="button">Delete User</button>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_staff_table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Tier</th><th>Seniority</th><th>Status</th><th>Phone</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Assignment Workbench</h3>
              <p class="section-subtitle">Assign staff to sites, set reporting lines, and manage the supervisor/admin structure used by jobs and approvals.</p>
            </div>
          </div>
          <div class="grid">
            <label>Assignment
              <select id="ad_assignment_id"></select>
            </label>
            <label>Site
              <select id="ad_assignment_site_id"></select>
            </label>
            <label>Profile
              <select id="ad_assignment_profile_id"></select>
            </label>
            <label>Assignment Role
              <select id="ad_assignment_role">
                <option value="worker">Worker</option>
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>Reports to Supervisor
              <select id="ad_assignment_supervisor"></select>
            </label>
            <label>Reports to Admin
              <select id="ad_assignment_admin"></select>
            </label>
            <label style="display:flex;align-items:end;gap:8px;"><input id="ad_assignment_primary" type="checkbox" /><span>Primary assignment</span></label>
          </div>
          <div class="form-footer" style="margin-top:12px;">
            <button id="ad_assignment_create" class="secondary" type="button">Create Assignment</button>
            <button id="ad_assignment_save" class="secondary" type="button">Save Assignment</button>
            <button id="ad_assignment_delete" class="secondary" type="button">Delete Assignment</button>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_assignments_table">
              <thead><tr><th>Site</th><th>Staff</th><th>Role</th><th>Primary</th><th>Supervisor</th><th>Admin</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Dropdown and Catalog Manager</h3>
              <p class="section-subtitle">Populate the shared dropdown fields used by staff forms and future job/work-order flows.</p>
            </div>
          </div>
          <div class="grid">
            <label>Catalog
              <select id="ad_catalog_type">
                <option value="position">Positions</option>
                <option value="trade">Trades</option>
                <option value="staff_tier">Staff tiers</option>
                <option value="seniority">Seniority levels</option>
                <option value="employment_status">Employment statuses</option>
                <option value="job_type">Job types</option>
              </select>
            </label>
            <label>Selected Item
              <select id="ad_catalog_item_id"></select>
            </label>
            <label>Name<input id="ad_catalog_name" type="text" placeholder="Catalog value" /></label>
            <label>Sort Order<input id="ad_catalog_sort" type="number" min="0" step="1" value="100" /></label>
            <label style="display:flex;align-items:end;gap:8px;"><input id="ad_catalog_active" type="checkbox" checked /><span>Active</span></label>
          </div>
          <div class="form-footer" style="margin-top:12px;">
            <button id="ad_catalog_create" class="secondary" type="button">Create Item</button>
            <button id="ad_catalog_save" class="secondary" type="button">Save Item</button>
            <button id="ad_catalog_delete" class="secondary" type="button">Delete Item</button>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_catalog_table">
              <thead><tr><th>Name</th><th>Sort</th><th>Active</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Admin Password Control</h3>
              <p class="section-subtitle">Allow an Admin to set a new password for any profile, including another Admin, with audit logging.</p>
            </div>
          </div>
          <form id="ad_password_form" autocomplete="on">
            <input type="text" id="ad_password_username" autocomplete="username email" class="sr-only" tabindex="-1" aria-hidden="true" />
            <div class="grid">
              <label>Target Profile
                <select id="ad_password_profile_id"></select>
              </label>
              <label>New Password
                <input id="ad_password_new" type="password" autocomplete="new-password" placeholder="New password" />
              </label>
              <label>Confirm Password
                <input id="ad_password_confirm" type="password" autocomplete="new-password" placeholder="Confirm password" />
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
              <button id="ad_password_set" class="secondary" type="button">Set Password</button>
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
        staffProfileId: document.getElementById('ad_staff_profile_id'),
        staffFullName: document.getElementById('ad_staff_full_name'),
        staffEmail: document.getElementById('ad_staff_email'),
        staffPhone: document.getElementById('ad_staff_phone'),
        staffRole: document.getElementById('ad_staff_role'),
        staffTier: document.getElementById('ad_staff_tier'),
        staffSeniority: document.getElementById('ad_staff_seniority'),
        staffStatus: document.getElementById('ad_staff_status'),
        staffEmployeeNumber: document.getElementById('ad_staff_employee_number'),
        staffPosition: document.getElementById('ad_staff_position'),
        staffTrade: document.getElementById('ad_staff_trade'),
        staffStartDate: document.getElementById('ad_staff_start_date'),
        staffNewPassword: document.getElementById('ad_staff_new_password'),
        staffPhoneVerified: document.getElementById('ad_staff_phone_verified'),
        staffEmailVerified: document.getElementById('ad_staff_email_verified'),
        staffActive: document.getElementById('ad_staff_active'),
        staffNotes: document.getElementById('ad_staff_notes'),
        staffCreateBtn: document.getElementById('ad_staff_create'),
        staffSaveBtn: document.getElementById('ad_staff_save'),
        staffResetBtn: document.getElementById('ad_staff_reset_email'),
        staffBlockBtn: document.getElementById('ad_staff_block'),
        staffDeleteBtn: document.getElementById('ad_staff_delete'),
        staffBody: document.querySelector('#ad_staff_table tbody'),
        assignmentId: document.getElementById('ad_assignment_id'),
        assignmentSiteId: document.getElementById('ad_assignment_site_id'),
        assignmentProfileId: document.getElementById('ad_assignment_profile_id'),
        assignmentRole: document.getElementById('ad_assignment_role'),
        assignmentSupervisor: document.getElementById('ad_assignment_supervisor'),
        assignmentAdmin: document.getElementById('ad_assignment_admin'),
        assignmentPrimary: document.getElementById('ad_assignment_primary'),
        assignmentCreateBtn: document.getElementById('ad_assignment_create'),
        assignmentSaveBtn: document.getElementById('ad_assignment_save'),
        assignmentDeleteBtn: document.getElementById('ad_assignment_delete'),
        assignmentsBody: document.querySelector('#ad_assignments_table tbody'),
        catalogType: document.getElementById('ad_catalog_type'),
        catalogItemId: document.getElementById('ad_catalog_item_id'),
        catalogName: document.getElementById('ad_catalog_name'),
        catalogSort: document.getElementById('ad_catalog_sort'),
        catalogActive: document.getElementById('ad_catalog_active'),
        catalogCreateBtn: document.getElementById('ad_catalog_create'),
        catalogSaveBtn: document.getElementById('ad_catalog_save'),
        catalogDeleteBtn: document.getElementById('ad_catalog_delete'),
        catalogBody: document.querySelector('#ad_catalog_table tbody'),
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


    function fillStaffForm(row) {
      const e = els();
      const item = row || {};
      if (e.staffProfileId) e.staffProfileId.value = item.id || '';
      if (e.staffFullName) e.staffFullName.value = item.full_name || '';
      if (e.staffEmail) e.staffEmail.value = item.email || '';
      if (e.staffPhone) e.staffPhone.value = item.phone || '';
      if (e.staffRole) e.staffRole.value = item.role || 'employee';
      if (e.staffTier) e.staffTier.value = item.staff_tier || item.role || '';
      if (e.staffSeniority) e.staffSeniority.value = item.seniority_level || '';
      if (e.staffStatus) e.staffStatus.value = item.employment_status || (item.is_active === false ? 'blocked' : 'active');
      if (e.staffEmployeeNumber) e.staffEmployeeNumber.value = item.employee_number || '';
      if (e.staffPosition) e.staffPosition.value = item.current_position || '';
      if (e.staffTrade) e.staffTrade.value = item.trade_specialty || '';
      if (e.staffStartDate) e.staffStartDate.value = item.start_date || '';
      if (e.staffPhoneVerified) e.staffPhoneVerified.checked = !!item.phone_verified;
      if (e.staffEmailVerified) e.staffEmailVerified.checked = !!item.email_verified;
      if (e.staffActive) e.staffActive.checked = item.is_active !== false;
      if (e.staffNotes) e.staffNotes.value = item.notes || '';
    }

    function renderStaffDirectory() {
      const e = els();
      if (e.staffProfileId) {
        const current = e.staffProfileId.value || '';
        e.staffProfileId.innerHTML = '<option value="">Select staff</option>' + state.users.map((row) => `<option value="${escHtml(row.id)}">${escHtml(row.full_name || row.email || row.id)} (${escHtml(row.role || 'employee')})</option>`).join('');
        if (current) e.staffProfileId.value = current;
      }
      if (e.staffBody) {
        e.staffBody.innerHTML = state.users.map((row) => `<tr data-staff-id="${escHtml(row.id)}"><td>${escHtml(row.full_name || '')}</td><td>${escHtml(row.email || '')}</td><td>${escHtml(row.role || '')}</td><td>${escHtml(row.staff_tier || '')}</td><td>${escHtml(row.seniority_level || '')}</td><td>${escHtml(row.employment_status || (row.is_active === false ? 'blocked' : 'active'))}</td><td>${escHtml(row.phone || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No staff records loaded.</td></tr>';
      }
    }

    function getSelectedStaff() {
      const e = els();
      return state.users.find((row) => String(row.id) === String(e.staffProfileId?.value || '')) || null;
    }

    async function createStaffUser() {
      const e = els();
      if (!(e.staffEmail?.value || '').trim()) return setSummary('Email is required for a new staff user.', true);
      if (!(e.staffNewPassword?.value || '').trim()) return setSummary('New staff user requires an initial password.', true);
      const resp = await manageAdminEntity({ entity:'credential', action:'create_user', email:e.staffEmail.value, new_password:e.staffNewPassword.value, full_name:e.staffFullName?.value || '', phone:e.staffPhone?.value || '', role:e.staffRole?.value || 'employee', staff_tier:e.staffTier?.value || '', seniority_level:e.staffSeniority?.value || '', employment_status:e.staffStatus?.value || 'active', employee_number:e.staffEmployeeNumber?.value || '', current_position:e.staffPosition?.value || '', trade_specialty:e.staffTrade?.value || '', start_date:e.staffStartDate?.value || null, phone_verified:!!e.staffPhoneVerified?.checked, email_verified:!!e.staffEmailVerified?.checked, is_active:!!e.staffActive?.checked, notes:e.staffNotes?.value || '' });
      if (!resp?.ok) throw new Error(resp?.error || 'Failed to create staff user.');
      if (e.staffNewPassword) e.staffNewPassword.value = '';
      setSummary('Staff user created successfully.');
      await loadDirectory();
      fillStaffForm(resp.record || null);
    }

    async function saveStaffDetails() {
      const e = els();
      const profileId = e.staffProfileId?.value || '';
      if (!profileId) return setSummary('Select a staff record first.', true);
      const resp = await manageAdminEntity({ entity:'profile', action:'update', profile_id:profileId, full_name:e.staffFullName?.value || null, role:e.staffRole?.value || 'employee', phone:e.staffPhone?.value || null, phone_verified:!!e.staffPhoneVerified?.checked, email_verified:!!e.staffEmailVerified?.checked, employee_number:e.staffEmployeeNumber?.value || null, current_position:e.staffPosition?.value || null, trade_specialty:e.staffTrade?.value || null, seniority_level:e.staffSeniority?.value || null, employment_status:e.staffStatus?.value || 'active', staff_tier:e.staffTier?.value || null, start_date:e.staffStartDate?.value || null, notes:e.staffNotes?.value || null, is_active:!!e.staffActive?.checked });
      if (!resp?.ok) throw new Error(resp?.error || 'Failed to save staff details.');
      setSummary('Staff details updated.');
      await loadDirectory();
    }

    async function toggleStaffBlock() {
      const e = els();
      const profileId = e.staffProfileId?.value || '';
      if (!profileId) return setSummary('Select a staff record first.', true);
      const nextActive = !e.staffActive?.checked;
      const resp = await manageAdminEntity({ entity:'profile', action:'set_active', profile_id:profileId, is_active:nextActive, employment_status: nextActive ? 'active' : 'blocked' });
      if (!resp?.ok) throw new Error(resp?.error || 'Failed to update active status.');
      setSummary(nextActive ? 'Staff record unblocked / activated.' : 'Staff record blocked.');
      await loadDirectory();
      fillStaffForm(resp.record || null);
    }

    async function sendStaffReset() {
      const e = els();
      const profileId = e.staffProfileId?.value || '';
      if (!profileId) return setSummary('Select a staff record first.', true);
      const resp = await manageAdminEntity({ entity:'credential', action:'send_password_reset', profile_id: profileId });
      if (!resp?.ok) throw new Error(resp?.error || 'Failed to send reset.');
      setSummary(`Password reset link generated for ${resp.email || 'selected user'}.`);
    }

    async function deleteStaffUser() {
      const e = els();
      const profileId = e.staffProfileId?.value || '';
      if (!profileId) return setSummary('Select a staff record first.', true);
      const ok = window.confirm('Delete this user and auth account? This cannot be undone.');
      if (!ok) return;
      const resp = await manageAdminEntity({ entity:'profile', action:'delete', profile_id: profileId });
      if (!resp?.ok) throw new Error(resp?.error || 'Failed to delete user.');
      setSummary('User deleted.');
      await loadDirectory();
      fillStaffForm(null);
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
        state.sites = Array.isArray(resp?.sites) ? resp.sites : [];
        state.assignments = Array.isArray(resp?.assignments) ? resp.assignments : [];
        state.salesOrders = Array.isArray(resp?.sales_orders) ? resp.sales_orders : [];
        state.accountingEntries = Array.isArray(resp?.accounting_entries) ? resp.accounting_entries : [];
        state.counts = {
          users: state.users.length,
          sites: Array.isArray(resp?.sites) ? resp.sites.length : 0,
          assignments: state.assignments.length,
          orders: state.salesOrders.length
        };

        const e = els();
        if (e.usersCount) e.usersCount.textContent = String(state.counts.users);
        if (e.sitesCount) e.sitesCount.textContent = String(state.counts.sites);
        if (e.assignmentsCount) e.assignmentsCount.textContent = String(state.counts.assignments);
        if (e.ordersCount) e.ordersCount.textContent = String(state.counts.orders);

        renderStaffDirectory();
        renderProfileOptions();
        renderAssignmentWorkbench();
        renderCatalogManager();
        renderNotifications();
        renderOrders();
        await refreshSelectors();

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
      state.sites = [];
      state.assignments = [];
      state.selectors = { profiles: [], sites: [], assignments: [], positions: [], trades: [], staffTiers: [], seniorityLevels: [], employmentStatuses: [], jobTypes: [] };
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

    function getCatalogRows(type) {
      const map = {
        position: state.selectors.positions || [],
        trade: state.selectors.trades || [],
        staff_tier: state.selectors.staffTiers || [],
        seniority: state.selectors.seniorityLevels || [],
        employment_status: state.selectors.employmentStatuses || [],
        job_type: state.selectors.jobTypes || []
      };
      return Array.isArray(map[type]) ? map[type] : [];
    }

    function optionList(rows, valueKey = 'id', labelFn = null, placeholder = 'Select') {
      const items = Array.isArray(rows) ? rows : [];
      const toLabel = labelFn || ((row) => row?.name || row?.full_name || row?.email || row?.site_code || row?.id || '');
      return `<option value="">${escHtml(placeholder)}</option>` + items.map((row) => `<option value="${escHtml(row?.[valueKey] ?? '')}">${escHtml(toLabel(row))}</option>`).join('');
    }

    function setSelectValue(el, value) {
      if (!el) return;
      const normalized = value == null ? '' : String(value);
      el.value = normalized;
      if (el.value !== normalized) el.value = '';
    }

    function renderCatalogManager() {
      const e = els();
      const rows = getCatalogRows(e.catalogType?.value || 'position');
      if (e.catalogItemId) {
        const current = e.catalogItemId.value || '';
        e.catalogItemId.innerHTML = optionList(rows, 'id', (row) => row.name || row.position_name || row.trade_name || row.id, 'Select item');
        setSelectValue(e.catalogItemId, current);
      }
      if (e.catalogBody) {
        e.catalogBody.innerHTML = rows.map((row) => `<tr data-catalog-id="${escHtml(row.id)}"><td>${escHtml(row.name || row.position_name || row.trade_name || '')}</td><td>${escHtml(row.sort_order ?? 100)}</td><td>${row.is_active === false ? 'No' : 'Yes'}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No catalog items loaded.</td></tr>';
      }
    }

    function fillCatalogForm(item) {
      const e = els();
      const row = item || {};
      if (e.catalogItemId) setSelectValue(e.catalogItemId, row.id || '');
      if (e.catalogName) e.catalogName.value = row.name || row.position_name || row.trade_name || '';
      if (e.catalogSort) e.catalogSort.value = String(row.sort_order ?? 100);
      if (e.catalogActive) e.catalogActive.checked = row.is_active !== false;
    }

    function renderAssignmentWorkbench() {
      const e = els();
      const assignments = Array.isArray(state.assignments) ? state.assignments : [];
      const sites = Array.isArray(state.sites) ? state.sites : [];
      const profiles = Array.isArray(state.users) ? state.users : [];
      const supervisors = profiles.filter((row) => ['supervisor','site_leader','hse','job_admin','admin'].includes(String(row.role || '')));
      const admins = profiles.filter((row) => String(row.role || '') === 'admin');
      if (e.assignmentId) {
        const current = e.assignmentId.value || '';
        e.assignmentId.innerHTML = optionList(assignments, 'id', (row) => `${row.site_code || row['sites']?.site_code || 'Site'} - ${row.full_name || row['profiles']?.full_name || row.profile_id || ''}`, 'Select assignment');
        setSelectValue(e.assignmentId, current);
      }
      if (e.assignmentSiteId) {
        const current = e.assignmentSiteId.value || '';
        e.assignmentSiteId.innerHTML = optionList(sites, 'id', (row) => `${row.site_code || ''} ${row.site_name ? '- ' + row.site_name : ''}`, 'Select site');
        setSelectValue(e.assignmentSiteId, current);
      }
      if (e.assignmentProfileId) {
        const current = e.assignmentProfileId.value || '';
        e.assignmentProfileId.innerHTML = optionList(profiles, 'id', (row) => `${row.full_name || row.email || row.id} (${row.role || 'employee'})`, 'Select staff');
        setSelectValue(e.assignmentProfileId, current);
      }
      if (e.assignmentSupervisor) {
        const current = e.assignmentSupervisor.value || '';
        e.assignmentSupervisor.innerHTML = optionList(supervisors, 'id', (row) => row.full_name || row.email || row.id, 'Select supervisor');
        setSelectValue(e.assignmentSupervisor, current);
      }
      if (e.assignmentAdmin) {
        const current = e.assignmentAdmin.value || '';
        e.assignmentAdmin.innerHTML = optionList(admins, 'id', (row) => row.full_name || row.email || row.id, 'Select admin');
        setSelectValue(e.assignmentAdmin, current);
      }
      if (e.assignmentsBody) {
        e.assignmentsBody.innerHTML = assignments.map((row) => `<tr data-assignment-id="${escHtml(row.id)}"><td>${escHtml(row.site_code || row['sites']?.site_code || '')}</td><td>${escHtml(row.full_name || row['profiles']?.full_name || row.profile_id || '')}</td><td>${escHtml(row.assignment_role || '')}</td><td>${row.is_primary ? 'Yes' : 'No'}</td><td>${escHtml(row.supervisor_name || '')}</td><td>${escHtml(row.admin_name || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No assignments loaded.</td></tr>';
      }
    }

    function fillAssignmentForm(item) {
      const e = els();
      const row = item || {};
      if (e.assignmentId) setSelectValue(e.assignmentId, row.id || '');
      if (e.assignmentSiteId) setSelectValue(e.assignmentSiteId, row.site_id || '');
      if (e.assignmentProfileId) setSelectValue(e.assignmentProfileId, row.profile_id || '');
      if (e.assignmentRole) setSelectValue(e.assignmentRole, row.assignment_role || 'worker');
      if (e.assignmentSupervisor) setSelectValue(e.assignmentSupervisor, row.reports_to_supervisor_profile_id || '');
      if (e.assignmentAdmin) setSelectValue(e.assignmentAdmin, row.reports_to_admin_profile_id || '');
      if (e.assignmentPrimary) e.assignmentPrimary.checked = !!row.is_primary;
    }

    function getSelectedAssignment() {
      const e = els();
      return (state.assignments || []).find((row) => String(row.id) === String(e.assignmentId?.value || '')) || null;
    }

    async function saveAssignment(isCreate = false) {
      const e = els();
      const payload = {
        entity: 'assignment',
        action: isCreate ? 'create' : 'update',
        assignment_id: e.assignmentId?.value || '',
        site_id: e.assignmentSiteId?.value || '',
        profile_id: e.assignmentProfileId?.value || '',
        assignment_role: e.assignmentRole?.value || 'worker',
        is_primary: !!e.assignmentPrimary?.checked,
        reports_to_supervisor_name: (state.users || []).find((row) => String(row.id) === String(e.assignmentSupervisor?.value || ''))?.email || '',
        reports_to_admin_name: (state.users || []).find((row) => String(row.id) === String(e.assignmentAdmin?.value || ''))?.email || ''
      };
      if (!payload.site_id || !payload.profile_id) throw new Error('Site and profile are required for assignments.');
      const resp = await manageAdminEntity(payload);
      if (!resp?.ok) throw new Error(resp?.error || 'Assignment save failed.');
      setSummary(isCreate ? 'Assignment created.' : 'Assignment updated.');
      await loadDirectory();
      fillAssignmentForm(resp.record || null);
    }

    async function deleteAssignment() {
      const e = els();
      const assignmentId = e.assignmentId?.value || '';
      if (!assignmentId) throw new Error('Select an assignment first.');
      const resp = await manageAdminEntity({ entity: 'assignment', action: 'delete', assignment_id: assignmentId });
      if (!resp?.ok) throw new Error(resp?.error || 'Assignment delete failed.');
      setSummary('Assignment deleted.');
      await loadDirectory();
      fillAssignmentForm(null);
    }

    async function saveCatalogItem(isCreate = false) {
      const e = els();
      const payload = {
        entity: 'catalog',
        action: isCreate ? 'create' : 'update',
        catalog_type: e.catalogType?.value || 'position',
        item_id: e.catalogItemId?.value || '',
        name: e.catalogName?.value || '',
        sort_order: Number(e.catalogSort?.value || 100),
        is_active: !!e.catalogActive?.checked
      };
      if (!payload.name.trim()) throw new Error('Catalog item name is required.');
      const resp = await manageAdminEntity(payload);
      if (!resp?.ok) throw new Error(resp?.error || 'Catalog save failed.');
      setSummary(isCreate ? 'Catalog item created.' : 'Catalog item updated.');
      await refreshSelectors();
      fillCatalogForm(resp.record || null);
    }

    async function deleteCatalogItem() {
      const e = els();
      const itemId = e.catalogItemId?.value || '';
      if (!itemId) throw new Error('Select a catalog item first.');
      const resp = await manageAdminEntity({ entity: 'catalog', action: 'delete', catalog_type: e.catalogType?.value || 'position', item_id: itemId });
      if (!resp?.ok) throw new Error(resp?.error || 'Catalog delete failed.');
      setSummary('Catalog item deleted.');
      await refreshSelectors();
      fillCatalogForm(null);
    }

    async function refreshSelectors() {
      if (!loadAdminSelectors) return true;
      try {
        const payload = await loadAdminSelectors({ scope: 'all' });
        state.selectors = {
          profiles: Array.isArray(payload?.profiles) ? payload.profiles : state.users,
          sites: Array.isArray(payload?.sites) ? payload.sites : state.sites,
          assignments: Array.isArray(payload?.assignments) ? payload.assignments : state.assignments,
          positions: Array.isArray(payload?.positions) ? payload.positions : [],
          trades: Array.isArray(payload?.trades) ? payload.trades : [],
          staffTiers: Array.isArray(payload?.staff_tiers) ? payload.staff_tiers : [],
          seniorityLevels: Array.isArray(payload?.seniority_levels) ? payload.seniority_levels : [],
          employmentStatuses: Array.isArray(payload?.employment_statuses) ? payload.employment_statuses : [],
          jobTypes: Array.isArray(payload?.job_types) ? payload.job_types : []
        };
        const e = els();
        if (e.staffPosition) {
          const current = e.staffPosition.value || '';
          e.staffPosition.innerHTML = optionList(state.selectors.positions, 'name', (row) => row.name || row.position_name || '', 'Select position');
          setSelectValue(e.staffPosition, current);
        }
        if (e.staffTrade) {
          const current = e.staffTrade.value || '';
          e.staffTrade.innerHTML = optionList(state.selectors.trades, 'name', (row) => row.name || row.trade_name || '', 'Select trade');
          setSelectValue(e.staffTrade, current);
        }
        if (e.staffTier) {
          const current = e.staffTier.value || '';
          e.staffTier.innerHTML = optionList(state.selectors.staffTiers, 'name', (row) => row.name || '', 'Select staff tier');
          setSelectValue(e.staffTier, current);
        }
        if (e.staffSeniority) {
          const current = e.staffSeniority.value || '';
          e.staffSeniority.innerHTML = optionList(state.selectors.seniorityLevels, 'name', (row) => row.name || '', 'Select seniority');
          setSelectValue(e.staffSeniority, current);
        }
        if (e.staffStatus) {
          const current = e.staffStatus.value || '';
          e.staffStatus.innerHTML = optionList(state.selectors.employmentStatuses, 'name', (row) => row.name || '', 'Select status');
          setSelectValue(e.staffStatus, current || 'active');
        }
        renderAssignmentWorkbench();
        renderCatalogManager();
        return true;
      } catch (err) {
        setSummary(String(err?.message || 'Failed to load admin selectors.'), true);
        return false;
      }
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
      if (e.staffProfileId && e.staffProfileId.dataset.bound !== '1') {
        e.staffProfileId.dataset.bound = '1';
        e.staffProfileId.addEventListener('change', () => fillStaffForm(getSelectedStaff()));
      }
      if (e.staffBody && e.staffBody.dataset.bound !== '1') {
        e.staffBody.dataset.bound = '1';
        e.staffBody.addEventListener('click', (event) => {
          const tr = event.target.closest('[data-staff-id]');
          if (!tr) return;
          if (e.staffProfileId) e.staffProfileId.value = tr.getAttribute('data-staff-id') || '';
          fillStaffForm(getSelectedStaff());
        });
      }
      if (e.staffCreateBtn && e.staffCreateBtn.dataset.bound !== '1') {
        e.staffCreateBtn.dataset.bound = '1';
        e.staffCreateBtn.addEventListener('click', () => createStaffUser().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffSaveBtn && e.staffSaveBtn.dataset.bound !== '1') {
        e.staffSaveBtn.dataset.bound = '1';
        e.staffSaveBtn.addEventListener('click', () => saveStaffDetails().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffResetBtn && e.staffResetBtn.dataset.bound !== '1') {
        e.staffResetBtn.dataset.bound = '1';
        e.staffResetBtn.addEventListener('click', () => sendStaffReset().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffBlockBtn && e.staffBlockBtn.dataset.bound !== '1') {
        e.staffBlockBtn.dataset.bound = '1';
        e.staffBlockBtn.addEventListener('click', () => toggleStaffBlock().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffDeleteBtn && e.staffDeleteBtn.dataset.bound !== '1') {
        e.staffDeleteBtn.dataset.bound = '1';
        e.staffDeleteBtn.addEventListener('click', () => deleteStaffUser().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.assignmentId && e.assignmentId.dataset.bound !== '1') {
        e.assignmentId.dataset.bound = '1';
        e.assignmentId.addEventListener('change', () => fillAssignmentForm(getSelectedAssignment()));
      }
      if (e.assignmentsBody && e.assignmentsBody.dataset.bound !== '1') {
        e.assignmentsBody.dataset.bound = '1';
        e.assignmentsBody.addEventListener('click', (event) => {
          const tr = event.target.closest('[data-assignment-id]');
          if (!tr) return;
          if (e.assignmentId) e.assignmentId.value = tr.getAttribute('data-assignment-id') || '';
          fillAssignmentForm(getSelectedAssignment());
        });
      }
      if (e.assignmentCreateBtn && e.assignmentCreateBtn.dataset.bound !== '1') {
        e.assignmentCreateBtn.dataset.bound = '1';
        e.assignmentCreateBtn.addEventListener('click', () => saveAssignment(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.assignmentSaveBtn && e.assignmentSaveBtn.dataset.bound !== '1') {
        e.assignmentSaveBtn.dataset.bound = '1';
        e.assignmentSaveBtn.addEventListener('click', () => saveAssignment(false).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.assignmentDeleteBtn && e.assignmentDeleteBtn.dataset.bound !== '1') {
        e.assignmentDeleteBtn.dataset.bound = '1';
        e.assignmentDeleteBtn.addEventListener('click', () => deleteAssignment().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.catalogType && e.catalogType.dataset.bound !== '1') {
        e.catalogType.dataset.bound = '1';
        e.catalogType.addEventListener('change', () => { fillCatalogForm(null); renderCatalogManager(); });
      }
      if (e.catalogItemId && e.catalogItemId.dataset.bound !== '1') {
        e.catalogItemId.dataset.bound = '1';
        e.catalogItemId.addEventListener('change', () => {
          const row = getCatalogRows(e.catalogType?.value || 'position').find((item) => String(item.id) === String(e.catalogItemId?.value || ''));
          fillCatalogForm(row || null);
        });
      }
      if (e.catalogBody && e.catalogBody.dataset.bound !== '1') {
        e.catalogBody.dataset.bound = '1';
        e.catalogBody.addEventListener('click', (event) => {
          const tr = event.target.closest('[data-catalog-id]');
          if (!tr) return;
          if (e.catalogItemId) e.catalogItemId.value = tr.getAttribute('data-catalog-id') || '';
          const row = getCatalogRows(e.catalogType?.value || 'position').find((item) => String(item.id) === String(e.catalogItemId?.value || ''));
          fillCatalogForm(row || null);
        });
      }
      if (e.catalogCreateBtn && e.catalogCreateBtn.dataset.bound !== '1') {
        e.catalogCreateBtn.dataset.bound = '1';
        e.catalogCreateBtn.addEventListener('click', () => saveCatalogItem(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.catalogSaveBtn && e.catalogSaveBtn.dataset.bound !== '1') {
        e.catalogSaveBtn.dataset.bound = '1';
        e.catalogSaveBtn.addEventListener('click', () => saveCatalogItem(false).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.catalogDeleteBtn && e.catalogDeleteBtn.dataset.bound !== '1') {
        e.catalogDeleteBtn.dataset.bound = '1';
        e.catalogDeleteBtn.addEventListener('click', () => deleteCatalogItem().catch((err) => setSummary(String(err?.message || err), true)));
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
