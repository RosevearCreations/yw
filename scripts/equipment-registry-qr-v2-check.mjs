import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(path)=>fs.readFileSync(path,'utf8');
const migration=read('sql/219_equipment_registry_qr_v2.sql');
const jobsManage=read('supabase/functions/jobs-manage/index.ts');
const jobsDirectory=read('supabase/functions/jobs-directory/index.ts');
const scanManage=read('supabase/functions/equipment-scan-manage/index.ts');
const scanner=read('js/equipment-scanner.js');
const jobsUi=read('js/jobs-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

const must=(source,needles,label)=>needles.forEach((needle)=>assert.ok(source.includes(needle),label+': missing '+needle));

must(migration,[
  'Schema 219 — Build 331 Equipment Registry & QR System v2',
  'alter table public.equipment_items',
  'assigned_crew_id uuid references public.crews',
  "meter_type text not null default 'none'",
  "replacement_state text not null default 'retain'",
  'create table if not exists public.equipment_registry_documents',
  'create table if not exists public.equipment_registry_photos',
  'create table if not exists public.equipment_accessory_registry',
  'create table if not exists public.equipment_meter_readings',
  'alter table public.equipment_registry_documents enable row level security',
  'alter table public.equipment_registry_photos enable row level security',
  'alter table public.equipment_accessory_registry enable row level security',
  'alter table public.equipment_meter_readings enable row level security',
  'revoke all on table public.equipment_registry_documents from public,anon,authenticated',
  "qr_code_value='YWI-EQ-'||replace(gen_random_uuid()::text,'-','')",
  'create or replace view public.v_equipment_registry_v2',
  'create or replace view public.v_equipment_registry_v2_summary',
  'with (security_invoker=true)',
  'recorded_lifecycle_cost_total',
  'open_service_estimated_cost',
  'qr_identity_status',
  'registry_readiness_status',
  'ywi_equipment_registry_v2_security_assertions',
  '219 as expected_schema_version',
  "'schema219'"
],'Schema 219');

assert.ok(!migration.includes('create table if not exists public.equipment_items'),'Build 331 must extend the existing physical equipment authority.');
assert.ok(!migration.includes('create table if not exists public.equipment_identifier_registry'),'Build 331 must reuse the hardened exact identifier registry.');
assert.ok(!migration.includes('create table if not exists public.equipment_inspection_history'),'Build 331 must not replace the inspection authority.');
assert.ok(!migration.includes('create table if not exists public.equipment_service_history'),'Build 331 must not replace the service-history authority.');
assert.ok(!migration.includes('create table if not exists public.equipment_service_tasks'),'Build 331 must not replace service-task authority.');

must(scanManage,[
  "from('equipment_identifier_registry')",
  'identifier_value',
  'equipment_master_id',
  'identifierKind:registryRow.identifier_kind'
],'Existing exact server-side scan resolver');
must(scanner,[
  'BarcodeDetector',
  'getUserMedia',
  'equipment-scan-manage',
  'server-resolved'
],'Existing browser QR/barcode scanner');

must(jobsManage,[
  "hasModuleAccess(supabase, actorProfile, 'jobs', 'create')",
  "roleRank(actorProfile.role) < roleRank('supervisor')",
  "body.entity === 'equipment' && body.action === 'upsert'",
  "YWI-EQ-${crypto.randomUUID().replaceAll('-','')}",
  'assigned_crew_id: assignedCrewId',
  'meter_type: meterType',
  'replacement_state: replacementState',
  "from('equipment_registry_documents')",
  "from('equipment_registry_photos')",
  "from('equipment_accessory_registry')",
  "from('equipment_meter_readings')",
  "from('v_equipment_registry_v2')",
  'build:331, schema:219'
],'Build 331 existing Jobs write authority');

must(jobsDirectory,[
  "hasModuleAccess(supabase, actorProfile, 'jobs', 'view')",
  "roleRank(actorRole) < roleRank('supervisor')",
  "'v_equipment_registry_v2'",
  "'v_equipment_registry_v2_summary'",
  'equipment_registry_v2: equipmentRegistryV2',
  'equipment_registry_v2_summary: equipmentRegistryV2Summary',
  'equipment: equipmentRows'
],'Build 331 bounded directory read');

must(jobsUi,[
  'Equipment Registry &amp; QR System v2',
  'data-build="331"',
  'eq_assigned_crew',
  'eq_meter_type',
  'eq_meter_value',
  'eq_registry_documents',
  'eq_registry_photos',
  'eq_registry_accessories',
  'eq_replacement_state',
  'eq_qr_label_preview',
  'Copy QR Label Value',
  'parseRegistryDocuments',
  'parseRegistryPhotos',
  'parseRegistryAccessories',
  'recorded_lifecycle_cost_total',
  'open_service_estimated_cost',
  'registry_readiness_status'
],'Build 331 Equipment UI');

must(help,[
  'Build 331 — Equipment Registry &amp; QR System v2',
  'reuses the existing exact identifier registry',
  'Build 331 does not create a second scanner, asset table, inspection engine or maintenance engine'
],'Build 331 Help');
must(roadmap,['#### 331 — Equipment Registry & QR System v2','**331 — Equipment Registry & QR System v2**','332 — Daily Equipment Inspection & Lockout'],'Build 331 roadmap');
must(pkg,['test:equipment-registry-qr-v2','test:browser:equipment-registry-qr-v2'],'Build 331 package scripts');
must(workflow,['npm run test:equipment-registry-qr-v2','npm run test:browser:equipment-registry-qr-v2'],'Build 331 CI wiring');

new Function(jobsUi);

const require=createRequire(import.meta.url);
const ts=require('typescript');
for(const path of ['supabase/functions/jobs-manage/index.ts','supabase/functions/jobs-directory/index.ts']){
  const output=ts.transpileModule(read(path),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
    reportDiagnostics:true,fileName:path
  });
  const errors=(output.diagnostics||[]).filter((item)=>item.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,path+' must transpile without TypeScript syntax errors');
}

console.log('Build 331 Equipment Registry & QR System v2 source gate GREEN');
