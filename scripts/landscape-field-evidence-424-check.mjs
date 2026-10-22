import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const src=read('js/landscape-field-production-evidence-424.js');
const sql=read('sql/landscaping_field_production_evidence_424.sql');
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}},console};
vm.runInNewContext(src,sandbox,{filename:'landscape-field-production-evidence-424.js'});
const id='b54219bc-38f3-4e30-b583-31b94c8f733a',order='543a4bcf-f19d-4fb4-881c-f0b29f82146c',source='f99209d8-f35c-4e9f-9445-8292af6a8412';
const good={company_id:id,work_order_id:order,complete:true,review_only:true,source_limit:80,state:'review_only',
 orders:[{id:order,number:'WO-424',status:'draft'}],sources:[{id:source,activity_type:'mowing',metric_label:'Mowed',actual_quantity:50,unit_label:'m²',session_date:'2026-10-22',zone_name:'Front lawn',eligible:true,already_attested:false,execution_proof_ids:[],qc_run_ids:[]}],receipts:[]};
const validate=sandbox.window.YWI424.validate;
assert.equal(validate(good,id,order),good);
for(const change of [{company_id:'foreign'},{complete:false},{review_only:false},{source_limit:81},
 {sources:[good.sources[0],good.sources[0]]},{sources:[{...good.sources[0],eligible:'yes'}]},
 {sources:[{...good.sources[0],execution_proof_ids:['foreign']}]}])
 assert.throws(()=>validate({...good,...change},id,order),/Incomplete|duplicate|foreign/);
assert.throws(()=>validate(good,id,null),/Incomplete|foreign|Unexpected/);
assert.throws(()=>validate({...good,receipts:[{id:source,production_quantity_id:'f14dd1db-c142-4e63-b638-91c9298f3a08',state:'recorded_unreviewed'}]},id,order),/receipt/i);
for(const marker of [
 'public.ywi_landscape_field_receipts_424','production_quantity_id uuid not null unique references public.job_session_production_quantities',
 'job_session_id uuid not null references public.job_sessions','site_zone_id uuid not null references public.client_site_zones',
 'source_operator_profile_id','source_session_date','attested_by uuid','attested_at timestamptz not null default now()',
 'enable row level security','revoke all on public.ywi_landscape_field_receipts_424',
 'ywi_424_owner_receipts_read','ywi_424_no_receipt_rewrite','ywi_424_fingerprint',
 'ywi_424_assert_landscape_order','public.ywi_423_assert_order(p_company_id,p_work_order_id,p_write)',
 "wo.service_module_key='landscape'",'public.ywi_rpc_record_landscape_field_evidence_424',
 'public.ywi_rpc_landscape_field_dashboard_424','public.work_order_execution_proofs',
 'public.work_order_quality_control_runs',"v_source.actual_quantity<=0",'v_source.session_status',
 'source_fingerprint=v_hash','source_fingerprint=public.ywi_424_fingerprint',
 'review_only','source_limit',"'recorded_unreviewed'", "'hold'"])
 assert.ok(sql.includes(marker),`Missing SQL guard: ${marker}`);
assert.doesNotMatch(sql,/grant\s+(?:insert|update|delete|all)\s+on\s+public\.ywi_landscape_field_receipts_424\s+to\s+authenticated/i);
assert.doesNotMatch(sql,/\b(?:update|insert into)\s+public\.(?:work_orders|job_sessions|work_order_quality_control_runs|invoices|journal_entries|inventory_movements)\b/i);
for(const marker of ['owner424','owner424Refresh','owner424Order','owner424Results','ywi_rpc_landscape_field_dashboard_424',
 'ywi_rpc_record_landscape_field_evidence_424','window.confirm','WITHHELD','source_limit'])
 assert.ok(src.includes(marker),`Missing UI marker: ${marker}`);
for(const f of ['index.html','help.html','docs/NEXT_STEPS_AND_SANITY_CHECK.md','docs/ACTIVE_PROJECT_HANDBOOK.md'])
 assert.ok(read(f).includes('424'),`Missing documentation or wiring in ${f}`);
assert.ok(read('index.html').includes('/js/landscape-field-production-evidence-424.js'));
assert.ok(read('help.html').includes('id="landscape-field-evidence-424"'));
for(const key of ['test:landscape-field-evidence-424','test:browser:landscape-field-evidence-424']){
 assert.ok(read('package.json').includes(key));assert.ok(read('.github/workflows/staging-browser-integration.yml').includes(`npm run ${key}`));}
console.log('Item 424: canonical zone/operator/measured quantity, immutable owner attestation, drift hold, QC boundary and CI wiring PASS');
