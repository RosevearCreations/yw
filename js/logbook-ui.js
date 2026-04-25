/* File: js/logbook-ui.js
   Brief description: Logbook, submission detail, image history, CSV export, and review panel controller.
   Handles filtered row loading, detail rendering, review submission, and role-based review visibility.
*/

'use strict';

(function () {
  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
  }

  function csvCell(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  }


  function normalizeFormLabel(value) {
    const clean = String(value || '').trim().toLowerCase();
    if (['toolbox','e'].includes(clean)) return 'Toolbox Talk';
    if (['ppe','d'].includes(clean)) return 'PPE Check';
    if (['firstaid','first_aid','b'].includes(clean)) return 'First Aid Kit';
    if (['inspection','site_inspection','inspect','c'].includes(clean)) return 'Site Inspection';
    if (['drill','emergency_drill','a'].includes(clean)) return 'Emergency Drill';
    if (['incident','incident_near_miss','near_miss','f'].includes(clean)) return 'Incident / Near Miss';
    return String(value || '');
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

  function createLogbookUI(config = {}) {
    const fetchLogData = config.fetchLogData;
    const fetchSubmissionDetail = config.fetchSubmissionDetail;
    const saveSubmissionReview = config.saveSubmissionReview;
    const storagePreviewUrl = config.storagePreviewUrl || (() => '');
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const getAccessProfile = config.getAccessProfile || (() => ({ canReviewSubmissions: false }));

    const els = {
      site: $('#lg_site'),
      from: $('#lg_from'),
      to: $('#lg_to'),
      form: $('#lg_form'),
      status: $('#lg_status'),
      loadBtn: $('#lg_load'),
      exportBtn: $('#lg_export'),
      tableBody: $('#lg_table tbody'),

      sdSubmissionId: $('#sd_submission_id'),
      sdFormType: $('#sd_form_type'),
      sdStatus: $('#sd_status'),
      sdSite: $('#sd_site'),
      sdDate: $('#sd_date'),
      sdSubmittedBy: $('#sd_submitted_by'),
      sdReviewedAt: $('#sd_reviewed_at'),
      sdReviewedBy: $('#sd_reviewed_by'),
      sdAdminNotes: $('#sd_admin_notes'),
      sdPayload: $('#sd_payload'),
      sdReviewsTable: $('#sd_reviews_table tbody'),
      sdImagesTable: $('#sd_images_table tbody'),
      sdClearBtn: $('#sd_clear'),
      sdSummary: $('#sd_summary'),

      reviewPanel: $('#reviewPanel'),
      rvSubmissionId: $('#rv_submission_id'),
      rvStatus: $('#rv_status'),
      rvAction: $('#rv_action'),
      rvNote: $('#rv_note'),
      rvAdminNotes: $('#rv_admin_notes'),
      rvSubmit: $('#rv_submit'),
      rvClear: $('#rv_clear'),
      rvSummary: $('#rv_summary')
    };

    const state = {
      rows: [],
      selectedSubmissionId: '',
      selectedSummary: null,
      selectedDetail: null
    };


    function refreshEls() {
      Object.assign(els, {
        site: $('#lg_site'),
        from: $('#lg_from'),
        to: $('#lg_to'),
        form: $('#lg_form'),
        status: $('#lg_status'),
        loadBtn: $('#lg_load'),
        exportBtn: $('#lg_export'),
        tableBody: $('#lg_table tbody'),
        sdSubmissionId: $('#sd_submission_id'),
        sdFormType: $('#sd_form_type'),
        sdStatus: $('#sd_status'),
        sdSite: $('#sd_site'),
        sdDate: $('#sd_date'),
        sdSubmittedBy: $('#sd_submitted_by'),
        sdReviewedAt: $('#sd_reviewed_at'),
        sdReviewedBy: $('#sd_reviewed_by'),
        sdAdminNotes: $('#sd_admin_notes'),
        sdPayload: $('#sd_payload'),
        sdReviewsTable: $('#sd_reviews_table tbody'),
        sdImagesTable: $('#sd_images_table tbody'),
        sdClearBtn: $('#sd_clear'),
        sdSummary: $('#sd_summary'),
        reviewPanel: $('#reviewPanel'),
        rvSubmissionId: $('#rv_submission_id'),
        rvStatus: $('#rv_status'),
        rvAction: $('#rv_action'),
        rvNote: $('#rv_note'),
        rvAdminNotes: $('#rv_admin_notes'),
        rvSubmit: $('#rv_submit'),
        rvClear: $('#rv_clear'),
        rvSummary: $('#rv_summary')
      });
    }


    function ensureLayout() {
      const section = document.getElementById('log');
      if (!section || section.dataset.layoutReady === '1') return;
      section.dataset.layoutReady = '1';
      section.innerHTML = `
        <div class="section-heading">
          <div>
            <h2>Logbook</h2>
            <p class="section-subtitle">Review submitted forms, images, and approval history across the safety system.</p>
          </div>
          <div class="admin-heading-actions">
            <button id="lg_load" class="secondary" type="button">Load Entries</button>
            <button id="lg_export" class="secondary" type="button">Export CSV</button>
          </div>
        </div>
        <div class="grid">
          <label>Site<input id="lg_site" type="text" list="site-options" placeholder="Site name or code" /></label>
          <label>From<input id="lg_from" type="date" /></label>
          <label>To<input id="lg_to" type="date" /></label>
          <label>Form
            <select id="lg_form">
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
            <select id="lg_status">
              <option value="">Any status</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="lg_table">
            <thead><tr><th>ID</th><th>Date</th><th>Form</th><th>Site</th><th>Status</th><th>Summary</th><th>Actions</th></tr></thead>
            <tbody><tr><td colspan="7" class="muted">Use Load Entries to view the logbook.</td></tr></tbody>
          </table>
        </div>
        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading"><div><h3 style="margin:0;">Submission Detail</h3><p class="section-subtitle">Selected logbook item details and uploaded evidence.</p></div><div class="admin-heading-actions"><button id="sd_clear" class="secondary" type="button">Clear</button></div></div>
          <div id="sd_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
          <div class="grid">
            <label>Submission ID<input id="sd_submission_id" type="text" readonly /></label>
            <label>Form Type<input id="sd_form_type" type="text" readonly /></label>
            <label>Status<input id="sd_status" type="text" readonly /></label>
            <label>Site<input id="sd_site" type="text" readonly /></label>
            <label>Date<input id="sd_date" type="text" readonly /></label>
            <label>Submitted By<input id="sd_submitted_by" type="text" readonly /></label>
            <label>Reviewed At<input id="sd_reviewed_at" type="text" readonly /></label>
            <label>Reviewed By<input id="sd_reviewed_by" type="text" readonly /></label>
          </div>
          <label style="display:block;margin-top:12px;">Admin Notes<textarea id="sd_admin_notes" rows="3" readonly></textarea></label>
          <label style="display:block;margin-top:12px;">Payload<textarea id="sd_payload" rows="10" readonly></textarea></label>
          <div class="table-scroll" style="margin-top:12px;"><table id="sd_reviews_table"><thead><tr><th>ID</th><th>Action</th><th>Status</th><th>Reviewer</th><th>Date</th><th>Note</th></tr></thead><tbody></tbody></table></div>
          <div class="table-scroll" style="margin-top:12px;"><table id="sd_images_table"><thead><tr><th>Preview</th><th>Type</th><th>File</th><th>Caption</th><th>Created</th></tr></thead><tbody></tbody></table></div>
        </div>
        <div id="reviewPanel" class="admin-panel-block" style="margin-top:16px;display:none;">
          <div class="section-heading"><div><h3 style="margin:0;">Review Submission</h3><p class="section-subtitle">Supervisor/Admin review controls.</p></div><div class="admin-heading-actions"><button id="rv_clear" class="secondary" type="button">Clear</button><button id="rv_submit" class="primary" type="button">Save Review</button></div></div>
          <div id="rv_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
          <div class="grid">
            <label>Submission ID<input id="rv_submission_id" type="text" readonly /></label>
            <label>Status<input id="rv_status" type="text" /></label>
            <label>Action<select id="rv_action"><option value="commented">Commented</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
          </div>
          <label style="display:block;margin-top:12px;">Note<textarea id="rv_note" rows="3"></textarea></label>
          <label style="display:block;margin-top:12px;">Admin Notes<textarea id="rv_admin_notes" rows="3"></textarea></label>
        </div>
      `;
    }


    function setNotice(el, text) {
      if (!el) return;
      if (text) {
        el.style.display = 'block';
        el.textContent = text;
      } else {
        el.style.display = 'none';
        el.textContent = '';
      }
    }

    function canReview() {
      return !!getAccessProfile(getCurrentRole()).canReviewSubmissions;
    }

    function applyRoleVisibility() {
      if (!els.reviewPanel) return;
      els.reviewPanel.style.display = canReview() ? '' : 'none';
    }

    function buildFilters() {
      return {
        site: els.site?.value?.trim?.() || '',
        from: els.from?.value || '',
        to: els.to?.value || '',
        formType: els.form?.value || '',
        status: els.status?.value || '',
        limit: 100
      };
    }

    function getSummaryText(row) {
      if (row?.summary) return row.summary;
      if (row?.submitted_by) return `Submitted by ${row.submitted_by}`;
      if (row?.payload?.submitted_by) return `Submitted by ${row.payload.submitted_by}`;
      if (row?.payload?.inspector) return `Inspector: ${row.payload.inspector}`;
      if (row?.payload?.supervisor) return `Supervisor: ${row.payload.supervisor}`;
      if (row?.payload?.checked_by) return `Checked by ${row.payload.checked_by}`;
      return '';
    }

    function clearTableBody(tbody) {
      if (tbody) tbody.innerHTML = '';
    }

    function renderLogRows() {
      if (!els.tableBody) return;

      els.tableBody.innerHTML = '';

      state.rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.dataset.submissionId = String(row.id || '');
        tr.innerHTML = `
          <td>${escHtml(row.id || '')}</td>
          <td>${escHtml(formatDate(row.submission_date || row.date || row.created_at || ''))}</td>
          <td>${escHtml(row.form_label || normalizeFormLabel(row.form_type || ''))}</td>
          <td>${escHtml(row.site || row.site_name || '')}</td>
          <td>${escHtml(row.status || '')}</td>
          <td>${escHtml(getSummaryText(row))}</td>
          <td>
            <div class="controls">
              <button type="button" data-action="view" data-id="${escHtml(row.id || '')}">View Detail</button>
              ${canReview() ? `<button type="button" data-action="review" data-id="${escHtml(row.id || '')}">Review</button>` : ''}
            </div>
          </td>
        `;
        els.tableBody.appendChild(tr);
      });
    }

    async function loadRows() {
      setNotice(els.sdSummary, '');
      setNotice(els.rvSummary, '');

      try {
        const payload = buildFilters();
        const resp = await fetchLogData(payload);
        state.rows = Array.isArray(resp?.rows)
          ? resp.rows
          : Array.isArray(resp)
            ? resp
            : [];

        renderLogRows();
      } catch (err) {
        console.error(err);
        state.rows = [];
        renderLogRows();
        setNotice(els.sdSummary, 'Failed to load logbook rows.');
      }
    }

    function exportCsv() {
      const headers = ['ID', 'Date', 'Form', 'Site', 'Status', 'Summary'];
      const lines = [headers.map(csvCell).join(',')];

      state.rows.forEach((row) => {
        lines.push([
          row.id || '',
          formatDate(row.submission_date || row.date || row.created_at || ''),
          row.form_type || '',
          row.site || row.site_name || '',
          row.status || '',
          getSummaryText(row)
        ].map(csvCell).join(','));
      });

      downloadTextFile(
        `ywi-logbook-${new Date().toISOString().slice(0, 10)}.csv`,
        lines.join('\n'),
        'text/csv;charset=utf-8'
      );
    }

    function clearSubmissionDetail() {
      state.selectedSubmissionId = '';
      state.selectedDetail = null;

      if (els.sdSubmissionId) els.sdSubmissionId.value = '';
      if (els.sdFormType) els.sdFormType.value = '';
      if (els.sdStatus) els.sdStatus.value = '';
      if (els.sdSite) els.sdSite.value = '';
      if (els.sdDate) els.sdDate.value = '';
      if (els.sdSubmittedBy) els.sdSubmittedBy.value = '';
      if (els.sdReviewedAt) els.sdReviewedAt.value = '';
      if (els.sdReviewedBy) els.sdReviewedBy.value = '';
      if (els.sdAdminNotes) els.sdAdminNotes.value = '';
      if (els.sdPayload) els.sdPayload.value = '';

      clearTableBody(els.sdReviewsTable);
      clearTableBody(els.sdImagesTable);

      setNotice(els.sdSummary, '');
    }

    function clearReviewPanel() {
      if (els.rvSubmissionId) els.rvSubmissionId.value = '';
      if (els.rvStatus) els.rvStatus.value = '';
      if (els.rvAction) els.rvAction.value = 'commented';
      if (els.rvNote) els.rvNote.value = '';
      if (els.rvAdminNotes) els.rvAdminNotes.value = '';

      setNotice(els.rvSummary, '');
    }

    function renderReviewHistory(reviews) {
      if (!els.sdReviewsTable) return;
      els.sdReviewsTable.innerHTML = '';

      (reviews || []).forEach((item) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(item.id || '')}</td>
          <td>${escHtml(item.action || '')}</td>
          <td>${escHtml(item.reviewer_id || item.reviewed_by || '')}</td>
          <td>${escHtml(formatDateTime(item.created_at || item.reviewed_at || ''))}</td>
          <td>${escHtml(item.note || '')}</td>
        `;
        els.sdReviewsTable.appendChild(tr);
      });
    }

    function renderImages(images) {
      if (!els.sdImagesTable) return;
      els.sdImagesTable.innerHTML = '';

      (images || []).forEach((item) => {
        const preview = storagePreviewUrl(item.file_path || item.storage_path || '');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            ${preview
              ? `<img src="${escHtml(preview)}" alt="${escHtml(item.caption || item.file_name || 'Image')}" style="max-width:160px;max-height:110px;border-radius:8px;">`
              : ''}
          </td>
          <td>${escHtml(item.image_type || '')}</td>
          <td>${escHtml(item.file_name || item.file_path || '')}</td>
          <td>${escHtml(item.caption || '')}</td>
          <td>${escHtml(formatDateTime(item.created_at || ''))}</td>
        `;
        els.sdImagesTable.appendChild(tr);
      });
    }

    function renderSubmissionDetail(detail) {
      state.selectedDetail = detail || null;
      const submission = detail?.submission || detail || {};

      if (els.sdSubmissionId) els.sdSubmissionId.value = submission.id || '';
      if (els.sdFormType) els.sdFormType.value = normalizeFormLabel(submission.form_type || '');
      if (els.sdStatus) els.sdStatus.value = submission.status || '';
      if (els.sdSite) els.sdSite.value = submission.site || submission.site_name || '';
      if (els.sdDate) els.sdDate.value = formatDateTime(submission.submission_date || submission.date || submission.created_at || '');
      if (els.sdSubmittedBy) {
        els.sdSubmittedBy.value =
          submission.submitted_by ||
          submission.inspector ||
          submission.supervisor ||
          submission.checked_by ||
          '';
      }
      if (els.sdReviewedAt) els.sdReviewedAt.value = formatDateTime(submission.reviewed_at || '');
      if (els.sdReviewedBy) els.sdReviewedBy.value = submission.reviewed_by || '';
      if (els.sdAdminNotes) els.sdAdminNotes.value = submission.admin_notes || '';

      const payloadObj = submission.payload || detail?.payload || {};
      if (els.sdPayload) {
        try {
          els.sdPayload.value = JSON.stringify(payloadObj, null, 2);
        } catch {
          els.sdPayload.value = String(payloadObj ?? '');
        }
      }

      renderReviewHistory(detail?.reviews || []);
      renderImages(detail?.images || []);
      setNotice(els.sdSummary, '');
    }

    async function loadSubmissionDetail(submissionId) {
      if (!submissionId) return;

      setNotice(els.sdSummary, 'Loading submission detail...');
      clearTableBody(els.sdReviewsTable);
      clearTableBody(els.sdImagesTable);

      try {
        const detail = await fetchSubmissionDetail(submissionId);
        state.selectedSubmissionId = String(submissionId);
        renderSubmissionDetail(detail);
      } catch (err) {
        console.error(err);
        clearSubmissionDetail();
        setNotice(els.sdSummary, 'Failed to load submission detail.');
      }
    }

    function populateReviewPanelFromRow(rowOrId) {
      const row = typeof rowOrId === 'object'
        ? rowOrId
        : state.rows.find((item) => String(item.id) === String(rowOrId));

      if (!row) return;

      state.selectedSummary = row;

      if (els.rvSubmissionId) els.rvSubmissionId.value = row.id || '';
      if (els.rvStatus) els.rvStatus.value = row.status || '';
      if (els.rvAction) els.rvAction.value = 'commented';
      if (els.rvNote) els.rvNote.value = '';
      if (els.rvAdminNotes) els.rvAdminNotes.value = row.admin_notes || '';

      setNotice(els.rvSummary, '');
    }

    async function submitReview() {
      if (!canReview()) {
        setNotice(els.rvSummary, 'Your role cannot review submissions.');
        return;
      }

      const submissionId = els.rvSubmissionId?.value?.trim?.() || '';
      if (!submissionId) {
        setNotice(els.rvSummary, 'Select a submission first.');
        return;
      }

      const payload = {
        submission_id: submissionId,
        status: els.rvStatus?.value || '',
        action: els.rvAction?.value || 'commented',
        note: els.rvNote?.value?.trim?.() || '',
        admin_notes: els.rvAdminNotes?.value?.trim?.() || ''
      };

      try {
        setNotice(els.rvSummary, 'Saving review...');
        await saveSubmissionReview(payload);
        setNotice(els.rvSummary, 'Review saved.');

        await loadRows();
        await loadSubmissionDetail(submissionId);
        populateReviewPanelFromRow(submissionId);
      } catch (err) {
        console.error(err);
        setNotice(els.rvSummary, 'Failed to save review.');
      }
    }

    function handleTableClick(e) {
      const btn = (e.target instanceof Element)
        ? e.target.closest('button[data-action][data-id]')
        : null;
      if (!btn) return;

      const submissionId = btn.dataset.id || '';
      const action = btn.dataset.action || '';

      if (action === 'view') {
        loadSubmissionDetail(submissionId);
      } else if (action === 'review') {
        populateReviewPanelFromRow(submissionId);
        if (canReview() && els.reviewPanel) {
          els.reviewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }

    function bindEvents() {
      els.loadBtn?.addEventListener('click', loadRows);
      els.exportBtn?.addEventListener('click', exportCsv);
      els.tableBody?.addEventListener('click', handleTableClick);

      els.sdClearBtn?.addEventListener('click', clearSubmissionDetail);
      els.rvClear?.addEventListener('click', clearReviewPanel);
      els.rvSubmit?.addEventListener('click', submitReview);
    }

    async function init() {
      ensureLayout();
      refreshEls();
      applyRoleVisibility();
      bindEvents();
      await loadRows();
    }

    return {
      state,
      init,
      applyRoleVisibility,
      loadRows,
      loadSubmissionDetail,
      clearSubmissionDetail,
      clearReviewPanel
    };
  }

  window.YWILogbookUI = {
    create: createLogbookUI
  };
})();
