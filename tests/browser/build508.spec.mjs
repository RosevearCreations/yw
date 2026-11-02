import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const minutesAgo=n=>new Date(Date.now()-n*60000).toISOString();
const daysAgo=n=>new Date(Date.now()-n*86400000).toISOString();
const fresh=(stamp,count=10)=>({freshness_state:'current',coverage_state:'within_query_limit',coverage_gap:false,
 row_count:count,query_limit:500,retrieved_at:stamp});
const job=(n,age)=>({id:'J-'+n,status:'completed',session_count:1,last_session_ended_at:daysAgo(age),
 actual_charge_rollup_total:200,actual_cost_rollup_total:100});
const season=(key,extra={})=>({scenario_key:key,recorded_demand_minutes:180,planned_item_count:2,
 configured_route_capacity_headroom_minutes:50,missing_assumptions:[],...extra});
function fixture(stamp=minutesAgo(2)) {return {
 ok:true,source_visibility:{jobs:true,finance:true,admin:true,safety:false},
 source_freshness:{jobs:fresh(stamp),workability:fresh(stamp),dispatch:fresh(stamp),production:fresh(stamp)},
 owner_jobs:[...Array.from({length:5},(_,i)=>job(i,2+i*5)),...Array.from({length:5},(_,i)=>job(5+i,34+i*8))],
 four_season_capacity_profitability_scenario_evidence:{generated_at:stamp,source_queries_ok:true,
  coverage_complete:true,jobs_visible:true,scenarios:[season('spring_summer'),season('winter',{
    configured_route_capacity_headroom_minutes:null,missing_assumptions:['Snow <script>private</script> plan missing']})]},
 four_season_crew_day_mix_constraint_backtesting:{state:'current',source_health:[{freshness_state:'current',coverage_gap:false}]},
 workability_schedule_recovery_outcomes:{source_queries_ok:true,jobs_visible:true,summary:{constraint_episodes:3},
  outcomes:[
   {source_key:'OBS-1',service_date:daysAgo(4).slice(0,10),season_context:'winter',outcome_state:'blocked_unresolved',decision_reason:'PRIVATE homeowner detail'},
   {source_key:'OBS-2',service_date:daysAgo(6).slice(0,10),season_context:'winter',outcome_state:'rescheduled_pending'},
   {source_key:'OBS-3',service_date:daysAgo(8).slice(0,10),season_context:'spring_summer',outcome_state:'partial_or_return_visit'}]}
};}
async function boot(page,data=fixture()){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><head></head><body><section id="admin"></section></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(arg=>{window.__data=arg;window.YWIAPI={loadAdminDirectory:async()=>window.__data};},data);
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
 await expect(page.locator('#owner508Recheck [data-owner508-lane]')).toHaveCount(3);
}
async function refreshWith(page,data){await page.evaluate(next=>{window.__data=next;},data);
 await page.locator('#owner508Refresh').click();}

test('two distinct eligible sources establish only in-session cohort membership continuity',async({page})=>{
 await boot(page);const root=page.locator('#owner508Recheck'),econ=root.locator('[data-owner508-lane="economics"]');
 await expect(econ).toContainText('BASELINE CAPTURED');
 const next=fixture(minutesAgo(1));next.owner_jobs[4].id='J-44';
 await refreshWith(page,next);
 await expect(econ).toContainText('RECHECKED · SOURCE MEMBERSHIP');
 await expect(econ).toContainText('4 retained · 1 newly returned · 1 no longer eligible');
 await expect(econ).toContainText('not historical period financials');
 await expect(root).toContainText('QL-269');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('seasonal disappearance is evidence review, never closure or spare capacity',async({page})=>{
 await boot(page);const next=fixture(minutesAgo(1));
 next.four_season_capacity_profitability_scenario_evidence.scenarios[1]=season('winter');
 await refreshWith(page,next);await page.locator('#owner505Season').selectOption('winter');
 const lane=page.locator('[data-owner508-lane="capacity"]');
 await expect(lane).toContainText('SOURCE GAP RECHECKED · NOT CLOSURE');
 await expect(lane).toContainText('2 prior / 0 current listed gaps · 2 no longer listed');
 await lane.locator('summary').click();
 await expect(lane.locator('[data-owner508-gap="not-listed"]')).toHaveCount(2);
 await expect(lane).toContainText('Snow <script>private</script> plan missing');
 expect(await page.evaluate(()=>document.querySelector('#owner508Recheck script'))).toBeNull();
 await expect(lane).toContainText('not an owner-approved resolution');
});
test('completion requires matching dated outcome, and disappeared episodes remain unverified',async({page})=>{
 await boot(page);const next=fixture(minutesAgo(1));
 next.workability_schedule_recovery_outcomes.outcomes=[
  {...next.workability_schedule_recovery_outcomes.outcomes[0],outcome_state:'completed_after_recovery',
   outcome_date:daysAgo(1).slice(0,10),recovery_days:3},
  {...next.workability_schedule_recovery_outcomes.outcomes[2],outcome_state:'rescheduled_pending'}];
 next.workability_schedule_recovery_outcomes.summary.constraint_episodes=2;
 await refreshWith(page,next);
 const lane=page.locator('[data-owner508-lane="reliability"]');
 await expect(lane).toContainText('RECORDED OUTCOMES RECHECKED');
 await expect(lane).toContainText('1 matched dated completion outcome(s)');
 await expect(lane).toContainText('1 no longer returned');
 await expect(lane.locator('[data-owner508-outcome="recorded"]')).toHaveCount(1);
 await expect(lane).toContainText('OBS-1');
 await expect(lane).not.toContainText('PRIVATE homeowner detail');
 await expect(lane).toContainText('An absent episode is not a closed follow-up');
});
test('same timestamp, incomplete completion and lost permission fail closed',async({page})=>{
 const initial=fixture();await boot(page,initial);
 const second=fixture(initial.source_freshness.jobs.retrieved_at);
 await refreshWith(page,second);
 await expect(page.locator('[data-owner508-lane="economics"]')).toContainText('DISTINCT READ REQUIRED');
 await expect(page.locator('[data-owner508-lane="reliability"]')).toContainText('DISTINCT READ REQUIRED');
 const third=fixture(minutesAgo(1));
 third.workability_schedule_recovery_outcomes.outcomes[0].outcome_state='completed_after_recovery';
 third.workability_schedule_recovery_outcomes.outcomes[0].recovery_days=3;
 await refreshWith(page,third);
 await expect(page.locator('[data-owner508-outcome="recorded"]')).toHaveCount(0);
 third.source_visibility.finance=false;
 third.source_freshness.jobs.retrieved_at=minutesAgo(0.5);
 await refreshWith(page,third);
 await expect(page.locator('[data-owner508-lane="economics"]')).toContainText('PERMISSION WITHHELD');
 third.source_visibility.jobs=false;
 await refreshWith(page,third);
 await expect(page.locator('#owner508Recheck')).toContainText('Jobs permission required');
 await expect(page.locator('[data-owner508-lane]')).toHaveCount(0);
});
test('capped reliability and stale capacity withhold outcomes instead of false zero',async({page})=>{
 await boot(page);const next=fixture(minutesAgo(1));
 next.workability_schedule_recovery_outcomes.summary.constraint_episodes=151;
 next.four_season_capacity_profitability_scenario_evidence.coverage_complete=false;
 await refreshWith(page,next);
 await expect(page.locator('[data-owner508-lane="reliability"]')).toContainText('SOURCE RECHECK REQUIRED');
 await expect(page.locator('[data-owner508-lane="capacity"]')).toContainText('SOURCE RECHECK REQUIRED');
 await expect(page.locator('[data-owner508-outcome]')).toHaveCount(0);
});
