import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,reviewerId,alternativeId,foreignCompanyId} from '../fixtures/pms-recheck-discrepancy-464.mjs';
const src=readFileSync('js/pms-recheck-discrepancy-464.js','utf8');
const prior=readFileSync('js/pms-independent-recheck-463.js','utf8');
const css=readFileSync('style.css','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1100:390,height:844});await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});const f=fixture({now:Date.now(),reviewed:opts.reviewed,off:opts.off});
 if(opts.foreign)f.view.viewer_id=foreignCompanyId;
 await page.evaluate(({f,opts,companyId,ownerId})=>{
  window.__writes=[];window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:ownerId},role:'admin'})};
  const ok=data=>({data,error:null});window.YWI_SB={auth:{getUser:async()=>ok({user:{id:ownerId}})},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_recheck_inbox_463')return ok(f.inbox);
    if(name==='ywi_rpc_discrepancy_workspace_464')return ok(f.view);
    if(name==='ywi_rpc_review_discrepancy_464'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'denied review'}};
     const row={id:args.p_operation_id,company_id:companyId,recheck_outcome_id:args.p_recheck_outcome_id,owner_user_id:ownerId,
      decision:args.p_decision,proposed_reviewer_user_id:args.p_proposed_reviewer_user_id,source_reference:args.p_source_reference,
      created_at:new Date().toISOString()};f.view.reviews.push(row);f.view.review_total++;f.view.captured_at=row.created_at;
     return ok({id:row.id,company_id:companyId,recorded:true,field_accepted:false,service_authorized:false,
      independent_reapproval:false,reassignment_executed:false,release_green:false,outbound_actions:false});
    }
    return {data:null,error:{message:'unsupported function'}};
   },from(){window.__writes.push({name:'forbidden direct table read'});return {};}};
 },{f,opts,companyId,ownerId});
 await page.addScriptTag({content:prior});await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#discrepancy464 > summary').click();await page.locator('#pms464Refresh').click();
}
test('mobile owner verifies real discrepancy and sees HOLD without writes',async({page})=>{
 await setup(page);await expect(page.locator('#pms464Status')).toContainText('SOURCE VERIFIED: 1 independent discrepancies');
 await expect(page.locator('#pms464OwnerForm')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms464Hold')).toContainText('never executed');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms464Refresh').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('owner records clarification only; does not reassign',async({page})=>{
 await setup(page);await page.locator('#pms464Outcome').selectOption({index:1});
 await page.locator('#pms464Decision').selectOption('request_clarification');
 await page.locator('#pms464Source').fill('SOURCE-CORRECTION-REQUIRED');page.once('dialog',d=>d.accept());
 await page.locator('#pms464Record').click();await expect(page.locator('#pms464Status')).toContainText('1 immutable owner follow-ups');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);expect(writes[0].name).toBe('ywi_rpc_review_discrepancy_464');
 expect(writes[0].args.p_proposed_reviewer_user_id).toBeNull();
});
test('owner may propose distinct reviewer but never dispatch assignment',async({page})=>{
 await setup(page);await page.locator('#pms464Outcome').selectOption({index:1});
 await page.locator('#pms464Decision').selectOption('propose_reassignment');
 await page.locator('#pms464Reviewer').fill(reviewerId);await page.locator('#pms464Source').fill('INDEPENDENT-CANDIDATE-PROPOSAL');
 await page.locator('#pms464Record').click();expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 await page.locator('#pms464Reviewer').fill(alternativeId);page.once('dialog',d=>d.accept());
 await page.locator('#pms464Record').click();await expect(page.locator('#pms464Journal')).toContainText('propose reassignment');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);
 expect(writes[0].args.p_proposed_reviewer_user_id).toBe(alternativeId);
 expect(writes[0].name).not.toBe('ywi_rpc_assign_recheck_463');
});
test('foreign, signed-out, limited permission and OFF service fail closed',async({page})=>{
 for(const opts of [{foreign:true},{signedOut:true},{noJobs:true},{off:true}]){
  await setup(page,opts);if(opts.off)await expect(page.locator('#pms464OwnerForm')).toHaveJSProperty('disabled',true);
  else await expect(page.locator('#pms464Status')).toContainText('WITHHELD');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
