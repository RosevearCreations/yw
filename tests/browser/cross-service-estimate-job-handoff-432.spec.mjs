import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const base=fs.readFileSync('js/six-service-owner-trial-430.js','utf8');
const audit=fs.readFileSync('js/cross-service-estimate-job-handoff-432.js','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(({opts,keys})=>{
  window.__reads=[];const at=new Date().toISOString();
  const line={id:'line1',line_order:1,description:'Sidewalk clearing',quantity:1,unit_price:150,line_total:150};
  const job={id:'job1',number:'JOB-1',created_at:at,status:'scheduled',company_id:opts.jobForeign?'foreign':'company1',
   service:'snow_removal',customer_property_matches:true,estimate_id:'estimate1',total_amount:150,
   approval_required:false,approval_status:'approved',approved_at:null,approved_by:false,
   new_work_gate_recorded:true,base_lines:[line],
   release:{status:opts.releaseBlocked?'blocked':'released',threshold:'pass',signoff_at:at,signoff_by:true}};
  const estimate={id:'estimate1',number:'EST-1',created_at:at,updated_at:at,status:'accepted',
   service:'snow_removal',company_id:'company1',client_id:'client1',site_id:'site1',
   title:'Snow estimate',scope_notes:'Sidewalk clearing',total_amount:150,lines:[line],approval_required:true,
   approval_status:'approved',approved_at:at,approved_by:true,
   quote:opts.noQuote?null:{status:'accepted',accepted_at:at,accepted_by_recorded:true,terms_version_recorded:true},
   deposit_required:0,deposit_paid_recorded:0,service_enabled:true,new_work_gate_recorded:true,
   converted_work_order_id:'job1',converted_at:at,jobs:opts.noJob?[]:[job]};
  const source={company_id:opts.foreignSource?'foreign':'company1',client_id:'client1',site_id:'site1',
   canonical_source:'original_estimates_work_orders_213_421_422',retrieved_at:at,
   estimate_limit:50,historical_disabled_visible:true,customer_agreement_created:false,business_mutations:false,
   estimates:opts.noEstimate?[]:[estimate]};
  const history={company_id:'company1',client_id:'client1',legacy_unscoped_excluded:true,history_limit_per_type:80,
   properties:[{id:'site1',name:'Original site',address:'Ontario'}],estimates:[],work_orders:[]};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:'owner1'}})};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner1'}}})},
   from(table){window.__reads.push(table);return {select(){return this},order(){return this},eq(){return this},
    limit(){return Promise.resolve({data:table==='ywi_companies'
     ?[{id:'company1',name:'Owner company',owner_user_id:opts.foreignOwner?'other':'owner1'}]
     :keys.map(module_key=>({company_id:'company1',module_key,enabled:true})),error:null});}}},
   rpc:async(name)=>{window.__reads.push(name);return {data:name==='ywi_rpc_company_customers_422'
    ?[{id:'client1',name:'Original client',is_active:true}]:
     name==='ywi_rpc_customer_history_422'?history:source,
    error:opts.rpcDenied&&name==='ywi_rpc_estimate_job_handoff_432'?{message:'Denied'}:null};}};
 },{opts,keys});
 await page.addScriptTag({content:base});await page.addScriptTag({content:audit});
 await page.locator('#owner432 summary').click();
 await page.locator('#owner432Refresh').click();
}
async function selectSite(page){
 await page.locator('#owner432Customer').selectOption('client1');
 await page.locator('#owner432Property').selectOption('site1');
}
test('390px owner audit traces quote, price, job and source release without any writes',async({page})=>{
 await setup(page);await selectSite(page);
 await expect(page.locator('[data-owner432-state="source_release_traced"]')).toHaveCount(1);
 await expect(page.locator('#owner432Status')).toContainText('No customer agreement or work authorization');
 await expect(page.locator('#owner432Results')).toContainText('Sidewalk clearing');
 expect(await page.evaluate(()=>window.__reads)).toEqual(expect.arrayContaining([
  'ywi_companies','ywi_company_service_modules','ywi_rpc_company_customers_422',
  'ywi_rpc_customer_history_422','ywi_rpc_estimate_job_handoff_432']));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('unaccepted quote, missing original job and blocked release are explicit holds',async({page})=>{
 for(const [opts,reason] of [[{noQuote:true},'quote acceptance'],[{noJob:true},'No original linked work order'],
  [{releaseBlocked:true},'signed work-order release']]){
  await setup(page,opts);await selectSite(page);
  await expect(page.locator('[data-owner432-state="hold"]')).toHaveCount(1);
  await expect(page.locator('#owner432Results')).toContainText(reason);
 }
});
test('cross-company source, mismatched job, denial and signed-out sessions never authorize',async({page})=>{
 for(const opts of [{foreignSource:true},{rpcDenied:true}]){
  await setup(page,opts);await selectSite(page);
  await expect(page.locator('#owner432Status')).toContainText('WITHHELD');
  await expect(page.locator('[data-owner432-state="source_release_traced"]')).toHaveCount(0);
 }
 await setup(page,{jobForeign:true});await selectSite(page);
 await expect(page.locator('[data-owner432-state="hold"]')).toHaveCount(1);
 await setup(page,{signedOut:true});
 await expect(page.locator('#owner432Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__reads)).toHaveLength(0);
 await setup(page,{foreignOwner:true});
 await expect(page.locator('#owner432Status')).toContainText('WITHHELD');
});
test('empty original site is not an invented trial; Help preserves customer and Jobs authorities',async({page})=>{
 await setup(page,{noEstimate:true});await selectSite(page);
 await expect(page.locator('#owner432Results')).toContainText('No actual original estimate');
 await expect(page.locator('[data-owner432-state="source_release_traced"]')).toHaveCount(0);
 await page.setContent(fs.readFileSync('help.html','utf8'));
 const help=page.locator('#cross-service-estimate-job-handoff-432');
 await expect(help).toContainText('dated quote acceptance');
 await expect(help).toContainText('never signs');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
