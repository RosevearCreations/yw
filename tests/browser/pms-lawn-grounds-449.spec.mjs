import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,company,companyId,customerId,propertyId,ownerId,customers,propertyHistory,
 foreignCompanyId,planId,zoneId}
 from '../fixtures/pms-lawn-grounds-449.mjs';
const script=readFileSync('js/pms-lawn-grounds-449.js','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1180:390,height:844});
 await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
 <style>body{margin:8px}#owner449{max-width:100%;overflow-wrap:anywhere}.pms449-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px;min-width:0}.pms449-grid label{display:grid;min-width:0}.pms449-grid input,.pms449-grid select,.pms449-grid textarea{box-sizing:border-box;display:block;width:100%;min-width:0}.pms449-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px}.notice{overflow-wrap:anywhere}</style>
 </head><body><div id="admin"></div></body></html>`);
 await page.evaluate(({options,company,companyId,ownerId,source,customers,propertyHistory})=>{
  window.__opts=options;window.__calls=[];window.__writes=[];window.__signedOut=!!options.signedOut;
  window.__source=source;window.confirm=()=>!options.cancel;
  if(!window.crypto?.randomUUID)Object.defineProperty(window.crypto,'randomUUID',{configurable:true,
   value:()=> 'f4490000-0000-4444-8444-000000000001'});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  window.YWISecurity={canViewModule:(key,role,access)=>!options.noJobs&&role==='admin'&&
   (key==='admin'||key==='jobs')&&!(options.noJobsCreate&&key==='jobs'&&access==='create')};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badSession?'wrong':ownerId}})},
   from(table){window.__calls.push(table);return{
    select(){return this},order(){return this},limit(){return Promise.resolve(ok(table==='ywi_companies'?
     options.noCompany?[]:[{...company,owner_user_id:options.foreignOwner?'foreign':ownerId}]:[]));},
    insert(){window.__writes.push('direct-insert')},update(){window.__writes.push('direct-update')},
    delete(){window.__writes.push('direct-delete')},upsert(){window.__writes.push('direct-upsert')}
   }},rpc:async(name,args)=>{
    window.__calls.push({name,args});if(options.denied&&name==='ywi_rpc_pms_lawn_snapshot_449')
     return{data:null,error:{message:'denied by company ownership'}};
    if(name==='ywi_rpc_pms_lawn_snapshot_449')return ok(window.__source);
    if(name==='ywi_rpc_company_customers_422')return ok(customers);
    if(name==='ywi_rpc_customer_history_422')return ok(propertyHistory);
    if(name.startsWith('ywi_rpc_pms_lawn_')){window.__writes.push({name,args});
     return ok('e4490000-0000-4444-8444-000000000001');}
    return{data:null,error:{message:'unknown RPC: '+name}};
   }};
 },{options,company,companyId,ownerId,source:fixture({now:Date.now(),enabled:!options.disabled}),
    customers:customers(),propertyHistory:propertyHistory()});
 await page.addScriptTag({content:script});
 await page.locator('#owner449 summary').first().click();
 await page.locator('#pms449Refresh').click();
 return page;
}
test('company Lawn shows recurring forecast, measured zones, field QC and photo labels at 390px',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms449Status')).toContainText('Lawn ON');
 await expect(page.locator('[data-pms449-plan]')).toHaveCount(1);
 await expect(page.locator('[data-pms449-zone]')).toHaveCount(2);
 await expect(page.locator('[data-pms449-visit]')).toHaveCount(2);
 await expect(page.locator('#pms449History')).toContainText('Forecast only (not dispatched)');
 await expect(page.locator('#pms449History')).toContainText('mulch');
 await expect(page.locator('#pms449History')).toContainText('Recheck edging');
 await expect(page.locator('#owner449 a[href="/help.html#pms-lawn-grounds-449"]')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('owner creates source-backed plan only for canonical customer and property',async({page})=>{
 await setup(page);await page.locator('#pms449PlanPanel summary').click();
 await page.locator('#pms449Anchor').fill('2026-11-01');
 await page.locator('#pms449Recurrence').selectOption('every_n_days');
 await page.locator('#pms449Interval').fill('10');
 await page.locator('#pms449Price').fill('75.25');
 await page.locator('#pms449Route').fill('YARD-10');
 await page.locator('#pms449Source').fill('signed-manual-plan-ref');
 await page.locator('#pms449Create').click();
 await expect(page.locator('#pms449Status')).toContainText('Manual Lawn plan recorded');
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_pms_lawn_plan_449');
 expect(writes[0].args).toMatchObject({p_company_id:companyId,p_client_id:customerId,
  p_site_id:propertyId,p_recurrence:'every_n_days',p_interval:10,p_price_cents:7525,p_route_ref:'YARD-10'});
 expect(writes[0].args.p_request_id).toMatch(/^[0-9a-f]{8}-/);
});
test('measured zone and material/QC visit use the selected verified same-company plan',async({page})=>{
 await setup(page);await page.locator('#pms449ZonePanel summary').click();
 await page.locator('#pms449ZoneName').fill('East lawn');
 await page.locator('#pms449Area').fill('240.5');
 await page.locator('#pms449ZoneSource').fill('manual-measurement-01');
 await page.locator('#pms449ZoneAdd').click();
 await expect(page.locator('#pms449Status')).toContainText('Measured company Lawn zone appended');
 await page.locator('#pms449VisitPanel summary').click();
 await page.locator('#pms449VisitZone').selectOption(zoneId);
 await page.locator('#pms449Date').fill('2026-10-25');
 await page.locator('#pms449VisitStatus').selectOption('completed');
 await page.locator('#pms449Material').fill('mulch');
 await page.locator('#pms449Quantity').fill('2.5');
 await page.locator('#pms449VisitPrice').fill('60.00');
 await page.locator('#pms449QC').selectOption('followup_required');
 await page.locator('#pms449QCNote').fill('Follow up on the gate');
 await page.locator('#pms449Photo').fill('private-photo-label-2');
 await page.locator('#pms449VisitSource').fill('operator-field-source-01');
 await page.locator('#pms449VisitAdd').click();
 await expect(page.locator('#pms449Status')).toContainText('Manual Lawn field record appended');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(2);
 expect(writes[0].args).toMatchObject({p_plan_id:planId,p_area:240.5,p_unit:'sq_ft'});
 expect(writes[1].args).toMatchObject({p_company_id:companyId,p_plan_id:planId,p_zone_id:zoneId,
  p_material:'mulch',p_qty:2.5,p_estimate_cents:6000,p_qc:'followup_required',
  p_photo_ref:'private-photo-label-2'});
});
test('service OFF preserves private read but rejects every new write',async({page})=>{
 await setup(page,{disabled:true});await expect(page.locator('#pms449Status')).toContainText('Lawn OFF');
 await expect(page.locator('[data-pms449-visit]')).toHaveCount(2);
 await page.locator('#pms449PlanPanel summary').click();await page.locator('#pms449Create').click();
 await page.locator('#pms449ZonePanel summary').click();await page.locator('#pms449ZoneAdd').click();
 await page.locator('#pms449VisitPanel summary').click();await page.locator('#pms449VisitAdd').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('foreign owner, missing session, denied RPC or stale/foreign snapshot fail closed',async({page})=>{
 for(const opts of [{foreignOwner:true},{noCompany:true},{badSession:true},{denied:true},{signedOut:true},{noJobs:true}]){
  await setup(page,opts);await expect(page.locator('#pms449Status')).not.toContainText('Lawn ON');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
 await setup(page);
 await page.evaluate(id=>{window.__source.plans[0].company_id=id;},foreignCompanyId);
 await page.locator('#pms449Refresh').click();
 await expect(page.locator('#pms449Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-pms449-plan]')).toHaveCount(0);
});
test('role loss, sign-out and no Jobs create block all writes',async({page})=>{
 await setup(page,{noJobsCreate:true});await expect(page.locator('#pms449Status')).toContainText('Lawn ON');
 await page.locator('#pms449ZonePanel summary').click();await page.locator('#pms449ZoneAdd').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await setup(page);await expect(page.locator('[data-pms449-plan]')).toHaveCount(1);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'))});
 await expect(page.locator('[data-pms449-plan]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
