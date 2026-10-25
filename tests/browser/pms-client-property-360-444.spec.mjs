import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,company,companyId,customerId,propertyId,ownerId,
 companyCustomers,foreignPropertyId}
 from '../fixtures/pms-client-property-360-444.mjs';
const script=readFileSync('js/pms-client-property-360-444.js','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1100:390,height:844});
 await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
 <style>body{margin:8px}#owner444{max-width:100%;overflow-wrap:anywhere}.pms444-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,235px),1fr));gap:10px}.pms444-fields label{display:grid;min-width:0}.pms444-fields input,.pms444-fields select,.pms444-fields textarea{box-sizing:border-box;width:100%;min-width:0}.pms444-actions{display:flex;flex-wrap:wrap;gap:8px}.pms444-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:8px}.notice{overflow-wrap:anywhere}</style>
 </head><body><div id="admin"></div></body></html>`);
 await page.evaluate(({options,company,ownerId,companyId,customerId,propertyId,source})=>{
  window.__opts=options;window.__calls=[];window.__writes=[];
  // about:blank is an insecure synthetic test page; real HTTPS supplies this API.
  if(!window.crypto?.randomUUID)Object.defineProperty(window.crypto,'randomUUID',
   {configurable:true,value:()=> 'f4440000-0000-4444-8444-000000000002'});
  window.__ownerSignedOut=!!options.signedOut;
  window.__fakeDossier=source;
  window.confirm=()=>!options.cancel;
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__ownerSignedOut,
   user:{id:ownerId},role:'admin'})};
  window.YWISecurity={canViewModule:(key,role)=>key==='jobs'&&role==='admin'&&!options.noJobs};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badSession?'wrong':ownerId}})},
   from(table){window.__calls.push(table);return{
    select(){return this},order(){return this},limit(){return Promise.resolve(ok(table==='ywi_companies'?
     options.noCompany?[]:[{...company,owner_user_id:options.foreignOwner?'wrong-owner':ownerId}]:[]));},
    insert(){window.__writes.push('direct-insert')},update(){window.__writes.push('direct-update')},
    delete(){window.__writes.push('direct-delete')},upsert(){window.__writes.push('direct-upsert')}
   }},
   rpc:async(name,args)=>{
    window.__calls.push({name,args});if(options.denied&&name==='ywi_rpc_client_property_360_444')
     return{data:null,error:{message:'database ownership denied'}};
    if(name==='ywi_rpc_company_customers_422')return ok([{id:customerId,name:'Sample Yard Rosevear Client',is_active:true}]);
    if(name==='ywi_rpc_client_property_360_444')return ok(window.__fakeDossier);
    if(name==='ywi_rpc_append_client_property_360_444'){
     window.__writes.push(args);
     return ok({id:'f4440000-0000-4444-8444-000000000001',company_id:companyId,
      client_id:customerId,entry_kind:args.p_kind,recorded:true,
      sending_authorized:false,contract_execution_verified:false});
    }
    if(name==='ywi_rpc_create_customer_422')return ok('a4440000-0000-4444-8444-000000000077');
    if(name==='ywi_rpc_create_property_422')return ok('b4440000-0000-4444-8444-000000000077');
    return{data:null,error:{message:'unexpected RPC'}};
   }};
 },{options,company,ownerId,companyId,customerId,propertyId,
     source:fixture({now:Date.now()})});
 await page.addScriptTag({content:script});
 await page.locator('#owner444 summary').first().click();
 await page.locator('#owner444Refresh').click();
 return page;
}
test('synthetic client displays linked property, cross-service history and consent withdrawal',async({page})=>{
 await setup(page);
 await page.locator('#owner444Read').click();
 await expect(page.locator('#owner444Status')).toContainText('Verified company dossier');
 await expect(page.locator('[data-pms444-property]')).toHaveCount(1);
 await expect(page.locator('[data-pms444-kind="contract"]')).toContainText('Reported winter term');
 await expect(page.locator('[data-pms444-kind="photo"]')).toContainText('private-photo-label-01');
 await expect(page.locator('#owner444Dossier')).toContainText('withdrawn');
 await expect(page.locator('[data-pms444-history]')).toHaveCount(4);
 expect(await page.locator('[data-pms444-history]').evaluateAll(ns=>ns.map(n=>n.dataset.pms444History)))
  .toEqual(expect.arrayContaining(['landscape','snow_removal','snow_plowing','septic']));
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
  .toBeLessThanOrEqual(1);
 await expect(page.locator('#owner444 a[href="/help.html#pms-client-property-360-444"]')).toHaveCount(1);
});
test('asset append uses owner company, verified site and per-request idempotency',async({page})=>{
 await setup(page);await page.locator('#owner444Read').click();
 await page.locator('#owner444EntryPanel summary').click();
 await page.locator('#owner444Kind').selectOption('asset');
 await page.locator('#owner444Title').fill('Synthetic garden gate');
 await page.locator('#owner444Details').fill('Reviewed in synthetic operator trial');
 await page.locator('#owner444Record').click();
 await expect(page.locator('#owner444Status')).toContainText('Append-only asset evidence confirmed');
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes).toHaveLength(1);
 expect(writes[0]).toMatchObject({p_company_id:companyId,p_client_id:customerId,
  p_site_id:propertyId,p_kind:'asset',p_title:'Synthetic garden gate',p_reported_status:'good'});
 expect(writes[0].p_request_id).toMatch(/^[0-9a-f]{8}-/);
});
test('cross-property and unverified source responses withhold data, never append',async({page})=>{
 await setup(page);
 await page.evaluate(site=>{window.__fakeDossier.history.properties[0].id=site;},foreignPropertyId);
 await page.locator('#owner444Read').click();
 await expect(page.locator('#owner444Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-pms444-property]')).toHaveCount(0);
 await expect(page.locator('[data-pms444-history]')).toHaveCount(0);
 await page.locator('#owner444EntryPanel summary').click();
 await page.locator('#owner444Record').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('foreign owner, absent company, mismatched session, denied dossier or no Jobs rights fail closed',async({page})=>{
 for(const opts of [{foreignOwner:true},{noCompany:true},{badSession:true},
  {denied:true},{signedOut:true},{noJobs:true}]){
  await setup(page,opts);
  if(!opts.noCompany)await page.locator('#owner444Read').click();
  await expect(page.locator('#owner444Status')).not.toContainText('Verified company dossier');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('sign out or role invalidation empties dossier and blocks future writes',async({page})=>{
 await setup(page);await page.locator('#owner444Read').click();
 await expect(page.locator('[data-pms444-history]')).toHaveCount(4);
 await page.evaluate(()=>{window.__ownerSignedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('[data-pms444-history]')).toHaveCount(0);
 await page.locator('#owner444EntryPanel summary').click();await page.locator('#owner444Record').click();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
