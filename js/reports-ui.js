/* File: js/reports-ui.js
   Brief description: Historical reporting screen for HSE, incidents, corrective actions,
   training / certification expiry, SDS acknowledgement history, scheduler, payroll,
   contracts, and workflow history.
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
  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }
  function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }
  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function ninetyDaysAgoISO() { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); }
  function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function normalizeFormKey(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['e','toolbox'].includes(raw)) return 'toolbox';
    if (['d','ppe'].includes(raw)) return 'ppe';
    if (['b','firstaid','first_aid'].includes(raw)) return 'firstaid';
    if (['c','inspection','site_inspection','inspect'].includes(raw)) return 'inspection';
    if (['a','drill','emergency_drill'].includes(raw)) return 'drill';
    if (['f','incident','incident_near_miss','near_miss'].includes(raw)) return 'incident';
    return raw;
  }

  function create(config = {}) {
    const loadAdminDirectory = config.loadAdminDirectory;
    const manageAdminEntity = config.manageAdminEntity;
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const getAccessProfile = config.getAccessProfile || (() => ({ rank: 0 }));
    const getAuthState = config.getAuthState || (() => ({}));
    const state = {
      submissionHistory: [], workflowHistory: [], dailyRollups: [], siteRollups: [],
      incidentHistory: [], monthlyTrends: [], workerRollups: [], contextRollups: [], presets: [],
      correctiveTasks: [], correctiveSummary: [], trainingCourses: [], trainingRecords: [], trainingSummary: [], sdsAcknowledgements: [], supervisorQueue: []
    };
    const els = {};

    function refreshEls() {
      Object.assign(els, {
        from: $('#rp_from'), to: $('#rp_to'), site: $('#rp_site'), form: $('#rp_form'), status: $('#rp_status'), type: $('#rp_type'),
        worker: $('#rp_worker'), context: $('#rp_context'), severity: $('#rp_severity'),
        preset: $('#rp_preset'), presetName: $('#rp_preset_name'), presetVisibility: $('#rp_preset_visibility'),
        summary: $('#rp_summary'), stats: $('#rp_stats'),
        submissionBody: $('#rp_submission_table tbody'), workflowBody: $('#rp_workflow_table tbody'),
        siteRollupBody: $('#rp_site_rollup_table tbody'), incidentBody: $('#rp_incident_table tbody'),
        trendBody: $('#rp_trend_table tbody'), workerBody: $('#rp_worker_table tbody'), contextBody: $('#rp_context_table tbody'),
        correctiveBody: $('#rp_corrective_table tbody'), trainingBody: $('#rp_training_table tbody'), sdsBody: $('#rp_sds_table tbody'), queueBody: $('#rp_queue_table tbody'),
        loadBtn: $('#rp_load'), exportSubmissionsBtn: $('#rp_export_submissions'), exportWorkflowBtn: $('#rp_export_workflow'),
        exportIncidentBtn: $('#rp_export_incidents'), exportCorrectiveBtn: $('#rp_export_corrective'), exportTrainingBtn: $('#rp_export_training'),
        savePresetBtn: $('#rp_save_preset'), deletePresetBtn: $('#rp_delete_preset')
      });
    }

    function ensureLayout() {
      const section = document.getElementById('reports');
      if (!section || section.dataset.layoutReady === '1') return;
      section.dataset.layoutReady = '1';
      section.innerHTML = `
        <div class="section-heading">
          <div>
            <h2>Historical Reports</h2>
            <p class="section-subtitle">Supervisor and Admin reporting for OSHA-facing form history, incidents, corrective actions, training / certification expiry, SDS acknowledgement, evidence review, payroll close, scheduler activity, and signed-contract workflow events.</p>
          </div>
          <div class="admin-heading-actions">
            <button id="rp_load" class="secondary" type="button">Reload Reports</button>
            <button id="rp_export_submissions" class="secondary" type="button">Export HSE CSV</button>
            <button id="rp_export_incidents" class="secondary" type="button">Export Incident CSV</button>
            <button id="rp_export_corrective" class="secondary" type="button">Export Corrective CSV</button>
            <button id="rp_export_training" class="secondary" type="button">Export Training CSV</button>
            <button id="rp_export_workflow" class="secondary" type="button">Export Workflow CSV</button>
          </div>
        </div>
        <div class="grid">
          <label>From<input id="rp_from" type="date" /></label>
          <label>To<input id="rp_to" type="date" /></label>
          <label>Site<input id="rp_site" type="text" list="site-options" placeholder="Site name or code" /></label>
          <label>Worker / Reporter<input id="rp_worker" type="text" placeholder="Worker, reporter, owner, assignee" /></label>
          <label>Context<input id="rp_context" type="text" placeholder="Job, work order, route, equipment, chemical" /></label>
          <label>Form
            <select id="rp_form">
              <option value="">All forms</option>
              <option value="toolbox">Toolbox</option>
              <option value="ppe">PPE</option>
              <option value="firstaid">First Aid</option>
              <option value="inspection">Inspection</option>
              <option value="drill">Drill</option>
              <option value="incident">Incident / Near Miss</option>
            </select>
          </label>
          <label>Status
            <select id="rp_status">
              <option value="">Any status</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under review</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="ready_for_review">Ready for Review</option>
              <option value="closed">Closed</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <label>Severity / Priority
            <select id="rp_severity">
              <option value="">Any severity / priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label>Workflow Type
            <select id="rp_type">
              <option value="">All workflow history</option>
              <option value="submission">Submission</option>
              <option value="hse_packet_event">HSE Packet Event</option>
              <option value="evidence_review">Evidence Review</option>
              <option value="scheduler_run">Scheduler Run</option>
              <option value="payroll_export">Payroll Export</option>
              <option value="signed_contract">Signed Contract</option>
            </select>
          </label>
        </div>
        <div class="grid" style="margin-top:12px;">
          <label>Saved Preset
            <select id="rp_preset"><option value="">Select a saved preset</option></select>
          </label>
          <label>Preset Name<input id="rp_preset_name" type="text" placeholder="Preset name" /></label>
          <label>Preset Visibility
            <select id="rp_preset_visibility">
              <option value="private">Private</option>
              <option value="shared">Shared</option>
            </select>
          </label>
          <div class="form-footer" style="align-items:end;">
            <button id="rp_save_preset" class="secondary" type="button">Save / Update Preset</button>
            <button id="rp_delete_preset" class="secondary" type="button">Delete Preset</button>
          </div>
        </div>
        <div id="rp_summary" class="notice" style="display:none;margin-top:12px;"></div>
        <div id="rp_stats" class="admin-stats-grid" style="margin-top:16px;"></div>

        <div class="reports-grid" style="margin-top:16px;">
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Supervisor Safety Queue</h3><p class="section-subtitle">Open corrective actions plus expiring training and SDS acknowledgements that need follow-up.</p></div></div>
            <div class="table-scroll"><table id="rp_queue_table"><thead><tr><th>Type</th><th>Context</th><th>Headline</th><th>Status</th><th>Priority</th><th>Owner</th><th>Due</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view the queue.</td></tr></tbody></table></div>
          </div>
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Corrective Actions</h3><p class="section-subtitle">Incident-driven follow-up tasks with due dates, escalation, status changes, and closeout history.</p></div></div>
            <div class="table-scroll"><table id="rp_corrective_table"><thead><tr><th>Due</th><th>Status</th><th>Priority</th><th>Site</th><th>Task</th><th>Owner / Assignee</th><th>Actions</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view corrective actions.</td></tr></tbody></table></div>
          </div>
        </div>

        <div class="reports-grid" style="margin-top:16px;">
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Training / Certification Records</h3><p class="section-subtitle">DB-backed completion records with upcoming expiry checks, certification numbers, and worker-level visibility.</p></div></div>
            <div class="table-scroll"><table id="rp_training_table"><thead><tr><th>Worker</th><th>Course</th><th>Status</th><th>Completed</th><th>Expiry</th><th>Certificate / Licence</th><th>Provider</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view training history.</td></tr></tbody></table></div>
          </div>
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">SDS Acknowledgements</h3><p class="section-subtitle">Worker acknowledgement history for chemicals / products that need recurring SDS confirmation.</p></div></div>
            <div class="table-scroll"><table id="rp_sds_table"><thead><tr><th>Worker</th><th>Chemical / Product</th><th>Status</th><th>Acknowledged</th><th>Expiry</th><th>Notes</th></tr></thead><tbody><tr><td colspan="6" class="muted">Load reports to view SDS acknowledgement history.</td></tr></tbody></table></div>
          </div>
        </div>

        <div class="reports-grid" style="margin-top:16px;">
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">HSE Form History</h3><p class="section-subtitle">All historical Toolbox, PPE, First Aid, Inspection, Drill, and Incident / Near Miss records with review and image counts.</p></div></div>
            <div class="table-scroll"><table id="rp_submission_table"><thead><tr><th>Date</th><th>Form</th><th>Site</th><th>Status</th><th>Submitted By</th><th>Worker</th><th>Reviews</th><th>Images</th></tr></thead><tbody><tr><td colspan="8" class="muted">Load reports to view history.</td></tr></tbody></table></div>
          </div>
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Incident / Near Miss History</h3><p class="section-subtitle">Field incidents, close calls, property damage, vehicle events, and linked corrective-action status.</p></div></div>
            <div class="table-scroll"><table id="rp_incident_table"><thead><tr><th>Date</th><th>Type</th><th>Severity</th><th>Site</th><th>Worker</th><th>Summary</th><th>Corrective Action</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view incidents.</td></tr></tbody></table></div>
          </div>
        </div>

        <div class="reports-grid" style="margin-top:16px;">
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Monthly Trends</h3><p class="section-subtitle">DB-backed trend counts by month and form, including near misses and high-severity incidents.</p></div></div>
            <div class="table-scroll"><table id="rp_trend_table"><thead><tr><th>Month</th><th>Form</th><th>Rows</th><th>Incidents</th><th>Near Misses</th><th>High Severity</th><th>Rejected</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view trends.</td></tr></tbody></table></div>
          </div>
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Site / Form Rollups</h3><p class="section-subtitle">Site-level safety activity, review, and incident mix without depending on browser-only state.</p></div></div>
            <div class="table-scroll"><table id="rp_site_rollup_table"><thead><tr><th>Site</th><th>Form</th><th>Rows</th><th>Incidents</th><th>Rejected</th><th>Reviewed</th><th>Last Submission</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view rollups.</td></tr></tbody></table></div>
          </div>
        </div>

        <div class="reports-grid" style="margin-top:16px;">
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Worker Rollups</h3><p class="section-subtitle">Who is filing, who is involved in incidents, and where trend attention is needed.</p></div></div>
            <div class="table-scroll"><table id="rp_worker_table"><thead><tr><th>Worker</th><th>Rows</th><th>Incidents</th><th>Near Misses</th><th>High Severity</th><th>Last Submission</th></tr></thead><tbody><tr><td colspan="6" class="muted">Load reports to view worker rollups.</td></tr></tbody></table></div>
          </div>
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Site / Job / Route Context</h3><p class="section-subtitle">Link safety activity to jobs, work orders, and routes for stronger operational follow-through.</p></div></div>
            <div class="table-scroll"><table id="rp_context_table"><thead><tr><th>Site</th><th>Job</th><th>Work Order</th><th>Route</th><th>Rows</th><th>Incidents</th><th>Last Submission</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view context rollups.</td></tr></tbody></table></div>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading"><div><h3 style="margin:0;">Workflow History</h3><p class="section-subtitle">Cross-workflow history including scheduler runs, evidence review, payroll close, and signed contracts.</p></div></div>
          <div class="table-scroll"><table id="rp_workflow_table"><thead><tr><th>Occurred</th><th>Type</th><th>Status</th><th>Record</th><th>Headline</th><th>Detail</th></tr></thead><tbody><tr><td colspan="6" class="muted">Load reports to view workflow history.</td></tr></tbody></table></div>
        </div>`;
    }

    function hasAccess() { return Number(getAccessProfile(getCurrentRole()).rank || 0) >= 30; }
    function applyRoleVisibility() {
      const section = document.getElementById('reports');
      if (!section) return;
      section.style.display = hasAccess() ? '' : 'none';
    }
    function setSummary(message, isError = false) {
      if (!els.summary) return;
      els.summary.style.display = message ? '' : 'none';
      els.summary.classList.toggle('warning', !!isError);
      els.summary.textContent = message || '';
    }
    function currentFilters() {
      return {
        from: els.from?.value || '', to: els.to?.value || '', site: String(els.site?.value || '').trim().toLowerCase(),
        worker: String(els.worker?.value || '').trim().toLowerCase(), context: String(els.context?.value || '').trim().toLowerCase(),
        form: normalizeFormKey(els.form?.value || ''), status: String(els.status?.value || '').trim().toLowerCase(),
        severity: String(els.severity?.value || '').trim().toLowerCase(), type: String(els.type?.value || '').trim().toLowerCase()
      };
    }
    function filterDate(value, from, to) {
      const raw = String(value || '').slice(0, 10);
      if (!raw) return true;
      if (from && raw < from) return false;
      if (to && raw > to) return false;
      return true;
    }
    function applyTextFilter(values = [], needle = '') {
      if (!needle) return true;
      return values.some((v) => String(v || '').toLowerCase().includes(needle));
    }
    function getFilteredSubmissions() {
      const f = currentFilters();
      return (state.submissionHistory || []).filter((row) => {
        if (!filterDate(row.submission_date || row.created_at, f.from, f.to)) return false;
        if (f.form && normalizeFormKey(row.form_key || row.form_type) !== f.form) return false;
        if (f.status && String(row.status || '').toLowerCase() !== f.status) return false;
        if (f.severity && String(row.severity || '').toLowerCase() !== f.severity) return false;
        if (!applyTextFilter([row.site_code, row.site_name, row.site_label], f.site)) return false;
        if (!applyTextFilter([row.worker_name, row.submitted_by_name, row.supervisor_name], f.worker)) return false;
        if (!applyTextFilter([row.job_code, row.work_order_number, row.route_code, row.equipment_code], f.context)) return false;
        return true;
      });
    }
    function getFilteredIncidents() {
      const f = currentFilters();
      return (state.incidentHistory || []).filter((row) => {
        if (!filterDate(row.submission_date || row.created_at, f.from, f.to)) return false;
        if (f.status && String(row.status || '').toLowerCase() !== f.status) return false;
        if (f.severity && ![String(row.severity || '').toLowerCase(), String(row.priority || '').toLowerCase()].includes(f.severity)) return false;
        if (!applyTextFilter([row.site_code, row.site_name, row.site_label], f.site)) return false;
        if (!applyTextFilter([row.worker_name, row.submitted_by_name, row.corrective_action_owner], f.worker)) return false;
        if (!applyTextFilter([row.job_code, row.work_order_number, row.route_code, row.equipment_code, row.event_summary], f.context)) return false;
        return true;
      });
    }
    function getFilteredWorkflow() {
      const f = currentFilters();
      return (state.workflowHistory || []).filter((row) => {
        if (!filterDate(row.occurred_at, f.from, f.to)) return false;
        if (f.type && String(row.history_type || '').toLowerCase() !== f.type) return false;
        if (f.status && String(row.record_status || '').toLowerCase() !== f.status) return false;
        if (!applyTextFilter([row.site_code, row.site_name, row.detail, row.headline], f.site || f.context)) return false;
        return true;
      });
    }
    function getFilteredSiteRollups() {
      const f = currentFilters();
      return (state.siteRollups || []).filter((row) => {
        if (!filterDate(row.last_submission_date, f.from, f.to)) return false;
        if (f.form && normalizeFormKey(row.form_key || row.form_type) !== f.form) return false;
        if (!applyTextFilter([row.site_code, row.site_name, row.site_label], f.site)) return false;
        return true;
      });
    }
    function getFilteredTrends() {
      const f = currentFilters();
      return (state.monthlyTrends || []).filter((row) => {
        if (!filterDate(row.month_start, f.from, f.to)) return false;
        if (f.form && normalizeFormKey(row.form_key) !== f.form) return false;
        return true;
      });
    }
    function getFilteredWorkerRollups() {
      const f = currentFilters();
      return (state.workerRollups || []).filter((row) => applyTextFilter([row.worker_label, row.submitted_by_name, row.form_labels], f.worker));
    }
    function getFilteredContextRollups() {
      const f = currentFilters();
      return (state.contextRollups || []).filter((row) => applyTextFilter([row.site_label], f.site) && applyTextFilter([row.job_code, row.work_order_number, row.route_code], f.context));
    }
    function getFilteredCorrectiveTasks() {
      const f = currentFilters();
      return (state.correctiveTasks || []).filter((row) => {
        if (!filterDate(row.due_date || row.created_at, f.from, f.to)) return false;
        if (f.status && String(row.status || '').toLowerCase() !== f.status) return false;
        if (f.severity && String(row.priority || '').toLowerCase() !== f.severity) return false;
        if (!applyTextFilter([row.site_code, row.site_name, row.site_label], f.site)) return false;
        if (!applyTextFilter([row.worker_name, row.owner_name, row.assigned_to_name], f.worker)) return false;
        if (!applyTextFilter([row.job_code, row.work_order_number, row.route_code, row.task_title, row.task_description, row.event_summary], f.context)) return false;
        return true;
      });
    }
    function getFilteredTrainingRecords() {
      const f = currentFilters();
      return (state.trainingRecords || []).filter((row) => {
        if (!filterDate(row.expires_at || row.completed_at || row.created_at, f.from, f.to)) return false;
        if (f.status && String(row.completion_status || '').toLowerCase() !== f.status) return false;
        if (!applyTextFilter([row.profile_name, row.course_name, row.provider_name, row.certificate_number, row.license_number], f.worker || f.context)) return false;
        return true;
      });
    }
    function getFilteredSds() {
      const f = currentFilters();
      return (state.sdsAcknowledgements || []).filter((row) => {
        if (!filterDate(row.expires_at || row.acknowledged_at || row.created_at, f.from, f.to)) return false;
        if (f.status && String(row.status || '').toLowerCase() !== f.status) return false;
        if (!applyTextFilter([row.profile_name], f.worker)) return false;
        if (!applyTextFilter([row.chemical_name, row.product_name, row.vendor_name], f.context)) return false;
        return true;
      });
    }
    function getFilteredQueue() {
      const f = currentFilters();
      return (state.supervisorQueue || []).filter((row) => {
        if (!filterDate(row.sort_at, f.from, f.to)) return false;
        if (f.status && String(row.queue_status || '').toLowerCase() !== f.status) return false;
        if (f.severity && String(row.queue_priority || '').toLowerCase() !== f.severity) return false;
        if (!applyTextFilter([row.primary_context, row.headline], f.site || f.context)) return false;
        if (!applyTextFilter([row.owner_name], f.worker)) return false;
        return true;
      });
    }

    function renderStats(subs, incidents, workflow, corrective, training, sds) {
      if (!els.stats) return;
      const reviewed = subs.filter((row) => Number(row.review_count || 0) > 0).length;
      const rejected = subs.filter((row) => String(row.status || '').toLowerCase() === 'rejected' || String(row.last_review_action || '').toLowerCase() === 'rejected').length;
      const nearMisses = incidents.filter((row) => String(row.incident_kind || '').toLowerCase() === 'near_miss').length;
      const highSeverity = incidents.filter((row) => ['high','critical'].includes(String(row.severity || '').toLowerCase())).length;
      const openCorrective = corrective.filter((row) => String(row.status || '').toLowerCase() !== 'closed').length;
      const overdueCorrective = corrective.filter((row) => !!row.is_overdue).length;
      const expiringTraining = training.filter((row) => !!row.expires_within_30_days || !!row.is_expired).length;
      const expiringSds = sds.filter((row) => !!row.expires_within_30_days || !!row.is_expired).length;
      const cards = [
        ['HSE submissions', subs.length, 'All DB-backed form rows that match the current filters.'],
        ['Incident / near miss rows', incidents.length, 'Incident, close-call, damage, and vehicle event history parsed into report-safe columns.'],
        ['Near misses', nearMisses, 'Close calls that should still drive hazard correction and trend review.'],
        ['High severity incidents', highSeverity, 'Rows marked high or critical for faster office follow-up.'],
        ['Reviewed / approved', reviewed, 'Rows with at least one review event recorded.'],
        ['Rejected / follow-up', rejected, 'Rows that still need correction or follow-up handling.'],
        ['Open corrective actions', openCorrective, 'First-class follow-up tasks created from incidents and hazards.'],
        ['Overdue corrective actions', overdueCorrective, 'Tasks past due that need escalation or closure.'],
        ['Training / cert expiry', expiringTraining, 'Records that are expired or within 30 days of expiry.'],
        ['SDS acknowledgements expiring', expiringSds, 'Chemical acknowledgement records that need renewal or review.'],
        ['Workflow events', workflow.length, 'Combined payroll, scheduler, contract, evidence, packet, and submission history.'],
        ['Saved presets', (state.presets || []).length, 'DB-backed report filters supervisors and admins can reuse.']
      ];
      els.stats.innerHTML = cards.map(([label, value, help]) => `
        <div class="admin-stat-card">
          <div class="admin-stat-label">${escHtml(label)}</div>
          <div class="admin-stat-value">${escHtml(value)}</div>
          <div class="report-mini-note">${escHtml(help)}</div>
        </div>`).join('');
    }
    function renderSubmissionTable(rows) {
      if (!els.submissionBody) return;
      if (!rows.length) { els.submissionBody.innerHTML = '<tr><td colspan="8" class="muted">No HSE submission history matches the current filters.</td></tr>'; return; }
      els.submissionBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(formatDate(row.submission_date || row.created_at))}</td>
          <td>${escHtml(row.form_label || row.form_key || row.form_type || '')}</td>
          <td>${escHtml(row.site_label || row.site_name || row.site_code || '')}</td>
          <td>${escHtml(row.status || '')}</td>
          <td>${escHtml(row.submitted_by_name || '')}</td>
          <td>${escHtml(row.worker_name || '')}</td>
          <td>${escHtml(row.review_count || 0)}</td>
          <td>${escHtml(row.image_count || 0)}</td>
        </tr>`).join('');
    }
    function renderIncidentTable(rows) {
      if (!els.incidentBody) return;
      if (!rows.length) { els.incidentBody.innerHTML = '<tr><td colspan="7" class="muted">No incidents or near misses match the current filters.</td></tr>'; return; }
      els.incidentBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(formatDate(row.submission_date || row.created_at))}</td>
          <td>${escHtml(row.incident_kind || '')}</td>
          <td>${escHtml(row.severity || '')}</td>
          <td>${escHtml(row.site_label || row.site_name || row.site_code || '')}</td>
          <td>${escHtml(row.worker_name || row.submitted_by_name || '')}</td>
          <td>${escHtml(row.event_summary || '')}</td>
          <td>${escHtml(row.corrective_action_status || '')}${row.corrective_action_owner ? ` · ${escHtml(row.corrective_action_owner)}` : ''}</td>
        </tr>`).join('');
    }
    function renderTrendTable(rows) {
      if (!els.trendBody) return;
      if (!rows.length) { els.trendBody.innerHTML = '<tr><td colspan="7" class="muted">No monthly trends match the current filters.</td></tr>'; return; }
      els.trendBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(formatDate(row.month_start || ''))}</td>
          <td>${escHtml(row.form_label || row.form_key || '')}</td>
          <td>${escHtml(row.submission_count || 0)}</td>
          <td>${escHtml(row.incident_count || 0)}</td>
          <td>${escHtml(row.near_miss_count || 0)}</td>
          <td>${escHtml(row.high_severity_incident_count || 0)}</td>
          <td>${escHtml(row.rejected_count || 0)}</td>
        </tr>`).join('');
    }
    function renderSiteRollupTable(rows) {
      if (!els.siteRollupBody) return;
      if (!rows.length) { els.siteRollupBody.innerHTML = '<tr><td colspan="7" class="muted">No site/form rollups match the current filters.</td></tr>'; return; }
      els.siteRollupBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(row.site_label || row.site_name || row.site_code || '')}</td>
          <td>${escHtml(row.form_label || row.form_key || row.form_type || '')}</td>
          <td>${escHtml(row.submission_count || 0)}</td>
          <td>${escHtml(row.incident_count || 0)}</td>
          <td>${escHtml(row.rejected_count || 0)}</td>
          <td>${escHtml(row.reviewed_count || 0)}</td>
          <td>${escHtml(formatDate(row.last_submission_date || ''))}</td>
        </tr>`).join('');
    }
    function renderWorkerTable(rows) {
      if (!els.workerBody) return;
      if (!rows.length) { els.workerBody.innerHTML = '<tr><td colspan="6" class="muted">No worker rollups match the current filters.</td></tr>'; return; }
      els.workerBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(row.worker_label || '')}</td>
          <td>${escHtml(row.submission_count || 0)}</td>
          <td>${escHtml(row.incident_count || 0)}</td>
          <td>${escHtml(row.near_miss_count || 0)}</td>
          <td>${escHtml(row.high_severity_incident_count || 0)}</td>
          <td>${escHtml(formatDate(row.last_submission_date || ''))}</td>
        </tr>`).join('');
    }
    function renderContextTable(rows) {
      if (!els.contextBody) return;
      if (!rows.length) { els.contextBody.innerHTML = '<tr><td colspan="7" class="muted">No site/job/route rollups match the current filters.</td></tr>'; return; }
      els.contextBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(row.site_label || '')}</td>
          <td>${escHtml(row.job_code || '')}</td>
          <td>${escHtml(row.work_order_number || '')}</td>
          <td>${escHtml(row.route_code || '')}</td>
          <td>${escHtml(row.submission_count || 0)}</td>
          <td>${escHtml(row.incident_count || 0)}</td>
          <td>${escHtml(formatDate(row.last_submission_date || ''))}</td>
        </tr>`).join('');
    }
    function renderWorkflowTable(rows) {
      if (!els.workflowBody) return;
      if (!rows.length) { els.workflowBody.innerHTML = '<tr><td colspan="6" class="muted">No workflow history matches the current filters.</td></tr>'; return; }
      els.workflowBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(formatDateTime(row.occurred_at || ''))}</td>
          <td>${escHtml(row.history_type || '')}</td>
          <td>${escHtml(row.record_status || '')}</td>
          <td>${escHtml(row.record_number || '')}</td>
          <td>${escHtml(row.headline || '')}</td>
          <td>${escHtml(row.detail || '')}</td>
        </tr>`).join('');
    }
    function renderQueueTable(rows) {
      if (!els.queueBody) return;
      if (!rows.length) { els.queueBody.innerHTML = '<tr><td colspan="7" class="muted">No queue items match the current filters.</td></tr>'; return; }
      els.queueBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(row.queue_type || '')}</td>
          <td>${escHtml(row.primary_context || '')}</td>
          <td>${escHtml(row.headline || '')}</td>
          <td>${escHtml(row.queue_status || '')}</td>
          <td>${escHtml(row.queue_priority || '')}</td>
          <td>${escHtml(row.owner_name || '')}</td>
          <td>${escHtml(row.due_label || '')}</td>
        </tr>`).join('');
    }
    function renderCorrectiveActions(rows) {
      if (!els.correctiveBody) return;
      if (!rows.length) { els.correctiveBody.innerHTML = '<tr><td colspan="7" class="muted">No corrective actions match the current filters.</td></tr>'; return; }
      const canManage = typeof manageAdminEntity === 'function' && Number(getAccessProfile(getCurrentRole()).rank || 0) >= 30;
      els.correctiveBody.innerHTML = rows.map((row) => {
        const actionButtons = canManage ? `
          <div class="form-footer" style="margin:0;gap:6px;">
            ${String(row.status || '').toLowerCase() === 'open' ? `<button class="secondary" type="button" data-corrective-action="start" data-task-id="${escHtml(row.id)}">Start</button>` : ''}
            ${['open','in_progress','blocked'].includes(String(row.status || '').toLowerCase()) ? `<button class="secondary" type="button" data-corrective-action="review" data-task-id="${escHtml(row.id)}">Ready</button>` : ''}
            ${String(row.status || '').toLowerCase() !== 'closed' ? `<button class="secondary" type="button" data-corrective-action="close" data-task-id="${escHtml(row.id)}">Close</button>` : ''}
          </div>` : '';
        return `
        <tr>
          <td>${escHtml(formatDate(row.due_date || ''))}${row.is_overdue ? '<div class="report-mini-note">Overdue</div>' : ''}</td>
          <td>${escHtml(row.status || '')}</td>
          <td>${escHtml(row.priority || '')}</td>
          <td>${escHtml(row.site_label || row.site_name || row.site_code || '')}</td>
          <td>${escHtml(row.task_title || '')}${row.event_summary ? `<div class="report-mini-note">${escHtml(row.event_summary)}</div>` : ''}</td>
          <td>${escHtml(row.owner_name || row.assigned_to_name || '')}</td>
          <td>${actionButtons}</td>
        </tr>`;
      }).join('');
    }
    function renderTraining(rows) {
      if (!els.trainingBody) return;
      if (!rows.length) { els.trainingBody.innerHTML = '<tr><td colspan="7" class="muted">No training / certification records match the current filters.</td></tr>'; return; }
      els.trainingBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(row.profile_name || '')}</td>
          <td>${escHtml(row.course_name || row.course_code || '')}</td>
          <td>${escHtml(row.completion_status || '')}${row.is_expired ? '<div class="report-mini-note">Expired</div>' : row.expires_within_30_days ? '<div class="report-mini-note">Expiring soon</div>' : ''}</td>
          <td>${escHtml(formatDate(row.completed_at || ''))}</td>
          <td>${escHtml(formatDate(row.expires_at || ''))}</td>
          <td>${escHtml(row.certificate_number || row.license_number || '')}</td>
          <td>${escHtml(row.provider_name || row.trainer_name || '')}</td>
        </tr>`).join('');
    }
    function renderSds(rows) {
      if (!els.sdsBody) return;
      if (!rows.length) { els.sdsBody.innerHTML = '<tr><td colspan="6" class="muted">No SDS acknowledgement rows match the current filters.</td></tr>'; return; }
      els.sdsBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(row.profile_name || '')}</td>
          <td>${escHtml(row.chemical_name || row.product_name || '')}</td>
          <td>${escHtml(row.status || '')}${row.is_expired ? '<div class="report-mini-note">Expired</div>' : row.expires_within_30_days ? '<div class="report-mini-note">Expiring soon</div>' : ''}</td>
          <td>${escHtml(formatDate(row.acknowledged_at || ''))}</td>
          <td>${escHtml(formatDate(row.expires_at || ''))}</td>
          <td>${escHtml(row.notes || '')}</td>
        </tr>`).join('');
    }
    function currentPresetPayload() {
      const f = currentFilters();
      return { from: f.from, to: f.to, site: els.site?.value || '', worker: els.worker?.value || '', context: els.context?.value || '', form: f.form, status: f.status, severity: f.severity, workflow_type: f.type };
    }
    function populatePresetSelect() {
      if (!els.preset) return;
      const options = ['<option value="">Select a saved preset</option>'];
      for (const row of state.presets || []) {
        options.push(`<option value="${escHtml(row.id || '')}">${escHtml(row.preset_name || '')}${row.visibility === 'shared' ? ' · shared' : ''}</option>`);
      }
      els.preset.innerHTML = options.join('');
    }
    function applyPreset(row) {
      if (!row?.preset_payload) return;
      const payload = row.preset_payload || {};
      if (els.from) els.from.value = payload.from || '';
      if (els.to) els.to.value = payload.to || '';
      if (els.site) els.site.value = payload.site || '';
      if (els.worker) els.worker.value = payload.worker || '';
      if (els.context) els.context.value = payload.context || '';
      if (els.form) els.form.value = normalizeFormKey(payload.form || '');
      if (els.status) els.status.value = payload.status || '';
      if (els.severity) els.severity.value = payload.severity || '';
      if (els.type) els.type.value = payload.workflow_type || '';
      if (els.presetName) els.presetName.value = row.preset_name || '';
      if (els.presetVisibility) els.presetVisibility.value = row.visibility || 'private';
      renderAll();
    }
    async function savePreset() {
      if (typeof manageAdminEntity !== 'function') return;
      const presetName = String(els.presetName?.value || '').trim();
      if (!presetName) { setSummary('Preset name is required.', true); return; }
      const selected = (state.presets || []).find((row) => String(row.id) === String(els.preset?.value || '')) || null;
      const payload = {
        entity: 'report_preset',
        action: selected ? 'update' : 'create',
        item_id: selected?.id || null,
        preset_scope: 'hse_reporting',
        preset_name: presetName,
        visibility: els.presetVisibility?.value || 'private',
        preset_payload: currentPresetPayload(),
        is_active: true
      };
      try {
        await manageAdminEntity(payload);
        setSummary(`Saved preset “${presetName}”.`);
        await loadReports();
      } catch (err) {
        setSummary(err?.message || 'Unable to save report preset.', true);
      }
    }
    async function deletePreset() {
      if (typeof manageAdminEntity !== 'function') return;
      const selectedId = String(els.preset?.value || '').trim();
      if (!selectedId) { setSummary('Select a preset to delete.', true); return; }
      try {
        await manageAdminEntity({ entity: 'report_preset', action: 'delete', item_id: selectedId });
        if (els.presetName) els.presetName.value = '';
        if (els.preset) els.preset.value = '';
        setSummary('Preset deleted.');
        await loadReports();
      } catch (err) {
        setSummary(err?.message || 'Unable to delete report preset.', true);
      }
    }
    async function changeCorrectiveTask(taskId, nextStatus) {
      const task = (state.correctiveTasks || []).find((row) => String(row.id) === String(taskId));
      if (!task || typeof manageAdminEntity !== 'function') return;
      let eventNotes = '';
      let closeoutNotes = task.closeout_notes || '';
      if (nextStatus === 'closed') {
        closeoutNotes = prompt('Enter closeout notes for this corrective action:', String(task.closeout_notes || task.task_description || '')) || '';
        if (!closeoutNotes.trim()) { setSummary('Closeout notes are required when closing a corrective action.', true); return; }
        eventNotes = closeoutNotes;
      } else {
        eventNotes = prompt(`Add an optional note for status ${nextStatus.replaceAll('_', ' ')}:`, '') || '';
      }
      try {
        await manageAdminEntity({
          entity: 'corrective_action_task',
          action: 'set_status',
          item_id: task.id,
          task_title: task.task_title,
          task_description: task.task_description,
          priority: task.priority,
          status: nextStatus,
          owner_name: task.owner_name,
          due_date: task.due_date,
          assigned_to_profile_id: task.assigned_to_profile_id,
          closeout_notes: closeoutNotes,
          payload: task.payload || {},
          event_notes: eventNotes
        });
        setSummary(`Corrective action updated to ${nextStatus.replaceAll('_', ' ')}.`);
        await loadReports();
      } catch (err) {
        setSummary(err?.message || 'Unable to update corrective action.', true);
      }
    }
    function renderAll() {
      if (!hasAccess()) return;
      const subs = getFilteredSubmissions();
      const incidents = getFilteredIncidents();
      const workflow = getFilteredWorkflow();
      const siteRollups = getFilteredSiteRollups();
      const trends = getFilteredTrends();
      const workers = getFilteredWorkerRollups();
      const contexts = getFilteredContextRollups();
      const corrective = getFilteredCorrectiveTasks();
      const training = getFilteredTrainingRecords();
      const sds = getFilteredSds();
      const queue = getFilteredQueue();
      renderStats(subs, incidents, workflow, corrective, training, sds);
      renderQueueTable(queue);
      renderCorrectiveActions(corrective);
      renderTraining(training);
      renderSds(sds);
      renderSubmissionTable(subs);
      renderIncidentTable(incidents);
      renderTrendTable(trends);
      renderSiteRollupTable(siteRollups);
      renderWorkerTable(workers);
      renderContextTable(contexts);
      renderWorkflowTable(workflow);
      setSummary(`Loaded ${subs.length} HSE row(s), ${incidents.length} incident row(s), ${corrective.length} corrective action row(s), ${training.length} training row(s), ${sds.length} SDS row(s), and ${workflow.length} workflow event row(s) for the current filters.`);
    }
    function exportCsv(kind) {
      let rows = [];
      let headers = [];
      if (kind === 'workflow') {
        rows = getFilteredWorkflow();
        headers = ['Occurred At', 'History Type', 'Status', 'Record', 'Headline', 'Detail'];
      } else if (kind === 'incident') {
        rows = getFilteredIncidents();
        headers = ['Submission Date', 'Incident Kind', 'Severity', 'Site', 'Worker', 'Job Code', 'Work Order', 'Route', 'Summary', 'Immediate Actions', 'Root Cause', 'Corrective Owner', 'Corrective Status', 'Corrective Due'];
      } else if (kind === 'corrective') {
        rows = getFilteredCorrectiveTasks();
        headers = ['Due Date', 'Status', 'Priority', 'Site', 'Task Title', 'Task Description', 'Owner', 'Assigned To', 'Worker', 'Job Code', 'Work Order', 'Route', 'Overdue', 'Closeout Notes'];
      } else if (kind === 'training') {
        rows = getFilteredTrainingRecords();
        headers = ['Worker', 'Course', 'Status', 'Completed', 'Expiry', 'Certificate Number', 'Licence Number', 'Provider', 'Trainer', 'Days Until Expiry'];
      } else {
        rows = getFilteredSubmissions();
        headers = ['Submission Date', 'Form', 'Site', 'Status', 'Submitted By', 'Worker', 'Review Count', 'Image Count', 'Last Review Action', 'Last Reviewed At'];
      }
      const lines = [headers.map(csvCell).join(',')];
      rows.forEach((row) => {
        const values = kind === 'workflow'
          ? [row.occurred_at, row.history_type, row.record_status, row.record_number, row.headline, row.detail]
          : kind === 'incident'
            ? [row.submission_date, row.incident_kind, row.severity, row.site_label || row.site_name || row.site_code || '', row.worker_name || row.submitted_by_name || '', row.job_code || '', row.work_order_number || '', row.route_code || '', row.event_summary || '', row.immediate_actions_taken || '', row.root_cause_summary || '', row.corrective_action_owner || '', row.corrective_action_status || '', row.corrective_action_due_date || '']
            : kind === 'corrective'
              ? [row.due_date, row.status, row.priority, row.site_label || row.site_name || row.site_code || '', row.task_title || '', row.task_description || '', row.owner_name || '', row.assigned_to_name || '', row.worker_name || '', row.job_code || '', row.work_order_number || '', row.route_code || '', row.is_overdue ? 'yes' : 'no', row.closeout_notes || '']
              : kind === 'training'
                ? [row.profile_name || '', row.course_name || row.course_code || '', row.completion_status || '', row.completed_at || '', row.expires_at || '', row.certificate_number || '', row.license_number || '', row.provider_name || '', row.trainer_name || '', row.days_until_expiry ?? '']
                : [row.submission_date, row.form_label || row.form_key || row.form_type || '', row.site_label || row.site_name || row.site_code || '', row.status, row.submitted_by_name || '', row.worker_name || '', row.review_count || 0, row.image_count || 0, row.last_review_action || '', row.last_reviewed_at || ''];
        lines.push(values.map(csvCell).join(','));
      });
      downloadTextFile(`ywi-${kind}-report-${todayISO()}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
    }
    async function loadReports() {
      if (!hasAccess()) return;
      setSummary('Loading historical reports...');
      try {
        const payload = await loadAdminDirectory({ scope: 'reporting', limit: 500 });
        state.submissionHistory = Array.isArray(payload?.hse_submission_history_report) ? payload.hse_submission_history_report : [];
        state.workflowHistory = Array.isArray(payload?.workflow_history_report) ? payload.workflow_history_report : [];
        state.dailyRollups = Array.isArray(payload?.hse_form_daily_rollup) ? payload.hse_form_daily_rollup : [];
        state.siteRollups = Array.isArray(payload?.hse_form_site_rollup) ? payload.hse_form_site_rollup : [];
        state.incidentHistory = Array.isArray(payload?.incident_near_miss_history) ? payload.incident_near_miss_history : [];
        state.monthlyTrends = Array.isArray(payload?.hse_reporting_monthly_trends) ? payload.hse_reporting_monthly_trends : [];
        state.workerRollups = Array.isArray(payload?.hse_reporting_worker_rollup) ? payload.hse_reporting_worker_rollup : [];
        state.contextRollups = Array.isArray(payload?.hse_reporting_context_rollup) ? payload.hse_reporting_context_rollup : [];
        state.correctiveTasks = Array.isArray(payload?.corrective_action_task_directory) ? payload.corrective_action_task_directory : [];
        state.correctiveSummary = Array.isArray(payload?.corrective_action_task_summary) ? payload.corrective_action_task_summary : [];
        state.trainingCourses = Array.isArray(payload?.training_course_directory) ? payload.training_course_directory : [];
        state.trainingRecords = Array.isArray(payload?.training_record_directory) ? payload.training_record_directory : [];
        state.trainingSummary = Array.isArray(payload?.training_expiry_summary) ? payload.training_expiry_summary : [];
        state.sdsAcknowledgements = Array.isArray(payload?.sds_acknowledgement_directory) ? payload.sds_acknowledgement_directory : [];
        state.supervisorQueue = Array.isArray(payload?.supervisor_safety_queue) ? payload.supervisor_safety_queue : [];
        const actorId = String(getAuthState()?.user?.id || getAuthState()?.profile?.id || '');
        state.presets = (Array.isArray(payload?.report_preset_directory) ? payload.report_preset_directory : []).filter((row) => row.visibility === 'shared' || String(row.created_by_profile_id || '') === actorId);
        populatePresetSelect();
        renderAll();
      } catch (err) {
        console.error(err);
        setSummary(err?.message || 'Unable to load historical reports.', true);
      }
    }
    function bindEvents() {
      els.loadBtn?.addEventListener('click', loadReports);
      els.exportSubmissionsBtn?.addEventListener('click', () => exportCsv('hse-submissions'));
      els.exportIncidentBtn?.addEventListener('click', () => exportCsv('incident'));
      els.exportCorrectiveBtn?.addEventListener('click', () => exportCsv('corrective'));
      els.exportTrainingBtn?.addEventListener('click', () => exportCsv('training'));
      els.exportWorkflowBtn?.addEventListener('click', () => exportCsv('workflow'));
      els.savePresetBtn?.addEventListener('click', savePreset);
      els.deletePresetBtn?.addEventListener('click', deletePreset);
      els.preset?.addEventListener('change', () => applyPreset((state.presets || []).find((row) => String(row.id) === String(els.preset?.value || ''))));
      [els.from, els.to, els.site, els.form, els.status, els.type, els.worker, els.context, els.severity].forEach((el) => el?.addEventListener('change', renderAll));
      document.getElementById('reports')?.addEventListener('click', (event) => {
        const btn = event.target instanceof Element ? event.target.closest('[data-corrective-action]') : null;
        if (!btn) return;
        const taskId = btn.getAttribute('data-task-id') || '';
        const action = btn.getAttribute('data-corrective-action') || '';
        if (!taskId || !action) return;
        if (action === 'start') changeCorrectiveTask(taskId, 'in_progress');
        else if (action === 'review') changeCorrectiveTask(taskId, 'ready_for_review');
        else if (action === 'close') changeCorrectiveTask(taskId, 'closed');
      });
      document.addEventListener('ywi:route-shown', (event) => {
        if (event?.detail?.allowed === 'reports' && hasAccess()) renderAll();
      });
    }
    async function init() {
      ensureLayout(); refreshEls(); applyRoleVisibility(); if (!hasAccess()) return;
      if (els.from && !els.from.value) els.from.value = ninetyDaysAgoISO();
      if (els.to && !els.to.value) els.to.value = todayISO();
      bindEvents();
      await loadReports();
    }
    return { init, applyRoleVisibility, loadReports };
  }
  window.YWIReportsUI = { create };
})();
