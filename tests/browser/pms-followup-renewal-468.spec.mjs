import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,alternativeId,reviewerId,foreignCompanyId} from '../fixtures/pms-followup-renewal-468.mjs';
const prior=readFileSync('js/pms-independent-handoff-465.js','utf8');
const follow=readFileSync('js/pms-comparison-followup-467.js','utf8');
const src=readFileSync('js/pms-followup-renewal-468.js','utf8');
const css=readFileSync('style.css','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1120:390,height:844});await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const actor=opts.originalReviewer?reviewerId:opts.reviewer?alternativeId:ownerId;
 const f=fixture({days:opts.days??15,reviewer:opts.reviewer,off:opts.off,renewed:opts.renewed});
 await page.evaluate(({f,actor,companyId,opts})=>{
  window.__writes=[];const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},from:()=>{window.__writes.push({name:'direct table forbidden'});return {};},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_handoff_inbox_465')return ok(opts.originalReviewer?{...f.inbox,viewer_id:actor,companies:[],total:0}:f.inbox);
    if(name==='ywi_rpc_renewal_workspace_468'){
     const d=opts.foreign?{...f.view,company_id:foreignCompanyId}:opts.invalidAge?{...f.view,aging:[{...f.view.aging[0],age_days:999}]}:f.view;
     return ok(d);}
    if(name==='ywi_rpc_review_followup_468'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'denied'}};
     const row={id:args.p_operation_id,company_id:companyId,followup_id:args.p_followup_id,reviewer_user_id:actor,
      decision:args.p_decision,source_reference:args.p_source_reference,created_at:new Date().toISOString()};
     f.view.renewals.push(row);f.view.renewal_total++;
     f.view.captured_at=f.view.aging_as_of=row.created_at;f.view.handoff_source.captured_at=row.created_at;
     f.view.aging[0].age_days=Math.floor((Date.parse(row.created_at)-Date.parse(f.followup.created_at))/86400000);
     f.view.aging[0].band=f.view.aging[0].age_days>=15?'overdue':f.view.aging[0].age_days>=8?'aging':'current';
     return ok({id:row.id,company_id:companyId,recorded:true,field_accepted:false,service_authorized:false,
      independent_reapproval:false,reassignment_executed:false,release_green:false,outbound_actions:false});}
    return {data:null,error:{message:'unrecognized RPC'}};
   }};
 },{f,actor,companyId,opts});
 await page.addScriptTag({content:prior});await page.addScriptTag({content:follow});await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#renewal468 > summary').click();await page.locator('#pms468Refresh').click();
}
test('mobile owner reads server-clock overdue but cannot sign an independent renewal',async({page})=>{
 await setup(page,{days:15});await expect(page.locator('#pms468Status')).toContainText('1 overdue (15+ days)');
 await expect(page.locator('#pms468Journal')).toContainText('OVERDUE · 15 full day(s)');
 await expect(page.locator('#pms468ReviewerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms468Hold')).toContainText('does not approve Jobs/Safety');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms468Refresh').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('separate assigned reviewer records distinct internal renewed evidence while HOLD stays visible',async({page})=>{
 await setup(page,{reviewer:true,days:16});await expect(page.locator('#pms468ReviewerForm')).toHaveJSProperty('disabled',false);
 await page.locator('#pms468Followup').selectOption({index:1});
 await page.locator('#pms468Decision').selectOption('refreshed_reference_needs_owner_review');
 await page.locator('#pms468Source').fill('REVIEWER-468-AUTHENTIC-NEW-REF');
 page.once('dialog',d=>d.accept());await page.locator('#pms468Record').click();
 await expect(page.locator('#pms468Status')).toContainText('1 independent renewals');
 await expect(page.locator('#pms468ReviewerForm')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_review_followup_468');
 expect(writes[0].args.p_decision).toBe('refreshed_reference_needs_owner_review');
 await expect(page.locator('#pms468Hold')).toContainText('turn Production GREEN');
});
test('renewed source cannot recycle previous evidence',async({page})=>{
 await setup(page,{reviewer:true});await page.locator('#pms468Followup').selectOption({index:1});
 await page.locator('#pms468Source').fill('OWNER-467-HOLD-REFERENCE');await page.locator('#pms468Record').click();
 await expect(page.locator('#pms468Status')).toContainText('WITHHELD');expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('bad age, foreign scope, disabled service, denied RPC or unauthenticated reviewer never writes',async({page})=>{
 for(const opts of [{foreign:true},{invalidAge:true},{off:true},{signedOut:true},
  {noJobs:true},{denied:true},{originalReviewer:true}]){
  await setup(page,{reviewer:true,...opts});
  await expect(page.locator('#pms468ReviewerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
