import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixtures,directories,companyId,workOrderId,services} from '../tests/fixtures/owner-invoice-receivable-439.mjs';

const read=f=>readFileSync(f,'utf8');
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}}};
for(const file of ['js/quality-customer-handoff-437.js',
 'js/six-service-job-cost-provenance-438.js','js/owner-invoice-receivable-439.js']){
 const script=read(file);new Function(script);vm.runInNewContext(script,sandbox);
}
const {inspect,sameDirectory}=sandbox.window.YWI439;
const ctx=serviceKey=>({companyId,workOrderId,serviceKey});
const run=(opts={},service='landscape')=>{
 const {q,f}=fixtures(service);
 return inspect(Object.assign(q,opts.q),Object.assign(f,opts.f),ctx(service));};
function check(opts,state,label,service){const x=run(opts,service);
 assert.equal(x.state,state,`${label}: ${x.reason||JSON.stringify(x.holds)}`);
 for(const k of ['billing_authorized','posting_authorized','collection_authorized','customer_contact_authorized'])
  assert.equal(x[k],false,label);
 return x;}
for(const service of services){const r=check({},'review',service,service);
 assert.equal(r.service,service);assert.equal(r.receivable.balance_due,260);
 assert.equal(r.counts.candidates,1);assert.equal(r.counts.ar,1);}
const positive=fixtures(),[dirQ,dirF]=directories(positive.q,positive.f);
assert.equal(sameDirectory(dirQ,dirF,companyId).state,'review');
assert.equal(sameDirectory(dirQ,{...dirF,orders:[{...dirF.orders[0],service:'septic'}]},companyId).state,'withheld');
check({q:{qc:null,items:[],evidence:[]}},'hold','missing QC');
check({q:{closeout:{...fixtures().q.closeout,invoice_readiness_status:'blocked'}}},'hold','invoice readiness not owner approved');
check({q:{signoffs:[]}},'hold','missing authentic customer signoff');
check({f:{invoice_candidates:[],invoice_postings:[],ar_invoices:[]}},'hold','no original invoice candidate');
check({f:{invoice_candidates:[{...fixtures().f.invoice_candidates[0],candidate_status:'draft'}],
 invoice_postings:[],ar_invoices:[]}},'hold','draft is not posted');
check({f:{invoice_candidates:[{...fixtures().f.invoice_candidates[0],candidate_status:'reviewed'}],
 invoice_postings:[],ar_invoices:[]}},'review','reviewed candidate is still manual, not posted');
check({f:{invoice_candidates:[...fixtures().f.invoice_candidates,
 {...fixtures().f.invoice_candidates[0],id:'duplicate'}]}},'hold','duplicate candidates cannot be combined');
check({f:{invoice_postings:[]}},'hold','missing posting receipt');
check({f:{invoice_postings:[{...fixtures().f.invoice_postings[0],posting_status:'reversed'}]}},'hold','reversed posting');
check({f:{ar_invoices:[],invoice_postings:[]}},'hold','AR missing does not mean paid');
check({f:{ar_invoices:[{...fixtures().f.ar_invoices[0],invoice_status:'void'}]}},'hold','void invoice');
check({f:{ar_invoices:[{...fixtures().f.ar_invoices[0],amount_paid:10,balance_due:260}]}},'hold','balance not reconciled');
check({f:{ar_invoices:[{...fixtures().f.ar_invoices[0],amount_paid:100,balance_due:160,
 invoice_status:'partial'}]}},'review','valid recorded partial receivable');
check({f:{invoice_postings:[{...fixtures().f.invoice_postings[0],ar_invoice_id:'foreign'}]}},
 'withheld','foreign AR posting link');
check({f:{company_id:'foreign'}},'withheld','foreign company');
check({f:{complete:false}},'withheld','incomplete source');
check({q:{orders:[{...fixtures().q.orders[0],service:'snow_plowing'}]}},'withheld','disagreeing original service');
check({f:{ar_invoices:[...fixtures().f.ar_invoices,
 {...fixtures().f.ar_invoices[0],id:'another'}]}},'hold','multiple AR not added');

const js=read('js/owner-invoice-receivable-439.js');
for(const mark of ['owner439','YWI_AUTH','auth.getUser','ywi_companies',
 'ywi_rpc_quality_customer_handoff_437','ywi_rpc_job_cost_provenance_438',
 'ywi:auth-changed','billing_authorized:false','collection_authorized:false'])
 assert.ok(js.includes(mark),mark);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'439 owner panel must never write');
assert.ok(read('index.html').includes('js/owner-invoice-receivable-439.js'));
assert.ok(read('help.html').includes('id="owner-invoice-receivable-439"'));
const scripts=JSON.parse(read('package.json')).scripts;
for(const key of ['test:owner-invoice-receivable-439','test:browser:owner-invoice-receivable-439']){
 assert.ok(scripts[key]);assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+key));}
console.log('YW 439 owner QC → candidate → posting → AR original provenance, no writes: PASS');
