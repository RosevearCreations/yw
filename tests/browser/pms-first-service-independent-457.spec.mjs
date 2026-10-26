import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,reviewerId,foreignCompanyId,readyId,handoffId,laterEvidenceId,reviewId}
 from '../fixtures/pms-first-service-independent-457.mjs';
const src=readFileSync('js/pms-first-service-independent-457.js','utf8');
const css=readFileSync('style.css','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1100:390,height:844});
 await page.goto('about:blank');await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});const uid=options.reviewer?reviewerId:ownerId;
 const data=fixture({now:Date.now(),viewer:uid,empty:!!options.empty,closed:!!options.closed,enabled:options.off?[]:undefined});
 if(!options.empty){data.prev.review.reviews.unshift(data.ready);data.prev.review.review_total++;}
 if(options.unassigned){data.view.handoffs=[];data.view.handoff_total=0;
  data.view.exceptions=[];data.view.exception_total=0;data.view.resolution_evidence=[];data.view.evidence_total=0;}
 if(options.foreignHandoff)data.view.handoffs[0].reviewer_user_id=foreignCompanyId;
 if(options.foreignTenant)data.view.company_id=foreignCompanyId;
 await page.evaluate(({uid,ownerId,reviewerId,companyId,foreignCompanyId,data,options})=>{
  window.__writes=[];window.__calls=[];window.__signedOut=!!options.signedOut;
  window.YWISecurity={canViewModule:key=>key==='jobs'&&!options.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:uid},role:'admin'})};
  const ok=x=>({data:x,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badAuth?foreignCompanyId:uid}})},
   rpc:async(name,args)=>{
    window.__calls.push(name);
    if(options.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_reviewer_inbox_457')return ok(data.inbox);
    if(name==='ywi_rpc_first_service_independent_457')return ok(data.view);
    if(name==='ywi_rpc_first_service_review_456')return ok(data.prev.review);
    if(name==='ywi_rpc_assign_independent_457'){
     window.__writes.push({name,args});if(options.writeDenied)return {data:null,error:{message:'cannot assign'}};
     data.view.handoffs.push({...data.view.handoffs[0],id:args.p_request_id,
      company_id:companyId,owner_review_id:args.p_owner_review_id,
      reviewer_user_id:args.p_reviewer_user_id,source_reference:args.p_source_reference,
      notes:args.p_notes,created_at:new Date().toISOString(),service_module_key:'landscape',
      target_table:'work_orders',target_id:'a4540000-0000-4454-8454-000000000011',
      owner_recommendation:'ready_for_independent_review'});
     data.view.handoff_total++;return ok({id:args.p_request_id,company_id:companyId,recorded:true,
      independent_service_approval:false,field_accepted:false,outbound_actions:false});}
    if(name==='ywi_rpc_record_independent_457'){
     window.__writes.push({name,args});if(options.writeDenied)return {data:null,error:{message:'Jobs denied'}};
     data.view.decisions.push({id:args.p_request_id,company_id:companyId,handoff_id:args.p_handoff_id,
      decision:args.p_decision,exception_review_id:args.p_exception_review_id,
      resolution_evidence_id:args.p_resolution_evidence_id,source_reference:args.p_source_reference,
      notes:args.p_notes,created_at:new Date().toISOString()});data.view.decision_total++;
     return ok({id:args.p_request_id,company_id:companyId,recorded:true,decision:args.p_decision,
      independent_service_approval:false,field_accepted:false,outbound_actions:false});}
    return {data:null,error:{message:'unknown RPC'}};
   },from(){window.__writes.push('forbidden direct table action');return {};}};
 },{uid,ownerId,reviewerId,companyId,foreignCompanyId,data,options});
 await page.addScriptTag({content:src});await page.locator('#owner457 summary').click();
 await page.locator('#pms457Refresh').click();
}
test('390px distinct reviewer sees own handoff and HOLD; keyboard Help remains accessible',async({page})=>{
 await setup(page,{reviewer:true});
 await expect(page.locator('#pms457Status')).toContainText('SOURCE VERIFIED: 1 independent handoffs');
 await expect(page.locator('#pms457OwnerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms457ReviewerForm')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms457Release')).toContainText('HOLD');
 const geometry=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(geometry).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms457Refresh').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await expect(page.locator('a[href="/help.html#pms-first-service-independent-457"]')).toHaveCount(1);
 await page.locator('#pms457Company').focus();await page.keyboard.press('Tab');
 expect(await page.locator('#pms457Refresh').evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('owner can assign a distinct reviewer without claiming service approval',async({page})=>{
 await setup(page,{unassigned:true});
 await expect(page.locator('#pms457OwnerForm')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms457ReviewerForm')).toHaveJSProperty('disabled',true);
 await page.locator('#pms457Ready').selectOption(readyId);
 await page.locator('#pms457Reviewer').fill(reviewerId);
 await page.locator('#pms457OwnerRef').fill('OWNER-HANDOFF-EVIDENCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms457Assign').click();
 await expect(page.locator('#pms457Status')).toContainText('SOURCE VERIFIED');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_assign_independent_457');
 expect(writes[0].args.p_owner_review_id).toBe(readyId);
 expect(writes[0].args.p_reviewer_user_id).toBe(reviewerId);
 await expect(page.locator('#pms457Release')).toContainText('HOLD');
});
test('independent reviewer records exception closure with earlier exception and later field source',async({page})=>{
 await setup(page,{reviewer:true});
 await page.locator('#pms457Handoff').selectOption(handoffId);
 await page.locator('#pms457Decision').selectOption('exception_verified_closed');
 await page.locator('#pms457Exception').selectOption(reviewId);
 await page.locator('#pms457Evidence').selectOption(laterEvidenceId);
 await page.locator('#pms457ReviewerRef').fill('INDEPENDENT-REVIEW-CLOSURE-RECEIPT');
 page.once('dialog',d=>d.accept());await page.locator('#pms457Record').click();
 await expect(page.locator('#pms457Status')).toContainText('SOURCE VERIFIED');
 await expect(page.locator('.pms457-entry')).toHaveCount(1);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_record_independent_457');
 expect(writes[0].args.p_exception_review_id).toBe(reviewId);
 expect(writes[0].args.p_resolution_evidence_id).toBe(laterEvidenceId);
 await expect(page.locator('#pms457Release')).toContainText('HOLD');
});
test('foreign identity, company, signed-out, missing original and denied access WITHHOLD safely',async({page})=>{
 for(const options of [{empty:true},{reviewer:true,foreignTenant:true},
  {reviewer:true,foreignHandoff:true},{reviewer:true,badAuth:true},
  {reviewer:true,denied:true},{reviewer:true,signedOut:true},{reviewer:true,noJobs:true}]){
  await setup(page,options);
  await expect(page.locator('#pms457OwnerForm')).toHaveJSProperty('disabled',true);
  await expect(page.locator('#pms457ReviewerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('server denial never auto-replays; OFF service blocks closure and signout invalidates review',async({page})=>{
 await setup(page,{reviewer:true,writeDenied:true});
 await page.locator('#pms457Handoff').selectOption(handoffId);
 await page.locator('#pms457Decision').selectOption('returned_for_follow_up');
 await page.locator('#pms457ReviewerRef').fill('REVIEWER-SOURCE-DENIED');
 page.once('dialog',d=>d.accept());await page.locator('#pms457Record').click();
 await expect(page.locator('#pms457Status')).toContainText('WITHHELD: Unverifiable server response');
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#pms457ReviewerForm')).toHaveJSProperty('disabled',true);
});
