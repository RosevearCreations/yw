/* File: js/admin-audit-security-workspace.js
   Build 238 Audit & Security workspace.
   Presentation-only operator layer over existing Admin readiness, permissions, deployment,
   backup/restore and audit authorities. It summarizes already-rendered bounded state, reuses
   the existing health/readiness refresh, and navigates existing Admin evidence. It creates no
   API, permission-write, deployment, restore, security-setting, or database authority.
*/

'use strict';

(function () {
  const BUILD = 238;
  const WORKSPACE_ID = 'adminAuditSecurityWorkspace';
  const STYLE_ID = 'adminAuditSecurityWorkspaceStyles';
  const LABEL = 'Audit & Security';
  const PANEL = 'Production Readiness and Permissions';
  const QUICK_LINKS = Object.freeze([
    { key:'readiness', title:'Readiness & Security Checks', note:'Review the existing production-readiness and schema-preflight evidence before treating a release as ready.', panel:PANEL, target:'ad_readiness_table' },
    { key:'permissions', title:'Role & Action Permissions', note:'Inspect the established role and action-permission evidence without creating another access-control authority.', panel:PANEL, target:'ad_permissions_table' },
    { key:'deployment', title:'Deployment & Recovery Gates', note:'Review deployment-gate state and backup/restore rehearsal evidence using the existing Admin readiness controls.', panel:PANEL, target:'ad_deployment_gate_table' },
    { key:'audit', title:'Audit History', note:'Open the existing administrative audit trail for recent actor, action, entity and summary evidence.', panel:PANEL, target:'ad_audit_log_table' }
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
      #${WORKSPACE_ID}{margin:12px 0 16px;padding:16px;border:1px solid rgba(167,139,250,.26);border-radius:16px;background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(15,23,42,.68))}
      #${WORKSPACE_ID}[hidden]{display:none!important}.admin-audit-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.admin-audit-head h3{margin:2px 0 5px}.admin-audit-head p{margin:0;max-width:830px;color:#cbd5e1;line-height:1.45}.admin-audit-status{display:inline-flex;align-items:center;min-height:30px;padding:4px 9px;border:1px solid rgba(148,163,184,.28);border-radius:999px;font-size:.75rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.admin-audit-status[data-state="ready"]{border-color:rgba(52,211,153,.45);color:#d7ffe9}.admin-audit-status[data-state="action"]{border-color:rgba(251,191,36,.48);color:#fff3c4}.admin-audit-status[data-state="blocked"]{border-color:rgba(248,113,113,.5);color:#fee2e2}.admin-audit-status[data-state="open"]{color:#ddd6fe;border-color:rgba(167,139,250,.45)}
      .admin-audit-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin:14px 0}.admin-audit-metric{padding:10px 11px;border-radius:12px;background:rgba(30,41,59,.72);border:1px solid rgba(148,163,184,.16)}.admin-audit-metric span,.admin-audit-metric strong{display:block}.admin-audit-metric span{font-size:.75rem;color:#aebdd0}.admin-audit-metric strong{margin-top:4px;font-size:1.08rem}.admin-audit-context{display:grid;gap:8px;margin:10px 0 14px}.admin-audit-context div{padding:11px 12px;border-radius:12px;background:rgba(148,163,184,.07);color:#cbd5e1;line-height:1.45}
      .admin-audit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-audit-card{text-align:left;min-width:0;padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(15,23,42,.72);color:inherit;cursor:pointer}.admin-audit-card:hover,.admin-audit-card:focus-visible{border-color:rgba(167,139,250,.62)}.admin-audit-card strong,.admin-audit-card small{display:block}.admin-audit-card small{margin-top:5px;color:#b9c8dc;line-height:1.4}.admin-audit-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:680px){.admin-audit-grid{grid-template-columns:1fr}.admin-audit-actions>*{flex:1 1 150px}}
    `;
    document.head.appendChild(style);
  }

  function rowsFor(selector, emptyPattern) {
    return [...document.querySelectorAll(selector)]
      .filter((row) => row.cells?.length && !(emptyPattern || /no .*loaded|no .*items/i).test(row.textContent || ''));
  }

  function countRows(selector, emptyPattern) {
    return rowsFor(selector, emptyPattern).length;
  }

  function reviewSnapshot() {
    const sourceRows = [
      ...rowsFor('#ad_schema_preflight_table tbody tr', /no .*loaded|no preflight/i),
      ...rowsFor('#ad_readiness_table tbody tr', /no .*loaded|no readiness/i),
      ...rowsFor('#ad_deployment_gate_table tbody tr', /no .*loaded|no deployment/i)
    ];
    let hard = 0;
    let review = 0;
    for (const row of sourceRows) {
      const text = String(row.textContent || '');
      if (/\b(fail|failed|blocked|error|critical|missing)\b/i.test(text)) hard += 1;
      else if (/\b(warning|review|action|overdue|pending)\b/i.test(text)) review += 1;
    }
    return { total:sourceRows.length, hard, review };
  }

  function statusSnapshot() {
    const review = reviewSnapshot();
    if (review.hard) return { label:'BLOCKED', state:'blocked' };
    if (review.review) return { label:'NEEDS REVIEW', state:'action' };
    const badge = document.getElementById('ad_health_age_badge');
    const status = String(badge?.dataset?.status || '').toLowerCase();
    const text = String(badge?.textContent || '').trim();
    if ((status === 'ok' || /ready|current|live/i.test(text)) && review.total) return { label:'CURRENT', state:'ready' };
    if (status === 'error' || /fail|blocked|error/i.test(text)) return { label:'BLOCKED', state:'blocked' };
    return { label:'LOADED ON DEMAND', state:'open' };
  }

  function metrics() {
    return [
      ['Readiness checks', countRows('#ad_readiness_table tbody tr', /no .*loaded|no readiness/i)],
      ['Permission rows', countRows('#ad_permissions_table tbody tr', /no .*loaded|no permissions/i)],
      ['Deployment gates', countRows('#ad_deployment_gate_table tbody tr', /no .*loaded|no deployment/i)],
      ['Audit events', countRows('#ad_audit_log_table tbody tr', /no .*loaded|no audit/i)]
    ];
  }

  function openQuick(item) {
    window.YWIAdminHub?.open?.('readiness', { panelTitle:item.panel });
    if (!item.target) return;
    setTimeout(() => document.getElementById(item.target)?.scrollIntoView?.({ behavior:'smooth', block:'start' }), 0);
  }

  function createWorkspace() {
    let host = document.getElementById(WORKSPACE_ID);
    if (host) return host;
    const heading = document.getElementById('ad_hub_workspace_heading');
    if (!heading) return null;
    host = document.createElement('section');
    host.id = WORKSPACE_ID;
    host.dataset.build = String(BUILD);
    host.setAttribute('aria-labelledby', 'adminAuditSecurityWorkspaceTitle');
    heading.insertAdjacentElement('afterend', host);
    host.addEventListener('click', (event) => {
      const quick = event.target.closest('[data-admin-audit-key]');
      if (quick) {
        const item = QUICK_LINKS.find((row) => row.key === quick.getAttribute('data-admin-audit-key'));
        if (item) openQuick(item);
        return;
      }
      if (event.target.closest('#adminAuditSecurityRefresh')) {
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
      const review = reviewSnapshot();
      const backups = countRows('#ad_backup_rehearsal_table tbody tr', /no .*loaded|no .*rehearsal/i);
      const attention = review.hard + review.review;
      host.innerHTML = `
        <div class="admin-audit-head">
          <div><span class="module-kicker">Build ${BUILD} · focused Admin workspace</span><h3 id="adminAuditSecurityWorkspaceTitle">Audit &amp; Security</h3><p>Start with bounded readiness, permission, deployment and audit evidence, then open only the established Admin control needed for review. This presentation does not change permissions, security settings, deployment state, backup/restore state, or create a new data/write path.</p></div>
          <span class="admin-audit-status" data-state="${esc(status.state)}">${esc(status.label)}</span>
        </div>
        <div class="admin-audit-metrics" aria-label="Currently loaded audit and security counts">${rows.map(([label,value]) => `<div class="admin-audit-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>
        <div class="admin-audit-context"><div><strong>Readiness/security attention:</strong> ${esc(attention)} loaded item${attention === 1 ? '' : 's'} currently indicate review, warning, failure, blocking, overdue or missing evidence.</div><div><strong>Backup/restore evidence:</strong> ${esc(backups)} rehearsal record${backups === 1 ? '' : 's'} currently loaded in the established readiness panel.</div></div>
        <div class="admin-audit-grid">${QUICK_LINKS.map((item) => `<button type="button" class="admin-audit-card" data-admin-audit-key="${esc(item.key)}"><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></button>`).join('')}</div>
        <div class="admin-audit-actions"><button id="adminAuditSecurityRefresh" type="button" class="secondary">Refresh readiness</button><button type="button" class="secondary" data-admin-audit-key="readiness">Open Readiness &amp; Permissions</button></div>
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
      document.getElementById('ad_schema_preflight_table'),
      document.getElementById('ad_readiness_table'),
      document.getElementById('ad_permissions_table'),
      document.getElementById('ad_action_permission_table'),
      document.getElementById('ad_deployment_gate_table'),
      document.getElementById('ad_backup_rehearsal_table'),
      document.getElementById('ad_audit_log_table')
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

  window.YWIAdminAuditSecurityWorkspace = Object.freeze({ render, build:BUILD });
})();
