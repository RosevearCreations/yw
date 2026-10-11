import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const script=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
const fixture={
  state:'current',reason:'Only explicit decisions count.',
  summary:{eligible_agreements:8,explicit_decision_count:6,observed_retention_percent:66.7,
    average_signed_renewal_lag_days:0,missing_or_unusable_decision_lags:1,excluded_from_end_date_window:2},
  cohorts:[{expiry_cohort:'2026-Q3',eligible_agreements:8,explicit_decision_count:6,observed_retention_percent:66.7,
    average_signed_renewal_lag_days:0,median_signed_renewal_lag_days:0,renewed_count:4,declined_count:2,
    held_count:1,expired_count:0,unresolved_count:1,decided_before_end_count:2,decided_on_end_count:1,
    decided_after_end_count:2,missing_or_unusable_decision_lags:1}],
  seasons:[{season_context:'winter',eligible_agreements:2,explicit_decision_count:1,
    observed_retention_percent:null,average_signed_renewal_lag_days:null,median_signed_renewal_lag_days:null,
    renewed_count:1,declined_count:0,held_count:0,expired_count:0,unresolved_count:1,
    decided_before_end_count:0,decided_on_end_count:0,decided_after_end_count:0,missing_or_unusable_decision_lags:1}],
  cohort_boundary:'Recorded expiry quarter only',retention_boundary:'Explicit decisions only',lag_boundary:'Signed days',
  coverage_boundary:'Minimum evidence',authority_boundary:'Read-only'
};
async function boot(page,data=fixture,jobs=true){
  await page.setViewportSize({width:390,height:900});
  await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
  await page.evaluate(({payload,allowed})=>{
    window.YWIRouter={showSection:()=>{}};
    window.YWIAdminHub={open:()=>{}};
    window.YWIAPI={loadAdminDirectory:async()=>({
      ok:true,source_visibility:{jobs:allowed,finance:false,safety:false,admin:false},
      management_metric_confidence:{},recurring_retention_cohort_renewal_lag:payload
    })};
  },{payload:data,allowed:jobs});
  await page.addScriptTag({content:script});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner380Cohorts')).toBeVisible();
}
test('mobile quarterly and seasonal renewal cohort presentation',async({page})=>{
  await boot(page);
  const panel=page.locator('#owner380Cohorts');
  await expect(panel).toContainText('66.7%');
  await expect(panel).toContainText('2026-Q3');
  await panel.getByText('Seasonal retention observations').click();
  await expect(panel).toContainText('winter');
  await expect(panel).toContainText('Withheld (fewer than 5 decisions)');
  await expect(page.locator('a[href="/help.html#recurring-retention-cohort-renewal-lag"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('missing permission and capped source withhold cohort reports',async({page})=>{
  await boot(page,{state:'partial_coverage',reason:'Capped source'},true);
  await expect(page.locator('#owner380Cohorts')).toContainText('Capped source');
  await expect(page.locator('#owner380Cohorts')).not.toContainText('66.7%');
  await boot(page,fixture,false);
  await expect(page.locator('#owner380Cohorts')).toContainText('Jobs permission');
  await expect(page.locator('#owner380Cohorts')).not.toContainText('2026-Q3');
});
test('phone Help explains renewal lag and no automatic customer changes',async({page})=>{
  await page.setViewportSize({width:390,height:900});
  await page.setContent(fs.readFileSync('help.html','utf8'));
  await expect(page.locator('#recurring-retention-cohort-renewal-lag h2')).toContainText('Build 380');
  await expect(page.locator('#recurring-retention-cohort-renewal-lag')).toContainText('No automatic renewal');
});
