'use strict';

/* =========================================================
   js/logbook-ui.js
   Logbook / submission detail / review UI module

   Purpose:
   - move logbook UI behavior out of app.js
   - manage log rows, detail panel, review panel, and CSV export
   - keep existing DOM ids and endpoint payloads intact
========================================================= */

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

  function slugifyToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function statusChip(label) {
    const safe = escHtml(label || 'submitted');
    const slug = slugifyToken(label || 'submitted');
    return `<span class="status-chip status-chip--${slug}">${safe}</span>`;
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

  function fmtDateTime(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  function createLogbookUI(config = {}) {
    const fetchLogData = config.fetchLogData;
    const fetchSubmissionDetail = config.fetchSubmissionDetail;
    const saveSubmissionReview = config.saveSubmissionReview;
    const storagePreviewUrl = config.storagePreviewUrl || (() => '');
    const getCurrentRole = config.getCurrentRole || (() => 'worker');

    const els = {
      lgSite: $('#lg_site'),
      lgFrom: $('#lg_from'),
      lgTo: $('#lg_to'),
      lgForm: $('#lg_form'),
      lgStatus: $('#lg_status'),
      lgLoad: $('#lg_load'),
      lgExport: $('#lg_export'),
      lgBody: $('#lg_table')?.querySelector('tbody') || null,

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
      sdReviewsBody: $('#sd_reviews_table')?.querySelector('tbody') || null,
      sdImagesBody: $('#sd_images_table')?.querySelector('tbody') || null,
      sdSummary: $('#sd_summary'),
      sdClear: $('#sd_clear'),

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
      role: 'worker'
    };

    function canReview() {
      const role = String(getCurrentRole() || state.role || 'worker');
      return ['site_leader', 'supervisor', 'hse', 'admin', 'job_admin', 'onsite_admin'].includes(role);
    }

    function fmtSummary(row) {
      const t = row.form_type;
      const p = row.payload || {};
      if (t === 'E') return `Leader: ${p.submitted_by || ''}; Attendees: ${Array.isArray(p.attendees) ? p.attendees.length : 0}`;
      if (t === 'D') return `Checked by: ${p.checked_by || ''}; Non-compliance: ${p.nonCompliant ? 'YES' : 'No'}`;
      if (t === 'B') return `Checked by: ${p.checked_by || ''}; Flagged: ${p.flagged ? 'YES' : 'No'}`;
      if (t === 'C') return `Inspector: ${p.inspector || ''}; Open hazards: ${p.openHazards ? 'YES' : 'No'}`;
      if (t === 'A') return `Supervisor: ${p.supervisor || ''}; Issues: ${p.issues ? 'YES' : 'No'}`;
      return '';
    }

    function renderRows(rows) {
      if (!els.lgBody) return;
      els.lgBody.innerHTML = '';

      rows.forEach((r) => {
        const tr = document.createElement('tr');
        const d = (r.date || '').slice(0, 10);

        tr.innerHTML = `
          <td>${escHtml(r.id)}</td>
          <td>${escHtml(d)}</td>
          <td>${escHtml(r.form_type)}</td>
          <td>${escHtml(r.site || '')}</td>
          <td>${statusChip(r.status || 'submitted')}</td>
          <td>${escHtml(fmtSummary(r))}</td>
          <td>
            <div class="controls" style="margin-bottom:8px;">
              <button type="button" data-detail-id="${escHtml(r.id)}">View Detail</button>
              ${canReview() ? `<button type="button" data-review-id="${escHtml(r.id)}">Review</button>` : ''}
            </div>
            <details>
              <summary>Quick View</summary>
              <pre style="white-space:pre-wrap; word-break:break-word; max-width:60ch;">${escHtml(JSON.stringify(r.payload, null, 2))}</pre>
            </details>
          </td>
        `;
        els.lgBody.appendChild(tr);
      });
    }

    function toCSV(rows) {
      const header = ['id', 'date', 'form_type', 'site', 'status', 'summary'];
      const lines = [header.join(',')];
      const esc = (v) => `"${String(v).replaceAll('"', '""')}"`;

      rows.forEach((r) => {
        const row = [
          r.id,
          (r.date || '').slice(0, 10),
          r.form_type,
          r.site || '',
          r.status || '',
          fmtSummary(r)
        ];
        lines.push(row.map(esc).join(','));
      });

      return lines.join('\n');
    }

    function exportCSV() {
      if (!state.rows.length) {
        alert('Nothing to export. Load the log first.');
        return;
      }

      const blob = new Blob([toCSV(state.rows)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ywi-log.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function clearSubmissionDetail() {
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
      if (els.sdReviewsBody) els.sdReviewsBody.innerHTML = '';
      if (els.sdImagesBody) els.sdImagesBody.innerHTML = '';
      setNotice(els.sdSummary, '');
    }

    function renderSubmissionReviews(rows) {
      if (!els.sdReviewsBody) return;
      els.sdReviewsBody.innerHTML = '';

      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(row.id || '')}</td>
          <td>${escHtml(row.review_action || '')}</td>
          <td>${escHtml(row.reviewer_id || '')}</td>
          <td>${escHtml(fmtDateTime(row.created_at))}</td>
          <td>${escHtml(row.review_note || '')}</td>
        `;
        els.sdReviewsBody.appendChild(tr);
      });
    }

    function renderSubmissionImages(rows) {
      if (!els.sdImagesBody) return;
      els.sdImagesBody.innerHTML = '';

      rows.forEach((row) => {
        const preview = storagePreviewUrl(row.file_path);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            ${preview
              ? `<img src="${escHtml(preview)}" alt="submission image" style="width:160px;max-width:100%;height:auto;border-radius:8px;border:1px solid rgba(255,255,255,.12);" />`
              : ''}
          </td>
          <td>${escHtml(row.image_type || '')}</td>
          <td>
            <div>${escHtml(row.file_name || '')}</div>
            <div style="color:#9ca3af;font-size:.85rem;">${escHtml(row.file_path || '')}</div>
          </td>
          <td>${escHtml(row.caption || '')}</td>
          <td>${escHtml(fmtDateTime(row.created_at))}</td>
        `;
        els.sdImagesBody.appendChild(tr);
      });
    }

    async function loadSubmissionDetail(submissionId) {
      const data = await fetchSubmissionDetail(submissionId);
      if (!data?.ok) throw new Error(data?.error || 'Detail load failed');

      const s = data.submission || {};

      if (els.sdSubmissionId) els.sdSubmissionId.value = String(s.id || '');
      if (els.sdFormType) els.sdFormType.value = s.form_type || '';
      if (els.sdStatus) els.sdStatus.value = s.status || '';
      if (els.sdSite) els.sdSite.value = s.site || '';
      if (els.sdDate) els.sdDate.value = s.date || '';
      if (els.sdSubmittedBy) els.sdSubmittedBy.value = s.submitted_by || '';
      if (els.sdReviewedAt) els.sdReviewedAt.value = fmtDateTime(s.reviewed_at);
      if (els.sdReviewedBy) els.sdReviewedBy.value = s.reviewed_by || '';
      if (els.sdAdminNotes) els.sdAdminNotes.value = s.admin_notes || '';
      if (els.sdPayload) els.sdPayload.value = JSON.stringify(s.payload || {}, null, 2);

      renderSubmissionReviews(data.reviews || []);
      renderSubmissionImages(data.images || []);

      setNotice(
        els.sdSummary,
        `Loaded submission #${s.id} with ${data.reviews?.length || 0} review entries and ${data.images?.length || 0} images.`
      );
    }

    function clearReviewPanel() {
      if (els.rvSubmissionId) els.rvSubmissionId.value = '';
      if (els.rvStatus) els.rvStatus.value = '';
      if (els.rvAction) els.rvAction.value = 'commented';
      if (els.rvNote) els.rvNote.value = '';
      if (els.rvAdminNotes) els.rvAdminNotes.value = '';
      setNotice(els.rvSummary, '');
    }

    function setReviewPanelFromRow(row) {
      if (!row) return;
      if (els.rvSubmissionId) els.rvSubmissionId.value = String(row.id || '');
      if (els.rvStatus) els.rvStatus.value = row.status || '';
      if (els.rvAction) els.rvAction.value = 'commented';
      if (els.rvNote) els.rvNote.value = '';
      if (els.rvAdminNotes) els.rvAdminNotes.value = row.admin_notes || '';
      setNotice(
        els.rvSummary,
        `Selected submission #${row.id} | ${row.form_type} | ${row.site || ''} | ${row.status || 'submitted'}`
      );
    }

    async function saveReview() {
      const submissionId = Number(els.rvSubmissionId?.value || 0);
      const status = els.rvStatus?.value || '';
      const reviewAction = els.rvAction?.value || 'commented';
      const reviewNote = els.rvNote?.value?.trim?.() || '';
      const adminNotes = els.rvAdminNotes?.value ?? '';

      if (!submissionId) {
        alert('Select a submission from the logbook first.');
        return;
      }

      const resp = await saveSubmissionReview({
        submission_id: submissionId,
        status,
        review_action: reviewAction,
        review_note: reviewNote,
        admin_notes: adminNotes
      });

      if (!resp?.ok) throw new Error(resp?.error || 'Review save failed');

      setNotice(els.rvSummary, `Review saved for submission #${submissionId}.`);
      await load();
      await loadSubmissionDetail(submissionId);

      const row = state.rows.find((r) => Number(r.id) === submissionId);
      if (row) setReviewPanelFromRow(row);
    }

    async function load() {
      const body = {
        site: (els.lgSite && els.lgSite.value.trim()) || undefined,
        formType: (els.lgForm && els.lgForm.value) || undefined,
        from: (els.lgFrom && els.lgFrom.value) || undefined,
        to: (els.lgTo && els.lgTo.value) || undefined,
        status: (els.lgStatus && els.lgStatus.value) || undefined,
        limit: 100
      };

      const data = await fetchLogData(body);
      if (!data?.ok) throw new Error(data?.error || 'load_failed');

      state.rows = data.rows || [];
      state.role = data.role || getCurrentRole() || 'worker';
      renderRows(state.rows);
    }

    function bindEvents() {
      if (els.lgLoad && !els.lgLoad.dataset.bound) {
        els.lgLoad.dataset.bound = '1';
        els.lgLoad.addEventListener('click', async () => {
          try {
            await load();
          } catch (err) {
            console.error(err);
            alert('Failed to load log.');
          }
        });
      }

      els.lgExport?.addEventListener('click', exportCSV);

      els.sdClear?.addEventListener('click', clearSubmissionDetail);
      els.rvClear?.addEventListener('click', clearReviewPanel);

      els.rvSubmit?.addEventListener('click', async () => {
        try {
          await saveReview();
        } catch (err) {
          console.error(err);
          alert('Failed to save review.');
        }
      });

      els.lgBody?.addEventListener('click', async (e) => {
        const detailBtn = (e.target instanceof Element)
          ? e.target.closest('button[data-detail-id]')
          : null;

        if (detailBtn) {
          const id = Number(detailBtn.dataset.detailId || 0);
          if (!id) return;

          try {
            await loadSubmissionDetail(id);
            location.hash = '#log';
          } catch (err) {
            console.error(err);
            alert('Failed to load submission detail.');
          }
          return;
        }

        const reviewBtn = (e.target instanceof Element)
          ? e.target.closest('button[data-review-id]')
          : null;

        if (reviewBtn) {
          const id = Number(reviewBtn.dataset.reviewId || 0);
          const row = state.rows.find((r) => Number(r.id) === id);
          if (!row) return;
          setReviewPanelFromRow(row);
          location.hash = '#log';
        }
      });
    }

    function applyRoleVisibility() {
      if (els.reviewPanel) {
        els.reviewPanel.style.display = canReview() ? '' : 'none';
      }
      renderRows(state.rows);
    }

    async function init() {
      bindEvents();
      clearSubmissionDetail();
      clearReviewPanel();
      applyRoleVisibility();
    }

    return {
      init,
      load,
      loadSubmissionDetail,
      clearSubmissionDetail,
      clearReviewPanel,
      setReviewPanelFromRow,
      applyRoleVisibility,
      state
    };
  }

  window.YWILogbookUI = {
    create: createLogbookUI
  };
})();
