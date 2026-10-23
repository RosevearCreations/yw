import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/snow_removal_plowing_event_separation_427.sql');
const js=read('js/snow-removal-plowing-427.js');
const ctx={window:{},document:{readyState:'loading',addEventListener(){}},console};
vm.runInNewContext(js,ctx,{filename:'snow-removal-plowing-427.js'});
const ids={company:'bdde97a9-2450-4b31-8609-54bbd1096101',order:'d8f1c542-050f-4bac-bc27-6fe1c095b228',
 storm:'b11c6598-e715-47a4-aea4-87abe5a11221',dispatch:'7ea0ecdb-31f3-483c-918e-e72554109164',
 activation:'842acf6d-72a6-4445-91d2-707ae9d7f228',receipt:'71e0cfe4-5e24-47b1-9a1b-7bb996308cf3'};
const good={company_id:ids.company,work_order_id:ids.order,complete:true,source_limit:80,
 no_automatic_dispatch:true,no_double_billing:true,state:'review_only',
 orders:[{id:ids.order,number:'SNOW-001',service:'snow_removal',status:'draft'}],
 sources:[{dispatch_id:ids.dispatch,storm_event_id:ids.storm,activation_id:ids.activation,
  activation_status:'active',schedule_status:'dispatched'}],workability:[],safety:[],fleet:[],
 receipts:[{id:ids.receipt,dispatch_id:ids.dispatch,storm_event_id:ids.storm,
  service_module_key:'snow_removal',surface_kind:'sidewalk',evidence_state:'reported_unverified',source_gate:'hold'}]};
const validate=ctx.window.YWI427.validate;
assert.equal(validate(good,ids.company,ids.order),good);
for(const patch of [{complete:false},{no_automatic_dispatch:false},{no_double_billing:false},{source_limit:0},
 {orders:[{...good.orders[0],service:'snow_plowing',number:''}]},
 {receipts:[{...good.receipts[0],service_module_key:'snow_plowing'}]},
 {receipts:[{...good.receipts[0],source_gate:'approved'}]},
 {receipts:[good.receipts[0],good.receipts[0]]},
 {receipts:[{...good.receipts[0],dispatch_id:ids.storm}]},
 {sources:[{...good.sources[0],activation_status:'not_a_source'}]}])
 assert.throws(()=>validate({...good,...patch},ids.company,ids.order),/Partial|foreign|duplicate/i);
assert.throws(()=>validate(good,ids.company,null),/Partial|foreign|duplicate/i);
for(const key of [
 'public.ywi_snow_service_receipts_427','service_module_key in (\'snow_removal\',\'snow_plowing\')',
 'dispatch_id uuid not null unique','unique(work_order_id,receipt_key)',
 'public.seasonal_storm_events','public.seasonal_storm_route_activations',
 'public.dispatch_schedule_items','public.workability_observations','public.workability_decisions',
 'public.job_hazard_site_safety_plans','public.fleet_readiness_checks','public.equipment_fleet_profiles',
 'enable row level security','ywi_427_owner_read','ywi_427_receipt_immutable',
 'public.ywi_423_assert_order(p_company_id,p_work_order_id,p_write)',
 'public.ywi_427_assert_sources','public.ywi_rpc_record_snow_service_427',
 'public.ywi_rpc_snow_service_dashboard_427','original_source_fingerprint',
 "'source_changed_hold'","'independent_dispatch_safety_review_required'",
 "'no_double_billing',true","'no_automatic_dispatch',true",'auth.uid()'])
 assert.ok(sql.includes(key),`Missing canonical/security SQL contract: ${key}`);
assert.doesNotMatch(sql,/grant\s+(?:insert|update|delete|all)\s+on\s+public\.ywi_snow_service_receipts_427\s+to\s+authenticated/i);
assert.doesNotMatch(sql,/\b(?:update|insert into)\s+public\.(?:invoices|journal_entries|work_orders|dispatch_schedule_items|workability_decisions|job_hazard_site_safety_plans|equipment_items)\b/i);
for(const key of ['owner427','owner427Form','owner427Results','owner427Record','owner427Source','owner427Surface',
 'ywi_rpc_snow_service_dashboard_427','ywi_rpc_record_snow_service_427','window.confirm','WITHHELD',
 'snow_removal','snow_plowing','no_double_billing','no_automatic_dispatch'])
 assert.ok(js.includes(key),`Missing client guard: ${key}`);
assert.ok(read('index.html').includes('snow-removal-plowing-427.js'));
assert.ok(read('help.html').includes('id="snow-service-events-427"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('Next queued: Item 428'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('### Build 427'));
for(const key of ['test:snow-service-events-427','test:browser:snow-service-events-427']){
 assert.ok(read('package.json').includes(key));
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes(`npm run ${key}`));
}
console.log('Build 427: shared original storm, distinct company snow services, unique dispatch attribution, source HOLD, owner/RLS + browser/CI wiring PASS');
