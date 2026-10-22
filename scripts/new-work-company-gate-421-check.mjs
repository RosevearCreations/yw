import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';
const read=x=>fs.readFileSync(x,'utf8');const code=read('js/new-work-company-gate-421.js');
new Function(code);
const context={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(code,context);
const keys=Array.from(context.window.YWI421.keys);
assert.deepEqual(keys,['landscape','construction','water_parks','snow_removal','snow_plowing','septic']);
const rows=keys.map(module_key=>({company_id:'abc',module_key,enabled:false}));
assert.equal(context.window.YWI421.validate({id:'abc'},rows).length,0);
assert.equal(context.window.YWI421.validate({id:'abc'},rows.map((x,i)=>i===0?{...x,enabled:true}:x)).length,1);
assert.throws(()=>context.window.YWI421.validate({id:'abc'},rows.slice(1)),/Incomplete/);
assert.throws(()=>context.window.YWI421.validate({id:'abc'},rows.map((x,i)=>i===0?{...x,company_id:'foreign'}:x)),/Incomplete/);
const sql=read('sql/company_new_work_entitlement_421.sql');
for(const term of ['before insert or update on public.estimates','before insert or update on public.work_orders',
'ywi_421_assert_company_new_work','s.enabled is true','c.owner_user_id=v_actor','app_role_module_permissions',
'app_profile_module_permissions','is_active is true','foreign key (company_id,service_module_key)',
'ywi_rpc_create_scoped_estimate_421','ywi_rpc_create_scoped_work_order_421',
'old.company_id is distinct from new.company_id','old.client_id is distinct from new.client_id',
'Existing historical rows','ywi_new_work_gate_receipts_421','auth.uid()','security definer'])
 assert.ok(sql.includes(term),term);
assert.ok(!sql.includes('truncate public.'));
assert.ok(read('index.html').includes('/js/new-work-company-gate-421.js'));
assert.ok(read('help.html').includes('id="new-work-entitlement-421"'));
const pkg=JSON.parse(read('package.json'));const ci=read('.github/workflows/staging-browser-integration.yml');
assert.equal(pkg.scripts['test:new-work-company-gate-421'],'node scripts/new-work-company-gate-421-check.mjs');
assert.ok(ci.includes('npm run test:new-work-company-gate-421'));
assert.ok(ci.includes('npm run test:browser:new-work-company-gate-421'));
assert.ok(/Next queued: Item 42[23]/.test(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md')));
console.log('Item 421: strict canonical SQL INSERT guards, staff Jobs permission, owner service, historical continuity PASS');
