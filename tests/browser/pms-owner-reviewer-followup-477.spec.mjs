import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,alternativeId,foreignCompanyId}
 from '../fixtures/pms-owner-reviewer-followup-477.mjs';
const scripts=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js',
 'js/pms-owner-renewal-recheck-472.js','js/pms-review-outcome-owner-clarification-473.js',
 'js/pms-owner-clarification-continuity-474.js','js/pms-continuity-finding-owner-renewal-475.js',
 'js/pms-owner-renewal-reviewer-followup-476.js','js/pms-owner-reviewer-followup-477.js'].map(p=>readFileSync(p,'utf8'));
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});await page.goto('about:blank');
 await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:readFileSync('style.css','utf8')});
 const actor=opts.reviewer?alternativeId:ownerId;
 const f=fixture({days:opts.days??15,ownerResponse:opts.ownerResponse,off:opts.off});
 await page.evaluate(({f,actor,opts,companyId,foreignCompanyId})=>{
  window.__writes=[];const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},rpc:async(name,args)=>{
   if(opts.denied)return {data:null,error:{message:'permission denied'}};
   if(name==='ywi_rpc_handoff_inbox_465')return ok(f.inbox);
   if(name==='ywi_rpc_owner_reviewer_workspace_477')
    return ok(opts.foreign?{...f.view,company_id:foreignCompanyId}:f.view);
   if(name==='ywi_rpc_owner_reviewer_response_477'){
    window.__writes.push({name,args});
    if(opts.writeDenied)return {data:null,error:{message:'permission denied'}};
    const recorded=new Date().toISOString();
    f.view.captured_at=f.view.aging_as_of=f.view.renewal_as_of=f.view.reassessment_as_of=
     f.view.continuity_as_of=f.view.exception_as_of=f.view.recheck_as_of=f.view.outcome_as_of=
     f.view.continuity_review_as_of=f.view.owner_renewal_as_of=f.view.reviewer_renewal_as_of=
     f.view.owner_reviewer_as_of=recorded;
    f.view.handoff_source.captured_at=recorded;
    f.view.owner_reviewer_responses.push({id:args.p_operation_id,company_id:companyId,
      reviewer_receipt_id:args.p_reviewer_receipt_id,owner_user_id:actor,
      decision:args.p_decision,source_reference:args.p_source_reference,created_at:recorded});
    f.view.owner_reviewer_response_total++;
    const age=(row,date)=>{row.age_days=Math.max(0,Math.floor((Date.parse(recorded)-Date.parse(date))/86400000));
     row.band=row.age_days>=15?'overdue':row.age_days>=8?'aging':'current';};
    age(f.view.aging[0],f.view.followups[0].created_at);
    age(f.view.renewal_aging[0],f.renewal.created_at);
    age(f.view.reassessment_aging[0],f.reassessment.created_at);
    age(f.view.exception_aging[0],f.confirmation.created_at);
    age(f.view.recheck_aging[0],f.ownerRenewal.created_at);
    age(f.view.outcome_aging[0],f.review.created_at);
    age(f.view.clarification_aging[0],f.clarification.created_at);
    age(f.view.continuity_finding_aging[0],f.continuity.created_at);
    age(f.view.owner_renewal_evidence_aging[0],f.ownerRequest.created_at);
    age(f.view.reviewer_receipt_aging[0],f.reviewerReceipt.created_at);
    return ok({id:args.p_operation_id,company_id:companyId,recorded:true,field_accepted:false,
      service_authorized:false,independent_reapproval:false,reassignment_executed:false,
      release_green:false,outbound_actions:false});
   }
   return {data:null,error:{message:'unexpected RPC'}};
  }};
 },{f,actor,opts,companyId,foreignCompanyId});
 for(const src of scripts)await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#owner477 > summary').click();await page.locator('#pms477Refresh').click();
}
test('owner sees overdue genuine independent receipt and no mobile overflow',async({page})=>{
 await setup(page);await expect(page.locator('#pms477Status')).toContainText('1 overdue (15+ days)');
 await expect(page.locator('#pms477OwnerForm')).toHaveJSProperty('disabled',false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('owner can record one documentary response but not release HOLD',async({page})=>{
 await setup(page);await page.locator('#pms477Receipt').selectOption({index:1});
 await page.locator('#pms477Source').fill('OWNER-477-FRESH-LIVE-EVIDENCE-REFERENCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms477Record').click();
 await expect(page.locator('#pms477Status')).toContainText('1 owner responses');
 expect((await page.evaluate(()=>window.__writes))[0].name).toBe('ywi_rpc_owner_reviewer_response_477');
 await expect(page.locator('#pms477Hold')).toContainText('QL-245');});
test('reviewer sees read-only and no synthetic owner write',async({page})=>{
 await setup(page,{reviewer:true,ownerResponse:true});
 await expect(page.locator('#pms477OwnerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('owner prior response, foreign company, service OFF and missing Jobs permission fail closed',async({page})=>{
 for(const opts of [{ownerResponse:true},{foreign:true},{off:true},{signedOut:true},{noJobs:true},{denied:true}]){
  await setup(page,opts);await expect(page.locator('#pms477OwnerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('authentication switch invalidates evidence and denies writing',async({page})=>{
 await setup(page);await page.evaluate(()=>document.dispatchEvent(new Event('ywi:auth-changed')));
 await expect(page.locator('#pms477OwnerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});