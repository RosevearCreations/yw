/* File: js/reports-ui.js
   Brief description: Historical reporting screen for HSE, incidents, scheduler, payroll, contracts, and workflow history.
   Loads DB-backed reporting datasets, supports saved presets, exports, and richer site/worker/context drill-downs.
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
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function ninetyDaysAgoISO() { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); }
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
      incidentHistory: [], monthlyTrends: [], workerRollups: [], contextRollups: [], presets: []
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
        loadBtn: $('#rp_load'), exportSubmissionsBtn: $('#rp_export_submissions'), exportWorkflowBtn: $('#rp_export_workflow'),
        exportIncidentBtn: $('#rp_export_incidents'), savePresetBtn: $('#rp_save_preset'), deletePresetBtn: $('#rp_delete_preset')
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
            <p class="section-subtitle">Supervisor and Admin reporting for OSHA-facing form history, incident / near-miss follow-up, evidence review, payroll close, scheduler activity, and signed-contract workflow events.</p>
          </div>
          <div class="admin-heading-actions">
            <button id="rp_load" class="secondary" type="button">Reload Reports</button>
            <button id="rp_export_submissions" class="secondary" type="button">Export HSE CSV</button>
            <button id="rp_export_incidents" class="secondary" type="button">Export Incident CSV</button>
            <button id="rp_export_workflow" class="secondary" type="button">Export Workflow CSV</button>
          </div>
        </div>
        <div class="grid">
          <label>From<input id="rp_from" type="date" /></label>
          <label>To<input id="rp_to" type="date" /></label>
          <label>Site<input id="rp_site" type="text" list="site-options" placeholder="Site name or code" /></label>
          <label>Worker / Reporter<input id="rp_worker" type="text" placeholder="Worker, reporter, or owner" /></label>
          <label>Context<input id="rp_context" type="text" placeholder="Job, work order, route, equipment" /></label>
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
            </select>
          </label>
          <label>Severity
            <select id="rp_severity">
              <option value="">Any severity</option>
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
            <div class="section-heading"><div><h3 style="margin:0;">HSE Form History</h3><p class="section-subtitle">All historical Toolbox, PPE, First Aid, Inspection, Drill, and Incident / Near Miss records with review and image counts.</p></div></div>
            <div class="table-scroll"><table id="rp_submission_table"><thead><tr><th>Date</th><th>Form</th><th>Site</th><th>Status</th><th>Submitted By</th><th>Worker</th><th>Reviews</th><th>Images</th></tr></thead><tbody><tr><td colspan="8" class="muted">Load reports to view history.</td></tr></tbody></table></div>
          </div>
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Incident / Near Miss History</h3><p class="section-subtitle">Field incidents, close calls, property damage, vehicle events, and corrective-action status.</p></div></div>
            <div class="table-scroll"><table id="rp_incident_table"><thead><tr><th>Date</th><th>Type</th><th>Severity</th><th>Site</th><th>Worker</th><th>Summary</th><th>Corrective Action</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view incidents.</td></tr></tbody></table></div>
          </div>
        </div>
        <div class="reports-grid" style="margin-top:16px;">
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Monthly Trends</h3><p class="section-subtitle">DB-backed trend counts by month and form, including near misses and high-severity incidents.</p></div></div>
            <div class="table-scroll"><table id="rp_trend_table"><thead><tr><th>Month</th><th>Form</th><th>Submissions</th><th>Incidents</th><th>Near Misses</th><th>High Severity</th><th>Rejected</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view trends.</td></tr></tbody></table></div>
          </div>
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Site / Form Rollups</h3><p class="section-subtitle">Quick rollup of submission volume, rejected rows, incidents, and last activity by site and form.</p></div></div>
            <div class="table-scroll"><table id="rp_site_rollup_table"><thead><tr><th>Site</th><th>Form</th><th>Submissions</th><th>Incidents</th><th>Rejected</th><th>Reviewed</th><th>Last Date</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view rollups.</td></tr></tbody></table></div>
          </div>
        </div>
        <div class="reports-grid" style="margin-top:16px;">
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Worker Rollups</h3><p class="section-subtitle">Submission, incident, and near-miss totals by worker or reporter label.</p></div></div>
            <div class="table-scroll"><table id="rp_worker_table"><thead><tr><th>Worker</th><th>Submissions</th><th>Incidents</th><th>Near Misses</th><th>High Severity</th><th>Last Date</th></tr></thead><tbody><tr><td colspan="6" class="muted">Load reports to view worker rollups.</td></tr></tbody></table></div>
          </div>
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Site / Job / Route Context</h3><p class="section-subtitle">Report rows grouped by site, job, work order, and route to reduce manual export slicing.</p></div></div>
            <div class="table-scroll"><table id="rp_context_table"><thead><tr><th>Site</th><th>Job</th><th>Work Order</th><th>Route</th><th>Submissions</th><th>Incidents</th><th>Last Date</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view context rollups.</td></tr></tbody></table></div>
          </div>
        </div>
        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading"><div><h3 style="margin:0;">Workflow History</h3><p class="section-subtitle">Historical events across payroll export delivery/close, scheduler runs, signed contracts, HSE packet events, evidence review, and submission lifecycle.</p></div></div>
          <div class="table-scroll"><table id="rp_workflow_table"><thead><tr><th>When</th><th>Type</th><th>Status</th><th>Record</th><th>Headline</th><th>Detail</th></tr></thead><tbody><tr><td colspan="6" class="muted">Load reports to view workflow history.</td></tr></tbody></table></div>
        </div>`;
    }

    function setSummary(message = '', isError = false) {
      if (!els.summary) return;
      if (!message) { els.summary.style.display = 'none'; els.summary.textContent = ''; els.summary.dataset.kind = ''; return; }
      els.summary.style.display = 'block';
      els.summary.textContent = message;
      els.summary.dataset.kind = isError ? 'error' : 'info';
    }
    function hasAccess() { return Number(getAccessProfile(getCurrentRole())?.rank || 0) >= 30; }
    function applyRoleVisibility() {
      const section = document.getElementById('reports');
      if (!section) return;
      if (!hasAccess()) {
        section.innerHTML = '<div class="section-heading"><div><h2>Historical Reports</h2><p class="section-subtitle">Supervisor access is required for the historical reporting screen.</p></div></div>';
        return;
      }
      ensureLayout(); refreshEls();
    }
    function filterDate(value, from, to) {
      const key = String(value || '').slice(0, 10);
      if (from && key && key < from) return false;
      if (to && key && key > to) return false;
      return true;
    }
    function currentFilters() {
      return {
        from: els.from?.value || '', to: els.to?.value || '', site: String(els.site?.value || '').trim().toLowerCase(),
        form: normalizeFormKey(els.form?.value || ''), status: String(els.status?.value || '').trim().toLowerCase(),
        type: String(els.type?.value || '').trim().toLowerCase(), worker: String(els.worker?.value || '').trim().toLowerCase(),
        context: String(els.context?.value || '').trim().toLowerCase(), severity: String(els.severity?.value || '').trim().toLowerCase()
      };
    }
    function applyTextFilter(haystackParts, needle) {
      if (!needle) return true;
      return haystackParts.map((v) => String(v || '').toLowerCase()).join(' ').includes(needle);
    }
    function getFilteredSubmissions() {
      const f = currentFilters();
      return (state.submissionHistory || []).filter((row) => {
        if (!filterDate(row.submission_date || row.created_at, f.from, f.to)) return false;
        if (f.form && normalizeFormKey(row.form_key || row.form_type) !== f.form) return false;
        if (f.status && String(row.status || '').toLowerCase() !== f.status) return false;
        if (f.severity && String(row.severity || '').toLowerCase() !== f.severity) return false;
        if (!applyTextFilter([row.site_code, row.site_name, row.site_label], f.site)) return false;
        if (!applyTextFilter([row.worker_name, row.submitted_by_name, row.supervisor_name, row.admin_name], f.worker)) return false;
        if (!applyTextFilter([row.job_code, row.work_order_number, row.route_code, row.equipment_code], f.context)) return false;
        return true;
      });
    }
    function getFilteredIncidents() {
      const f = currentFilters();
      return (state.incidentHistory || []).filter((row) => {
        if (!filterDate(row.submission_date || row.created_at, f.from, f.to)) return false;
        if (f.severity && String(row.severity || '').toLowerCase() !== f.severity) return false;
        if (!applyTextFilter([row.site_code, row.site_name, row.site_label], f.site)) return false;
        if (!applyTextFilter([row.worker_name, row.submitted_by_name, row.corrective_action_owner, row.witness_names], f.worker)) return false;
        if (!applyTextFilter([row.job_code, row.work_order_number, row.route_code, row.equipment_code, row.event_summary], f.context)) return false;
        return true;
      });
    }
    function getFilteredWorkflow() {
      const f = currentFilters();
      return (state.workflowHistory || []).filter((row) => {
        if (!filterDate(row.occurred_at, f.from, f.to)) return false;
        if (f.type && String(row.history_type || '').toLowerCase() !== f.type) return false;
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
    function renderStats(subs, incidents, workflow) {
      if (!els.stats) return;
      const reviewed = subs.filter((row) => Number(row.review_count || 0) > 0).length;
      const rejected = subs.filter((row) => String(row.status || '').toLowerCase() === 'rejected' || String(row.last_review_action || '').toLowerCase() === 'rejected').length;
      const nearMisses = incidents.filter((row) => String(row.incident_kind || '').toLowerCase() === 'near_miss').length;
      const highSeverity = incidents.filter((row) => ['high','critical'].includes(String(row.severity || '').toLowerCase())).length;
      const cards = [
        ['HSE submissions', subs.length, 'All DB-backed form rows that match the current filters.'],
        ['Incident / near miss rows', incidents.length, 'Incident, close-call, damage, and vehicle event history parsed into report-safe columns.'],
        ['Near misses', nearMisses, 'Close calls that should still drive hazard correction and trend review.'],
        ['High severity incidents', highSeverity, 'Rows marked high or critical for faster office follow-up.'],
        ['Reviewed / approved', reviewed, 'Rows with at least one review event recorded.'],
        ['Rejected / follow-up', rejected, 'Rows that still need correction or follow-up handling.'],
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
    function renderAll() {
      if (!hasAccess()) return;
      const subs = getFilteredSubmissions();
      const incidents = getFilteredIncidents();
      const workflow = getFilteredWorkflow();
      const siteRollups = getFilteredSiteRollups();
      const trends = getFilteredTrends();
      const workers = getFilteredWorkerRollups();
      const contexts = getFilteredContextRollups();
      renderStats(subs, incidents, workflow);
      renderSubmissionTable(subs);
      renderIncidentTable(incidents);
      renderTrendTable(trends);
      renderSiteRollupTable(siteRollups);
      renderWorkerTable(workers);
      renderContextTable(contexts);
      renderWorkflowTable(workflow);
      setSummary(`Loaded ${subs.length} HSE row(s), ${incidents.length} incident row(s), ${trends.length} trend row(s), ${siteRollups.length} site/form rollup row(s), and ${workflow.length} workflow history row(s) for the current filters.`);
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
      els.exportWorkflowBtn?.addEventListener('click', () => exportCsv('workflow'));
      els.savePresetBtn?.addEventListener('click', savePreset);
      els.deletePresetBtn?.addEventListener('click', deletePreset);
      els.preset?.addEventListener('change', () => applyPreset((state.presets || []).find((row) => String(row.id) === String(els.preset?.value || ''))));
      [els.from, els.to, els.site, els.form, els.status, els.type, els.worker, els.context, els.severity].forEach((el) => el?.addEventListener('change', renderAll));
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
