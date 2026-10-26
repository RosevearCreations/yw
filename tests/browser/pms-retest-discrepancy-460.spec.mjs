import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,reviewerId,independentId,foreignCompanyId,triageId}
 from '../fixtures/pms-retest-discrepancy-460.mjs';
const src=readFileSync('js/pms-retest-discrepancy-460.js','utf8'),css=readFileSync('style.css','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1100:390,height:844});
 await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const uid=options.reviewer?independentId:ownerId;
 const d=fixture({now:Date.now(),viewer:uid,triaged:!!options.triaged,
  reviewed:!!options.reviewed,gap:!!options.gap,matched:!!options.matched,
  off:!!options.off,empty:!!options.empty});
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
    if(name==='ywi_rpc_discrepancy_inbox_460')return ok(d.inbox);
    if(name==='ywi_rpc_discrepancy_queue_460')return ok(d.view);
    if(name==='ywi_rpc_triage_retest_discrepancy_460'){
     window.__writes.push({name,args});
     if(options.writeDenied)return {data:null,error:{message:'owner denied'}};
     d.view.triages.push({id:args.p_request_id,company_id:companyId,comparison_id:args.p_comparison_id,
      reassessor_user_id:args.p_reassessor_user_id,triage_kind:args.p_triage_kind,
      source_reference:args.p_source_reference,notes:args.p_notes,created_at:new Date().toISOString()});
     d.view.triage_total++;return ok({id:args.p_request_id,company_id:companyId,recorded:true,
      independent_reapproval:false,field_accepted:false,service_authorized:false,outbound_actions:false});
    }
    if(name==='ywi_rpc_reassess_retest_discrepancy_460'){
     window.__writes.push({name,args});
     if(options.writeDenied)return {data:null,error:{message:'reviewer denied'}};
     d.view.reassessments.push({id:args.p_request_id,company_id:companyId,triage_id:args.p_triage_id,
      outcome:args.p_outcome,source_reference:args.p_source_reference,notes:args.p_notes,
      created_at:new Date().toISOString()});d.view.reassessment_total++;
     return ok({id:args.p_request_id,company_id:companyId,recorded:true,
      independent_reapproval:false,field_accepted:false,service_authorized:false,outbound_actions:false});
    }
    return {data:null,error:{message:'unknown RPC'}};
   },from(){window.__writes.push('forbidden direct table write');return {};}};
 },{d,options,uid,companyId,foreignCompanyId});
 await page.addScriptTag({content:src});await page.locator('#discrepancy460 > summary').click();
 await page.locator('#pms460Refresh').click();
}
test('mobile owner sees only genuine discrepancies and an immutable HOLD with keyboard access',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms460Status')).toContainText('SOURCE VERIFIED: 1 genuine');
 await expect(page.locator('#pms460OwnerForm')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms460ReviewerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms460Release')).toContainText('HOLD');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms460Refresh').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await expect(page.locator('a[href="/help.html#pms-retest-discrepancy-460"]')).toHaveCount(1);
 await page.locator('#pms460Company').focus();await page.keyboard.press('Tab');
 expect(await page.locator('#pms460Refresh').evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('owner assigns only unmatched evidence to a third separate reassessor',async({page})=>{
 await setup(page);
 await page.locator('#pms460Case').selectOption({index:1});
 await page.locator('#pms460Reassessor').fill(independentId);
 await page.locator('#pms460Kind').selectOption('investigate_difference');
 await page.locator('#pms460OwnerReference').fill('TRIAGE-ACTUAL-459-DIFFERENCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms460Triage').click();
 await expect(page.locator('#pms460Status')).toContainText('SOURCE VERIFIED:');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_triage_retest_discrepancy_460');
 expect(writes[0].args.p_reassessor_user_id).toBe(independentId);
 await expect(page.locator('#pms460Release')).toContainText('HOLD');
});
test('self or original comparing reviewer cannot receive reassessment',async({page})=>{
 await setup(page);
 await page.locator('#pms460Case').selectOption({index:1});
 await page.locator('#pms460OwnerReference').fill('TRIAGE-SOURCE');
 for(const invalid of [ownerId,reviewerId]){
  await page.locator('#pms460Reassessor').fill(invalid);
  await page.locator('#pms460Triage').click();
  await expect(page.locator('#pms460Status')).toContainText('WITHHELD');
 }
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('separate assigned reviewer records a source-linked, outcome-matched review',async({page})=>{
 await setup(page,{reviewer:true,triaged:true});
 await expect(page.locator('#pms460OwnerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms460ReviewerForm')).toHaveJSProperty('disabled',false);
 await page.locator('#pms460TriageSelect').selectOption(triageId);
 await page.locator('#pms460Outcome').selectOption('difference_confirmed');
 await page.locator('#pms460ReviewerReference').fill('ACTUAL-THIRD-PARTY-REVIEW');
 page.once('dialog',d=>d.accept());await page.locator('#pms460Reassess').click();
 await expect(page.locator('#pms460Journal .pms460-entry')).toContainText('Independent finding: difference confirmed');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_reassess_retest_discrepancy_460');
 expect(writes[0].args.p_triage_id).toBe(triageId);
 await expect(page.locator('#pms460Release')).toContainText('HOLD');
});
test('mismatched reviewer outcome is rejected before mutation',async({page})=>{
 await setup(page,{reviewer:true,triaged:true,gap:true});
 await page.locator('#pms460TriageSelect').selectOption(triageId);
 await page.locator('#pms460Outcome').selectOption('difference_confirmed');
 await page.locator('#pms460ReviewerReference').fill('GAP-INVALID-OUTCOME');
 await page.locator('#pms460Reassess').click();
 await expect(page.locator('#pms460Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('no real company, matched results, foreign tenant or unauthorized identity cannot post',async({page})=>{
 for(const option of [{empty:true},{matched:true},{foreignTenant:true},
  {badAuth:true},{signedOut:true},{denied:true},{noJobs:true},{off:true}]){
  await setup(page,option);
  await expect(page.locator('#pms460OwnerForm')).toHaveJSProperty('disabled',true);
  await expect(page.locator('#pms460ReviewerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('denied write never auto-retries; identity change invalidates review state',async({page})=>{
 await setup(page,{reviewer:true,triaged:true,writeDenied:true});
 await page.locator('#pms460TriageSelect').selectOption(triageId);
 await page.locator('#pms460Outcome').selectOption('difference_confirmed');
 await page.locator('#pms460ReviewerReference').fill('REVIEWER-SOURCE-DENIED');
 page.once('dialog',d=>d.accept());await page.locator('#pms460Reassess').click();
 await expect(page.locator('#pms460Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#pms460ReviewerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
});
