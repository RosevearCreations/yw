import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(path)=>fs.readFileSync(path,'utf8');
const migration=read('sql/217_incident_near_miss_investigation.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const selector=read('supabase/functions/admin-selectors/index.ts');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const hse=read('js/hse-ops-ui.js');
const incidentForm=read('js/forms-incident.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

const must=(source,needles,label)=>needles.forEach((needle)=>assert.ok(source.includes(needle),label+': missing '+needle));

must(migration,[
  'Schema 217 — Build 329 Incident & Near-Miss Investigation',
  'create table if not exists public.incident_investigations',
  'source_submission_id bigint not null unique references public.submissions',
  'create table if not exists public.incident_investigation_events',
  'alter table public.incident_investigations enable row level security',
  'alter table public.incident_investigation_events enable row level security',
  'revoke all on table public.incident_investigations from public,anon,authenticated',
  'revoke all on table public.incident_investigation_events from public,anon,authenticated',
  'create or replace view public.v_incident_investigation_directory',
  'with (security_invoker=true)',
  'public.corrective_action_tasks',
  'inc.image_count as photo_count',
  'ywi_rpc_incident_investigation_save',
  'ywi_rpc_incident_investigation_review',
  'ywi_rpc_incident_investigation_close',
  "('incident_investigation_save','safety','approve','write'",
  "('incident_investigation_review','safety','approve','write'",
  "('incident_investigation_close','safety','approve','write'",
  'Exactly 54 explicitly handled operations-manage actions',
  'ywi_incident_investigation_security_assertions',
  '217 as expected_schema_version',
  "'schema217'"
],'Schema 217');

assert.ok(!migration.includes('create table if not exists public.corrective_action_tasks'),'Build 329 must reuse the existing corrective-action authority.');
assert.ok(!migration.includes('create table if not exists public.submission_images'),'Build 329 must reuse existing submission photos.');
assert.ok(!migration.includes("update public.submissions set status='closed'"),'Investigation closure must not auto-close the original submission.');

must(boundaries,[
  "incident_investigation_save: contract('incident_investigation_save', 'safety', 'approve', 'write'",
  "incident_investigation_review: contract('incident_investigation_review', 'safety', 'approve', 'write'",
  "incident_investigation_close: contract('incident_investigation_close', 'safety', 'approve', 'write'"
],'Build 329 Safety write boundaries');

must(operations,[
  "action === 'incident_investigation_save'",
  "action === 'incident_investigation_review'",
  "action === 'incident_investigation_close'",
  "supabase.rpc('ywi_rpc_incident_investigation_save'",
  "supabase.rpc('ywi_rpc_incident_investigation_review'",
  "supabase.rpc('ywi_rpc_incident_investigation_close'",
  'build:329,schema:217',
  "entity_type:'incident_investigation'"
],'Build 329 protected operations');

const build329Operations=operations.slice(operations.indexOf("if (action === 'incident_investigation_save')"),operations.indexOf("if (action === 'property_site_save')"));
assert.ok((build329Operations.match(/requireRank\(profile,30,action\)/g)||[]).length>=3,'Every Build 329 operation keeps supervisor-rank defense in depth.');

must(selector,[
  "'v_incident_investigation_directory'",
  'incident_investigations: incidentInvestigations',
  'source_submission_id,investigation_status,event_classification,severity',
  'corrective_action_count,open_corrective_action_count,overdue_corrective_action_count'
],'Build 329 bounded selector');
const selector329=selector.slice(selector.indexOf("const incidentInvestigations"),selector.indexOf("return Response.json",selector.indexOf("const incidentInvestigations")));
assert.ok(!selector329.includes('submitted_by_name'),'Build 329 investigation selector must not expose reporter identity.');
assert.ok(!selector329.includes('submitted_by_profile_id'),'Build 329 investigation selector must not expose reporter profile identity.');

must(hse,[
  'const BUILD = 329',
  'Incident &amp; Near-Miss Investigation',
  'deriveIncidentInvestigations',
  "action:'incident_investigation_save'",
  "action:'incident_investigation_review'",
  "action:'incident_investigation_close'",
  'Immediate safety response comes first',
  'Closure blockers',
  'High severity open',
  'The original incident submission and its photos remain unchanged'
],'Build 329 investigation UI');

must(incidentForm,[
  '<option value="near_miss">Near Miss</option>',
  '<option value="environmental_event">Environmental Event / Release</option>',
  'equipment_damage',
  'vehicle_event',
  'spill_release'
],'Immediate incident capture coverage');

must(help,[
  'Build 329 — Incident &amp; Near-Miss Investigation',
  'existing Incident / Near Miss form as the immediate reporting authority',
  'Existing incident-linked corrective-action tasks remain the corrective-action authority',
  'a closed record is not by itself proof of legal compliance'
],'Build 329 Help');
must(roadmap,['**329 — Incident & Near-Miss Investigation** are implemented','330 — Training & Certification Matrix'],'Build 329 roadmap');
must(pkg,['test:incident-near-miss-investigation','test:browser:incident-near-miss-investigation'],'Build 329 package scripts');
must(workflow,['npm run test:incident-near-miss-investigation','npm run test:browser:incident-near-miss-investigation'],'Build 329 CI wiring');

const require=createRequire(import.meta.url);
const ts=require('typescript');
for(const path of ['supabase/functions/operations-manage/index.ts','supabase/functions/admin-selectors/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
  const output=ts.transpileModule(read(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:path});
  const errors=(output.diagnostics||[]).filter((item)=>item.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,path+' must transpile without TypeScript syntax errors');
}

console.log('Build 329 Incident & Near-Miss Investigation source gate GREEN');
