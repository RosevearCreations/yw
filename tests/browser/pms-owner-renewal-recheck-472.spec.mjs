import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,alternativeId,foreignCompanyId} from '../fixtures/pms-owner-renewal-recheck-472.mjs';

const scripts=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js',
 'js/pms-reassessment-continuity-470.js','js/pms-continuity-exception-owner-471.js',
 'js/pms-owner-renewal-recheck-472.js'].map(file=>readFileSync(file,'utf8'));
const css=readFileSync('style.css','utf8');

async function setup(page,opts={}){
 await page.setViewportSize({width:opts.desktop?1120:390,height:844});
 await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const f=fixture({ownerDays:opts.ownerDays??15,reviewer:opts.reviewer,reviewed:opts.reviewed,
  off:opts.off,noRequest:opts.noRequest});
 const actor=opts.reviewer?alternativeId:ownerId;
 await page.evaluate(({f,actor,companyId,foreignCompanyId,opts})=>{
  window.__writes=[];const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:actor},role:'admin'})};
  window.YWISecurity={canViewModule:()=>!opts.noJobs};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:actor}})},
   from:()=>{window.__writes.push({name:'forbidden direct table'});return {};},
   rpc:async(name,args)=>{
    if(opts.denied)return {data:null,error:{message:'permission denied'}};
    if(name==='ywi_rpc_handoff_inbox_465')return ok(f.inbox);
    if(name==='ywi_rpc_recheck_workspace_472')return ok(opts.foreign?{...f.view,company_id:foreignCompanyId}:
     opts.badAging?{...f.view,recheck_aging:[{...f.view.recheck_aging[0],age_days:999}]}:f.view);
    if(name==='ywi_rpc_reviewer_recheck_472'){
     window.__writes.push({name,args});
     if(opts.writeDenied)return {data:null,error:{message:'permission denied'}};
     const recorded=new Date().toISOString();
     f.view.captured_at=f.view.aging_as_of=f.view.renewal_as_of=
      f.view.reassessment_as_of=f.view.continuity_as_of=f.view.exception_as_of=f.view.recheck_as_of=recorded;
     f.view.handoff_source.captured_at=recorded;
     const receipt={id:args.p_operation_id,company_id:companyId,owner_renewal_id:args.p_owner_renewal_id,
      reviewer_user_id:actor,disposition:args.p_disposition,source_reference:args.p_source_reference,created_at:recorded};
     f.view.assignment_reviews.push(receipt);f.view.assignment_review_total++;
     const aging=(row,created)=>{row.age_days=Math.max(0,Math.floor((Date.parse(recorded)-Date.parse(created))/86400000));
      row.band=row.age_days>=15?'overdue':row.age_days>=8?'aging':'current';};
     aging(f.view.aging[0],f.followup.created_at);
     aging(f.view.renewal_aging[0],f.renewal.created_at);
     aging(f.view.reassessment_aging[0],f.reassessment.created_at);
     aging(f.view.exception_aging[0],f.confirmation.created_at);
     aging(f.view.recheck_aging[0],f.ownerRenewal.created_at);
     return ok({id:args.p_operation_id,company_id:companyId,recorded:true,field_accepted:false,
      service_authorized:false,independent_reapproval:false,reassignment_executed:false,
      release_green:false,outbound_actions:false});
    }
    return {data:null,error:{message:'unrecognized RPC'}};
   }};
 },{f,actor,companyId,foreignCompanyId,opts});
 for(const src of scripts)await page.addScriptTag({content:src});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.locator('#recheck472 > summary').click();
 await page.locator('#pms472Refresh').click();
}

test('a genuine owner recheck request is aged and readable on narrow mobile without overflow',async({page})=>{
 await setup(page,{ownerDays:15,reviewer:true});
 await expect(page.locator('#pms472Status')).toContainText('1 overdue (15+ days)');
 await expect(page.locator('#pms472Journal')).toContainText('OVERDUE · 15 full day(s)');
 await expect(page.locator('#pms472ReviewerForm')).toHaveJSProperty('disabled',false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.locator('#pms472Refresh').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});

test('only original independent reviewer records one fresh intake source and retains HOLD',async({page})=>{
 await setup(page,{reviewer:true});
 await page.locator('#pms472Request').selectOption({index:1});
 await page.locator('#pms472Disposition').selectOption('request_owner_source_clarification');
 await page.locator('#pms472Source').fill('REVIEWER-472-NEW-INDEPENDENT-SOURCE');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#pms472Record').click();
 await expect(page.locator('#pms472Status')).toContainText('1 separate reviewer intake receipts');
 await expect(page.locator('#pms472ReviewerForm')).toHaveJSProperty('disabled',true);
 const writes=await page.evaluate(()=>window.__writes);
 expect(writes).toHaveLength(1);
 expect(writes[0].name).toBe('ywi_rpc_reviewer_recheck_472');
 expect(writes[0].args.p_disposition).toBe('request_owner_source_clarification');
 await expect(page.locator('#pms472Hold')).toContainText('not permission to reassign');
});

test('company owner sees the reviewer request but cannot sign independent intake',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms472Status')).toContainText('1 owner recheck requests');
 await expect(page.locator('#pms472ReviewerForm')).toHaveJSProperty('disabled',true);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});

test('already reviewed requests and non-recheck owner decisions do not authorize a second intake',async({page})=>{
 await setup(page,{reviewer:true,reviewed:true});
 await expect(page.locator('#pms472Status')).toContainText('1 separate reviewer intake receipts');
 await expect(page.locator('#pms472ReviewerForm')).toHaveJSProperty('disabled',true);
 await setup(page,{reviewer:true,noRequest:true});
 await expect(page.locator('#pms472Status')).toContainText('0 owner recheck requests');
 await expect(page.locator('#pms472ReviewerForm')).toHaveJSProperty('disabled',true);
});

test('recycled owner documentary reference blocks the write',async({page})=>{
 await setup(page,{reviewer:true});
 await page.locator('#pms472Request').selectOption({index:1});
 await page.locator('#pms472Source').fill('OWNER-471-NEW-DOCUMENT');
 await page.locator('#pms472Record').click();
 await expect(page.locator('#pms472Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});

test('foreign companies, aging drift, missing service, signed-out and access-denied sessions fail closed',async({page})=>{
 for(const opts of [{foreign:true},{badAging:true},{off:true},{signedOut:true},{noJobs:true},{denied:true}]){
  await setup(page,{reviewer:true,...opts});
  await expect(page.locator('#pms472ReviewerForm')).toHaveJSProperty('disabled',true);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
