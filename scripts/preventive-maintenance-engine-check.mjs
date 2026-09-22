import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/222_preventive_maintenance_engine.sql');
const manage=read('supabase/functions/jobs-manage/index.ts');
const directory=read('supabase/functions/jobs-directory/index.ts');
const ui=read('js/jobs-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

function must(source,needles,label){ for(const needle of needles) assert.ok(source.includes(needle),label+' missing '+needle); }

must(migration,[
  'Schema 222 — Build 334 Preventive Maintenance Engine',
  'public.preventive_maintenance_plans',
  'public.preventive_maintenance_events',
  'public.equipment_maintenance_history',
  "'date','hours','kilometres','seasonal'",
  "'oil','filter','blade','sharpening','belt','lubrication','tires','battery','winterization','storage','preseason_setup','repair','inspection','service','other'",
  'v_preventive_maintenance_workbench',
  'v_preventive_maintenance_summary',
  "'preventive_maintenance'",
  '222 as expected_schema_version',
  "'schema222'"
],'Schema 222');
assert.ok(!migration.includes('create table if not exists public.equipment_items'),'Build 334 must reuse equipment_items.');
assert.ok(!migration.includes('create table if not exists public.equipment_service_tasks'),'Build 334 must reuse equipment_service_tasks.');

must(manage,[
  "body.action === 'preventive_maintenance_plan_upsert'",
  "body.action === 'preventive_maintenance_open_task'",
  "body.action === 'preventive_maintenance_complete'",
  "body.action === 'preventive_maintenance_plan_status'",
  'Preventive maintenance is not due yet.',
  "task_type:'preventive_maintenance'",
  "from('equipment_maintenance_history').insert"
],'Build 334 manage API');

must(directory,[
  "'v_preventive_maintenance_workbench'",
  "'v_preventive_maintenance_summary'",
  'preventive_maintenance_workbench:',
  'preventive_maintenance_summary:'
],'Build 334 directory');

must(ui,[
  'equipment_preventive_maintenance_v1',
  'Build 334 · preventive maintenance',
  'Save Maintenance Plan',
  'Open Due Service Task',
  'Complete Maintenance',
  'renderPreventiveMaintenanceWorkbench',
  "action:'preventive_maintenance_plan_upsert'",
  "action:'preventive_maintenance_complete'"
],'Build 334 UI');

must(help,['Build 334 — Preventive Maintenance Engine','does not automatically clear a safety lockout'],'Build 334 Help');
must(roadmap,['**334 — Preventive Maintenance Engine** is implemented','335 — Fuel, Consumables & Materials Control'],'Build 334 roadmap');
must(pkg,['test:preventive-maintenance-engine','test:browser:preventive-maintenance-engine'],'Build 334 package scripts');
must(workflow,['npm run test:preventive-maintenance-engine','npm run test:browser:preventive-maintenance-engine'],'Build 334 CI wiring');

console.log('Build 334 Preventive Maintenance Engine source contract passed.');
