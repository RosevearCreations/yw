import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,alternativeId,foreignCompanyId} from '../fixtures/pms-continuity-exception-471.mjs';
const scripts=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js'].map(f=>readFileSync(f,'utf8'));
const css=readFileSync('style.css','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1120:390,height:844});await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const actor=opts.reviewer?alternativeId:ownerId;
 const f=fixture({exceptionDays:opts.exceptionDays??15,reviewer:opts.reviewer,off:opts.off,renewed:opts.renewed,holdOnly:opts.holdOnly});
 await page.evaluate(({f,actor,companyId,foreignCompanyId,opts})=>{
  window.__writes=[];const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},
   from:()=>{window.__writes.push({name:'forbidden direct table'});return {};},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'permission denied'}};
    if(name==='ywi_rpc_handoff_inbox_465')return ok(f.inbox);
    if(name==='ywi_rpc_exception_workspace_471')return ok(opts.foreign?{...f.view,company_id:foreignCompanyId}:
     opts.badAging?{...f.view,exception_aging:[{...f.view.exception_aging[0],age_days:400}]}:f.view);
    if(name==='ywi_rpc_owner_followup_471'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'permission denied'}};
     const recorded=new Date().toISOString();f.view.captured_at=f.view.aging_as_of=f.view.renewal_as_of=
      f.view.reassessment_as_of=f.view.continuity_as_of=f.view.exception_as_of=recorded;
     f.view.handoff_source.captured_at=recorded;
     f.view.owner_renewals.push({id:args.p_operation_id,company_id:companyId,
      confirmation_id:args.p_confirmation_id,owner_user_id:actor,decision:args.p_decision,
      source_reference:args.p_source_reference,created_at:recorded});f.view.owner_renewal_total++;
     const aging=(a,date)=>{a.age_days=Math.max(0,Math.floor((Date.parse(recorded)-Date.parse(date))/86400000));
      a.band=a.age_days>=15?'overdue':a.age_days>=8?'aging':'current';};
     aging(f.view.aging[0],f.followup.created_at);aging(f.view.renewal_aging[0],f.renewal.created_at);
     aging(f.view.reassessment_aging[0],f.reassessment.created_at);
     aging(f.view.exception_aging[0],f.confirmation.created_at);
     return ok({id:args.p_operation_id,company_id:companyId,recorded:true,field_accepted:false,
      service_authorized:false,independent_reapproval:false,reassignment_executed:false,
      release_green:false,outbound_actions:false});
    }
    return {data:null,error:{message:'unrecognized RPC'}};
   }};
 },{f,actor,companyId,foreignCompanyId,opts});
 for(const src of scripts)await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#exception471 > summary').click();await page.locator('#pms471Refresh').click();
}
test('owner views aged genuine exception on mobile without overflowing',async({page})=>{
 await setup(page,{exceptionDays:15});
 await expect(page.locator('#pms471Status')).toContainText('1 overdue (15+ days)');
 await expect(page.locator('#pms471Journal')).toContainText('OVERDUE · 15 full day(s)');
 await expect(page.locator('#pms471OwnerForm')).toHaveJSProperty('disabled',false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms471Refresh').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('verified owner renews one distinct source and leaves operational HOLD',async({page})=>{
 await setup(page);await page.locator('#pms471Exception').selectOption({index:1});
 await page.locator('#pms471Decision').selectOption('request_independent_recheck');
 await page.locator('#pms471Source').fill('OWNER-471-UNIQUE-SOURCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms471Record').click();
 await expect(page.locator('#pms471Status')).toContainText('1 owner renewals');
 await expect(page.locator('#pms471OwnerForm')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_owner_followup_471');
 expect(writes[0].args.p_decision).toBe('request_independent_recheck');
 await expect(page.locator('#pms471Hold')).toContainText('does not accept field evidence');
});
test('separate reviewer can view but cannot sign owner evidence',async({page})=>{
 await setup(page,{reviewer:true});
 await expect(page.locator('#pms471Status')).toContainText('1 independent exceptions');
 await expect(page.locator('#pms471OwnerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('hold-only independent finding is not a new owner exception',async({page})=>{
 await setup(page,{holdOnly:true});await expect(page.locator('#pms471Status')).toContainText('0 independent exceptions');
 await expect(page.locator('#pms471OwnerForm')).toHaveJSProperty('disabled',true);
});
test('recycled reviewer source is withheld before write',async({page})=>{
 await setup(page);await page.locator('#pms471Exception').selectOption({index:1});
 await page.locator('#pms471Source').fill('REVIEWER-470-NEW-CONTINUITY-REF');
 await page.locator('#pms471Record').click();await expect(page.locator('#pms471Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('scope, sign-in, aging, disabled service and denied RPC fail closed',async({page})=>{
 for(const opts of [{foreign:true},{badAging:true},{off:true},{signedOut:true},{noJobs:true},{denied:true}]){
  await setup(page,opts);await expect(page.locator('#pms471OwnerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
