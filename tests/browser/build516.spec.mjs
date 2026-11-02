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
const scenario=(key,extra={})=>({scenario_key:key,planned_item_count:2,recorded_demand_minutes:180,
  configured_route_capacity_headroom_minutes:50,missing_assumptions:[],...extra});
const episode=(id,days,season,status,extra={})=>({source_key:id,service_date:ago(days).slice(0,10),
  season_context:season,outcome_state:status,decision_reason:'PRIVATE <script>never</script>',...extra});
function fixture(at=minutes(2)){return {ok:true,source_visibility:{jobs:true,finance:true,admin:true,safety:false},
  source_freshness:{jobs:fresh(at,12),workability:fresh(at),dispatch:fresh(at),production:fresh(at)},
  owner_jobs:[...Array.from({length:6},(_,i)=>job('J-'+i,2+i*4)),
    ...Array.from({length:6},(_,i)=>job('J-'+(i+6),35+i*8))],
  four_season_capacity_profitability_scenario_evidence:{generated_at:at,source_queries_ok:true,coverage_complete:true,
    jobs_visible:true,scenarios:[scenario('spring_summer'),scenario('winter',{
      configured_route_capacity_headroom_minutes:null,missing_assumptions:['Snow <script>untrusted</script>']})]},
  four_season_crew_day_mix_constraint_backtesting:{state:'current',source_health:[{freshness_state:'current',coverage_gap:false}]},
  workability_schedule_recovery_outcomes:{source_queries_ok:true,jobs_visible:true,summary:{constraint_episodes:4},outcomes:[
    episode('R-1',4,'winter','blocked_unresolved',{work_order_id:'WO-1'}),
    episode('R-2',6,'winter','rescheduled_pending'),
    episode('R-3',8,'spring_summer','partial_or_return_visit'),
    episode('R-4',10,'winter','blocked_unresolved',{dispatch_schedule_item_id:'DS-4'})]}};}
async function boot(page,initial=fixture()){
  await page.setViewportSize({width:390,height:900});
  await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
  await page.addStyleTag({content:css});
  await page.evaluate(data=>{window.__data=data;window.YWIAPI={loadAdminDirectory:async()=>window.__data};},initial);
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('[data-owner516-lane]')).toHaveCount(3);
}
async function refresh(page,data){await page.evaluate(next=>window.__data=next,data);await page.locator('#owner508Refresh').click();}

test('missing economic lineage is withheld from disposition and safely escaped',async({page})=>{
  const initial=fixture();await boot(page,initial);const lane=page.locator('[data-owner516-lane="economics"]');
  await expect(lane).toContainText('BASELINE ONLY');
  const next=fixture(minutes(1));next.owner_jobs=initial.owner_jobs.map(j=>({...j}));next.owner_jobs[0].id='J-<script>unsafe</script>';
  await refresh(page,next);
  await expect(lane).toContainText('SOURCE DISPOSITION TRACE CONTINUITY · UNDECIDED');
  await expect(lane.locator('[data-owner516-economic="lineage"]')).toHaveCount(2);
  await page.locator('#owner516TraceFilter').selectOption('date_shift');
  await expect(lane.locator('[data-owner516-economic]')).toHaveCount(0);
  await page.locator('#owner516TraceFilter').selectOption('lineage');
  const detail=lane.locator('details').first();await detail.locator('summary').focus();await page.keyboard.press('Enter');
  await expect(detail).toHaveAttribute('open','');
  await expect(detail).toContainText('Recover original Jobs ID');
  expect(await page.evaluate(()=>document.querySelector('#owner516Continuity script'))).toBeNull();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('completion date shifted inside the same cohort is detected but not approved',async({page})=>{
  const initial=fixture();await boot(page,initial);const next=fixture(minutes(1));next.owner_jobs=initial.owner_jobs.map(j=>({...j}));next.owner_jobs[0].last_session_ended_at=ago(3);
  await refresh(page,next);const lane=page.locator('[data-owner516-lane="economics"]');
  await expect(lane.locator('[data-owner516-economic="date_shift"]')).toHaveCount(1);
  await expect(lane).toContainText('DATE TRACE SHIFT · NOT DISPOSITION');
  await expect(lane).toContainText('0 lineage gap(s)');
  await expect(lane).not.toContainText('$');
});
test('cohort movement also remains a dated trace, not historical period revenue',async({page})=>{
  const initial=fixture();await boot(page,initial);const next=fixture(minutes(1));next.owner_jobs=initial.owner_jobs.map(j=>({...j}));next.owner_jobs[0].last_session_ended_at=ago(40);
  await refresh(page,next);const lane=page.locator('[data-owner516-lane="economics"]');
  await expect(lane.locator('[data-owner516-economic="date_shift"]')).toHaveCount(1);
  await expect(lane).toContainText('0 lineage gap(s)');
  await expect(lane).toContainText('period revenue');
});
test('seasonal closure follow-up separates new, missing-source and unsigned cases',async({page})=>{
  await boot(page);const next=fixture(minutes(1));next.four_season_capacity_profitability_scenario_evidence.scenarios[1]=
    scenario('winter',{planned_item_count:null});
  await refresh(page,next);await page.locator('#owner505Season').selectOption('winter');
  const lane=page.locator('[data-owner516-lane="capacity"]');
  await expect(lane.locator('[data-owner516-capacity="new"]')).toHaveCount(1);
  await expect(lane.locator('[data-owner516-capacity="unsigned"]')).toHaveCount(2);
  await page.locator('#owner516ClosureFilter').selectOption('unsigned');
  await expect(lane.locator('[data-owner516-capacity]')).toHaveCount(2);
  await expect(lane).toContainText('CLOSURE UNSIGNED');
  const absent=fixture(minutes(.5));absent.four_season_capacity_profitability_scenario_evidence.scenarios=[scenario('spring_summer')];
  await refresh(page,absent);await page.locator('#owner516ClosureFilter').selectOption('source_gap');
  await expect(lane.locator('[data-owner516-capacity="source_gap"]')).toHaveCount(1);
  await expect(lane).toContainText('Current scenario for this season is missing');
});
test('duplicate current seasonal scenario IDs withhold exception matching',async({page})=>{
  await boot(page);const next=fixture(minutes(1));next.four_season_capacity_profitability_scenario_evidence.scenarios.push(scenario('winter'));
  await refresh(page,next);await expect(page.locator('[data-owner516-lane="capacity"]')).toContainText('SCENARIO IDENTITY CONFLICT');
});
test('receipt age is rechecked at source timestamps, with unsigned completion and conflicting references',async({page})=>{
  await boot(page);const next=fixture(minutes(1));next.workability_schedule_recovery_outcomes.outcomes=[
    episode('R-1',4,'winter','completed_after_recovery',{work_order_id:'WO-1',outcome_date:ago(1).slice(0,10),recovery_days:3}),
    episode('R-3',8,'spring_summer','partial_or_return_visit'),
    episode('R-4',10,'winter','completed_after_recovery',{dispatch_schedule_item_id:'DS-5',outcome_date:ago(1).slice(0,10),recovery_days:9})];
  next.workability_schedule_recovery_outcomes.summary.constraint_episodes=3;
  await refresh(page,next);const lane=page.locator('[data-owner516-lane="reliability"]');
  await expect(lane.locator('[data-owner516-receipt="unsigned"]')).toHaveCount(1);
  await expect(lane.locator('[data-owner516-receipt="conflict"]')).toHaveCount(2);
  await expect(lane.locator('[data-owner516-receipt="attention"]')).toHaveCount(1);
  await page.locator('#owner516ReceiptFilter').selectOption('unsigned');
  await page.locator('#owner516AgeFilter').selectOption('recent');
  await expect(lane.locator('[data-owner516-receipt]')).toHaveCount(1);
  await expect(lane).toContainText('Δ 0 day(s)');
  await expect(lane).toContainText('not time since a receipt request');
  await expect(lane).not.toContainText('PRIVATE');
});
test('future service date and missing recovery duration remain unknown/conflicted',async({page})=>{
  const initial=fixture(),future=ago(-5).slice(0,10);initial.workability_schedule_recovery_outcomes.outcomes[0].service_date=future;
  await boot(page,initial);const next=fixture(minutes(1));next.workability_schedule_recovery_outcomes.outcomes[0]=
    episode('R-1',4,'winter','completed_after_recovery',{work_order_id:'WO-1',service_date:future,outcome_date:ago(1).slice(0,10),recovery_days:null});
  await refresh(page,next);const lane=page.locator('[data-owner516-lane="reliability"]');
  await page.locator('#owner516AgeFilter').selectOption('unknown');
  await expect(lane.locator('[data-owner516-age="unknown"]')).toHaveCount(1);
  await expect(lane).toContainText('Age unavailable or future service date');
  await expect(lane.locator('[data-owner516-receipt="unsigned"]')).toHaveCount(0);
  await expect(lane.locator('[data-owner516-receipt="conflict"]')).toHaveCount(1);
});
test('nonadvancing, stale and permission-withheld evidence suppresses source identities',async({page})=>{
  const initial=fixture();await boot(page,initial);await refresh(page,fixture(initial.source_freshness.jobs.retrieved_at));
  await expect(page.locator('[data-owner516-lane="economics"]')).toContainText('DISTINCT READ REQUIRED');
  const next=fixture(minutes(1));next.source_visibility.finance=false;next.source_freshness.dispatch.freshness_state='stale';
  next.four_season_capacity_profitability_scenario_evidence.coverage_complete=false;
  await refresh(page,next);
  await expect(page.locator('[data-owner516-lane="economics"]')).toContainText('PERMISSION WITHHELD');
  await expect(page.locator('[data-owner516-lane="capacity"]')).toContainText('SOURCE RECHECK REQUIRED');
  await expect(page.locator('[data-owner516-lane="reliability"]')).toContainText('SOURCE RECHECK REQUIRED');
  next.source_visibility.jobs=false;await refresh(page,next);
  await expect(page.locator('#owner516Continuity')).toContainText('Jobs permission required');
  await expect(page.locator('[data-owner516-lane]')).toHaveCount(0);
});
