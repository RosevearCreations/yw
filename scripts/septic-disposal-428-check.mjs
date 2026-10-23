import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/septic_haulage_disposal_receipts_428.sql');
const js=read('js/septic-haulage-disposal-428.js');
const ctx={window:{},document:{readyState:'loading',addEventListener(){}},console};
vm.runInNewContext(js,ctx,{filename:'septic-haulage-disposal-428.js'});
const ids={company:'bdde97a9-2450-4b31-8609-54bbd1096101',order:'d8f1c542-050f-4bac-bc27-6fe1c095b228',
 dispatch:'7ea0ecdb-31f3-483c-918e-e72554109164',operator:'96f0c8bf-20a5-4717-9d25-8f519b39283d',
 artifact:'4ed93209-af74-4f65-8d01-9a4232503d57',proof:'d81f4165-3ce1-4bec-af84-e7d44d11e332',
 safety:'c9639d92-5c58-4402-a309-1c909ba32fa4',receipt:'0f2020b5-9abd-416c-ab99-1eb52833b0aa'};
const good={company_id:ids.company,work_order_id:ids.order,source_limit:80,complete:true,
 no_auto_disposal:true,no_compliance_certification:true,no_billing:true,state:'review_only',
 orders:[{id:ids.order,number:'SEPTIC-001',status:'draft'}],
 dispatch:[{id:ids.dispatch,schedule_status:'dispatched',assigned_supervisor_profile_id:ids.operator,
  lead_profile_id:null,assigned_crew_profile_ids:[ids.operator]}],
 artifacts:[{id:ids.artifact,dispatch_id:ids.dispatch,execution_proof_id:ids.proof,asset_key:'actual-ticket'}],
 safety:[{id:ids.safety,supervisor_review_status:'pending',stop_work_required:true}],fleet:[],
 receipts:[{id:ids.receipt,dispatch_id:ids.dispatch,operator_profile_id:ids.operator,
  original_proof_media_id:ids.artifact,waste_stream:'septic',measurement_method:'meter',
  measured_volume_l:2300,evidence_state:'operator_reported_unverified',review_gate:'hold'}]};
const validate=ctx.window.YWI428.validate;
assert.equal(validate(good,ids.company,ids.order),good);
for(const patch of [{complete:false},{no_auto_disposal:false},{no_compliance_certification:false},
 {no_billing:false},{source_limit:0},{state:'approved'},{orders:[{...good.orders[0],number:''}]},
 {dispatch:[{...good.dispatch[0],assigned_crew_profile_ids:['bogus']}]},
 {artifacts:[{...good.artifacts[0],execution_proof_id:'invalid'}]},
 {receipts:[{...good.receipts[0],waste_stream:'fuel'}]},
 {receipts:[{...good.receipts[0],evidence_state:'regulator_certified'}]},
 {receipts:[{...good.receipts[0],review_gate:'approved'}]},
 {receipts:[good.receipts[0],good.receipts[0]]},
 {receipts:[{...good.receipts[0],original_proof_media_id:ids.safety}]}])
 assert.throws(()=>validate({...good,...patch},ids.company,ids.order),/Partial|duplicate|foreign/);
assert.throws(()=>validate(good,ids.company,null),/Partial|duplicate|foreign/);
for(const s of [
 'public.ywi_septic_disposal_receipts_428','unique(work_order_id,receipt_key)',
 'original_proof_media_id uuid not null unique','unique(company_id,disposal_facility,disposal_receipt_number)',
 "service_module_key<>'septic'",'public.ywi_423_assert_order(p_company_id,p_work_order_id,p_write)',
 'public.dispatch_schedule_items','public.profiles','assigned_crew_profile_ids',
 'public.work_order_execution_proof_media','public.work_order_execution_proofs',
 'public.visual_asset_approval_items',"nullif(btrim(a.storage_path),'') is not null",
 'public.fleet_readiness_checks','public.job_hazard_site_safety_plans',
 'enable row level security','ywi_428_owner_read','ywi_428_receipt_immutable',
 'public.ywi_428_assert_sources','public.ywi_428_safe_fingerprint',
 'public.ywi_rpc_record_septic_disposal_428','public.ywi_rpc_septic_disposal_dashboard_428',
 'measured_volume_l','measurement_method','measurement_source','operator_profile_id',
 'original_source_fingerprint',"'source_changed_hold'","'independent_disposal_safety_review_required'",
 "'no_auto_disposal',true","'no_compliance_certification',true","'no_billing',true",'auth.uid()'])
 assert.ok(sql.includes(s),`Missing original Jobs/Safety/Media SQL guard ${s}`);
assert.doesNotMatch(sql,/grant\s+(?:insert|update|delete|all)\s+on\s+public\.ywi_septic_disposal_receipts_428\s+to\s+authenticated/i);
assert.doesNotMatch(sql,/\b(?:update|insert into)\s+public\.(?:invoices|journal_entries|work_orders|dispatch_schedule_items|fleet_readiness_checks|job_hazard_site_safety_plans|equipment_items)\b/i);
for(const s of ['owner428','owner428Form','owner428Results','owner428Record','owner428Artifact',
 'owner428Operator','owner428Volume','owner428Measurement','owner428Number','window.confirm',
 'ywi_rpc_record_septic_disposal_428','ywi_rpc_septic_disposal_dashboard_428',
 'WITHHELD','no_auto_disposal','no_compliance_certification','no_billing'])
 assert.ok(js.includes(s),`Missing owner/UI guard ${s}`);
assert.ok(read('index.html').includes('septic-haulage-disposal-428.js'));
assert.ok(read('help.html').includes('id="septic-disposal-428"'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('## Item 428'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('#### 429 — Production Learning & Cross-Service Trial Review VI'));
for(const key of ['test:septic-disposal-428','test:browser:septic-disposal-428']){
 assert.ok(read('package.json').includes(key));
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes(`npm run ${key}`));
}
console.log('Item 428: original septic Jobs/Dispatch/operator, measured tank volume, genuine uploaded receipt source, Fleet/Safety HOLD, owner-only immutable evidence PASS');
