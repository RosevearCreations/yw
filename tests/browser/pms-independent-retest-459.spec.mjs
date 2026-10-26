import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,reviewerId,foreignCompanyId,followupId,
 assignmentId,freshEvidenceId} from '../fixtures/pms-independent-retest-459.mjs';
const src=readFileSync('js/pms-independent-retest-459.js','utf8');
const css=readFileSync('style.css','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1100:390,height:844});
 await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const uid=options.reviewer?reviewerId:ownerId;
 const d=fixture({now:Date.now(),viewer:uid,unassigned:!!options.unassigned,
  compared:!!options.compared,off:!!options.off,empty:!!options.empty});
 if(options.foreignTenant)d.view.company_id=foreignCompanyId;
 await page.evaluate(({d,options,uid,companyId,foreignCompanyId})=>{
  window.__writes=[];window.__signedOut=!!options.signedOut;window.__calls=[];
  window.YWISecurity={canViewModule:key=>key==='jobs'&&!options.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:uid},role:'admin'})};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badAuth?foreignCompanyId:uid}})},
   rpc:async(name,args)=>{
    window.__calls.push(name);
    if(options.denied)return {data:null,error:{message:'access denied'}};
    if(name==='ywi_rpc_retest_inbox_459')return ok(d.inbox);
    if(name==='ywi_rpc_independent_retest_459')return ok(d.view);
    if(name==='ywi_rpc_assign_retest_459'){
     window.__writes.push({name,args});
     if(options.writeDenied)return {data:null,error:{message:'Jobs denied'}};
     d.view.assignments.push({id:args.p_request_id,company_id:companyId,
      owner_followup_id:args.p_owner_followup_id,reviewer_user_id:args.p_reviewer_user_id,
      source_reference:args.p_source_reference,notes:args.p_notes,created_at:new Date().toISOString()});
     d.view.assignment_total++;return ok({id:args.p_request_id,company_id:companyId,recorded:true,
      independent_reapproval:false,field_accepted:false,service_authorized:false,outbound_actions:false});
    }
    if(name==='ywi_rpc_record_retest_comparison_459'){
     window.__writes.push({name,args});
     if(options.writeDenied)return {data:null,error:{message:'Jobs denied'}};
     d.view.comparisons.push({id:args.p_request_id,company_id:companyId,
      assignment_id:args.p_assignment_id,fresh_evidence_id:args.p_fresh_evidence_id,
      outcome:args.p_outcome,source_reference:args.p_source_reference,notes:args.p_notes,
      created_at:new Date().toISOString()});d.view.comparison_total++;
     return ok({id:args.p_request_id,company_id:companyId,recorded:true,
      independent_reapproval:false,field_accepted:false,service_authorized:false,outbound_actions:false});
    }
    return {data:null,error:{message:'unknown RPC'}};
   },from(){window.__writes.push('forbidden table write');return {};}};
 },{d,options,uid,companyId,foreignCompanyId});
 await page.addScriptTag({content:src});await page.locator('#retest459 > summary').click();
 await page.locator('#pms459Refresh').click();
}
test('390px owner views original retest source, Help and field HOLD with accessible controls',async({page})=>{
 await setup(page,{unassigned:true});
 await expect(page.locator('#pms459Status')).toContainText('SOURCE VERIFIED: 1 retest-ready');
 await expect(page.locator('#pms459OwnerForm')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms459ReviewerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms459Release')).toContainText('HOLD');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms459Refresh').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await expect(page.locator('a[href="/help.html#pms-independent-retest-459"]')).toHaveCount(1);
 await page.locator('#pms459Company').focus();await page.keyboard.press('Tab');
 expect(await page.locator('#pms459Refresh').evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('owner assigns separate reviewer with immutable retest source and no work approval',async({page})=>{
 await setup(page,{unassigned:true});
 await page.locator('#pms459Followup').selectOption(followupId);
 await page.locator('#pms459Reviewer').fill(reviewerId);
 await page.locator('#pms459OwnerReference').fill('ORIGINAL-458-RETEST-SOURCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms459Assign').click();
 await expect(page.locator('#pms459Status')).toContainText('SOURCE VERIFIED:');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_assign_retest_459');
 expect(writes[0].args.p_owner_followup_id).toBe(followupId);
 expect(writes[0].args.p_reviewer_user_id).toBe(reviewerId);
 await expect(page.locator('#pms459Release')).toContainText('HOLD');
});
test('separately assigned reviewer compares genuine new field evidence, leaves 457 HOLD',async({page})=>{
 await setup(page,{reviewer:true});
 await expect(page.locator('#pms459OwnerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms459ReviewerForm')).toHaveJSProperty('disabled',false);
 await page.locator('#pms459Assignment').selectOption(assignmentId);
 await page.locator('#pms459Evidence').selectOption(freshEvidenceId);
 await page.locator('#pms459Outcome').selectOption('comparison_differs');
 await page.locator('#pms459ReviewerReference').fill('NEW-POST-ASSIGNMENT-455-EVIDENCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms459Record').click();
 await expect(page.locator('#pms459Status')).toContainText('SOURCE VERIFIED:');
 await expect(page.locator('#pms459Journal .pms459-entry')).toHaveCount(1);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_record_retest_comparison_459');
 expect(writes[0].args.p_assignment_id).toBe(assignmentId);
 expect(writes[0].args.p_fresh_evidence_id).toBe(freshEvidenceId);
 await expect(page.locator('#pms459Release')).toContainText('HOLD');
});
test('no real company, foreign tenant, denied identity and service OFF never grant unsafe actions',async({page})=>{
 for(const opt of [{empty:true},{foreignTenant:true},{badAuth:true},
  {signedOut:true},{denied:true},{noJobs:true},{off:true}]){
  await setup(page,opt);
  await expect(page.locator('#pms459OwnerForm')).toHaveJSProperty('disabled',true);
  await expect(page.locator('#pms459ReviewerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('server rejection cannot auto-replay comparison; signout clears reviewer source',async({page})=>{
 await setup(page,{reviewer:true,writeDenied:true});
 await page.locator('#pms459Assignment').selectOption(assignmentId);
 await page.locator('#pms459Evidence').selectOption(freshEvidenceId);
 await page.locator('#pms459ReviewerReference').fill('REVIEWER-SOURCE-DENIED');
 page.once('dialog',d=>d.accept());await page.locator('#pms459Record').click();
 await expect(page.locator('#pms459Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#pms459ReviewerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
});
