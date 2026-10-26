import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,company,ownerId,companyId,foreignCompanyId} from '../fixtures/pms-owner-first-use-455.mjs';
const prior=readFileSync('js/pms-modular-acceptance-454.js','utf8');
const source=readFileSync('js/pms-owner-first-use-455.js','utf8');
const css=readFileSync('style.css','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1200:390,height:844});
 await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const value=fixture({now:Date.now(),enabled:options.allOff?[]:undefined,withEvidence:!options.emptyEvidence});
 if(options.foreignJournal)value.journal.company_id=foreignCompanyId;
 if(options.mismatchJournal)value.journal.services[0].enabled=!value.journal.services[0].enabled;
 await page.evaluate(({value,company,ownerId,companyId,foreignCompanyId,options})=>{
  window.__calls=[];window.__writes=[];window.__signedOut=!!options.signedOut;
  window.YWISecurity={canViewModule:(key)=>key==='jobs'&&!options.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badAuth?foreignCompanyId:ownerId}})},
   from(table){window.__calls.push(table);return {select(){return this},eq(){return this},order(){return this},
    limit(){return Promise.resolve(ok(table==='ywi_companies'?(options.noCompany?[]:[{
     ...company,owner_user_id:options.foreignOwner?foreignCompanyId:ownerId}]):
     table==='ywi_company_service_modules'?value.registry:
     table==='ywi_company_service_module_audit'?value.audit:
     table==='ywi_new_work_gate_receipts_421'?value.receipts:[]));},
    insert(){window.__writes.push('insert')},update(){window.__writes.push('update')},delete(){window.__writes.push('delete')}};},
   rpc:async(name,args)=>{window.__calls.push(name);
    if(options.rpcDenied)return {error:{message:'denied'},data:null};
    if(name==='ywi_rpc_pms_navigation_443')return ok(value.menu);
    if(name==='ywi_rpc_owner_first_use_455')return ok(value.journal);
    if(name==='ywi_rpc_append_owner_first_use_455'){
     window.__writes.push({...args});
     if(options.appendDenied)return {error:{message:'denied'},data:null};
     value.journal.entries.unshift({id:'a4550000-0000-4455-8455-000000000035',checkpoint:args.p_checkpoint,
      module_key:args.p_module_key,observed_enabled:args.p_observed_enabled,
      source_reference:args.p_reference,notes:args.p_notes,disposition:args.p_disposition,
      created_at:new Date().toISOString()});value.journal.evidence_total++;
     return ok({id:'a4550000-0000-4455-8455-000000000035',company_id:companyId,recorded:true,
      owner_field_accepted:false,approval_granted:false});}
    return {error:{message:'unknown RPC'},data:null};}};
 },{value,company,ownerId,companyId,foreignCompanyId,options});
 await page.addScriptTag({content:prior});await page.addScriptTag({content:source});
 await page.locator('#owner455 summary').click();await page.locator('#pms455Load').click();
}
test('390px actual-owner onboarding shows separate first-use steps and never field accepted',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms455Status')).toContainText('SOURCE VERIFIED: 3 ON / 4 OFF');
 await expect(page.locator('#pms455Steps li')).toHaveCount(5);
 await expect(page.locator('.pms455-entry')).toHaveCount(1);
 await expect(page.locator('#pms455Release')).toContainText('HOLD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  offenders:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>
   document.documentElement.clientWidth+1).slice(0,12).map(e=>({tag:e.tagName,id:e.id,
   className:typeof e.className==='string'?e.className:'',right:Math.round(e.getBoundingClientRect().right)}))}));
 expect(geometry.overflow,JSON.stringify(geometry.offenders)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms455Load').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await expect(page.locator('a[href="/help.html#pms-owner-first-use-455"]')).toHaveCount(1);
 await page.locator('#pms455Company').focus();await page.keyboard.press('Tab');
 expect(await page.locator('#pms455Load').evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
});
test('explicit append records a source-linked claim but no company/toggle/new job or approval',async({page})=>{
 await setup(page,{emptyEvidence:true,allOff:true});
 await expect(page.locator('#pms455Status')).toContainText('0 ON / 7 OFF');
 await page.locator('#pms455Checkpoint').selectOption('module_rechecked');
 await page.locator('#pms455Module').selectOption('arboriculture');
 await page.locator('#pms455Source').fill('REAL-OWNER-INSPECTION-REF');
 await page.locator('#pms455Note').fill('Owner-reported OFF switch, pending review');
 await page.locator('#pms455Disposition').selectOption('needs_follow_up');
 page.once('dialog',d=>d.accept());await page.locator('#pms455Append').click();
 await expect(page.locator('#pms455Status')).toContainText('SOURCE VERIFIED');
 await expect(page.locator('.pms455-entry')).toHaveCount(1);
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes).toHaveLength(1);expect(writes[0].p_company_id).toBe(companyId);
 expect(writes[0].p_module_key).toBe('arboriculture');expect(writes[0].p_observed_enabled).toBe(false);
 expect(writes[0].p_disposition).toBe('needs_follow_up');
 await expect(page.locator('#pms455Release')).toContainText('HOLD');
});
test('no company, foreign owner/journal, mismatch, unauthenticated, denied source WITHHOLD',async({page})=>{
 for(const options of [{noCompany:true},{foreignOwner:true},{foreignJournal:true},
  {mismatchJournal:true},{badAuth:true},{noJobs:true},{signedOut:true},{rpcDenied:true}]){
  await setup(page,options);
  await expect(page.locator('#pms455Status')).toContainText(options.noCompany?'HOLD':'WITHHELD');
  await expect(page.locator('#pms455Append')).toBeDisabled();
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('toggle and owner identity change disable intake; uncertain append does not retry',async({page})=>{
 await setup(page,{appendDenied:true});
 await page.evaluate(()=>document.dispatchEvent(new Event('ywi:company-service-offering-changed')));
 await expect(page.locator('#pms455Status')).toContainText('HOLD');
 await expect(page.locator('#pms455Append')).toBeDisabled();
 await page.locator('#pms455Load').click();
 await expect(page.locator('#pms455Status')).toContainText('SOURCE VERIFIED');
 await page.locator('#pms455Source').fill('OWNER-REF-UNCERTAIN');
 page.once('dialog',d=>d.accept());await page.locator('#pms455Append').click();
 await expect(page.locator('#pms455Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#pms455Append')).toBeDisabled();
});
