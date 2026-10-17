import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/first-dispatch-schedule-receipt-409.js','utf8');
const now=()=>new Date().toISOString();
const record=(patch={})=>({
 estimate_id:'est-one',estimate_number:'EST-100',
 first_work_order_id:'work-one',first_work_order_number:'WO-100',
 authorization_state:'confirmed_source_authorization',
 schedule_state:'dated_non_cancelled_schedule_recorded',
 first_dispatch_id:'disp-one',scheduled_start:now(),scheduled_end:now(),schedule_status:'scheduled',
 resource_exception_state:'review_required',
 resource_exception_codes:['recorded_resource_conflict','crew_not_assigned'],
 workability_exception_state:'unresolved_workability_exception',
 workability_observation_count:1,...patch
});
const response=(patch={})=>({ok:true,scope:'first_dispatch_schedule_receipt',
 receipt_409:{state:'recorded',complete:true,retrieved_at:now(),records:[record()],...patch}});
async function boot(page,data){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><body><div id="admin"></div></body></html>');
 await page.evaluate(payload=>{
  window.__reads=0;window.__writes=0;
  window.YWIAPI={loadAdminDirectory:async()=>{window.__reads++;return structuredClone(payload)},
    manageOperations:async()=>{window.__writes++;throw Error('No write authority')}};
 },data);
 await page.addScriptTag({content:source});
 await page.locator('#firstDispatch409 summary').click();
 await page.locator('#dispatch409Recheck').click();
}
test('dated noncancelled receipt renders independent resource and weather holds on phone',async({page})=>{
 await boot(page,response());
 const item=page.locator('[data-dispatch409-state="matched"]');
 await expect(item).toContainText('WO-100');
 await expect(item).toContainText('Recorded resource conflict');
 await expect(item).toContainText('Unresolved workability exception');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.locator('#dispatch409Recheck').click();
 await expect.poll(()=>page.evaluate(()=>window.__reads)).toBe(2);
});
test('unverified acceptance or absent schedule never becomes a dispatch receipt',async({page})=>{
 await boot(page,response({records:[record({authorization_state:'approval_evidence_missing',schedule_state:'authorization_hold',
 first_dispatch_id:null,scheduled_start:null,resource_exception_state:'not_assessed',
 resource_exception_codes:[],workability_exception_state:'not_assessed'})]}));
 await expect(page.locator('[data-dispatch409-state="held"]')).toContainText('Approval evidence missing');
 await expect(page.locator('[data-dispatch409-state="matched"]')).toHaveCount(0);
});
test('without weather observation, UI never infers clearance',async({page})=>{
 await boot(page,response({records:[record({resource_exception_state:'no_recorded_exception',
 resource_exception_codes:[],workability_exception_state:'not_observed',workability_observation_count:0})]}));
 await expect(page.locator('[data-dispatch409-state="matched"]')).toContainText('workability not verified');
 await expect(page.locator('[data-dispatch409-state="matched"]')).not.toContainText('Weather safe');
});
test('capped and stale sources withhold, empty sources do not fabricate schedules',async({page})=>{
 await boot(page,response({state:'withheld',complete:false,reason:'Source capped',records:[]}));
 await expect(page.locator('[data-dispatch409-state="withheld"]')).toBeVisible();
 const stale=response({retrieved_at:'2026-01-01T00:00:00Z'});
 await page.evaluate(d=>{window.YWIAPI.loadAdminDirectory=async()=>structuredClone(d)},stale);
 await page.locator('#dispatch409Recheck').click();
 await expect(page.locator('[data-dispatch409-state="withheld"]')).toBeVisible();
 await page.evaluate(d=>{window.YWIAPI.loadAdminDirectory=async()=>structuredClone(d)},response({state:'no_record',records:[]}));
 await page.locator('#dispatch409Recheck').click();
 await expect(page.locator('[data-dispatch409-state="no_record"]')).toBeVisible();
});