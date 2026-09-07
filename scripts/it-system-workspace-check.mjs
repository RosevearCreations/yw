#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const config=read('js/app-config.js');
const workspace=read('js/it-system-workspace.js');
const readiness=read('js/it-readiness-ui.js');
const runtime=read('supabase/functions/admin-it-readiness-runtime/index.ts');
const preflight=read('scripts/repository-protection-preflight.mjs');
const preflightCheck=read('scripts/repository-protection-preflight-check.mjs');
const worker=read('server-worker.js');
const pkg=read('package.json');
const results=[];
const add=(name,ok,detail='')=>results.push({name,ok:!!ok,detail});
const all=(text,values)=>values.every((value)=>text.includes(value));

add('build245-lazy-route-loader', all(config,[
  'loadITSystemWorkspaceOnDemand',
  "event?.detail?.allowed !== 'it'",
  '/js/it-system-workspace.js?v=2026-09-07a',
  'data-ywi-it-system-workspace'
]), 'Build 245 preserves the established on-demand I.T. route loader; the helper remains outside the Core precache.');

add('build245-existing-it-authority', all(workspace,[
  'window.YWIITReadiness?.getSnapshot?.()',
  'itReadinessRefresh',
  'releaseDeploymentCockpit',
  'Schema drift',
  'Admin break-glass access',
  'Runtime and error health'
]), 'Build 245 still reads the established I.T. snapshot, reuses its refresh, and navigates existing readiness sections.');

add('build245-release-divergence-cockpit', all(workspace,[
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
]), 'Build 245 presents live dev/main divergence, manifest context, hold reason, schema implication and next safe action from the bounded readiness snapshot.');

add('build245-admin-only-live-github-read', all(runtime,[
  'GITHUB_COMPARE_URL',
  'https://api.github.com/repos/RosevearCreations/yw/compare/main...dev',
  'loadReleaseDivergence',
  'AbortController',
  '2500',
  'application/vnd.github+json',
  'github_divergence_evidence_available',
  'release_divergence_error'
]), 'Existing Admin-only readiness runtime performs one bounded public GitHub compare read and returns advisory evidence.');

add('build245-github-read-degrades-without-false-green', all(runtime,[
  'evidence_unavailable',
  'available: false',
  'error: String',
  'content_current',
  'development_changes_pending',
  'production_only_drift',
  'review_required'
]) && workspace.includes('unavailable evidence never implies GREEN'), 'GitHub read failure degrades to unavailable evidence and never fabricates synchronization.');

add('build245-no-browser-direct-data-authority', !/(YWIAPI|supabase|jsonFetch|manageAdminEntity|fetch\s*\()/i.test(workspace), 'Focused I.T. presentation still adds no browser API/database/GitHub authority.');

add('build245-github-read-is-nonmutating', runtime.includes('compare/main...dev') && !/(api\.github\.com[\s\S]{0,240}(POST|PATCH|PUT|DELETE)|gh api|update_ref|branches\/main\/protection)/i.test(runtime), 'Build 245 GitHub integration is comparison-only and contains no GitHub mutation path.');

add('build245-authority-not-expanded-by-divergence', all(workspace,[
  'descriptive evidence only',
  'cannot authorize or perform that promotion',
  'does not deploy',
  'change repository protection',
  'mutate database schema',
  'change authentication/roles',
  'authorize Production',
  'new browser data/write authority'
]), 'Cockpit explicitly remains advisory and cannot become a release/deployment authority.');

add('build245-schema-and-hold-ordering', all(workspace,[
  'Schema implication',
  'schema_current',
  'Repository enforcement is not GREEN',
  'Reconcile Production-only history back into dev',
  'normal dev → main promotion PR',
  'No source-content promotion is pending'
]), 'Build 245 prioritizes repository enforcement, schema truth and lineage-safe next actions rather than treating tree equality as release authority.');

add('build245-actionable-repository-remediation', all(workspace,[
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

add('build245-preflight-blocker-contract', all(preflight,[
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

add('build245-preflight-tests', all(preflightCheck,[
  'unprotected-main-is-locked-with-actionable-remediation',
  'stale-main-sha-is-locked-with-fresh-run-action',
  'github-step-summary-is-actionable-and-cannot-claim-auto-fix',
  'workflow-does-not-use-green-ci-as-protection-proof'
]), 'Existing source tests still prove remediation cannot stand in for enforcement evidence.');

add('build245-no-precache', !worker.match(/APP_SHELL\s*=\s*\[[\s\S]*it-system-workspace\.js/), 'Build 245 I.T. workspace JavaScript stays outside the Core precache list.');

add('build245-observer-bounded', workspace.includes("document.getElementById('itReadinessWorkspace')") && workspace.includes('observer.observe(source') && !workspace.includes("observer.observe(document.getElementById(WORKSPACE_ID)"), 'Build 245 observes the established readiness host only and cannot self-observe its rendered workspace.');

add('build245-readiness-authority-preserved', all(readiness,[
  "jsonFetch?.('admin-it-readiness-runtime'",
  "e?.detail?.allowed==='it'&&isAdmin()",
  'Deep assertion graphs stay in explicit CI/operator verification',
  'Production promotion remains a separate manual human decision'
]), 'Existing bounded I.T. runtime/release authority remains authoritative.');

add('build245-browser-acceptance-registered', pkg.includes('tests/browser/it-system-workspace.spec.mjs'), 'Rendered Build 245 acceptance remains part of the canonical module-browser suite.');

const failed=results.filter((row)=>!row.ok);
for(const row of results) console.log(`${row.ok?'PASS':'FAIL'} ${row.name}${row.detail?` - ${row.detail}`:''}`);
if(failed.length){console.error(`\nBuild 245 I.T. release-divergence gate failed: ${failed.length}/${results.length}`);process.exit(1);}
console.log(`\nBuild 245 I.T. release-divergence gate passed: ${results.length}/${results.length}`);
