import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/231_landscape_material_estimator.sql');
const directory=read('supabase/functions/admin-directory/index.ts');
const operations=read('supabase/functions/operations-manage/index.ts');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const ui=read('js/admin-landscape-material-estimator-ui.js');
const hub=read('js/admin-hub-ui.js');
const index=read('index.html');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const behavior=read('scripts/module-write-boundary-behavior-check.mjs');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(migration,[
  'Schema 231 — Build 343 Landscape Material Estimator',
  'create table if not exists public.landscape_material_estimates',
  'create table if not exists public.landscape_material_estimate_lines',
  'create table if not exists public.landscape_material_actual_use_events',
  "'mulch','soil','sod','seed','fertilizer','gravel','stone','disposal','salt_deicer','traction_material','configurable'",
  "'area_depth','area','application_rate','volume','direct'",
  'waste_factor_percent',
  'conversion_factor',
  'v_landscape_material_line_directory',
  'planned_vs_actual_available',
  'planning_evidence_only_no_inventory_or_job_mutation',
  'Exactly 72 explicitly handled operations-manage actions',
  '231 as expected_schema_version'
],'Schema 231');

for(const authority of ['materials_catalog','material_receipts','material_issues','material_stock_adjustments','estimates','work_orders','client_sites']){
  assert.ok(!new RegExp('create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.'+authority+'\\b','i').test(migration),'Build 343 must not recreate canonical '+authority+' authority.');
}
const estimatorFn=migration.slice(migration.indexOf('create or replace function public.ywi_rpc_landscape_material_estimate_save'),migration.indexOf('create or replace function public.ywi_rpc_landscape_material_actual_use_save'));
const actualFn=migration.slice(migration.indexOf('create or replace function public.ywi_rpc_landscape_material_actual_use_save'),migration.indexOf('revoke all on function public.ywi_rpc_landscape_material_estimate_save'));
assert.ok(!/insert\s+into\s+public\.(?:material_issues|material_receipts|material_stock_adjustments)\b/i.test(estimatorFn),'Estimator save must not post inventory movement.');
assert.ok(!/insert\s+into\s+public\.(?:material_issues|material_receipts|material_stock_adjustments)\b/i.test(actualFn),'Actual-use evidence must not post inventory movement.');
assert.ok(!/update\s+public\.(?:estimates|work_orders)\b/i.test(estimatorFn+actualFn),'Build 343 estimator RPCs must not change canonical commercial/job scope.');

must(boundaries,[
  "landscape_material_estimate_save: contract('landscape_material_estimate_save', 'jobs', 'approve', 'write', 'landscape_material_estimator'",
  "landscape_material_actual_use_save: contract('landscape_material_actual_use_save', 'jobs', 'approve', 'write', 'landscape_material_estimator'"
],'Estimator boundaries');

must(operations,[
  "action === 'landscape_material_estimate_save'",
  "action === 'landscape_material_actual_use_save'",
  "supabase.rpc('ywi_rpc_landscape_material_estimate_save'",
  "supabase.rpc('ywi_rpc_landscape_material_actual_use_save'",
  'build:343,schema:231',
  'inventory_mutated:false',
  'job_mutated:false'
],'Estimator operations API');

must(directory,[
  "scope === 'material_estimator'",
  'v_landscape_material_estimate_directory',
  'v_landscape_material_line_directory',
  'v_landscape_material_actual_use_directory',
  'v_material_stock_control',
  'planning/evidence only'
],'Estimator directory');

must(ui,[
  'Build 343 — Landscape Material Estimator',
  'Four-season coverage',
  'Salt / de-icer',
  'Traction material',
  'Calculate Preview',
  'Record Actual Use Evidence',
  "scope:'material_estimator'",
  "action:'landscape_material_estimate_save'",
  "action:'landscape_material_actual_use_save'",
  'No inventory movement or job/estimate change was made.'
],'Estimator UI');

must(hub,['loadBuild343LandscapeMaterialEstimator','loadBuild343LandscapeMaterialEstimator();'],'Estimator workspace mount');
must(index,['/js/admin-landscape-material-estimator-ui.js?v=2026-09-23b343'],'Estimator UI preload');
must(help,['Build 343 — Landscape Material Estimator','mulch','salt/de-icer','Planned-vs-actual','Inventory authority'],'Build 343 Help');
must(roadmap,['#### **343 — Landscape Material Estimator** is implemented','#### **344 — Change Orders & Extras** is implemented','#### **350 — Owner / Management Command Centre** is implemented'],'Build 343 roadmap');
must(pkg,['test:landscape-material-estimator','test:browser:landscape-material-estimator'],'Build 343 scripts');
must(workflow,['npm run test:landscape-material-estimator','npm run test:browser:landscape-material-estimator'],'Build 343 CI');
must(behavior,['boundary-exact-90-actions','boundary-build343-landscape-material-estimator'],'Boundary behavior');

const require=createRequire(import.meta.url),ts=require('typescript');
for(const p of ['supabase/functions/operations-manage/index.ts','supabase/functions/admin-directory/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
  const o=ts.transpileModule(read(p),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:p});
  const errors=(o.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join(' | '));
}
new Function(ui);
console.log('PASS build343-schema231-material-estimator');
console.log('PASS build343-material-categories-four-season');
console.log('PASS build343-measurement-conversion-waste');
console.log('PASS build343-planned-vs-actual-evidence');
console.log('PASS build343-canonical-inventory-authority');
console.log('PASS build343-operations-api');
console.log('PASS build343-admin-workbench');
console.log('PASS build343-release-gates');
console.log('PASS build343-roadmap-advance');
console.log('\nBuild 343 Landscape Material Estimator source gate GREEN: 9/9 checks.');
