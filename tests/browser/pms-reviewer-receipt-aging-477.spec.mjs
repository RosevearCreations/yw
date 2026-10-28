import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,companyId,ownerId,alternativeId} from '../fixtures/pms-owner-renewal-reviewer-followup-476.mjs';
const files=['js/pms-independent-handoff-465.js','js/pms-comparison-followup-467.js',
 'js/pms-followup-renewal-468.js','js/pms-renewal-reassessment-469.js','js/pms-reassessment-continuity-470.js',
 'js/pms-continuity-exception-owner-471.js','js/pms-owner-renewal-recheck-472.js',
 'js/pms-review-outcome-owner-clarification-473.js','js/pms-owner-clarification-continuity-474.js',
 'js/pms-continuity-finding-owner-renewal-475.js','js/pms-owner-renewal-reviewer-followup-476.js',
 'js/pms-reviewer-receipt-aging-477.js'];
const css=readFileSync('style.css','utf8');
async function setup(page,options={}){
 await page.setViewportSize({width:390,height:844});
 await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.addStyleTag({content:css});
 const f=fixture({followedUp:!options.pending,renewalDays:16,reviewer:!options.owner});
 const user=options.owner?ownerId:alternativeId;
 await page.evaluate(({f,user,denied})=>{
  window.__writes=[];const ok=data=>({data,error:null});
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:user},role:'admin'})};
  window.YWISecurity={canViewModule:()=>true};
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:user}})},rpc:async(name)=>{
   if(denied)return {data:null,error:{message:'permission denied'}};
   if(name==='ywi_rpc_handoff_inbox_465')return ok(f.inbox);
   if(name==='ywi_rpc_reviewer_renewal_workspace_476')return ok(f.view);
   window.__writes.push(name);return {data:null,error:{message:'unexpected RPC'}};}};
 },{f,user,denied:options.denied});
 for(const file of files)await page.addScriptTag({content:readFileSync(file,'utf8')});
 await page.locator('#receipt477 > summary').click();
}
test('owner reads overdue reviewer receipt and QL-245 stays DISCONNECTED',async({page})=>{
 await setup(page,{owner:true});
 await page.locator('#pms477Refresh').click();
 await expect(page.locator('#pms477Status')).toContainText('SOURCE VERIFIED');
 await expect(page.locator('#pms477Journal')).toContainText('CURRENT');
 await expect(page.locator('#pms477Hold')).toContainText('DISCONNECTED / HOLD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
 expect(overflow).toBe(false);
});
test('pending owner evidence is not mistaken for reviewer approval',async({page})=>{
 await setup(page,{pending:true});await page.locator('#pms477Refresh').click();
 await expect(page.locator('#pms477Journal')).toContainText('still require an original independent reviewer receipt');
});
test('source RPC denial fails closed and does not write',async({page})=>{
 await setup(page,{denied:true});await page.locator('#pms477Refresh').click();
 await expect(page.locator('#pms477Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
