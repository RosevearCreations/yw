import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/221_fleet_trailer_vehicle_operations.sql');
const manage=read('supabase/functions/jobs-manage/index.ts');
const directory=read('supabase/functions/jobs-directory/index.ts');
const ui=read('js/jobs-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

function must(source,needles,label){ for(const needle of needles) assert.ok(source.includes(needle),label+' missing '+needle); }

must(migration,[
  'Schema 221 — Build 333 Fleet, Trailer & Vehicle Operations',
  'public.equipment_fleet_profiles',
  'public.fleet_towing_assignments',
  'public.fleet_readiness_checks',
  'public.fleet_fuel_logs',
  'public.fleet_downtime_events',
  'v_fleet_vehicle_operations',
  'v_fleet_operations_summary',
  '221 as expected_schema_version',
  "'schema221'",
  'Preventive maintenance scheduling remains Build 334'
],'Schema 221');
assert.ok(!migration.includes('create table if not exists public.equipment_items'),'Build 333 must reuse equipment_items.');
assert.ok(!migration.includes('create table if not exists public.equipment_service_tasks'),'Build 333 must reuse equipment_service_tasks.');
assert.ok(!migration.includes('preventive_maintenance_schedule'),'Build 333 must not implement Build 334 preventive-maintenance scheduling.');

must(manage,[
  "body.action === 'fleet_profile_upsert'",
  "body.action === 'fleet_readiness_record'",
  "body.action === 'fleet_fuel_record'",
  "body.action === 'fleet_towing_assign'",
  "body.action === 'fleet_towing_release'",
  "body.action === 'fleet_downtime_start'",
  "body.action === 'fleet_downtime_clear'",
  'Tow assignment blocked: hitch or towing-capacity compatibility failed.'
],'Build 333 manage API');

must(directory,[
  "'v_fleet_vehicle_operations'",
  "'v_fleet_operations_summary'",
  "'v_fleet_towing_assignment_directory'",
  'fleet_vehicle_operations:',
  'fleet_operations_summary:',
  'fleet_towing_assignments:'
],'Build 333 directory');

must(ui,[
  'equipment_fleet_operations_v1',
  'Build 333 · fleet / towing / readiness',
  'Save Fleet Profile',
  'Record Readiness',
  'Record Fuel',
  'Assign Tow Pair',
  'Start Downtime',
  'Clear Downtime',
  'renderFleetOperationsWorkbench',
  "action:'fleet_profile_upsert'",
  "action:'fleet_towing_assign'"
],'Build 333 UI');

must(help,['Build 333 — Fleet, Trailer &amp; Vehicle Operations','Preventive-maintenance scheduling is handled separately by Build 334'],'Build 333 Help');
must(roadmap,['**333 — Fleet, Trailer & Vehicle Operations** is implemented','334 — Preventive Maintenance Engine'],'Build 333 roadmap');
must(pkg,['test:fleet-trailer-vehicle-operations','test:browser:fleet-trailer-vehicle-operations'],'Build 333 package scripts');
must(workflow,['npm run test:fleet-trailer-vehicle-operations','npm run test:browser:fleet-trailer-vehicle-operations'],'Build 333 CI wiring');

console.log('Build 333 Fleet, Trailer & Vehicle Operations source contract passed.');
