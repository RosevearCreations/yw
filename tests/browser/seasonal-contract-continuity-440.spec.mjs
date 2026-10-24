import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,workOrderId} from '../fixtures/seasonal-contract-continuity-440.mjs';
const js=readFileSync('js/seasonal-contract-continuity-440.js','utf8');
async function setup(page,options={}){
 const {c,field}=fixture(options.service||'snow_plowing');
 if(options.missingContract){c.agreements=[];c.visit_events=[];c.snow_triggers=[];}
 if(options.foreignSource)c.company_id='foreign';
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(({options,c,field,companyId,workOrderId})=>{
  window.__calls=[];window.__writes=[];window.__signedOut=!!options.signedOut;
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:'owner-id'}})};
  const rows=['landscape','construction','water_parks','snow_removal','snow_plowing','septic']
   .map(module_key=>({company_id:companyId,module_key,enabled:module_key==='snow_plowing'}));
  const read=val=>({data:val,error:null});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:options.badSession?'other':'owner-id'}}})},
   from(table){window.__calls.push(table);return {
    select(){return this},order(){return this},eq(){return this},
    limit(){return Promise.resolve(read(table==='ywi_companies'?
     [{id:companyId,name:'Owner Sample',owner_user_id:options.foreignOwner?'other':'owner-id'}]:rows))},
    insert(){window.__writes.push('insert')},update(){window.__writes.push('update')},
    delete(){window.__writes.push('delete')},upsert(){window.__writes.push('upsert')}}},
   rpc:async(name,args)=>{window.__calls.push(name);
    if(options.denied)return{error:{message:'denied'},data:null};
    if(name==='ywi_rpc_seasonal_continuity_440')return read(c);
    if(name==='ywi_rpc_snow_service_dashboard_427')return read(args.p_work_order_id?field:
     {...field,work_order_id:null,state:'choose_order',sources:[],receipts:[],orders:[...field.orders]});
    if(name==='ywi_rpc_landscape_field_dashboard_424')return read(args.p_work_order_id?field:
     {...field,work_order_id:null,state:'choose_order',sources:[],receipts:[],orders:[...field.orders]});
    return{error:{message:'unexpected RPC'},data:null};}};
 },{options,c,field,companyId,workOrderId});
 await page.addScriptTag({content:js});await page.locator('#owner440 summary').click();
 await page.locator('#owner440Refresh').click();
}
async function choose(page,service='snow_plowing'){
 await page.locator('#owner440Service').selectOption(service);
 await page.locator('#owner440Refresh').click();
}
test('390px shows real switches vs planned services and exact owner first-use HOLD',async({page})=>{
 await setup(page);
 await expect(page.locator('[data-owner440-group="live"]')).toContainText('Plowing & Winter Routes · ENABLED');
 await expect(page.locator('[data-owner440-group="live"]')).toContainText('Septic & Vacuum · DISABLED');
 await expect(page.locator('[data-owner440-group="planned"]')).toContainText('Arboriculture & Tree Care · planned');
 await expect(page.locator('[data-owner440-group="core"]')).toContainText('Payroll');
 await choose(page);
 await expect(page.locator('#owner440Status')).toContainText('HOLD');
 await expect(page.locator('[data-owner440-result="agreement"]')).toContainText('AGR-SNOW');
 await expect(page.locator('[data-owner440-result="firstuse"]')).toContainText('2026-10-02');
 await expect(page.locator('[data-owner440-result="holds"]')).toContainText('NO canonical event-ID link');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('missing/foreign seasonal data are held or withheld, never an approved event',async({page})=>{
 for(const options of [{missingContract:true},{foreignSource:true},{denied:true},
  {badSession:true},{foreignOwner:true},{signedOut:true}]){
  await setup(page,options);
  if(options.missingContract||options.foreignSource||options.denied)await choose(page);
  await expect(page.locator('#owner440Status')).toContainText(options.missingContract?'HOLD':'WITHHELD');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('sign out clears company entitlements and prior contract evidence',async({page})=>{
 await setup(page);await choose(page);
 await expect(page.locator('[data-owner440-result="agreement"]')).toContainText('AGR-SNOW');
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new CustomEvent('ywi:auth-changed'));});
 await expect(page.locator('#owner440Results')).toBeEmpty();
 await expect(page.locator('[data-owner440-group="live"]')).not.toContainText('ENABLED');
 await page.locator('#owner440Refresh').click();
 await expect(page.locator('#owner440Status')).toContainText('WITHHELD');
});
