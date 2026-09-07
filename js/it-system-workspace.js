/* File: js/it-system-workspace.js
   Build 248 I.T. & System release classification, evidence checklist + divergence cockpit.
   Presentation-only operator overview over the established bounded I.T. Readiness authority.
   It reads the already-loaded readiness snapshot, including Admin-only read-only GitHub
   comparison, Build 246 policy evidence and exact-SHA canonical workflow gate evidence,
   and creates no browser API, deployment, repository, authentication, database, provider, or write authority.
*/

'use strict';

(function () {
  const BUILD = 248;
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
    if (/amber|warning|warn|review|pending|attention|deferred|manual|stale/.test(text)) return 'action';
    if (/green|passed|pass|current|ready|healthy|success|complete|proven/.test(text)) return 'ready';
    return 'open';
  }

  function shortSha(value) {
    const text = String(value || '').trim();
    return text ? text.slice(0,12) : 'not recorded';
  }

  function human(value) {
    return String(value || 'not recorded').replaceAll('_',' ');
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

  function divergenceState(summary) {
    if (!summary.github_divergence_evidence_available) return { label:'GITHUB EVIDENCE UNAVAILABLE', state:'open' };
    const value = String(summary.release_divergence_status || '').trim().toLowerCase();
    if (value === 'content_current') return { label:'IN SYNC BY CONTENT', state:'ready' };
    if (value === 'development_changes_pending') return { label:`${Number(summary.development_commits_pending || 0)} DEV COMMIT${Number(summary.development_commits_pending || 0) === 1 ? '' : 'S'} PENDING`, state:'action' };
    if (value === 'production_only_drift') return { label:'PRODUCTION-ONLY DRIFT', state:'blocked' };
    return { label:'REVIEW REQUIRED', state:'action' };
  }

  function releasePolicyState(summary) {
    if (!summary.github_divergence_evidence_available) return { label:'CLASSIFICATION UNAVAILABLE', state:'open' };
    const divergence = String(summary.release_divergence_status || '').toLowerCase();
    if (divergence === 'content_current') return { label:'NO PENDING CANDIDATE', state:'ready' };
    if (divergence === 'production_only_drift') return { label:'RECONCILE FIRST', state:'blocked' };
    if (!summary.release_policy_available) return { label:'CLASSIFICATION UNAVAILABLE', state:'action' };
    const risk = String(summary.release_policy_risk_level || 'review').toUpperCase();
    return { label:`${risk} RISK`, state:risk === 'CRITICAL' ? 'blocked' : 'action' };
  }

  function releaseEvidenceState(summary) {
    const divergence = String(summary.release_divergence_status || '').toLowerCase();
    if (divergence === 'content_current' || String(summary.release_evidence_checklist_status || '').toLowerCase() === 'not_applicable') {
      return { label:'NOT APPLICABLE', state:'ready' };
    }
    if (!summary.release_evidence_checklist_available) return { label:'EVIDENCE UNAVAILABLE', state:'open' };
    const counts = summary.release_evidence_checklist_counts || {};
    const missing = Number(counts.missing || 0);
    const stale = Number(counts.stale || 0);
    if (missing > 0) return { label:`${missing} MISSING`, state:'blocked' };
    if (stale > 0) return { label:`${stale} STALE`, state:'action' };
    if (String(summary.release_evidence_checklist_status || '').toLowerCase() === 'proven') return { label:'ALL GATES PROVEN', state:'ready' };
    return { label:'REVIEW REQUIRED', state:'action' };
  }

  function nextReleaseAction(summary) {
    if (normalizedStatus(summary.repository_enforcement_status) !== 'ready') {
      return 'Enable and verify main branch protection, then require a fresh exact-main workflow to observe protected=true on that exact main SHA.';
    }
    if (!summary.github_divergence_evidence_available) {
      return 'Refresh existing I.T. Readiness. If GitHub comparison evidence is still unavailable, inspect the established release path before making any Production decision.';
    }
    const status = String(summary.release_divergence_status || '').toLowerCase();
    if (status === 'production_only_drift') return 'Reconcile Production-only history back into dev and re-run the canonical Development gate before any further promotion.';
    if (status === 'development_changes_pending' && !summary.release_policy_available) return 'Release classification is unavailable for pending Development changes. Restore complete changed-file evidence before any Production promotion.';
    if (status === 'development_changes_pending') {
      const evidenceStatus = String(summary.release_evidence_checklist_status || '').toLowerCase();
      if (!summary.release_evidence_checklist_available) return 'Required-gate workflow evidence is unavailable. Restore exact-SHA canonical workflow evidence before any Production promotion.';
      if (evidenceStatus === 'missing') return 'Complete the missing required gates on the exact current Development SHA, then re-check the canonical promotion evidence.';
      if (evidenceStatus === 'stale') return 'Re-run the canonical Development proof on the exact current Development SHA so every required gate has fresh evidence.';
      const gates = Array.isArray(summary.release_policy_required_gates) ? summary.release_policy_required_gates.length : 0;
      return `The ${gates || 'required'} Build 246 policy gate${gates === 1 ? '' : 's'} have exact-SHA workflow evidence; continue only through the normal dev → main promotion PR. This cockpit cannot authorize or perform that promotion.`;
    }
    if (status === 'content_current') return 'No source-content promotion is pending. Continue the roadmap or close the next operational acceptance rail.';
    return 'Open the established release path and resolve the comparison ambiguity before any Production promotion.';
  }

  function promotionHold(summary) {
    if (normalizedStatus(summary.repository_enforcement_status) !== 'ready') return 'Repository enforcement is not GREEN; exact-main release authority remains fail-closed.';
    if (!summary.github_divergence_evidence_available) return 'Live dev/main comparison evidence is unavailable; do not infer synchronization.';
    const status = String(summary.release_divergence_status || '').toLowerCase();
    if (status === 'development_changes_pending' && !summary.release_policy_available) return 'Development changes are pending but release classification evidence is incomplete; do not promote.';
    if (status === 'development_changes_pending' && !summary.release_evidence_checklist_available) return 'Development changes are pending but exact-SHA gate evidence is unavailable; do not promote.';
    if (status === 'development_changes_pending' && /missing|stale/.test(String(summary.release_evidence_checklist_status || '').toLowerCase())) return 'Development changes are pending and mandatory gate evidence is incomplete or stale; do not promote.';
    if (status === 'development_changes_pending') return 'Development contains source changes not yet represented in Production.';
    if (status === 'production_only_drift') return 'Production contains source history not represented in Development; reconciliation is required.';
    if (status === 'content_current') return 'No source-content promotion hold is indicated by the live GitHub comparison.';
    return 'The live GitHub comparison requires operator review before promotion.';
  }

  function releaseDivergenceCockpit(payload) {
    const summary = payload?.summary || {};
    const state = divergenceState(summary);
    const schemaCurrent = summary.schema_current === true;
    const schemaText = `${Number(summary.latest_applied_schema_version || 0)} / ${Number(summary.expected_schema_version || 0)}`;
    const compare = summary.github_divergence_evidence_available
      ? `${String(summary.github_compare_status || 'unknown').replaceAll('_',' ')} · +${Number(summary.development_commits_pending || 0)} dev / +${Number(summary.production_only_commits || 0)} main-only`
      : String(summary.release_divergence_error || 'Live GitHub comparison has not loaded.');
    return `<section id="releaseDivergenceCockpit" class="it-system-divergence" aria-labelledby="releaseDivergenceCockpitTitle">
      <div class="it-system-divergence-head"><div><span class="module-kicker">Build ${BUILD} · release divergence cockpit</span><h3 id="releaseDivergenceCockpitTitle">Development / Production release handoff</h3></div><span class="it-system-status" data-state="${esc(state.state)}">${esc(state.label)}</span></div>
      <div class="it-system-divergence-grid">
        <div><span>Development dev</span><strong>${esc(shortSha(summary.development_sha))}</strong><small>tree ${esc(shortSha(summary.development_tree_sha))}</small></div>
        <div><span>Production main</span><strong>${esc(shortSha(summary.production_sha))}</strong><small>tree ${esc(shortSha(summary.production_tree_sha))}</small></div>
        <div><span>Live comparison</span><strong>${esc(compare)}</strong><small>Read-only GitHub evidence; unavailable evidence never implies GREEN.</small></div>
        <div><span>Schema implication</span><strong>${esc(schemaCurrent ? `CURRENT ${schemaText}` : `REVIEW ${schemaText}`)}</strong><small>${esc(schemaCurrent ? 'Bounded readiness reports schema parity current.' : 'Schema drift must be resolved before dependent release work.')}</small></div>
      </div>
      <div class="it-system-divergence-notes">
        <p><strong>Canonical manifest:</strong> Build 244 release-candidate manifest contract is active in source tooling. It is descriptive evidence only and is not a browser-side release authority.</p>
        <p><strong>Promotion hold:</strong> ${esc(promotionHold(summary))}</p>
        <p><strong>Next safe action:</strong> ${esc(nextReleaseAction(summary))}</p>
      </div>
    </section>`;
  }

  function releaseClassificationCockpit(payload) {
    const summary = payload?.summary || {};
    const state = releasePolicyState(summary);
    const divergence = String(summary.release_divergence_status || '').toLowerCase();
    const gates = Array.isArray(summary.release_policy_required_gates) ? summary.release_policy_required_gates : [];
    const classes = Array.isArray(summary.release_policy_classes) ? summary.release_policy_classes : [];
    const migrations = Array.isArray(summary.release_policy_changed_migrations) ? summary.release_policy_changed_migrations : [];
    const error = String(summary.release_policy_error || '').trim();
    const sourceAuthority = String(summary.release_policy_source_authority || 'build_246_release_change_policy');
    const runtimeMode = String(summary.release_policy_runtime_mode || 'read_only_advisory_mirror');

    if (divergence === 'content_current') {
      return `<section id="releaseClassificationCockpit" class="it-system-policy" aria-labelledby="releaseClassificationCockpitTitle">
        <div class="it-system-divergence-head"><div><span class="module-kicker">Build ${BUILD} · Build 246 policy visibility</span><h3 id="releaseClassificationCockpitTitle">Release classification</h3></div><span class="it-system-status" data-state="ready">NO PENDING CANDIDATE</span></div>
        <p>No Development source-content promotion is pending, so there is no candidate diff to classify. The Build 246 classifier remains the source policy authority for the next candidate.</p>
      </section>`;
    }

    if (!summary.release_policy_available) {
      const reason = error || (divergence === 'production_only_drift'
        ? 'Production-only drift must be reconciled before a Development promotion candidate can be classified.'
        : 'Complete changed-file evidence is not available for the current Development candidate.');
      return `<section id="releaseClassificationCockpit" class="it-system-policy" aria-labelledby="releaseClassificationCockpitTitle">
        <div class="it-system-divergence-head"><div><span class="module-kicker">Build ${BUILD} · Build 246 policy visibility</span><h3 id="releaseClassificationCockpitTitle">Release classification</h3></div><span class="it-system-status" data-state="${esc(state.state)}">${esc(state.label)}</span></div>
        <p>${esc(reason)}</p>
        <small>Unavailable or incomplete classification evidence never implies a source-only or safe release. Production promotion remains separate and fail-closed.</small>
      </section>`;
    }

    return `<section id="releaseClassificationCockpit" class="it-system-policy" aria-labelledby="releaseClassificationCockpitTitle">
      <div class="it-system-divergence-head"><div><span class="module-kicker">Build ${BUILD} · Build 246 policy visibility</span><h3 id="releaseClassificationCockpitTitle">Release classification</h3></div><span class="it-system-status" data-state="${esc(state.state)}">${esc(state.label)}</span></div>
      <div class="it-system-policy-grid">
        <div><span>Detected class</span><strong>${esc(human(summary.release_policy_primary_class))}</strong><small>${esc(classes.length > 1 ? `Also: ${classes.slice(1).map(human).join(', ')}` : 'Primary Build 246 release class.')}</small></div>
        <div><span>Risk level</span><strong>${esc(String(summary.release_policy_risk_level || 'unknown').toUpperCase())}</strong><small>${summary.release_policy_manual_review_required === true ? 'Manual review is required by the policy profile.' : 'Normal policy review remains required.'}</small></div>
        <div><span>Evidence profile</span><strong>${esc(human(summary.release_policy_evidence_profile))}</strong><small>Determines the additional evidence gates selected for this candidate.</small></div>
        <div><span>Changed-file evidence</span><strong>${esc(Number(summary.release_policy_changed_file_count || 0))} file${Number(summary.release_policy_changed_file_count || 0) === 1 ? '' : 's'}</strong><small>${esc(migrations.length ? `Migration${migrations.length === 1 ? '' : 's'}: ${migrations.join(', ')}` : 'No SQL migration identified by the current candidate classifier.')}</small></div>
      </div>
      <div class="it-system-policy-gates"><strong>Mandatory gates before promotion</strong><ul>${gates.map((gate)=>`<li><code>${esc(gate)}</code></li>`).join('')}</ul></div>
      <div class="it-system-divergence-notes">
        <p><strong>Source policy authority:</strong> ${esc(sourceAuthority)} · runtime mode ${esc(human(runtimeMode))}.</p>
        <p><strong>Boundary:</strong> This read-only cockpit mirrors classification evidence only. It cannot run or mark gates passed, authorize Production, change repository policy, mutate schema/Auth/Finance/provider state, or perform promotion.</p>
      </div>
    </section>`;
  }

  function releaseEvidenceChecklistCockpit(payload) {
    const summary = payload?.summary || {};
    const state = releaseEvidenceState(summary);
    const divergence = String(summary.release_divergence_status || '').toLowerCase();
    const items = Array.isArray(summary.release_evidence_checklist_items) ? summary.release_evidence_checklist_items : [];
    const counts = summary.release_evidence_checklist_counts || {};
    const error = String(summary.release_evidence_checklist_error || '').trim();

    if (divergence === 'content_current' || String(summary.release_evidence_checklist_status || '').toLowerCase() === 'not_applicable') {
      return `<section id="releaseEvidenceChecklistCockpit" class="it-system-evidence" aria-labelledby="releaseEvidenceChecklistCockpitTitle">
        <div class="it-system-divergence-head"><div><span class="module-kicker">Build ${BUILD} · exact-SHA workflow evidence</span><h3 id="releaseEvidenceChecklistCockpitTitle">Release evidence checklist</h3></div><span class="it-system-status" data-state="ready">NOT APPLICABLE</span></div>
        <p>No Development source-content candidate is pending, so no mandatory candidate gate checklist applies. A future candidate must earn fresh exact-SHA evidence; prior workflow success is never carried forward automatically.</p>
      </section>`;
    }

    if (!summary.release_evidence_checklist_available) {
      return `<section id="releaseEvidenceChecklistCockpit" class="it-system-evidence" aria-labelledby="releaseEvidenceChecklistCockpitTitle">
        <div class="it-system-divergence-head"><div><span class="module-kicker">Build ${BUILD} · exact-SHA workflow evidence</span><h3 id="releaseEvidenceChecklistCockpitTitle">Release evidence checklist</h3></div><span class="it-system-status" data-state="open">EVIDENCE UNAVAILABLE</span></div>
        <p>${esc(error || 'Canonical workflow evidence is unavailable for the current candidate.')}</p>
        <small>Unavailable workflow evidence never marks a required gate proven. Restore the canonical exact-SHA evidence path before Production promotion.</small>
      </section>`;
    }

    const runNumber = Number(summary.release_evidence_checklist_workflow_run_number || 0);
    const runId = Number(summary.release_evidence_checklist_workflow_run_id || 0);
    const runLabel = runNumber ? `Run #${runNumber}${runId ? ` / ${runId}` : ''}` : runId ? `Run ${runId}` : 'No canonical run recorded';
    const age = summary.release_evidence_checklist_age_hours;
    const ageText = age === null || age === undefined ? 'age not recorded' : `${Number(age).toFixed(1)}h old`;
    const freshHours = Number(summary.release_evidence_checklist_fresh_hours || 24);
    return `<section id="releaseEvidenceChecklistCockpit" class="it-system-evidence" aria-labelledby="releaseEvidenceChecklistCockpitTitle">
      <div class="it-system-divergence-head"><div><span class="module-kicker">Build ${BUILD} · exact-SHA workflow evidence</span><h3 id="releaseEvidenceChecklistCockpitTitle">Release evidence checklist</h3></div><span class="it-system-status" data-state="${esc(state.state)}">${esc(state.label)}</span></div>
      <div class="it-system-evidence-summary">
        <div><span>Candidate SHA</span><strong>${esc(shortSha(summary.release_evidence_checklist_candidate_sha))}</strong><small>Must match the current Development candidate exactly.</small></div>
        <div><span>Canonical workflow</span><strong>${esc(runLabel)}</strong><small>${esc(`${human(summary.release_evidence_checklist_workflow_status)} / ${human(summary.release_evidence_checklist_workflow_conclusion)}`)}</small></div>
        <div><span>Freshness</span><strong>${esc(ageText)}</strong><small>Evidence older than ${esc(freshHours)} hours is stale, not proven.</small></div>
        <div><span>Gate totals</span><strong>${esc(Number(counts.proven || 0))} proven · ${esc(Number(counts.missing || 0))} missing</strong><small>${esc(Number(counts.stale || 0))} stale · ${esc(Number(counts.not_applicable || 0))} not applicable.</small></div>
      </div>
      <ul class="it-system-evidence-list">${items.map((item)=>{
        const status = String(item?.status || 'missing').toLowerCase();
        const stateName = status === 'proven' ? 'ready' : status === 'missing' ? 'blocked' : status === 'stale' ? 'action' : 'open';
        return `<li data-evidence-status="${esc(status)}"><span class="it-system-status" data-state="${esc(stateName)}">${esc(human(status).toUpperCase())}</span><div><code>${esc(item?.gate || 'unknown gate')}</code><small>${esc(item?.detail || 'No gate detail recorded.')}</small></div></li>`;
      }).join('')}</ul>
      <div class="it-system-divergence-notes">
        <p><strong>Evidence rule:</strong> only a successful matching gate step on the exact current Development SHA within the freshness window is shown as proven.</p>
        <p><strong>Boundary:</strong> This checklist does not rerun gates, mutate GitHub, record database evidence, change repository protection, or authorize Production. Canonical workflow and repository controls remain authoritative.</p>
      </div>
    </section>`;
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
      #${WORKSPACE_ID}[hidden]{display:none!important}.it-system-head,.it-system-divergence-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.it-system-head h2,.it-system-divergence-head h3{margin:2px 0 5px}.it-system-head p{margin:0;max-width:850px;color:#cbd5e1;line-height:1.45}.it-system-status{display:inline-flex;align-items:center;min-height:30px;padding:4px 9px;border:1px solid rgba(148,163,184,.28);border-radius:999px;font-size:.75rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.it-system-status[data-state="ready"]{border-color:rgba(52,211,153,.45);color:#d7ffe9}.it-system-status[data-state="action"]{border-color:rgba(251,191,36,.48);color:#fff3c4}.it-system-status[data-state="blocked"]{border-color:rgba(248,113,113,.5);color:#fee2e2}.it-system-status[data-state="open"]{color:#bae6fd;border-color:rgba(56,189,248,.45)}
      .it-system-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:14px 0}.it-system-metric{padding:10px 11px;border-radius:12px;background:rgba(30,41,59,.72);border:1px solid rgba(148,163,184,.16)}.it-system-metric span,.it-system-metric strong{display:block}.it-system-metric span{font-size:.75rem;color:#aebdd0}.it-system-metric strong{margin-top:4px;font-size:1.02rem;word-break:break-word}.it-system-context{display:grid;gap:8px;margin:10px 0 14px}.it-system-context div{padding:11px 12px;border-radius:12px;background:rgba(148,163,184,.07);color:#cbd5e1;line-height:1.45}
      .it-system-divergence,.it-system-policy,.it-system-evidence{margin:12px 0 14px;padding:14px;border:1px solid rgba(56,189,248,.34);border-radius:14px;background:rgba(2,132,199,.08)}.it-system-policy{border-color:rgba(167,139,250,.36);background:rgba(91,33,182,.09)}.it-system-evidence{border-color:rgba(45,212,191,.34);background:rgba(13,148,136,.07)}.it-system-policy>p,.it-system-evidence>p{color:#dbe6f4;line-height:1.45}.it-system-divergence-grid,.it-system-policy-grid,.it-system-evidence-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.it-system-divergence-grid>div,.it-system-policy-grid>div,.it-system-evidence-summary>div{padding:10px 11px;border-radius:11px;background:rgba(15,23,42,.66);border:1px solid rgba(148,163,184,.16)}.it-system-divergence-grid span,.it-system-divergence-grid strong,.it-system-divergence-grid small,.it-system-policy-grid span,.it-system-policy-grid strong,.it-system-policy-grid small,.it-system-evidence-summary span,.it-system-evidence-summary strong,.it-system-evidence-summary small{display:block}.it-system-divergence-grid span,.it-system-policy-grid span,.it-system-evidence-summary span{font-size:.74rem;color:#aebdd0}.it-system-divergence-grid strong,.it-system-policy-grid strong,.it-system-evidence-summary strong{margin-top:4px;word-break:break-word}.it-system-divergence-grid small,.it-system-policy-grid small,.it-system-evidence-summary small{margin-top:4px;color:#b9c8dc;line-height:1.35}.it-system-divergence-notes{display:grid;gap:6px;margin-top:10px}.it-system-divergence-notes p{margin:0;padding:9px 10px;border-radius:10px;background:rgba(148,163,184,.07);color:#d6e0ed;line-height:1.42}.it-system-policy-gates{margin-top:10px;padding:11px 12px;border-radius:11px;background:rgba(15,23,42,.66);border:1px solid rgba(167,139,250,.24)}.it-system-policy-gates>strong{display:block;margin-bottom:6px}.it-system-policy-gates ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 18px;margin:0;padding-left:1.2rem}.it-system-policy-gates li{min-width:0}.it-system-policy-gates code{font-size:.84em;white-space:normal;overflow-wrap:anywhere}.it-system-evidence-list{display:grid;gap:7px;margin:10px 0 0;padding:0;list-style:none}.it-system-evidence-list li{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:9px;padding:9px 10px;border-radius:11px;background:rgba(15,23,42,.66);border:1px solid rgba(148,163,184,.16)}.it-system-evidence-list .it-system-status{min-height:25px;font-size:.67rem}.it-system-evidence-list code,.it-system-evidence-list small{display:block}.it-system-evidence-list code{font-size:.87em;white-space:normal;overflow-wrap:anywhere}.it-system-evidence-list small{margin-top:4px;color:#b9c8dc;line-height:1.35}
      .it-system-remediation{margin:12px 0 14px;padding:13px 14px;border:1px solid rgba(251,191,36,.42);border-radius:13px;background:rgba(120,53,15,.16)}.it-system-remediation h3{margin:4px 0 7px}.it-system-remediation p{margin:0 0 8px;color:#e2e8f0;line-height:1.45}.it-system-remediation ol{margin:8px 0 10px;padding-left:1.3rem;color:#e2e8f0}.it-system-remediation li{margin:5px 0;line-height:1.4}.it-system-remediation small{display:block;color:#fef3c7;line-height:1.45}.it-system-remediation code{font-size:.9em}
      .it-system-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.it-system-card{text-align:left;min-width:0;padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(15,23,42,.72);color:inherit;cursor:pointer}.it-system-card:hover,.it-system-card:focus-visible{border-color:rgba(56,189,248,.62)}.it-system-card strong,.it-system-card small{display:block}.it-system-card small{margin-top:5px;color:#b9c8dc;line-height:1.4}.it-system-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:680px){.it-system-grid,.it-system-divergence-grid,.it-system-policy-grid,.it-system-policy-gates ul,.it-system-evidence-summary{grid-template-columns:1fr}.it-system-evidence-list li{grid-template-columns:1fr}.it-system-actions>*{flex:1 1 170px}.it-system-remediation,.it-system-divergence,.it-system-policy,.it-system-evidence{padding:12px}.it-system-remediation ol{padding-left:1.15rem}}
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
          <div><span class="module-kicker">Build ${BUILD} · focused operator workspace</span><h2 id="itSystemWorkspaceTitle">I.T. &amp; System</h2><p>Start with bounded source, repository, schema, Admin-access, dev/main handoff, Build 246 release classification and exact-SHA mandatory-gate workflow evidence, then jump into the established I.T. Readiness evidence needed for investigation. This presentation does not deploy, change repository protection, mutate database schema, change authentication/roles, rerun browser smoke, authorize Production, or create a new browser data/write authority.</p></div>
          <span class="it-system-status" data-state="${esc(status.state)}">${esc(status.label)}</span>
        </div>
        <div class="it-system-metrics" aria-label="Current I.T. and system readiness summary">${rows.map(([label,value])=>`<div class="it-system-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>
        <div class="it-system-context"><div><strong>Release evidence:</strong> ${esc(sourceContext(payload))}</div><div><strong>Operator context:</strong> ${esc(operatorContext(payload))}</div></div>
        ${releaseDivergenceCockpit(payload)}
        ${releaseClassificationCockpit(payload)}
        ${releaseEvidenceChecklistCockpit(payload)}
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
