import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(path)=>fs.readFileSync(path,'utf8');
const migration=read('sql/218_training_certification_matrix.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const selector=read('supabase/functions/admin-selectors/index.ts');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const hse=read('js/hse-ops-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

const must=(source,needles,label)=>needles.forEach((needle)=>assert.ok(source.includes(needle),label+': missing '+needle));

must(migration,[
  'Schema 218 — Build 330 Training & Certification Matrix',
  'create table if not exists public.training_requirement_rules',
  'create table if not exists public.training_requirement_assignments',
  'create table if not exists public.training_internal_authorization_reviews',
  "authorization_scope text not null default 'internal_company_only'",
  'alter table public.training_requirement_rules enable row level security',
  'alter table public.training_requirement_assignments enable row level security',
  'alter table public.training_internal_authorization_reviews enable row level security',
  'revoke all on table public.training_requirement_rules from public,anon,authenticated',
  'create or replace view public.v_training_requirement_directory',
  'create or replace view public.v_training_certification_matrix',
  'create or replace view public.v_training_certification_matrix_summary',
  'with (security_invoker=true)',
  'false as legal_authorization_inferred',
  'public.training_records',
  'ywi_rpc_training_requirement_save',
  'ywi_rpc_training_assignment_save',
  'ywi_rpc_training_record_save',
  'ywi_rpc_training_internal_authorization_decision',
  "('training_requirement_save','safety','approve','write'",
  "('training_assignment_save','safety','approve','write'",
  "('training_record_save','safety','approve','write'",
  "('training_internal_authorization_decision','safety','approve','write'",
  'Exactly 58 explicitly handled operations-manage actions',
  'ywi_training_certification_matrix_security_assertions',
  '218 as expected_schema_version',
  "'schema218'"
],'Schema 218');

for(const code of [
  'ORIENTATION_CORE','COMPANY_SOP_CORE','WHMIS_APPLICABLE','HAZARD_ASSESSMENT_FIELD','PPE_FIELD',
  'FIRST_AID_REQUIRED','EQUIPMENT_GENERAL_FIELD','CHAINSAW_BRUSH_AUTH','MOWER_TRACTOR_AUTH',
  'PESTICIDE_APPLICATION_CREDENTIAL','TRAILER_TOWING_AUTH','SUPERVISOR_SAFETY_CORE'
]) assert.ok(migration.includes("('"+code+"'"),'Missing training requirement '+code);

for(const course of ['ORIENTATION','EQUIPMENT_GENERAL','CHAINSAW_BRUSH','MOWER_TRACTOR','PESTICIDE_APPLICATION','TRAILER_TOWING','SUPERVISOR_SAFETY','COMPANY_SOP']){
  assert.ok(migration.includes("('"+course+"'"),'Missing training course '+course);
}

assert.ok(!migration.includes('create table if not exists public.training_records'),'Build 330 must reuse existing training_records.');
assert.ok(!migration.includes('legal_authorization_inferred true'),'Build 330 must never infer external legal authorization.');
assert.ok(migration.includes("authorization_scope='internal_company_only'"),'Internal authorization scope must stay explicitly company-only.');
assert.ok(migration.includes('Internal authorization cannot outlast the supporting training record.'),'Internal authorization must not outlive training evidence.');
assert.ok(migration.includes('External credential evidence reference is required before internal authorization.'),'External-credential rules must require evidence before internal authorization.');

must(boundaries,[
  "training_requirement_save: contract('training_requirement_save', 'safety', 'approve', 'write'",
  "training_assignment_save: contract('training_assignment_save', 'safety', 'approve', 'write'",
  "training_record_save: contract('training_record_save', 'safety', 'approve', 'write'",
  "training_internal_authorization_decision: contract('training_internal_authorization_decision', 'safety', 'approve', 'write'"
],'Build 330 Safety write boundaries');

must(operations,[
  "action === 'training_requirement_save'",
  "action === 'training_assignment_save'",
  "action === 'training_record_save'",
  "action === 'training_internal_authorization_decision'",
  "supabase.rpc('ywi_rpc_training_requirement_save'",
  "supabase.rpc('ywi_rpc_training_assignment_save'",
  "supabase.rpc('ywi_rpc_training_record_save'",
  "supabase.rpc('ywi_rpc_training_internal_authorization_decision'",
  'build:330,schema:218',
  "authorization_scope:'internal_company_only'"
],'Build 330 protected operations');
const build330Operations=operations.slice(operations.indexOf("if (action === 'training_requirement_save')"),operations.indexOf("if (action === 'property_site_save')"));
assert.ok((build330Operations.match(/requireRank\(profile,30,action\)/g)||[]).length>=4,'Every Build 330 operation keeps supervisor-rank defense in depth.');

must(selector,[
  "'v_training_course_directory'",
  "'v_training_requirement_directory'",
  "'v_training_certification_matrix'",
  "'v_training_certification_matrix_summary'",
  'training_courses: trainingCourses',
  'training_requirements: trainingRequirements',
  'training_matrix: trainingMatrix',
  'training_matrix_summary: trainingMatrixSummary',
  'training_people: trainingPeople',
  'training_equipment: trainingEquipment'
],'Build 330 bounded selector');

must(hse,[
  'const BUILD = 330',
  'Training &amp; Certification Matrix',
  'deriveTrainingMatrix',
  "action:'training_assignment_save'",
  "action:'training_record_save'",
  "action:'training_internal_authorization_decision'",
  'Internal readiness is not legal authorization',
  'External credential evidence missing',
  'Internal authorization pending',
  'Training alone does not auto-authorize equipment/task use'
],'Build 330 training matrix UI');

must(help,[
  'Build 330 — Training &amp; Certification Matrix',
  'keeps <code>training_courses</code> and <code>training_records</code> as the existing completion/certificate authority',
  'does not itself prove a statutory qualification'
],'Build 330 Help');
must(roadmap,['**330 — Training & Certification Matrix** are implemented','331 — Equipment Registry & QR System v2'],'Build 330 roadmap');
must(pkg,['test:training-certification-matrix','test:browser:training-certification-matrix'],'Build 330 package scripts');
must(workflow,['npm run test:training-certification-matrix','npm run test:browser:training-certification-matrix'],'Build 330 CI wiring');

const require=createRequire(import.meta.url);
const ts=require('typescript');
for(const path of ['supabase/functions/operations-manage/index.ts','supabase/functions/admin-selectors/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
  const output=ts.transpileModule(read(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:path});
  const errors=(output.diagnostics||[]).filter((item)=>item.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,path+' must transpile without TypeScript syntax errors');
}

console.log('Build 330 Training & Certification Matrix source gate GREEN');
