/* File: js/finance-ui.js
   Schema 159 Finance module home.
   Read-focused workspace using the existing accounting directory fast path. Mutating finance
   actions remain protected by role/action checks and module enforcement in Edge Functions.
*/

'use strict';

(function () {
  const state = { loading: false, loadedAt: 0, payload: null, error: '' };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.YWIAPI?.escHtml?.(value) || String(value ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function authState() { return window.YWI_AUTH?.getState?.() || {}; }
  function canView() { return window.YWISecurity?.canViewModule?.('finance', authState().role || 'employee', 'view') !== false; }
  function accessLevel() { return window.YWISecurity?.getModuleAccess?.('finance', authState().role || 'employee') || 'hidden'; }

  function rows(name) { return Array.isArray(state.payload?.[name]) ? state.payload[name] : []; }
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
    return `<section class="finance-list-card"><div class="finance-list-heading"><h3>${esc(title)}</h3><span>${items.length} item${items.length === 1 ? '' : 's'}</span></div>${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr>${columns.map((col) => `<th>${esc(col.label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>` : `<div class="finance-empty"><strong>${esc(emptyText || 'Nothing is waiting here.')}</strong><small>The queue will populate from the accounting fast path when records need attention.</small></div>`}</section>`;
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
        <div><span class="module-kicker">Finance module · ${esc(access)} access</span><h2>Finance workspace</h2><p>Accounting, reconciliation, close, tax/payroll review, and accountant handoff stay separate from Safety and Jobs navigation.</p></div>
        <div class="section-graphic-placeholder finance-graphic"><span aria-hidden="true">$</span><strong>Finance proof placeholder</strong><small>Future approved visual: close dashboard, reconciliation proof, or accountant package preview.</small></div>
      </div>
      <div class="finance-stat-grid">
        ${statCard('Close periods', String(closeRows.length), closeOverview?.close_status || 'Period-control queue')}
        ${statCard('Reconciliation review', String(reconRows.length), 'Manual review items')}
        ${statCard('Close packages', String(packageRows.length), 'Accountant delivery queue')}
        ${statCard('Tax / payroll', String(taxRows.length + payrollRows.length), 'Review records')}
      </div>
      <div class="finance-module-note"><strong>Module boundary:</strong> Finance data is not loaded for Safety-only or Jobs-only profiles. Approval/posting actions still require their existing seniority and accounting controls.</div>
      <div class="finance-lists">
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
  }

  async function load(force = false) {
    if (!canView() || state.loading) return;
    if (!force && state.payload && Date.now() - state.loadedAt < 30000) { render(); return; }
    state.loading = true; state.error = ''; render();
    try {
      state.payload = await window.YWIAPI?.loadAdminDirectory?.({ scope:'accounting', limit:40, timeoutMs:30000 });
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
  document.addEventListener('ywi:auth-changed', () => { state.payload = null; state.loadedAt = 0; state.error = ''; render(); if (active()) load(true); });
  document.addEventListener('ywi:module-permissions-changed', () => { render(); if (active()) load(true); });
})();
