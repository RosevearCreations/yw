import {test, expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/workability-safe-schedule-recheck.js','utf8');
async function boot(page,{safety='approve',decision='workable',status='scheduled',incomplete=false}={}){
  await page.setContent('<!doctype html><html><body><section id="admin"><section id="weatherWorkability342"><p id="wk342Status"></p></section></section></body></html>');
  await page.evaluate(({safety,decision,status,incomplete})=>{
    window.__writes=[];
    window.YWISecurity={getModulePermissionState:()=>({loaded:true,permissions:{safety}})};
    const observed=new Date(Date.now()-60*60*1000).toISOString();
    const scheduled=new Date(Date.now()+60*60*1000).toISOString();
    const finish=new Date(Date.now()+3*60*60*1000).toISOString();
    window.YWIAPI={
      loadAdminDirectory:async options=>({
        ok:true,scope:'workability',
        workability_dispatch:[{id:'dispatch-1',work_order_number:'WO-3',scheduled_start:scheduled,scheduled_end:finish,schedule_status:status}],
        workability_queue:[{id:'weather-1',observation_code:'WK-3',dispatch_schedule_item_id:'dispatch-1',service_date:observed.slice(0,10),observed_at:observed,weather_condition:'Ontario winter ice',latest_decision_id:'decision-1',linked_hse_packet_id:'hse-1'}],
        workability_decisions:[{id:'decision-1',observation_id:'weather-1',decision_state:decision,decision_at:new Date().toISOString(),decided_by_profile_id:'supervisor-1'}],
        workability_hse_packets:[{id:'hse-1',packet_number:'HSE-3',weather_monitoring_required:true,weather_monitoring_completed:!incomplete}]
      }),
      manageOperations:async payload=>{window.__writes.push(payload);throw Error('No write expected')}
    };
  },{safety,decision,status,incomplete});
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIWorkabilitySafeScheduleRecheck.mount(document.getElementById('weatherWorkability342'),{api:window.YWIAPI}));
  await page.click('#wk395Recheck');
}
test('Build 395 requires an explicit human recheck, never auto-dispatches',async({page})=>{
  await boot(page);
  await expect(page.locator('#wk395Status')).toContainText('operator must still authorize dispatch');
  await expect(page.locator('#wk395Findings')).toContainText('workable');
  expect(await page.evaluate(()=>window.__writes.length)).toBe(0);
});
test('Build 395 does not bypass Safety access',async({page})=>{
  await boot(page,{safety:'view'});
  await expect(page.locator('#wk395Status')).toContainText('HOLD');
  await expect(page.locator('#wk395Findings')).toContainText('Safety approve permission');
});
test('Build 395 holds postponed work and incomplete HSE monitoring',async({page})=>{
  await boot(page,{decision:'postpone',incomplete:true});
  await expect(page.locator('#wk395Status')).toContainText('HOLD');
  await expect(page.locator('#wk395Findings')).toContainText('postpone');
  await expect(page.locator('#wk395Findings')).toContainText('monitoring is incomplete');
  expect(await page.evaluate(()=>window.__writes.length)).toBe(0);
});
test('Build 395 cannot clear an existing dispatch hold',async({page})=>{
  await boot(page,{status:'on_hold'});
  await expect(page.locator('#wk395Status')).toContainText('HOLD');
  await expect(page.locator('#wk395Findings')).toContainText('schedule status is a hold');
});
