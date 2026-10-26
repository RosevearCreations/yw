import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,foreignCompanyId,reassessmentId}
 from '../fixtures/pms-reassessment-followup-461.mjs';
const src=readFileSync('js/pms-reassessment-followup-461.js','utf8'),css=readFileSync('style.css','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1100:390,height:844});
 await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const d=fixture({now:Date.now(),aged:options.aged,requested:options.requested,
  empty:options.empty,off:options.off});
 if(options.foreignCompany)d.view.company_id=foreignCompanyId;
 if(options.falseAuthority)d.view.service_authorized=true;
 if(options.stale)d.view.captured_at=new Date(Date.now()-400000).toISOString();
 await page.evaluate(({d,options,ownerId,companyId,foreignCompanyId})=>{
  window.__writes=[];window.__calls=[];window.__signedOut=!!options.signedOut;
  window.YWISecurity={canViewModule:key=>key==='jobs'&&!options.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badAuth?foreignCompanyId:ownerId}})},
   rpc:async(name,args)=>{
    window.__calls.push(name);
    if(options.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_reassessment_owner_inbox_461')return ok(d.inbox);
    if(name==='ywi_rpc_reassessment_followups_461')return ok(d.view);
    if(name==='ywi_rpc_request_reassessment_evidence_461'){
     window.__writes.push({name,args});
     if(options.writeDenied)return {data:null,error:{message:'denied owner append'}};
     d.view.requests.push({id:args.p_request_id,company_id:companyId,
      owner_user_id:ownerId,reassessment_id:args.p_reassessment_id,
      request_kind:args.p_request_kind,source_reference:args.p_source_reference,
      notes:args.p_notes,created_at:new Date().toISOString()});d.view.request_total++;
     return ok({id:args.p_request_id,company_id:companyId,recorded:true,
      field_accepted:false,service_authorized:false,independent_reapproval:false,
      outbound_actions:false,release_green:false});
    }
    return {data:null,error:{message:'not a valid read'}};
   },from(){window.__writes.push({name:'forbidden table access'});return {};} };
 },{d,options,ownerId,companyId,foreignCompanyId});
 await page.addScriptTag({content:src});await page.locator('#reassessment461 > summary').click();
 await page.locator('#pms461Refresh').click();
}
test('owner mobile view displays verified age and immutable operational HOLD',async({page})=>{
 await setup(page,{aged:true});
 await expect(page.locator('#pms461Status')).toContainText('SOURCE VERIFIED: 1 independent');
 await expect(page.locator('#pms461Status')).toContainText('1 aged 7+ days');
 await expect(page.locator('#pms461Form')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms461Hold')).toContainText('HOLD');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms461Refresh').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await expect(page.locator('a[href="/help.html#pms-reassessment-followup-461"]')).toHaveCount(1);
 await page.locator('#pms461Company').focus();await page.keyboard.press('Tab');
 expect(await page.locator('#pms461Refresh').evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('owner records exactly one internal source-labelled evidence request with no dispatch',async({page})=>{
 await setup(page);
 await page.locator('#pms461Reassessment').selectOption(reassessmentId);
 await page.locator('#pms461Kind').selectOption('request_source_clarification');
 await page.locator('#pms461Reference').fill('SOURCE-REFERENCE-ORIGINAL-REVIEW');
 page.once('dialog',d=>d.accept());await page.locator('#pms461Append').click();
 await expect(page.locator('#pms461Status')).toContainText('1 internal requests');
 await expect(page.locator('#pms461Form')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_request_reassessment_evidence_461');
 expect(writes[0].args.p_reassessment_id).toBe(reassessmentId);
 expect(writes[0].args.p_request_kind).toBe('request_source_clarification');
 expect(await page.evaluate(()=>window.__calls.every(s=>s.includes('_461')))).toBe(true);
 await expect(page.locator('#pms461Hold')).toContainText('HOLD');
});
test('existing request or OFF source disables owner append',async({page})=>{
 for(const opts of [{requested:true},{off:true},{empty:true}]){
  await setup(page,opts);await expect(page.locator('#pms461Form')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);}
});
test('foreign, stale, invented green, altered identity, disabled Jobs and denied read fail closed',async({page})=>{
 for(const opts of [{foreignCompany:true},{falseAuthority:true},{stale:true},
  {badAuth:true},{signedOut:true},{noJobs:true},{denied:true}]){
  await setup(page,opts);
  await expect(page.locator('#pms461Form')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);}
});
test('denied append never retries, and sign-out invalidates the owner workbench',async({page})=>{
 await setup(page,{writeDenied:true});
 await page.locator('#pms461Reassessment').selectOption(reassessmentId);
 await page.locator('#pms461Reference').fill('ACTUAL-FOLLOWUP-EVIDENCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms461Append').click();
 await expect(page.locator('#pms461Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#pms461Form')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
});
