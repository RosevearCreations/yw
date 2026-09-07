/* File: js/it-release-resolution-cockpit.js
   Build 249 Release Resolution Cockpit.
   Presentation-only guidance layered onto the existing Build 248 exact-SHA evidence checklist.
   Build 246 remains the only release-classification / required-gate policy authority.
   This helper reads rendered checklist rows only; it does not call APIs, mutate GitHub/Supabase,
   run tests, change repository protection, alter schema/Auth/Finance/provider state, or authorize Production.
*/

'use strict';

(function () {
  const BUILD = 249;
  const STYLE_ID = 'itReleaseResolutionCockpitStyles';

  // Guidance only. These keys do NOT decide which gates are required; Build 246 does that.
  const GATE_GUIDANCE = Object.freeze({
    'test:acceptance': {
      why:'Confirms the candidate still satisfies the established cross-module acceptance contract.',
      fix:'Fix the failing acceptance behavior on the exact Development candidate, preserve the acceptance assertions, then rerun the canonical workflow.'
    },
    'test:admin-account-security': {
      why:'Confirms Admin account security and privileged access expectations remain intact.',
      fix:'Correct the Admin security/evidence defect without weakening roles, permissions, account controls, or break-glass requirements; then rerun the canonical workflow.'
    },
    'test:auth-security-evidence': {
      why:'Confirms authentication/security claims are backed by current evidence rather than assumption.',
      fix:'Restore the missing authentication/security evidence through the established evidence path; do not weaken Auth policy or manually mark the evidence current.'
    },
    'test:boundaries': {
      why:'Protects module ownership and prevents a release from crossing established write or authority boundaries.',
      fix:'Move the offending behavior back behind its established module/service boundary or repair the boundary contract; do not bypass the boundary check.'
    },
    'test:browser': {
      why:'Confirms the canonical rendered application still works in a real browser on this exact candidate.',
      fix:'Repair the rendered-browser failure on the exact Development SHA and keep the browser assertion intact; do not skip the test or narrow coverage to manufacture GREEN.'
    },
    'test:browser:admin-account-security': {
      why:'Confirms privileged Admin security behavior renders and behaves correctly in the browser.',
      fix:'Repair the rendered Admin security flow without weakening account/role controls, then rerun the canonical browser gate.'
    },
    'test:browser:finance': {
      why:'Confirms Finance safety/review behavior remains correct in the rendered application.',
      fix:'Repair the Finance UI/runtime defect while preserving posting, approval, and provider safety boundaries; do not enable posting or a payment provider just to satisfy the test.'
    },
    'test:browser:help-seo': {
      why:'Confirms public Help/SEO content renders with the required structure and discoverability signals.',
      fix:'Repair the rendered Help/SEO structure, headings, metadata, or layout and rerun; do not hide content or relax SEO assertions to make the gate pass.'
    },
    'test:browser:performance-budgets': {
      why:'Confirms the rendered application stays within the reviewed performance budget.',
      fix:'Optimize the offending load/render path first. Any budget increase requires explicit review; do not raise the budget merely to turn the gate GREEN.'
    },
    'test:browser:public-route-publication': {
      why:'Confirms public routes are actually rendered and publishable under the established public-route contract.',
      fix:'Repair the affected public route/rendering contract and rerun the browser gate; do not remove the route or assertion solely to clear the failure.'
    },
    'test:browser:staging-acceptance': {
      why:'Confirms the staged application behaves correctly against the intended non-Production acceptance target.',
      fix:'Restore or repair the intended staging target and staged behavior, then rerun; never point the staging acceptance gate at Production as a shortcut.'
    },
    'test:current-schema-staging-runbook': {
      why:'Confirms schema-changing work follows the canonical migration/runbook order before dependent runtime release.',
      fix:'Apply/repair the required migrations in the intended staging/Development target in canonical order, verify the runbook evidence, then rerun. Never patch Production ad hoc.'
    },
    'test:finance-posting-preflight': {
      why:'Confirms Finance posting prerequisites and safeguards are satisfied before any posting-capable release path advances.',
      fix:'Resolve the reported posting precondition using the established Finance controls; do not enable posting, bypass approvals, or activate a provider merely to satisfy the gate.'
    },
    'test:finance-posting-safety': {
      why:'Confirms Finance posting safety invariants remain enforced for sensitive changes.',
      fix:'Repair the Finance safety invariant or dependency while keeping approvals, idempotency, and provider boundaries intact; do not weaken the safety check.'
    },
    'test:finance-release-hardening': {
      why:'Confirms Finance release controls, recovery expectations, and sensitive-provider boundaries remain hardened.',
      fix:'Resolve the Finance hardening blocker through the established review/recovery controls; do not enable providers or relax posting safeguards to obtain GREEN.'
    },
    'test:finance-schema-dependencies': {
      why:'Confirms Finance code only advances when the schema objects and versions it depends on are present.',
      fix:'Converge the required schema in Development/staging first, verify dependency truth, then rerun. Do not add request-time schema repair or patch Production out of order.'
    },
    'test:help-seo': {
      why:'Protects public Help/SEO hygiene, semantic structure, and discoverability requirements.',
      fix:'Correct the source content/metadata/heading issue and rerun the canonical gate; preserve one-H1 and existing public-web authority rules.'
    },
    'test:performance-budgets': {
      why:'Prevents a release from silently increasing reviewed application load/runtime cost.',
      fix:'Optimize the offending source/runtime path first. Budget changes require explicit review and must not be used as an automatic pass mechanism.'
    },
    'test:promotion-shape': {
      why:'Confirms Production promotion uses the intended Development-to-main lineage with no unrelated main-only source drift.',
      fix:'Use the normal dev → main promotion PR and reconcile any unexpected main-only or ancestry drift before continuing; do not force-push or bypass the promotion shape.'
    },
    'test:public-route-publication': {
      why:'Confirms public routes remain intentionally publishable and wired to the established public-web authority.',
      fix:'Repair the route/publication contract in source and rerun; do not suppress or delete the required public route merely to clear the gate.'
    },
    'test:release-authority': {
      why:'Confirms release authority agrees with exact source, workflow, repository, and readiness evidence.',
      fix:'Resolve the reported source-SHA, workflow, repository-enforcement, or readiness mismatch. Never bypass release authority or manually relabel a blocked release GREEN.'
    },
    'test:release-source-evidence-record': {
      why:'Confirms the canonical release evidence bundle is recorded through the established evidence path.',
      fix:'Run/fix the canonical release-source evidence recording path for this exact candidate; do not hand-edit database evidence or copy proof from another SHA.'
    },
    'test:release-source-evidence-verify': {
      why:'Confirms the release evidence bundle matches the exact candidate and required source facts.',
      fix:'Regenerate or repair the canonical source-evidence bundle for this exact candidate and rerun verification; never reuse stale or different-SHA evidence.'
    },
    'test:repo': {
      why:'Protects repository hygiene so generated/temp artifacts or accidental files do not become release source.',
      fix:'Remove unintended tracked artifacts or restore required files, then rerun repository hygiene; do not delete required evidence or application assets just to reduce the diff.'
    },
    'test:repository-protection-preflight': {
      why:'Confirms the repository-enforcement evidence path is present and actionable before release authority advances.',
      fix:'Open RosevearCreations/yw → Settings → Branches, add/verify a main branch protection rule requiring PRs and canonical status checks, keep force pushes/deletion disabled, then rerun the exact-main proof. Do not bypass enforcement.'
    },
    'test:runtime': {
      why:'Confirms shared runtime, focused workspaces, data services, and write boundaries remain internally consistent.',
      fix:'Repair the failing runtime contract at its owning module/service boundary and rerun; do not introduce a parallel authority or weaken the runtime check.'
    },
    'test:search-discovery': {
      why:'Confirms public content remains discoverable through the established search/discovery surface.',
      fix:'Repair indexing/search metadata, route wiring, or content discovery in source, then rerun; do not hide the affected content to avoid the gate.'
    },
    'test:security-advisor-truth': {
      why:'Confirms security-advisor/readiness statements reflect current evidence rather than stale claims.',
      fix:'Reconcile the underlying security evidence and status source; do not silence the advisor, weaken the policy, or manually change the displayed truth.'
    },
    'test:staging-acceptance': {
      why:'Confirms sensitive changes are accepted against the intended staging/Development environment before Production.',
      fix:'Repair the staged behavior or intended staging target and rerun canonical acceptance; never substitute Production for staging or bypass failed acceptance.'
    },
    'test:staging-environment-guard': {
      why:'Prevents staging tests or writes from accidentally targeting Production resources.',
      fix:'Correct the staging environment identifiers/bindings so the guard positively identifies the intended non-Production target; never weaken the guard to permit ambiguous targeting.'
    },
    'test:staging-runtime-schema': {
      why:'Confirms the staged runtime sees the exact schema required by the candidate.',
      fix:'Apply/fix the required schema in Development/staging in canonical migration order, verify schema drift is current, then rerun. Never patch Production ad hoc.'
    },
    'test:staging-scenarios': {
      why:'Confirms the required staged business scenarios remain represented and executable for the candidate.',
      fix:'Repair the failing/missing staging scenario or its fixture while preserving scenario coverage, then rerun; do not remove the scenario to obtain GREEN.'
    },
    'test:staging-target-preflight': {
      why:'Confirms the staging target is explicit, reachable, and distinct from Production before staged execution.',
      fix:'Restore the intended staging target/configuration and rerun preflight; never redirect the gate to Production or bypass target identity checks.'
    },
    'test:submission-security': {
      why:'Protects submission/write surfaces from authorization, validation, and trust-boundary regressions.',
      fix:'Repair the submission security boundary without weakening validation, authorization, or role requirements; then rerun the canonical gate.'
    }
  });

  let active = true;
  let observer = null;

  function knownGuidance(gate) {
    return GATE_GUIDANCE[String(gate || '').trim()] || {
      why:'Build 246 selected this required gate, but Build 249 has no gate-specific explanatory entry yet.',
      fix:'Treat the gate as unresolved. Inspect the Build 246 policy and canonical workflow step, fix the underlying failure, and rerun the canonical Development proof. Never infer safety from missing guidance.'
    };
  }

  function resolutionFor(gate, status, detail = '') {
    const guidance = knownGuidance(gate);
    const state = String(status || 'missing').trim().toLowerCase();
    if (state === 'proven') {
      return {
        why: guidance.why,
        action:'No corrective action is required. Preserve this exact-SHA proof; rerun only if the candidate SHA changes or the evidence passes the freshness window.'
      };
    }
    if (state === 'stale') {
      return {
        why: guidance.why,
        action:`Re-run the canonical Development workflow on the unchanged candidate SHA to renew this gate. If it no longer passes, follow the gate-specific correction: ${guidance.fix}`
      };
    }
    if (state === 'not_applicable') {
      return {
        why: guidance.why,
        action:'No action is required for this candidate. If Build 246 selects this gate for a future candidate, it must earn fresh canonical evidence then.'
      };
    }
    const missingDetail = String(detail || '').toLowerCase();
    if (missingDetail.includes('not present')) {
      return {
        why: guidance.why,
        action:`Restore the canonical workflow step for ${gate}; do not remove the Build 246 requirement. Then rerun the exact candidate proof. Gate-specific correction: ${guidance.fix}`
      };
    }
    return { why: guidance.why, action: guidance.fix };
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .it-system-gate-guidance{display:grid;gap:5px;margin-top:7px;padding:8px 9px;border-radius:9px;background:rgba(56,189,248,.07);border:1px solid rgba(56,189,248,.16)}
      .it-system-gate-guidance p{margin:0;color:#dbe6f4;line-height:1.4;font-size:.8rem}.it-system-gate-guidance strong{color:#eaf4ff}
      #releaseResolutionSummary{margin:10px 0 0;padding:9px 10px;border-radius:10px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);color:#dbeafe;line-height:1.42}
    `;
    document.head.appendChild(style);
  }

  function guidanceNode(gate, status, detail) {
    const resolution = resolutionFor(gate, status, detail);
    const node = document.createElement('div');
    node.className = 'it-system-gate-guidance';
    node.dataset.releaseResolutionGate = gate;
    const why = document.createElement('p');
    const whyLabel = document.createElement('strong');
    whyLabel.textContent = 'Why required: ';
    why.append(whyLabel, document.createTextNode(resolution.why));
    const action = document.createElement('p');
    const actionLabel = document.createElement('strong');
    actionLabel.textContent = 'Safe corrective action: ';
    action.append(actionLabel, document.createTextNode(resolution.action));
    node.append(why, action);
    return node;
  }

  function render() {
    injectStyles();
    if (!active) return;
    const cockpit = document.getElementById('releaseEvidenceChecklistCockpit');
    if (!cockpit) return;
    const rows = [...cockpit.querySelectorAll('.it-system-evidence-list li[data-evidence-status]')];
    for (const row of rows) {
      const gate = String(row.querySelector('code')?.textContent || '').trim();
      const status = String(row.getAttribute('data-evidence-status') || 'missing').trim().toLowerCase();
      const detail = String(row.querySelector('small')?.textContent || '').trim();
      row.querySelector('.it-system-gate-guidance')?.remove();
      const body = row.querySelector('div');
      if (body && gate) body.appendChild(guidanceNode(gate, status, detail));
    }
    cockpit.querySelector('#releaseResolutionSummary')?.remove();
    if (rows.length) {
      const unresolved = rows.filter((row)=>/missing|stale/.test(String(row.getAttribute('data-evidence-status') || ''))).length;
      const summary = document.createElement('div');
      summary.id = 'releaseResolutionSummary';
      summary.dataset.build = String(BUILD);
      summary.textContent = unresolved
        ? `Build ${BUILD} resolution guidance: ${unresolved} required gate${unresolved === 1 ? '' : 's'} need operator action. Guidance never changes evidence state or release authority.`
        : `Build ${BUILD} resolution guidance: no listed gate needs corrective action. Fresh exact-SHA evidence and repository authority remain separate requirements.`;
      const notes = cockpit.querySelector('.it-system-divergence-notes');
      if (notes) notes.insertAdjacentElement('beforebegin', summary);
      else cockpit.appendChild(summary);
    }
  }

  function scheduleRender() {
    queueMicrotask(render);
  }

  function start() {
    injectStyles();
    scheduleRender();
    const source = document.getElementById('itReadinessWorkspace');
    if (source && !observer) {
      observer = new MutationObserver(scheduleRender);
      observer.observe(source,{ subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['data-status'] });
    }
    document.addEventListener('ywi:route-shown',(event)=>{
      active = event?.detail?.allowed === 'it';
      scheduleRender();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{ once:true });
  else start();

  window.YWIITReleaseResolutionCockpit = Object.freeze({
    build: BUILD,
    render,
    guidanceFor: resolutionFor,
    knownGates: Object.freeze(Object.keys(GATE_GUIDANCE))
  });
})();

/* Build 250 Release Readiness Summary.
   Build 246 remains required-gate policy authority; Build 248 remains exact-SHA evidence authority;
   Build 249 remains gate-resolution guidance authority. This summary only composes those established
   signals with repository, schema and operational-acceptance readiness into one fail-closed next action.
*/
(function () {
  const BUILD = 250;
  const SUMMARY_ID = 'releaseReadinessSummary';
  const STYLE_ID = 'itReleaseReadinessSummaryStyles';
  let active = true;
  let observer = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function human(value) {
    return String(value || 'not recorded').replaceAll('_',' ');
  }

  function shortSha(value) {
    const text = String(value || '').trim();
    return text ? text.slice(0,12) : 'not recorded';
  }

  function readinessSnapshot() {
    try { return window.YWIITReadiness?.getSnapshot?.() || null; }
    catch { return null; }
  }

  function readyStatus(value) {
    const text = String(value || '').trim().toLowerCase();
    if (/red|fail|failed|blocked|unprotected|missing|stale|unknown|error/.test(text)) return false;
    return /green|ready|current|protected|passed|pass|success|complete|proven/.test(text);
  }

  function firstUnresolvedEvidence(summary) {
    const items = Array.isArray(summary?.release_evidence_checklist_items) ? summary.release_evidence_checklist_items : [];
    return items.find((item)=>/missing|stale/.test(String(item?.status || '').toLowerCase())) || null;
  }

  function resolutionForUnresolved(summary) {
    const item = firstUnresolvedEvidence(summary);
    if (!item) return null;
    const resolver = window.YWIITReleaseResolutionCockpit?.guidanceFor;
    const resolved = typeof resolver === 'function' ? resolver(item.gate,item.status,item.detail) : null;
    return {
      gate:String(item.gate || 'required gate'),
      status:String(item.status || 'missing'),
      action:String(resolved?.action || 'Treat this required gate as unresolved, repair its canonical evidence path, and rerun the exact Development candidate proof.')
    };
  }

  function readinessState(payload) {
    if (!payload) return { label:'LOAD READINESS', state:'open' };
    const summary = payload.summary || {};
    if (summary.branch_protection_reported !== true || !readyStatus(summary.repository_enforcement_status)) return { label:'BLOCKED', state:'blocked' };
    if (summary.schema_current !== true) return { label:'BLOCKED', state:'blocked' };
    const divergence = String(summary.release_divergence_status || '').toLowerCase();
    if (divergence === 'production_only_drift') return { label:'BLOCKED', state:'blocked' };
    if (divergence === 'development_changes_pending') {
      if (!summary.release_policy_available || !summary.release_evidence_checklist_available) return { label:'BLOCKED', state:'blocked' };
      const evidenceStatus = String(summary.release_evidence_checklist_status || '').toLowerCase();
      if (evidenceStatus === 'missing') return { label:'BLOCKED', state:'blocked' };
      if (evidenceStatus === 'stale') return { label:'NEEDS FRESH PROOF', state:'action' };
      if (evidenceStatus === 'proven') return { label:'PROMOTION PATH READY', state:'action' };
      return { label:'REVIEW REQUIRED', state:'action' };
    }
    if (divergence === 'content_current') {
      if (Number(summary.open_rail_acceptance_count || 0) > 0 || Number(summary.current_todo_count || 0) > 0) return { label:'OPERATIONAL FOLLOW-UP', state:'action' };
      return { label:'CURRENT', state:'ready' };
    }
    return { label:'REVIEW REQUIRED', state:'action' };
  }

  function nextSafeAction(payload) {
    if (!payload) return 'Refresh the established I.T. Readiness source before making a release decision. Unavailable evidence remains unresolved.';
    const summary = payload.summary || {};
    if (summary.branch_protection_reported !== true || !readyStatus(summary.repository_enforcement_status)) {
      return 'Open RosevearCreations/yw → Settings → Branches, add or verify the main branch protection rule, require pull requests and canonical status checks, keep force pushes and deletion disabled, then require a fresh exact-main workflow to observe protected=true on that exact main SHA.';
    }
    if (summary.schema_current !== true) {
      return 'Converge the required schema in Development/staging in canonical migration order, verify exact schema truth, and rerun dependent gates. Never patch Production ad hoc.';
    }
    const divergence = String(summary.release_divergence_status || '').toLowerCase();
    if (divergence === 'production_only_drift') {
      return 'Reconcile Production-only history back into dev, restore one canonical Development lineage, and rerun the full Development proof before any further promotion.';
    }
    if (divergence === 'development_changes_pending' && !summary.release_policy_available) {
      return 'Restore complete changed-file evidence so Build 246 can classify the exact Development candidate; do not infer a lower-risk class or promote an unclassified diff.';
    }
    if (divergence === 'development_changes_pending' && !summary.release_evidence_checklist_available) {
      return 'Restore the exact-SHA canonical workflow evidence selected by Build 246 before any Production promotion. Missing evidence is not equivalent to a passing gate.';
    }
    const evidenceStatus = String(summary.release_evidence_checklist_status || '').toLowerCase();
    if (divergence === 'development_changes_pending' && /missing|stale/.test(evidenceStatus)) {
      const unresolved = resolutionForUnresolved(summary);
      if (unresolved) return `${unresolved.gate}: ${unresolved.action}`;
      return 'Resolve the missing or stale Build 246-selected gate evidence on the exact Development candidate, then rerun the canonical proof.';
    }
    if (divergence === 'development_changes_pending' && evidenceStatus === 'proven') {
      return 'All Build 246-selected gates have fresh exact-SHA evidence. Continue only through the normal dev → main promotion PR; this summary cannot authorize or perform the promotion.';
    }
    if (divergence === 'content_current' && Number(summary.open_rail_acceptance_count || 0) > 0) {
      const count = Number(summary.open_rail_acceptance_count || 0);
      return `Close the next operational acceptance rail through its established human/evidence path (${count} open). Do not auto-close business evidence from this summary.`;
    }
    if (divergence === 'content_current' && Number(summary.current_todo_count || 0) > 0) {
      const count = Number(summary.current_todo_count || 0);
      return `Resolve the next current Admin To-Do item through its owning control (${count} open). Keep historical/audit-only items out of the current work queue.`;
    }
    if (divergence === 'content_current') {
      return 'No source promotion is pending and no current acceptance/Admin blocker is reported. Continue the approved roadmap from Development.';
    }
    return 'Resolve the Development/Production comparison ambiguity in the established release cockpit before taking any Production action.';
  }

  function buildModel(payload = readinessSnapshot()) {
    const summary = payload?.summary || {};
    const state = readinessState(payload);
    const divergence = String(summary.release_divergence_status || '').toLowerCase();
    const pending = divergence === 'development_changes_pending';
    const counts = summary.release_evidence_checklist_counts || {};
    const gates = Array.isArray(summary.release_policy_required_gates) ? summary.release_policy_required_gates : [];
    const candidate = pending && summary.release_policy_available
      ? `${human(summary.release_policy_primary_class)} · ${String(summary.release_policy_risk_level || 'review').toUpperCase()} risk`
      : divergence === 'content_current' ? 'No pending candidate' : human(divergence || 'unresolved');
    const evidence = pending
      ? summary.release_evidence_checklist_available
        ? `${Number(counts.proven || 0)} / ${gates.length || Number(counts.proven || 0) + Number(counts.missing || 0) + Number(counts.stale || 0)} proven · ${Number(counts.missing || 0)} missing · ${Number(counts.stale || 0)} stale`
        : 'Exact-SHA evidence unavailable'
      : 'Not applicable';
    const repository = summary.branch_protection_reported === true && readyStatus(summary.repository_enforcement_status)
      ? 'PROTECTED'
      : summary.branch_protection_reported === false ? 'UNPROTECTED' : 'UNVERIFIED';
    const schema = `${Number(summary.latest_applied_schema_version || 0)} / ${Number(summary.expected_schema_version || 0)}${summary.schema_current === true ? ' current' : ' review'}`;
    const acceptance = `${Number(summary.open_rail_acceptance_count || 0)} open acceptance rail${Number(summary.open_rail_acceptance_count || 0) === 1 ? '' : 's'} · ${Number(summary.open_rail_technical_pending_count || 0)} technical pending`;
    return {
      state,
      candidate,
      candidateSha:shortSha(summary.release_evidence_checklist_candidate_sha || summary.development_sha),
      workflowRun:summary.release_evidence_checklist_workflow_run_number || summary.workflow_run_id || 'not recorded',
      evidence,
      repository,
      repositoryStatus:human(summary.repository_enforcement_status || 'not loaded'),
      schema,
      acceptance,
      nextAction:nextSafeAction(payload)
    };
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #releaseReadinessSummary{margin:14px 0;padding:14px;border-radius:14px;border:1px solid rgba(125,211,252,.24);background:rgba(8,47,73,.22)}
      #releaseReadinessSummary .it-release-summary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      #releaseReadinessSummary .it-release-summary-head h3{margin:2px 0 0}
      #releaseReadinessSummary .it-release-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
      #releaseReadinessSummary .it-release-summary-card{padding:10px;border-radius:10px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);min-width:0}
      #releaseReadinessSummary .it-release-summary-card span{display:block;color:#9fb3c8;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}
      #releaseReadinessSummary .it-release-summary-card strong{display:block;margin-top:4px;color:#f8fbff;overflow-wrap:anywhere}
      #releaseReadinessSummary .it-release-summary-card small{display:block;margin-top:4px;color:#c8d5e3;line-height:1.35;overflow-wrap:anywhere}
      #releaseReadinessSummary .it-release-summary-action{margin:12px 0 0;padding:10px 11px;border-radius:10px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);color:#dbeafe;line-height:1.45}
      #releaseReadinessSummary .it-release-summary-note{margin:9px 0 0;color:#aebfd0;font-size:.8rem;line-height:1.4}
      @media (max-width:900px){#releaseReadinessSummary .it-release-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:620px){#releaseReadinessSummary .it-release-summary-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    injectStyles();
    if (!active) return;
    const host = document.getElementById('itSystemWorkspace');
    if (!host) return;
    host.querySelector(`#${SUMMARY_ID}`)?.remove();
    const model = buildModel();
    const section = document.createElement('section');
    section.id = SUMMARY_ID;
    section.dataset.build = String(BUILD);
    section.setAttribute('aria-labelledby','releaseReadinessSummaryTitle');
    section.innerHTML = `
      <div class="it-release-summary-head">
        <div><span class="module-kicker">Build ${BUILD} · release readiness summary</span><h3 id="releaseReadinessSummaryTitle">One release posture, one safe next action</h3></div>
        <span class="it-system-status" data-state="${esc(model.state.state)}">${esc(model.state.label)}</span>
      </div>
      <div class="it-release-summary-grid">
        <div class="it-release-summary-card"><span>Candidate / classification</span><strong>${esc(model.candidate)}</strong><small>candidate ${esc(model.candidateSha)}</small></div>
        <div class="it-release-summary-card"><span>Exact-SHA gate evidence</span><strong>${esc(model.evidence)}</strong><small>canonical run ${esc(model.workflowRun)}</small></div>
        <div class="it-release-summary-card"><span>Repository authority</span><strong>${esc(model.repository)}</strong><small>${esc(model.repositoryStatus)}</small></div>
        <div class="it-release-summary-card"><span>Schema / staging acceptance</span><strong>${esc(model.schema)}</strong><small>${esc(model.acceptance)}</small></div>
      </div>
      <p class="it-release-summary-action"><strong>Safe next action:</strong> ${esc(model.nextAction)}</p>
      <p class="it-release-summary-note"><strong>Advisory summary only.</strong> Build 246 selects required gates, Build 248 owns exact-SHA evidence, and Build 249 owns gate-specific correction guidance. This summary does not execute gates, mutate evidence, change repository settings, apply migrations, enable Finance/provider actions, or authorize Production. Unavailable evidence remains unresolved.</p>`;
    const anchor = host.querySelector('#releaseDivergenceCockpit');
    if (anchor) anchor.insertAdjacentElement('beforebegin',section);
    else host.prepend(section);
  }

  function scheduleRender() {
    queueMicrotask(render);
  }

  function start() {
    injectStyles();
    scheduleRender();
    const source = document.getElementById('itReadinessWorkspace');
    if (source && !observer) {
      observer = new MutationObserver(scheduleRender);
      observer.observe(source,{ subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['data-status'] });
    }
    document.addEventListener('ywi:route-shown',(event)=>{
      active = event?.detail?.allowed === 'it';
      scheduleRender();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{ once:true });
  else start();

  window.YWIITReleaseReadinessSummary = Object.freeze({
    build:BUILD,
    render,
    getModel:()=>buildModel(),
    nextSafeAction:(payload)=>nextSafeAction(payload || readinessSnapshot())
  });
})();
