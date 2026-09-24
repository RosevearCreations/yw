import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/232_change_orders_extras.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const directory=read('supabase/functions/admin-directory/index.ts');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const ui=read('js/admin-change-orders-extras-ui.js');
const hub=read('js/admin-hub-ui.js');
const index=read('index.html');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const behavior=read('scripts/module-write-boundary-behavior-check.mjs');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(migration,[
  'Schema 232 — Build 344 Change Orders & Extras',
  'alter table public.change_orders',
  'create table if not exists public.change_order_evidence',
  'create table if not exists public.change_order_budget_applications',
  'create or replace view public.v_change_order_extras_directory',
  'create or replace function public.ywi_rpc_change_order_discovery_save',
  'create or replace function public.ywi_rpc_change_order_evidence_save',
  'create or replace function public.ywi_rpc_change_order_review_price',
  'create or replace function public.ywi_rpc_change_order_customer_authorization',
  'create or replace function public.ywi_rpc_change_order_apply',
  'create or replace function public.ywi_rpc_change_order_invoice_evidence_save',
  'Exactly 78 explicitly handled operations-manage actions',
  '232 as expected_schema_version'
],'Schema 232');

for(const authority of ['change_orders','work_orders','work_order_lines','job_invoice_candidates','ar_invoices']){
  assert.ok(!new RegExp('create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.'+authority+'\\b','i').test(migration),'Build 344 must not recreate canonical '+authority);
}
const discovery=migration.slice(migration.indexOf('create or replace function public.ywi_rpc_change_order_discovery_save'),migration.indexOf('create or replace function public.ywi_rpc_change_order_evidence_save'));
assert.ok(!/update\s+public\.work_orders/i.test(discovery),'Crew discovery must not change work-order budget.');
const lifecycleFns=migration.slice(migration.indexOf('create or replace function public.ywi_rpc_change_order_discovery_save'),migration.indexOf('revoke all on function public.ywi_rpc_change_order_discovery_save'));
assert.ok(!/insert\s+into\s+public\.job_invoice_candidates/i.test(lifecycleFns),'Build 344 lifecycle RPCs must not create Finance invoice candidates.');
assert.ok(!/insert\s+into\s+public\.ar_invoices/i.test(lifecycleFns),'Build 344 lifecycle RPCs must not create AR invoices.');

must(migration,["customer_authorization_status<>''authorized''",'change_order_work_order_line_uk',"'invoice_created',false","'finance_posted',false"],'Authorization/idempotency/Finance boundary');

must(boundaries,[
 "change_order_discovery_save: contract('change_order_discovery_save', 'jobs', 'create', 'write', 'change_orders_extras'",
 "change_order_evidence_save: contract('change_order_evidence_save', 'jobs', 'create', 'write', 'change_orders_extras'",
 "change_order_review_price: contract('change_order_review_price', 'jobs', 'approve', 'write', 'change_orders_extras'",
 "change_order_customer_authorization: contract('change_order_customer_authorization', 'jobs', 'approve', 'write', 'change_orders_extras'",
 "change_order_apply: contract('change_order_apply', 'jobs', 'approve', 'write', 'change_orders_extras'",
 "change_order_invoice_evidence_save: contract('change_order_invoice_evidence_save', 'jobs', 'approve', 'write', 'change_orders_extras'"
],'Build 344 boundaries');

must(operations,[
 "action === 'change_order_discovery_save'","action === 'change_order_evidence_save'","action === 'change_order_review_price'",
 "action === 'change_order_customer_authorization'","action === 'change_order_apply'","action === 'change_order_invoice_evidence_save'",
 'build:344,schema:232','customer_billing_mutated:false','invoice_created:false','finance_posted:false'
],'Build 344 API');
must(directory,["scope === 'change_orders_extras'","moduleKey: 'jobs', minimum: 'view'",'v_change_order_extras_directory','change_order_invoice_candidates','Finance invoice creation/posting remains separate'],'Build 344 directory');
must(ui,['Build 344 — Change Orders &amp; Extras','Crew field discovery','Evidence / photos','customer authorization','Apply Authorized Scope / Budget Once','Finance authority',"scope:'change_orders_extras'","action:'change_order_apply'"],'Build 344 UI');
must(hub,['loadBuild344ChangeOrdersExtras','loadBuild344ChangeOrdersExtras();'],'Build 344 mount');
must(index,['/js/admin-change-orders-extras-ui.js?v=2026-09-23b344'],'Build 344 preload');
must(help,['Build 344 — Change Orders &amp; Extras','No field-only price change','Customer authorization gate','Finance authority'],'Build 344 help');
must(roadmap,['#### **344 — Change Orders & Extras** is implemented','#### **345 — Quality Control & Customer Signoff** is implemented','next planned autonomous item is **347 — Universal Activity & Audit Timeline**'],'Build 344 roadmap');
must(pkg,['test:change-orders-extras','test:browser:change-orders-extras'],'Build 344 scripts');
must(workflow,['npm run test:change-orders-extras','npm run test:browser:change-orders-extras'],'Build 344 CI');
must(behavior,['boundary-exact-90-actions','boundary-build344-change-orders-extras'],'Build 344 boundary behavior');

const require=createRequire(import.meta.url),ts=require('typescript');
for(const p of ['supabase/functions/operations-manage/index.ts','supabase/functions/admin-directory/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
 const o=ts.transpileModule(read(p),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:p});
 assert.equal((o.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,p+' syntax errors');
}
new Function(ui);
console.log('PASS build344-change-orders-extras');
console.log('PASS build344-no-hidden-field-price');
console.log('PASS build344-customer-authorization-gate');
console.log('PASS build344-idempotent-budget-application');
console.log('PASS build344-finance-authority-preserved');
console.log('Build 344 Change Orders & Extras source gate GREEN');
