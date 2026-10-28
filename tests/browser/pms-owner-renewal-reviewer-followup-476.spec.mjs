import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,alternativeId,foreignCompanyId}
 from '../fixtures/pms-owner-renewal-reviewer-followup-476.mjs';
const scripts=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js',
 'js/pms-owner-renewal-recheck-472.js','js/pms-review-outcome-owner-clarification-473.js',
 'js/pms-owner-clarification-continuity-474.js','js/pms-continuity-finding-owner-renewal-475.js',
 'js/pms-owner-renewal-reviewer-followup-476.js'].map(path=>readFileSync(path,'utf8'));
const css=readFileSync('style.css','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1120:390,height:844});await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const actor=opts.owner?ownerId:alternativeId;
 const f=fixture({renewalDays:opts.renewalDays??15,reviewer:!opts.owner,
  followedUp:opts.followedUp,off:opts.off,noRequest:opts.noRequest,
  noOwnerRenewal:opts.noOwnerRenewal,holdOnly:opts.holdOnly});
 await page.evaluate(({f,actor,companyId,foreignCompanyId,opts})=>{
  window.__writes=[];const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},
   from:()=>{window.__writes.push({name:'forbidden direct table'});return {};},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'permission denied'}};
    if(name==='ywi_rpc_handoff_inbox_465')return ok(f.inbox);
    if(name==='ywi_rpc_reviewer_renewal_workspace_476')return ok(opts.foreign?{...f.view,company_id:foreignCompanyId}:
     opts.badAging?{...f.view,owner_renewal_evidence_aging:[{...f.view.owner_renewal_evidence_aging[0],age_days:900}]}:f.view);
    if(name==='ywi_rpc_reviewer_renewal_receipt_476'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'permission denied'}};
     const recorded=new Date().toISOString();
     f.view.captured_at=f.view.aging_as_of=f.view.renewal_as_of=f.view.reassessment_as_of=
      f.view.continuity_as_of=f.view.exception_as_of=f.view.recheck_as_of=f.view.outcome_as_of=
      f.view.continuity_review_as_of=f.view.owner_renewal_as_of=f.view.reviewer_renewal_as_of=recorded;
     f.view.handoff_source.captured_at=recorded;
     f.view.reviewer_followup_receipts.push({id:args.p_operation_id,company_id:companyId,
      owner_request_id:args.p_owner_request_id,reviewer_user_id:actor,
      disposition:args.p_disposition,source_reference:args.p_source_reference,created_at:recorded});
     f.view.reviewer_followup_receipt_total++;
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
     age(f.view.owner_renewal_evidence_aging[0],f.ownerRequest.created_at);
     return ok({id:args.p_operation_id,company_id:companyId,recorded:true,
      field_accepted:false,service_authorized:false,independent_reapproval:false,
      reassignment_executed:false,release_green:false,outbound_actions:false});
    }
    return {data:null,error:{message:'unrecognized RPC'}};
   }};
 },{f,actor,companyId,foreignCompanyId,opts});
 for(const src of scripts)await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#reviewer476 > summary').click();await page.locator('#pms476Refresh').click();
}
test('original independent reviewer sees overdue owner renewal evidence on mobile',async({page})=>{
 await setup(page,{renewalDays:15});
 await expect(page.locator('#pms476Status')).toContainText('1 overdue (15+ days)');
 await expect(page.locator('#pms476Journal')).toContainText('OVERDUE · 15 full day(s)');
 await expect(page.locator('#pms476ReviewerForm')).toHaveJSProperty('disabled',false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms476Refresh').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('original reviewer records one fresh documentary receipt without authorizing service',async({page})=>{
 await setup(page);await page.locator('#pms476Request').selectOption({index:1});
 await page.locator('#pms476Disposition').selectOption('request_owner_source_refresh');
 await page.locator('#pms476Source').fill('REVIEWER-476-NEW-INDEPENDENT-SOURCE-RECHECK');
 page.once('dialog',dialog=>dialog.accept());await page.locator('#pms476Record').click();
 await expect(page.locator('#pms476Status')).toContainText('1 independent reviewer follow-ups');
 await expect(page.locator('#pms476ReviewerForm')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_reviewer_renewal_receipt_476');
 expect(writes[0].args.p_disposition).toBe('request_owner_source_refresh');
 await expect(page.locator('#pms476Hold')).toContainText('not independent reapproval');
});
test('company owner can inspect but cannot impersonate independent reviewer',async({page})=>{
 await setup(page,{owner:true,followedUp:true});
 await expect(page.locator('#pms476Status')).toContainText('1 independent reviewer follow-ups');
 await expect(page.locator('#pms476ReviewerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('no real owner renewal, a prior receipt or retained HOLD does not permit new review',async({page})=>{
 await setup(page,{noOwnerRenewal:true});await expect(page.locator('#pms476ReviewerForm')).toHaveJSProperty('disabled',true);
 await setup(page,{followedUp:true});await expect(page.locator('#pms476ReviewerForm')).toHaveJSProperty('disabled',true);
 await setup(page,{holdOnly:true});await expect(page.locator('#pms476ReviewerForm')).toHaveJSProperty('disabled',true);
 await setup(page,{noRequest:true});await expect(page.locator('#pms476ReviewerForm')).toHaveJSProperty('disabled',true);
});
test('recycled owner evidence is denied before a receipt write',async({page})=>{
 await setup(page);await page.locator('#pms476Request').selectOption({index:1});
 await page.locator('#pms476Source').fill('OWNER-475-FRESH-CONTINUITY-RENEWAL');
 await page.locator('#pms476Record').click();await expect(page.locator('#pms476Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('wrong company, age drift, service OFF, sign-out and permissions fail closed',async({page})=>{
 for(const opts of [{foreign:true},{badAging:true},{off:true},{signedOut:true},{noJobs:true},{denied:true}]){
  await setup(page,opts);await expect(page.locator('#pms476ReviewerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('auth changes invalidate reviewer evidence before a write',async({page})=>{
 await setup(page);await expect(page.locator('#pms476ReviewerForm')).toHaveJSProperty('disabled',false);
 await page.evaluate(()=>document.dispatchEvent(new Event('ywi:auth-changed')));
 await expect(page.locator('#pms476ReviewerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms476Status')).toContainText('HOLD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
