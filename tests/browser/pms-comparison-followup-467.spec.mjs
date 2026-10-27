import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,alternativeId,reviewerId} from '../fixtures/pms-comparison-followup-467.mjs';
const prior=readFileSync('js/pms-independent-handoff-465.js','utf8');
const src=readFileSync('js/pms-comparison-followup-467.js','utf8');
const css=readFileSync('style.css','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1120:390,height:844});await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const actor=opts.reviewer?alternativeId:opts.originalReviewer?reviewerId:ownerId;
 const f=fixture({now:Date.now(),reviewer:opts.reviewer,compared:opts.compared,outcomeRecorded:opts.outcomeRecorded,
  followed:opts.followed,off:opts.off,alignment:opts.alignment||'material_gap',
  disposition:opts.disposition||'exception_remains_open'});
 await page.evaluate(({f,actor,companyId,opts})=>{
  window.__writes=[];const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},from:()=>{window.__writes.push({name:'direct table forbidden'});return {};},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_handoff_inbox_465')return ok(opts.originalReviewer?{...f.inbox,viewer_id:actor,companies:[],total:0}:f.inbox);
    if(name==='ywi_rpc_comparison_workspace_467')return ok(opts.foreign?{...f.view,company_id:actor}:f.view);
    if(name==='ywi_rpc_compare_sources_466'){
     window.__writes.push({name,args});if(opts.writeDenied)return {error:{message:'denied'},data:null};
     const row={id:args.p_operation_id,company_id:companyId,handoff_id:args.p_handoff_id,receipt_id:f.receipt.id,reviewer_user_id:actor,
      original_source_reference:args.p_original_source_reference,compared_source_reference:args.p_compared_source_reference,
      alignment:args.p_alignment,created_at:new Date().toISOString()};
     f.view.comparisons.push(row);f.view.comparison_total++;f.view.captured_at=row.created_at;
     return ok({id:row.id,company_id:companyId,recorded:true,field_accepted:false,service_authorized:false,
      independent_reapproval:false,reassignment_executed:false,release_green:false,outbound_actions:false});}
    if(name==='ywi_rpc_record_exception_466'){
     window.__writes.push({name,args});if(opts.writeDenied)return {error:{message:'denied'},data:null};
     const row={id:args.p_operation_id,company_id:companyId,comparison_id:args.p_comparison_id,reviewer_user_id:actor,
      disposition:args.p_disposition,source_reference:args.p_source_reference,created_at:new Date().toISOString()};
     f.view.outcomes.push(row);f.view.outcome_total++;f.view.captured_at=row.created_at;
     return ok({id:row.id,company_id:companyId,recorded:true,field_accepted:false,service_authorized:false,
      independent_reapproval:false,reassignment_executed:false,release_green:false,outbound_actions:false});}
    if(name==='ywi_rpc_followup_comparison_467'){
     window.__writes.push({name,args});if(opts.writeDenied)return {error:{message:'denied'},data:null};
     const row={id:args.p_operation_id,company_id:companyId,outcome_id:args.p_outcome_id,owner_user_id:actor,
      decision:args.p_decision,source_reference:args.p_source_reference,created_at:new Date().toISOString()};
     f.view.followups.push(row);f.view.followup_total++;f.view.captured_at=row.created_at;
     return ok({id:row.id,company_id:companyId,recorded:true,field_accepted:false,service_authorized:false,
      independent_reapproval:false,reassignment_executed:false,release_green:false,outbound_actions:false});}
    return {error:{message:'unrecognized RPC'},data:null};
   }};
 },{f,actor,companyId,opts});
 await page.addScriptTag({content:prior});await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#comparison467 > summary').click();await page.locator('#pms467Refresh').click();
}
test('390px owner has documented HOLD and no reviewer source authority',async({page})=>{
 await setup(page);await expect(page.locator('#pms467Status')).toContainText('SOURCE VERIFIED: 0 independent comparisons');
 await expect(page.locator('#pms467ReviewerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms467OwnerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms467Hold')).toContainText('do not certify field evidence');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms467Refresh').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('assigned reviewer compares their own acknowledged source; no field authorization',async({page})=>{
 await setup(page,{reviewer:true});await expect(page.locator('#pms467ReviewerForm')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms467OwnerForm')).toHaveJSProperty('disabled',true);
 await page.locator('#pms467Receipt').selectOption({index:1});await page.locator('#pms467Independent').fill('INDEPENDENT-REAL-SOURCE-REFERENCE');
 await page.locator('#pms467Alignment').selectOption('material_gap');page.once('dialog',d=>d.accept());
 await page.locator('#pms467Compare').click();await expect(page.locator('#pms467Status')).toContainText('1 independent comparisons');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_compare_sources_466');expect(writes[0].args.p_alignment).toBe('material_gap');
 await expect(page.locator('#pms467Hold')).toContainText('do not certify field evidence');
});
test('the separate reviewer records an independent exception outcome without owner action',async({page})=>{
 await setup(page,{reviewer:true,compared:true});await expect(page.locator('#pms467OutcomeForm')).toHaveJSProperty('disabled',false);
 await page.locator('#pms467Comparison').selectOption({index:1});
 await page.locator('#pms467Disposition').selectOption('request_source_clarification');
 await page.locator('#pms467OutcomeRef').fill('REVIEWER-466-EXCEPTION-REFERENCE');page.once('dialog',d=>d.accept());
 await page.locator('#pms467RecordOutcome').click();await expect(page.locator('#pms467Status')).toContainText('1 reviewer outcomes');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_record_exception_466');
});
test('owner only follows a genuine independent exception and preserves HOLD',async({page})=>{
 await setup(page,{compared:true,outcomeRecorded:true});await expect(page.locator('#pms467OwnerForm')).toHaveJSProperty('disabled',false);
 await page.locator('#pms467OwnerOutcome').selectOption({index:1});await page.locator('#pms467Decision').selectOption('documentary_closeout');
 await page.locator('#pms467OwnerRef').fill('OWNER-DOCUMENTARY-467-CLOSEOUT');page.once('dialog',d=>d.accept());
 await page.locator('#pms467Follow').click();await expect(page.locator('#pms467Status')).toContainText('1 owner follow-ups');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_followup_comparison_467');
 await expect(page.locator('#pms467Hold')).toContainText('documentary_closeout');
});
test('matching source, foreign identity, service OFF, denied API and signed-out state cannot write',async({page})=>{
 for(const opts of [{compared:true,outcomeRecorded:true,alignment:'matches_recorded_chain',disposition:'ready_for_owner_reassessment'},
  {off:true},{foreign:true},
  {signedOut:true},{noJobs:true},{denied:true},{originalReviewer:true}]){
  await setup(page,opts);
  if(!opts.compared)await expect(page.locator('#pms467ReviewerForm')).toHaveJSProperty('disabled',true);
  await expect(page.locator('#pms467OwnerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
