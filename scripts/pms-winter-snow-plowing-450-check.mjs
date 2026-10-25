import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,foreignCompanyId,company,removalId,plowId,snowReviewId}
 from '../tests/fixtures/pms-winter-snow-plowing-450.mjs';
const read=path=>readFileSync(path,'utf8');
const js=read('js/pms-winter-snow-plowing-450.js');new Function(js);
const scope={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(js,scope);
const {inspect,keys,modes,reviews,outcomes,qcStates}=scope.window.YWI450;
const now=Date.now(),args={companyId,now,jobsAllowed:true};
const result=inspect(fixture({now}),args);
assert.equal(result.state,'verified_winter');
assert.equal(result.services.length,2);assert.equal(result.agreements.length,2);
assert.equal(result.storms.length,2);assert.equal(result.passes.length,2);
assert.equal(result.canActivate,false);assert.equal(result.canDispatch,false);assert.equal(result.canInvoice,false);
assert.deepEqual(Array.from(keys),['snow_removal','snow_plowing']);
assert.equal(modes.length,3);assert.equal(reviews.length,3);assert.equal(outcomes.length,4);
assert.equal(qcStates.length,3);assert.equal(company.name,'Yard Rosevear');
assert.equal(inspect(fixture({now,snowEnabled:false}),args).state,'verified_winter');
for(const [name,change] of [
 ['foreign tenant',x=>x.company_id=foreignCompanyId],
 ['bad agreement owner',x=>x.agreements[0].company_id=foreignCompanyId],
 ['cross-service review',x=>x.storms[0].service_key='snow_plowing'],
 ['cross-service pass',x=>x.passes[0].storm_review_id=x.storms[1].id],
 ['foreign review',x=>x.storms[0].agreement_id=plowId],
 ['fake activation',x=>x.activation_authorized=true],
 ['fake Safety',x=>x.safety_verified=true],
 ['fake Fleet',x=>x.fleet_verified=true],
 ['fake weather',x=>x.weather_verified=true],
 ['fake dispatch',x=>x.dispatch_authorized=true],
 ['fake invoice',x=>x.invoice_posted=true],
 ['duplicate plan',x=>x.agreements[1].id=removalId],
 ['duplicate storm',x=>x.storms[1].id=snowReviewId],
 ['wrong count',x=>x.pass_count=42],
 ['stale',x=>x.captured_at=new Date(now-360000).toISOString()],
 ['future',x=>x.captured_at=new Date(now+180000).toISOString()],
 ['incomplete service registry',x=>x.services.pop()],
 ['bad threshold',x=>x.agreements[0].trigger_cm=-1],
 ['missing weather review source',x=>x.storms[0].weather_source=null],
 ['missing plowing Fleet',x=>x.storms[1].fleet_source=null],
 ['bad reported passes',x=>x.passes[0].reported_passes=0],
 ['unjustified QC',x=>x.passes[0].qc_note=null]
]){const v=fixture({now});change(v);assert.equal(inspect(v,args).state,'withheld',name)}
assert.equal(inspect(fixture({now}),{...args,jobsAllowed:false}).state,'withheld');
assert.equal(inspect(fixture({now}),{...args,companyId:foreignCompanyId}).state,'withheld');
for(const required of ['owner450Snow','owner450Plow','auth.getUser','YWISecurity',
 'ywi_rpc_pms_winter_snapshot_450','ywi_rpc_pms_winter_agreement_450',
 'ywi_rpc_pms_winter_storm_450','ywi_rpc_pms_winter_pass_450',
 'ywi_rpc_company_customers_422','ywi_rpc_customer_history_422',
 'ywi:auth-changed','ywi:module-permissions-changed','crypto?.randomUUID',
 'activation_requested','snow_plowing','fleet.value'])assert.ok(js.includes(required),required);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'No browser direct DB writes');
const sql=read('sql/pms_winter_snow_plowing_450.sql').toLowerCase();
for(const required of ['begin;','commit;','enable row level security',
 'revoke all on public.ywi_pms_winter_agreements_450',
 'revoke all on public.ywi_pms_winter_storm_reviews_450',
 'revoke all on public.ywi_pms_winter_passes_450',
 'foreign key(company_id,client_id,site_id)',
 'foreign key(company_id,service_key,agreement_id,storm_review_id)',
 'ywi_422_assert_owner','ywi_421_assert_company_new_work(p_company_id,p_service',
 'ywi_421_assert_company_new_work(p_company_id,v_plan.service_key',
 'on conflict(company_id,request_id) do nothing',
 'pg_advisory_xact_lock','activation_requested',
 'weather_source','safety_source','fleet_source',
 'grant execute on function public.ywi_rpc_pms_winter_snapshot_450',
 'grant execute on function public.ywi_rpc_pms_winter_agreement_450',
 'grant execute on function public.ywi_rpc_pms_winter_storm_450',
 'grant execute on function public.ywi_rpc_pms_winter_pass_450'])assert.ok(sql.includes(required),required);
assert.ok(read('index.html').includes('js/pms-winter-snow-plowing-450.js'));
assert.ok(read('help.html').includes('id="pms-winter-450"'));
assert.ok(read('style.css').includes('.pms450-grid'));
const nav=read('js/pms-module-navigation-443.js');
assert.ok(nav.includes("target:'owner450Snow'"));assert.ok(nav.includes("target:'owner450Plow'"));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 450 implementation'));
const scripts=JSON.parse(read('package.json')).scripts;
for(const target of ['test:pms-winter-snow-plowing-450','test:browser:pms-winter-snow-plowing-450']){
 assert.ok(scripts[target]);assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+target));}
console.log('YW Build 450 independent winter modules, source-gated route reviews, reported de-icing and tenant isolation: PASS');
