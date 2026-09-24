import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/229_route_optimization_territory_management.sql');
const directory=read('supabase/functions/admin-directory/index.ts');
const operations=read('supabase/functions/operations-manage/index.ts');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const ui=read('js/admin-route-optimization-ui.js');
const hub=read('js/admin-hub-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const behavior=read('scripts/module-write-boundary-behavior-check.mjs');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(migration,[
 'Schema 229 — Build 341 Route Optimization & Territory Management',
 'create table if not exists public.route_territories','create table if not exists public.route_territory_sites',
 'create table if not exists public.route_optimization_runs','create table if not exists public.route_optimization_stop_proposals',
 'create or replace view public.v_route_planning_directory','create or replace view public.v_route_optimization_run_directory',
 "'advisory_only_operator_dispatch_required'::text as dispatch_application_status",
 'storm_event_active','storm_event_capable','229 as expected_schema_version',
 'Exactly 66 explicitly handled operations-manage actions'
],'Schema 229');
for(const authority of ['routes','route_stops','dispatch_schedule_items','recurring_service_agreements','client_sites']){
 assert.ok(!new RegExp('create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.'+authority+'\\b','i').test(migration),'Build 341 must not recreate '+authority);
}
const decision=migration.slice(migration.indexOf('create or replace function public.ywi_rpc_route_optimization_decision'),migration.indexOf('revoke all on function public.ywi_rpc_route_territory_save'));
assert.ok(!decision.includes('update public.dispatch_schedule_items'),'Optimization decision must not update dispatch.');
assert.ok(!decision.includes('update public.route_stops'),'Optimization decision must not rewrite route stops.');
must(boundaries,[
 "route_territory_save: contract('route_territory_save', 'jobs', 'approve', 'write', 'route_optimization'",
 "route_territory_site_save: contract('route_territory_site_save', 'jobs', 'approve', 'write', 'route_optimization'",
 "route_optimization_generate: contract('route_optimization_generate', 'jobs', 'approve', 'write', 'route_optimization'",
 "route_optimization_decision: contract('route_optimization_decision', 'jobs', 'approve', 'write', 'route_optimization'"
],'Routing boundaries');
must(operations,["action === 'route_territory_save'","action === 'route_territory_site_save'","action === 'route_optimization_generate'","action === 'route_optimization_decision'","build:341,schema:229",'dispatch_mutated:false'],'Routing actions');
must(directory,["scope === 'routing'",'v_route_territory_directory','v_route_planning_directory','v_route_optimization_run_directory','v_route_optimization_stop_directory','Optimization is advisory only'],'Routing read scope');
must(ui,['Build 341 — Route Optimization & Territory Management','Four-season Ontario routing','winter snow clearing/removal',"scope:'routing'","action:'route_optimization_generate'","action:'route_optimization_decision'",'Dispatch was not changed'],'Routing UI');
must(hub,['loadBuild341RouteOptimization','/js/admin-route-optimization-ui.js?v=2026-09-23b341',"if (key === 'operations') { loadBuild340CustomerPropertyCRM(); loadBuild341RouteOptimization(); loadBuild342WeatherWorkability(); loadBuild343LandscapeMaterialEstimator(); loadBuild344ChangeOrdersExtras(); loadBuild345QualityControl(); }"],'Routing lazy load');
must(help,['Build 341 — Route Optimization &amp; Territory Management','advisory','storm-event','dispatch authority'],'Build 341 help');
must(roadmap,['#### **341 — Route Optimization & Territory Management** is implemented','#### **342 — Weather & Workability Controls** is implemented','#### **343 — Landscape Material Estimator** is implemented','next planned autonomous item is **346 — Seasonal Operations Centre**'],'Build 341 roadmap');
must(pkg,['test:route-optimization-territory','test:browser:route-optimization-territory'],'Build 341 scripts');
must(workflow,['npm run test:route-optimization-territory','npm run test:browser:route-optimization-territory'],'Build 341 CI');
must(behavior,['boundary-exact-84-actions','boundary-build341-route-optimization'],'Boundary behavior');

const require=createRequire(import.meta.url),ts=require('typescript');
for(const p of ['supabase/functions/operations-manage/index.ts','supabase/functions/admin-directory/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
 const o=ts.transpileModule(read(p),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:p});
 const errors=(o.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,p+' syntax errors');
}
console.log('Build 341 Route Optimization & Territory Management source gate GREEN');