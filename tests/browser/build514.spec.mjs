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
  await expect(page.locator('[data-owner514-lane]')).toHaveCount(3);
}
async function refresh(page,data){await page.evaluate(next=>window.__data=next,data);await page.locator('#owner508Refresh').click();}

test('economic missing lineage remains unresolved, filterable, escaped and keyboard inspectable',async({page})=>{
  await boot(page);const lane=page.locator('[data-owner514-lane="economics"]');
  await expect(lane).toContainText('BASELINE ONLY');
  const next=fixture(minutes(1));next.owner_jobs[0].id='J-<script>unsafe</script>';
  await refresh(page,next);
  await expect(lane).toContainText('ECONOMIC EXCEPTION RESOLUTION PROOF · UNSIGNED');
  await expect(lane.locator('[data-owner514-economics="missing"]')).toHaveCount(2);
  await page.locator('#owner514EconomicsFilter').selectOption('trace');
  await expect(lane.locator('[data-owner514-economics]')).toHaveCount(0);
  await page.locator('#owner514EconomicsFilter').selectOption('missing');
  const detail=lane.locator('details').first();await detail.locator('summary').focus();await page.keyboard.press('Enter');
  await expect(detail).toHaveAttribute('open','');
  await expect(detail).toContainText('Finance decision evidence not returned');
  expect(await page.evaluate(()=>document.querySelector('#owner514Proof script'))).toBeNull();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('paired dated cohort movement is trace-only, never financial resolution',async({page})=>{
  await boot(page);const next=fixture(minutes(1));next.owner_jobs[0].last_session_ended_at=ago(40);
  await refresh(page,next);const lane=page.locator('[data-owner514-lane="economics"]');
  await expect(lane.locator('[data-owner514-economics="trace"]')).toHaveCount(2);
  await expect(lane).toContainText('DATED TRACE ONLY');
  await expect(lane).toContainText('0 source gap(s)');
  await expect(lane).not.toContainText('$');
  await page.locator('#owner514EconomicsFilter').selectOption('missing');
  await expect(lane.locator('[data-owner514-economics]')).toHaveCount(0);
});
test('seasonal gap recheck distinguishes listed, recovered unsigned and missing scenario',async({page})=>{
  await boot(page);const next=fixture(minutes(1));next.four_season_capacity_profitability_scenario_evidence.scenarios[1]=
    scenario('winter',{planned_item_count:null});
  await refresh(page,next);await page.locator('#owner505Season').selectOption('winter');
  const lane=page.locator('[data-owner514-lane="capacity"]');
  await expect(lane.locator('[data-owner514-capacity="open"]')).toHaveCount(1);
  await expect(lane.locator('[data-owner514-capacity="candidate"]')).toHaveCount(2);
  await page.locator('#owner514CapacityFilter').selectOption('candidate');
  await expect(lane.locator('[data-owner514-capacity]')).toHaveCount(2);
  await expect(lane).toContainText('FIELD RETURNED / CLOSURE UNSIGNED');
  await expect(lane).toContainText('explicit owner closure evidence');
  const absent=fixture(minutes(.5));absent.four_season_capacity_profitability_scenario_evidence.scenarios=[scenario('spring_summer')];
  await refresh(page,absent);await page.locator('#owner514CapacityFilter').selectOption('missing');
  await expect(lane.locator('[data-owner514-capacity="missing"]')).toHaveCount(1);
  await expect(lane).toContainText('SCENARIO SOURCE MISSING');
  expect(await page.evaluate(()=>document.querySelector('#owner514Proof script'))).toBeNull();
});
test('reliability separates unsigned linked completion, reference conflict and continuing attention',async({page})=>{
  await boot(page);const next=fixture(minutes(1));next.workability_schedule_recovery_outcomes.outcomes=[
    episode('R-1',4,'winter','completed_after_recovery',{work_order_id:'WO-1',outcome_date:ago(1).slice(0,10),recovery_days:3}),
    episode('R-3',8,'spring_summer','partial_or_return_visit'),
    episode('R-4',10,'winter','completed_after_recovery',{dispatch_schedule_item_id:'DS-5',outcome_date:ago(1).slice(0,10),recovery_days:9})];
  next.workability_schedule_recovery_outcomes.summary.constraint_episodes=3;
  await refresh(page,next);const lane=page.locator('[data-owner514-lane="reliability"]');
  await expect(lane.locator('[data-owner514-receipt="unsigned"]')).toHaveCount(1);
  await expect(lane.locator('[data-owner514-receipt="conflict"]')).toHaveCount(2);
  await expect(lane.locator('[data-owner514-receipt="attention"]')).toHaveCount(1);
  await page.locator('#owner514ReceiptFilter').selectOption('unsigned');
  await expect(lane.locator('[data-owner514-receipt]')).toHaveCount(1);
  await expect(lane).toContainText('OWNER RECEIPT NOT SUPPLIED');
  await expect(lane).not.toContainText('PRIVATE');
});
test('completion without recorded recovery days or with removed original link is not receipt-ready',async({page})=>{
  await boot(page);const next=fixture(minutes(1));next.workability_schedule_recovery_outcomes.outcomes[0]=
    episode('R-1',4,'winter','completed_after_recovery',{work_order_id:'WO-1',outcome_date:ago(1).slice(0,10),recovery_days:null});
  next.workability_schedule_recovery_outcomes.outcomes[3]=
    episode('R-4',10,'winter','completed_after_recovery',{work_order_id:'WO-4',outcome_date:ago(1).slice(0,10),recovery_days:9});
  await refresh(page,next);const lane=page.locator('[data-owner514-lane="reliability"]');
  await expect(lane.locator('[data-owner514-receipt="unsigned"]')).toHaveCount(0);
  await expect(lane.locator('[data-owner514-receipt="conflict"]')).toHaveCount(2);
  await expect(lane.locator('[data-owner514-receipt="conflict"]')).toContainText(['R-1','R-4']);
});
test('stale or unauthorized rechecks withhold source identity; no receipt created',async({page})=>{
  const initial=fixture();await boot(page,initial);await refresh(page,fixture(initial.source_freshness.jobs.retrieved_at));
  await expect(page.locator('[data-owner514-lane="economics"]')).toContainText('DISTINCT READ REQUIRED');
  const next=fixture(minutes(1));next.source_visibility.finance=false;
  next.source_freshness.dispatch.freshness_state='stale';next.four_season_capacity_profitability_scenario_evidence.coverage_complete=false;
  await refresh(page,next);
  await expect(page.locator('[data-owner514-lane="economics"]')).toContainText('PERMISSION WITHHELD');
  await expect(page.locator('[data-owner514-lane="capacity"]')).toContainText('SOURCE RECHECK REQUIRED');
  await expect(page.locator('[data-owner514-lane="reliability"]')).toContainText('SOURCE RECHECK REQUIRED');
  next.source_visibility.jobs=false;await refresh(page,next);
  await expect(page.locator('#owner514Proof')).toContainText('Jobs permission required');
  await expect(page.locator('[data-owner514-lane]')).toHaveCount(0);
});
