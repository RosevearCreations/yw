#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const config=read('js/app-config.js');
const workspace=read('js/it-system-workspace.js');
const readiness=read('js/it-readiness-ui.js');
const preflight=read('scripts/repository-protection-preflight.mjs');
const preflightCheck=read('scripts/repository-protection-preflight-check.mjs');
const worker=read('server-worker.js');
const pkg=read('package.json');
const results=[];
const add=(name,ok,detail='')=>results.push({name,ok:!!ok,detail});
const all=(text,values)=>values.every((value)=>text.includes(value));

add('build240-lazy-route-loader', all(config,[
  'loadITSystemWorkspaceOnDemand',
  "event?.detail?.allowed !== 'it'",
  '/js/it-system-workspace.js?v=2026-09-07a',
  'data-ywi-it-system-workspace'
]), 'Build 240 preserves the established on-demand I.T. route loader; the helper remains outside the Core precache.');

add('build240-existing-it-authority', all(workspace,[
  'window.YWIITReadiness?.getSnapshot?.()',
  'itReadinessRefresh',
  'releaseDeploymentCockpit',
  'Schema drift',
  'Admin break-glass access',
  'Runtime and error health'
]), 'Build 240 still reads the established I.T. snapshot, reuses its refresh, and navigates existing readiness sections.');

add('build240-bounded-summary', all(workspace,[
  'source_gate_status',
  'repository_enforcement_status',
  'branch_protection_reported',
  'latest_applied_schema_version',
  'expected_schema_version',
  'admin_access_integrity_blockers',
  'open_rail_acceptance_count',
  'current_todo_count'
]), 'I.T. & System summary remains bounded to the already-loaded readiness snapshot and concise operator context.');

add('build240-actionable-repository-remediation', all(workspace,[
  'repositoryEnforcementRemediation',
  'Settings → Branches',
  'classic branch protection rule targeting main',
  'Require a pull request before merging',
  'force pushes and branch deletion disabled',
  'protected=true on that same main SHA',
  'cannot enable branch protection',
  'cannot mark the gate green',
  'cannot bypass repository enforcement'
]), 'The I.T. workspace exposes the exact manual repository-enforcement mechanic without claiming it can execute the change.');

add('build240-preflight-blocker-contract', all(preflight,[
  'blocker_codes',
  'main_unprotected',
  'main_sha_mismatch',
  'missing_github_main_evidence',
  'next_safe_action',
  'REPOSITORY_PROTECTION_REMEDIATION',
  'automatic_fix_supported:false',
  'GITHUB_STEP_SUMMARY',
  'process.exitCode=1'
]), 'Exact-main preflight reports deterministic blocker/remediation state and still fails closed.');

add('build240-preflight-tests', all(preflightCheck,[
  'unprotected-main-is-locked-with-actionable-remediation',
  'stale-main-sha-is-locked-with-fresh-run-action',
  'github-step-summary-is-actionable-and-cannot-claim-auto-fix',
  'workflow-does-not-use-green-ci-as-protection-proof'
]), 'Source tests prove unprotected/stale main remains locked and remediation cannot stand in for enforcement evidence.');

add('build240-no-direct-data-authority', !/(YWIAPI|supabase|jsonFetch|manageAdminEntity|fetch\s*\()/i.test(workspace), 'Focused I.T. presentation adds no direct API/database authority.');

add('build240-no-side-effect-shortcuts', !/(runSmokeCheck|itReadinessSmoke|admin-it-readiness-runtime|repository:protection:require|release:evidence:write|update_ref|supabase\.auth\.admin|gh api|branches\/main)/i.test(workspace), 'Build 240 cannot directly run smoke, readiness endpoints, GitHub mutations/lookups, release writes, or Auth-admin actions.');

add('build240-no-protection-bypass', !/(automatic_fix_supported\s*:\s*true|YWI_GITHUB_MAIN_PROTECTED\s*=\s*['"]true['"]|main_protected\s*:\s*true)/i.test(preflight), 'Remediation code contains no automatic protection enablement or hard-coded green evidence.');

add('build240-no-precache', !worker.match(/APP_SHELL\s*=\s*\[[\s\S]*it-system-workspace\.js/), 'Build 240 I.T. workspace JavaScript stays outside the Core precache list.');

add('build240-observer-bounded', workspace.includes("document.getElementById('itReadinessWorkspace')") && workspace.includes('observer.observe(source') && !workspace.includes("observer.observe(document.getElementById(WORKSPACE_ID)"), 'Build 240 observes the established readiness host only and cannot self-observe its rendered workspace.');

add('build240-readiness-authority-preserved', all(readiness,[
  "jsonFetch?.('admin-it-readiness-runtime'",
  "e?.detail?.allowed==='it'&&isAdmin()",
  'Deep assertion graphs stay in explicit CI/operator verification',
  'Production promotion remains a separate manual human decision'
]), 'Existing bounded I.T. runtime/release authority remains unchanged and authoritative.');

add('build240-browser-acceptance-registered', pkg.includes('tests/browser/it-system-workspace.spec.mjs'), 'Rendered Build 240 acceptance remains part of the canonical module-browser suite.');

add('build240-presentation-boundary-copy', all(workspace,[
  'does not deploy',
  'change repository protection',
  'mutate database schema',
  'change authentication/roles',
  'run browser smoke',
  'new data/write authority'
]), 'The focused I.T. workspace states its non-mutating release/security boundary in the operator UI.');

const failed=results.filter((row)=>!row.ok);
for(const row of results) console.log(`${row.ok?'PASS':'FAIL'} ${row.name}${row.detail?` - ${row.detail}`:''}`);
if(failed.length){console.error(`\nBuild 240 I.T. release-governance gate failed: ${failed.length}/${results.length}`);process.exit(1);}
console.log(`\nBuild 240 I.T. release-governance gate passed: ${results.length}/${results.length}`);
