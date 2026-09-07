/* File: js/admin-safety-workspace.js
   Build 235 Safety & Evidence workspace.
   Presentation-only operator layer over existing Admin safety/evidence authority.
   It summarizes already-rendered evidence state, reuses the existing evidence refresh,
   and drills into existing Admin panels. It creates no API or write authority.
*/

'use strict';

(function () {
  const BUILD = 235;
  const WORKSPACE_ID = 'adminSafetyWorkspace';
  const STYLE_ID = 'adminSafetyWorkspaceStyles';
  const LABEL = 'Safety & Evidence';
  const QUICK_LINKS = Object.freeze([
    { key:'evidence', title:'Evidence Review', note:'Review evidence status, ownership, attendance proof and HSE proof using the existing Evidence Manager.', panel:'Evidence Manager' },
    { key:'ohsa', title:'Ontario Safety Hub', note:'Open toolbox talks, hazard workflows, incident controls and Ontario OHSA-aware safety administration.', panel:'Ontario OHSA / Workplace Safety Hub' },
    { key:'actions', title:'Corrective Follow-up', note:'Use the existing evidence action queue for unresolved, assigned or overdue safety follow-up.', panel:'Evidence Manager' },
    { key:'linked', title:'Linked HSE & Operations', note:'Review linked HSE packets and operational context without creating another safety data authority.', panel:'Operations and Accounting Backbone Manager' }
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
      #${WORKSPACE_ID}{margin:12px 0 16px;padding:16px;border:1px solid rgba(52,211,153,.26);border-radius:16px;background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(15,23,42,.68))}
      #${WORKSPACE_ID}[hidden]{display:none!important}.admin-safety-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.admin-safety-head h3{margin:2px 0 5px}.admin-safety-head p{margin:0;max-width:780px;color:#cbd5e1;line-height:1.45}.admin-safety-status{display:inline-flex;align-items:center;min-height:30px;padding:4px 9px;border:1px solid rgba(148,163,184,.28);border-radius:999px;font-size:.75rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.admin-safety-status[data-state="ready"]{border-color:rgba(52,211,153,.45);color:#d7ffe9}.admin-safety-status[data-state="action"]{border-color:rgba(251,191,36,.45);color:#fff3c4}.admin-safety-status[data-state="blocked"]{border-color:rgba(248,113,113,.5);color:#fee2e2}.admin-safety-status[data-state="open"]{color:#bfdbfe;border-color:rgba(96,165,250,.4)}
      .admin-safety-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin:14px 0}.admin-safety-metric{padding:10px 11px;border-radius:12px;background:rgba(30,41,59,.72);border:1px solid rgba(148,163,184,.16)}.admin-safety-metric span,.admin-safety-metric strong{display:block}.admin-safety-metric span{font-size:.75rem;color:#aebdd0}.admin-safety-metric strong{margin-top:4px;font-size:1.08rem}.admin-safety-context{margin:10px 0 14px;padding:11px 12px;border-radius:12px;background:rgba(148,163,184,.07);color:#cbd5e1;line-height:1.45}
      .admin-safety-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-safety-card{text-align:left;min-width:0;padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(15,23,42,.72);color:inherit;cursor:pointer}.admin-safety-card:hover,.admin-safety-card:focus-visible{border-color:rgba(52,211,153,.62)}.admin-safety-card strong,.admin-safety-card small{display:block}.admin-safety-card small{margin-top:5px;color:#b9c8dc;line-height:1.4}.admin-safety-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:680px){.admin-safety-grid{grid-template-columns:1fr}.admin-safety-actions>*{flex:1 1 150px}}
    `;
    document.head.appendChild(style);
  }

  function statusSnapshot() {
    const badge = document.getElementById('ad_evidence_age_badge');
    const status = String(badge?.dataset?.status || '').toLowerCase();
    const text = String(badge?.textContent || '').trim();
    if (status === 'ok' || /ready|current|live/i.test(text)) return { label:'CURRENT', state:'ready' };
    if (status === 'error' || /fail|blocked|error/i.test(text)) return { label:'BLOCKED', state:'blocked' };
    if (/warning|review|overdue|action/i.test(text)) return { label:'NEEDS REVIEW', state:'action' };
    return { label:'LOADED ON DEMAND', state:'open' };
  }

  function countRows(selector) {
    return [...document.querySelectorAll(selector)]
      .filter((row) => row.cells?.length && !/no .*loaded|no .*items|no evidence/i.test(row.textContent || '')).length;
  }

  function metrics() {
    return [
      ['Evidence records', countRows('#ad_evidence_manager_table tbody tr')],
      ['Corrective actions', countRows('#ad_evidence_action_queue_table tbody tr')],
      ['Attendance proof', countRows('#ad_attendance_evidence_table tbody tr')],
      ['HSE proof', countRows('#ad_hse_evidence_table tbody tr')]
    ];
  }

  function summaryText() {
    return String(document.getElementById('ad_evidence_summary')?.textContent || '').trim();
  }

  function createWorkspace() {
    let host = document.getElementById(WORKSPACE_ID);
    if (host) return host;
    const heading = document.getElementById('ad_hub_workspace_heading');
    if (!heading) return null;
    host = document.createElement('section');
    host.id = WORKSPACE_ID;
    host.dataset.build = String(BUILD);
    host.setAttribute('aria-labelledby', 'adminSafetyWorkspaceTitle');
    heading.insertAdjacentElement('afterend', host);
    host.addEventListener('click', (event) => {
      const quick = event.target.closest('[data-admin-safety-panel]');
      if (quick) {
        window.YWIAdminHub?.open?.('safety', { panelTitle:quick.getAttribute('data-admin-safety-panel') || '' });
        return;
      }
      if (event.target.closest('#adminSafetyRefresh')) {
        const button = document.getElementById('ad_evidence_refresh_panel');
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
        <div class="admin-safety-head">
          <div><span class="module-kicker">Build ${BUILD} · focused Admin workspace</span><h3 id="adminSafetyWorkspaceTitle">Safety &amp; Evidence</h3><p>Start with bounded safety/evidence status, then open only the established safety control required for review or follow-up. Existing permissions and write paths remain authoritative.</p></div>
          <span class="admin-safety-status" data-state="${esc(status.state)}">${esc(status.label)}</span>
        </div>
        <div class="admin-safety-metrics" aria-label="Currently loaded safety evidence counts">${rows.map(([label,value]) => `<div class="admin-safety-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>
        <div class="admin-safety-context"><strong>Evidence review context:</strong> ${esc(summary || 'No bounded evidence-review summary is currently loaded.')}</div>
        <div class="admin-safety-grid">${QUICK_LINKS.map((item) => `<button type="button" class="admin-safety-card" data-admin-safety-key="${esc(item.key)}" data-admin-safety-panel="${esc(item.panel)}"><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></button>`).join('')}</div>
        <div class="admin-safety-actions"><button id="adminSafetyRefresh" type="button" class="secondary">Refresh evidence</button><button type="button" class="secondary" data-admin-safety-panel="Evidence Manager">Open full Evidence Manager</button></div>
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
      document.getElementById('ad_evidence_age_badge'),
      document.getElementById('ad_evidence_summary'),
      document.getElementById('ad_evidence_manager_table'),
      document.getElementById('ad_evidence_action_queue_table'),
      document.getElementById('ad_attendance_evidence_table'),
      document.getElementById('ad_hse_evidence_table')
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

  window.YWIAdminSafetyWorkspace = Object.freeze({ render, build:BUILD });
})();
