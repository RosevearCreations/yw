import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {hr,garbage,company,companyId,customerId,propertyId,employeeId,
 ownerId,stickerId,contractId,pickupId} from '../fixtures/pms-hr-garbage-445.mjs';
const script=readFileSync('js/pms-hr-garbage-445.js','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1100:390,height:844});
 await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
 <style>body{margin:8px}.pms445-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px}.pms445-grid label{display:grid;min-width:0}.pms445-grid input,.pms445-grid select,.pms445-grid textarea{box-sizing:border-box;width:100%;min-width:0}.pms445-actions{display:flex;flex-wrap:wrap;gap:8px}#owner445HR,#owner445Garbage,.notice{max-width:100%;overflow-wrap:anywhere;box-sizing:border-box}</style>
 </head><body><div id="admin"></div></body></html>`);
 await page.evaluate(({opts,company,companyId,ownerId,customerId,propertyId,h,g,employeeId})=>{
  window.__opts=opts;window.__calls=[];window.__writes=[];
  if(!window.crypto?.randomUUID)Object.defineProperty(window.crypto,'randomUUID',
   {configurable:true,value:()=> 'f4450000-0000-4445-8445-000000000002'});
  window.__signedOut=!!opts.signedOut;window.__hr=h;window.__garbage=g;window.confirm=()=>!opts.cancel;
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  window.YWISecurity={canViewModule:(key,role,level)=>!opts.noPermissions&&role==='admin'&&
   ((key==='admin'&&level==='manage')||(key==='jobs'&&level==='view'))};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:opts.badSession?'wrong-user':ownerId}})},
   from(table){window.__calls.push(table);return{
    select(){return this},order(){return this},limit(){return Promise.resolve(ok(table==='ywi_companies'?
     opts.noCompany?[]:[{...company,owner_user_id:opts.foreignOwner?'wrong-user':ownerId}]:[]))},
    insert(){window.__writes.push('direct insert')},update(){window.__writes.push('direct update')}
   }},
   rpc:async(name,args)=>{
    window.__calls.push({name,args});if(opts.denied&&name.includes('snapshot_445'))return{data:null,error:{message:'Access denied'}};
    if(name==='ywi_rpc_pms_hr_snapshot_445')return ok(window.__hr);
    if(name==='ywi_rpc_pms_garbage_snapshot_445')return ok(window.__garbage);
    if(name==='ywi_rpc_company_customers_422')return ok([{id:customerId,name:'Synthetic rural customer'}]);
    if(name==='ywi_rpc_customer_history_422')return ok({company_id:companyId,client_id:customerId,
     legacy_unscoped_excluded:true,properties:[{id:propertyId,name:'Test rural roadside'}]});
    if(name==='ywi_rpc_pms_garbage_switch_445'){
     window.__writes.push({name,args});window.__garbage.enabled=args.p_enabled;
     window.__garbage.captured_at=new Date().toISOString();
     return ok({company_id:companyId,enabled:args.p_enabled,previous_enabled:!args.p_enabled,automatic_billing:false});}
    if(name==='ywi_rpc_pms_hr_create_person_445'||name==='ywi_rpc_pms_hr_append_445'||
       name==='ywi_rpc_pms_garbage_issue_sticker_445'||name==='ywi_rpc_pms_garbage_contract_445'||
       name==='ywi_rpc_pms_garbage_schedule_445'){
      window.__writes.push({name,args});return ok('f4450000-0000-4445-8445-000000000001');}
    if(name==='ywi_rpc_pms_garbage_complete_445'){
     window.__writes.push({name,args});window.__garbage.pickups[0].reported_status=args.p_outcome;
     window.__garbage.captured_at=new Date().toISOString();
     return ok({id:args.p_pickup_id,company_id:companyId,reported_status:args.p_outcome,
      payment_collected:false,invoice_posted:false});}
    return{data:null,error:{message:'Unknown RPC '+name}};
   }};
 },{opts,company,companyId,ownerId,customerId,propertyId,h:hr({now:Date.now()}),
   g:garbage({now:Date.now()}),employeeId});
 await page.addScriptTag({content:script});
 await page.locator('#owner445HR summary').first().click();
 await page.locator('#owner445Garbage summary').first().click();
 await page.locator('#pms445HRRefresh').click();
 await page.locator('#pms445GarbageRefresh').click();
 return page;
}
test('company HR and garbage OFF use separate bounded private source views',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms445HRStatus')).toContainText('Verified private HR');
 await expect(page.locator('[data-pms445-employee]')).toContainText('Sample Crew Member A');
 await expect(page.locator('#pms445GarbageStatus')).toContainText('OFF');
 await expect(page.locator('#pms445StickerIssue')).toBeDisabled();
 await expect(page.locator('#pms445PickupSchedule')).toBeDisabled();
 await expect(page.locator('#owner445Garbage')).toContainText('YR-0001');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('private HR creates company record, with no credential clone or payroll grant',async({page})=>{
 await setup(page);
 await page.locator('#owner445HR details summary').first().click();
 await page.locator('#pms445HRName').fill('Synthetic Crew Member B');
 await page.locator('#pms445HRRole').fill('Roadside Crew');
 await page.locator('#pms445HRAdd').click();
 await expect(page.locator('#pms445HRStatus')).toContainText('Verified company HR record created');
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({name:'ywi_rpc_pms_hr_create_person_445',
  args:{p_company_id:companyId,p_display_name:'Synthetic Crew Member B',p_job_title:'Roadside Crew'}});
});
test('enabled garbage creates physical sticker and reports pickup outcome without billing',async({page})=>{
 await setup(page);
 await page.locator('#pms445GarbageToggle').click();
 await expect(page.locator('#pms445GarbageStatus')).toContainText('ENABLED');
 await page.locator('#owner445Garbage details summary').first().click();
 await page.locator('#pms445StickerSerial').fill('YR-TEST-222');
 await page.locator('#pms445StickerIssue').click();
 await expect(page.locator('#pms445GarbageStatus')).toContainText('Manual ywi_rpc_pms_garbage_issue_sticker_445 recorded');
 await page.locator(`[id="pms445Close-${pickupId}-collected"]`).click();
 await expect(page.locator('#pms445GarbageStatus')).toContainText('Pickup collected recorded');
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes.map(x=>x.name)).toEqual(['ywi_rpc_pms_garbage_switch_445',
  'ywi_rpc_pms_garbage_issue_sticker_445','ywi_rpc_pms_garbage_complete_445']);
 expect(writes[1].args).toMatchObject({p_company_id:companyId,p_client_id:customerId,
  p_site_id:propertyId,p_serial:'YR-TEST-222'});
});
test('foreign company, denied, absent session or permissions never exposes private records',async({page})=>{
 for(const opts of [{foreignOwner:true},{noCompany:true},{badSession:true},{denied:true},{signedOut:true},{noPermissions:true}]){
  await setup(page,opts);
  await expect(page.locator('#pms445HRStatus')).not.toContainText('Verified private HR');
  await expect(page.locator('[data-pms445-employee]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('signout wipes HR and garbage display and rejects follow-up actions',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('[data-pms445-employee]')).toHaveCount(0);
 await expect(page.locator('[data-pms445-garbage-type]')).toHaveCount(0);
 await page.locator('#pms445GarbageToggle').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
