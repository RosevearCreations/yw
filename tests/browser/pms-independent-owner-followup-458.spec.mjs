import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,foreignCompanyId,decisionId,laterEvidenceId}
 from '../fixtures/pms-independent-owner-followup-458.mjs';
const src457=readFileSync('js/pms-first-service-independent-457.js','utf8');
const src458=readFileSync('js/pms-independent-owner-followup-458.js','utf8');
const css=readFileSync('style.css','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1100:390,height:844});
 await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const data=fixture({now:Date.now(),empty:!!options.empty,off:!!options.off});
 if(options.foreignTenant)data.view.company_id=foreignCompanyId;
 await page.evaluate(({data,options,ownerId,foreignCompanyId,companyId})=>{
  window.__writes=[];window.__calls=[];window.__signedOut=!!options.signedOut;
  window.YWISecurity={canViewModule:key=>key==='jobs'&&!options.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badAuth?foreignCompanyId:ownerId}})},
   rpc:async(name,args)=>{
    window.__calls.push(name);
    if(options.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_reviewer_inbox_457')return ok(data.prior.inbox);
    if(name==='ywi_rpc_first_service_independent_457')return ok(data.prior.view);
    if(name==='ywi_rpc_owner_independent_followup_458')return ok(data.view);
    if(name==='ywi_rpc_append_owner_independent_followup_458'){
     window.__writes.push({name,args});
     if(options.writeDenied)return {data:null,error:{message:'denied append'}};
     const r={id:args.p_request_id,company_id:companyId,
      independent_decision_id:args.p_independent_decision_id,
      disposition:args.p_disposition,followup_evidence_id:args.p_followup_evidence_id,
      source_reference:args.p_source_reference,notes:args.p_notes,
      created_at:new Date().toISOString()};
     data.view.followups.unshift(r);data.view.followup_total++;
     const age=data.view.decision_aging.find(x=>x.id===args.p_independent_decision_id);
     if(age)age.followup_count++;
     data.view.captured_at=new Date().toISOString();data.prior.view.captured_at=new Date().toISOString();
     return ok({id:r.id,company_id:companyId,recorded:true,
      field_accepted:false,service_authorized:false,independent_reapproval:false,outbound_actions:false});
    }
    return {data:null,error:{message:'unexpected RPC'}};
   },from(){window.__writes.push('forbidden direct table write');return {};}};
 },{data,options,ownerId,foreignCompanyId,companyId});
 await page.addScriptTag({content:src457});await page.addScriptTag({content:src458});
 await page.locator('#owner458 > summary').click();await page.locator('#pms458Refresh').click();
}
test('390px mobile owner verifies original decisions, advisory aging, Help and HOLD',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms458Status')).toContainText('SOURCE VERIFIED: 1 actual independent decisions');
 await expect(page.locator('#pms458Form')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms458Release')).toContainText('HOLD');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms458Refresh').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 await expect(page.locator('a[href="/help.html#pms-independent-owner-followup-458"]')).toHaveCount(1);
 await page.locator('#pms458Company').focus();await page.keyboard.press('Tab');
 expect(await page.locator('#pms458Refresh').evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('owner acknowledges exactly the closed independent reviewer source, never service authority',async({page})=>{
 await setup(page);
 await page.locator('#pms458Decision').selectOption(decisionId);
 await page.locator('#pms458Outcome').selectOption('closure_review_acknowledged');
 await page.locator('#pms458Evidence').selectOption(laterEvidenceId);
 await page.locator('#pms458Reference').fill('OWNER-REASSESSMENT-REAL-SOURCE');
 page.once('dialog',dialog=>dialog.accept());await page.locator('#pms458Append').click();
 await expect(page.locator('#pms458Status')).toContainText('SOURCE VERIFIED:');
 await expect(page.locator('#pms458History .pms458-entry')).toHaveCount(1);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_append_owner_independent_followup_458');
 expect(writes[0].args.p_independent_decision_id).toBe(decisionId);
 expect(writes[0].args.p_followup_evidence_id).toBe(laterEvidenceId);
 await expect(page.locator('#pms458Release')).toContainText('HOLD');
});
test('foreign company, unsigned owner, incomplete original and denied grant keep form WITHHELD',async({page})=>{
 for(const options of [{empty:true},{foreignTenant:true},{badAuth:true},
  {denied:true},{signedOut:true},{noJobs:true}]){
  await setup(page,options);await expect(page.locator('#pms458Form')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('newer independent retest is required; denied append never retries and signout invalidates',async({page})=>{
 await setup(page,{writeDenied:true});
 await page.locator('#pms458Decision').selectOption(decisionId);
 await page.locator('#pms458Outcome').selectOption('retest_evidence_ready');
 await page.locator('#pms458Evidence').selectOption(laterEvidenceId);
 await page.locator('#pms458Reference').fill('OWNER-RETEST-SOURCE');
 await page.locator('#pms458Append').click();
 await expect(page.locator('#pms458Status')).toContainText('WITHHELD: retest requires');
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(0);
 await page.locator('#pms458Outcome').selectOption('hold_open');
 page.once('dialog',d=>d.accept());await page.locator('#pms458Append').click();
 await expect(page.locator('#pms458Status')).toContainText('WITHHELD:');
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#pms458Form')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toHaveLength(1);
});
