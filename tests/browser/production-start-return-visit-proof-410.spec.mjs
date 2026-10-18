import {test,expect} from '@playwright/test';import fs from 'node:fs';
const script=fs.readFileSync('js/production-start-return-visit-proof-410.js','utf8');
const now=()=>new Date().toISOString();
const row=(patch={})=>({
 estimate_id:'estimate-1',estimate_number:'EST-410',first_work_order_id:'work-1',
 first_work_order_number:'WO-410',first_dispatch_id:'dispatch-1',first_scheduled_start:now(),
 production_proof_state:'dated_start_and_field_receipt_recorded',
 first_session_id:'session-1',first_started_at:now(),field_receipt_recorded_at:now(),
 first_session_completion_state:'partial',partial_completion_state:'explicit_partial_evidence_recorded',
 actual_quantity_receipt_count:2,execution_proof_count:1,return_required_state:'return_visit_required_recorded',
 return_visit_state:'return_visit_pending_no_session_receipt',return_session_id:null,return_started_at:null,
 return_field_receipt_at:null,...patch});
const response=(patch={})=>({ok:true,scope:'production_start_return_visit_proof',
 proof_410:{state:'recorded',complete:true,retrieved_at:now(),records:[row()],...patch}});
async function boot(page,payload){
 await page.setViewportSize({width:390,height:840});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(data=>{window.__reads=0;window.__writes=0;
  window.YWIAPI={loadAdminDirectory:async()=>{window.__reads++;return structuredClone(data)},
   manageOperations:async()=>{window.__writes++;throw Error('writes not permitted')}};
 },payload);
 await page.addScriptTag({content:script});
 await page.locator('#production410 summary').click();await page.locator('#production410Recheck').click();
}
test('actual started session and field receipt, partial work and pending return, no writes',async({page})=>{
 await boot(page,response());
 const x=page.locator('[data-production410-state="verified"]');
 await expect(x).toContainText('WO-410');
 await expect(x).toContainText('Dated production start');
 await expect(x).toContainText('Explicit partial/unfinished work');
 await expect(x).toContainText('Return required; no actual dated return receipt yet');
 await expect(x).toContainText('Actual quantity lines: 2');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.locator('#production410Recheck').click();await expect.poll(()=>page.evaluate(()=>window.__reads)).toBe(2);
});
test('later return counts only with dated return start and separate field receipt',async({page})=>{
 await boot(page,response({records:[row({return_visit_state:'dated_return_visit_receipt_recorded',return_session_id:'session-2',return_started_at:now(),return_field_receipt_at:now()})]}));
 await expect(page.locator('[data-production410-state="verified"]')).toContainText('Actual dated return start');
});
test('schedule only and start without field receipt cannot be verified completion',async({page})=>{
 await boot(page,response({records:[row({production_proof_state:'no_started_session',first_started_at:null,field_receipt_recorded_at:null,partial_completion_state:'not_assessed',actual_quantity_receipt_count:0})]}));
 await expect(page.locator('[data-production410-state="held"]')).toContainText('No actual started session recorded');
 await expect(page.locator('[data-production410-state="verified"]')).toHaveCount(0);
 await page.evaluate(x=>{window.YWIAPI.loadAdminDirectory=async()=>structuredClone(x)},response({records:[row({production_proof_state:'started_at_without_field_receipt',field_receipt_recorded_at:null})]}));
 await page.locator('#production410Recheck').click();await expect(page.locator('[data-production410-state="held"]')).toContainText('field receipt NOT verified');
});
test('capped, stale and no-record sources never fabricate completed work',async({page})=>{
 await boot(page,response({state:'withheld',complete:false,reason:'source capped',records:[]}));
 await expect(page.locator('[data-production410-state="withheld"]')).toBeVisible();
 await page.evaluate(x=>{window.YWIAPI.loadAdminDirectory=async()=>structuredClone(x)},response({retrieved_at:'2026-01-01T00:00:00Z'}));
 await page.locator('#production410Recheck').click();await expect(page.locator('[data-production410-state="withheld"]')).toBeVisible();
 await page.evaluate(x=>{window.YWIAPI.loadAdminDirectory=async()=>structuredClone(x)},response({state:'no_record',records:[]}));
 await page.locator('#production410Recheck').click();await expect(page.locator('[data-production410-state="no_record"]')).toBeVisible();
});