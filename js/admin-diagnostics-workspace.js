/* File: js/admin-diagnostics-workspace.js
   Build 237 Diagnostics & Integrations workspace.
   Presentation-only operator layer over existing Admin health, smoke, conflict and
   notification authorities. It summarizes already-rendered bounded state, reuses the
   existing health refresh, and drills into existing Admin panels. It creates no API,
   integration-write, notification-delivery, provider, or database authority.
*/

'use strict';

(function () {
  const BUILD = 237;
  const WORKSPACE_ID = 'adminDiagnosticsWorkspace';
  const STYLE_ID = 'adminDiagnosticsWorkspaceStyles';
  const LABEL = 'Diagnostics & Integrations';
  const QUICK_LINKS = Object.freeze([
    { key:'health', title:'Health & Schema Signals', note:'Open the existing App Health and Schema Center for frontend/API issues, backend alerts, schema markers and fallback status.', panel:'App Health and Schema Center' },
    { key:'smoke', title:'Deploy Smoke Check', note:'Open the established smoke-check panel for shell, runtime-config, startup and bootstrap verification.', panel:'Deploy Smoke Check' },
    { key:'conflicts', title:'Sync Conflict Review', note:'Review already-queued Admin synchronization conflicts and use the existing retry/keep/discard controls.', panel:'Conflict Review' },
    { key:'approvals', title:'Approvals & Notifications', note:'Open the existing approval queue for notification review, delivery status and established email actions.', panel:'Approval Queue' }
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
      #${WORKSPACE_ID}{margin:12px 0 16px;padding:16px;border:1px solid rgba(96,165,250,.25);border-radius:16px;background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(15,23,42,.68))}
      #${WORKSPACE_ID}[hidden]{display:none!important}.admin-diagnostics-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.admin-diagnostics-head h3{margin:2px 0 5px}.admin-diagnostics-head p{margin:0;max-width:820px;color:#cbd5e1;line-height:1.45}.admin-diagnostics-status{display:inline-flex;align-items:center;min-height:30px;padding:4px 9px;border:1px solid rgba(148,163,184,.28);border-radius:999px;font-size:.75rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.admin-diagnostics-status[data-state="ready"]{border-color:rgba(52,211,153,.45);color:#d7ffe9}.admin-diagnostics-status[data-state="action"]{border-color:rgba(251,191,36,.48);color:#fff3c4}.admin-diagnostics-status[data-state="blocked"]{border-color:rgba(248,113,113,.5);color:#fee2e2}.admin-diagnostics-status[data-state="open"]{color:#bfdbfe;border-color:rgba(96,165,250,.4)}
      .admin-diagnostics-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin:14px 0}.admin-diagnostics-metric{padding:10px 11px;border-radius:12px;background:rgba(30,41,59,.72);border:1px solid rgba(148,163,184,.16)}.admin-diagnostics-metric span,.admin-diagnostics-metric strong{display:block}.admin-diagnostics-metric span{font-size:.75rem;color:#aebdd0}.admin-diagnostics-metric strong{margin-top:4px;font-size:1.08rem}.admin-diagnostics-context{display:grid;gap:8px;margin:10px 0 14px}.admin-diagnostics-context div{padding:11px 12px;border-radius:12px;background:rgba(148,163,184,.07);color:#cbd5e1;line-height:1.45}
      .admin-diagnostics-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-diagnostics-card{text-align:left;min-width:0;padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(15,23,42,.72);color:inherit;cursor:pointer}.admin-diagnostics-card:hover,.admin-diagnostics-card:focus-visible{border-color:rgba(96,165,250,.58)}.admin-diagnostics-card strong,.admin-diagnostics-card small{display:block}.admin-diagnostics-card small{margin-top:5px;color:#b9c8dc;line-height:1.4}.admin-diagnostics-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:680px){.admin-diagnostics-grid{grid-template-columns:1fr}.admin-diagnostics-actions>*{flex:1 1 150px}}
    `;
    document.head.appendChild(style);
  }

  function statusSnapshot() {
    const badge = document.getElementById('ad_health_age_badge');
    const status = String(badge?.dataset?.status || '').toLowerCase();
    const text = String(badge?.textContent || '').trim();
    if (status === 'ok' || /ready|current|live/i.test(text)) return { label:'CURRENT', state:'ready' };
    if (status === 'error' || /fail|blocked|error/i.test(text)) return { label:'BLOCKED', state:'blocked' };
    if (/warning|review|overdue|action/i.test(`${status} ${text}`)) return { label:'NEEDS REVIEW', state:'action' };
    return { label:'LOADED ON DEMAND', state:'open' };
  }

  function countRows(selector, emptyPattern) {
    return [...document.querySelectorAll(selector)]
      .filter((row) => row.cells?.length && !(emptyPattern || /no .*loaded|no .*items/i).test(row.textContent || '')).length;
  }

  function actionNotificationCount() {
    return [...document.querySelectorAll('#ad_notifications_table tbody tr')]
      .filter((row) => row.cells?.length && /pending|review|failed|dead.?letter|queued|retry|approval/i.test(row.textContent || ''))
      .length;
  }

  function metrics() {
    return [
      ['Health signals', countRows('#ad_health_table tbody tr', /no .*loaded|no health|no issues/i)],
      ['Smoke checks', countRows('#ad_smoke_table tbody tr', /no .*loaded|no smoke|no checks/i)],
      ['Sync conflicts', countRows('#ad_conflicts_table tbody tr', /no .*loaded|no conflicts/i)],
      ['Action notifications', actionNotificationCount()]
    ];
  }

  function contextText(id, fallback) {
    return String(document.getElementById(id)?.textContent || '').trim() || fallback;
  }

  function createWorkspace() {
    let host = document.getElementById(WORKSPACE_ID);
    if (host) return host;
    const heading = document.getElementById('ad_hub_workspace_heading');
    if (!heading) return null;
    host = document.createElement('section');
    host.id = WORKSPACE_ID;
    host.dataset.build = String(BUILD);
    host.setAttribute('aria-labelledby', 'adminDiagnosticsWorkspaceTitle');
    heading.insertAdjacentElement('afterend', host);
    host.addEventListener('click', (event) => {
      const quick = event.target.closest('[data-admin-diagnostics-panel]');
      if (quick) {
        window.YWIAdminHub?.open?.('messaging', { panelTitle:quick.getAttribute('data-admin-diagnostics-panel') || '' });
        return;
      }
      if (event.target.closest('#adminDiagnosticsRefresh')) {
        const button = document.getElementById('ad_health_refresh_panel');
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
      const healthSummary = contextText('ad_health_summary', 'No bounded health summary is currently loaded.');
      const smokeSummary = contextText('ad_smoke_summary', 'No bounded smoke-check summary is currently loaded.');
      host.innerHTML = `
        <div class="admin-diagnostics-head">
          <div><span class="module-kicker">Build ${BUILD} · focused Admin workspace</span><h3 id="adminDiagnosticsWorkspaceTitle">Diagnostics &amp; Integrations</h3><p>Start with bounded health, smoke, conflict and notification state, then open only the established Admin control needed for investigation. This presentation does not run integrations, deliver notifications, mutate providers, or create a new data/write path.</p></div>
          <span class="admin-diagnostics-status" data-state="${esc(status.state)}">${esc(status.label)}</span>
        </div>
        <div class="admin-diagnostics-metrics" aria-label="Currently loaded diagnostics and integration counts">${rows.map(([label,value]) => `<div class="admin-diagnostics-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>
        <div class="admin-diagnostics-context"><div><strong>Health context:</strong> ${esc(healthSummary)}</div><div><strong>Smoke context:</strong> ${esc(smokeSummary)}</div></div>
        <div class="admin-diagnostics-grid">${QUICK_LINKS.map((item) => `<button type="button" class="admin-diagnostics-card" data-admin-diagnostics-key="${esc(item.key)}" data-admin-diagnostics-panel="${esc(item.panel)}"><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></button>`).join('')}</div>
        <div class="admin-diagnostics-actions"><button id="adminDiagnosticsRefresh" type="button" class="secondary">Refresh health</button><button type="button" class="secondary" data-admin-diagnostics-panel="App Health and Schema Center">Open Health &amp; Schema Center</button></div>
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
      document.getElementById('ad_health_age_badge'),
      document.getElementById('ad_health_summary'),
      document.getElementById('ad_health_table'),
      document.getElementById('ad_smoke_summary'),
      document.getElementById('ad_smoke_table'),
      document.getElementById('ad_conflict_summary'),
      document.getElementById('ad_conflicts_table'),
      document.getElementById('ad_notifications_table')
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

  window.YWIAdminDiagnosticsWorkspace = Object.freeze({ render, build:BUILD });
})();
