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
