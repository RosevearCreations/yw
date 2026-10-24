import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixtures,companyId,workOrderId} from '../fixtures/owner-invoice-receivable-439.mjs';

const scripts=['js/quality-customer-handoff-437.js',
 'js/six-service-job-cost-provenance-438.js','js/owner-invoice-receivable-439.js']
 .map(f=>readFileSync(f,'utf8'));
async function setup(page,opts={}){
 const {q,f}=fixtures();
 if(opts.missingSignoff)q.signoffs=[];
 if(opts.noAr){f.ar_invoices=[];f.invoice_postings=[];}
 if(opts.foreignPosting)f.invoice_postings[0].ar_invoice_id='foreign';
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(({q,f,opts,companyId,workOrderId})=>{
  window.__writes=[];window.__calls=[];window.__signedOut=Boolean(opts.signedOut);
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:'owner'}})};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:opts.badSession?'other':'owner'}}})},
   from(table){window.__calls.push(table);return {select(){return this},order(){return this},
    limit(){return Promise.resolve({data:[{id:companyId,name:'Synthetic owner company',
     owner_user_id:opts.foreignOwner?'other':'owner'}],error:null})},
    insert(){window.__writes.push('insert')},update(){window.__writes.push('update')},
    delete(){window.__writes.push('delete')},upsert(){window.__writes.push('upsert')}}},
   rpc:async(name,args)=>{window.__calls.push(name);
    if(opts.denied)return {error:{message:'permission denied'},data:null};
    const data=name==='ywi_rpc_quality_customer_handoff_437'?q:f;
    return {error:null,data:{...data,work_order_id:args.p_work_order_id,
     state:args.p_work_order_id?'review_only':'choose_order',
     company_id:opts.foreignResponse?'foreign':companyId}};
   }};
 },{q,f,opts,companyId,workOrderId});
 for(const script of scripts)await page.addScriptTag({content:script});
 await page.locator('#owner439 summary').click();
 await page.locator('#owner439Refresh').click();
}
async function selectJob(page){
 await page.locator('#owner439Service').selectOption('landscape');
 await page.locator('#owner439Refresh').click();
}
test('390px owner review shows exact candidate → posted receipt → AR without a write',async({page})=>{
 await setup(page);await selectJob(page);
 await expect(page.locator('#owner439Status')).toContainText('REVIEW');
 await expect(page.locator('[data-owner439-group="lineage"]')).toContainText('Candidates: 1 · posted');
 await expect(page.locator('[data-owner439-group="lineage"]')).toContainText('receivable balance: $260.00');
 await expect(page.locator('#owner439Results')).toContainText('not billing eligibility');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls.filter(x=>x==='ywi_rpc_quality_customer_handoff_437')).toHaveLength(3);
 expect(calls.filter(x=>x==='ywi_rpc_job_cost_provenance_438')).toHaveLength(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('missing signature and absent AR are explicit HOLDs, never a synthetic payment',async({page})=>{
 for(const opts of [{missingSignoff:true},{noAr:true}]){
  await setup(page,opts);await selectJob(page);
  await expect(page.locator('#owner439Status')).toContainText('HOLD');
  await expect(page.locator('[data-owner439-group="holds"]')).not.toBeEmpty();
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('foreign owner, denied/foreign RPC and foreign posting fail closed',async({page})=>{
 for(const opts of [{foreignOwner:true},{badSession:true},{denied:true},
  {foreignResponse:true},{foreignPosting:true},{signedOut:true}]){
  await setup(page,opts);
  if(opts.foreignPosting)await selectJob(page);
  await expect(page.locator('#owner439Status')).toContainText('WITHHELD');
  await expect(page.locator('#owner439Results')).toBeEmpty();
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('signout immediately clears prior receivable and prevents reading it again',async({page})=>{
 await setup(page);await selectJob(page);
 await expect(page.locator('[data-owner439-group="lineage"]')).toContainText('$260.00');
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new CustomEvent('ywi:auth-changed'));});
 await expect(page.locator('#owner439Results')).toBeEmpty();
 await expect(page.locator('#owner439Status')).toContainText('session changed');
 await page.locator('#owner439Refresh').click();
 await expect(page.locator('#owner439Status')).toContainText('WITHHELD');
});
