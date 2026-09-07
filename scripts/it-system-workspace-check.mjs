#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {buildReleaseChangePolicy} from './release-change-policy.mjs';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const config=read('js/app-config.js');
const workspace=read('js/it-system-workspace.js');
const readiness=read('js/it-readiness-ui.js');
const runtime=read('supabase/functions/admin-it-readiness-runtime/index.ts');
const runtimePolicy=read('supabase/functions/_shared/release-change-policy-runtime.ts');
const preflight=read('scripts/repository-protection-preflight.mjs');
const preflightCheck=read('scripts/repository-protection-preflight-check.mjs');
const worker=read('server-worker.js');
const pkg=read('package.json');
const results=[];
const add=(name,ok,detail='')=>results.push({name,ok:!!ok,detail});
const all=(text,values)=>values.every((value)=>text.includes(value));

add('build248-lazy-route-loader', all(config,[
  'loadITSystemWorkspaceOnDemand',
  "event?.detail?.allowed !== 'it'",
  '/js/it-system-workspace.js?v=2026-09-07c',
  'data-ywi-it-system-workspace'
]), 'Build 248 preserves the established on-demand I.T. route loader and cache-busts only the focused helper; it remains outside the Core precache.');

add('build248-existing-it-authority', all(workspace,[
  'window.YWIITReadiness?.getSnapshot?.()',
  'itReadinessRefresh',
  'releaseDeploymentCockpit',
  'Schema drift',
  'Admin break-glass access',
  'Runtime and error health'
]), 'Build 248 still reads the established I.T. snapshot, reuses its refresh, and navigates existing readiness sections.');

add('build248-release-divergence-cockpit-preserved', all(workspace,[
  'releaseDivergenceCockpit',
  'releaseDivergenceCockpitTitle',
  'development_sha',
  'production_sha',
  'development_tree_sha',
  'production_tree_sha',
  'development_commits_pending',
  'production_only_commits',
  'release_divergence_status',
  'github_divergence_evidence_available',
  'Canonical manifest:',
  'Build 244 release-candidate manifest contract',
  'Promotion hold:',
  'Next safe action:'
]), 'Build 245 divergence evidence remains intact under Build 248.');

add('build248-admin-only-live-github-compare-read', all(runtime,[
  'GITHUB_COMPARE_URL',
  'https://api.github.com/repos/RosevearCreations/yw/compare/main...dev',
  'loadReleaseDivergence',
  'fetchGithubJson(GITHUB_COMPARE_URL, 2500)',
  'application/vnd.github+json',
  'github_divergence_evidence_available',
  'release_divergence_error'
]), 'Existing Admin-only readiness runtime still performs the bounded public GitHub compare read and returns advisory evidence.');

add('build248-classifies-existing-compare-file-evidence', all(runtime,[
  'payload?.files',
  'buildRuntimeReleaseChangePolicy(changedFiles)',
  'GITHUB_COMPARE_FILE_CAP = 300',
  'classification_incomplete',
  'changed_file_evidence_unavailable',
  'release_policy_available',
  'release_policy_primary_class',
  'release_policy_risk_level',
  'release_policy_evidence_profile',
  'release_policy_required_gates',
  'release_policy_changed_migrations'
]), 'Build 247 classification remains intact and refuses to infer a class when changed-file evidence is absent or reaches the compare cap.');

add('build248-runtime-policy-is-read-only-mirror', all(runtimePolicy,[
  'build_246_release_change_policy',
  'read_only_advisory_mirror',
  'release_authorization_performed: false',
  'production_promotion_performed: false',
  'database_mutation_performed: false',
  'auth_or_permission_mutation_performed: false',
  'finance_posting_enabled: false',
  'provider_mutation_performed: false'
]), 'Runtime classification explicitly identifies Build 246 as source authority and cannot perform release or mutation actions.');

const paritySamples=[
  ['sql/208_example.sql'],
  ['supabase/functions/auth-admin/index.ts'],
  ['scripts/finance-payment-provider-preflight.mjs'],
  ['.github/workflows/staging-browser-integration.yml'],
  ['help.html','sitemap.xml'],
  ['js/mobile-today.js'],
];
add('build248-runtime-policy-catalog-covers-build246-source-profiles', paritySamples.every((files)=>{
  const policy=buildReleaseChangePolicy(files);
  return runtimePolicy.includes(policy.primary_class)
    && runtimePolicy.includes(policy.evidence_profile)
    && policy.required_gate_scripts.every((gate)=>runtimePolicy.includes(gate));
}), 'Representative Build 246 source-policy classes, evidence profiles and mandatory gates remain represented in the bounded runtime mirror.');

add('build248-release-classification-cockpit-preserved', all(workspace,[
  'releaseClassificationCockpit',
  'releaseClassificationCockpitTitle',
  'Detected class',
  'Risk level',
  'Evidence profile',
  'Changed-file evidence',
  'Mandatory gates before promotion',
  'release_policy_primary_class',
  'release_policy_risk_level',
  'release_policy_evidence_profile',
  'release_policy_required_gates',
  'release_policy_changed_file_count',
  'release_policy_changed_migrations',
  'NO PENDING CANDIDATE',
  'CLASSIFICATION UNAVAILABLE'
]), 'Build 247 class/risk/evidence/gate visibility remains intact under Build 248.');

add('build248-exact-sha-workflow-evidence-read', all(runtime,[
  'GITHUB_ACTIONS_RUNS_URL',
  'https://api.github.com/repos/RosevearCreations/yw/actions/runs',
  'GITHUB_WORKFLOW_NAME = "YWI source and staging checks"',
  'GITHUB_WORKFLOW_PATH = ".github/workflows/staging-browser-integration.yml"',
  'head_sha=${encodeURIComponent(candidateSha)}',
  'event=pull_request&per_page=10',
  '/jobs?filter=latest&per_page=100',
  'source-checks',
  'loadReleaseGateChecklist'
]), 'Build 248 reads only bounded canonical Actions metadata for the exact Development candidate SHA and its source-checks steps.');

add('build248-gate-evidence-freshness-and-four-state-contract', all(runtime,[
  'RELEASE_GATE_EVIDENCE_FRESH_HOURS = 24',
  '"proven" | "missing" | "stale" | "not_applicable"',
  'Gate step completed successfully on the exact current Development SHA within the evidence freshness window.',
  'workflow evidence is older than ${RELEASE_GATE_EVIDENCE_FRESH_HOURS} hours',
  'No canonical pull-request workflow run is recorded on this exact Development SHA.',
  'release_evidence_checklist_status',
  'release_evidence_checklist_items',
  'release_evidence_checklist_counts',
  'release_evidence_checklist_age_hours',
  'release_evidence_checklist_fresh_hours'
]), 'Each mandatory gate can be proven, missing, stale or not applicable; freshness is bounded to 24 hours and tied to exact-SHA workflow evidence.');

add('build248-gate-step-matching-is-policy-driven', all(runtime,[
  'release.policy?.required_gate_scripts',
  'const expected = `Run npm run ${gate}`',
  'name.includes(`npm run ${gate}`)',
  'conclusion !== "success"',
  'counts.missing > 0 ? "missing" : counts.stale > 0 ? "stale" : "proven"'
]), 'Build 248 derives the checklist from Build 246 required gate scripts and never invents a second gate catalog.');

add('build248-workflow-evidence-fails-closed', all(runtime,[
  'evidence_unavailable',
  'Build 246 release classification must be complete before required-gate workflow evidence can be evaluated.',
  'Canonical workflow evidence could not be loaded.',
  'Required gate step is not present in the selected canonical workflow evidence.',
  'success on the exact candidate SHA is required.'
]), 'Unavailable, absent, skipped or failed workflow evidence cannot be represented as proven.');

add('build248-release-evidence-checklist-cockpit', all(workspace,[
  'releaseEvidenceChecklistCockpit',
  'releaseEvidenceChecklistCockpitTitle',
  'Release evidence checklist',
  'Candidate SHA',
  'Canonical workflow',
  'Freshness',
  'Gate totals',
  'data-evidence-status',
  'ALL GATES PROVEN',
  'EVIDENCE UNAVAILABLE',
  'NOT APPLICABLE',
  'release_evidence_checklist_candidate_sha',
  'release_evidence_checklist_workflow_run_number',
  'release_evidence_checklist_items'
]), 'The I.T. cockpit renders exact candidate SHA, workflow run, freshness, totals and per-gate evidence status.');

add('build248-checklist-does-not-fabricate-green-or-authority', all(workspace,[
  'only a successful matching gate step on the exact current Development SHA within the freshness window is shown as proven',
  'Unavailable workflow evidence never marks a required gate proven',
  'does not rerun gates',
  'mutate GitHub',
  'record database evidence',
  'change repository protection',
  'authorize Production',
  'Canonical workflow and repository controls remain authoritative'
]), 'Build 248 is an evidence viewer, not a gate executor, recorder, repository mutator or Production authority.');

add('build248-classification-does-not-fabricate-green', all(workspace,[
  'Unavailable or incomplete classification evidence never implies a source-only or safe release',
  'release_policy_available',
  'Restore complete changed-file evidence before any Production promotion',
  'This read-only cockpit mirrors classification evidence only',
  'cannot run or mark gates passed',
  'authorize Production'
]), 'Missing policy evidence is still an explicit hold/review state and cannot become an inferred safe class.');

add('build248-github-read-degrades-without-false-green', all(runtime,[
  'evidence_unavailable',
  'available: false',
  'error: String',
  'content_current',
  'development_changes_pending',
  'production_only_drift',
  'review_required'
]) && workspace.includes('unavailable evidence never implies GREEN'), 'GitHub read failure degrades to unavailable evidence and never fabricates synchronization.');

add('build248-no-browser-direct-data-authority', !/(YWIAPI|supabase|jsonFetch|manageAdminEntity|fetch\s*\()/i.test(workspace), 'Focused I.T. presentation still adds no browser API/database/GitHub authority.');

add('build248-github-reads-are-nonmutating', runtime.includes('compare/main...dev') && runtime.includes('/actions/runs') && !/(api\.github\.com[\s\S]{0,260}(POST|PATCH|PUT|DELETE)|gh api|update_ref|branches\/main\/protection)/i.test(runtime), 'Build 248 performs compare/actions read-only evidence requests and contains no GitHub mutation path.');

add('build248-authority-not-expanded', all(workspace,[
  'descriptive evidence only',
  'cannot authorize or perform that promotion',
  'does not deploy',
  'change repository protection',
  'mutate database schema',
  'change authentication/roles',
  'authorize Production',
  'new browser data/write authority'
]), 'Divergence, classification and evidence cockpits remain advisory and cannot become release/deployment authority.');

add('build248-schema-and-hold-ordering', all(workspace,[
  'Schema implication',
  'schema_current',
  'Repository enforcement is not GREEN',
  'Reconcile Production-only history back into dev',
  'normal dev → main promotion PR',
  'No source-content promotion is pending',
  'mandatory gate evidence is incomplete or stale; do not promote'
]), 'Build 248 prioritizes repository enforcement, schema truth, gate evidence and lineage-safe next actions rather than treating checklist visibility as release authority.');

add('build248-actionable-repository-remediation', all(workspace,[
  'repositoryEnforcementRemediation',
  'Settings → Branches',
  'classic branch protection rule targeting main',
  'Require a pull request before merging',
  'force pushes and branch deletion disabled',
  'protected=true on that same main SHA',
  'cannot enable branch protection',
  'cannot mark the gate green',
  'cannot bypass repository enforcement'
]), 'Existing exact manual repository-enforcement mechanic remains intact.');

add('build248-preflight-blocker-contract', all(preflight,[
  'blocker_codes',
  'main_unprotected',
  'main_sha_mismatch',
  'missing_github_main_evidence',
  'next_safe_action',
  'REPOSITORY_PROTECTION_REMEDIATION',
  'automatic_fix_supported:false',
  'GITHUB_STEP_SUMMARY',
  'process.exitCode=1'
]), 'Exact-main preflight remains the authoritative fail-closed repository gate.');

add('build248-preflight-tests', all(preflightCheck,[
  'unprotected-main-is-locked-with-actionable-remediation',
  'stale-main-sha-is-locked-with-fresh-run-action',
  'github-step-summary-is-actionable-and-cannot-claim-auto-fix',
  'workflow-does-not-use-green-ci-as-protection-proof'
]), 'Existing source tests still prove remediation cannot stand in for enforcement evidence.');

add('build248-no-precache', !worker.match(/APP_SHELL\s*=\s*\[[\s\S]*it-system-workspace\.js/), 'Build 248 I.T. workspace JavaScript stays outside the Core precache list.');

add('build248-observer-bounded', workspace.includes("document.getElementById('itReadinessWorkspace')") && workspace.includes('observer.observe(source') && !workspace.includes("observer.observe(document.getElementById(WORKSPACE_ID)"), 'Build 248 observes the established readiness host only and cannot self-observe its rendered workspace.');

add('build248-readiness-authority-preserved', all(readiness,[
  "jsonFetch?.('admin-it-readiness-runtime'",
  "e?.detail?.allowed==='it'&&isAdmin()",
  'Deep assertion graphs stay in explicit CI/operator verification',
  'Production promotion remains a separate manual human decision'
]), 'Existing bounded I.T. runtime/release authority remains authoritative.');

add('build248-browser-acceptance-registered', pkg.includes('tests/browser/it-system-workspace.spec.mjs'), 'Rendered Build 248 acceptance remains part of the canonical module-browser suite.');

const failed=results.filter((row)=>!row.ok);
for(const row of results) console.log(`${row.ok?'PASS':'FAIL'} ${row.name}${row.detail?` - ${row.detail}`:''}`);
if(failed.length){console.error(`\nBuild 248 I.T. release-evidence checklist gate failed: ${failed.length}/${results.length}`);process.exit(1);}
console.log(`\nBuild 248 I.T. release-evidence checklist gate passed: ${results.length}/${results.length}`);
