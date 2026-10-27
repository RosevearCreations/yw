import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,alternativeId,foreignCompanyId} from '../fixtures/pms-reassessment-continuity-470.mjs';
const scripts=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js'].map(p=>readFileSync(p,'utf8'));
const css=readFileSync('style.css','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1120:390,height:844});await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const actor=opts.reviewer?alternativeId:ownerId;
 const f=fixture({reassessmentDays:opts.reassessmentDays??15,reviewer:opts.reviewer,off:opts.off,confirmed:opts.confirmed});
 await page.evaluate(({f,actor,companyId,opts})=>{
  window.__writes=[];const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},from:()=>{window.__writes.push({name:'direct table forbidden'});return {};},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_handoff_inbox_465')return ok(f.inbox);
    if(name==='ywi_rpc_continuity_workspace_470')return ok(opts.foreign?{...f.view,company_id:foreignCompanyId}:
     opts.badAging?{...f.view,reassessment_aging:[{...f.view.reassessment_aging[0],age_days:500}]}:f.view);
    if(name==='ywi_rpc_reviewer_confirm_470'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'denied'}};
     const recorded=new Date().toISOString();f.view.captured_at=f.view.aging_as_of=f.view.renewal_as_of=
      f.view.continuity_as_of=recorded;f.view.handoff_source.captured_at=recorded;
     f.view.confirmations.push({id:args.p_operation_id,company_id:companyId,reassessment_id:args.p_reassessment_id,
      reviewer_user_id:actor,finding:args.p_finding,source_reference:args.p_source_reference,created_at:recorded});
     f.view.confirmation_total++;
     const setAge=(entry,created)=>{entry.age_days=Math.floor((Date.parse(recorded)-Date.parse(created))/86400000);
      entry.band=entry.age_days>=15?'overdue':entry.age_days>=8?'aging':'current';};
     setAge(f.view.aging[0],f.followup.created_at);setAge(f.view.renewal_aging[0],f.renewal.created_at);
     setAge(f.view.reassessment_aging[0],f.reassessment.created_at);
     return ok({id:args.p_operation_id,company_id:companyId,recorded:true,field_accepted:false,
      service_authorized:false,independent_reapproval:false,reassignment_executed:false,release_green:false,outbound_actions:false});}
    return {data:null,error:{message:'unrecognized RPC'}};
   }};
 },{f,actor,companyId,opts});
 for(const src of scripts)await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#continuity470 > summary').click();await page.locator('#pms470Refresh').click();
}
test('mobile owner sees overdue reassessment but cannot sign independent confirmation',async({page})=>{
 await setup(page,{reassessmentDays:15});await expect(page.locator('#pms470Status')).toContainText('1 overdue (15+ days)');
 await expect(page.locator('#pms470Journal')).toContainText('OVERDUE · 15 full day(s)');
 await expect(page.locator('#pms470ReviewerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms470Hold')).toContainText('do not validate field evidence');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms470Refresh').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('assigned separate reviewer signs one distinct reference and remains HOLD',async({page})=>{
 await setup(page,{reviewer:true});await expect(page.locator('#pms470ReviewerForm')).toHaveJSProperty('disabled',false);
 await page.locator('#pms470Reassessment').selectOption({index:1});
 await page.locator('#pms470Finding').selectOption('continuity_hold_confirmed');
 await page.locator('#pms470Source').fill('REVIEWER-470-UNIQUE-CONTINUITY-SOURCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms470Record').click();
 await expect(page.locator('#pms470Status')).toContainText('1 separate continuity confirmations');
 await expect(page.locator('#pms470ReviewerForm')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_reviewer_confirm_470');
 expect(writes[0].args.p_finding).toBe('continuity_hold_confirmed');
 await expect(page.locator('#pms470Hold')).toContainText('Production release');
});
test('owner reads separate reviewer confirmation without write access',async({page})=>{
 await setup(page,{confirmed:true});await expect(page.locator('#pms470Status')).toContainText('1 separate continuity confirmations');
 await expect(page.locator('#pms470ReviewerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('recycled 469 owner reference fails closed before any RPC write',async({page})=>{
 await setup(page,{reviewer:true});await page.locator('#pms470Reassessment').selectOption({index:1});
 await page.locator('#pms470Source').fill('OWNER-469-NEW-EVIDENCE');
 await page.locator('#pms470Record').click();await expect(page.locator('#pms470Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('invalid scope, aging, service, sign-in and RPC leave continuity withheld',async({page})=>{
 for(const opts of [{foreign:true},{badAging:true},{off:true},{signedOut:true},{noJobs:true},{denied:true}]){
  await setup(page,{reviewer:true,...opts});
  await expect(page.locator('#pms470ReviewerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
