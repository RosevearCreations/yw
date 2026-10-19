import {test,expect} from '@playwright/test';import fs from 'node:fs';
const script=fs.readFileSync('js/material-equipment-first-job-trace-411.js','utf8');
const now=()=>new Date().toISOString();
const row=(p={})=>({estimate_id:'est-1',estimate_number:'EST-411',first_work_order_id:'wo-1',
first_work_order_number:'WO-411',planned_material_lines:1,issued_material_lines:1,
unmatched_material_lines:0,material_issues_with_field_receipt:1,
material_lines:[{planned_line_id:'line-1',planned_quantity:5,issued_quantity:3,
verified_field_receipt_lines:1,issue_line_count:1}],material_line_cap:false,
planned_equipment_lines:1,equipment_checkout_count:1,equipment_checkout_with_field_receipt:1,
equipment_plan_matches:1,equipment_current_lockout:false,trace_state:'field_linked_receipts_recorded',...p});
const response=(p={})=>({ok:true,scope:'material_equipment_first_job_trace',trace_411:{
state:'recorded',complete:true,retrieved_at:now(),records:[row()],...p}});
async function boot(page,data){
await page.setViewportSize({width:390,height:840});
await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
await page.evaluate(d=>{window.__reads=0;window.__writes=0;window.YWIAPI={
loadAdminDirectory:async({scope})=>{if(scope!=='material_equipment_first_job_trace')throw Error('wrong scope');window.__reads++;return structuredClone(d);},
manageAdminEntity:()=>{window.__writes++;throw Error('forbidden');}};},data);
await page.addScriptTag({content:script});
await page.locator('#materialEquipment411 summary').click();
await page.locator('#materialEquipment411Recheck').click();
}
test('field-linked receipts distinguish plan, issue and equipment checkout',async({page})=>{
await boot(page,response());
const el=page.locator('[data-material411-state="recorded"]');
await expect(el).toContainText('WO-411');
await expect(el).toContainText('planned 5, issued 3');
await expect(el).toContainText('field-linked checkout(s)');
expect(await page.evaluate(()=>window.__writes)).toBe(0);
expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('lockout and issues without field capture never claim verified use',async({page})=>{
await boot(page,response({records:[row({trace_state:'safety_lockout_hold',equipment_current_lockout:true}),
row({trace_state:'issue_or_checkout_only',material_issues_with_field_receipt:0,equipment_checkout_with_field_receipt:0})]}));
await expect(page.locator('[data-material411-state="held"]')).toHaveCount(2);
await expect(page.locator('[data-material411-state="held"]').first()).toContainText('locked out');
});
test('capped, stale and no-record sources fail safely',async({page})=>{
await boot(page,response({state:'withheld',complete:false,records:[],reason:'cap'}));
await expect(page.locator('[data-material411-state="withheld"]')).toBeVisible();
await page.evaluate(r=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(r),response({retrieved_at:'2026-01-01T00:00:00Z'}));
await page.locator('#materialEquipment411Recheck').click();
await expect(page.locator('[data-material411-state="withheld"]')).toBeVisible();
await page.evaluate(r=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(r),response({state:'no_record',records:[]}));
await page.locator('#materialEquipment411Recheck').click();
await expect(page.locator('[data-material411-state="no_record"]')).toBeVisible();
});
test('escape untrusted work-order identifiers',async({page})=>{
await boot(page,response({records:[row({first_work_order_number:'<img src=x onerror=alert(1)>'})]}));
await expect(page.locator('[data-material411-state="recorded"]')).toContainText('<img src=x onerror=alert(1)>');
await expect(page.locator('[data-material411-state="recorded"] img')).toHaveCount(0);
});
