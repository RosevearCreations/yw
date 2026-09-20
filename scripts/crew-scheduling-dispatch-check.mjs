import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/210_crew_scheduling_dispatch.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const ui=read('js/operations-cockpit.js');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');

for (const token of [
  'Schema 210 — Build 321 Crew Scheduling & Dispatch',
  'crew_id uuid references public.crews',
  'lead_profile_id uuid references public.profiles',
  'assigned_truck_equipment_item_id bigint references public.equipment_items',
  'assigned_trailer_equipment_item_id bigint references public.equipment_items',
  'assigned_equipment_item_ids jsonb',
  'travel_allowance_minutes',
  'route_order',
  'workability_state',
  'reschedule_reason',
  'cancellation_reason',
  'supersedes_dispatch_id',
  'conflict_override_note',
  'ywi_dispatch_resource_keys',
  'v_crew_dispatch_schedule',
  'v_crew_dispatch_work_order_candidates',
  'ywi_rpc_dispatch_schedule_v2',
  'Dispatch conflict detected',
  'locked out or unavailable',
  'jobs.job_scheduled',
  'contract_version', 
  "'build',321",
  "'schema',210",
  'ywi_crew_dispatch_security_assertions',
  "210,'210_crew_scheduling_dispatch'",
  '210 as expected_schema_version'
]) assert.ok(migration.includes(token), `Schema 210 missing ${token}`);

for (const token of [
  "v_crew_dispatch_schedule",
  "v_crew_directory",
  "v_crew_dispatch_work_order_candidates",
  "equipment_items",
  "crew_dispatch_meta: { build:321, schema:210",
  "supabase.rpc('ywi_rpc_dispatch_schedule_v2'",
  "scheduleStatus === 'dispatched' && workabilityState === 'blocked'",
  "build:321, schema:210"
]) assert.ok(operations.includes(token), `operations-manage missing ${token}`);

for (const token of [
  'Crew Scheduling &amp; Dispatch',
  'oc_crew_dispatch_form',
  'oc_crew_dispatch_board',
  'oc_dispatch_board_mode',
  'data-oc-dispatch-crew',
  'data-oc-dispatch-truck',
  'data-oc-dispatch-trailer',
  'data-oc-dispatch-equipment',
  'Estimated duration (min)',
  'Travel allowance (min)',
  'Recurring visit key',
  'Workability',
  'Conflict override note',
  'Edit / reschedule',
  'Dispatch now',
  'Cancel visit',
  "action:'dispatch_schedule'",
  'resetCrewDispatchForm',
  'loadDispatchIntoForm'
]) assert.ok(ui.includes(token), `Operations UI missing ${token}`);

assert.ok(boundaries.includes("dispatch_schedule: contract('dispatch_schedule', 'jobs', 'approve', 'write', 'dispatch', 'jobs.job_scheduled', true)"),'Existing Jobs dispatch authority must remain unchanged.');
assert.ok(!boundaries.includes('crew_dispatch_schedule:'),'Build 321 must not create a competing write action/source of truth.');
assert.equal(pkg.scripts['test:crew-scheduling-dispatch'],'node scripts/crew-scheduling-dispatch-check.mjs');
assert.equal(pkg.scripts['test:browser:crew-scheduling-dispatch'],'playwright test --config=playwright.config.mjs tests/browser/crew-scheduling-dispatch.spec.mjs');
assert.ok(workflow.includes('npm run test:crew-scheduling-dispatch'));
assert.ok(workflow.includes('npm run test:browser:crew-scheduling-dispatch'));
assert.ok(help.includes('Build 321') && help.includes('Crew Scheduling &amp; Dispatch'));
assert.ok(roadmap.includes('322 — Recurring Lawn & Yard Maintenance Engine'));

try { new Function(ui); }
catch(error) { assert.fail(`Operations UI JavaScript syntax failed: ${error}`); }

const require=createRequire(import.meta.url);
const ts=require('typescript');
const output=ts.transpileModule(operations,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:'supabase/functions/operations-manage/index.ts'});
const errors=(output.diagnostics||[]).filter((d)=>d.category===ts.DiagnosticCategory.Error);
assert.equal(errors.length,0,errors.map((d)=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join(' | '));

console.log('Build 321 Crew Scheduling & Dispatch source gate: PASS');
