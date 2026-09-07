/* File: js/admin-operations-workspace.js
   Build 234 Business & Operations workspace.
   Presentation-only operator layer over the existing Admin operations authority.
   It reads already-rendered bounded Admin evidence, reuses the existing operations refresh,
   and drills into existing Admin panels. It does not call an API or create a new write path.
*/

'use strict';

(function () {
  const BUILD = 234;
  const STYLE_ID = 'adminOperationsWorkspaceStyles';
  const WORKSPACE_ID = 'adminOperationsWorkspace';
  const OPERATIONS_LABEL = 'Business & Operations';
  const QUICK_LINKS = Object.freeze([
    {
      key:'jobs',
      title:'Jobs, Sites & Clients',
      note:'Open the existing operations backbone for jobs, service areas, clients, sites and operating records.',
      panel:'Operations and Accounting Backbone Manager'
    },
    {
      key:'routes',
      title:'Routes & Work Orders',
      note:'Work with routes, route stops, estimates, work orders and execution context through the existing backbone.',
      panel:'Operations and Accounting Backbone Manager'
    },
    {
      key:'catalog',
      title:'Catalog & Configuration',
      note:'Open shared dropdown, catalog and operating configuration controls without loading another Admin domain.',
      panel:'Dropdown and Catalog Manager'
    },
    {
      key:'inbox',
      title:'Operations Inbox',
      note:'Review currently loaded Admin tasks that may need operating follow-up.',
      panel:'Admin Task Inbox'
    }
  ]);

  let applying = false;
  let observer = null;
  let refreshTimer = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function currentWorkspaceLabel() {
    return String(document.querySelector('#ad_hub_breadcrumb strong')?.textContent || '').trim();
  }

  function isActive() {
    return currentWorkspaceLabel() === OPERATIONS_LABEL;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${WORKSPACE_ID}{margin:12px 0 16px;padding:16px;border:1px solid rgba(96,165,250,.25);border-radius:16px;background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(15,23,42,.68))}
      #${WORKSPACE_ID}[hidden]{display:none!important}.admin-ops-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.admin-ops-head h3{margin:2px 0 5px}.admin-ops-head p{margin:0;max-width:760px;color:#cbd5e1;line-height:1.45}.admin-ops-status{display:inline-flex;align-items:center;min-height:30px;padding:4px 9px;border:1px solid rgba(148,163,184,.28);border-radius:999px;font-size:.75rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.admin-ops-status[data-state="ready"]{border-color:rgba(52,211,153,.4);color:#d7ffe9}.admin-ops-status[data-state="action"]{border-color:rgba(251,191,36,.45);color:#fff3c4}.admin-ops-status[data-state="open"]{color:#bfdbfe;border-color:rgba(96,165,250,.4)}
      .admin-ops-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;margin:14px 0}.admin-ops-metric{padding:10px 11px;border-radius:12px;background:rgba(30,41,59,.72);border:1px solid rgba(148,163,184,.16)}.admin-ops-metric span,.admin-ops-metric strong{display:block}.admin-ops-metric span{font-size:.75rem;color:#aebdd0}.admin-ops-metric strong{margin-top:4px;font-size:1.08rem}.admin-ops-context{margin:10px 0 14px;padding:11px 12px;border-radius:12px;background:rgba(148,163,184,.07);color:#cbd5e1;line-height:1.45}
      .admin-ops-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-ops-card{text-align:left;min-width:0;padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(15,23,42,.72);color:inherit;cursor:pointer}.admin-ops-card:hover,.admin-ops-card:focus-visible{border-color:rgba(96,165,250,.65)}.admin-ops-card strong,.admin-ops-card small{display:block}.admin-ops-card small{margin-top:5px;color:#b9c8dc;line-height:1.4}.admin-ops-task-list{display:grid;gap:6px;margin-top:12px}.admin-ops-task{padding:8px 9px;border-radius:9px;background:rgba(30,41,59,.62);font-size:.86rem;color:#d7e1ee}.admin-ops-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:680px){.admin-ops-grid{grid-template-columns:1fr}.admin-ops-actions>*{flex:1 1 150px}}
    `;
    document.head.appendChild(style);
  }

  function statusSnapshot() {
    const badge = document.getElementById('ad_jobs_age_badge');
    const status = String(badge?.dataset?.status || '').toLowerCase();
    const text = String(badge?.textContent || '').trim();
    if (status === 'ok' || /ready|current|live/i.test(text)) return { label:'CURRENT', state:'ready' };
    if (status === 'error' || /fail|blocked|error/i.test(text)) return { label:'NEEDS REVIEW', state:'action' };
    if (text && !/not loaded/i.test(text)) return { label:text.slice(0,40), state:'action' };
    return { label:'LOADED ON DEMAND', state:'open' };
  }

  function metricRows() {
    return [...document.querySelectorAll('#ad_ops_dashboard_cards .admin-stat-card')]
      .slice(0, 6)
      .map((node) => ({
        label:String(node.querySelector('span')?.textContent || '').trim(),
        value:String(node.querySelector('strong')?.textContent || '').trim()
      }))
      .filter((row) => row.label || row.value);
  }

  function taskRows() {
    return [...document.querySelectorAll('#ad_task_table tbody tr')]
      .filter((row) => row.cells?.length && !/no .*loaded|no tasks/i.test(row.textContent || ''))
      .slice(0, 3)
      .map((row) => [...row.cells].slice(0, 3).map((cell) => cell.textContent.trim()).filter(Boolean).join(' · '));
  }

  function activityText() {
    return String(document.getElementById('ad_site_activity_summary')?.textContent || '').trim();
  }

  function createWorkspace() {
    let host = document.getElementById(WORKSPACE_ID);
    if (host) return host;
    const heading = document.getElementById('ad_hub_workspace_heading');
    if (!heading) return null;
    host = document.createElement('section');
    host.id = WORKSPACE_ID;
    host.dataset.build = String(BUILD);
    host.setAttribute('aria-labelledby', 'adminOperationsWorkspaceTitle');
    heading.insertAdjacentElement('afterend', host);
    host.addEventListener('click', (event) => {
      const quick = event.target.closest('[data-admin-ops-panel]');
      if (quick) {
        window.YWIAdminHub?.open?.('operations', { panelTitle:quick.getAttribute('data-admin-ops-panel') || '' });
        return;
      }
      if (event.target.closest('#adminOperationsRefresh')) {
        const button = document.getElementById('ad_jobs_refresh_panel');
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
      const metrics = metricRows();
      const tasks = taskRows();
      const activity = activityText();
      host.innerHTML = `
        <div class="admin-ops-head">
          <div><span class="module-kicker">Build ${BUILD} · focused Admin workspace</span><h3 id="adminOperationsWorkspaceTitle">Business &amp; Operations</h3><p>Start with bounded operating status, then open only the existing Admin control you need. This workspace does not add a new data authority or write path.</p></div>
          <span class="admin-ops-status" data-state="${esc(status.state)}">${esc(status.label)}</span>
        </div>
        <div class="admin-ops-metrics" aria-label="Currently loaded operations metrics">${metrics.length ? metrics.map((row) => `<div class="admin-ops-metric"><span>${esc(row.label)}</span><strong>${esc(row.value || '0')}</strong></div>`).join('') : '<div class="admin-ops-metric"><span>Operations summary</span><strong>Open to load</strong></div>'}</div>
        <div class="admin-ops-context"><strong>Recent operating context:</strong> ${esc(activity || 'No bounded site-activity summary is currently loaded.')}</div>
        <div class="admin-ops-grid">${QUICK_LINKS.map((item) => `<button type="button" class="admin-ops-card" data-admin-ops-key="${esc(item.key)}" data-admin-ops-panel="${esc(item.panel)}"><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></button>`).join('')}</div>
        <div class="admin-ops-task-list" aria-label="Currently loaded Admin tasks">${tasks.length ? tasks.map((task) => `<div class="admin-ops-task">${esc(task)}</div>`).join('') : '<div class="admin-ops-task">No currently loaded Admin task requires display here.</div>'}</div>
        <div class="admin-ops-actions"><button id="adminOperationsRefresh" type="button" class="secondary">Refresh operations</button><button type="button" class="secondary" data-admin-ops-panel="Operations and Accounting Backbone Manager">Open full operations backbone</button></div>
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
      document.getElementById('ad_jobs_age_badge'),
      document.getElementById('ad_ops_dashboard_cards'),
      document.getElementById('ad_site_activity_summary'),
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

  window.YWIAdminOperationsWorkspace = Object.freeze({ render, build:BUILD });
})();
