import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/233_quality_control_customer_signoff.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const directory=read('supabase/functions/admin-directory/index.ts');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const ui=read('js/admin-quality-control-ui.js');
const hub=read('js/admin-hub-ui.js');
const index=read('index.html');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const behavior=read('scripts/module-write-boundary-behavior-check.mjs');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(migration,[
  'Schema 233 — Build 345 Quality Control & Customer Signoff',
  'create table if not exists public.quality_control_templates',
  'create table if not exists public.quality_control_template_items',
  'create table if not exists public.work_order_quality_control_runs',
  'create table if not exists public.work_order_quality_control_items',
  'create table if not exists public.work_order_quality_control_evidence_links',
  'create table if not exists public.work_order_quality_control_deficiencies',
  'create table if not exists public.work_order_quality_control_rework_events',
  'mowing_landscaping_completion','fall_cleanup_completion','winter_snow_ice_completion',
  'create or replace function public.ywi_quality_control_ready_for_closeout',
  'trg_work_order_closeout_quality_control_guard',
  'create or replace function public.ywi_rpc_quality_control_review',
  'Exactly 84 explicitly handled operations-manage actions',
  '233 as expected_schema_version'
],'Schema 233');

for(const authority of ['work_order_execution_proofs','work_order_closeout_packages','work_order_customer_closeout_signoffs']){
  assert.ok(!new RegExp('create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.'+authority+'\\b','i').test(migration),'Build 345 must not recreate canonical '+authority);
}
const lifecycle=migration.slice(migration.indexOf('create or replace function public.ywi_rpc_quality_control_template_save'),migration.indexOf('revoke all on function public.ywi_rpc_quality_control_template_save'));
assert.ok(!/insert\s+into\s+public\.work_order_customer_closeout_signoffs/i.test(lifecycle),'Staff QC must never create customer signoff rows.');
assert.ok(!/update\s+public\.work_order_closeout_packages/i.test(lifecycle),'QC RPCs must not rewrite canonical closeout packages.');
must(migration,[
  "execution_proof_id uuid not null references public.work_order_execution_proofs",
  "Customer-safe QC evidence must reference an approved customer-visible execution proof.",
  "Unresolved QC deficiencies must be closed before supervisor approval.",
  "customer signoff remains the existing portal authority."
],'QC authority and gating');

must(boundaries,[
 "quality_control_template_save: contract('quality_control_template_save', 'jobs', 'approve', 'write', 'quality_control'",
 "quality_control_run_save: contract('quality_control_run_save', 'jobs', 'create', 'write', 'quality_control'",
 "quality_control_evidence_link: contract('quality_control_evidence_link', 'jobs', 'create', 'write', 'quality_control'",
 "quality_control_deficiency_save: contract('quality_control_deficiency_save', 'jobs', 'create', 'write', 'quality_control'",
 "quality_control_rework_save: contract('quality_control_rework_save', 'jobs', 'create', 'write', 'quality_control'",
 "quality_control_review: contract('quality_control_review', 'jobs', 'approve', 'write', 'quality_control'"
],'Build 345 boundaries');

must(operations,[
 "action === 'quality_control_template_save'","action === 'quality_control_run_save'",
 "action === 'quality_control_evidence_link'","action === 'quality_control_deficiency_save'",
 "action === 'quality_control_rework_save'","action === 'quality_control_review'",
 'build:345,schema:233','customer_signoff_mutated:false','existing_customer_portal'
],'Build 345 API');

must(directory,[
 "scope === 'quality_control'","quality_control_templates:templates","quality_control_template_items:templateItems",
 'v_quality_control_run_directory','v_quality_control_evidence_directory','v_quality_control_deficiency_directory',
 'Staff QC cannot create customer signoff'
],'Build 345 directory');

must(ui,[
 'Build 345 — Quality Control &amp; Customer Signoff','Customer signoff authority','Four-season QC',
 'Crew completion','Before / after / detail evidence','Deficiency &amp; rework','Supervisor QC',
 "scope:'quality_control'","action:'quality_control_run_save'","action:'quality_control_review'",
 'staff QC cannot sign for a customer'
],'Build 345 UI');

must(hub,['loadBuild345QualityControl','loadBuild345QualityControl();'],'Build 345 mount');
must(index,['/js/admin-quality-control-ui.js?v=2026-09-24b345'],'Build 345 preload');
must(help,['Build 345 — Quality Control &amp; Customer Signoff','Evidence authority','Deficiency/rework gate','Customer signoff authority'],'Build 345 help');
must(roadmap,['#### **345 — Quality Control & Customer Signoff** is implemented','#### **346 — Seasonal Operations Centre** is implemented','next planned autonomous item is **349 — Saved Views, Search & Command Centre**'],'Build 345 roadmap');
must(pkg,['test:quality-control-customer-signoff','test:browser:quality-control-customer-signoff'],'Build 345 scripts');
must(workflow,['npm run test:quality-control-customer-signoff','npm run test:browser:quality-control-customer-signoff'],'Build 345 CI');
must(behavior,['boundary-exact-90-actions','boundary-build345-quality-control-customer-signoff'],'Build 345 boundary behavior');

const require=createRequire(import.meta.url),ts=require('typescript');
for(const p of ['supabase/functions/operations-manage/index.ts','supabase/functions/admin-directory/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
 const o=ts.transpileModule(read(p),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:p});
 const errors=(o.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join(' | '));
}
new Function(ui);
console.log('PASS build345-quality-control-customer-signoff');
console.log('PASS build345-four-season-qc-templates');
console.log('PASS build345-canonical-execution-proof-authority');
console.log('PASS build345-deficiency-rework-gating');
console.log('PASS build345-customer-signoff-authority-preserved');
console.log('Build 345 Quality Control & Customer Signoff source gate GREEN');
