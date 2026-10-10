import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const script=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
const fixture={
  state:'current',reason:'Repeating friction requires two dates',
  summary:{observed_route_days:5,hotspot_route_season_groups:1,complete_sequence_route_days:4,sequence_incomplete_route_days:1},
  seasons:[{season_context:'fall',route_days:5,hotspot_route_count:1,sequence_comparable_days:4,
    friction_types:[{type:'sequence_deviation',label:'Recorded stop order differs',affected_route_days:4,eligible_route_days:4,repeated:true,sufficient_sample:false,affected_percent:null}]}],
  hotspots:[{route_name:'East Route',season_context:'fall',repeated_type_count:1,route_days:5,sequence_comparable_days:4,
    route_days_missing_complete_sequence:1,friction_types:[{type:'recorded_delay',label:'Recorded delay',affected_route_days:2,eligible_route_days:5,repeated:true,sufficient_sample:true,affected_percent:40}]}],
  evidence_basis:'Canonical bounded sources only',sequence_boundary:'Incomplete starts unscored',
  outcome_boundary:'No employee ranking',privacy_boundary:'Aggregates only',authority_boundary:'Read-only'
};
async function boot(page,data=fixture,allowed=true){
  await page.setViewportSize({width:390,height:900});
  await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
  await page.evaluate(({payload,jobs})=>{
    window.YWIRouter={showSection:()=>{}};
    window.YWIAdminHub={open:()=>{}};
    window.YWIAPI={loadAdminDirectory:async()=>({
      ok:true,source_visibility:{jobs,finance:false,safety:false,admin:false},
      management_metric_confidence:{},route_stop_sequence_friction_hotspots:payload
    })};
  },{payload:data,jobs:allowed});
  await page.addScriptTag({content:script});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner379Hotspots')).toBeVisible();
}
test('mobile hotspot dashboard with grouped season and rate withholding',async({page})=>{
  await boot(page);
  const host=page.locator('#owner379Hotspots');
  await expect(host).toContainText('Seasonal hotspots');
  await expect(host).toContainText('fall');
  await expect(host).toContainText('rate withheld');
  await host.getByText('Repeating route hotspots').click();
  await expect(host).toContainText('East Route');
  await expect(host).toContainText('40.0%');
  await expect(page.locator('a[href="/help.html#route-stop-sequence-friction-hotspots"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('source errors and Jobs permission withhold hotspot data',async({page})=>{
  await boot(page,{state:'partial_coverage',reason:'Capped source'},true);
  await expect(page.locator('#owner379Hotspots')).toContainText('Capped source');
  await expect(page.locator('#owner379Hotspots')).not.toContainText('Seasonal hotspots');
  await boot(page,fixture,false);
  await expect(page.locator('#owner379Hotspots')).toContainText('Jobs permission');
  await expect(page.locator('#owner379Hotspots')).not.toContainText('East Route');
});
test('phone Help explains the source and human approval boundaries',async({page})=>{
  await page.setViewportSize({width:390,height:900});
  await page.setContent(fs.readFileSync('help.html','utf8'));
  await expect(page.locator('#route-stop-sequence-friction-hotspots h2')).toContainText('Build 379');
  await expect(page.locator('#route-stop-sequence-friction-hotspots')).toContainText('no GPS');
});
