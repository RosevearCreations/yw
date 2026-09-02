/* File: js/finance-ui.js
   Schema 179 Finance module home.
   Finance owns human disposition, draft-candidate generation, separate posting approval,
   operational preflight visibility, controlled execution/recovery visibility and manage-only reversal.
   Amounts, account identities, posting release state and provider/payment truth remain server-owned.
*/

'use strict';

(function () {
  const state = {
    loading: false,
    loadedAt: 0,
    payload: null,
    reviewPayload: null,
    postingPayload: null,
    error: '',
    reviewError: '',
    postingError: '',
    mutating: false
  };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.YWIAPI?.escHtml?.(value) || String(value ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function authState() { return window.YWI_AUTH?.getState?.() || {}; }
  function canView() { return window.YWISecurity?.canViewModule?.('finance', authState().role || 'employee', 'view') !== false; }
  function canApprove() { return window.YWISecurity?.canViewModule?.('finance', authState().role || 'employee', 'approve') === true; }
  function canManage() { return window.YWISecurity?.canViewModule?.('finance', authState().role || 'employee', 'manage') === true; }
  function accessLevel() { return window.YWISecurity?.getModuleAccess?.('finance', authState().role || 'employee') || 'hidden'; }

  function rows(name) { return Array.isArray(state.payload?.[name]) ? state.payload[name] : []; }
  function reviewRows() { return Array.isArray(state.reviewPayload?.queue) ? state.reviewPayload.queue : []; }
  function postingRows() {
    const lifecycle = Array.isArray(state.postingPayload?.operational_lifecycle) ? state.postingPayload.operational_lifecycle : [];
    const executionQueue = Array.isArray(state.postingPayload?.queue) ? state.postingPayload.queue : [];
    const serverExecution = new Map(executionQueue.map((row) => [String(row?.intake_id || ''), row?.execution_authorized === true]));
    return lifecycle.map((row) => ({
      ...row,
      execution_authorized: serverExecution.get(String(row?.intake_id || '')) === true
    }));
  }
  function reconciliationRows() { return Array.isArray(state.postingPayload?.reconciliation_issues) ? state.postingPayload.reconciliation_issues : []; }

  function money(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? new Intl.NumberFormat('en-CA', { style:'currency', currency:'CAD' }).format(n) : '—';
  }
  function dateText(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.valueOf()) ? esc(value) : d.toLocaleDateString('en-CA');
  }
  function dateTimeText(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.valueOf()) ? esc(value) : d.toLocaleString('en-CA');
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
      return `<section class="finance-list-card"><div class="finance-list-heading"><h3>Completed jobs — Finance review</h3><span>Disposition</span></div><div class="notice warning"><strong>Review queue unavailable.</strong><br>${esc(state.reviewError)}</div><p><small>Accounting remains available. Candidate generation stays fail-closed until the Finance review authority is reachable.</small></p></section>`;
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
      <div class="finance-module-note"><strong>Candidate boundary:</strong> invoice totals come from the canonical work order. Journal figures are documentary completion totals only. Candidate generation does not post, charge, or mutate Jobs.</div>
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

  function lifecycleActionCell(row) {
    if (!canApprove()) return '<small>View only</small>';
    const buttons = [];
    if (row?.lifecycle_stage === 'awaiting_posting_approval') {
      buttons.push(`<button type="button" data-finance-posting="approve_posting" data-intake-id="${esc(row.intake_id)}" ${state.mutating ? 'disabled' : ''}>Approve posting</button>`);
    }
    if (row?.posting_approval_id && !['posted','reversed'].includes(String(row?.lifecycle_stage || ''))) {
      buttons.push(`<button type="button" data-finance-posting="preflight" data-intake-id="${esc(row.intake_id)}" ${state.mutating ? 'disabled' : ''}>Run preflight</button>`);
    }
    if (row?.execution_authorized === true && row?.execution_release_enabled === true && !row?.execution_run_id) {
      buttons.push(`<button type="button" data-finance-posting="execute_posting" data-intake-id="${esc(row.intake_id)}" ${state.mutating ? 'disabled' : ''}>Execute controlled posting</button>`);
    }
    if (row?.lifecycle_stage === 'posted' && canManage()) {
      buttons.push(`<button type="button" data-finance-posting="reverse_posting" data-intake-id="${esc(row.intake_id)}" ${state.mutating ? 'disabled' : ''}>Reverse / void</button>`);
    }
    return buttons.length ? `<div class="finance-review-actions">${buttons.join('')}</div>` : '<small>No action available</small>';
  }

  function operationalLifecyclePanel() {
    if (state.postingError) {
      return `<section class="finance-list-card"><div class="finance-list-heading"><h3>Completion → accounting lifecycle</h3><span>Schema 179</span></div><div class="notice warning"><strong>Operational control plane unavailable.</strong><br>${esc(state.postingError)}</div></section>`;
    }
    const items = postingRows();
    const summary = state.postingPayload?.operational_summary || {};
    const reconciliation = reconciliationRows();
    const executionEnabled = summary.execution_release_enabled === true;
    return `<section class="finance-list-card">
      <div class="finance-list-heading"><div><h3>Completion → accounting lifecycle</h3><small>One server-owned state chain from Finance intake through reversal.</small></div><span>${items.length} intake${items.length === 1 ? '' : 's'}</span></div>
      <div class="finance-stat-grid">
        ${statCard('Awaiting review', String(summary.awaiting_review_count || 0), `${summary.stale_review_count || 0} stale >24h`)}
        ${statCard('Awaiting posting approval', String(summary.awaiting_posting_approval_count || 0), 'Separate human authority')}
        ${statCard('Preflight blocked', String(summary.preflight_blocked_count || 0), 'Reason-coded blockers')}
        ${statCard('Recovery required', String(summary.recovery_required_count || 0), 'Retry quarantined')}
        ${statCard('Posted', String(summary.posted_count || 0), 'Paired AR + GL')}
        ${statCard('Reversed', String(summary.reversed_count || 0), 'Auditable reversal')}
      </div>
      <div class="finance-module-note"><strong>Schema 179 boundary:</strong> posting execution release is <strong>${executionEnabled ? 'ENABLED' : 'OFF'}</strong>. The browser cannot enable it or approve accountant mappings. Provider/payment mutation remains OFF. Reconciliation issues: <strong>${reconciliation.length}</strong>.</div>
      ${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th>Job</th><th>Stage</th><th>Approval / preflight</th><th>Accounting pair</th><th>Blocker / next action</th><th>Action</th></tr></thead><tbody>${items.slice(0,50).map((r) => `<tr>
        <td data-label="Job"><strong>${esc(r.job_code || r.job_id)}</strong><br><small>${esc(r.client_name || '')} · ${money(r.total_amount)}</small></td>
        <td data-label="Stage"><strong>${esc(r.lifecycle_stage || 'blocked')}</strong><br><small>Queued ${dateTimeText(r.queued_at)}</small></td>
        <td data-label="Approval / preflight">${esc(r.posting_approval_status || 'not approved')}<br><small>${esc(r.preflight_status || 'not run')} · mappings ${esc(r.invoice_mapping_status || '—')}/${esc(r.journal_mapping_status || '—')}</small></td>
        <td data-label="Accounting pair">${esc(r.posting_execution_status || 'not started')}<br><small>AR ${r.ar_invoice_id ? 'linked' : '—'} · GL ${r.gl_batch_id ? 'linked' : '—'}${r.reversal_status ? ` · reversal ${esc(r.reversal_status)}` : ''}</small></td>
        <td data-label="Blocker / next action"><strong>${esc(r.blocker_code || '—')}</strong><br>${esc(r.blocker_message || '')}<br><small>${esc(r.action_hint || '')}</small></td>
        <td data-label="Action">${lifecycleActionCell(r)}</td>
      </tr>`).join('')}</tbody></table></div>` : `<div class="finance-empty"><strong>No Finance completion lifecycle rows are waiting.</strong><small>The Schema 178 view follows canonical Finance intake only; it does not manufacture accounting work.</small></div>`}
      ${reconciliation.length ? `<div class="notice warning"><strong>Finance reconciliation requires attention.</strong> ${reconciliation.slice(0,8).map((issue) => `${esc(issue.issue_code)} — ${esc(issue.action_hint)}`).join(' · ')}</div>` : `<div class="finance-module-note"><strong>Reconciliation:</strong> no Finance lifecycle integrity issues are currently reported.</div>`}
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

  function bindPostingActions() {
    document.querySelectorAll('[data-finance-posting]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.financePosting;
        const intakeId = button.dataset.intakeId;
        if (!action || !intakeId || state.mutating) return;
        const row = postingRows().find((item) => String(item.intake_id) === String(intakeId));
        if (!row) return;
        if (action === 'preflight') {
          await mutatePosting({ action:'preflight', intake_id:intakeId });
          return;
        }
        if (action === 'approve_posting') {
          const reason = window.prompt('Finance posting approval reason:', '') || '';
          if (reason.trim().length < 3) return;
          await mutatePosting({ action, intake_id:intakeId, reason:reason.trim() });
          return;
        }
        if (action === 'execute_posting') {
          if (row.execution_authorized !== true || row.execution_release_enabled !== true) return;
          if (!window.confirm('Execute the protected, idempotent AR + GL posting pair? No payment provider will be mutated.')) return;
          const reason = window.prompt('Finance posting execution reason:', '') || '';
          if (reason.trim().length < 3) return;
          await mutatePosting({ action, intake_id:intakeId, reason:reason.trim() });
          return;
        }
        if (action === 'reverse_posting') {
          if (!canManage() || row.lifecycle_stage !== 'posted') return;
          if (!window.confirm('Create an auditable reversal/void? The original posted GL history will be preserved.')) return;
          const reason = window.prompt('Finance reversal / void reason:', '') || '';
          if (reason.trim().length < 3) return;
          await mutatePosting({ action, intake_id:intakeId, reason:reason.trim() });
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
        <div><span class="module-kicker">Finance module · ${esc(access)} access</span><h2>Finance workspace</h2><p>Accounting, reconciliation, completed-job lifecycle, close, tax/payroll review, and accountant handoff stay separate from Safety and Jobs navigation.</p></div>
        <div class="section-graphic-placeholder finance-graphic"><span aria-hidden="true">$</span><strong>Finance proof placeholder</strong><small>Future approved visual: close dashboard, reconciliation proof, or accountant package preview.</small></div>
      </div>
      <div class="finance-stat-grid">
        ${statCard('Close periods', String(closeRows.length), closeOverview?.close_status || 'Period-control queue')}
        ${statCard('Reconciliation review', String(reconRows.length), 'Manual review items')}
        ${statCard('Close packages', String(packageRows.length), 'Accountant delivery queue')}
        ${statCard('Tax / payroll', String(taxRows.length + payrollRows.length), 'Review records')}
      </div>
      <div class="finance-module-note"><strong>Module boundary:</strong> Finance data is not loaded for Safety-only or Jobs-only profiles. All completion-to-accounting actions use protected server-owned authorities and preserve manual Production promotion.</div>
      <div class="finance-lists">
        ${operationalLifecyclePanel()}
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
    bindPostingActions();
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

  async function loadPosting() {
    state.postingError = '';
    try {
      const response = await window.YWIAPI?.jsonFetch?.('finance-job-completion-posting-approval', {
        method:'POST',
        body:{ action:'list' },
        requireAuth:true,
        timeoutMs:30000
      });
      if (!response?.ok) throw new Error(response?.error || 'Finance posting operational authority returned no data.');
      state.postingPayload = response;
    } catch (err) {
      state.postingPayload = null;
      state.postingError = err?.message || 'Finance posting operational authority is unavailable.';
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

  async function mutatePosting(payload) {
    if (!canApprove() || state.mutating) return;
    if (payload?.action === 'reverse_posting' && !canManage()) return;
    state.mutating = true;
    render();
    try {
      const response = await window.YWIAPI?.jsonFetch?.('finance-job-completion-posting-approval', {
        method:'POST', body:payload, requireAuth:true, timeoutMs:30000
      });
      if (!response?.ok) throw new Error(response?.error || 'Finance posting control-plane action failed.');
      await load(true);
    } catch (err) {
      state.postingError = err?.message || 'Finance posting control-plane action failed.';
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
        loadReview(),
        loadPosting()
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
  document.addEventListener('ywi:auth-changed', () => {
    state.payload = null; state.reviewPayload = null; state.postingPayload = null;
    state.loadedAt = 0; state.error = ''; state.reviewError = ''; state.postingError = '';
    render(); if (active()) load(true);
  });
  document.addEventListener('ywi:module-permissions-changed', () => { render(); if (active()) load(true); });
})();
