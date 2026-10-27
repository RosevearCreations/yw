import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,alternativeId,foreignCompanyId} from '../fixtures/pms-renewal-reassessment-469.mjs';
const scripts=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js'].map(p=>readFileSync(p,'utf8'));
const css=readFileSync('style.css','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1120:390,height:844});await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const actor=opts.reviewer?alternativeId:ownerId;
 const f=fixture({renewalDays:opts.renewalDays??15,reviewer:opts.reviewer,off:opts.off,reassessed:opts.reassessed});
 await page.evaluate(({f,actor,companyId,opts})=>{
  window.__writes=[];const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},from:()=>{window.__writes.push({name:'direct table forbidden'});return {};},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_handoff_inbox_465')return ok(f.inbox);
    if(name==='ywi_rpc_reassessment_workspace_469'){
     const d=opts.foreign?{...f.view,company_id:foreignCompanyId}:opts.badAging?
      {...f.view,renewal_aging:[{...f.view.renewal_aging[0],age_days:999}]}:f.view;
     return ok(d);}
    if(name==='ywi_rpc_owner_reassess_469'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'denied'}};
     const recorded=new Date().toISOString();f.view.captured_at=f.view.aging_as_of=f.view.renewal_as_of=recorded;
     f.view.handoff_source.captured_at=recorded;
     f.view.reassessments.push({id:args.p_operation_id,company_id:companyId,renewal_id:args.p_renewal_id,
      owner_user_id:actor,decision:args.p_decision,source_reference:args.p_source_reference,created_at:recorded});
     f.view.reassessment_total++;
     f.view.renewal_aging[0].age_days=Math.floor((Date.parse(recorded)-Date.parse(f.renewal.created_at))/86400000);
     f.view.renewal_aging[0].band=f.view.renewal_aging[0].age_days>=15?'overdue':f.view.renewal_aging[0].age_days>=8?'aging':'current';
     f.view.aging[0].age_days=Math.floor((Date.parse(recorded)-Date.parse(f.followup.created_at))/86400000);
     f.view.aging[0].band=f.view.aging[0].age_days>=15?'overdue':f.view.aging[0].age_days>=8?'aging':'current';
     return ok({id:args.p_operation_id,company_id:companyId,recorded:true,field_accepted:false,
      service_authorized:false,independent_reapproval:false,reassignment_executed:false,release_green:false,outbound_actions:false});}
    return {data:null,error:{message:'unrecognized RPC'}};
   }};
 },{f,actor,companyId,opts});
 for(const src of scripts)await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#reassessment469 > summary').click();await page.locator('#pms469Refresh').click();
}
test('mobile owner sees overdue independent renewal and remains on HOLD',async({page})=>{
 await setup(page,{renewalDays:15});await expect(page.locator('#pms469Status')).toContainText('1 overdue (15+ days)');
 await expect(page.locator('#pms469Journal')).toContainText('OVERDUE · 15 full day(s)');
 await expect(page.locator('#pms469OwnerForm')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms469Hold')).toContainText('does not accept real field evidence');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms469Refresh').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('authorized owner writes one new-source documentary reassessment, no operational approval',async({page})=>{
 await setup(page);await page.locator('#pms469Renewal').selectOption({index:1});
 await page.locator('#pms469Decision').selectOption('retain_owner_hold');
 await page.locator('#pms469Source').fill('OWNER-469-NEW-AUDIT-SOURCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms469Record').click();
 await expect(page.locator('#pms469Status')).toContainText('1 owner reassessments');
 await expect(page.locator('#pms469OwnerForm')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_owner_reassess_469');
 expect(writes[0].args.p_decision).toBe('retain_owner_hold');
 await expect(page.locator('#pms469Hold')).toContainText('Production release');
});
test('separate reviewer can read but cannot impersonate owner',async({page})=>{
 await setup(page,{reviewer:true,reassessed:true});await expect(page.locator('#pms469Status')).toContainText('1 owner reassessments');
 await expect(page.locator('#pms469OwnerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('invalid scope, aging, source or permissions never writes',async({page})=>{
 for(const opts of [{foreign:true},{badAging:true},{off:true},{signedOut:true},{noJobs:true},{denied:true}]){
  await setup(page,opts);await expect(page.locator('#pms469OwnerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('recycled original reviewer source is blocked',async({page})=>{
 await setup(page);await page.locator('#pms469Renewal').selectOption({index:1});
 await page.locator('#pms469Source').fill('INDEPENDENT-468-NEW-EVIDENCE');
 await page.locator('#pms469Record').click();await expect(page.locator('#pms469Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
