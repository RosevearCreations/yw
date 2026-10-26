import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,foreignCompanyId} from '../fixtures/pms-reassessment-followup-461.mjs';
const prev=readFileSync('js/pms-reassessment-followup-461.js','utf8');
const src=readFileSync('js/pms-evidence-outcomes-462.js','utf8'),css=readFileSync('style.css','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:options.desktop?1100:390,height:844});
 await page.goto('about:blank');await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const f=fixture({now:Date.now(),requested:true,off:options.off});
 const ledger={company_id:companyId,viewer_id:ownerId,is_owner:true,captured_at:new Date().toISOString(),
  outcomes:[],total:0,sample_capped:false,field_accepted:false,service_authorized:false,
  independent_reapproval:false,release_green:false,outbound_actions:false,mutation_authorized:false};
 if(options.foreign)ledger.viewer_id=foreignCompanyId;
 await page.evaluate(({f,ledger,ownerId,companyId,options})=>{
  window.__writes=[];window.YWISecurity={canViewModule:()=>!options.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!options.signedOut,user:{id:ownerId},role:'admin'})};
  const ok=data=>({data,error:null});window.YWI_SB={auth:{getUser:async()=>ok({user:{id:ownerId}})},
   rpc:async(name,args)=>{
    if(name==='ywi_rpc_reassessment_owner_inbox_461')return ok(f.inbox);
    if(name==='ywi_rpc_reassessment_followups_461')return ok(f.view);
    if(name==='ywi_rpc_evidence_outcomes_462')return ok(ledger);
    if(name==='ywi_rpc_record_evidence_outcome_462'){
     window.__writes.push({name,args});if(options.denied)return {error:{message:'denied'}};
     ledger.outcomes.push({id:args.p_operation_id,company_id:companyId,request_id:args.p_request_id,
      owner_user_id:ownerId,outcome:args.p_outcome,source_reference:args.p_source_reference,notes:args.p_notes,created_at:new Date().toISOString()});ledger.total++;
     return ok({id:args.p_operation_id,company_id:companyId,recorded:true,field_accepted:false,service_authorized:false,independent_reapproval:false,release_green:false,outbound_actions:false});
    }return {error:{message:'unsupported'}};
   },from(){window.__writes.push({name:'forbidden-table-write'});return {};}};
 },{f,ledger,ownerId,companyId,options});
 await page.addScriptTag({content:prev});await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#evidence462 > summary').click();await page.locator('#pms462Refresh').click();
}
test('mobile owner request remains HOLD until documentary outcome',async({page})=>{
 await setup(page);await expect(page.locator('#pms462Status')).toContainText('SOURCE VERIFIED: 1 owner requests');
 await expect(page.locator('#pms462Results')).toContainText('Outcome pending');
 await expect(page.locator('#pms462Hold')).toContainText('HOLD');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms462Refresh').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('one owner outcome yields only documentary handoff readiness',async({page})=>{
 await setup(page);await page.locator('#pms462Request').selectOption({index:1});
 await page.locator('#pms462Outcome').selectOption('evidence_received');
 await page.locator('#pms462Reference').fill('ACTUAL-SOURCE-REFERENCE-TO-VERIFY');
 page.once('dialog',d=>d.accept());await page.locator('#pms462Record').click();
 await expect(page.locator('#pms462Status')).toContainText('1 documentary handoffs ready');
 await expect(page.locator('#pms462Results')).toContainText('no approval');
 await expect(page.locator('#pms462Form')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_record_evidence_outcome_462');
});
test('foreign or missing authority and OFF service fail closed',async({page})=>{
 for(const opts of [{foreign:true},{noJobs:true},{signedOut:true},{off:true}]){
  await setup(page,opts);
  if(opts.off)await expect(page.locator('#pms462Form')).toHaveJSProperty('disabled',true);
  else await expect(page.locator('#pms462Status')).toContainText('WITHHELD');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
