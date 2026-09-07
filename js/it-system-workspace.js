/* File: js/it-system-workspace.js
   Build 240 I.T. & System release-governance workspace.
   Presentation-only operator overview over the established bounded I.T. Readiness authority.
   It reads the already-loaded readiness snapshot, reuses the existing readiness refresh,
   navigates existing release/database/access/runtime sections, and gives exact manual
   remediation when GitHub repository enforcement is not current. It creates no API,
   deployment, repository, authentication, database, provider, or write authority.
*/

'use strict';

(function () {
  const BUILD = 240;
  const WORKSPACE_ID = 'itSystemWorkspace';
  const STYLE_ID = 'itSystemWorkspaceStyles';
  const REPOSITORY_REMEDIATION_STEPS = Object.freeze([
    'Open RosevearCreations/yw in GitHub, then go to Settings → Branches.',
    'Add a classic branch protection rule targeting main.',
    'Require a pull request before merging and require the canonical YWI source/staging source-check status before merge.',
    'Keep force pushes and branch deletion disabled for main.',
    'Complete the next normal main promotion and require the exact-main workflow to observe protected=true on that same main SHA.'
  ]);
  const QUICK_LINKS = Object.freeze([
    { key:'release', title:'Release & Repository', note:'Review exact source/CI evidence, repository enforcement, acceptance state and the manual Production promotion boundary.', id:'releaseDeploymentCockpit' },
    { key:'database', title:'Database & Functions', note:'Review the established schema-drift and Edge Function readiness evidence without running migrations or changing runtime configuration.', heading:'Schema drift' },
    { key:'access', title:'Authentication & Admin Access', note:'Review the existing Admin break-glass and module-access integrity evidence without changing passwords, roles or permissions.', heading:'Admin break-glass access' },
    { key:'runtime', title:'Runtime & Recovery', note:'Review current runtime/error health and established recovery evidence without executing deploy, restore or provider actions.', heading:'Runtime and error health' }
  ]);

  let active = true;
  let applying = false;
  let observer = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  }

  function readinessSnapshot() {
    try { return window.YWIITReadiness?.getSnapshot?.() || null; }
    catch { return null; }
  }

  function normalizedStatus(value) {
    const text = String(value || '').trim().toLowerCase();
    if (/red|fail|failed|error|critical|blocked|behind|missing|unhealthy|not_ready/.test(text)) return 'blocked';
    if (/amber|warning|warn|review|pending|attention|deferred|manual/.test(text)) return 'action';
    if (/green|passed|pass|current|ready|healthy|success|complete/.test(text)) return 'ready';
    return 'open';
  }

  function statusSnapshot(payload) {
    if (!payload) return { label:'OPEN I.T. READINESS', state:'open' };
    const summary = payload.summary || {};
    const blockers = Number(summary.readiness_blockers || 0) + Number(summary.assertion_blockers || 0) + Number(summary.admin_access_integrity_blockers || 0);
    const hard = Array.isArray(payload.source_errors) && payload.source_errors.length
      || summary.schema_current === false
      || normalizedStatus(summary.source_gate_status) === 'blocked'
      || normalizedStatus(summary.repository_enforcement_status) === 'blocked'
      || blockers > 0;
    if (hard) return { label:'BLOCKED', state:'blocked' };
    const action = normalizedStatus(summary.source_gate_status) === 'action'
      || normalizedStatus(summary.repository_enforcement_status) === 'action'
      || Number(summary.scorecard_unclassified_open_count || 0) > 0
      || Number(summary.current_todo_count || 0) > 0
      || Number(summary.open_rail_acceptance_count || 0) > 0
      || Number(summary.scorecard_human_pending_count || 0) > 0
      || Number(summary.scorecard_external_pending_count || 0) > 0;
    if (action) return { label:'NEEDS REVIEW', state:'action' };
    if (summary.schema_current === true && normalizedStatus(summary.source_gate_status) === 'ready' && normalizedStatus(summary.repository_enforcement_status) === 'ready') {
      return { label:'CURRENT', state:'ready' };
    }
    return { label:'LOADED ON DEMAND', state:'open' };
  }

  function metrics(payload) {
    const summary = payload?.summary || {};
    const schema = `${Number(summary.latest_applied_schema_version || 0)} / ${Number(summary.expected_schema_version || 0)}`;
    return [
      ['Source / CI', String(summary.source_gate_status || 'not loaded').replaceAll('_',' ')],
      ['Repository', String(summary.repository_enforcement_status || 'not loaded').replaceAll('_',' ')],
      ['DB schema', schema],
      ['Admin access blockers', Number(summary.admin_access_integrity_blockers || 0)]
    ];
  }

  function sourceContext(payload) {
    const summary = payload?.summary || {};
    if (!payload) return 'The bounded I.T. Readiness snapshot has not loaded yet.';
    const sha = summary.source_sha ? String(summary.source_sha).slice(0,12) : 'not recorded';
    const run = summary.workflow_run_id ? ` · workflow ${summary.workflow_run_id}` : '';
    return `Recorded main source ${sha}${run}.`;
  }

  function operatorContext(payload) {
    const summary = payload?.summary || {};
    if (!payload) return 'Use the established I.T. Readiness screen below to load current runtime authority.';
    const mode = String(payload.interactive_mode || 'unknown').replaceAll('_',' ');
    const todos = Number(summary.current_todo_count || 0);
    const acceptance = Number(summary.open_rail_acceptance_count || 0);
    return `${mode} · ${todos} current Admin To-Do item${todos === 1 ? '' : 's'} · ${acceptance} open acceptance rail${acceptance === 1 ? '' : 's'}.`;
  }

  function repositoryRemediation(payload) {
    if (!payload) return '';
    const summary=payload.summary || {};
    if (normalizedStatus(summary.repository_enforcement_status) === 'ready') return '';
    const exactSha=summary.source_sha ? String(summary.source_sha).slice(0,12) : 'current main';
    const evidence=summary.branch_protection_reported === true
      ? 'GitHub reports main as protected, but the current repository-enforcement authority is still not green. Re-verify the exact current main SHA and detailed policy evidence before release authority advances.'
      : 'GitHub has not reported main protected=true for the current release authority. The exact-main workflow must remain fail-closed until that external control is enabled and re-verified.';
    return `<section id="repositoryEnforcementRemediation" class="it-system-remediation" aria-labelledby="repositoryEnforcementRemediationTitle">
      <span class="module-kicker">Build ${BUILD} · release-governance remediation</span>
      <h3 id="repositoryEnforcementRemediationTitle">Repository enforcement requires manual GitHub action</h3>
      <p>${esc(evidence)}</p>
      <ol>${REPOSITORY_REMEDIATION_STEPS.map((step)=>`<li>${esc(step)}</li>`).join('')}</ol>
      <small><strong>Verification target:</strong> a fresh exact-main workflow must observe <code>protected=true</code> on the same ${esc(exactSha)} main SHA. This workspace cannot enable branch protection, cannot mark the gate green, and cannot bypass repository enforcement.</small>
    </section>`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${WORKSPACE_ID}{margin:0 0 16px;padding:16px;border:1px solid rgba(56,189,248,.28);border-radius:16px;background:linear-gradient(180deg,rgba(15,23,42,.94),rgba(15,23,42,.7))}
      #${WORKSPACE_ID}[hidden]{display:none!important}.it-system-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.it-system-head h2{margin:2px 0 5px}.it-system-head p{margin:0;max-width:850px;color:#cbd5e1;line-height:1.45}.it-system-status{display:inline-flex;align-items:center;min-height:30px;padding:4px 9px;border:1px solid rgba(148,163,184,.28);border-radius:999px;font-size:.75rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.it-system-status[data-state="ready"]{border-color:rgba(52,211,153,.45);color:#d7ffe9}.it-system-status[data-state="action"]{border-color:rgba(251,191,36,.48);color:#fff3c4}.it-system-status[data-state="blocked"]{border-color:rgba(248,113,113,.5);color:#fee2e2}.it-system-status[data-state="open"]{color:#bae6fd;border-color:rgba(56,189,248,.45)}
      .it-system-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:14px 0}.it-system-metric{padding:10px 11px;border-radius:12px;background:rgba(30,41,59,.72);border:1px solid rgba(148,163,184,.16)}.it-system-metric span,.it-system-metric strong{display:block}.it-system-metric span{font-size:.75rem;color:#aebdd0}.it-system-metric strong{margin-top:4px;font-size:1.02rem;word-break:break-word}.it-system-context{display:grid;gap:8px;margin:10px 0 14px}.it-system-context div{padding:11px 12px;border-radius:12px;background:rgba(148,163,184,.07);color:#cbd5e1;line-height:1.45}
      .it-system-remediation{margin:12px 0 14px;padding:13px 14px;border:1px solid rgba(251,191,36,.42);border-radius:13px;background:rgba(120,53,15,.16)}.it-system-remediation h3{margin:4px 0 7px}.it-system-remediation p{margin:0 0 8px;color:#e2e8f0;line-height:1.45}.it-system-remediation ol{margin:8px 0 10px;padding-left:1.3rem;color:#e2e8f0}.it-system-remediation li{margin:5px 0;line-height:1.4}.it-system-remediation small{display:block;color:#fef3c7;line-height:1.45}.it-system-remediation code{font-size:.9em}
      .it-system-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.it-system-card{text-align:left;min-width:0;padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(15,23,42,.72);color:inherit;cursor:pointer}.it-system-card:hover,.it-system-card:focus-visible{border-color:rgba(56,189,248,.62)}.it-system-card strong,.it-system-card small{display:block}.it-system-card small{margin-top:5px;color:#b9c8dc;line-height:1.4}.it-system-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:680px){.it-system-grid{grid-template-columns:1fr}.it-system-actions>*{flex:1 1 170px}.it-system-remediation{padding:12px}.it-system-remediation ol{padding-left:1.15rem}}
    `;
    document.head.appendChild(style);
  }

  function findTarget(item) {
    if (item.id) return document.getElementById(item.id);
    const heading = [...document.querySelectorAll('#itReadinessWorkspace h3')]
      .find((node) => String(node.textContent || '').trim() === item.heading);
    return heading?.closest('section') || heading || null;
  }

  function openQuick(item) {
    const target = findTarget(item);
    target?.scrollIntoView?.({ behavior:'smooth', block:'start' });
  }

  function createWorkspace() {
    let host = document.getElementById(WORKSPACE_ID);
    if (host) return host;
    const route = document.getElementById('it');
    const source = document.getElementById('itReadinessWorkspace');
    if (!route || !source) return null;
    host = document.createElement('section');
    host.id = WORKSPACE_ID;
    host.dataset.build = String(BUILD);
    host.setAttribute('aria-labelledby','itSystemWorkspaceTitle');
    source.insertAdjacentElement('beforebegin',host);
    host.addEventListener('click',(event)=>{
      const quick = event.target.closest('[data-it-system-key]');
      if (quick) {
        const item = QUICK_LINKS.find((row)=>row.key === quick.getAttribute('data-it-system-key'));
        if (item) openQuick(item);
        return;
      }
      if (event.target.closest('#itSystemRefresh')) {
        const button = document.getElementById('itReadinessRefresh');
        if (button && !button.disabled) button.click();
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
      host.hidden = !active;
      if (host.hidden) return;
      const payload = readinessSnapshot();
      const status = statusSnapshot(payload);
      const rows = metrics(payload);
      host.innerHTML = `
        <div class="it-system-head">
          <div><span class="module-kicker">Build ${BUILD} · focused operator workspace</span><h2 id="itSystemWorkspaceTitle">I.T. &amp; System</h2><p>Start with bounded source, repository, schema and Admin-access truth, then jump into the established I.T. Readiness evidence needed for investigation. This presentation does not deploy, change repository protection, mutate database schema, change authentication/roles, run browser smoke, or create a new data/write authority.</p></div>
          <span class="it-system-status" data-state="${esc(status.state)}">${esc(status.label)}</span>
        </div>
        <div class="it-system-metrics" aria-label="Current I.T. and system readiness summary">${rows.map(([label,value])=>`<div class="it-system-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>
        <div class="it-system-context"><div><strong>Release evidence:</strong> ${esc(sourceContext(payload))}</div><div><strong>Operator context:</strong> ${esc(operatorContext(payload))}</div></div>
        ${repositoryRemediation(payload)}
        <div class="it-system-grid">${QUICK_LINKS.map((item)=>`<button type="button" class="it-system-card" data-it-system-key="${esc(item.key)}"><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></button>`).join('')}</div>
        <div class="it-system-actions"><button id="itSystemRefresh" type="button" class="secondary">Refresh existing readiness</button><button type="button" class="secondary" data-it-system-key="release">Open release path</button></div>
      `;
    } finally {
      applying = false;
    }
  }

  function start() {
    injectStyles();
    render();
    const source = document.getElementById('itReadinessWorkspace');
    if (source && !observer) {
      observer = new MutationObserver(()=>{
        if (applying) return;
        queueMicrotask(render);
      });
      observer.observe(source,{ subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['data-status'] });
    }
    document.addEventListener('ywi:route-shown',(event)=>{
      active = event?.detail?.allowed === 'it';
      render();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{ once:true });
  else start();

  window.YWIITSystemWorkspace = Object.freeze({ render, build:BUILD, repositoryRemediationSteps:REPOSITORY_REMEDIATION_STEPS });
})();
