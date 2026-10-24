import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=f=>fs.readFileSync(f,'utf8');
const ui=read('js/cross-service-estimate-job-handoff-432.js');new Function(ui);
const box={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(read('js/six-service-owner-trial-430.js'),box);
vm.runInNewContext(ui,box);
const {inspect,services}=box.window.YWI432;
const at='2026-10-23T18:00:00.000Z',now=Date.parse(at);
const company={id:'company',name:'Original company',owner_user_id:'owner'};
const entitlements=Object.keys(services).map(module_key=>({module_key,company_id:'company',enabled:true}));
const customers=[{id:'client',name:'Original customer',is_active:true}];
const history={company_id:'company',client_id:'client',legacy_unscoped_excluded:true,history_limit_per_type:80,
 properties:[{id:'property',name:'Original site'}],estimates:[],work_orders:[]};
const line={id:'line1',line_order:1,description:'Recorded scope',quantity:2,unit_price:20,line_total:40};
const job={id:'job1',number:'JOB1',created_at:at,status:'scheduled',company_id:'company',service:'landscape',
 customer_property_matches:true,estimate_id:'estimate1',total_amount:40,approval_required:false,
 approval_status:'approved',approved_at:null,approved_by:false,new_work_gate_recorded:true,
 base_lines:[line],release:{status:'released',threshold:'pass',signoff_at:at,signoff_by:true}};
const estimate={id:'estimate1',number:'EST1',created_at:at,updated_at:at,status:'accepted',service:'landscape',
 company_id:'company',client_id:'client',site_id:'property',title:'Original quote',scope_notes:'Recorded scope',
 total_amount:40,lines:[line],approval_required:true,approval_status:'approved',approved_at:at,
 approved_by:true,quote:{status:'accepted',accepted_at:at,accepted_by_recorded:true,terms_version_recorded:true},
 deposit_required:10,deposit_paid_recorded:10,service_enabled:true,new_work_gate_recorded:true,
 converted_work_order_id:'job1',converted_at:at,jobs:[job]};
const source={company_id:'company',client_id:'client',site_id:'property',
 canonical_source:'original_estimates_work_orders_213_421_422',retrieved_at:at,estimate_limit:50,
 historical_disabled_visible:true,customer_agreement_created:false,business_mutations:false,estimates:[estimate]};
const input={company,uid:'owner',services:entitlements,customers,customerId:'client',history,
 propertyId:'property',source,retrievedAt:at};
const run=x=>inspect(x,now);
let res=run(input);
assert.equal(res.state,'source_audit_recorded');
assert.equal(res.records[0].state,'source_release_traced');
assert.equal(res.source_authorized,false);
assert.equal(run({...input,source:{...source,estimates:[]}}).state,'source_audit_recorded');
assert.equal(run({...input,source:{...source,estimates:[]}}).records.length,0);
const withEst=delta=>({...input,source:{...source,estimates:[{...estimate,...delta}]}});
const withJob=delta=>withEst({jobs:[{...job,...delta}]});
for(const [caseName,change,expected] of [
 ['status-only',withEst({quote:null,status:'accepted'}),'customer quote acceptance'],
 ['undated internal',withEst({approved_at:null}),'internal estimate approval'],
 ['no scope',withEst({scope_notes:null,lines:[]}), 'scope unrecorded'],
 ['changed price',withJob({total_amount:99}),'prices diverge'],
 ['changed base line',withJob({base_lines:[{...line,quantity:3}]}),'Base scope'],
 ['unpaid deposit',withEst({deposit_paid_recorded:0}),'deposit'],
 ['no original job',withEst({jobs:[]}), 'No original linked work order'],
 ['cross-service job',withJob({service:'septic'}),'company/service/customer/property mismatch'],
 ['cross-customer job',withJob({customer_property_matches:false}),'company/service/customer/property mismatch'],
 ['no job receipt',withJob({new_work_gate_recorded:false}),'new-work authorization receipt'],
 ['no estimate receipt',withEst({new_work_gate_recorded:false}),'company/service creation receipt'],
 ['duplicate linked jobs',withEst({jobs:[job,{...job,id:'job2'}]}),'Multiple work orders'],
 ['unsigned release',withJob({release:{...job.release,signoff_at:null}}),'signed work-order release'],
 ['blocked release',withJob({release:{...job.release,threshold:'block'}}),'signed work-order release'],
 ['draft job',withJob({status:'draft'}),'remains a draft'],
 ['orphan conversion pointer',withEst({converted_work_order_id:'other'}),'conversion pointer'],
 ['unknown requirement',withEst({approval_required:null}),'requirement unknown'],
 ['missing terms',withEst({quote:{...estimate.quote,terms_version_recorded:false}}),'terms version']
]){
 const result=run(change);
 assert.equal(result.records[0]?.state,'hold',caseName);
 assert.ok(result.records[0]?.holds.some(s=>s.includes(expected)),caseName);
 assert.equal(result.source_authorized,false,caseName);
}
const disabled=run({...input,services:entitlements.map(s=>({...s,enabled:s.module_key!=='landscape'})),
 source:{...source,estimates:[{...estimate,service_enabled:false}]}});
assert.equal(disabled.records[0].state,'hold');
assert.ok(disabled.records[0].holds.some(s=>s.includes('entitlement disabled')));
for(const bad of [
 {...input,uid:'stranger'},
 {...input,history:{...history,properties:[]}},
 {...input,source:{...source,site_id:'foreign'}},
 {...input,source:{...source,company_id:'foreign'}},
 {...input,source:{...source,retrieved_at:'2026-10-23T16:00:00Z'}},
 {...input,source:{...source,estimates:[estimate,estimate]}},
 {...input,source:{...source,estimates:[{...estimate,company_id:'foreign'}]}},
 {...input,source:{...source,estimates:[{...estimate,lines:[line,line]}]}},
 {...input,source:{...source,estimates:[{...estimate,jobs:[job,job]}]}},
 {...input,source:{...source,customer_agreement_created:true}},
 {...input,source:null}
])assert.equal(run(bad).state,'withheld');
const sql=read('sql/cross_service_estimate_job_handoff_432.sql');
for(const token of ['ywi_422_assert_link','ywi_company_service_modules','ywi_new_work_gate_receipts_421',
 'estimate_quote_packages','customer_deposit_requests','work_order_release_reviews','estimate_lines','work_order_lines',
 'change_order_id is null','limit 51','limit 3','security definer','revoke all','to authenticated',
 'p_company_id','p_client_id','p_site_id'])assert.ok(sql.includes(token),token);
assert.ok(!/\b(insert into|update public\.|delete from|drop table|alter table)\b/i.test(sql));
assert.ok(!/\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/.test(ui));
for(const token of ['owner432','owner432Results','ywi_companies','ywi_rpc_customer_history_422',
 'ywi_rpc_estimate_job_handoff_432','auth.getUser','ywi:auth-changed'])assert.ok(ui.includes(token),token);
assert.ok(read('index.html').includes('js/cross-service-estimate-job-handoff-432.js'));
assert.ok(read('help.html').includes('id="cross-service-estimate-job-handoff-432"'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('## Item 433 — Mobile Field Evidence Capture'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('#### 433 — Mobile Field Evidence Capture'));
for(const key of ['test:cross-service-estimate-job-handoff-432','test:browser:cross-service-estimate-job-handoff-432']){
 assert.ok(JSON.parse(read('package.json')).scripts[key]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+key));
}
console.log('Item 432 canonical quote/deposit/internal-release/entitlement/source line audit and fail-closed security: PASS');
