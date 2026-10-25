import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const ui=read('js/company-service-registry-420.js');new Function(ui);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(ui,ctx);
const keys=Array.from(ctx.window.YWI420.keys);
assert.deepEqual(keys,['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const company={id:'c-1'};
const original=keys.map(module_key=>({company_id:'c-1',module_key,enabled:false,created_at:'2026-10-20Z',updated_at:'2026-10-20Z'}));
assert.equal(ctx.window.YWI420.verifyRows(company,original).length,7);
assert.throws(()=>ctx.window.YWI420.verifyRows(company,original.slice(1)),/incomplete/);
assert.throws(()=>ctx.window.YWI420.verifyRows(company,original.map((r,i)=>i? r:{...r,company_id:'other'})),/invalid/);
assert.throws(()=>ctx.window.YWI420.verifyRows(company,original.map((r,i)=>i? r:{...r,enabled:'true'})),/invalid/);
const sql=read('sql/company_service_offering_registry_420.sql');
for(const table of ['ywi_companies','ywi_company_service_modules','ywi_company_service_module_audit']){
 assert.ok(sql.includes('create table if not exists public.'+table),table);
 assert.ok(sql.includes('alter table public.'+table+' enable row level security;'),table);
 assert.ok(sql.includes('revoke all on public.'+table+' from public,anon,authenticated;'),table);
}
for(const x of keys)assert.ok((sql+read('sql/pms_septic_arboriculture_451.sql')).includes("'"+x+"'"));
for(const must of ['owner_user_id = (select auth.uid())','security definer','ywi_company_service_seed_420','enabled boolean not null default false',
'update(enabled)','for update to authenticated','after update of enabled','on delete restrict','previous_enabled','next_enabled'])
 assert.ok(sql.includes(must),must);
assert.ok(!sql.includes('alter table public.clients '));
assert.ok(!sql.includes('alter table public.work_orders '));
assert.doesNotMatch(ui,/service_role|SUPABASE_SECRET_KEY/);
for(const term of ['ownerSession','getUser','confirm','WITHHELD','Item 421','ywi_company_service_module_audit'])
 assert.ok(ui.includes(term),term);
for(const term of ['company-service-registry-420.js','company-service-registry-420.spec.mjs'])
 assert.ok((read('index.html')+read('package.json')).includes(term),term);
const workflow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(workflow.includes('npm run test:company-service-registry-420'));
assert.ok(workflow.includes('npm run test:browser:company-service-registry-420'));
assert.ok(read('help.html').includes('id="company-service-registry-420"'));
console.log('Item 420 registry schema, owner/RLS/audit and source gates PASS');
