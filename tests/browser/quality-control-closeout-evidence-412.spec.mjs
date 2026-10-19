import {test,expect} from '@playwright/test';import fs from 'node:fs';
const script=fs.readFileSync('js/quality-control-closeout-evidence-412.js','utf8');
const now=()=>new Date().toISOString(),r=(x={})=>({
 estimate_id:'e',estimate_number:'EST-412',first_work_order_id:'w',first_work_order_number:'WO-412',
 qc_run_id:'q',qc_run_status:'approved',required_item_count:4,required_item_passed_count:4,
 failed_item_count:0,unresolved_deficiency_count:0,qc_reviewed_at:now(),
 closeout_package_id:'c',closeout_approved_at:now(),approved_customer_visible_proof_count:2,
 approved_customer_gallery_asset_count:2,customer_signoff_state:'signed',
 evidence_state:'qc_closeout_proof_verified',...x});
const result=(x={})=>({ok:true,scope:'first_job_quality_closeout_evidence',evidence_412:{
 state:'recorded',complete:true,retrieved_at:now(),records:[r()],...x}});
async function boot(page,data){
 await page.setViewportSize({width:390,height:840});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(d=>{window.__writes=0;window.YWIAPI={loadAdminDirectory:async({scope})=>{
 if(scope!=='first_job_quality_closeout_evidence')throw Error('wrong scope');return structuredClone(d)},
 manageOperations:()=>{window.__writes++;throw Error('No writes')}}},data);
 await page.addScriptTag({content:script});
 await page.locator('#quality412 summary').click();
 await page.locator('#quality412Recheck').click();
}
test('recorded QC approval, closeout and safe gallery evidence',async({page})=>{
 await boot(page,result());const e=page.locator('[data-quality412-state="verified"]');
 await expect(e).toContainText('WO-412');await expect(e).toContainText('4 / 4');
 await expect(e).toContainText('completeness verified');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('planned inspection, missing supervisor approval and media cannot count as completion',async({page})=>{
 await boot(page,result({records:[r({evidence_state:'qc_required_items_incomplete',required_item_passed_count:3}),
 r({evidence_state:'qc_supervisor_approval_missing',qc_reviewed_at:null}),
 r({evidence_state:'customer_safe_proof_incomplete',approved_customer_gallery_asset_count:0})]}));
 await expect(page.locator('[data-quality412-state="held"]')).toHaveCount(3);
 await expect(page.locator('[data-quality412-state="verified"]')).toHaveCount(0);
});
test('capped, stale and no-record QC cannot fabricate signoff',async({page})=>{
 await boot(page,result({state:'withheld',complete:false,reason:'cap',records:[]}));
 await expect(page.locator('[data-quality412-state="withheld"]')).toBeVisible();
 await page.evaluate(d=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(d),result({retrieved_at:'2026-01-01T00:00:00Z'}));
 await page.locator('#quality412Recheck').click();await expect(page.locator('[data-quality412-state="withheld"]')).toBeVisible();
 await page.evaluate(d=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(d),result({state:'no_record',records:[]}));
 await page.locator('#quality412Recheck').click();await expect(page.locator('[data-quality412-state="no_record"]')).toBeVisible();
});
test('escape untrusted QC customer-side reference',async({page})=>{
 await boot(page,result({records:[r({first_work_order_number:'<svg onload=alert(1)>'})]}));
 await expect(page.locator('[data-quality412-state="verified"]')).toContainText('<svg onload=alert(1)>');
 await expect(page.locator('[data-quality412-state="verified"] svg')).toHaveCount(0);
});
