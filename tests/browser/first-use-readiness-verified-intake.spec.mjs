import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
const now=()=>new Date().toISOString();
const keys=['crm_customers','crm_properties','crews','equipment','jobs','dispatch','production','recurring_visits'];
function response(){
 const fresh=Object.fromEntries(keys.map(key=>[key,{source_key:key,retrieved_at:now(),row_count:3,query_limit:500,coverage_gap:false,coverage_state:'within_query_limit',freshness_state:'current',reason:'Current canonical records'}]));
 fresh.crm_customers={...fresh.crm_customers,row_count:0,coverage_state:'no_rows',freshness_state:'missing',reason:'No authoritative source rows'};
 return {ok:true,source_visibility:{jobs:true,admin:false,finance:false,safety:false},source_freshness:fresh,management_metric_confidence:{}};
}
async function boot(page,data=response()){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(payload=>{window.__calls=0;window.__writes=0;window.YWIRouter={showSection:s=>window.__route=s};window.YWIAdminHub={open:s=>window.__group=s};window.YWIAPI={loadAdminDirectory:async()=>{window.__calls++;return payload}};},data);
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
 await expect(page.locator('#owner391Readiness [data-owner391-source="crm_customers"]')).toBeVisible();
}
test('Build 391 phone first-use data presence distinguishes recorded, verified empty and no automatic writes',async({page})=>{
 await boot(page);
 const host=page.locator('#owner391Readiness');
 await expect(host.locator('[data-owner391-source]')).toHaveCount(8);
 await expect(host.locator('[data-owner391-source="crm_customers"]')).toContainText('Verified empty — needs intake');
 await expect(host.locator('[data-owner391-source="crm_properties"]')).toContainText('Records present');
 await expect(host).toContainText('Four-season scope');
 await host.locator('[data-owner391-source="crm_customers"] button').click();
 await expect.poll(()=>page.evaluate(()=>window.__route)).toBe('jobs');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await expect(page.locator('#owner391Readiness input,#owner391Readiness select,#owner391Readiness textarea')).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>window.__writes)).toBe(0);
});
test('Build 391 failed/capped/stale sources never masquerade as empty',async({page})=>{
 const d=response();d.source_freshness.crm_customers={...d.source_freshness.crm_customers,coverage_state:'query_failed',freshness_state:'source_error'};
 d.source_freshness.crm_properties={...d.source_freshness.crm_properties,coverage_state:'possibly_capped',coverage_gap:true};
 d.source_freshness.dispatch={...d.source_freshness.dispatch,freshness_state:'stale'};
 await boot(page,d);
 await expect(page.locator('[data-owner391-source="crm_customers"]')).toContainText('Source query failed');
 await expect(page.locator('[data-owner391-source="crm_properties"]')).toContainText('Query limit — incomplete');
 await expect(page.locator('[data-owner391-source="dispatch"]')).toContainText('Needs evidence recheck');
 await expect(page.locator('[data-owner391-state="needs_intake"]')).toHaveCount(0);
});
test('Build 391 hides all operational counts when Jobs permission is unavailable',async({page})=>{
 const d=response();d.source_visibility.jobs=false;
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(payload=>{window.YWIAPI={loadAdminDirectory:async()=>payload}},d);
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
 await expect(page.locator('#owner391Readiness')).toContainText('Jobs / Business & Operations view permission is required');
 await expect(page.locator('[data-owner391-source]')).toHaveCount(0);
});
test('Build 391 Refresh rechecks source and is locked during in-flight request',async({page})=>{
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(payload=>{
  window.__calls=0;window.__release=null;
  window.YWIAPI={loadAdminDirectory:async()=>{window.__calls++;
    if(window.__calls===2)return await new Promise(resolve=>window.__release=()=>resolve(payload));
    return payload}};
 },response());
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
 await expect(page.locator('#owner391Readiness')).toContainText('Verified empty — needs intake');
 await page.locator('#owner350Refresh').click();
 await expect(page.locator('#owner350Refresh')).toBeDisabled();
 await expect(page.locator('#owner350Refresh')).toHaveText('Checking…');
 await page.evaluate(()=>window.__release());
 await expect(page.locator('#owner350Refresh')).toBeEnabled();
 await expect(page.locator('#owner350Refresh')).toHaveText('Refresh');
 expect(await page.evaluate(()=>window.__calls)).toBe(2);
});
