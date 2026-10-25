import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,company,companyId,ownerId,companyAdminTest,serviceKeys}
 from '../tests/fixtures/pms-module-navigation-443.mjs';
const read=p=>readFileSync(p,'utf8');
const js=read('js/pms-module-navigation-443.js');new Function(js);
const scope={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,scope);
const {inspect,keys,modules,planned}=scope.window.YWI443;
assert.deepEqual([...keys],[...serviceKeys]);
assert.equal(modules.length,6);
assert.equal(company.name,'Yard Rosevear');assert.equal(company.owner_user_id,ownerId);
assert.equal(companyAdminTest.scope_company_id,companyId);
assert.equal(companyAdminTest.real_auth_account,false);
assert.equal(companyAdminTest.password_copied,false);
assert.equal(companyAdminTest.grant.cross_company,false);
assert.equal(companyAdminTest.grant.payroll_bank_data,false);
const now=Date.now(),options={companyId,now,jobsAllowed:true};
const pass=inspect(fixture({now}),options);
assert.equal(pass.state,'verified_navigation_only');
assert.deepEqual(Array.from(pass.services,s=>s.key),['landscape','snow_removal','septic']);
assert.deepEqual([...pass.disabled],['construction','water_parks','snow_plowing']);
assert.equal(pass.historicalRead,true);assert.equal(pass.newWorkAllowed,false);
assert.ok(pass.planned.includes('Concrete Pouring'));
assert.ok(!pass.planned.includes('Accounting & Payroll'));
assert.ok(read('js/pms-module-navigation-443.js').includes('pms443Accounting'));
assert.ok(planned.includes('Fibre / Utility Trenching'));
const zero=inspect(fixture({now,enabled:[]}),options);
assert.equal(zero.state,'verified_navigation_only');assert.equal(zero.services.length,0);
const modify=fn=>{const d=fixture({now});fn(d);return d;};
for(const [reason,fn] of [
 ['foreign company',d=>d.company_id='a4420000-0000-4442-8442-000000000002'],
 ['foreign service row',d=>d.services[0].company_id='a4420000-0000-4442-8442-000000000002'],
 ['missing service',d=>d.services.pop()],
 ['duplicate service',d=>d.services[5].module_key='landscape'],
 ['invalid enabled',d=>d.services[0].enabled='true'],
 ['stale capture',d=>d.captured_at=new Date(now-6*60000).toISOString()],
 ['future capture',d=>d.captured_at=new Date(now+2*60000).toISOString()],
 ['mutations',d=>d.mutation_authorized=true],
 ['synthetic pretending production',d=>d.synthetic=true],
 ['wrong server guard',d=>d.jobs_new_work_guard='navigation-only'],
 ['missing historical audit',d=>d.historical_audit_retained=false]
])assert.equal(inspect(modify(fn),options).state,'withheld',reason);
assert.equal(inspect(fixture({now}),{...options,jobsAllowed:false}).state,'withheld');
assert.equal(inspect(fixture({now}),{...options,companyId:'nope'}).state,'withheld');
for(const needle of ['ywi_rpc_pms_navigation_443','YWISecurity','auth.getUser',
 'ywi:auth-changed','ywi:module-permissions-changed','pms443Desktop','pms443Mobile'])assert.ok(js.includes(needle),needle);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'read-only registry must not write');
const sql=read('sql/pms_tenant_module_navigation_443.sql');
for(const needle of ['security definer set search_path','ywi_422_assert_owner',
 'v_count<>6','ywi_421_assert_company_new_work','revoke all on function',
 'from public,anon,authenticated','to authenticated'])assert.ok(sql.includes(needle),needle);
const workSql=read('sql/company_new_work_entitlement_421.sql');
for(const needle of ['ywi_421_assert_company_new_work','421 company offering disabled',
 'before insert','ywi_company_service_modules'])assert.ok(workSql.includes(needle),needle);
assert.ok(read('index.html').includes('js/pms-module-navigation-443.js'));
assert.ok(read('help.html').includes('id="pms-tenant-module-navigation-443"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 443 implementation'));
for(const script of ['test:pms-module-navigation-443','test:browser:pms-module-navigation-443']){
 assert.ok(JSON.parse(read('package.json')).scripts[script]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+script));
}
console.log('YW 443 six-service owner-isolated PMS navigation, OFF routes, historical readability, synthetic company and server authorization: PASS');
