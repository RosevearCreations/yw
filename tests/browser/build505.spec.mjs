import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const recent=()=>new Date().toISOString();
const season=(scenario_key,extra={})=>({
 scenario_key,scenario_label:scenario_key,scenario_state:'recorded_evidence_complete',
 planned_item_count:3,recorded_demand_minutes:360,
 configured_route_capacity_headroom_minutes:180,configured_route_capacity_day_count:2,
 finance_evidence_state:'visible',recorded_job_profitability_group_count:2,
 recorded_job_revenue_total:2400,recorded_job_cost_total:1600,recorded_job_profit_total:800,
 recorded_job_margin_percent:33.3,workability_constraint_episodes:2,
 workability_full_completion_recovery_count:1,workability_recovery_rate_percent:50,
 missing_assumptions:[],...extra
});
function payload(){return {
 ok:true,source_visibility:{jobs:true,finance:true,admin:true,safety:false},
 management_metric_confidence:{four_season_capacity_profitability_scenarios:{state:'current',confidence:'high',last_authoritative_update:recent()}},
 four_season_capacity_profitability_scenario_evidence:{generated_at:recent(),
  source_queries_ok:true,coverage_complete:true,jobs_visible:true,finance_visible:true,
  horizon_start:'2026-11-01',horizon_end:'2026-11-14',
  summary:{planned_items_14_days:12,recorded_demand_minutes_14_days:1440},
  scenarios:[season('spring_summer'),season('fall',{missing_assumptions:['No record of <source> reviewed.']}),
   season('winter',{workability_constraint_episodes:0,workability_recovery_rate_percent:null}),season('four_season')]},
 four_season_crew_day_mix_constraint_backtesting:{state:'current',backtest_cohorts:[
  {window_key:'latest_30_days',matched_completed_pairs:6,sufficient_sample:true,on_day_alignment_percent:66.7},
  {window_key:'preceding_60_days',matched_completed_pairs:8,sufficient_sample:true,on_day_alignment_percent:62.5}]}
};}
async function boot(page,data=payload()){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><head></head><body><section id="admin"></section></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(initial=>{window.__payload=initial;
  window.YWIAPI={loadAdminDirectory:async()=>window.__payload};},data);
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
 await expect(page.locator('[data-owner505-state="recorded"]')).toBeVisible();
}
test('source-linked service economics, capacity and dated reliability continuity work on a phone',async({page})=>{
 await boot(page);
 const host=page.locator('#owner505Continuity');
 await expect(host.locator('[data-owner505-lane]')).toHaveCount(3);
 await expect(host).toContainText('Cross-season profit totals deliberately not combined');
 await expect(host).toContainText('12 planned items · 24.0 h recorded demand');
 await expect(host).toContainText('latest 30 days 66.7% (6 completed pairs) versus preceding 60 days 62.5% (8 pairs)');
 await expect(host).toContainText('difference +4.2 percentage points');
 await page.locator('#owner505Season').selectOption('fall');
 await expect(host).toContainText('revenue $2,400');
 await expect(host).toContainText('3.0 h configured headroom on 2 route-day(s)');
 await expect(host).toContainText('1 / 2 recorded full recoveries (50.0%)');
 await host.getByText('Missing assumptions for this season').click();
 await expect(host.locator('li')).toContainText('No record of <source> reviewed.');
 expect(await page.evaluate(()=>document.querySelector('#owner505Continuity source'))).toBeNull();
 await expect(host.locator('a[href="#owner375Scenarios"]')).not.toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('hidden Finance never leaks monetary values; no false reliability claim for absent episodes',async({page})=>{
 const data=payload();data.source_visibility.finance=false;
 await boot(page,data);
 await page.locator('#owner505Season').selectOption('winter');
 const host=page.locator('#owner505Continuity');
 await expect(host.locator('[data-owner505-lane="economics"]')).toContainText('PERMISSION WITHHELD');
 await expect(host).not.toContainText('$2,400');
 await expect(host).toContainText('Seasonal recovery not measured');
 await expect(host).toContainText('TREND');
});
test('missing or stale source, restricted jobs and small cohort samples fail closed through refresh',async({page})=>{
 await boot(page);
 const host=page.locator('#owner505Continuity');
 await page.evaluate(()=>{window.__payload.four_season_crew_day_mix_constraint_backtesting.backtest_cohorts[0].matched_completed_pairs=2;
  window.__payload.four_season_crew_day_mix_constraint_backtesting.backtest_cohorts[0].sufficient_sample=false;});
 await page.locator('#owner350Refresh').click();
 await expect(host).toContainText('TREND WITHHELD');
 await expect(host).not.toContainText('difference +4.2');
 await page.evaluate(()=>{window.__payload.four_season_capacity_profitability_scenario_evidence.source_queries_ok=false;});
 await page.locator('#owner350Refresh').click();
 await expect(host).toContainText('RECHECK REQUIRED');
 await expect(host.locator('[data-owner505-lane]')).toHaveCount(0);
 await page.evaluate(()=>{window.__payload.source_visibility.jobs=false;});
 await page.locator('#owner350Refresh').click();
 await expect(host).toContainText('Jobs / operations permission required');
 await expect(host).not.toContainText('12 planned items');
});
