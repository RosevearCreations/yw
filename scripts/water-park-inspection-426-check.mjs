import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/water_park_inspection_safety_evidence_426.sql');
const js=read('js/water-park-inspection-safety-426.js');
const ctx={window:{},document:{readyState:'loading',addEventListener(){}},console};
vm.runInNewContext(js,ctx,{filename:'water-park-inspection-safety-426.js'});
const company='625ef0f3-14e0-4596-88a2-b99b78ea5646',order='bea88293-42ac-4760-b05e-c60f352b1855';
const inspection='4e3bb4ac-5d13-4967-aab8-30cc095f46d0',followup='f3b71428-1460-4e75-ae61-8bb887026c4e';
const good={company_id:company,work_order_id:order,complete:true,no_automatic_reopening:true,source_limit:80,state:'review_only',
 orders:[{id:order,number:'WO-AQUATIC-426',status:'draft'}],safety:[],
 inspections:[{id:inspection,inspection_key:'pool_main',area_label:'Main Pool',inspection_kind:'routine',inspected_on:'2026-10-22',
  observed_issue:'closure_reported',evidence_state:'recorded_unverified',closure_gate:'hold'}],
 followups:[{id:followup,inspection_id:inspection,receipt_key:'follow_up_1',observed_on:'2026-10-22',
  reported_state:'operator_reports_addressed',evidence_state:'recorded_unverified',reopening_gate:'hold_until_independent_safety_authority'}]};
const validate=ctx.window.YWI426.validate;
assert.equal(validate(good,company,order),good);
for(const change of [{company_id:'foreign'},{complete:false},{no_automatic_reopening:false},{source_limit:90},
 {inspections:[good.inspections[0],good.inspections[0]]},{followups:[{...good.followups[0],reopening_gate:'reopened'}]},
 {followups:[{...good.followups[0],inspection_id:'a3184f53-2c89-4ea3-ae94-ec5b06747547'}]},
 {inspections:[{...good.inspections[0],closure_gate:'approved'}]}])
 assert.throws(()=>validate({...good,...change},company,order),/Incomplete|foreign|duplicate/i);
assert.throws(()=>validate(good,company,null),/Incomplete|foreign|disclosure/i);
for(const mark of [
 'public.ywi_aquatic_inspections_426','public.ywi_aquatic_followups_426',
 'unique(work_order_id,inspection_key)','unique(inspection_id,receipt_key)',
 'original_safety_plan_id uuid references public.job_hazard_site_safety_plans',
 'observed_ph numeric','observed_sanitizer_mg_l numeric','observed_water_c numeric',
 'enable row level security','revoke all on public.ywi_aquatic_inspections_426',
 'revoke all on public.ywi_aquatic_followups_426','ywi_426_owner_inspection_read',
 'ywi_426_owner_followup_read','ywi_426_inspections_immutable','ywi_426_followups_immutable',
 'public.ywi_423_assert_order(p_company_id,p_work_order_id,p_write)',
 "wo.service_module_key='water_parks'",'public.ywi_426_original_fingerprint',
 'public.ywi_rpc_record_aquatic_inspection_426','public.ywi_rpc_append_aquatic_followup_426',
 'public.ywi_rpc_aquatic_dashboard_426','public.job_hazard_site_safety_plans',
 "'source_changed_hold'","'hold_until_independent_safety_authority'",
 'no_automatic_reopening','source_limit','auth.uid()'])
 assert.ok(sql.includes(mark),`SQL source boundary missing: ${mark}`);
assert.doesNotMatch(sql,/grant\s+(?:insert|update|delete|all)\s+on\s+public\.ywi_aquatic_(?:inspections|followups)_426\s+to\s+authenticated/i);
assert.doesNotMatch(sql,/\b(?:update|insert into)\s+public\.(?:job_hazard_site_safety_plans|work_orders|invoices|journal_entries|equipment_items)\b/i);
for(const mark of ['owner426','owner426Refresh','owner426Order','owner426InspectionForm','owner426FollowupForm',
 'owner426Results','ywi_rpc_aquatic_dashboard_426','ywi_rpc_record_aquatic_inspection_426',
 'ywi_rpc_append_aquatic_followup_426','window.confirm','WITHHELD','no_automatic_reopening','source_limit'])
 assert.ok(js.includes(mark),`JS boundary missing: ${mark}`);
for(const mark of ['water-park-inspection-safety-426.js'])assert.ok(read('index.html').includes(mark));
assert.ok(read('help.html').includes('id="water-park-inspection-426"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('#### 427 — Snow Removal & Plowing Event Separation'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('Item 426'));
for(const t of ['test:water-park-inspection-426','test:browser:water-park-inspection-426']){
 assert.ok(read('package.json').includes(t));assert.ok(read('.github/workflows/staging-browser-integration.yml').includes(`npm run ${t}`));}
console.log('Build 426: owner-scoped aquatic inspection, source-fingerprint Safety HOLD, follow-up without reopening, immutable RLS receipts and CI wiring PASS');
