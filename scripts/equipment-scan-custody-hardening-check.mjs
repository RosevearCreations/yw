#!/usr/bin/env node
/** Build/Schema 185 source gate: equipment camera scanning + custody evidence hardening. */
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('sql/185_equipment_scan_identity_custody_hardening.sql');
const endpoint=read('supabase/functions/equipment-scan-manage/index.ts');
const config=read('supabase/config.toml');
const scanner=read('js/equipment-scanner.js');
const jobsUi=read('js/jobs-ui.js');
const runtime=read('js/module-runtime.js');
const boundary=read('supabase/functions/_shared/module-write-boundaries.ts');

const results=[];
const add=(name,ok,detail='')=>results.push({name,ok:!!ok,detail});
const hasAll=(text,needles)=>needles.every((needle)=>text.includes(needle));

add('schema185-transaction-balanced',(migration.match(/^begin;$/gmi)||[]).length===1&&(migration.match(/^commit;$/gmi)||[]).length===1);
add('schema185-canonical-master-link',hasAll(migration,[
  'add column if not exists equipment_master_id uuid',
  'equipment_items_equipment_master_id_fkey',
  'references public.equipment_master(id) on delete restrict',
  'alter column equipment_master_id set not null',
  'ywi_link_equipment_item_master'
]));
add('schema185-identifier-registry',hasAll(migration,[
  'equipment_identifier_registry',"'equipment_code','asset_tag','serial_number','qr_code_value','barcode_value'",
  'identifier_value text primary key','trg_refresh_equipment_identifier_registry'
]));
add('schema185-registry-fails-on-collision',migration.includes('No ON CONFLICT: a collision must abort')&&!/insert into public\.equipment_identifier_registry[\s\S]{0,900}on conflict/i.test(migration.slice(migration.indexOf('create or replace function public.ywi_refresh_equipment_identifier_registry'),migration.indexOf('drop trigger if exists trg_refresh_equipment_identifier_registry'))));
add('schema185-registry-private-rls',hasAll(migration,[
  'alter table public.equipment_identifier_registry enable row level security;',
  'revoke all on table public.equipment_identifier_registry from public,anon,authenticated;',
  'grant select,insert,update,delete on table public.equipment_identifier_registry to service_role;'
]));
add('schema185-custody-scan-fk',hasAll(migration,[
  'equipment_custody_timeline_events_scan_event_id_fkey',
  'references public.equipment_scan_events(id) on delete restrict',
  'equipment_custody_timeline_events_scan_event_uidx',
  'alter column scan_event_id set not null'
]));
add('schema185-idempotency-provenance',hasAll(migration,[
  'add column if not exists idempotency_key text',
  'equipment_custody_timeline_events_idempotency_uidx',
  'equipment_scan_events_idempotency_uidx'
]));
add('schema185-security-assertions',hasAll(migration,[
  'ywi_equipment_scan_security_assertions','security invoker',
  "'physical_items_link_canonical_master'","'identifier_registry_exact_unique'",
  "'jobs_create_boundary_contract'"
]));
add('schema185-ledger-marker',hasAll(migration,[
  "185,'185_equipment_scan_identity_custody_hardening'","'2026-09-02q'",
  "'schema185_equipment_scan_custody_hardening'"
]));
add('schema185-no-finance-provider-mutation',!/\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:job_financial_events|ar_|ap_|stripe|paypal|gl_journal|payment_)/i.test(migration));

add('scan-boundary-contract-jobs-create',boundary.includes("equipment_scan_event: contract('equipment_scan_event', 'jobs', 'create', 'write', 'equipment_custody'"));
add('scan-endpoint-module-enforcement',hasAll(endpoint,[
  "const ACTION = 'equipment_scan_event'",'resolveModuleWriteBoundary(ACTION)',
  "boundary.ownerModule !== 'jobs'","boundary.minimum !== 'create'",
  'hasModuleAccess(supabase, profile, boundary.ownerModule, boundary.minimum)'
]));
add('scan-endpoint-exact-resolution',hasAll(endpoint,[
  "from('equipment_identifier_registry')",".eq('identifier_value', code)",
  "from('equipment_master')",".eq('equipment_code', code)"
])&&!endpoint.includes(".ilike('identifier_value'"));
add('scan-endpoint-no-first-match-ambiguity',hasAll(endpoint,[
  'registry.length > 1 || masters.length > 1',"status:'ambiguous'",
  'conflictingMaster',"status:'inconsistent'"
]));
add('scan-endpoint-idempotency',hasAll(endpoint,[
  "req.headers.get('x-idempotency-key') || body.idempotency_key",
  ".eq('idempotency_key', idempotencyKey)",
  'idempotency_key:idempotencyKey',
  'replayed = true'
]));
add('scan-endpoint-untrusted-until-resolved',hasAll(endpoint,[
  'raw_input_trusted:false','exact_server_resolution:true',
  "equipment_item_id:resolved ? resolution.item.id : null"
]));
add('scan-endpoint-jwt-config',/\[functions\.equipment-scan-manage\]\s*\nverify_jwt = true/.test(config));

add('scanner-camera-detector',hasAll(scanner,[
  "'BarcodeDetector' in window",'navigator.mediaDevices?.getUserMedia',
  "facingMode:{ ideal:'environment' }",'detector.detect(video)'
]));
add('scanner-permanent-manual-fallback',hasAll(scanner,[
  "window.prompt('Enter the equipment QR, barcode, asset tag, serial number, or equipment code:')",
  'data-scan-manual','return manualFallback(',
  'legacy handler remains a permanent manual fallback'
])&&jobsUi.includes("window.prompt('Scan/enter equipment QR or barcode value')"));
add('scanner-protected-server-resolution',hasAll(scanner,[
  "const FUNCTION_NAME = 'equipment-scan-manage'",'client.jsonFetch(FUNCTION_NAME',
  "'x-idempotency-key':idempotencyKey",'applyTrustedResolution(value,response)'
]));
add('scanner-only-trusts-resolved-form-data',hasAll(scanner,[
  "if (status !== 'resolved')",'Nothing was selected',
  "setInputValue('eq_code', equipmentCode)",
  "if (identifierKind === 'qr_code_value')", "if (identifierKind === 'barcode_value')"
]));
add('scanner-jobs-lazy-runtime',runtime.includes("scripts: Object.freeze(['/js/jobs-ui.js','/js/jobs-finance-boundary.js','/js/equipment-scanner.js'])"));
add('legacy-scan-button-preserved',jobsUi.includes('Scan / Enter Code')&&jobsUi.includes('Camera when supported; manual fallback.'));

const failures=results.filter((item)=>!item.ok);
for(const item of results) console.log(`${item.ok?'PASS':'FAIL'} ${item.name}${item.detail?` - ${item.detail}`:''}`);
if(failures.length){
  console.error(`\nBuild 185 equipment scan/custody gate failed: ${failures.length}/${results.length} checks.`);
  process.exit(1);
}
console.log(`\nBuild 185 equipment scan/custody gate passed: ${results.length}/${results.length} checks.`);
