import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const script=readFileSync('js/six-service-job-cost-provenance-438.js','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(o=>{
  window.__writes=[];window.__calls=[];window.__signedOut=Boolean(o.signedOut);
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:'owner'}})};
  const order={id:'wo-1',number:'WO-438',status:'approved',service:'landscape'};
  const original={id:'wo-1',estimate_id:'est-1',legacy_job_id:7,subtotal:220,tax_total:28,
   total_amount:248,approval_status:'approved',estimate_baseline_cost_total:90};
  const proof={id:'proof-1',work_order_id:'wo-1',proof_type:'completion',proof_status:'approved',
   approved_at:'2026-10-24T12:30:00Z',approved_by_profile_id:'supervisor',labour_minutes:60,
   labour_cost_total:40,material_cost_total:20,equipment_cost_total:20,other_cost_total:20,total_cost:100};
  const ar={id:'ar-1',work_order_id:'wo-1',invoice_status:'issued',subtotal:230,
   tax_total:30,total_amount:260,balance_due:260,amount_paid:0};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:o.badSession?'other':'owner'}}})},
   from(table){window.__calls.push(table);return {select(){return this},order(){return this},
    limit(){return Promise.resolve({data:[{id:'company-1',name:'Original Yard Workers company',
     owner_user_id:o.foreignOwner?'other':'owner'}],error:null})},
    insert(){window.__writes.push('insert')},update(){window.__writes.push('update')},
    delete(){window.__writes.push('delete')},upsert(){window.__writes.push('upsert')}}},
   rpc:async(name,args)=>{window.__calls.push(name);
    const base={company_id:o.foreignResponse?'other':'company-1',work_order_id:args.p_work_order_id,
     complete:true,source_limit:120,state:args.p_work_order_id?'review_only':'choose_order',
     finance_mutation:false,job_mutation:false,payroll_mutation:false,orders:[order]};
    if(!args.p_work_order_id)return {data:base,error:o.denied?{message:'denied'}:null};
    const entry={...proof,id:'proof-2'};
    return {error:o.denied?{message:'denied'}:null,data:{...base,order:original,
     estimate:{id:'est-1',company_id:'company-1',service_module_key:'landscape',
      subtotal:200,total_amount:226,total_cost:90,status:'approved',approval_status:'approved',
      approved_at:'2026-10-24T12:30:00Z'},
     estimate_lines:[{id:'est-line-1',estimate_id:'est-1',cost_total:90,line_total:200}],
     order_lines:[{id:'plan-1',work_order_id:'wo-1',cost_total:90,line_total:220}],
     proofs:o.duplicateProof?[proof,entry]:[proof],
     crew_hours:[{id:'crew-1',work_order_id:'wo-1',job_id:7,hours_worked:2,regular_hours:2,overtime_hours:0}],
     material_issues:[{id:'issue-1',work_order_id:'wo-1',issue_status:'issued',issue_total:20}],
     material_lines:[{id:'ml-1',issue_id:'issue-1',issue_work_order_id:'wo-1',work_order_line_id:'plan-1',
      usage_type:'job_use',quantity:2,unit_cost:10,line_total:20}],
     equipment:[{id:9,work_order_id:'wo-1',job_id:7,checked_out_at:'2026-10-24T12:30:00Z'}],
     allocations:[{id:'alloc-m',company_id:'company-1',work_order_id:'wo-1',
      material_issue_line_id:'ml-1',equipment_signout_id:null,source_fresh:!o.staleMaterial},
      {id:'alloc-e',company_id:'company-1',work_order_id:'wo-1',
       material_issue_line_id:null,equipment_signout_id:9,source_fresh:true}],
     invoice_candidates:[{id:'candidate-1',work_order_id:'wo-1',estimate_id:'est-1',
      candidate_status:'posted',subtotal:230,tax_total:30,total_amount:260}],
     invoice_postings:[{id:'post-1',invoice_candidate_id:'candidate-1',candidate_work_order_id:'wo-1',
      ar_invoice_id:o.foreignPosting?'other':'ar-1',posting_status:'posted'}],
     ar_invoices:o.noFinance?[]:[ar]
    }};}
  };
 },opts);
 await page.addScriptTag({content:script});
 await page.locator('#owner438 summary').click();
 await page.locator('#owner438Refresh').click();
}
async function chooseOriginal(page){
 await page.locator('#owner438Service').selectOption('landscape');
 await page.locator('#owner438Refresh').click();
}

test('390px original cost, hours, custody and Finance stay independent in REVIEW',async({page})=>{
 await setup(page);await chooseOriginal(page);
 await expect(page.locator('#owner438Status')).toContainText('REVIEW');
 await expect(page.locator('[data-owner438-group="variance"]')).toContainText('$20.00');
 await expect(page.locator('[data-owner438-group="variance"]')).toContainText('$10.00');
 await expect(page.locator('[data-owner438-group="sources"]')).toContainText('timekeeping hours: 2.00');
 await expect(page.locator('#owner438Results')).toContainText('not combined');
 expect(await page.evaluate(()=>window.__calls)).toEqual(['ywi_companies',
  'ywi_rpc_job_cost_provenance_438','ywi_companies',
  'ywi_rpc_job_cost_provenance_438','ywi_rpc_job_cost_provenance_438']);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('duplicate cost envelopes and changed original 423 receipts remain HOLD',async({page})=>{
 for(const opts of [{duplicateProof:true},{staleMaterial:true}]){
  await setup(page,opts);await chooseOriginal(page);
  await expect(page.locator('#owner438Status')).toContainText('HOLD');
  await expect(page.locator('[data-owner438-group="holds"]')).not.toBeEmpty();
  if(opts.duplicateProof)await expect(page.locator('[data-owner438-group="variance"]'))
   .toContainText('Single approved proof cost vs accepted Jobs cost baseline: withheld');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});

test('denied foreign company/order/Finance cannot expose prices or cost evidence',async({page})=>{
 for(const opts of [{foreignPosting:true},{foreignResponse:true},{denied:true},
  {foreignOwner:true},{badSession:true},{signedOut:true}]){
  await setup(page,opts);
  if(opts.foreignPosting)await chooseOriginal(page);
  await expect(page.locator('#owner438Status')).toContainText('WITHHELD');
  await expect(page.locator('#owner438Results')).toBeEmpty();
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});

test('signout clears original Finance review before a new owner-source fetch',async({page})=>{
 await setup(page);await chooseOriginal(page);
 await expect(page.locator('#owner438Results')).toContainText('Original AR invoices: 1');
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new CustomEvent('ywi:auth-changed'));});
 await expect(page.locator('#owner438Results')).toBeEmpty();
 await expect(page.locator('#owner438Status')).toContainText('session changed');
 await page.locator('#owner438Refresh').click();
 await expect(page.locator('#owner438Status')).toContainText('WITHHELD');
});
