import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,alternativeId,foreignCompanyId}
 from '../fixtures/pms-continuity-finding-owner-renewal-475.mjs';
const scripts=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js',
 'js/pms-owner-renewal-recheck-472.js','js/pms-review-outcome-owner-clarification-473.js',
 'js/pms-owner-clarification-continuity-474.js','js/pms-continuity-finding-owner-renewal-475.js']
 .map(path=>readFileSync(path,'utf8'));
const css=readFileSync('style.css','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1120:390,height:844});await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const actor=opts.reviewer?alternativeId:ownerId;
 const f=fixture({findingDays:opts.findingDays??15,reviewer:opts.reviewer,
  renewed:opts.renewed,off:opts.off,noRequest:opts.noRequest,noFinding:opts.noFinding});
 await page.evaluate(({f,actor,companyId,foreignCompanyId,opts})=>{
  window.__writes=[];const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},
   from:()=>{window.__writes.push({name:'forbidden table query'});return {};},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'permission denied'}};
    if(name==='ywi_rpc_handoff_inbox_465')return ok(f.inbox);
    if(name==='ywi_rpc_owner_renewal_workspace_475')return ok(opts.foreign?{...f.view,company_id:foreignCompanyId}:
     opts.badAging?{...f.view,continuity_finding_aging:[{...f.view.continuity_finding_aging[0],age_days:900}]}:f.view);
    if(name==='ywi_rpc_owner_continuity_request_475'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'permission denied'}};
     const recorded=new Date().toISOString();
     f.view.captured_at=f.view.aging_as_of=f.view.renewal_as_of=f.view.reassessment_as_of=
      f.view.continuity_as_of=f.view.exception_as_of=f.view.recheck_as_of=f.view.outcome_as_of=
      f.view.continuity_review_as_of=f.view.owner_renewal_as_of=recorded;
     f.view.handoff_source.captured_at=recorded;
     f.view.owner_renewal_requests.push({id:args.p_operation_id,company_id:companyId,
      continuity_review_id:args.p_continuity_review_id,owner_user_id:actor,
      decision:args.p_decision,source_reference:args.p_source_reference,created_at:recorded});
     f.view.owner_renewal_request_total++;
     const age=(row,date)=>{row.age_days=Math.max(0,Math.floor((Date.parse(recorded)-Date.parse(date))/86400000));
      row.band=row.age_days>=15?'overdue':row.age_days>=8?'aging':'current';};
     age(f.view.aging[0],f.followup.created_at);
     age(f.view.renewal_aging[0],f.renewal.created_at);
     age(f.view.reassessment_aging[0],f.reassessment.created_at);
     age(f.view.exception_aging[0],f.confirmation.created_at);
     age(f.view.recheck_aging[0],f.ownerRenewal.created_at);
     age(f.view.outcome_aging[0],f.review.created_at);
     age(f.view.clarification_aging[0],f.clarification.created_at);
     age(f.view.continuity_finding_aging[0],f.continuity.created_at);
     return ok({id:args.p_operation_id,company_id:companyId,recorded:true,
      field_accepted:false,service_authorized:false,independent_reapproval:false,
      reassignment_executed:false,release_green:false,outbound_actions:false});
    }
    return {data:null,error:{message:'unrecognized RPC'}};
   }};
 },{f,actor,companyId,foreignCompanyId,opts});
 for(const src of scripts)await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#renewal475 > summary').click();await page.locator('#pms475Refresh').click();
}
test('owner sees overdue original reviewer findings on mobile without overflow',async({page})=>{
 await setup(page,{findingDays:15});
 await expect(page.locator('#pms475Status')).toContainText('1 overdue (15+ days)');
 await expect(page.locator('#pms475Journal')).toContainText('OVERDUE · 15 full day(s)');
 await expect(page.locator('#pms475OwnerForm')).toHaveJSProperty('disabled',false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms475Refresh').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('company owner supplies one distinct source in response to independent reviewer request',async({page})=>{
 await setup(page);await page.locator('#pms475Finding').selectOption({index:1});
 await page.locator('#pms475Decision').selectOption('submit_renewed_documentary_source');
 await page.locator('#pms475Source').fill('OWNER-475-NEW-DOCUMENTARY-RENEWAL-SOURCE');
 page.once('dialog',dialog=>dialog.accept());await page.locator('#pms475Record').click();
 await expect(page.locator('#pms475Status')).toContainText('1 owner renewal receipts');
 await expect(page.locator('#pms475OwnerForm')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_owner_continuity_request_475');
 expect(writes[0].args.p_decision).toBe('submit_renewed_documentary_source');
 await expect(page.locator('#pms475Hold')).toContainText('does not release field work');
});
test('original independent reviewer can inspect but cannot sign as owner',async({page})=>{
 await setup(page,{reviewer:true,renewed:true});
 await expect(page.locator('#pms475Status')).toContainText('1 owner renewal receipts');
 await expect(page.locator('#pms475OwnerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('no finding, prior response and non-requesting reviewer cannot trigger owner response',async({page})=>{
 await setup(page,{noFinding:true});await expect(page.locator('#pms475OwnerForm')).toHaveJSProperty('disabled',true);
 await setup(page,{renewed:true});await expect(page.locator('#pms475OwnerForm')).toHaveJSProperty('disabled',true);
 await setup(page,{noRequest:true});await expect(page.locator('#pms475OwnerForm')).toHaveJSProperty('disabled',true);
});
test('old independent reviewer source cannot be recycled as new owner evidence',async({page})=>{
 await setup(page);await page.locator('#pms475Finding').selectOption({index:1});
 await page.locator('#pms475Source').fill('REVIEWER-474-FRESH-CONTINUITY-REVIEW');
 await page.locator('#pms475Record').click();await expect(page.locator('#pms475Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('cross-company, drift, service OFF, sign-out and permission denial fail closed',async({page})=>{
 for(const opts of [{foreign:true},{badAging:true},{off:true},{signedOut:true},{noJobs:true},{denied:true}]){
  await setup(page,opts);await expect(page.locator('#pms475OwnerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('a changed identity invalidates pending owner response before a write',async({page})=>{
 await setup(page);await expect(page.locator('#pms475OwnerForm')).toHaveJSProperty('disabled',false);
 await page.evaluate(()=>document.dispatchEvent(new Event('ywi:auth-changed')));
 await expect(page.locator('#pms475OwnerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms475Status')).toContainText('HOLD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
