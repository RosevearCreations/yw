import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,reviewerId,foreignCompanyId}
 from '../fixtures/pms-independent-recheck-463.mjs';
const src=readFileSync('js/pms-independent-recheck-463.js','utf8'),css=readFileSync('style.css','utf8');
async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1100:390,height:844});
 await page.goto('about:blank');await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const actor=opts.reviewer?reviewerId:ownerId;
 const f=fixture({now:Date.now(),assigned:opts.assigned||opts.reviewer,reviewed:opts.reviewed,viewer:actor,off:opts.off});
 if(opts.foreign)f.view.viewer_id=foreignCompanyId;
 await page.evaluate(({f,actor,companyId,opts})=>{
  window.__writes=[];window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  const ok=data=>({data,error:null});window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_recheck_inbox_463')return ok(f.inbox);
    if(name==='ywi_rpc_recheck_workspace_463')return ok(f.view);
    if(name==='ywi_rpc_assign_recheck_463'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'denied assignment'}};
     const row={id:args.p_operation_id,company_id:companyId,evidence_outcome_id:args.p_evidence_outcome_id,
      owner_user_id:actor,reviewer_user_id:args.p_reviewer_user_id,source_reference:args.p_source_reference,created_at:new Date().toISOString()};
     f.view.assignments.push(row);f.view.assignment_total++;return ok({id:row.id,company_id:companyId,recorded:true,field_accepted:false,
      service_authorized:false,independent_reapproval:false,release_green:false,outbound_actions:false});
    }
    if(name==='ywi_rpc_record_recheck_463'){
     window.__writes.push({name,args});if(opts.writeDenied)return {data:null,error:{message:'denied finding'}};
     const row={id:args.p_operation_id,company_id:companyId,assignment_id:args.p_assignment_id,reviewer_user_id:actor,
      disposition:args.p_disposition,source_reference:args.p_source_reference,created_at:new Date().toISOString()};
     f.view.rechecks.push(row);f.view.recheck_total++;return ok({id:row.id,company_id:companyId,recorded:true,field_accepted:false,
      service_authorized:false,independent_reapproval:false,release_green:false,outbound_actions:false});
    }
    return {data:null,error:{message:'unsupported function'}};
   },from(){window.__writes.push({name:'forbidden direct table access'});return {};}};
 },{f,actor,companyId,opts});
 await page.addScriptTag({content:src});await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#recheck463 > summary').click();await page.locator('#pms463Refresh').click();
}
test('mobile owner verifies original received evidence and sees HOLD without writes',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms463Status')).toContainText('SOURCE VERIFIED: 1 received evidence chains');
 await expect(page.locator('#pms463OwnerForm')).toHaveJSProperty('disabled',false);
 await expect(page.locator('#pms463ReviewerForm')).toHaveJSProperty('disabled',true);
 await expect(page.locator('#pms463Hold')).toContainText('HOLD');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms463Refresh').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
test('owner can record one non-dispatch independent reviewer assignment',async({page})=>{
 await setup(page);await page.locator('#pms463Source').selectOption({index:1});
 await page.locator('#pms463Reviewer').fill(reviewerId);await page.locator('#pms463OwnerRef').fill('INDEPENDENT-OWNER-HANDOFF-SOURCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms463Assign').click();
 await expect(page.locator('#pms463Status')).toContainText('1 separate reviewer assignments');
 await expect(page.locator('#pms463OwnerForm')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);expect(writes[0].name).toBe('ywi_rpc_assign_recheck_463');
 await expect(page.locator('#pms463Hold')).toContainText('not evidence certification');
});
test('third-party reviewer records documentary outcome without authorizing work',async({page})=>{
 await setup(page,{reviewer:true});await expect(page.locator('#pms463OwnerForm')).toHaveJSProperty('disabled',true);
 await page.locator('#pms463Assignment').selectOption({index:1});
 await page.locator('#pms463Disposition').selectOption('evidence_incomplete');
 await page.locator('#pms463ReviewerRef').fill('REVIEWER-SOURCE-COMPARISON-REFERENCE');
 page.once('dialog',d=>d.accept());await page.locator('#pms463Record').click();
 await expect(page.locator('#pms463Status')).toContainText('1 documentary findings');
 await expect(page.locator('#pms463Journal')).toContainText('evidence incomplete');
 const writes=await page.evaluate(()=>window.__writes);expect(writes).toHaveLength(1);expect(writes[0].name).toBe('ywi_rpc_record_recheck_463');
});
test('identity, company, permission and OFF-service changes fail closed',async({page})=>{
 for(const opts of [{foreign:true},{noJobs:true},{signedOut:true},{off:true}]){
  await setup(page,opts);
  if(opts.off)await expect(page.locator('#pms463OwnerForm')).toHaveJSProperty('disabled',true);
  else await expect(page.locator('#pms463Status')).toContainText('WITHHELD');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
