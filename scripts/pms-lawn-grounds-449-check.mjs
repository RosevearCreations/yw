import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,foreignCompanyId,foreignPropertyId,planId,zoneId,ownerId,company}
 from '../tests/fixtures/pms-lawn-grounds-449.mjs';
const read=f=>readFileSync(f,'utf8');
const js=read('js/pms-lawn-grounds-449.js');new Function(js);
const scope={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,scope);
const {inspect,forecast,services,recurr,statuses,qcStates}=scope.window.YWI449;
const now=Date.now(),args={companyId,now,jobsAllowed:true};
const result=inspect(fixture({now}),args);
assert.equal(result.state,'verified_lawn');assert.equal(result.enabled,true);
assert.equal(result.plans.length,1);assert.equal(result.zones.length,2);assert.equal(result.visits.length,2);
assert.equal(result.newWork,true);assert.equal(result.canDispatch,false);assert.equal(result.canInvoice,false);
assert.equal(inspect(fixture({now,enabled:false}),args).state,'verified_lawn');
assert.equal(inspect(fixture({now,enabled:false}),args).newWork,false);
assert.deepEqual(Array.from(forecast(result.plans[0],{today:'2026-10-25',days:21,limit:3})),
 ['2026-10-28','2026-11-04','2026-11-11']);
assert.deepEqual(Array.from(forecast({...result.plans[0],recurrence:'one_time',interval_days:null},
 {today:'2026-10-25'})),[]);
assert.deepEqual(Array.from(forecast({...result.plans[0],recurrence:'every_n_days',interval_days:5},
 {today:'2026-10-25',days:16,limit:4})),['2026-10-26','2026-10-31','2026-11-05','2026-11-10']);
assert.equal(services.length,7);assert.equal(recurr.length,4);
assert.equal(statuses.length,5);assert.equal(qcStates.length,3);
assert.equal(company.name,'Yard Rosevear');assert.ok(ownerId);
const mutate=fn=>{const s=fixture({now});fn(s);return s};
for(const [name,fn] of [
 ['foreign company',s=>s.company_id=foreignCompanyId],
 ['foreign company plan',s=>s.plans[0].company_id=foreignCompanyId],
 ['malformed site',s=>s.plans[0].site_id='unverified'],
 ['foreign zone plan',s=>s.zones[0].plan_id='a4490000-0000-4444-8444-000000000099'],
 ['cross-plan visit zone',s=>s.visits[0].zone_id='b4490000-0000-4444-8444-000000000099'],
 ['duplicate plan',s=>s.plans.push({...s.plans[0]})],
 ['duplicate zone',s=>s.zones[1].id=zoneId],
 ['duplicate visit',s=>s.visits[1].id=s.visits[0].id],
 ['bad count',s=>s.visit_count=0],
 ['stale',s=>s.captured_at=new Date(now-360000).toISOString()],
 ['future',s=>s.captured_at=new Date(now+120000).toISOString()],
 ['wrong guard',s=>s.new_work_guard='browser'],
 ['fake invoice',s=>s.invoice_posted=true],
 ['fake dispatch',s=>s.dispatch_authorized=true],
 ['fake QC verification',s=>s.qc_verified_independently=true],
 ['foreign service',s=>s.module_key='snow_removal'],
 ['invalid QC',s=>s.visits[1].qc_note=null],
 ['invalid recurrence',s=>s.plans[0].recurrence='hourly'],
 ['invalid price',s=>s.visits[0].estimated_visit_cents=-1],
 ['unbounded',s=>s.plan_count=101]
])assert.equal(inspect(mutate(fn),args).state,'withheld',name);
assert.equal(inspect(fixture({now}),{...args,jobsAllowed:false}).state,'withheld');
assert.equal(inspect(fixture({now}),{...args,companyId:foreignCompanyId}).state,'withheld');
for(const x of ['auth.getUser','YWISecurity','ywi_rpc_pms_lawn_snapshot_449',
 'ywi_rpc_pms_lawn_plan_449','ywi_rpc_pms_lawn_zone_449','ywi_rpc_pms_lawn_visit_449',
 'ywi_rpc_customer_history_422','ywi_rpc_company_customers_422','pms449History',
 'crypto?.randomUUID','ywi:auth-changed','ywi:module-permissions-changed',
 'historical_read_retained','qc_verified_independently'])assert.ok(js.includes(x),x);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'Writes must stay RPC-only');
const sql=read('sql/pms_lawn_grounds_449.sql').toLowerCase();
for(const x of ['begin;','commit;','enable row level security','revoke all on public.ywi_pms_lawn_plans_449',
 'revoke all on public.ywi_pms_lawn_zones_449','revoke all on public.ywi_pms_lawn_visits_449',
 'no browser rls policies','foreign key(company_id,client_id,site_id)',
 'foreign key(company_id,plan_id,zone_id)','ywi_422_assert_owner',
 "ywi_421_assert_company_new_work(p_company_id,'landscape'",'on conflict(company_id,request_id) do nothing',
 'idempotency key reused with different content','pg_advisory_xact_lock',
 'qc_status','photo_reference','historical_read_retained',
 'dispatch_authorized','invoice_posted','grant execute on function public.ywi_rpc_pms_lawn_snapshot_449',
 'grant execute on function public.ywi_rpc_pms_lawn_plan_449',
 'grant execute on function public.ywi_rpc_pms_lawn_zone_449',
 'grant execute on function public.ywi_rpc_pms_lawn_visit_449'])assert.ok(sql.includes(x),x);
assert.ok(read('index.html').includes('js/pms-lawn-grounds-449.js'));
assert.ok(read('help.html').includes('id="pms-lawn-grounds-449"'));
assert.ok(read('js/pms-module-navigation-443.js').includes("target:'owner449'"));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 449 implementation'));
assert.ok(read('style.css').includes('.pms449-grid'));
const scripts=JSON.parse(read('package.json')).scripts;
for(const script of ['test:pms-lawn-grounds-449','test:browser:pms-lawn-grounds-449']){
 assert.ok(scripts[script]);assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+script));}
console.log('YW Build 449 Lawn plans, zones, immutable field QC, recurrence, tenant isolation and authority: PASS');
