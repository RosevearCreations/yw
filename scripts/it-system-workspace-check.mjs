#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const config=read('js/app-config.js');
const workspace=read('js/it-system-workspace.js');
const readiness=read('js/it-readiness-ui.js');
const worker=read('server-worker.js');
const pkg=read('package.json');
const results=[];
const add=(name,ok,detail='')=>results.push({name,ok:!!ok,detail});
const all=(text,values)=>values.every((value)=>text.includes(value));

add('build239-lazy-route-loader', all(config,[
  'loadITSystemWorkspaceOnDemand',
  "event?.detail?.allowed !== 'it'",
  '/js/it-system-workspace.js?v=2026-09-07a',
  'data-ywi-it-system-workspace'
]), 'Build 239 is fetched only after the established router opens the I.T. route.');

add('build239-existing-it-authority', all(workspace,[
  'window.YWIITReadiness?.getSnapshot?.()',
  'itReadinessRefresh',
  'releaseDeploymentCockpit',
  'Schema drift',
  'Admin break-glass access',
  'Runtime and error health'
]), 'Build 239 reads the established I.T. snapshot, reuses its refresh, and navigates existing readiness sections.');

add('build239-bounded-summary', all(workspace,[
  'source_gate_status',
  'repository_enforcement_status',
  'latest_applied_schema_version',
  'expected_schema_version',
  'admin_access_integrity_blockers',
  'open_rail_acceptance_count',
  'current_todo_count'
]), 'I.T. & System summary is bounded to the already-loaded readiness snapshot and concise operator context.');

add('build239-no-direct-data-authority', !/(YWIAPI|supabase|jsonFetch|manageAdminEntity|fetch\s*\()/i.test(workspace), 'Focused I.T. presentation adds no direct API/database authority.');

add('build239-no-side-effect-shortcuts', !/(runSmokeCheck|itReadinessSmoke|admin-it-readiness-runtime|repository:protection:require|release:evidence:write|update_ref|supabase\.auth\.admin)/i.test(workspace), 'Build 239 cannot directly run smoke, readiness endpoints, repository mutations, release writes, or Auth-admin actions.');

add('build239-no-precache', !worker.match(/APP_SHELL\s*=\s*\[[\s\S]*it-system-workspace\.js/), 'Build 239 I.T. workspace JavaScript stays outside the Core precache list.');

add('build239-observer-bounded', workspace.includes("document.getElementById('itReadinessWorkspace')") && workspace.includes('observer.observe(source') && !workspace.includes("observer.observe(document.getElementById(WORKSPACE_ID)"), 'Build 239 observes the established readiness host only and cannot self-observe its rendered workspace.');

add('build239-readiness-authority-preserved', all(readiness,[
  "jsonFetch?.('admin-it-readiness-runtime'",
  "e?.detail?.allowed==='it'&&isAdmin()",
  'Deep assertion graphs stay in explicit CI/operator verification',
  'Production promotion remains a separate manual human decision'
]), 'Existing bounded I.T. runtime/release authority remains unchanged and authoritative.');

add('build239-browser-acceptance-registered', pkg.includes('tests/browser/it-system-workspace.spec.mjs'), 'Rendered Build 239 acceptance is part of the canonical module-browser suite.');

add('build239-presentation-boundary-copy', all(workspace,[
  'does not deploy',
  'change repository protection',
  'mutate database schema',
  'change authentication/roles',
  'run browser smoke',
  'new data/write authority'
]), 'The focused I.T. workspace states its non-mutating release/security boundary in the operator UI.');

const failed=results.filter((row)=>!row.ok);
for(const row of results) console.log(`${row.ok?'PASS':'FAIL'} ${row.name}${row.detail?` - ${row.detail}`:''}`);
if(failed.length){console.error(`\nBuild 239 I.T. & System workspace gate failed: ${failed.length}/${results.length}`);process.exit(1);}
console.log(`\nBuild 239 I.T. & System workspace gate passed: ${results.length}/${results.length}`);
