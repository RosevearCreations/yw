/* File: js/admin-finance-workspace.js
   Build 236 Finance & Accounting workspace.
   Presentation-only operator layer over existing Admin accounting authority.
   It summarizes already-rendered close/order/accounting/task state, reuses the existing
   accounting refresh, and drills into existing Admin panels. It creates no API, posting,
   payment, provider, or database authority.
*/

'use strict';

(function () {
  const BUILD = 236;
  const WORKSPACE_ID = 'adminFinanceWorkspace';
  const STYLE_ID = 'adminFinanceWorkspaceStyles';
  const LABEL = 'Finance & Accounting';
  const QUICK_LINKS = Object.freeze([
    { key:'close', title:'Close, Tax & Remittance', note:'Open the existing Guided Close Center for period blockers, reconciliation, tax/remittance review and accountant-package delivery.', panel:'Guided Close Center' },
    { key:'orders', title:'Orders & Accounting Intake', note:'Review the existing order and first-accounting-record workflow without creating another accounting data authority.', panel:'Orders and Accounting Stub' },
    { key:'backbone', title:'Operational Accounting', note:'Open the existing operations/accounting backbone for shared job, purchasing, material and accounting context.', panel:'Operations and Accounting Backbone Manager' },
    { key:'tasks', title:'Finance Task Inbox', note:'Review already-loaded Admin tasks that require accounting, close, reconciliation, tax, payroll or banking follow-up.', panel:'Admin Task Inbox' }
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
      #${WORKSPACE_ID}[hidden]{display:none!important}.admin-finance-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.admin-finance-head h3{margin:2px 0 5px}.admin-finance-head p{margin:0;max-width:800px;color:#cbd5e1;line-height:1.45}.admin-finance-status{display:inline-flex;align-items:center;min-height:30px;padding:4px 9px;border:1px solid rgba(148,163,184,.28);border-radius:999px;font-size:.75rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.admin-finance-status[data-state="ready"]{border-color:rgba(52,211,153,.45);color:#d7ffe9}.admin-finance-status[data-state="action"]{border-color:rgba(251,191,36,.48);color:#fff3c4}.admin-finance-status[data-state="blocked"]{border-color:rgba(248,113,113,.5);color:#fee2e2}.admin-finance-status[data-state="open"]{color:#bfdbfe;border-color:rgba(96,165,250,.4)}
      .admin-finance-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin:14px 0}.admin-finance-metric{padding:10px 11px;border-radius:12px;background:rgba(30,41,59,.72);border:1px solid rgba(148,163,184,.16)}.admin-finance-metric span,.admin-finance-metric strong{display:block}.admin-finance-metric span{font-size:.75rem;color:#aebdd0}.admin-finance-metric strong{margin-top:4px;font-size:1.08rem}.admin-finance-context{margin:10px 0 14px;padding:11px 12px;border-radius:12px;background:rgba(148,163,184,.07);color:#cbd5e1;line-height:1.45}
      .admin-finance-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-finance-card{text-align:left;min-width:0;padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(15,23,42,.72);color:inherit;cursor:pointer}.admin-finance-card:hover,.admin-finance-card:focus-visible{border-color:rgba(250,204,21,.58)}.admin-finance-card strong,.admin-finance-card small{display:block}.admin-finance-card small{margin-top:5px;color:#b9c8dc;line-height:1.4}.admin-finance-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:680px){.admin-finance-grid{grid-template-columns:1fr}.admin-finance-actions>*{flex:1 1 150px}}
    `;
    document.head.appendChild(style);
  }

  function statusSnapshot() {
    const badge = document.getElementById('ad_accounting_age_badge');
    const status = String(badge?.dataset?.status || '').toLowerCase();
    const text = String(badge?.textContent || '').trim();
    if (status === 'ok' || /ready|current|live/i.test(text)) return { label:'CURRENT', state:'ready' };
    if (status === 'error' || /fail|blocked|error/i.test(text)) return { label:'BLOCKED', state:'blocked' };
    if (/warning|review|overdue|action/i.test(text)) return { label:'NEEDS REVIEW', state:'action' };
    return { label:'LOADED ON DEMAND', state:'open' };
  }

  function countRows(selector, emptyPattern) {
    return [...document.querySelectorAll(selector)]
      .filter((row) => row.cells?.length && !(emptyPattern || /no .*loaded|no .*items/i).test(row.textContent || '')).length;
  }

  function financeTaskCount() {
    return [...document.querySelectorAll('#ad_task_table tbody tr')]
      .filter((row) => row.cells?.length && /account|finance|close|reconcil|tax|payroll|bank|payment|journal/i.test(row.textContent || ''))
      .length;
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
      const rows = metrics();
      const summary = summaryText();
      host.innerHTML = `
        <div class="admin-finance-head">
          <div><span class="module-kicker">Build ${BUILD} · focused Admin workspace</span><h3 id="adminFinanceWorkspaceTitle">Finance &amp; Accounting</h3><p>Start with bounded close and accounting status, then open only the established Admin control needed for review. This presentation does not enable posting, payments, provider mutation, or a new Finance write path.</p></div>
          <span class="admin-finance-status" data-state="${esc(status.state)}">${esc(status.label)}</span>
        </div>
        <div class="admin-finance-metrics" aria-label="Currently loaded finance and accounting counts">${rows.map(([label,value]) => `<div class="admin-finance-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>
        <div class="admin-finance-context"><strong>Close review context:</strong> ${esc(summary || 'No bounded close-center summary is currently loaded.')}</div>
        <div class="admin-finance-grid">${QUICK_LINKS.map((item) => `<button type="button" class="admin-finance-card" data-admin-finance-key="${esc(item.key)}" data-admin-finance-panel="${esc(item.panel)}"><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></button>`).join('')}</div>
        <div class="admin-finance-actions"><button id="adminFinanceRefresh" type="button" class="secondary">Refresh accounting</button><button type="button" class="secondary" data-admin-finance-panel="Guided Close Center">Open Guided Close Center</button></div>
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
      document.getElementById('ad_hub_breadcrumb'),
      document.getElementById('ad_accounting_age_badge'),
      document.getElementById('ad_close_center_summary'),
      document.getElementById('ad_close_wizard_detail_table'),
      document.getElementById('ad_orders_table'),
      document.getElementById('ad_accounting_table'),
      document.getElementById('ad_task_table')
    ].filter(Boolean).forEach((node) => observer.observe(node, {
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
