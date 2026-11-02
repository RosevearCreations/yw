import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const ago=n=>new Date(Date.now()-n*86400000).toISOString();
const minutes=n=>new Date(Date.now()-n*60000).toISOString();
const fresh=(at,count=10)=>({freshness_state:'current',coverage_state:'within_query_limit',coverage_gap:false,
  row_count:count,query_limit:500,retrieved_at:at});
const job=(id,days)=>({id,status:'completed',session_count:1,last_session_ended_at:ago(days),
  actual_charge_rollup_total:250,actual_cost_rollup_total:125});
const season=(key,extra={})=>({scenario_key:key,planned_item_count:2,recorded_demand_minutes:180,
  configured_route_capacity_headroom_minutes:50,missing_assumptions:[],...extra});
const episode=(id,days,s,status,extra={})=>({source_key:id,service_date:ago(days).slice(0,10),
  season_context:s,outcome_state:status,decision_reason:'PRIVATE <script>never</script>',...extra});
function fixture(at=minutes(2)){return {ok:true,source_visibility:{jobs:true,finance:true,admin:true,safety:false},
  source_freshness:{jobs:fresh(at,12),workability:fresh(at),dispatch:fresh(at),production:fresh(at)},
  owner_jobs:[...Array.from({length:6},(_,i)=>job('J-'+i,2+i*4)),
    ...Array.from({length:6},(_,i)=>job('J-'+(i+6),35+i*8))],
  four_season_capacity_profitability_scenario_evidence:{generated_at:at,source_queries_ok:true,coverage_complete:true,
    jobs_visible:true,scenarios:[season('spring_summer'),season('winter',{
      configured_route_capacity_headroom_minutes:null,missing_assumptions:['Snow <note> not recorded']})]},
  four_season_crew_day_mix_constraint_backtesting:{state:'current',source_health:[{freshness_state:'current',coverage_gap:false}]},
  workability_schedule_recovery_outcomes:{source_queries_ok:true,jobs_visible:true,summary:{constraint_episodes:4},outcomes:[
    episode('R-1',4,'winter','blocked_unresolved',{work_order_id:'WO-1'}),
    episode('R-2',6,'winter','rescheduled_pending'),
    episode('R-3',8,'spring_summer','partial_or_return_visit'),
    episode('R-4',10,'winter','blocked_unresolved')]}};}
async function boot(page,initial=fixture()){
  await page.setViewportSize({width:390,height:900});
  await page.setContent('<!doctype html><html><head></head><body><section id="admin"></section></body></html>');
  await page.addStyleTag({content:css});
  await page.evaluate(data=>{window.__data=data;window.YWIAPI={loadAdminDirectory:async()=>window.__data};},initial);
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('[data-owner510-lane]')).toHaveCount(3);
}
async function refresh(page,data){await page.evaluate(next=>window.__data=next,data);await page.locator('#owner508Refresh').click();}

test('dated source-field drift confidence is not an economic causation or revenue claim',async({page})=>{
  await boot(page);const lane=page.locator('[data-owner510-lane="economics"]');
  await expect(lane).toContainText('BASELINE ONLY');
  const next=fixture(minutes(1));next.owner_jobs[0].last_session_ended_at=ago(40);next.owner_jobs[6].last_session_ended_at=ago(3);
  await refresh(page,next);
  await expect(lane).toContainText('FIELD-TRACEABLE SOURCE DRIFT');
  await expect(lane.locator('[data-owner510-confidence="field_traceable"]')).toHaveCount(4);
  await expect(lane).toContainText('not proof of economic change');
  await expect(lane).not.toContainText('$');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('partial source identity limits confidence and is escaped',async({page})=>{
  await boot(page);const next=fixture(minutes(1));next.owner_jobs[0].id='J-<script>alert(1)</script>';
  await refresh(page,next);const lane=page.locator('[data-owner510-lane="economics"]');
  await expect(lane).toContainText('MIXED SOURCE CONFIDENCE');
  await expect(lane.locator('[data-owner510-confidence="limited"]')).toHaveCount(2);
  expect(await page.evaluate(()=>document.querySelector('#owner510Readiness script'))).toBeNull();
});
test('seasonal exception queue preserves current and disappeared gaps without closure',async({page})=>{
  await boot(page);const next=fixture(minutes(1));
  next.four_season_capacity_profitability_scenario_evidence.scenarios[1]=
    season('winter',{recorded_demand_minutes:null,missing_assumptions:['New <script>bad</script> assumption']});
  await refresh(page,next);await page.locator('#owner505Season').selectOption('winter');
  const lane=page.locator('[data-owner510-lane="capacity"]');
  await expect(lane).toContainText('SOURCE EXCEPTION QUEUE · NO CLOSURE');
  await expect(lane.locator('[data-owner510-gap="current"]')).toHaveCount(2);
  await expect(lane.locator('[data-owner510-gap="not_listed"]')).toHaveCount(2);
  await page.locator('#owner510GapFilter').selectOption('not_listed');
  await expect(lane.locator('[data-owner510-gap]')).toHaveCount(2);
  await expect(lane).toContainText('not an approved gap resolution');
  expect(await page.evaluate(()=>document.querySelector('#owner510Readiness script'))).toBeNull();
});
test('owner readiness differentiates linked completion, follow-up, disappearance and source conflict',async({page})=>{
  await boot(page);const next=fixture(minutes(1));next.workability_schedule_recovery_outcomes.outcomes=[
    episode('R-1',4,'winter','completed_after_recovery',{work_order_id:'WO-1',outcome_date:ago(1).slice(0,10),recovery_days:3}),
    episode('R-3',8,'spring_summer','rescheduled_pending'),episode('R-4',10,'fall','blocked_unresolved')];
  next.workability_schedule_recovery_outcomes.summary.constraint_episodes=3;
  await refresh(page,next);const lane=page.locator('[data-owner510-lane="reliability"]');
  await expect(lane).toContainText('OWNER FOLLOW-UP READINESS · NO SIGNOFF');
  await expect(lane.locator('[data-owner510-followup="review"]')).toHaveCount(1);
  await expect(lane.locator('[data-owner510-followup="attention"]')).toHaveCount(1);
  await expect(lane.locator('[data-owner510-followup="reconcile"]')).toHaveCount(2);
  await expect(lane).not.toContainText('PRIVATE');
  await page.locator('#owner510FollowFilter').selectOption('reconcile');
  await expect(lane.locator('[data-owner510-followup]')).toHaveCount(2);
});
test('nonadvancing timestamps, unlinked outcomes, stale sources and permission loss withhold readiness',async({page})=>{
  const first=fixture();await boot(page,first);await refresh(page,fixture(first.source_freshness.jobs.retrieved_at));
  await expect(page.locator('[data-owner510-lane="economics"]')).toContainText('DISTINCT READ REQUIRED');
  const next=fixture(minutes(1));next.workability_schedule_recovery_outcomes.outcomes[0]=
    episode('R-1',4,'winter','completed_after_recovery',{outcome_date:ago(1).slice(0,10),recovery_days:3});
  await refresh(page,next);await expect(page.locator('[data-owner510-followup="reconcile"]')).toHaveCount(1);
  next.source_freshness.dispatch.freshness_state='stale';next.source_visibility.finance=false;
  next.four_season_capacity_profitability_scenario_evidence.coverage_complete=false;
  next.source_freshness.jobs.retrieved_at=minutes(.5);await refresh(page,next);
  await expect(page.locator('[data-owner510-lane="economics"]')).toContainText('PERMISSION WITHHELD');
  await expect(page.locator('[data-owner510-lane="capacity"]')).toContainText('SOURCE RECHECK REQUIRED');
  await expect(page.locator('[data-owner510-lane="reliability"]')).toContainText('SOURCE RECHECK REQUIRED');
  next.source_visibility.jobs=false;await refresh(page,next);
  await expect(page.locator('#owner510Readiness')).toContainText('Jobs permission required');
  await expect(page.locator('[data-owner510-lane]')).toHaveCount(0);
});
