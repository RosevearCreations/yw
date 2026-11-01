import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const source=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const now=()=>new Date().toISOString();
const daysAgo=n=>new Date(Date.now()-n*86400000).toISOString();
const freshness=(count=10)=>({freshness_state:'current',coverage_state:'within_query_limit',coverage_gap:false,
 row_count:count,query_limit:500,retrieved_at:now()});
function job(n,age){return {id:'job-'+n,status:'completed',session_count:1,
 last_session_ended_at:daysAgo(age),actual_charge_rollup_total:250,actual_cost_rollup_total:180};}
const season=(key,extra={})=>({scenario_key:key,planned_item_count:2,recorded_demand_minutes:240,
 configured_route_capacity_headroom_minutes:100,missing_assumptions:[],...extra});
function fixture(){return {
 ok:true,source_visibility:{jobs:true,finance:true,admin:true,safety:false},
 source_freshness:{jobs:freshness(),workability:freshness(),dispatch:freshness(),production:freshness()},
 owner_jobs:[...Array.from({length:5},(_,i)=>job(i,2+i*5)),
  ...Array.from({length:5},(_,i)=>job(5+i,34+i*8))],
 four_season_capacity_profitability_scenario_evidence:{generated_at:now(),source_queries_ok:true,
  coverage_complete:true,jobs_visible:true,scenarios:[season('spring_summer'),
   season('winter',{configured_route_capacity_headroom_minutes:null,
    missing_assumptions:['Snow plan <script>private</script> not verified']})]},
 four_season_crew_day_mix_constraint_backtesting:{state:'current',source_health:[
  {freshness_state:'current',coverage_gap:false}]},
 workability_schedule_recovery_outcomes:{source_queries_ok:true,jobs_visible:true,
  summary:{constraint_episodes:4},outcomes:[
   {source_key:'OBS-2',service_date:daysAgo(2).slice(0,10),season_context:'winter',outcome_state:'rescheduled_pending',decision_reason:'PRIVATE homeowner details'},
   {source_key:'OBS-3',service_date:daysAgo(5).slice(0,10),season_context:'winter',outcome_state:'blocked_unresolved'},
   {source_key:'OBS-4',service_date:daysAgo(7).slice(0,10),season_context:'winter',outcome_state:'partial_or_return_visit'},
   {source_key:'OBS-1',service_date:daysAgo(10).slice(0,10),season_context:'spring_summer',outcome_state:'blocked_unresolved'}]}
};}
async function boot(page,initial=fixture()){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><head></head><body><section id="admin"></section></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(data=>{window.__data=data;window.YWIAPI={loadAdminDirectory:async()=>window.__data};},initial);
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
 await expect(page.locator('[data-owner507-lane]')).toHaveCount(3);
}
test('provenance trace-back shows only authorized eligible cohort IDs, time boundaries and exclusion reasons',async({page})=>{
 await boot(page);const host=page.locator('#owner507Followup'),lane=host.locator('[data-owner507-lane="provenance"]');
 await expect(lane).toContainText('SOURCE-LINKED · ELIGIBLE');
 await expect(lane).toContainText('5 eligible recent 30-day jobs · 5 eligible preceding 60-day jobs');
 await expect(lane).toContainText('v_jobs_directory');
 await lane.locator('summary').click();
 await expect(lane.locator('.yw507-cohort')).toHaveCount(2);
 await expect(lane).toContainText('job-0');
 await expect(lane).toContainText('current lifetime rollups, not recognized period revenue');
 await page.evaluate(()=>window.__data.source_visibility.finance=false);
 await page.locator('#owner350Refresh').click();
 await expect(lane).toContainText('PERMISSION WITHHELD');
 await expect(lane).not.toContainText('job-0');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('duplicated source IDs and insufficient cohorts withhold, while source mismatch forces recheck',async({page})=>{
 await boot(page);const lane=page.locator('[data-owner507-lane="provenance"]');
 await page.evaluate(()=>{window.__data.owner_jobs[1].id='job-0';});
 await page.locator('#owner350Refresh').click();
 await expect(lane).toContainText('COHORT WITHHELD');
 await expect(lane).toContainText('duplicate: 2');
 await expect(lane.locator('.yw507-cohort')).toHaveCount(0);
 await page.evaluate(()=>{window.__data.source_freshness.jobs.row_count=9;});
 await page.locator('#owner350Refresh').click();
 await expect(lane).toContainText('SOURCE RECHECK REQUIRED');
 await expect(lane).not.toContainText('job-0');
});
test('season gap priorities put missing evidence first and sanitize assumptions on mobile',async({page})=>{
 await boot(page);const host=page.locator('#owner507Followup'),lane=host.locator('[data-owner507-lane="capacity"]');
 await expect(lane).toContainText('RECORDED EVIDENCE GAPS');
 await expect(lane.locator('[data-owner507-gap="headroom"]')).toHaveCount(1);
 await expect(lane.locator('[data-owner507-gap="assumption"]')).toHaveCount(1);
 await page.locator('#owner505Season').selectOption('winter');
 await expect(lane).toContainText('1 selected season');
 await expect(lane).toContainText('Snow plan <script>private</script> not verified');
 expect(await page.evaluate(()=>document.querySelector('#owner507Followup script'))).toBeNull();
 await page.evaluate(()=>{window.__data.four_season_crew_day_mix_constraint_backtesting.source_health[0].coverage_gap=true;});
 await page.locator('#owner350Refresh').click();
 await expect(lane.locator('[data-owner507-gap="recheck"]')).toHaveCount(1);
 await page.evaluate(()=>{window.__data.four_season_capacity_profitability_scenario_evidence.coverage_complete=false;});
 await page.locator('#owner350Refresh').click();
 await expect(lane).toContainText('SOURCE RECHECK REQUIRED');
});
test('follow-up candidates are read-only, state-prioritized, filterable and fail closed on incomplete source',async({page})=>{
 await boot(page);const host=page.locator('#owner507Followup'),lane=host.locator('[data-owner507-lane="queue"]');
 await expect(lane.locator('[data-owner507-followup]')).toHaveCount(4);
 await expect(lane.locator('[data-owner507-followup]').first()).toHaveAttribute('data-owner507-followup','unresolved');
 await expect(lane).not.toContainText('PRIVATE homeowner details');
 await expect(lane).toContainText('no owner or due date assigned');
 await page.locator('#owner507QueueFilter').selectOption('pending');
 await expect(lane.locator('[data-owner507-followup]')).toHaveCount(1);
 await expect(lane).toContainText('Recheck proposed/recorded reschedule');
 await page.locator('#owner505Season').selectOption('spring_summer');
 await expect(lane.locator('[data-owner507-followup]')).toHaveCount(0);
 await page.locator('#owner507QueueFilter').selectOption('attention');
 await expect(lane.locator('[data-owner507-followup]')).toHaveCount(1);
 await page.evaluate(()=>{window.__data.workability_schedule_recovery_outcomes.summary.constraint_episodes=151;});
 await page.locator('#owner350Refresh').click();
 await expect(lane).toContainText('PARTIAL RETURN · RECHECK');
 await page.evaluate(()=>{window.__data.source_freshness.dispatch.freshness_state='stale';});
 await page.locator('#owner350Refresh').click();
 await expect(lane).toContainText('SOURCE RECHECK REQUIRED');
 await expect(lane.locator('[data-owner507-followup]')).toHaveCount(0);
 await page.evaluate(()=>{window.__data.source_visibility.jobs=false;});
 await page.locator('#owner350Refresh').click();
 await expect(host).toContainText('Jobs view permission required');
 await expect(host.locator('[data-owner507-lane]')).toHaveCount(0);
});
