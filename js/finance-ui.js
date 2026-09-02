/* File: js/finance-ui.js
   Schema 172 Finance module home.
   Finance owns human disposition of completed-job accounting intake and explicit draft-candidate generation.
   Candidate amounts remain server-owned/canonical; this browser never supplies posting, payment or provider truth.
*/

'use strict';

(function () {
  const state = {
    loading: false,
    loadedAt: 0,
    payload: null,
    reviewPayload: null,
    error: '',
    reviewError: '',
    mutating: false
  };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.YWIAPI?.escHtml?.(value) || String(value ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));

  function authState() { return window.YWI_AUTH?.getState?.() || {}; }
  function canView() { return window.YWISecurity?.canViewModule?.('finance', authState().role || 'employee', 'view') !== false; }
  function canApprove() { return window.YWISecurity?.canViewModule?.('finance', authState().role || 'employee', 'approve') === true; }
  function accessLevel() { return window.YWISecurity?.getModuleAccess?.('finance', authState().role || 'employee') || 'hidden'; }

  function rows(name) { return Array.isArray(state.payload?.[name]) ? state.payload[name] : []; }
  function reviewRows() { return Array.isArray(state.reviewPayload?.queue) ? state.reviewPayload.queue : []; }
  function money(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? new Intl.NumberFormat('en-CA', { style:'currency', currency:'CAD' }).format(n) : '—';
  }
  function dateText(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.valueOf()) ? esc(value) : d.toLocaleDateString('en-CA');
  }

  function statCard(label, value, note) {
    return `<article class="finance-stat-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note || '')}</small></article>`;
  }

  function compactTable(title, items, columns, emptyText) {
    const body = items.slice(0, 12).map((row) => `<tr>${columns.map((col) => `<td data-label="${esc(col.label)}">${col.render ? col.render(row) : esc(row?.[col.key] ?? '—')}</td>`).join('')}</tr>`).join('');
    return `<section class="finance-list-card"><div class="finance-list-heading"><h3>${esc(title)}</h3><span>${items.length} item${items.length === 1 ? '' : 's'}</span></div>${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr>${columns.map((col) => `<th>${esc(col.label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>` : `<div class="finance-empty"><strong>${esc(emptyText || 'Nothing is waiting here.')}</strong><small>The queue will populate when records need attention.</small></div>`}</section>`;
  }

  function reviewActionCell(row) {
    const approved = row?.disposition_status === 'approved';
    const waiting = !row?.disposition_id && row?.intake_status === 'finance_review_queued';
    const eligible = approved && row?.candidate_generation_status === 'eligible';
    const generated = row?.candidate_generation_status === 'generated';
    if (!canApprove()) return '<small>View only</small>';
    if (waiting) {
      return `<div class="finance-review-actions">
        <button type="button" data-finance-review="approve" data-intake-id="${esc(row.intake_id)}" ${state.mutating ? 'disabled' : ''}>Approve</button>
        <button type="button" data-finance-review="reject" data-intake-id="${esc(row.intake_id)}" ${state.mutating ? 'disabled' : ''}>Reject</button>
      </div>`;
    }
    if (eligible) return `<button type="button" data-finance-review="generate" data-intake-id="${esc(row.intake_id)}" ${state.mutating ? 'disabled' : ''}>Generate draft candidates</button>`;
    if (generated) return '<small>Draft candidates generated</small>';
    return `<small>${esc(row?.disposition_status || row?.candidate_generation_status || 'No action')}</small>`;
  }

  function completionReviewPanel() {
    if (state.reviewError) {
      return `<section class="finance-list-card"><div class="finance-list-heading"><h3>Completed jobs — Finance review</h3><span>Schema 172</span></div><div class="notice warning"><strong>Review queue unavailable.</strong><br>${esc(state.reviewError)}</div><p><small>Accounting remains available. Candidate generation stays fail-closed until the Schema 172 review authority is reachable.</small></p></section>`;
    }
    const items = reviewRows();
    const status = state.reviewPayload?.status || {};
    const summary = `<div class="finance-stat-grid">
      ${statCard('Awaiting disposition', String(status.awaiting_disposition_count || 0), 'Human Finance decision')}
      ${statCard('Approved to generate', String(status.approved_awaiting_generation_count || 0), 'Explicit draft generation')}
      ${statCard('Generated', String(status.generated_count || 0), 'Draft candidates only')}
      ${statCard('Blocked', String(status.blocked_count || 0), 'Requires investigation')}
    </div>`;
    return `<section class="finance-list-card">
      <div class="finance-list-heading"><div><h3>Completed jobs — Finance review</h3><small>Approve/reject first; generate draft candidates second.</small></div><span>${items.length} item${items.length === 1 ? '' : 's'}</span></div>
      ${summary}
      <div class="finance-module-note"><strong>Schema 172 boundary:</strong> invoice totals come from the canonical work order. Journal figures are documentary completion totals only. Posting, payments, Stripe and PayPal remain unauthorized.</div>
      ${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th>Job</th><th>Client</th><th>Completion</th><th>Canonical total</th><th>Disposition</th><th>Candidates</th><th>Action</th></tr></thead><tbody>${items.slice(0,30).map((r) => `<tr>
        <td data-label="Job"><strong>${esc(r.job_code || r.job_id)}</strong><br><small>${esc(r.job_name || r.work_order_number || '')}</small></td>
        <td data-label="Client">${esc(r.client_name || '—')}<br><small>${esc(r.site_name || '')}</small></td>
        <td data-label="Completion">${dateText(r.completion_date)}<br><small>${esc(r.completion_review_status || '—')}</small></td>
        <td data-label="Canonical total">${money(r.total_amount)}<br><small>${money(r.subtotal)} + ${money(r.tax_total)} tax</small></td>
        <td data-label="Disposition">${esc(r.disposition_status || 'awaiting review')}<br><small>${esc(r.disposition_reason || '')}</small></td>
        <td data-label="Candidates">${esc(r.candidate_generation_status || '—')}<br><small>Invoice: ${esc(r.invoice_candidate_status || '—')} · Journal: ${esc(r.journal_candidate_status || '—')}</small></td>
        <td data-label="Action">${reviewActionCell(r)}</td>
      </tr>`).join('')}</tbody></table></div>` : `<div class="finance-empty"><strong>No completed jobs need Finance disposition.</strong><small>The queue is populated only by canonical jobs.job_completed events consumed through the controlled Finance intake.</small></div>`}
    </section>`;
  }

  function bindReviewActions() {
    document.querySelectorAll('[data-finance-review]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.financeReview;
        const intakeId = button.dataset.intakeId;
        if (!action || !intakeId || state.mutating) return;
        if (action === 'approve' || action === 'reject') {
          const reason = window.prompt(`Finance ${action === 'approve' ? 'approval' : 'rejection'} reason:`, '') || '';
          if (reason.trim().length < 3) return;
          await mutateReview({ action:'dispose', intake_id:intakeId, disposition:action === 'approve' ? 'approved' : 'rejected', reason:reason.trim() });
          return;
        }
        if (action === 'generate') {
          if (!window.confirm('Generate draft invoice and journal candidates from canonical records? This does not post or charge anything.')) return;
          await mutateReview({ action:'generate_candidates', intake_id:intakeId });
        }
      });
    });
  }

  function render() {
    const host = byId('financeWorkspace');
    if (!host) return;
    if (!canView()) {
      host.innerHTML = '<div class="module-access-denied"><strong>Finance module hidden</strong><p>Your profile does not have Finance access.</p></div>';
      return;
    }
    if (state.loading) {
      host.innerHTML = '<div class="finance-loading">Loading Finance workspace…</div>';
      return;
    }
    if (state.error) {
      host.innerHTML = `<div class="notice error"><strong>Finance data could not load.</strong><br>${esc(state.error)}</div><button id="financeRetry" type="button">Retry Finance</button>`;
      byId('financeRetry')?.addEventListener('click', () => load(true));
      return;
    }

    const closeRows = rows('accounting_close_admin_control_dashboard');
    const reconRows = rows('accounting_reconciliation_manual_review_queue');
    const packageRows = rows('accounting_close_package_delivery_queue');
    const taxRows = rows('sales_tax_filing_review');
    const payrollRows = rows('payroll_remittance_review');
    const closeOverview = rows('admin_close_center_overview')[0] || {};
    const access = accessLevel();

    host.innerHTML = `
      <div class="module-workspace-heading">
        <div><span class="module-kicker">Finance module · ${esc(access)} access</span><h2>Finance workspace</h2><p>Accounting, reconciliation, completed-job review, close, tax/payroll review, and accountant handoff stay separate from Safety and Jobs navigation.</p></div>
        <div class="section-graphic-placeholder finance-graphic"><span aria-hidden="true">$</span><strong>Finance proof placeholder</strong><small>Future approved visual: close dashboard, reconciliation proof, or accountant package preview.</small></div>
      </div>
      <div class="finance-stat-grid">
        ${statCard('Close periods', String(closeRows.length), closeOverview?.close_status || 'Period-control queue')}
        ${statCard('Reconciliation review', String(reconRows.length), 'Manual review items')}
        ${statCard('Close packages', String(packageRows.length), 'Accountant delivery queue')}
        ${statCard('Tax / payroll', String(taxRows.length + payrollRows.length), 'Review records')}
      </div>
      <div class="finance-module-note"><strong>Module boundary:</strong> Finance data is not loaded for Safety-only or Jobs-only profiles. Completed-job financial candidates now require Finance approval and canonical server-owned values.</div>
      <div class="finance-lists">
        ${completionReviewPanel()}
        ${compactTable('Accounting close', closeRows, [
          {label:'Period', render:(r)=>`${dateText(r.period_start)} – ${dateText(r.period_end)}`},
          {label:'Status', key:'close_status'},
          {label:'Balance', render:(r)=>money(r.ending_balance ?? r.balance ?? 0)}
        ], 'No close periods need review.')}
        ${compactTable('Reconciliation exceptions', reconRows, [
          {label:'Date', render:(r)=>dateText(r.item_date || r.created_at)},
          {label:'Description', render:(r)=>esc(r.item_description || r.description || r.review_reason || 'Review item')},
          {label:'Amount', render:(r)=>money(r.amount)},
          {label:'Priority', render:(r)=>esc(r.review_priority || r.match_status || 'review')}
        ], 'No reconciliation exceptions are waiting.')}
        ${compactTable('Tax filing review', taxRows, [
          {label:'Period end', render:(r)=>dateText(r.filing_period_end || r.period_end)},
          {label:'Status', render:(r)=>esc(r.filing_status || r.review_status || 'review')},
          {label:'Amount', render:(r)=>money(r.amount_due ?? r.net_tax ?? 0)}
        ], 'No tax filing review is waiting.')}
        ${compactTable('Payroll remittance review', payrollRows, [
          {label:'Period end', render:(r)=>dateText(r.remittance_period_end || r.period_end)},
          {label:'Status', render:(r)=>esc(r.remittance_status || r.review_status || 'review')},
          {label:'Amount', render:(r)=>money(r.total_remittance ?? r.amount_due ?? 0)}
        ], 'No payroll remittance review is waiting.')}
      </div>
      <div class="finance-toolbar"><button id="financeRefresh" type="button">Refresh Finance</button><span>Last refreshed ${state.loadedAt ? new Date(state.loadedAt).toLocaleTimeString('en-CA') : '—'}</span></div>`;
    byId('financeRefresh')?.addEventListener('click', () => load(true));
    bindReviewActions();
  }

  async function loadReview() {
    state.reviewError = '';
    try {
      const response = await window.YWIAPI?.jsonFetch?.('finance-job-completion-review', {
        method:'POST',
        body:{ action:'list' },
        requireAuth:true,
        timeoutMs:30000
      });
      if (!response?.ok) throw new Error(response?.error || 'Finance completion review authority returned no data.');
      state.reviewPayload = response;
    } catch (err) {
      state.reviewPayload = null;
      state.reviewError = err?.message || 'Finance completion review authority is unavailable.';
    }
  }

  async function mutateReview(payload) {
    if (!canApprove() || state.mutating) return;
    state.mutating = true;
    render();
    try {
      const response = await window.YWIAPI?.jsonFetch?.('finance-job-completion-review', {
        method:'POST', body:payload, requireAuth:true, timeoutMs:30000
      });
      if (!response?.ok) throw new Error(response?.error || 'Finance completion review action failed.');
      await load(true);
    } catch (err) {
      state.reviewError = err?.message || 'Finance completion review action failed.';
    } finally {
      state.mutating = false;
      render();
    }
  }

  async function load(force = false) {
    if (!canView() || state.loading) return;
    if (!force && state.payload && Date.now() - state.loadedAt < 30000) { render(); return; }
    state.loading = true; state.error = ''; render();
    try {
      const [accounting] = await Promise.all([
        window.YWIAPI?.loadAdminDirectory?.({ scope:'accounting', limit:40, timeoutMs:30000 }),
        loadReview()
      ]);
      state.payload = accounting;
      if (!state.payload?.ok) throw new Error(state.payload?.error || 'Finance accounting scope returned no data.');
      state.loadedAt = Date.now();
    } catch (err) {
      state.error = err?.message || 'Finance data request failed.';
    } finally {
      state.loading = false; render();
    }
  }

  function onRoute(event) {
    if (event?.detail?.allowed === 'finance' || active()) load(false);
  }
  function active() { return document.getElementById('finance')?.classList.contains('active'); }

  document.addEventListener('DOMContentLoaded', () => { render(); if (active()) load(false); });
  document.addEventListener('ywi:route-shown', onRoute);
  document.addEventListener('ywi:auth-changed', () => { state.payload = null; state.reviewPayload = null; state.loadedAt = 0; state.error = ''; state.reviewError = ''; render(); if (active()) load(true); });
  document.addEventListener('ywi:module-permissions-changed', () => { render(); if (active()) load(true); });
})();
