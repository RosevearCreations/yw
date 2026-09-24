import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/228_customer_property_crm.sql');
const directory=read('supabase/functions/admin-directory/index.ts');
const operations=read('supabase/functions/operations-manage/index.ts');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const ui=read('js/admin-customer-property-crm-ui.js');
const hub=read('js/admin-hub-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const behavior=read('scripts/module-write-boundary-behavior-check.mjs');
const must=(source,tokens,label)=>tokens.forEach((token)=>assert.ok(source.includes(token),label+': missing '+token));

must(migration,[
  'Schema 228 — Build 340 Customer & Property CRM','alter table public.clients',
  'create table if not exists public.crm_customer_interactions','create table if not exists public.crm_followups','create table if not exists public.crm_opportunities',
  'create or replace view public.v_crm_customer_directory','create or replace view public.v_crm_property_directory',
  'create or replace view public.v_crm_service_plan_directory','create or replace view public.v_crm_service_history',
  'create or replace view public.v_crm_renewal_queue','create or replace view public.v_crm_cross_service_candidates',
  "'advisory_only'::text as action_boundary",'winter snow clearing/removal','228 as expected_schema_version',
  'Exactly 62 explicitly handled operations-manage actions'
],'Schema 228');
for(const authority of ['clients','client_sites','quote_contact_requests','recurring_service_agreements','estimates','work_orders']){
  assert.ok(!new RegExp('create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.'+authority+'\\b','i').test(migration),'Build 340 must not recreate canonical '+authority+' authority.');
}
must(boundaries,[
  "crm_client_save: contract('crm_client_save', 'jobs', 'approve', 'write', 'customer_property_crm'",
  "crm_interaction_save: contract('crm_interaction_save', 'jobs', 'approve', 'write', 'customer_property_crm'",
  "crm_followup_save: contract('crm_followup_save', 'jobs', 'approve', 'write', 'customer_property_crm'",
  "crm_opportunity_save: contract('crm_opportunity_save', 'jobs', 'approve', 'write', 'customer_property_crm'"
],'CRM write boundaries');
must(operations,[
  "action === 'crm_client_save'","action === 'crm_interaction_save'","action === 'crm_followup_save'","action === 'crm_opportunity_save'",
  "supabase.rpc('ywi_rpc_crm_client_save'","supabase.rpc('ywi_rpc_crm_interaction_save'","supabase.rpc('ywi_rpc_crm_followup_save'","supabase.rpc('ywi_rpc_crm_opportunity_save'",
  'build:340,schema:228'
],'CRM operations');
must(directory,[
  "scope === 'crm'",'v_crm_customer_directory','v_crm_property_directory','v_quote_contact_followup_queue',
  'v_crm_service_plan_directory','v_crm_service_history','v_crm_interaction_timeline','v_crm_followup_queue',
  'v_crm_opportunity_directory','v_crm_renewal_queue','v_crm_cross_service_candidates',
  "seasonal_boundary:'YW is a four-season Ontario operation"
],'CRM read boundary');
must(ui,[
  'Build 340 — Customer & Property CRM','Four-season Ontario operating model','winter snow clearing/removal',
  "scope:'crm'","action:'crm_interaction_save'","action:'crm_followup_save'","action:'crm_opportunity_save'",'advisory only'
],'CRM UI');
must(hub,['loadBuild340CustomerPropertyCRM','/js/admin-customer-property-crm-ui.js?v=2026-09-23b340',"if (key === 'operations') { loadBuild340CustomerPropertyCRM(); loadBuild341RouteOptimization(); loadBuild342WeatherWorkability(); loadBuild343LandscapeMaterialEstimator(); loadBuild344ChangeOrdersExtras(); loadBuild345QualityControl(); }"],'CRM lazy loading');
must(help,['Build 340 — Customer &amp; Property CRM','canonical customer','snow clearing/removal','advisory only'],'Build 340 Help');
must(roadmap,['#### **340 — Customer & Property CRM** is implemented','#### **341 — Route Optimization & Territory Management** is implemented','#### **342 — Weather & Workability Controls** is implemented','#### **343 — Landscape Material Estimator** is implemented','next planned autonomous item is **346 — Seasonal Operations Centre**'],'Build 340 roadmap');
must(pkg,['test:customer-property-crm','test:browser:customer-property-crm'],'Build 340 package scripts');
must(workflow,['npm run test:customer-property-crm','npm run test:browser:customer-property-crm'],'Build 340 CI wiring');
must(behavior,['boundary-exact-84-actions','boundary-build340-customer-property-crm'],'Boundary behavior advancement');

const require=createRequire(import.meta.url),ts=require('typescript');
for(const path of ['supabase/functions/operations-manage/index.ts','supabase/functions/admin-directory/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
  const output=ts.transpileModule(read(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:path});
  const errors=(output.diagnostics||[]).filter((d)=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,path+' must transpile without TypeScript syntax errors');
}
console.log('Build 340 Customer & Property CRM source gate GREEN');
