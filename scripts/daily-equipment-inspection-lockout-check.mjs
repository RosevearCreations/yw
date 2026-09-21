import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(path)=>fs.readFileSync(path,'utf8');
const migration=read('sql/220_daily_equipment_inspection_lockout.sql');
const manage=read('supabase/functions/jobs-manage/index.ts');
const directory=read('supabase/functions/jobs-directory/index.ts');
const ui=read('js/jobs-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

const must=(source,needles,label)=>needles.forEach((needle)=>assert.ok(source.includes(needle),label+': missing '+needle));

must(migration,[
  'Schema 220 — Build 332 Daily Equipment Inspection & Lockout',
  'create table if not exists public.equipment_daily_inspection_templates',
  'create table if not exists public.equipment_daily_inspection_template_items',
  'create table if not exists public.equipment_daily_inspections',
  'create table if not exists public.equipment_daily_inspection_items',
  "inspection_stage in ('pre_use','post_use')",
  'is_safety_critical boolean not null default false',
  'supervisor_review_status',
  'return_to_service_status',
  'service_task_id uuid references public.equipment_service_tasks',
  'alter table public.equipment_daily_inspections enable row level security',
  'revoke all on table public.equipment_daily_inspections from public,anon,authenticated',
  'create or replace view public.v_equipment_daily_inspection_templates',
  'create or replace view public.v_equipment_daily_inspection_workbench',
  'create or replace view public.v_equipment_daily_inspection_summary',
  'DAILY-MOWER-PRE',
  'guards_safety',
  'cutting_components',
  'tires_wheels',
  'fuel_battery',
  'damage_defects'
],'Schema 220');
assert.ok(!migration.includes('create table if not exists public.equipment_items'),'Build 332 must reuse equipment_items.');
assert.ok(!migration.includes('create table if not exists public.equipment_service_tasks'),'Build 332 must reuse equipment_service_tasks.');

must(manage,[
  "body.action === 'daily_inspection_submit'",
  "body.action === 'daily_inspection_review'",
  "body.action === 'daily_inspection_return_to_service'",
  "task_type:'inspection'",
  "priority:'high'",
  "lockout_reason:'Safety-critical daily equipment inspection failure'",
  "return_to_service_status:'verified'",
  "task_status",
  "['resolved','cancelled']",
  'build:332, schema:220'
],'Build 332 Jobs write authority');

must(directory,[
  "'v_equipment_daily_inspection_templates'",
  "'v_equipment_daily_inspection_workbench'",
  "'v_equipment_daily_inspection_summary'",
  'equipment_daily_inspection_templates:',
  'equipment_daily_inspection_workbench:',
  'equipment_daily_inspection_summary:'
],'Build 332 directory');

must(ui,[
  'Daily Equipment Inspection &amp; Lockout',
  'data-build="332"',
  'eq_daily_inspection_stage',
  'eq_daily_inspection_template',
  'eq_daily_inspection_items',
  'Submit Daily Inspection',
  'daily_inspection_submit',
  'daily_inspection_review',
  'daily_inspection_return_to_service',
  'YES — LOCKOUT',
  'Verify Return'
],'Build 332 Equipment UI');

must(help,[
  'Build 332 — Daily Equipment Inspection &amp; Lockout',
  'safety-critical failure',
  'verified return to service'
],'Build 332 Help');
must(roadmap,['**332 — Daily Equipment Inspection & Lockout** is implemented','333 — Fleet, Trailer & Vehicle Operations'],'Build 332 roadmap');
must(pkg,['test:daily-equipment-inspection-lockout','test:browser:daily-equipment-inspection-lockout'],'Build 332 package scripts');
must(workflow,['npm run test:daily-equipment-inspection-lockout','npm run test:browser:daily-equipment-inspection-lockout'],'Build 332 CI wiring');

new Function(ui);
const require=createRequire(import.meta.url);
const ts=require('typescript');
for(const path of ['supabase/functions/jobs-manage/index.ts','supabase/functions/jobs-directory/index.ts']){
  const output=ts.transpileModule(read(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:path});
  const errors=(output.diagnostics||[]).filter((item)=>item.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,path+' must transpile without TypeScript syntax errors');
}

console.log('Build 332 Daily Equipment Inspection & Lockout source gate GREEN');
