import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const minutesAgo=n=>new Date(Date.now()-n*60000).toISOString();
const daysAgo=n=>new Date(Date.now()-n*86400000).toISOString();
const fresh=(stamp,count=10)=>({freshness_state:'current',coverage_state:'within_query_limit',coverage_gap:false,
 row_count:count,query_limit:500,retrieved_at:stamp});
const job=(n,age)=>({id:'J-'+n,status:'completed',session_count:1,last_session_ended_at:daysAgo(age),
 actual_charge_rollup_total:250,actual_cost_rollup_total:125});
const season=(key,extra={})=>({scenario_key:key,planned_item_count:2,recorded_demand_minutes:180,
 configured_route_capacity_headroom_minutes:50,missing_assumptions:[],...extra});
const episode=(id,age,seasonContext,status,extra={})=>({source_key:id,service_date:daysAgo(age).slice(0,10),
 season_context:seasonContext,outcome_state:status,decision_reason:'PRIVATE decision <script>note</script>',...extra});
function fixture(stamp=minutesAgo(2)){return {
 ok:true,source_visibility:{jobs:true,finance:true,admin:true,safety:false},
 source_freshness:{jobs:fresh(stamp,12),workability:fresh(stamp),dispatch:fresh(stamp),production:fresh(stamp)},
 owner_jobs:[...Array.from({length:6},(_,i)=>job(i,2+i*4)),...Array.from({length:6},(_,i)=>job(6+i,35+i*8))],
 four_season_capacity_profitability_scenario_evidence:{generated_at:stamp,source_queries_ok:true,
  coverage_complete:true,jobs_visible:true,scenarios:[season('spring_summer'),season('winter',{
    configured_route_capacity_headroom_minutes:null,missing_assumptions:['Snow <note> evidence absent']})]},
 four_season_crew_day_mix_constraint_backtesting:{state:'current',source_health:[{freshness_state:'current',coverage_gap:false}]},
 workability_schedule_recovery_outcomes:{source_queries_ok:true,jobs_visible:true,summary:{constraint_episodes:4},outcomes:[
   episode('R-1',4,'winter','blocked_unresolved',{work_order_id:'WO-1'}),
   episode('R-2',6,'winter','rescheduled_pending'),
   episode('R-3',8,'spring_summer','partial_or_return_visit'),
   episode('R-4',10,'winter','blocked_unresolved')]}
};}
async function boot(page,data=fixture()){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><head></head><body><section id="admin"></section></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(arg=>{window.__data=arg;window.YWIAPI={loadAdminDirectory:async()=>window.__data};},data);
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
 await expect(page.locator('#owner509Trace [data-owner509-lane]')).toHaveCount(3);
}
async function refreshWith(page,data){await page.evaluate(next=>window.__data=next,data);
 await page.locator('#owner508Refresh').click();}
test('economic cohort drift differentiates returned IDs and eligibility changes without financial inference',async({page})=>{
 await boot(page);const lane=page.locator('[data-owner509-lane="economics"]');
 await expect(lane).toContainText('BASELINE ONLY');
 const next=fixture(minutesAgo(1));next.owner_jobs[0].id='J-99';next.owner_jobs[1].status='scheduled';
 await refreshWith(page,next);
 await expect(lane).toContainText('DATED MEMBERSHIP DRIFT · SOURCE-CLASSIFIED');
 await expect(lane).toContainText('1 newly returned ID(s), 1 no longer returned, 1 eligibility change(s)');
 await expect(lane).toContainText('J-99');
 await expect(lane).toContainText('new in returned Jobs source');
 await expect(lane).toContainText('current eligibility: status / single-session evidence');
 await expect(lane).toContainText('not proven business causes');
 await expect(lane).not.toContainText('$');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('seasonal gap traces show recorded fields and withhold closure claims',async({page})=>{
 await boot(page);const next=fixture(minutesAgo(1));
 next.four_season_capacity_profitability_scenario_evidence.scenarios[1]=season('winter',{
  configured_route_capacity_headroom_minutes:120});
 await refreshWith(page,next);await page.locator('#owner505Season').selectOption('winter');
 const lane=page.locator('[data-owner509-lane="capacity"]');
 await expect(lane).toContainText('GAP SOURCE TRACE · NOT RESOLUTION');
 await expect(lane).toContainText('2 disappeared listing(s)');
 await lane.locator('summary').click();
 await expect(lane.locator('[data-owner509-gap="not-listed"]')).toHaveCount(2);
 await expect(lane).toContainText('Configured route headroom now recorded: 120 minutes');
 await expect(lane).toContainText('Missing-assumption text no longer listed');
 await expect(lane).toContainText('Snow <note> evidence absent');
 expect(await page.evaluate(()=>document.querySelector('#owner509Trace note'))).toBeNull();
 await expect(lane).toContainText('not an independently accepted gap closure');
});
test('reliability reconciliation separates validated, still-open, absent and identity-conflict outcomes',async({page})=>{
 await boot(page);const next=fixture(minutesAgo(1));
 next.workability_schedule_recovery_outcomes.outcomes=[
   episode('R-1',4,'winter','completed_after_recovery',{work_order_id:'WO-1',outcome_date:daysAgo(1).slice(0,10),recovery_days:3}),
   episode('R-3',8,'spring_summer','rescheduled_pending'),
   episode('R-4',10,'fall','blocked_unresolved')];
 next.workability_schedule_recovery_outcomes.summary.constraint_episodes=3;
 await refreshWith(page,next);const lane=page.locator('[data-owner509-lane="reliability"]');
 await expect(lane).toContainText('FOLLOW-UP SOURCE RECONCILIATION');
 await expect(lane).toContainText('1 recorded completion(s)');
 await expect(lane).toContainText('1 still needs review');
 await expect(lane).toContainText('1 no longer returned');
 await expect(lane).toContainText('1 evidence conflict(s)');
 await expect(lane).not.toContainText('PRIVATE decision');
 await page.locator('#owner509StateFilter').selectOption('validated');
 await expect(lane.locator('[data-owner509-reconcile]')).toHaveCount(1);
 await expect(lane).toContainText('WO-1');
 await page.locator('#owner509StateFilter').selectOption('missing');
 await expect(lane.locator('[data-owner509-reconcile]')).toHaveCount(1);
 await expect(lane).toContainText('closure cannot be inferred');
 await page.locator('#owner509StateFilter').selectOption('conflict');
 await expect(lane.locator('[data-owner509-reconcile]')).toHaveCount(1);
 await expect(lane).toContainText('Source identity date/season changed');
});
test('unlinked completion, stale sources, nonadvancing refresh and permission loss withhold evidence',async({page})=>{
 const initial=fixture();await boot(page,initial);
 await refreshWith(page,fixture(initial.source_freshness.jobs.retrieved_at));
 await expect(page.locator('[data-owner509-lane="economics"]')).toContainText('DISTINCT READ REQUIRED');
 const next=fixture(minutesAgo(1));
 next.workability_schedule_recovery_outcomes.outcomes[0].outcome_state='completed_after_recovery';
 next.workability_schedule_recovery_outcomes.outcomes[0].outcome_date=daysAgo(1).slice(0,10);
 next.workability_schedule_recovery_outcomes.outcomes[0].recovery_days=3;
 next.workability_schedule_recovery_outcomes.outcomes[0].work_order_id=null;
 await refreshWith(page,next);
 await expect(page.locator('[data-owner509-reconcile="conflict"]')).toHaveCount(1);
 next.source_freshness.dispatch.freshness_state='stale';next.source_visibility.finance=false;
 next.four_season_capacity_profitability_scenario_evidence.coverage_complete=false;
 next.source_freshness.jobs.retrieved_at=minutesAgo(.5);
 await refreshWith(page,next);
 await expect(page.locator('[data-owner509-lane="economics"]')).toContainText('PERMISSION WITHHELD');
 await expect(page.locator('[data-owner509-lane="capacity"]')).toContainText('SOURCE RECHECK REQUIRED');
 await expect(page.locator('[data-owner509-lane="reliability"]')).toContainText('SOURCE RECHECK REQUIRED');
 next.source_visibility.jobs=false;await refreshWith(page,next);
 await expect(page.locator('#owner509Trace')).toContainText('Jobs permission required');
 await expect(page.locator('[data-owner509-lane]')).toHaveCount(0);
});
