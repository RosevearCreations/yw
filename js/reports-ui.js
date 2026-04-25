
/* File: js/reports-ui.js
   Brief description: Historical reporting screen for HSE, scheduler, payroll, contracts, and workflow history.
   Loads supervisor/admin reporting datasets, supports date/site/form filters, and exports CSV snapshots.
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
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }
  function thirtyDaysAgoISO() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }

  function create(config = {}) {
    const loadAdminDirectory = config.loadAdminDirectory;
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const getAccessProfile = config.getAccessProfile || (() => ({ rank: 0 }));
    const state = {
      submissionHistory: [],
      workflowHistory: [],
      dailyRollups: [],
      siteRollups: []
    };
    const els = {};

    function refreshEls() {
      Object.assign(els, {
        from: $('#rp_from'),
        to: $('#rp_to'),
        site: $('#rp_site'),
        form: $('#rp_form'),
        status: $('#rp_status'),
        type: $('#rp_type'),
        summary: $('#rp_summary'),
        stats: $('#rp_stats'),
        submissionBody: $('#rp_submission_table tbody'),
        workflowBody: $('#rp_workflow_table tbody'),
        siteRollupBody: $('#rp_site_rollup_table tbody'),
        loadBtn: $('#rp_load'),
        exportSubmissionsBtn: $('#rp_export_submissions'),
        exportWorkflowBtn: $('#rp_export_workflow')
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
            <p class="section-subtitle">Supervisor and Admin reporting for OSHA-facing form history, evidence review, payroll close, scheduler activity, and signed-contract workflow events.</p>
          </div>
          <div class="admin-heading-actions">
            <button id="rp_load" class="secondary" type="button">Reload Reports</button>
            <button id="rp_export_submissions" class="secondary" type="button">Export HSE CSV</button>
            <button id="rp_export_workflow" class="secondary" type="button">Export Workflow CSV</button>
          </div>
        </div>
        <div class="grid">
          <label>From<input id="rp_from" type="date" /></label>
          <label>To<input id="rp_to" type="date" /></label>
          <label>Site<input id="rp_site" type="text" list="site-options" placeholder="Site name or code" /></label>
          <label>Form
            <select id="rp_form">
              <option value="">All forms</option>
              <option value="toolbox">Toolbox</option>
              <option value="ppe">PPE</option>
              <option value="firstaid">First Aid</option>
              <option value="inspection">Inspection</option>
              <option value="drill">Drill</option>
            </select>
          </label>
          <label>Status
            <select id="rp_status">
              <option value="">Any status</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
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
        <div id="rp_summary" class="notice" style="display:none;margin-top:12px;"></div>
        <div id="rp_stats" class="admin-stats-grid" style="margin-top:16px;"></div>
        <div class="reports-grid" style="margin-top:16px;">
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">HSE Form History</h3><p class="section-subtitle">All historical Toolbox, PPE, First Aid, Inspection, and Drill records with review and image counts.</p></div></div>
            <div class="table-scroll"><table id="rp_submission_table"><thead><tr><th>Date</th><th>Form</th><th>Site</th><th>Status</th><th>Submitted By</th><th>Reviews</th><th>Images</th><th>Last Review</th></tr></thead><tbody><tr><td colspan="8" class="muted">Load reports to view history.</td></tr></tbody></table></div>
          </div>
          <div class="admin-panel-block">
            <div class="section-heading"><div><h3 style="margin:0;">Site / Form Rollups</h3><p class="section-subtitle">Quick rollup of submission volume, rejected rows, and last activity by site and form.</p></div></div>
            <div class="table-scroll"><table id="rp_site_rollup_table"><thead><tr><th>Site</th><th>Form</th><th>Submissions</th><th>Rejected</th><th>Reviewed</th><th>Images</th><th>Last Date</th></tr></thead><tbody><tr><td colspan="7" class="muted">Load reports to view rollups.</td></tr></tbody></table></div>
          </div>
        </div>
        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading"><div><h3 style="margin:0;">Workflow History</h3><p class="section-subtitle">Historical events across payroll export delivery/close, scheduler runs, signed contracts, HSE packet events, evidence review, and submission lifecycle.</p></div></div>
          <div class="table-scroll"><table id="rp_workflow_table"><thead><tr><th>When</th><th>Type</th><th>Status</th><th>Record</th><th>Headline</th><th>Detail</th></tr></thead><tbody><tr><td colspan="6" class="muted">Load reports to view workflow history.</td></tr></tbody></table></div>
        </div>`;
    }

    function setSummary(message = '', isError = false) {
      if (!els.summary) return;
      if (!message) {
        els.summary.style.display = 'none';
        els.summary.textContent = '';
        els.summary.dataset.kind = '';
        return;
      }
      els.summary.style.display = 'block';
      els.summary.textContent = message;
      els.summary.dataset.kind = isError ? 'error' : 'info';
    }

    function hasAccess() {
      return Number(getAccessProfile(getCurrentRole())?.rank || 0) >= 30;
    }

    function applyRoleVisibility() {
      const section = document.getElementById('reports');
      if (!section) return;
      if (!hasAccess()) {
        section.innerHTML = '<div class="section-heading"><div><h2>Historical Reports</h2><p class="section-subtitle">Supervisor access is required for the historical reporting screen.</p></div></div>';
        return;
      }
      ensureLayout();
      refreshEls();
    }

    function filterDate(value, from, to) {
      const key = String(value || '').slice(0, 10);
      if (from && key && key < from) return false;
      if (to && key && key > to) return false;
      return true;
    }

    function getFilteredSubmissions() {
      const from = els.from?.value || '';
      const to = els.to?.value || '';
      const site = String(els.site?.value || '').trim().toLowerCase();
      const form = String(els.form?.value || '').trim().toLowerCase();
      const status = String(els.status?.value || '').trim().toLowerCase();
      return (state.submissionHistory || []).filter((row) => {
        if (!filterDate(row.submission_date || row.created_at, from, to)) return false;
        if (form && String(row.form_type || '').toLowerCase() !== form) return false;
        if (status && String(row.status || '').toLowerCase() !== status) return false;
        if (site) {
          const hay = [row.site_code, row.site_name, row.site_label].map((v) => String(v || '').toLowerCase()).join(' ');
          if (!hay.includes(site)) return false;
        }
        return true;
      });
    }

    function getFilteredWorkflow() {
      const from = els.from?.value || '';
      const to = els.to?.value || '';
      const type = String(els.type?.value || '').trim().toLowerCase();
      const site = String(els.site?.value || '').trim().toLowerCase();
      return (state.workflowHistory || []).filter((row) => {
        if (!filterDate(row.occurred_at, from, to)) return false;
        if (type && String(row.history_type || '').toLowerCase() != type) return false;
        if (site) {
          const hay = [row.site_code, row.site_name, row.detail, row.headline].map((v) => String(v || '').toLowerCase()).join(' ');
          if (!hay.includes(site)) return false;
        }
        return true;
      });
    }

    function getFilteredSiteRollups() {
      const from = els.from?.value || '';
      const to = els.to?.value || '';
      const site = String(els.site?.value || '').trim().toLowerCase();
      const form = String(els.form?.value || '').trim().toLowerCase();
      return (state.siteRollups || []).filter((row) => {
        if (!filterDate(row.last_submission_date, from, to)) return false;
        if (form && String(row.form_type || '').toLowerCase() !== form) return false;
        if (site) {
          const hay = [row.site_code, row.site_name, row.site_label].map((v) => String(v || '').toLowerCase()).join(' ');
          if (!hay.includes(site)) return false;
        }
        return true;
      });
    }

    function renderStats(filteredSubs, filteredWorkflow) {
      if (!els.stats) return;
      const reviewed = filteredSubs.filter((row) => Number(row.review_count || 0) > 0).length;
      const rejected = filteredSubs.filter((row) => String(row.status || '').toLowerCase() === 'rejected' || String(row.last_review_action || '').toLowerCase() === 'rejected').length;
      const payroll = filteredWorkflow.filter((row) => String(row.history_type || '') === 'payroll_export').length;
      const scheduler = filteredWorkflow.filter((row) => String(row.history_type || '') === 'scheduler_run').length;
      const contracts = filteredWorkflow.filter((row) => String(row.history_type || '') === 'signed_contract').length;
      const evidence = filteredWorkflow.filter((row) => String(row.history_type || '') === 'evidence_review').length;
      const cards = [
        ['HSE submissions', filteredSubs.length, 'Date-filtered OSHA-facing form history across the five field forms.'],
        ['Reviewed / approved', reviewed, 'Rows with at least one review event recorded.'],
        ['Rejected / follow-up', rejected, 'Rows that still need correction or follow-up handling.'],
        ['Workflow events', filteredWorkflow.length, 'Combined payroll, scheduler, contract, evidence, packet, and submission history.'],
        ['Payroll export rows', payroll, 'Historical payroll export, delivered, confirmed, and closed records.'],
        ['Scheduler runs', scheduler, 'Automated and manual scheduler activity rows.'],
        ['Signed contracts', contracts, 'Contract history visible for kickoff and conversion tracking.'],
        ['Evidence reviews', evidence, 'Approve/reject/follow-up history for attendance and HSE evidence.']
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
      if (!rows.length) {
        els.submissionBody.innerHTML = '<tr><td colspan="8" class="muted">No HSE submission history matches the current filters.</td></tr>';
        return;
      }
      els.submissionBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(formatDate(row.submission_date || row.created_at))}</td>
          <td>${escHtml(row.form_type || '')}</td>
          <td>${escHtml(row.site_label || row.site_name || row.site_code || '')}</td>
          <td>${escHtml(row.status || '')}</td>
          <td>${escHtml(row.submitted_by_name || '')}</td>
          <td>${escHtml(row.review_count || 0)}</td>
          <td>${escHtml(row.image_count || 0)}</td>
          <td>${escHtml(row.last_review_action || '')}${row.last_reviewed_at ? ` · ${escHtml(formatDateTime(row.last_reviewed_at))}` : ''}</td>
        </tr>`).join('');
    }

    function renderSiteRollupTable(rows) {
      if (!els.siteRollupBody) return;
      if (!rows.length) {
        els.siteRollupBody.innerHTML = '<tr><td colspan="7" class="muted">No site/form rollups match the current filters.</td></tr>';
        return;
      }
      els.siteRollupBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${escHtml(row.site_label || row.site_name || row.site_code || '')}</td>
          <td>${escHtml(row.form_type || '')}</td>
          <td>${escHtml(row.submission_count || 0)}</td>
          <td>${escHtml(row.rejected_count || 0)}</td>
          <td>${escHtml(row.reviewed_count || 0)}</td>
          <td>${escHtml(row.image_count || 0)}</td>
          <td>${escHtml(formatDate(row.last_submission_date || ''))}</td>
        </tr>`).join('');
    }

    function renderWorkflowTable(rows) {
      if (!els.workflowBody) return;
      if (!rows.length) {
        els.workflowBody.innerHTML = '<tr><td colspan="6" class="muted">No workflow history matches the current filters.</td></tr>';
        return;
      }
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

    function renderAll() {
      if (!hasAccess()) return;
      const filteredSubs = getFilteredSubmissions();
      const filteredWorkflow = getFilteredWorkflow();
      const filteredSiteRollups = getFilteredSiteRollups();
      renderStats(filteredSubs, filteredWorkflow);
      renderSubmissionTable(filteredSubs);
      renderSiteRollupTable(filteredSiteRollups);
      renderWorkflowTable(filteredWorkflow);
      setSummary(`Loaded ${filteredSubs.length} HSE row(s), ${filteredSiteRollups.length} site/form rollup row(s), and ${filteredWorkflow.length} workflow history row(s) for the current filters.`);
    }

    function exportCsv(kind) {
      const rows = kind === 'workflow' ? getFilteredWorkflow() : getFilteredSubmissions();
      const headers = kind === 'workflow'
        ? ['Occurred At', 'History Type', 'Status', 'Record', 'Headline', 'Detail']
        : ['Submission Date', 'Form', 'Site', 'Status', 'Submitted By', 'Review Count', 'Image Count', 'Last Review Action', 'Last Reviewed At'];
      const lines = [headers.map(csvCell).join(',')];
      rows.forEach((row) => {
        const values = kind === 'workflow'
          ? [row.occurred_at, row.history_type, row.record_status, row.record_number, row.headline, row.detail]
          : [row.submission_date, row.form_type, row.site_label || row.site_name || row.site_code || '', row.status, row.submitted_by_name || '', row.review_count || 0, row.image_count || 0, row.last_review_action || '', row.last_reviewed_at || ''];
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
        renderAll();
      } catch (err) {
        console.error(err);
        setSummary(err?.message || 'Unable to load historical reports.', true);
      }
    }

    function bindEvents() {
      els.loadBtn?.addEventListener('click', loadReports);
      els.exportSubmissionsBtn?.addEventListener('click', () => exportCsv('hse-submissions'));
      els.exportWorkflowBtn?.addEventListener('click', () => exportCsv('workflow'));
      [els.from, els.to, els.site, els.form, els.status, els.type].forEach((el) => el?.addEventListener('change', renderAll));
      document.addEventListener('ywi:route-shown', (event) => {
        if (event?.detail?.allowed === 'reports' && hasAccess()) renderAll();
      });
    }

    async function init() {
      ensureLayout();
      refreshEls();
      applyRoleVisibility();
      if (!hasAccess()) return;
      if (els.from && !els.from.value) els.from.value = thirtyDaysAgoISO();
      if (els.to && !els.to.value) els.to.value = todayISO();
      bindEvents();
      await loadReports();
    }

    return { init, applyRoleVisibility, loadReports };
  }

  window.YWIReportsUI = { create };
})();
