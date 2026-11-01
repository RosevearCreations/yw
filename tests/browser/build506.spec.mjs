import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const now=()=>new Date().toISOString();
const daysAgo=n=>new Date(Date.now()-n*86400000).toISOString();
const freshness=(count=10)=>({freshness_state:'current',coverage_state:'within_query_limit',coverage_gap:false,
 row_count:count,query_limit:500,retrieved_at:now()});
function job(n,age,revenue,cost){return {id:'job-'+n,status:'completed',session_count:1,
 last_session_ended_at:daysAgo(age),actual_charge_rollup_total:revenue,actual_cost_rollup_total:cost};}
const season=(key,extra={})=>({scenario_key:key,planned_item_count:3,recorded_demand_minutes:360,
 configured_route_capacity_headroom_minutes:180,missing_assumptions:[],...extra});
function fixture(){return {
 ok:true,source_visibility:{jobs:true,finance:true,safety:false,admin:true},
 source_freshness:{jobs:freshness(),profitability:freshness(),workability:freshness(),dispatch:freshness(),production:freshness()},
 management_metric_confidence:{four_season_capacity_profitability_scenarios:{state:'current',confidence:'high',last_authoritative_update:now()}},
 owner_jobs:[...Array.from({length:5},(_,i)=>job(i,i*4+4,200,100)),
  ...Array.from({length:5},(_,i)=>job(i+5,i*8+36,100,75))],
 four_season_capacity_profitability_scenario_evidence:{generated_at:now(),source_queries_ok:true,
  coverage_complete:true,jobs_visible:true,finance_visible:true,horizon_start:'2026-11-01',horizon_end:'2026-11-14',
  summary:{planned_items_14_days:12,recorded_demand_minutes_14_days:1440},
  scenarios:[season('spring_summer'),season('fall'),
    season('winter',{configured_route_capacity_headroom_minutes:null,missing_assumptions:['Missing weather <note> needs verification.']}),
    season('four_season')]},
 four_season_crew_day_mix_constraint_backtesting:{state:'current',source_health:[
  {source_key:'jobs',freshness_state:'current',coverage_gap:false},
  {source_key:'dispatch',freshness_state:'current',coverage_gap:false}],
  backtest_cohorts:[{window_key:'latest_30_days',matched_completed_pairs:6,sufficient_sample:true,on_day_alignment_percent:66.7},
    {window_key:'preceding_60_days',matched_completed_pairs:8,sufficient_sample:true,on_day_alignment_percent:62.5}]},
 workability_schedule_recovery_outcomes:{source_queries_ok:true,jobs_visible:true,lookback_days:90,
  summary:{constraint_episodes:3},season_outcomes:[],outcomes:[
    {service_date:daysAgo(2).slice(0,10),season_context:'winter',outcome_state:'blocked_unresolved',work_order_number:'WO-17',decision_reason:'Private homeowner note should not appear'},
    {service_date:daysAgo(4).slice(0,10),season_context:'winter',outcome_state:'rescheduled_pending',source_key:'OBS-18'},
    {service_date:daysAgo(6).slice(0,10),season_context:'fall',outcome_state:'partial_or_return_visit',source_key:'OBS-19'},
    {service_date:daysAgo(8).slice(0,10),season_context:'winter',outcome_state:'completed_after_recovery',source_key:'OBS-20',recovery_days:2}]}
};}
async function boot(page,initial=fixture()){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><head></head><body><section id="admin"></section></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(data=>{window.__data=data;window.YWIAPI={loadAdminDirectory:async()=>window.__data};},initial);
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
 await expect(page.locator('[data-owner506-lane]')).toHaveCount(3);
}
test('dated completed-job cohorts compare narrow lifetime snapshots and retain authority language on mobile',async({page})=>{
 await boot(page);const host=page.locator('#owner506Review');
 await expect(host.locator('[data-owner506-lane="Historical economics"]')).toContainText('BOUNDED COHORT COMPARISON');
 await expect(host.locator('[data-owner506-cohort="recent"]')).toContainText('5 jobs · revenue $1,000 · cost $500 · snapshot margin 50.0%');
 await expect(host.locator('[data-owner506-cohort="prior"]')).toContainText('5 jobs · revenue $500 · cost $375 · snapshot margin 25.0%');
 await expect(host).toContainText('not');
 await expect(host).toContainText('Not period revenue recognition');
 await expect(host.locator('[data-owner506-lane="Capacity confidence"]')).toContainText('RECORDED WITH GAPS');
 await expect(host).toContainText('QL-269 UNDER REVIEW');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('season and exception filtering show only authorized bounded records without private notes',async({page})=>{
 await boot(page);const host=page.locator('#owner506Review');
 await expect(host.locator('[data-owner506-exception]')).toHaveCount(3);
 await expect(host).not.toContainText('Private homeowner note');
 await page.locator('#owner505Season').selectOption('winter');
 await expect(host).toContainText('1 documented gap');
 await expect(host).toContainText('Missing weather <note> needs verification.');
 expect(await page.evaluate(()=>document.querySelector('#owner506Review note'))).toBeNull();
 await expect(host.locator('[data-owner506-exception]')).toHaveCount(2);
 await page.locator('#owner506ExceptionFilter').selectOption('unresolved');
 await expect(host.locator('[data-owner506-exception]')).toHaveCount(1);
 await expect(host).toContainText('WO-17');
 await page.locator('#owner506ExceptionFilter').selectOption('completed');
 await expect(host.locator('[data-owner506-exception]')).toHaveCount(1);
 await expect(host).toContainText('2 recorded day(s) to outcome');
});
test('Finance permission and incomplete source/short cohort withdraw economic comparison; failures clear exceptions',async({page})=>{
 await boot(page);const host=page.locator('#owner506Review');
 await page.evaluate(()=>window.__data.source_visibility.finance=false);
 await page.locator('#owner350Refresh').click();
 await expect(host.locator('[data-owner506-lane="Historical economics"]')).toContainText('WITHHELD');
 await expect(host).not.toContainText('$1,000');
 await page.evaluate(()=>{window.__data.source_visibility.finance=true;
   window.__data.owner_jobs=window.__data.owner_jobs.slice(0,8);});
 await page.locator('#owner350Refresh').click();
 await expect(host).toContainText('COHORT COMPARISON WITHHELD');
 await page.evaluate(()=>{window.__data.source_freshness.jobs.coverage_state='possibly_capped';
   window.__data.workability_schedule_recovery_outcomes.source_queries_ok=false;});
 await page.locator('#owner350Refresh').click();
 await expect(host.locator('[data-owner506-lane="Historical economics"]')).toContainText('WITHHELD');
 await expect(host.locator('[data-owner506-lane="Reliability exceptions"]')).toContainText('RECHECK REQUIRED');
 await expect(host.locator('[data-owner506-exception]')).toHaveCount(0);
 await page.evaluate(()=>window.__data.source_visibility.jobs=false);
 await page.locator('#owner350Refresh').click();
 await expect(host).toContainText('Jobs view permission is required');
 await expect(host.locator('[data-owner506-lane]')).toHaveCount(0);
});
