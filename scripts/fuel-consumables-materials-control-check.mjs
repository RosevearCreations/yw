import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/223_fuel_consumables_materials_control.sql');
const manage=read('supabase/functions/jobs-manage/index.ts');
const directory=read('supabase/functions/jobs-directory/index.ts');
const ui=read('js/jobs-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

function must(source,needles,label){ for(const needle of needles) assert.ok(source.includes(needle),label+' missing '+needle); }

must(migration,[
  'Schema 223 — Build 335 Fuel, Consumables & Materials Control',
  'alter table public.materials_catalog',
  'preferred_vendor_id',
  'material_stock_adjustments',
  "'job_use','waste','internal_use','adjustment'",
  'v_material_stock_control',
  'v_material_control_summary',
  'v_fuel_consumables_summary',
  '223 as expected_schema_version',
  "'schema223'"
],'Schema 223');
assert.ok(!migration.includes('create table if not exists public.materials_catalog'),'Build 335 must reuse materials_catalog.');
assert.ok(!migration.includes('create table if not exists public.material_receipts'),'Build 335 must reuse material_receipts.');
assert.ok(!migration.includes('create table if not exists public.material_issues'),'Build 335 must reuse material_issues.');
assert.ok(!migration.includes('create table if not exists public.fleet_fuel_logs'),'Build 335 must reuse fleet_fuel_logs.');

must(manage,[
  "body.action === 'material_catalog_upsert'",
  "body.action === 'material_stock_receipt'",
  "body.action === 'material_stock_issue'",
  "body.action === 'material_stock_adjust'",
  "body.action === 'material_cycle_count'",
  'Insufficient stock for this issue.',
  "from('material_receipts').insert",
  "from('material_issues').insert",
  "from('material_stock_adjustments').insert"
],'Build 335 manage API');

must(directory,[
  "'v_material_stock_control'",
  "'v_material_control_summary'",
  "'v_fuel_consumables_summary'",
  'material_stock_control:',
  'material_control_summary:',
  'fuel_consumables_summary:'
],'Build 335 directory');

must(ui,[
  'fuel_consumables_materials_control_v1',
  'Build 335 · fuel / consumables / materials',
  'Save Material',
  'Record Receipt',
  'Record Issue',
  'Record Adjustment',
  'Record Cycle Count',
  'renderMaterialsControlWorkbench',
  "action:'material_stock_receipt'",
  "action:'material_stock_issue'"
],'Build 335 UI');

must(help,['Build 335 — Fuel, Consumables &amp; Materials Control','does not create a second inventory authority'],'Build 335 Help');
must(roadmap,['**335 — Fuel, Consumables & Materials Control** is implemented','336 — Employee & Crew Management'],'Build 335 roadmap');
must(pkg,['test:fuel-consumables-materials-control','test:browser:fuel-consumables-materials-control'],'Build 335 package scripts');
must(workflow,['npm run test:fuel-consumables-materials-control','npm run test:browser:fuel-consumables-materials-control'],'Build 335 CI wiring');

console.log('Build 335 Fuel, Consumables & Materials Control source contract passed.');
