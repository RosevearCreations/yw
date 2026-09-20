import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/211_recurring_lawn_yard_maintenance.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const scheduler=read('supabase/functions/service-execution-scheduler-run/index.ts');
const ui=read('js/operations-cockpit.js');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');

for (const token of [
  'Schema 211 — Build 322 Recurring Lawn & Yard Maintenance Engine',
  "service_program_type text not null default 'other'",
  "recurrence_frequency text not null default 'weekly'",
  'recurrence_anchor_date date',
  'custom_interval_days integer',
  'preferred_weekday integer',
  'service_window_start time',
  'service_window_end time',
  'season_start_month integer',
  'season_end_month integer',
  'default_travel_allowance_minutes integer',
  'weather_delay_policy text',
  'customer_hold_until date',
  'recurring_service_visit_events',
  "event_type in ('skip','weather_delay','makeup','customer_hold','resume','cancel_visit')",
  'ywi_recurring_date_in_season',
  'ywi_recurring_service_occurrences',
  'v_recurring_service_visit_schedule',
  'v_recurring_service_program_directory',
  'ywi_rpc_recurring_program_save',
  'ywi_rpc_recurring_visit_event',
  "when 'weekly'",
  "when 'biweekly'",
  "when 'custom_days'",
  "when 'seasonal_once'",
  "when e.latest_event_type='weather_delay' then 'weather_delayed'",
  "when e.latest_event_type='makeup' then 'makeup'",
  'v_service_agreement_execution_candidates',
  'v_service_execution_scheduler_candidates',
  "('recurring_service_program_save','jobs','approve','write'",
  "('recurring_service_visit_event','jobs','approve','write'",
  'ywi_recurring_service_security_assertions',
  "211,'211_recurring_lawn_yard_maintenance'",
  '211 as expected_schema_version'
]) assert.ok(migration.includes(token), `Schema 211 missing ${token}`);

for (const token of [
  "v_recurring_service_program_directory",
  "v_recurring_service_visit_schedule",
  "recurring_service_meta: { build:322, schema:211",
  "action === 'recurring_service_program_save'",
  "action === 'recurring_service_visit_event'",
  "supabase.rpc('ywi_rpc_recurring_program_save'",
  "supabase.rpc('ywi_rpc_recurring_visit_event'",
  'build:322,schema:211'
]) assert.ok(operations.includes(token), `operations-manage missing ${token}`);

for (const token of [
  'Recurring Lawn &amp; Yard Maintenance',
  'oc_recurring_program_form',
  'oc_recurring_programs',
  'oc_recurring_visits',
  'Weekly',
  'Biweekly',
  'Custom days',
  'Seasonal once',
  'Weather delay',
  'Make-up date',
  'Customer hold',
  'Resume',
  'Cancel visit',
  "action:'recurring_service_program_save'",
  "action:'recurring_service_visit_event'"
]) assert.ok(ui.includes(token), `Operations UI missing ${token}`);

assert.ok(boundaries.includes("recurring_service_program_save: contract('recurring_service_program_save', 'jobs', 'approve', 'write', 'recurring_service', 'jobs.recurring_service.program_saved')"));
assert.ok(boundaries.includes("recurring_service_visit_event: contract('recurring_service_visit_event', 'jobs', 'approve', 'write', 'recurring_service', 'jobs.recurring_service.visit_event_recorded')"));
assert.ok(!boundaries.includes("recurring_service_dispatch:"),'Build 322 must not create a second dispatch authority.');
assert.ok(scheduler.includes("service_frequency_label: frequencyLabel"));
assert.ok(scheduler.includes('Build 322 recurring visit'));
assert.equal(pkg.scripts['test:recurring-lawn-yard-maintenance'],'node scripts/recurring-lawn-yard-maintenance-check.mjs');
assert.equal(pkg.scripts['test:browser:recurring-lawn-yard-maintenance'],'playwright test --config=playwright.config.mjs tests/browser/recurring-lawn-yard-maintenance.spec.mjs');
assert.ok(workflow.includes('npm run test:recurring-lawn-yard-maintenance'));
assert.ok(workflow.includes('npm run test:browser:recurring-lawn-yard-maintenance'));
assert.ok(help.includes('Build 322') && help.includes('Recurring Lawn &amp; Yard Maintenance'));
assert.ok(roadmap.includes('323 — Property & Site Intelligence'));
assert.ok(!migration.includes("greatest(current_date, coalesce(a.start_date, current_date)) as candidate_date"),'Legacy today-only recurrence candidate logic must be replaced.');

try { new Function(ui); }
catch(error) { assert.fail(`Operations UI JavaScript syntax failed: ${error}`); }

const require=createRequire(import.meta.url);
const ts=require('typescript');
for(const [file,content] of [
  ['supabase/functions/operations-manage/index.ts',operations],
  ['supabase/functions/service-execution-scheduler-run/index.ts',scheduler]
]){
  const output=ts.transpileModule(content,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  const errors=(output.diagnostics||[]).filter((d)=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,errors.map((d)=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join(' | '));
}

console.log('Build 322 Recurring Lawn & Yard Maintenance Engine source gate: PASS');
