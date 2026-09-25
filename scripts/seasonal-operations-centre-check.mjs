import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/234_seasonal_operations_centre.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const directory=read('supabase/functions/admin-directory/index.ts');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const ui=read('js/admin-seasonal-operations-ui.js');
const hub=read('js/admin-hub-ui.js');
const index=read('index.html');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const behavior=read('scripts/module-write-boundary-behavior-check.mjs');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(migration,[
  'Schema 234 — Build 346 Seasonal Operations Centre',
  'create table if not exists public.seasonal_operations_cycles',
  'create table if not exists public.seasonal_operations_checklist_templates',
  'create table if not exists public.seasonal_operations_checklist_items',
  'create table if not exists public.seasonal_operations_readiness_reviews',
  'create table if not exists public.seasonal_operations_rollover_decisions',
  'create table if not exists public.seasonal_storm_events',
  'create table if not exists public.seasonal_storm_route_activations',
  'winter','salt, de-icer and traction-material stock',
  'create or replace view public.v_seasonal_operations_outstanding_work',
  'create or replace function public.ywi_rpc_seasonal_cycle_save',
  'create or replace function public.ywi_rpc_seasonal_storm_route_activation_save',
  'Exactly 90 explicitly handled operations-manage actions',
  '234 as expected_schema_version'
],'Schema 234');

for(const authority of ['recurring_service_agreements','preventive_maintenance_plans','materials_catalog','routes','workability_observations','crews']){
  assert.ok(!new RegExp('create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.'+authority+'\\b','i').test(migration),'Build 346 must not recreate canonical '+authority);
}
const lifecycle=migration.slice(migration.indexOf('create or replace function public.ywi_rpc_seasonal_cycle_save'),migration.indexOf('revoke all on function public.ywi_rpc_seasonal_cycle_save'));
for(const authority of ['recurring_service_agreements','preventive_maintenance_plans','materials_catalog','routes','workability_observations','crews']){
  assert.ok(!new RegExp('(?:update|insert\\s+into|delete\\s+from)\\s+public\\.'+authority+'\\b','i').test(lifecycle),'Seasonal RPCs must not mutate canonical '+authority);
}
must(migration,[
  "seasonal_operations_cycles_winter_core_chk",
  "Winter snow-clearing/removal is core operations, not optional.",
  "Route must be winter/four-season and storm-event capable in canonical route planning before activation.",
  "Storm event must be active before a route can be activated.",
  "canonical_authorities_preserved",
  "seasonal_operations_private",
  "four_season_checklist_coverage"
],'seasonal boundaries');

must(boundaries,[
 "seasonal_cycle_save: contract('seasonal_cycle_save', 'jobs', 'approve', 'write', 'seasonal_operations'",
 "seasonal_checklist_save: contract('seasonal_checklist_save', 'jobs', 'approve', 'write', 'seasonal_operations'",
 "seasonal_readiness_save: contract('seasonal_readiness_save', 'jobs', 'approve', 'write', 'seasonal_operations'",
 "seasonal_rollover_save: contract('seasonal_rollover_save', 'jobs', 'approve', 'write', 'seasonal_operations'",
 "seasonal_storm_event_save: contract('seasonal_storm_event_save', 'jobs', 'approve', 'write', 'seasonal_operations'",
 "seasonal_storm_route_activation_save: contract('seasonal_storm_route_activation_save', 'jobs', 'approve', 'write', 'seasonal_operations'"
],'Build 346 boundaries');

must(operations,[
 "action === 'seasonal_cycle_save'","action === 'seasonal_checklist_save'","action === 'seasonal_readiness_save'",
 "action === 'seasonal_rollover_save'","action === 'seasonal_storm_event_save'","action === 'seasonal_storm_route_activation_save'",
 'build:346,schema:234','canonical_sources_mutated:false','canonical_agreement_mutated:false','canonical_route_mutated:false'
],'Build 346 API');

must(directory,[
 "scope === 'seasonal_operations'","seasonal_operations_cycles:cycles","seasonal_operations_outstanding_work:outstanding",
 'v_recurring_service_program_directory','v_workforce_crew_directory','v_preventive_maintenance_workbench',
 'v_material_stock_control','v_route_planning_directory','v_weather_workability_queue',
 'Winter snow-clearing/removal is a core operating season'
],'Build 346 directory');

must(ui,[
 'Build 346 — Seasonal Operations Centre','Winter is core operations','Authority boundary',
 'Seasonal checklist','Readiness review','Recurring-customer rollover','Winter storm event','Storm-route activation','Outstanding seasonal work',
 "scope:'seasonal_operations'","action:'seasonal_cycle_save'","action:'seasonal_storm_route_activation_save'",
 'Canonical recurring agreement was not changed'
],'Build 346 UI');

must(hub,['loadBuild346SeasonalOperations','loadBuild346SeasonalOperations();'],'Build 346 mount');
must(index,['/js/admin-seasonal-operations-ui.js?v=2026-09-24b346'],'Build 346 preload');
must(help,['Build 346 — Seasonal Operations Centre','Winter is core operations','Salt/de-icer/traction stock','Canonical authority'],'Build 346 help');
must(roadmap,['#### **346 — Seasonal Operations Centre** is implemented','#### **347 — Universal Activity & Audit Timeline** is implemented','next planned autonomous item is **349 — Saved Views, Search & Command Centre**'],'Build 346 roadmap');
must(pkg,['test:seasonal-operations-centre','test:browser:seasonal-operations-centre'],'Build 346 scripts');
must(workflow,['npm run test:seasonal-operations-centre','npm run test:browser:seasonal-operations-centre'],'Build 346 CI');
must(behavior,['boundary-exact-90-actions','boundary-build346-seasonal-operations-centre'],'Build 346 boundary behavior');

const require=createRequire(import.meta.url),ts=require('typescript');
for(const p of ['supabase/functions/operations-manage/index.ts','supabase/functions/admin-directory/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
 const o=ts.transpileModule(read(p),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:p});
 const errors=(o.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join(' | '));
}
new Function(ui);
console.log('PASS build346-seasonal-operations-centre');
console.log('PASS build346-winter-core-operations');
console.log('PASS build346-canonical-authorities-preserved');
console.log('PASS build346-storm-route-capability-gate');
console.log('PASS build346-four-season-checklist-and-outstanding-work');
console.log('Build 346 Seasonal Operations Centre source gate GREEN');
