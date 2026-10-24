import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=f=>readFileSync(f,'utf8');
const js=read('js/six-service-job-cost-provenance-438.js');new Function(js);
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,sandbox);
const {inspect,inspectDirectory,labels,comparison}=sandbox.window.YWI438;
const companyId='company-1',workOrderId='work-1';
const serviceKeys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
const timestamp='2026-10-24T12:30:00Z';
const order=s=>({id:workOrderId,number:'WO-438',status:'in_progress',service:s});
const work={id:workOrderId,estimate_id:'estimate-1',legacy_job_id:123,subtotal:220,tax_total:28,
 total_amount:248,approval_status:'approved',estimate_baseline_cost_total:90,
 estimate_baseline_charge_total:200};
const estimate=s=>({id:'estimate-1',company_id:companyId,service_module_key:s,subtotal:200,
 total_amount:226,total_cost:90,status:'approved',approval_status:'approved',approved_at:timestamp});
const issue={id:'issue-1',work_order_id:workOrderId,issue_status:'issued',issue_total:20};
const line={id:'line-1',issue_id:'issue-1',issue_work_order_id:workOrderId,work_order_line_id:'work-line-1',
 usage_type:'job_use',quantity:2,unit_cost:10,line_total:20};
const proof={id:'proof-1',work_order_id:workOrderId,proof_type:'completion',proof_status:'approved',
 approved_at:timestamp,approved_by_profile_id:'supervisor-1',labour_minutes:60,labour_hourly_rate:40,
 labour_cost_total:40,material_cost_total:20,equipment_cost_total:20,other_cost_total:20,total_cost:100};
const ar={id:'ar-1',work_order_id:workOrderId,invoice_status:'issued',invoice_source:'job',
 subtotal:230,tax_total:30,total_amount:260,balance_due:260,amount_paid:0};
const base=s=>({company_id:companyId,work_order_id:workOrderId,
 complete:true,source_limit:120,state:'review_only',finance_mutation:false,job_mutation:false,payroll_mutation:false,
 orders:[order(s)],order:work,estimate:estimate(s),
 estimate_lines:[{id:'estimated-line-1',estimate_id:'estimate-1',cost_total:90,line_total:200}],
 order_lines:[{id:'work-line-1',work_order_id:workOrderId,cost_total:90,line_total:220}],
 proofs:[proof],crew_hours:[{id:'crew-1',work_order_id:workOrderId,job_id:123,
  hours_worked:2,regular_hours:2,overtime_hours:0}],
 material_issues:[issue],material_lines:[line],equipment:[{id:9,work_order_id:workOrderId,
  job_id:123,checked_out_at:timestamp,verification_status:'arrived_verified'}],
 allocations:[{id:'receipt-material',company_id:companyId,work_order_id:workOrderId,
  material_issue_line_id:'line-1',equipment_signout_id:null,source_fresh:true},
  {id:'receipt-equipment',company_id:companyId,work_order_id:workOrderId,
   material_issue_line_id:null,equipment_signout_id:9,source_fresh:true}],
 invoice_candidates:[{id:'candidate-1',work_order_id:workOrderId,estimate_id:'estimate-1',
  candidate_status:'posted',subtotal:230,tax_total:30,total_amount:260}],
 invoice_postings:[{id:'posting-1',invoice_candidate_id:'candidate-1',
  candidate_work_order_id:workOrderId,ar_invoice_id:'ar-1',posting_status:'posted'}],
 ar_invoices:[ar]});
const check=(extra,state,label,service='landscape')=>{
 const d=inspect({...base(service),...extra},{companyId,workOrderId,serviceKey:service});
 assert.equal(d.state,state,`${label}: ${d.reason||JSON.stringify(d.holds)}`);
 assert.equal(d.authorized,false,label);assert.equal(d.posted,false,label);
 assert.equal(d.completed,false,label);return d;
};
assert.deepEqual(Object.keys(labels),serviceKeys);
for(const service of serviceKeys){const r=check({},'review',`independently linked ${service} originals`,service);
 assert.equal(r.service,service);
 assert.equal(r.metrics.priceVariance.amount,20);
 assert.equal(r.metrics.costVariance.amount,10);
 assert.equal(r.metrics.financeVariance.amount,10);
 assert.equal(r.metrics.originalMaterialIssueLines,1);
 assert.equal(r.metrics.verifiedMaterialLines,1);
 assert.equal(r.metrics.crewHours,2);
 assert.match(r.review,/not combined/);
}
assert.equal(comparison(220,200).percent,10);
assert.equal(comparison(100,90).amount,10);
assert.equal(comparison(100,0),null);
check({estimate:null,estimate_lines:[]},'hold','missing approved original estimate');
check({estimate:{...estimate('landscape'),approval_status:'pending'}},'hold','pending quote approval');
check({order:{...work,approval_status:'draft'}},'hold','unapproved original job price');
check({order:{...work,subtotal:0}},'hold','missing positive price denominator');
check({order:{...work,estimate_baseline_cost_total:0}},'hold','missing positive accepted cost baseline');
check({proofs:[]},'hold','no approved cost proof');
const zero=check({proofs:[{...proof,labour_cost_total:0,material_cost_total:0,
 equipment_cost_total:0,other_cost_total:0,total_cost:0}]},'hold','zero approved proof not actual spending');
assert.equal(zero.metrics.costVariance,null);
const duplicate={...proof,id:'proof-2'};
const overlapping=check({proofs:[proof,duplicate]},'hold','multiple approved envelopes risk double-count');
assert.equal(overlapping.metrics.costVariance,null);
assert.equal(overlapping.metrics.approvedProofCost,null);
check({crew_hours:[]},'hold','no attributable original timekeeping');
check({crew_hours:[{...base('landscape').crew_hours[0],regular_hours:0.5}]},'hold','timekeeping regular and overtime mismatch');
check({estimate:{...estimate('landscape'),approved_at:null}},'hold','missing dated estimate approval');
check({material_lines:[],allocations:[base('landscape').allocations[1]]},'hold','unrecorded materials are not zero expense');
check({allocations:[base('landscape').allocations[1]]},'hold','missing 423 material provenance');
check({allocations:[{...base('landscape').allocations[0],source_fresh:false},base('landscape').allocations[1]]},
 'hold','changed source fingerprint requires reconciliation');
check({equipment:[],allocations:[base('landscape').allocations[0]]},'hold','missing asset custody not zero asset cost');
check({ar_invoices:[],invoice_postings:[]},'hold','Finance not yet invoiced');
const multiple=check({ar_invoices:[ar,{...ar,id:'ar-2'}]},'hold','multiple AR invoices not added');
assert.equal(multiple.metrics.financeVariance,null);
check({invoice_postings:[{...base('landscape').invoice_postings[0],posting_status:'failed'}]},
 'hold','failed Finance posting not a confirmed ledger total');
const voided=check({ar_invoices:[{...ar,invoice_status:'void'}]},'hold','void invoice not Finance revenue');
assert.equal(voided.metrics.financeVariance,null);

for(const [name,extra] of [
 ['foreign company',{company_id:'foreign'}],['foreign order',{work_order_id:'foreign'}],
 ['unknown service',{orders:[order('septic')]}],['missing complete',{complete:false}],
 ['finance write flag',{finance_mutation:true}],['payroll write flag',{payroll_mutation:true}],
 ['source cap',{source_limit:999}],['duplicated proof',{proofs:[proof,proof]}],
 ['foreign estimate',{estimate:{...estimate('landscape'),company_id:'foreign'}}],
 ['wrong service estimate',{estimate:estimate('construction')}],
 ['estimate line foreign',{estimate_lines:[{...base('landscape').estimate_lines[0],estimate_id:'foreign'}]}],
 ['execution proof foreign',{proofs:[{...proof,work_order_id:'foreign'}]}],
 ['wrong proof totals',{proofs:[{...proof,total_cost:40}]}],
 ['timekeeping foreign',{crew_hours:[{...base('landscape').crew_hours[0],job_id:777}]}],
 ['duplicate time entry',{crew_hours:[{...base('landscape').crew_hours[0],time_entry_id:'time-1'},
  {...base('landscape').crew_hours[0],id:'crew-2',time_entry_id:'time-1'}]}],
 ['material issue foreign',{material_issues:[{...issue,work_order_id:'foreign'}]}],
 ['material line foreign',{material_lines:[{...line,issue_work_order_id:'foreign'}]}],
 ['equipment checkout foreign',{equipment:[{...base('landscape').equipment[0],work_order_id:'foreign'}]}],
 ['allocation foreign',{allocations:[{...base('landscape').allocations[0],company_id:'foreign'},base('landscape').allocations[1]]}],
 ['AR foreign',{ar_invoices:[{...ar,work_order_id:'foreign'}]}],
 ['posting foreign',{invoice_postings:[{...base('landscape').invoice_postings[0],ar_invoice_id:'foreign'}]}],
 ['over cap',{proofs:Array.from({length:121},(_,i)=>({...proof,id:`proof-${i}`}))}]
])check(extra,'withheld',name);

const directory=extra=>inspectDirectory({company_id:companyId,work_order_id:null,
 orders:serviceKeys.map((service,i)=>({...order(service),id:`wo-${i}`})),
 source_limit:120,complete:true,state:'choose_order',
 finance_mutation:false,job_mutation:false,payroll_mutation:false,...extra},companyId);
assert.equal(directory().state,'review');
assert.equal(directory({orders:[order('landscape'),order('landscape')]}).state,'withheld');
assert.equal(directory({company_id:'foreign'}).state,'withheld');

const sql=read('sql/six_service_job_cost_provenance_438.sql');
for(const marker of ['security definer','set search_path','ywi_422_assert_owner','ywi_423_assert_order',
 'public.estimates','public.work_order_lines','public.work_order_execution_proofs',
 'public.job_session_crew_hours','public.material_issue_lines','public.equipment_signouts',
 'public.ywi_work_order_allocation_proofs_423','public.ywi_423_source_fingerprint',
 'public.job_invoice_candidates','public.job_invoice_postings','public.ar_invoices',
 'revoke all','grant execute','to authenticated'])assert.ok(sql.includes(marker),marker);
assert.ok(!/\b(insert|update|delete|truncate)\s+(?:from\s+|into\s+)?public\./i.test(sql));
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'No database writes in operator panel');
for(const marker of ['owner438','YWI_AUTH','auth.getUser','ywi_companies',
 'ywi_rpc_job_cost_provenance_438','ywi:auth-changed'])assert.ok(js.includes(marker),marker);
assert.ok(read('index.html').includes('js/six-service-job-cost-provenance-438.js'));
assert.ok(read('help.html').includes('id="six-service-job-cost-provenance-438"'));
const scripts=JSON.parse(read('package.json')).scripts;
for(const name of ['test:six-service-job-cost-provenance-438','test:browser:six-service-job-cost-provenance-438']){
 assert.ok(scripts[name]);assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+name));
}
console.log('YW 438 six-service owner original cost/price/Finance provenance and no duplicate expenses: PASS');
