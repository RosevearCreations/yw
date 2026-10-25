import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,company,companyId,ownerId,foreignCompanyId,customerId,propertyId,
 septicProfileId,treeId,customers,propertyHistory} from '../fixtures/pms-septic-arboriculture-451.mjs';
const script=readFileSync('js/pms-septic-arboriculture-451.js','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1150:390,height:850});
 await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
 <style>body{margin:8px}.pms451-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px;min-width:0}.pms451-grid label{display:grid;min-width:0}.pms451-grid input,.pms451-grid select,.pms451-grid textarea{box-sizing:border-box;min-width:0;width:100%}.pms451-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,275px),1fr));gap:10px}.notice{overflow-wrap:anywhere}</style>
 </head><body><div id="admin"></div></body></html>`);
 await page.evaluate(({options,company,ownerId,source,customers,propertyHistory})=>{
  window.__opts=options;window.__source=source;window.__calls=[];window.__writes=[];
  window.__signedOut=!!options.signedOut;window.confirm=()=>!options.cancel;
  if(!window.crypto?.randomUUID)Object.defineProperty(window.crypto,'randomUUID',{configurable:true,
   value:()=> '84510000-0000-4451-8451-000000000050'});
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
    if(options.denied&&name==='ywi_rpc_pms_specialist_snapshot_451')return {data:null,error:{message:'owner denied'}};
    if(name==='ywi_rpc_pms_specialist_snapshot_451')return ok(window.__source);
    if(name==='ywi_rpc_company_customers_422')return ok(customers);
    if(name==='ywi_rpc_customer_history_422')return ok(propertyHistory);
    if(name.startsWith('ywi_rpc_pms_')&&name.endsWith('_451')){
     window.__writes.push({name,args});return ok('84510000-0000-4451-8451-000000000050');}
    return{data:null,error:{message:'unknown RPC '+name}};
   }};
 },{options,company,ownerId,source:fixture({now:Date.now(),septicEnabled:!options.septicOff,
   arborEnabled:!options.arborOff}),customers:customers(),propertyHistory:propertyHistory()});
 await page.addScriptTag({content:script});
 await page.locator('#owner451Septic > summary').click();
 await page.locator('#owner451Arbor > summary').click();
 await page.locator('#pms451SepticRefresh').click();
 await page.locator('#pms451ArborRefresh').click();
 return page;
}
test('two independent specialist screens display source-linked septic and tree-risk records at 390px',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms451SepticStatus')).toContainText('Septic Services ON');
 await expect(page.locator('#pms451ArborStatus')).toContainText('Arboriculture & Tree Care ON');
 await expect(page.locator('#owner451Septic [data-pms451-inventory]')).toHaveCount(1);
 await expect(page.locator('#owner451Arbor [data-pms451-inventory]')).toHaveCount(1);
 await expect(page.locator('#owner451Septic [data-pms451-report]')).toHaveCount(1);
 await expect(page.locator('#owner451Arbor [data-pms451-report]')).toHaveCount(1);
 await expect(page.locator('#pms451SepticHistory')).toContainText('source_linked');
 await expect(page.locator('#pms451ArborHistory')).toContainText('utility');
 await expect(page.locator('#owner451Septic a[href="/help.html#pms-specialists-451"]')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('septic site and tree additions recheck original property and independent service',async({page})=>{
 await setup(page);await page.locator('#pms451SepticInventoryPanel summary').click();
 await page.locator('#pms451SepticRisk').fill('Confined-space access is prohibited');
 await page.locator('#pms451SepticSource').fill('site-survey-source');
 await page.locator('#pms451SepticCapacity').fill('7800');
 await page.locator('#pms451SepticCreate').click();
 await expect(page.locator('#pms451SepticStatus')).toContainText('site source saved');
 await page.locator('#pms451ArborInventoryPanel summary').click();
 await page.locator('#pms451ArborTreeLabel').fill('East oak 02');
 await page.locator('#pms451ArborSpecies').fill('Red oak');
 await page.locator('#pms451ArborRisk').fill('Rotted limb over footpath');
 await page.locator('#pms451ArborSource').fill('tree-inventory-note');
 await page.locator('#pms451ArborCreate').click();
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(2);
 expect(writes[0]).toMatchObject({name:'ywi_rpc_pms_septic_site_451',args:{p_company_id:companyId,
  p_client_id:customerId,p_site_id:propertyId,p_capacity:7800}});
 expect(writes[1]).toMatchObject({name:'ywi_rpc_pms_arbor_tree_451',args:{p_company_id:companyId,
  p_client_id:customerId,p_site_id:propertyId,p_label:'East oak 02'}});
});
test('septic manifest original 428 receipt needs explicit source-linked relationship',async({page})=>{
 await setup(page);await page.locator('#pms451SepticReportPanel summary').click();
 await page.locator('#pms451SepticParent').selectOption(septicProfileId);
 await page.locator('#pms451SepticDate').fill('2026-10-10');
 await page.locator('#pms451SepticVolume').fill('2100');
 await page.locator('#pms451SepticMeasurement').fill('tank-gauge-source');
 await page.locator('#pms451SepticFacility').fill('Demo Transfer Station');
 await page.locator('#pms451SepticManifest').fill('demo-manifest-id');
 await page.locator('#pms451SepticReportSource').fill('operator-evidence-ref');
 await page.locator('#pms451SepticState').selectOption('source_linked');
 await page.locator('#pms451SepticAppend').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await page.locator('#pms451SepticRefresh').click();
 await page.locator('#pms451SepticReceipt').fill('84510000-0000-4451-8451-000000000009');
 await page.locator('#pms451SepticAppend').click();
 const w=await page.evaluate(()=>window.__writes);expect(w).toHaveLength(1);
 expect(w[0]).toMatchObject({name:'ywi_rpc_pms_septic_manifest_451',args:{p_profile_id:septicProfileId,
  p_original_receipt:'84510000-0000-4451-8451-000000000009',p_disposal_state:'source_linked'}});
});
test('high-risk tree review rejects absent Safety/credential labels and never gives clearance',async({page})=>{
 await setup(page);await page.locator('#pms451ArborReportPanel summary').click();
 await page.locator('#pms451ArborParent').selectOption(treeId);
 await page.locator('#pms451ArborDate').fill('2026-10-12');
 await page.locator('#pms451ArborAction').selectOption('high');
 await page.locator('#pms451ArborReportSource').fill('review-evidence-451');
 await page.locator('#pms451ArborAppend').click();expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await page.locator('#pms451ArborRefresh').click();
 await page.locator('#pms451ArborCrew').fill('credential-source-label');
 await page.locator('#pms451ArborSafety').fill('safety-source-label');
 await page.locator('#pms451ArborAppend').click();
 const w=await page.evaluate(()=>window.__writes);expect(w).toHaveLength(1);
 expect(w[0]).toMatchObject({name:'ywi_rpc_pms_arbor_review_451',args:{p_tree_id:treeId,
  p_risk:'high',p_crew_ref:'credential-source-label',p_safety_ref:'safety-source-label'}});
 await expect(page.locator('#pms451ArborStatus')).toContainText('approvals HOLD');
});
test('independent OFF switches preserve authorized history and block new records',async({page})=>{
 await setup(page,{septicOff:true});
 await expect(page.locator('#pms451SepticStatus')).toContainText('OFF');
 await expect(page.locator('#pms451ArborStatus')).toContainText('ON');
 await expect(page.locator('#owner451Septic [data-pms451-report]')).toHaveCount(1);
 await page.locator('#pms451SepticInventoryPanel summary').click();await page.locator('#pms451SepticCreate').click();
 await page.locator('#pms451SepticReportPanel summary').click();await page.locator('#pms451SepticAppend').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await setup(page,{arborOff:true});
 await expect(page.locator('#pms451ArborStatus')).toContainText('OFF');
 await expect(page.locator('#owner451Arbor [data-pms451-report]')).toHaveCount(1);
 await page.locator('#pms451ArborReportPanel summary').click();await page.locator('#pms451ArborAppend').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('foreign owner, invalid source, denied RPC, role loss and logout fail closed',async({page})=>{
 for(const options of [{foreignOwner:true},{noCompany:true},{badSession:true},{denied:true},{signedOut:true},{noJobs:true}]){
  await setup(page,options);
  await expect(page.locator('#pms451SepticStatus')).not.toContainText('Septic Services ON');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
 await setup(page);await page.evaluate(id=>{window.__source.septic_sites[0].company_id=id;},foreignCompanyId);
 await page.locator('#pms451SepticRefresh').click();await expect(page.locator('#pms451SepticStatus')).toContainText('WITHHELD');
 await setup(page,{noJobsCreate:true});await page.locator('#pms451ArborReportPanel summary').click();
 await page.locator('#pms451ArborAppend').click();expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await setup(page);await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'))});
 await expect(page.locator('#owner451Septic [data-pms451-inventory]')).toHaveCount(0);
});
