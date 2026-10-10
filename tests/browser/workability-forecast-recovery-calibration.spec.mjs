import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
const good={
  state:'current',reason:'Descriptive proposal-versus-completion alignment only',
  summary:{constraint_episodes:6,with_dated_proposal:6,missing_or_invalid_proposal:0,completed_with_proposal:5,
    proposals_without_full_completion:1,on_proposed_day_count:2,on_proposed_day_percent:40,mean_absolute_gap_days:0.6,sufficient_sample:true},
  seasons:[{season_context:'spring_summer',completed_with_proposal:5,proposals_without_full_completion:0,missing_or_invalid_proposal:0,
    sufficient_sample:true,on_proposed_day_percent:40,mean_absolute_gap_days:0.6},
    {season_context:'winter',completed_with_proposal:0,proposals_without_full_completion:1,missing_or_invalid_proposal:1,sufficient_sample:false}],
  comparison_basis:'Source proposal vs Production completion',
  forecast_boundary:'No immutable historical forecast snapshots; NOT forecast accuracy',
  safety_boundary:'No automatic dispatch',
  privacy_boundary:'Aggregate records only',
  current_forecast_context:{seven_day_planned_items:4,seven_day_blocked_days:1}
};
async function boot(page,value=good){
  await page.setViewportSize({width:390,height:900});
  await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
  await page.evaluate(payload=>{
    window.YWIRouter={showSection:()=>{}};
    window.YWIAdminHub={open:()=>{}};
    window.YWIAPI={loadAdminDirectory:async()=>({
      ok:true,source_visibility:{jobs:true,finance:false,safety:false,admin:false},
      management_metric_confidence:{},workability_forecast_recovery_calibration:payload
    })};
  },value);
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner378Calibration')).toBeVisible();
}
test('Build 378 phone panel renders aggregate seasons and meaningful calibration sample',async({page})=>{
  await boot(page);
  const panel=page.locator('#owner378Calibration');
  await expect(panel).toContainText('Constrained episodes');
  await expect(panel).toContainText('40.0%');
  await expect(panel).toContainText('0.6 day(s)');
  await expect(panel).toContainText('winter');
  await expect(panel).toContainText('Metrics withheld');
  await expect(page.locator('a[href="/help.html#workability-forecast-recovery-calibration"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('Build 378 fails closed on source errors instead of reporting fabricated comparisons',async({page})=>{
  await boot(page,{state:'partial_coverage',reason:'Canonical Workability source reached the row cap.'});
  const panel=page.locator('#owner378Calibration');
  await expect(panel).toContainText('reached the row cap');
  await expect(panel.locator('[data-owner378-state="partial_coverage"]')).toHaveCount(1);
  await expect(panel).not.toContainText('Mean absolute date gap');
});
test('Build 378 contextual Help explains limitations on phone',async({page})=>{
  await page.setViewportSize({width:390,height:900});
  await page.setContent(fs.readFileSync('help.html','utf8'));
  await expect(page.locator('#workability-forecast-recovery-calibration h2')).toContainText('Build 378');
  await expect(page.locator('#workability-forecast-recovery-calibration')).toContainText('not proof');
});
