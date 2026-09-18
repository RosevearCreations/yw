/* File: js/admin-finance-workspace.js
   Build 310 Finance Acceptance Command Center.
   Presentation-only operator layer over existing Admin/Finance authority.
   It answers "What prevents accounting from being GREEN?" from already-rendered accounting
   evidence, preserves lazy loading, and deep-links to established review surfaces.
   It creates no API, posting, payment, provider, mapping-approval, or database authority.
*/

'use strict';

(function () {
  const BUILD = 310;
  const WORKSPACE_ID = 'adminFinanceWorkspace';
  const STYLE_ID = 'adminFinanceWorkspaceStyles';
  const LABEL = 'Finance & Accounting';
  const QUICK_LINKS = Object.freeze([
    { key:'close', title:'Close, Tax & Remittance', note:'Open the existing Guided Close Center for period blockers, reconciliation, tax/remittance review and accountant-package delivery.', panel:'Guided Close Center' },
    { key:'orders', title:'Orders & Accounting Intake', note:'Review the existing order and first-accounting-record workflow without creating another accounting data authority.', panel:'Orders and Accounting Stub' },
    { key:'backbone', title:'Operational Accounting', note:'Open the existing operations/accounting backbone for shared job, purchasing, payment, bank and reconciliation context.', panel:'Operations and Accounting Backbone Manager' },
    { key:'tasks', title:'Finance Task Inbox', note:'Review already-loaded Admin tasks that require accounting, close, reconciliation, tax, payroll, banking or mapping follow-up.', panel:'Admin Task Inbox' }
  ]);

  const BLOCKER_AREAS = Object.freeze([
    {
      key:'control-plane',
      title:'Finance hardening & posting locks',
      owner:'Finance administrator',
      action:'Keep posting execution and provider/payment mutation fail-closed. Resolve any Finance hardening or accounting freshness warning before acceptance.',
      route:'finance',
      selectors:['#ad_accounting_table tbody tr'],
      taskPattern:/posting|finance hardening|provider|execution release/i,
    },
    {
      key:'reconciliation',
      title:'Reconciliation exceptions',
      owner:'Bookkeeper / accountant',
      action:'Resolve unmatched, exception, split, or recovery items and complete human reconciliation signoff.',
      panel:'Operations and Accounting Backbone Manager',
      selectors:['#ad_reconciliation_exception_resolution_table tbody tr','#ad_reconciliation_match_workbench_table tbody tr','#ad_accounting_exception_closure_table tbody tr'],
      taskPattern:/reconcil|unmatched|bank match|split match/i,
    },
    {
      key:'mapping',
      title:'Account mapping gaps',
      owner:'Accountant / bookkeeper',
      action:'Review the required chart-of-accounts mappings in Finance. Suggestions never auto-approve a mapping.',
      route:'finance',
      selectors:['#ad_payment_posting_proof_table tbody tr'],
      taskPattern:/account mapping|chart[- ]of[- ]accounts|mapping review|mapping gap/i,
    },
    {
      key:'payments',
      title:'Pending payment actions',
      owner:'Finance approver',
      action:'Review pending/failed payment applications, adjustments and posting proof without enabling a payment provider.',
      panel:'Operations and Accounting Backbone Manager',
      selectors:['#ad_payment_exception_decision_table tbody tr','#ad_payment_adjustment_workflow_table tbody tr','#ad_payment_application_ui_queue_table tbody tr','#ad_payment_write_path_table tbody tr','#ad_payment_posting_proof_table tbody tr'],
      taskPattern:/payment|refund|write[- ]off|overpayment|credit/i,
    },
    {
      key:'bank-import',
      title:'Bank-import review',
      owner:'Bookkeeper / finance reviewer',
      action:'Review CSV validation, duplicates and rejected rows before any controlled promotion into reconciliation.',
      panel:'Operations and Accounting Backbone Manager',
      selectors:['#ad_bank_csv_import_table tbody tr','#ad_reconciliation_import_validation_table tbody tr'],
      taskPattern:/bank csv|bank import|duplicate bank|rejected row/i,
    },
    {
      key:'period-close',
      title:'Period / close state',
      owner:'Finance administrator',
      action:'Complete the Guided Close Center blockers in order; do not bypass period locks or unresolved reconciliation.',
      panel:'Guided Close Center',
      selectors:['#ad_close_wizard_detail_table tbody tr','#ad_accounting_close_control_table tbody tr'],
      taskPattern:/period close|close step|month[- ]end|year[- ]end/i,
    },
    {
      key:'remittance',
      title:'Tax & payroll remittance readiness',
      owner:'Finance administrator',
      action:'Finish filing/remittance review, proof, dates and close-period checks before treating remittance work as ready.',
      panel:'Guided Close Center',
      selectors:[],
      taskPattern:/sales tax|hst|gst|payroll|remittance|filing/i,
    },
    {
      key:'accountant-export',
      title:'Accountant-export readiness',
      owner:'Finance manager / accountant',
      action:'Resolve mapping, reconciliation and close blockers before generating or confirming the accountant handoff package.',
      panel:'Guided Close Center',
      selectors:[],
      taskPattern:/accountant|handoff|close package|package delivery|export package/i,
    }
  ]);

  let applying = false;
  let observer = null;
  let refreshTimer = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function isActive() {
    return String(document.querySelector('#ad_hub_breadcrumb strong')?.textContent || '').trim() === LABEL;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${WORKSPACE_ID}{margin:12px 0 16px;padding:16px;border:1px solid rgba(250,204,21,.25);border-radius:16px;background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(15,23,42,.68))}
      #${WORKSPACE_ID}[hidden]{display:none!important}.admin-finance-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.admin-finance-head h3{margin:2px 0 5px}.admin-finance-head p{margin:0;max-width:860px;color:#cbd5e1;line-height:1.45}.admin-finance-status{display:inline-flex;align-items:center;min-height:30px;padding:4px 9px;border:1px solid rgba(148,163,184,.28);border-radius:999px;font-size:.75rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.admin-finance-status[data-state="ready"]{border-color:rgba(52,211,153,.45);color:#d7ffe9}.admin-finance-status[data-state="action"]{border-color:rgba(251,191,36,.48);color:#fff3c4}.admin-finance-status[data-state="blocked"]{border-color:rgba(248,113,113,.5);color:#fee2e2}.admin-finance-status[data-state="open"]{color:#bfdbfe;border-color:rgba(96,165,250,.4)}
      .admin-finance-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin:14px 0}.admin-finance-metric{padding:10px 11px;border-radius:12px;background:rgba(30,41,59,.72);border:1px solid rgba(148,163,184,.16)}.admin-finance-metric span,.admin-finance-metric strong{display:block}.admin-finance-metric span{font-size:.75rem;color:#aebdd0}.admin-finance-metric strong{margin-top:4px;font-size:1.08rem}.admin-finance-context{margin:10px 0 14px;padding:11px 12px;border-radius:12px;background:rgba(148,163,184,.07);color:#cbd5e1;line-height:1.45}
      .admin-finance-blockers{margin:14px 0}.admin-finance-blockers-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px}.admin-finance-blockers-head h4{margin:0}.admin-finance-blockers-head small{color:#b9c8dc}.admin-finance-blocker-list{display:grid;gap:8px}.admin-finance-blocker{padding:11px 12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:rgba(15,23,42,.64)}.admin-finance-blocker-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.admin-finance-blocker h5{margin:0;font-size:.95rem}.admin-finance-blocker p{margin:6px 0 0;color:#cbd5e1;line-height:1.4}.admin-finance-blocker-meta{display:grid;grid-template-columns:minmax(120px,.7fr) minmax(220px,1.6fr) auto;gap:8px;align-items:center;margin-top:9px}.admin-finance-blocker-meta small{color:#b9c8dc}.admin-finance-blocker-evidence{margin-top:7px;color:#aebdd0;font-size:.78rem}
      .admin-finance-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-finance-card{text-align:left;min-width:0;padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(15,23,42,.72);color:inherit;cursor:pointer}.admin-finance-card:hover,.admin-finance-card:focus-visible{border-color:rgba(250,204,21,.58)}.admin-finance-card strong,.admin-finance-card small{display:block}.admin-finance-card small{margin-top:5px;color:#b9c8dc;line-height:1.4}.admin-finance-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:760px){.admin-finance-grid{grid-template-columns:1fr}.admin-finance-actions>*{flex:1 1 150px}.admin-finance-blocker-meta{grid-template-columns:1fr}.admin-finance-blocker-meta button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function statusSnapshot() {
    const badge = document.getElementById('ad_accounting_age_badge');
    const status = String(badge?.dataset?.status || '').toLowerCase();
    const text = String(badge?.textContent || '').trim();
    if (status === 'ok' || /ready|current|live/i.test(text)) return { label:'CURRENT', state:'ready', loaded:true };
    if (status === 'error' || /fail|blocked|error/i.test(text)) return { label:'BLOCKED', state:'blocked', loaded:true };
    if (/warning|review|overdue|action/i.test(text) && !/not loaded/i.test(text)) return { label:'NEEDS REVIEW', state:'action', loaded:true };
    return { label:'OPEN TO LOAD', state:'open', loaded:false };
  }

  function tableRows(selector, emptyPattern = /no .*loaded|no .*items|nothing .*waiting|no .*review/i) {
    return [...document.querySelectorAll(selector)]
      .filter((row) => row.cells?.length && !emptyPattern.test(row.textContent || ''));
  }

  function countRows(selector, emptyPattern) {
    return tableRows(selector, emptyPattern).length;
  }

  function financeTaskRows(pattern = null) {
    return tableRows('#ad_task_table tbody tr', /no .*loaded|no tasks/i)
      .filter((row) => !pattern || pattern.test(row.textContent || ''));
  }

  function financeTaskCount() {
    return financeTaskRows(/account|finance|close|reconcil|tax|payroll|bank|payment|journal|mapping|accountant|remit/i).length;
  }

  function attentionText(text) {
    const value = String(text || '').trim();
    if (!value) return false;
    const issue = /fail|failed|error|blocked|exception|pending|open|review|required|missing|stale|overdue|unmatched|rejected|duplicate|draft|warning|hold|recovery|attention/i.test(value);
    const clearlyDone = /completed|closed|resolved|reconciled|remitted|delivered|confirmed|posted|passed|current|green/i.test(value);
    return issue || !clearlyDone;
  }

  function severeText(text) {
    return /fail|failed|error|blocked|critical|exception|rejected|missing|stale|recovery/i.test(String(text || ''));
  }

  function shortEvidence(text) {
    const clean = String(text || '').replace(/\s+/g,' ').trim();
    if (!clean) return '';
    return clean.length > 180 ? `${clean.slice(0,177)}…` : clean;
  }

  function areaEvidence(area) {
    const rows = area.selectors.flatMap((selector) => tableRows(selector));
    const tasks = financeTaskRows(area.taskPattern);
    const evidence = [...rows, ...tasks]
      .map((row) => shortEvidence(row.textContent || ''))
      .filter(Boolean);
    return [...new Set(evidence)];
  }

  function classifyArea(area, accountingStatus) {
    if (!accountingStatus.loaded) {
      return { ...area, state:'open', label:'OPEN TO LOAD', count:0, evidence:[] };
    }
    const evidence = areaEvidence(area);
    const blockers = evidence.filter(attentionText);
    if (area.key === 'control-plane') {
      if (accountingStatus.state === 'blocked') return { ...area, state:'blocked', label:'BLOCKED', count:1, evidence:[document.getElementById('ad_accounting_age_badge')?.textContent || 'Accounting authority is blocked.'] };
      if (accountingStatus.state === 'action') return { ...area, state:'action', label:'REVIEW', count:1, evidence:[document.getElementById('ad_accounting_age_badge')?.textContent || 'Accounting authority needs review.'] };
      const controlIssues = blockers.filter((text) => area.taskPattern.test(text));
      if (controlIssues.length) return { ...area, state:controlIssues.some(severeText) ? 'blocked' : 'action', label:controlIssues.some(severeText) ? 'BLOCKED' : 'ACTION', count:controlIssues.length, evidence:controlIssues };
      return { ...area, state:'ready', label:'READY', count:0, evidence:['Accounting scope is current; posting/provider authority remains fail-closed by existing Finance controls.'] };
    }
    if (!blockers.length) return { ...area, state:'ready', label:'READY', count:0, evidence:[] };
    const blocked = blockers.some(severeText);
    return { ...area, state:blocked ? 'blocked' : 'action', label:blocked ? 'BLOCKED' : 'ACTION', count:blockers.length, evidence:blockers };
  }

  function acceptanceSnapshot() {
    const accountingStatus = statusSnapshot();
    const areas = BLOCKER_AREAS.map((area) => classifyArea(area, accountingStatus));
    if (!accountingStatus.loaded) return { state:'open', label:'OPEN TO LOAD', areas };
    if (areas.some((area) => area.state === 'blocked')) return { state:'blocked', label:'ACCOUNTING BLOCKED', areas };
    if (areas.some((area) => area.state === 'action' || area.state === 'open')) return { state:'action', label:'ACTION REQUIRED', areas };
    return { state:'ready', label:'ACCOUNTING GREEN', areas };
  }

  function metrics() {
    return [
      ['Close steps', countRows('#ad_close_wizard_detail_table tbody tr', /no .*loaded|no close|no steps/i)],
      ['Orders', countRows('#ad_orders_table tbody tr', /no .*loaded|no orders/i)],
      ['Accounting entries', countRows('#ad_accounting_table tbody tr', /no .*loaded|no accounting|no entries/i)],
      ['Finance tasks', financeTaskCount()]
    ];
  }

  function summaryText() {
    return String(document.getElementById('ad_close_center_summary')?.textContent || '').trim();
  }

  function createWorkspace() {
    let host = document.getElementById(WORKSPACE_ID);
    if (host) return host;
    const heading = document.getElementById('ad_hub_workspace_heading');
    if (!heading) return null;
    host = document.createElement('section');
    host.id = WORKSPACE_ID;
    host.dataset.build = String(BUILD);
    host.setAttribute('aria-labelledby', 'adminFinanceWorkspaceTitle');
    heading.insertAdjacentElement('afterend', host);
    host.addEventListener('click', (event) => {
      const route = event.target.closest('[data-admin-finance-route]')?.getAttribute('data-admin-finance-route');
      if (route) {
        window.YWIRouter?.showSection?.(route);
        return;
      }
      const quick = event.target.closest('[data-admin-finance-panel]');
      if (quick) {
        window.YWIAdminHub?.open?.('accounting', { panelTitle:quick.getAttribute('data-admin-finance-panel') || '' });
        return;
      }
      if (event.target.closest('#adminFinanceRefresh')) {
        const button = document.getElementById('ad_accounting_refresh_panel');
        if (button && !button.disabled) button.click();
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(render, 80);
      }
    });
    return host;
  }

  function blockerCard(area) {
    const destination = area.route
      ? `data-admin-finance-route="${esc(area.route)}"`
      : `data-admin-finance-panel="${esc(area.panel || 'Admin Task Inbox')}"`;
    const evidence = area.evidence?.[0] ? `<div class="admin-finance-blocker-evidence"><strong>Evidence:</strong> ${esc(area.evidence[0])}</div>` : '';
    return `<article class="admin-finance-blocker" data-finance-blocker="${esc(area.key)}">
      <div class="admin-finance-blocker-top"><h5>${esc(area.title)}</h5><span class="admin-finance-status" data-state="${esc(area.state)}">${esc(area.label)}${area.count ? ` · ${area.count}` : ''}</span></div>
      <div class="admin-finance-blocker-meta"><small><strong>Owner:</strong> ${esc(area.owner)}</small><small><strong>Corrective action:</strong> ${esc(area.action)}</small><button type="button" class="secondary" ${destination}>Open review</button></div>
      ${evidence}
    </article>`;
  }

  function render() {
    if (applying) return;
    applying = true;
    try {
      injectStyles();
      const host = createWorkspace();
      if (!host) return;
      host.hidden = !isActive();
      if (host.hidden) return;
      const status = statusSnapshot();
      const acceptance = acceptanceSnapshot();
      const metricRows = metrics();
      const summary = summaryText();
      const blockerCount = acceptance.areas.reduce((count, area) => count + (area.state === 'ready' ? 0 : 1), 0);
      host.innerHTML = `
        <div class="admin-finance-head">
          <div><span class="module-kicker">Build ${BUILD} · Finance acceptance command center</span><h3 id="adminFinanceWorkspaceTitle">Finance &amp; Accounting</h3><p><strong>What prevents accounting from being GREEN?</strong> This view consolidates already-loaded Finance/Admin evidence into one fail-closed review list. It does not enable posting, payments, provider mutation, mapping approval, or a new Finance write path.</p></div>
          <span class="admin-finance-status" data-state="${esc(acceptance.state)}">${esc(acceptance.label)}</span>
        </div>
        <div class="admin-finance-metrics" aria-label="Currently loaded finance and accounting counts">${metricRows.map(([label,value]) => `<div class="admin-finance-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>
        <div class="admin-finance-context"><strong>Close review context:</strong> ${esc(summary || 'No bounded close-center summary is currently loaded.')}<br><small>${blockerCount} acceptance area${blockerCount === 1 ? '' : 's'} currently require loading, review, or correction. Unknown evidence never produces GREEN.</small></div>
        <section class="admin-finance-blockers" aria-labelledby="adminFinanceBlockersTitle">
          <div class="admin-finance-blockers-head"><div><h4 id="adminFinanceBlockersTitle">Accounting GREEN blockers</h4><small>Severity · owner · corrective action · existing review destination</small></div><span class="admin-finance-status" data-state="${esc(status.state)}">Accounting evidence: ${esc(status.label)}</span></div>
          <div class="admin-finance-blocker-list">${acceptance.areas.map(blockerCard).join('')}</div>
        </section>
        <div class="admin-finance-grid">${QUICK_LINKS.map((item) => `<button type="button" class="admin-finance-card" data-admin-finance-key="${esc(item.key)}" data-admin-finance-panel="${esc(item.panel)}"><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></button>`).join('')}</div>
        <div class="admin-finance-actions"><button id="adminFinanceRefresh" type="button" class="secondary">Refresh accounting evidence</button><button type="button" class="secondary" data-admin-finance-panel="Guided Close Center">Open Guided Close Center</button><button type="button" class="secondary" data-admin-finance-route="finance">Open Finance module</button></div>
      `;
    } finally {
      applying = false;
    }
  }

  function start() {
    injectStyles();
    render();
    observer = new MutationObserver(() => {
      if (applying) return;
      queueMicrotask(render);
    });
    [
      'ad_hub_breadcrumb','ad_accounting_age_badge','ad_close_center_summary','ad_close_wizard_detail_table',
      'ad_orders_table','ad_accounting_table','ad_task_table','ad_accounting_close_control_table',
      'ad_reconciliation_exception_resolution_table','ad_reconciliation_match_workbench_table','ad_accounting_exception_closure_table',
      'ad_payment_exception_decision_table','ad_payment_adjustment_workflow_table','ad_payment_application_ui_queue_table',
      'ad_payment_write_path_table','ad_payment_posting_proof_table','ad_bank_csv_import_table','ad_reconciliation_import_validation_table'
    ].map((id) => document.getElementById(id)).filter(Boolean).forEach((node) => observer.observe(node, {
      subtree:true,
      childList:true,
      characterData:true,
      attributes:true,
      attributeFilter:['data-status']
    }));
    window.addEventListener('ywi:route-shown', render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();

  window.YWIAdminFinanceWorkspace = Object.freeze({ render, build:BUILD });
})();
