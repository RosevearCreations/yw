import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const ui=fs.readFileSync('js/estimate-first-work-order-trace-408.js','utf8');
const now=()=>new Date().toISOString();
const fixture=(patch={})=>({ok:true,scope:'estimate_first_work_order_trace',
 trace_408:{state:'recorded',complete:true,retrieved_at:now(),records:[
  {estimate_id:'est-A',estimate_number:'EST-001',customer_acceptance_state:'dated_quote_acceptance_recorded',customer_accepted_at:now(),
   internal_approval_state:'dated_internal_approval_recorded',internal_approved_at:now(),first_work_order_state:'first_work_order_recorded',
   first_work_order_id:'wo-A',first_work_order_number:'WO-001',first_work_order_created_at:now(),trace_state:'fully_traced'}
 ],...patch}});
async function boot(page,payload){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(data=>{
  window.__reads=0;window.__writes=0;
  window.YWIAPI={loadAdminDirectory:async()=>{window.__reads++;return structuredClone(data)},manageOperations:async()=>{window.__writes++;throw Error('No write permitted')}};
 },payload);
 await page.addScriptTag({content:ui});
 await page.locator('#estimate408 summary').click();
 await page.locator('#estimate408Recheck').click();
}
test('dated acceptance, approval and first work order render on phone without writes',async({page})=>{
 await boot(page,fixture());
 await expect(page.locator('[data-estimate408-state="fully_traced"]')).toContainText('WO-001');
 await expect(page.locator('[data-estimate408-state="fully_traced"]')).toContainText('Dated internal approval recorded');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.locator('#estimate408Recheck').click();
 await expect.poll(()=>page.evaluate(()=>window.__reads)).toBe(2);
});
test('status-only acceptance and missing internal approval remain held',async({page})=>{
 const source=fixture();source.trace_408.records[0].customer_acceptance_state='customer_acceptance_not_verified';
 source.trace_408.records[0].internal_approval_state='internal_approval_not_verified';
 source.trace_408.records[0].trace_state='hold_for_review';
 await boot(page,source);
 await expect(page.locator('[data-estimate408-state="held"]')).toContainText('Not verified — HOLD');
 await expect(page.locator('[data-estimate408-state="fully_traced"]')).toHaveCount(0);
});
test('failed or stale canonical source withholds trace',async({page})=>{
 await boot(page,fixture({state:'withheld',complete:false,records:[],reason:'Capped source'}));
 await expect(page.locator('[data-estimate408-state="withheld"]')).toBeVisible();
 const old=fixture({retrieved_at:'2026-01-01T00:00:00Z'});
 await page.evaluate(d=>{window.YWIAPI.loadAdminDirectory=async()=>structuredClone(d)},old);
 await page.locator('#estimate408Recheck').click();
 await expect(page.locator('[data-estimate408-state="withheld"]')).toBeVisible();
});
test('complete empty source does not invent accepted estimates',async({page})=>{
 await boot(page,fixture({state:'no_record',records:[]}));
 await expect(page.locator('[data-estimate408-state="no_record"]')).toContainText('No accepted estimate');
});