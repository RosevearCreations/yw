import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,company,companyId,ownerId,foreignCompanyId}
 from '../fixtures/pms-first-service-reconciliation-456.mjs';
const rosterSource=readFileSync('js/pms-modular-acceptance-454.js','utf8');
const source=readFileSync('js/pms-first-service-reconciliation-456.js','utf8');
const css=readFileSync('style.css','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1100:390,height:844});await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const data=fixture({now:Date.now(),enabled:options.allOff?[]:undefined,
  noReceipt:!!options.noReceipt,noEvidence:!!options.noEvidence});
 if(options.foreignReceipt)data.review.receipts[0].company_id=foreignCompanyId;
 if(options.foreignObservation)data.review.owner_entries[0].company_id=foreignCompanyId;
 if(options.mismatchSwitch)data.review.services[0].enabled=!data.review.services[0].enabled;
 await page.evaluate(({data,company,companyId,ownerId,foreignCompanyId,options})=>{
  window.__calls=[];window.__writes=[];window.__signedOut=!!options.signedOut;
  window.YWISecurity={canViewModule:key=>key==='jobs'&&!options.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badAuth?foreignCompanyId:ownerId}})},
   from(table){window.__calls.push(table);return {select(){return this},eq(){return this},order(){return this},
    limit(){return Promise.resolve(ok(table==='ywi_companies'?(options.noCompany?[]:[{...company,
     owner_user_id:options.foreignOwner?foreignCompanyId:ownerId}]):
     table==='ywi_company_service_modules'?data.registry:[]));},
    insert(){window.__writes.push('direct insert')},update(){window.__writes.push('direct update')},
    delete(){window.__writes.push('direct delete')}};},
   rpc:async(name,args)=>{window.__calls.push(name);
    if(options.rpcDenied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_pms_navigation_443')return ok(data.menu);
    if(name==='ywi_rpc_first_service_review_456')return ok(data.review);
    if(name==='ywi_rpc_append_first_service_review_456'){
     window.__writes.push({...args});
     if(options.appendDenied)return {data:null,error:{message:'Jobs approve denied'}};
     data.review.reviews.unshift({id:'a4560000-0000-4456-8456-000000000077',company_id:companyId,
      service_module_key:args.p_service_module_key,target_table:args.p_target_table,
      target_id:args.p_target_id,evidence_id:args.p_evidence_id,review_outcome:args.p_review_outcome,
      source_reference:args.p_source_reference,notes:args.p_notes,
      switch_enabled_at_review:data.review.services.find(s=>s.module_key===args.p_service_module_key).enabled,
      canonical_site_verified:true,recorded_at:new Date().toISOString()});data.review.review_total++;
     return ok({id:'a4560000-0000-4456-8456-000000000077',company_id:companyId,recorded:true,
      independent_approval_granted:false,real_field_accepted:false});}
    return {error:{message:'unknown RPC'},data:null};}};
 },{data,company,companyId,ownerId,foreignCompanyId,options});
 await page.addScriptTag({content:rosterSource});await page.addScriptTag({content:source});
 await page.locator('#owner456 summary').click();await page.locator('#pms456Refresh').click();
}
test('390px owner reconciliation shows original receipt, observation and advisory HOLD',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms456Status')).toContainText('SOURCE VERIFIED: 1 original Jobs/estimate receipts');
 await expect(page.locator('#pms456Matrix')).toContainText('3 ON / 4 OFF');
 await expect(page.locator('.pms456-review')).toHaveCount(1);
 await expect(page.locator('#pms456Release')).toContainText('HOLD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 const geometry=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(geometry).toBeLessThanOrEqual(1);
 await expect(page.locator('#pms456Refresh')).toHaveAttribute('type','button');
 expect(await page.locator('#pms456Refresh').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await expect(page.locator('a[href="/help.html#pms-first-service-reconciliation-456"]')).toHaveCount(1);
 await page.locator('#pms456Company').focus();await page.keyboard.press('Tab');
 expect(await page.locator('#pms456Refresh').evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
});
test('append a source-linked owner follow-up without granting independent approval',async({page})=>{
 await setup(page);
 await page.locator('#pms456Receipt').selectOption('work_orders:a4540000-0000-4454-8454-000000000011');
 await page.locator('#pms456Evidence').selectOption('a4560000-0000-4456-8456-000000000032');
 await page.locator('#pms456Outcome').selectOption('needs_follow_up');
 await page.locator('#pms456Reference').fill('OWNER-TRIAL-SOURCE-REF');
 page.once('dialog',d=>d.accept());await page.locator('#pms456Append').click();
 await expect(page.locator('#pms456Status')).toContainText('SOURCE VERIFIED');
 await expect(page.locator('.pms456-review')).toHaveCount(2);
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes).toHaveLength(1);
 expect(writes[0].p_company_id).toBe(companyId);
 expect(writes[0].p_target_table).toBe('work_orders');
 expect(writes[0].p_review_outcome).toBe('needs_follow_up');
 await expect(page.locator('#pms456Release')).toContainText('HOLD');
});
test('no company/source and foreign or denied tenant evidence WITHHOLD',async({page})=>{
 for(const options of [{noCompany:true},{noReceipt:true},{foreignOwner:true},
  {foreignReceipt:true},{foreignObservation:true},{mismatchSwitch:true},
  {badAuth:true},{noJobs:true},{signedOut:true},{rpcDenied:true}]){
  await setup(page,options);
  if(options.noCompany)await expect(page.locator('#pms456Status')).toContainText('HOLD');
  else if(options.noReceipt)await expect(page.locator('#pms456Matrix')).toContainText('HOLD');
  else await expect(page.locator('#pms456Status')).toContainText('WITHHELD');
  await expect(page.locator('#pms456Append')).toBeDisabled();
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('OFF switch denies readiness, server denial keeps no automatic retry, signout invalidates',async({page})=>{
 await setup(page,{allOff:true,appendDenied:true});
 await expect(page.locator('#pms456Status')).toContainText('SOURCE VERIFIED');
 await page.locator('#pms456Receipt').selectOption('work_orders:a4540000-0000-4454-8454-000000000011');
 await page.locator('#pms456Evidence').selectOption('a4560000-0000-4456-8456-000000000032');
 await page.locator('#pms456Outcome').selectOption('ready_for_independent_review');
 await page.locator('#pms456Reference').fill('OWNER-READY-CLAIM');
 await page.locator('#pms456Append').click();
 await expect(page.locator('#pms456Status')).toContainText('WITHHELD: readiness requires ON service');
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(0);
 await page.locator('#pms456Outcome').selectOption('blocked');
 page.once('dialog',d=>d.accept());await page.locator('#pms456Append').click();
 await expect(page.locator('#pms456Status')).toContainText('WITHHELD: Server receipt unverifiable');
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#pms456Append')).toBeDisabled();
});
