import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const checker=fs.readFileSync('js/first-live-trial-418.js','utf8');
const ui=fs.readFileSync('js/owner-first-live-trial-418.js','utf8');
const at=()=>new Date().toISOString();
function makeRecord(gap=false){const steps=Array.from({length:10},(_,i)=>({handoff:String(406+i),label:'Step '+(406+i),state:'source_verified',reason:null}));
 if(gap)steps[4]={handoff:'410',label:'Start',state:'unresolved',reason:'No actual Production start'};
 return {customer_id:'customer-418',property_id:'property-418',first_work_order_id:'job-418',
 first_order_created_at:at(),work_order_number:'WO-418 <b>',trial_acceptance:'operator_review_required',
 steps,unresolved_count:gap?1:0};}
function response(gap=false){return {ok:true,scope:'owner_first_use_trial_acceptance',acceptance_416:{
 state:'recorded',complete:true,retrieved_at:at(),record_count:1,unresolved_count:gap?1:0,
 records:[makeRecord(gap)],unresolved_gaps:gap?[{customer_id:'customer-418',first_work_order_id:'job-418',handoff:'410',reason:'No actual Production start'}]:[]}};}
async function mount(page,payload){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(v=>{
  window.__copy=null;window.__writes=0;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__copy=t;}}});
  window.YWIAPI={loadAdminDirectory:async ({scope})=>{if(scope!=='owner_first_use_trial_acceptance')throw Error('wrong scope');return structuredClone(v);},
    manageAdminEntity:()=>{window.__writes++;throw Error('write prohibited');}};
 },payload);
 await page.addScriptTag({content:checker});
 await page.addScriptTag({content:ui});
 await page.locator('#owner418 summary').click();
 await page.locator('#owner418Refresh').click();
}
test('real source gaps remain follow-up only, manual copy is not acceptance and phone layout fits',async({page})=>{
 await mount(page,response(true));
 await expect(page.locator('[data-owner418-coverage="first_job_linked_with_gaps"]')).toContainText('GAP — No actual Production start');
 await expect(page.locator('#owner418Results b')).toHaveCount(0);
 await page.locator('#owner418Decision').selectOption('manual_acceptance_candidate');
 await page.locator('#owner418Confirm').check();await page.locator('#owner418Phrase').fill('ACCEPT');
 await expect(page.locator('#owner418Copy')).toBeDisabled();
 await page.locator('#owner418Decision').selectOption('reviewed_with_gaps');
 await expect(page.locator('#owner418Copy')).toBeEnabled();
 await page.locator('#owner418Copy').click();
 const receipt=JSON.parse(await page.evaluate(()=>window.__copy));
 expect(receipt.review_decision).toBe('reviewed_with_gaps');expect(receipt.unresolved_handoffs).toHaveLength(1);
 expect(receipt.warning).toContain('NOT server-stored');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('fully verified first job needs deliberate checkbox and ACCEPT to prepare clipboard candidate',async({page})=>{
 await mount(page,response(false));
 await expect(page.locator('[data-owner418-coverage="fully_source_verified"]')).toBeVisible();
 await page.locator('#owner418Decision').selectOption('manual_acceptance_candidate');
 await expect(page.locator('#owner418Copy')).toBeDisabled();
 await page.locator('#owner418Confirm').check();
 await page.locator('#owner418Phrase').fill('ACCEPT');
 await expect(page.locator('#owner418Copy')).toBeEnabled();
 await page.locator('#owner418Copy').click();
 const receipt=JSON.parse(await page.evaluate(()=>window.__copy));
 expect(receipt.review_decision).toBe('manual_acceptance_candidate');
 expect(receipt.warning).toContain('NOT digitally signed');
});
test('no records, stale sources and denied permission cannot prepare acceptance',async({page})=>{
 const empty={ok:true,scope:'owner_first_use_trial_acceptance',acceptance_416:{state:'no_record',complete:true,
  retrieved_at:at(),record_count:0,unresolved_count:0,records:[],unresolved_gaps:[]}};
 await mount(page,empty);
 await expect(page.locator('[data-owner418-state="no_record"]')).toBeVisible();
 await expect(page.locator('#owner418Review')).toBeHidden();
 await page.evaluate(v=>window.YWIAPI.loadAdminDirectory=async()=>v,
  {...response(false),acceptance_416:{...response(false).acceptance_416,retrieved_at:'2026-01-01T00:00:00Z'}});
 await page.locator('#owner418Refresh').click();
 await expect(page.locator('[data-owner418-state="withheld"]')).toBeVisible();
 await expect(page.locator('#owner418Copy')).toBeDisabled();
 await page.evaluate(()=>window.YWIAPI.loadAdminDirectory=async()=>({ok:false,error:'Forbidden'}));
 await page.locator('#owner418Refresh').click();
 await expect(page.locator('[data-owner418-state="withheld"]')).toBeVisible();
});
