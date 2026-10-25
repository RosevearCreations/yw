import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,company,companyId,customerId,propertyId,ownerId,customers,propertyHistory,
 foreignCompanyId,removalId,plowId,snowReviewId}
 from '../fixtures/pms-winter-snow-plowing-450.mjs';
const script=readFileSync('js/pms-winter-snow-plowing-450.js','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1180:390,height:844});
 await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
 <style>body{margin:8px}#owner450Snow,#owner450Plow{max-width:100%;overflow-wrap:anywhere}.pms450-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px;min-width:0}.pms450-grid label{display:grid;min-width:0}.pms450-grid input,.pms450-grid select,.pms450-grid textarea{box-sizing:border-box;width:100%;min-width:0}.pms450-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px}.notice{overflow-wrap:anywhere}</style>
 </head><body><div id="admin"></div></body></html>`);
 await page.evaluate(({options,company,ownerId,source,customers,propertyHistory})=>{
  window.__opts=options;window.__source=source;window.__calls=[];window.__writes=[];
  window.__signedOut=!!options.signedOut;window.confirm=()=>!options.cancel;
  if(!window.crypto?.randomUUID)Object.defineProperty(window.crypto,'randomUUID',{configurable:true,
   value:()=> '84500000-0000-4450-8450-000000000001'});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  window.YWISecurity={canViewModule:(module,role,access)=>!options.noJobs&&role==='admin'&&
   (module==='admin'||module==='jobs')&&!(options.noJobsCreate&&module==='jobs'&&access==='create')};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badSession?'wrong':ownerId}})},
   from(table){window.__calls.push(table);return{
    select(){return this},order(){return this},limit(){return Promise.resolve(ok(table==='ywi_companies'?
     options.noCompany?[]:[{...company,owner_user_id:options.foreignOwner?'foreign':ownerId}]:[]));},
    insert(){window.__writes.push('direct-insert')},update(){window.__writes.push('direct-update')},
    upsert(){window.__writes.push('direct-upsert')},delete(){window.__writes.push('direct-delete')}
   }},rpc:async(name,args)=>{
    window.__calls.push({name,args});
    if(options.denied&&name==='ywi_rpc_pms_winter_snapshot_450')return{data:null,error:{message:'owner denied'}};
    if(name==='ywi_rpc_pms_winter_snapshot_450')return ok(window.__source);
    if(name==='ywi_rpc_company_customers_422')return ok(customers);
    if(name==='ywi_rpc_customer_history_422')return ok(propertyHistory);
    if(name.startsWith('ywi_rpc_pms_winter_')){window.__writes.push({name,args});
     return ok('84500000-0000-4450-8450-000000000001');}
    return{data:null,error:{message:'unknown RPC '+name}};
   }};
 },{options,company,ownerId,source:fixture({now:Date.now(),snowEnabled:!options.snowOff,
    plowEnabled:!options.plowOff}),customers:customers(),propertyHistory:propertyHistory()});
 await page.addScriptTag({content:script});
 await page.locator('#owner450Snow > summary').click();
 await page.locator('#owner450Plow > summary').click();
 await page.locator('#pms450SnowRefresh').click();
 await page.locator('#pms450PlowRefresh').click();
 return page;
}
test('two independent winter screens show per-service site plans, storm reviews and pass/QC at 390px',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms450SnowStatus')).toContainText('Snow Removal ON');
 await expect(page.locator('#pms450PlowStatus')).toContainText('Snow Plowing ON');
 await expect(page.locator('#owner450Snow [data-pms450-agreement]')).toHaveCount(1);
 await expect(page.locator('#owner450Plow [data-pms450-agreement]')).toHaveCount(1);
 await expect(page.locator('#owner450Snow [data-pms450-storm]')).toHaveCount(1);
 await expect(page.locator('#owner450Plow [data-pms450-pass]')).toHaveCount(1);
 await expect(page.locator('#pms450SnowHistory')).toContainText('Recheck icy entrance');
 await expect(page.locator('#pms450PlowHistory')).toContainText('review only, never activated');
 await expect(page.locator('#owner450Snow a[href="/help.html#pms-winter-450"]')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('company-authorized removal planning and plowing agreements remain independent',async({page})=>{
 await setup(page);await page.locator('#pms450SnowAgreementPanel summary').click();
 await page.locator('#pms450SnowStart').fill('2026-11-01');
 await page.locator('#pms450SnowEnd').fill('2027-04-01');
 await page.locator('#pms450SnowTrigger').fill('6.5');
 await page.locator('#pms450SnowPrice').fill('89.50');
 await page.locator('#pms450SnowSource').fill('real-work-evidence-placeholder');
 await page.locator('#pms450SnowCreate').click();
 await expect(page.locator('#pms450SnowStatus')).toContainText('plan recorded');
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_pms_winter_agreement_450');
 expect(writes[0].args).toMatchObject({p_service:'snow_removal',p_company_id:companyId,
  p_client_id:customerId,p_site_id:propertyId,p_trigger:6.5,p_price_cents:8950});
 expect(writes[0].args.p_request_id).toMatch(/^[0-9a-f]{8}-/);
});
test('activation request requires evidence labels including Fleet for plowing, never claims actual dispatch',async({page})=>{
 await setup(page);await page.locator('#pms450PlowStormPanel summary').click();
 await page.locator('#pms450PlowStormRef').fill('TEST-STORM-2');
 await page.locator('#pms450PlowStormDate').fill('2026-12-03');
 await page.locator('#pms450PlowCm').fill('8');
 await page.locator('#pms450PlowReview').selectOption('activation_requested');
 await page.locator('#pms450PlowWeather').fill('weather-log-ref');
 await page.locator('#pms450PlowSafety').fill('safety-log-ref');
 await page.locator('#pms450PlowStormSource').fill('storm-source-ref');
 await page.locator('#pms450PlowAddStorm').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await page.locator('#pms450PlowRefresh').click();
 await page.locator('#pms450PlowFleet').fill('fleet-check-ref');
 await page.locator('#pms450PlowAddStorm').click();
 await expect(page.locator('#pms450PlowStatus')).toContainText('independent original route activation');
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes).toHaveLength(1);expect(writes[0].name).toBe('ywi_rpc_pms_winter_storm_450');
 expect(writes[0].args).toMatchObject({p_agreement_id:plowId,p_route_review:'activation_requested',
  p_weather_ref:'weather-log-ref',p_safety_ref:'safety-log-ref',p_fleet_ref:'fleet-check-ref'});
});
test('manual snow pass with de-icing material is report-only and linked to same winter service',async({page})=>{
 await setup(page);await page.locator('#pms450SnowPassPanel summary').click();
 await page.locator('#pms450SnowPassStorm').selectOption(snowReviewId);
 await page.locator('#pms450SnowPassDate').fill('2026-11-10');
 await page.locator('#pms450SnowMaterial').fill('bagged salt');
 await page.locator('#pms450SnowQuantity').fill('2.5');
 await page.locator('#pms450SnowPassSource').fill('operator-pass-ref');
 await page.locator('#pms450SnowQC').selectOption('followup_required');
 await page.locator('#pms450SnowQCNote').fill('Inspect ice under ramp');
 await page.locator('#pms450SnowAddPass').click();
 await expect(page.locator('#pms450SnowStatus')).toContainText('QC and actual completion remain unverified');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].args).toMatchObject({p_storm_id:snowReviewId,p_deicer:'bagged salt',
  p_qty:2.5,p_passes:1,p_qc:'followup_required'});
});
test('OFF winter module retains its own history and blocks all mutations, other module remains ON',async({page})=>{
 await setup(page,{snowOff:true});
 await expect(page.locator('#pms450SnowStatus')).toContainText('OFF');
 await expect(page.locator('#pms450PlowStatus')).toContainText('ON');
 await expect(page.locator('#owner450Snow [data-pms450-pass]')).toHaveCount(1);
 await page.locator('#pms450SnowAgreementPanel summary').click();
 await page.locator('#pms450SnowCreate').click();
 await page.locator('#pms450SnowStormPanel summary').click();
 await page.locator('#pms450SnowAddStorm').click();
 await page.locator('#pms450SnowPassPanel summary').click();
 await page.locator('#pms450SnowAddPass').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('foreign identity, denied RPC and role loss fail closed with no browser writes',async({page})=>{
 for(const o of [{foreignOwner:true},{noCompany:true},{badSession:true},{denied:true},{signedOut:true},{noJobs:true}]){
  await setup(page,o);await expect(page.locator('#pms450SnowStatus')).not.toContainText('Snow Removal ON');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
 await setup(page);await page.evaluate(id=>{window.__source.agreements[0].company_id=id;},foreignCompanyId);
 await page.locator('#pms450SnowRefresh').click();await expect(page.locator('#pms450SnowStatus')).toContainText('WITHHELD');
 await setup(page,{noJobsCreate:true});await page.locator('#pms450SnowPassPanel summary').click();
 await page.locator('#pms450SnowAddPass').click();expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await setup(page);await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'))});
 await expect(page.locator('#owner450Snow [data-pms450-agreement]')).toHaveCount(0);
});
