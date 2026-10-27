import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,reviewerId,alternativeId,foreignCompanyId} from '../fixtures/pms-independent-handoff-465.mjs';
const src=readFileSync('js/pms-independent-handoff-465.js','utf8'),css=readFileSync('style.css','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1100:390,height:844});await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});const actor=opts.reviewer?alternativeId:opts.originalReviewer?reviewerId:ownerId;
 const f=fixture({now:Date.now(),handed:opts.handed||opts.reviewer,responded:opts.responded,viewer:actor,off:opts.off});
 if(opts.foreign)f.view.viewer_id=foreignCompanyId;
 await page.evaluate(({f,opts,actor,companyId})=>{
  window.__writes=[];window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  const ok=data=>({data,error:null});window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_handoff_inbox_465')return ok(f.inbox);
    if(name==='ywi_rpc_handoff_workspace_465')return ok(f.view);
    if(name==='ywi_rpc_verify_handoff_465'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'denied handoff'}};
     const row={id:args.p_operation_id,company_id:companyId,proposal_id:args.p_proposal_id,owner_user_id:actor,
      reviewer_user_id:f.proposal.proposed_reviewer_user_id,source_reference:args.p_source_reference,created_at:new Date().toISOString()};
     f.view.handoffs.push(row);f.view.handoff_total++;f.view.captured_at=row.created_at;
     return ok({id:row.id,company_id:companyId,recorded:true,field_accepted:false,service_authorized:false,
      independent_reapproval:false,reassignment_executed:false,release_green:false,outbound_actions:false});
    }
    if(name==='ywi_rpc_ack_handoff_465'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'denied response'}};
     const row={id:args.p_operation_id,company_id:companyId,handoff_id:args.p_handoff_id,reviewer_user_id:actor,
      response:args.p_response,source_reference:args.p_source_reference,created_at:new Date().toISOString()};
     f.view.receipts.push(row);f.view.receipt_total++;f.view.captured_at=row.created_at;
     return ok({id:row.id,company_id:companyId,recorded:true,field_accepted:false,service_authorized:false,
      independent_reapproval:false,reassignment_executed:false,release_green:false,outbound_actions:false});
    }
    return {data:null,error:{message:'unsupported function'}};
   },from(){window.__writes.push({name:'forbidden direct table access'});return {};}};
 },{f,opts,actor,companyId});await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#handoff465 > summary').click();await page.locator('#pms465Refresh').click();
}
test('mobile owner verifies actual proposal; HOLD without writes',async({page})=>{
 await setup(page);await expect(page.locator('#pms465Status')).toContainText('SOURCE VERIFIED: 1 independent proposals');
 await expect(page.locator('#pms465OwnerForm')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms465ReviewerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms465Hold')).toContainText('not new field evidence');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms465Refresh').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('owner records only a sourced internal handoff to the already nominated separate reviewer',async({page})=>{
 await setup(page);await page.locator('#pms465Proposal').selectOption({index:1});
 await page.locator('#pms465OwnerRef').fill('OWNER-VERIFIED-PROPOSAL-HANDOFF');page.once('dialog',d=>d.accept());
 await page.locator('#pms465Verify').click();await expect(page.locator('#pms465Status')).toContainText('1 internal handoffs');
 await expect(page.locator('#pms465OwnerForm')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_verify_handoff_465');expect(writes[0].args.p_proposal_id).toBeTruthy();
 await expect(page.locator('#pms465Hold')).toContainText('not new field evidence');
});
test('a separately signed-in reviewer acknowledges without evidence approval or notification',async({page})=>{
 await setup(page,{reviewer:true});await expect(page.locator('#pms465OwnerForm')).toHaveJSProperty('disabled',true);
 await page.locator('#pms465Handoff').selectOption({index:1});
 await page.locator('#pms465Response').selectOption('acknowledged_for_review');
 await page.locator('#pms465ReviewerRef').fill('SEPARATE-REVIEWER-ACKNOWLEDGEMENT');page.once('dialog',d=>d.accept());
 await page.locator('#pms465Ack').click();await expect(page.locator('#pms465Status')).toContainText('1 human responses');
 await expect(page.locator('#pms465Journal')).toContainText('acknowledged for review');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_ack_handoff_465');expect(writes[0].args.p_response).toBe('acknowledged_for_review');
});
test('foreign company, no sign-in, no Jobs, disabled service and original reviewer have no authority',async({page})=>{
 for(const opts of [{foreign:true},{signedOut:true},{noJobs:true},{off:true},{reviewer:true,off:true}]){
  await setup(page,opts);if(opts.off){await expect(page.locator('#pms465OwnerForm')).toHaveJSProperty('disabled',true);
   await expect(page.locator('#pms465ReviewerForm')).toHaveJSProperty('disabled',true);}
  else await expect(page.locator('#pms465Status')).toContainText('WITHHELD');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
 await setup(page,{originalReviewer:true});
 await expect(page.locator('#pms465Status')).toContainText('HOLD: choose a verified owner or reviewer company');
 await expect(page.locator('#pms465OwnerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms465ReviewerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
