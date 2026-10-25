import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {hr,garbage,companyId,foreignCompanyId,ownerId,companyAdminTest,stickerId} from '../tests/fixtures/pms-hr-garbage-445.mjs';
const read=p=>readFileSync(p,'utf8');
const js=read('js/pms-hr-garbage-445.js');new Function(js);
const env={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,env);
const {inspectHR,inspectGarbage,kinds,statuses}=env.window.YWI445;
const now=Date.now(),args={companyId,now,allowed:true};
assert.equal(inspectHR(hr({now}),args).state,'verified_hr');
assert.equal(inspectGarbage(garbage({now}),args).state,'verified_garbage');
assert.equal(inspectGarbage(garbage({now}),args).enabled,false);
assert.equal(inspectGarbage(garbage({now,enabled:true}),args).enabled,true);
assert.equal(inspectHR(hr({now}),{...args,allowed:false}).state,'withheld');
assert.equal(inspectGarbage(garbage({now}),{...args,companyId:foreignCompanyId}).state,'withheld');
assert.equal(inspectHR(hr({now}),{...args,companyId:foreignCompanyId}).state,'withheld');
assert.equal(companyAdminTest.password_copied,false);assert.equal(companyAdminTest.live_company_created,false);
assert.equal(typeof ownerId,'string');
assert.deepEqual(Array.from(kinds),['onboarding','certification','training','shift','leave','retention']);
assert.ok(statuses.includes('review_due'));
const altered=(factory,fn)=>{const data=factory({now});fn(data);return data};
for(const [description,fn] of [
 ['foreign employee ID',s=>{s.entries[0].employee_id='e4450000-0000-4445-8445-000000000002'}],
 ['duplicate employee',s=>{s.people.push(s.people[0]);s.people_count++}],
 ['source count mismatch',s=>{s.entries_count=9}],
 ['wage leak',s=>{s.wages_included=true}],
 ['payroll grant',s=>{s.payroll_authorized=true}],
 ['Auth clone',s=>{s.identity_cloned=true}],
 ['stale source',s=>{s.captured_at=new Date(now-360000).toISOString()}],
 ['unexpected write',s=>{s.mutation_authorized=true}]
])assert.equal(inspectHR(altered(hr,fn),args).state,'withheld',description);
for(const [description,fn] of [
 ['foreign sticker on pickup',s=>{s.pickups[0].service_basis='sticker';s.pickups[0].contract_id=null;s.pickups[0].sticker_id='a4450000-0000-4445-8445-000000000002'}],
 ['foreign contract site',s=>{s.contracts[0].site_id='b4450000-0000-4445-8445-000000000002'}],
 ['duplicated sticker',s=>{s.stickers.push(s.stickers[0]);s.sticker_count++}],
 ['stale source',s=>{s.captured_at=new Date(now-360000).toISOString()}],
 ['billing enabled',s=>{s.auto_billing=true}],
 ['pretend payment receipt',s=>{s.financial_receipt_verified=true}],
 ['dispatch claim',s=>{s.route_dispatched=true}],
 ['unbounded pickups',s=>{s.pickup_count=201}]
])assert.equal(inspectGarbage(altered(garbage,fn),args).state,'withheld',description);
const ok=altered(garbage,s=>{s.pickups[0].sticker_id=stickerId;s.pickups[0].contract_id=null;s.pickups[0].service_basis='sticker'});
assert.equal(inspectGarbage(ok,args).state,'verified_garbage');
for(const needle of ['ywi_rpc_pms_hr_snapshot_445','ywi_rpc_pms_hr_create_person_445',
 'ywi_rpc_pms_hr_append_445','ywi_rpc_pms_garbage_snapshot_445',
 'ywi_rpc_pms_garbage_switch_445','ywi_rpc_pms_garbage_issue_sticker_445',
 'ywi_rpc_pms_garbage_contract_445','ywi_rpc_pms_garbage_schedule_445',
 'ywi_rpc_pms_garbage_complete_445','ywi_rpc_customer_history_422',
 'auth.getUser','crypto.randomUUID','ywi:auth-changed','ywi:module-permissions-changed'])assert.ok(js.includes(needle),needle);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'browser cannot write tables directly');
const a=read('sql/pms_employee_hr_445.sql').toLowerCase(),b=read('sql/pms_rural_garbage_445.sql').toLowerCase();
for(const [sql,needles] of [[a,['begin;','commit;','enable row level security','revoke all on public.ywi_pms_hr_people_445','security definer set search_path',
 'ywi_422_assert_owner','module_key=\'admin\'','append','pg_advisory_xact_lock','grant execute on function public.ywi_rpc_pms_hr_snapshot_445']],
 [b,['begin;','commit;','enable row level security','default false','ywi_422_assert_jobs_create','ywi_422_assert_link',
 'foreign key(company_id,client_id,site_id)','pg_advisory_xact_lock','reported_active','redeemed','grant execute on function public.ywi_rpc_pms_garbage_snapshot_445']]])for(const n of needles)assert.ok(sql.includes(n),n);
assert.ok(b.indexOf('return v_existing.id;',b.indexOf('function public.ywi_rpc_pms_garbage_schedule_445'))<b.indexOf("if p_basis='sticker'",b.indexOf('function public.ywi_rpc_pms_garbage_schedule_445')),
 'pickup retry must be resolved before source is consumed');
assert.ok(read('index.html').includes('js/pms-hr-garbage-445.js'));
assert.ok(read('help.html').includes('id="pms-employee-hr-445"'));
assert.ok(read('help.html').includes('id="pms-garbage-collection-445"'));
assert.ok(read('js/pms-module-navigation-443.js').includes('pms443Garbage'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 445 implementation'));
const pkg=JSON.parse(read('package.json'));
for(const command of ['test:pms-hr-garbage-445','test:browser:pms-hr-garbage-445']){
 assert.ok(pkg.scripts[command]);assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+command));
}
console.log('YW 445 owner/private HR, OFF-default garbage stickers, contracts, pickup provenance, tenant denial and synthetic Yard Rosevear gates: PASS');
