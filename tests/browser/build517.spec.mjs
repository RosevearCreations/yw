import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const source=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const ago=n=>new Date(Date.now()-n*86400000).toISOString();
const minutes=n=>new Date(Date.now()-n*60000).toISOString();
const fresh=(at,n=8)=>({freshness_state:'current',coverage_state:'within_query_limit',coverage_gap:false,
  row_count:n,query_limit:500,retrieved_at:at});
const job=(id,n)=>({id,status:'completed',session_count:1,last_session_ended_at:ago(n),
  actual_charge_rollup_total:220,actual_cost_rollup_total:140});
const scenario=(season,extra={})=>({scenario_key:season,planned_item_count:2,
  recorded_demand_minutes:180,configured_route_capacity_headroom_minutes:60,missing_assumptions:[],...extra});
const episode=(id,n,status,extra={})=>({source_key:id,service_date:ago(n).slice(0,10),season_context:'winter',
  outcome_state:status,decision_reason:'PRIVATE',...extra});
function fixture(at=minutes(3)){return {ok:true,source_visibility:{jobs:true,finance:true,admin:true,safety:false},
  source_freshness:{jobs:fresh(at,12),workability:fresh(at),dispatch:fresh(at),production:fresh(at)},
  owner_jobs:[...Array.from({length:6},(_,i)=>job('J-'+i,2+i*4)),
    ...Array.from({length:6},(_,i)=>job('J-'+(i+6),35+i*8))],
  four_season_capacity_profitability_scenario_evidence:{generated_at:at,source_queries_ok:true,
    coverage_complete:true,jobs_visible:true,scenarios:[scenario('spring_summer'),
      scenario('winter',{configured_route_capacity_headroom_minutes:null,missing_assumptions:['Original snow route evidence']})]},
  four_season_crew_day_mix_constraint_backtesting:{state:'current',source_health:[{freshness_state:'current',coverage_gap:false}]},
  workability_schedule_recovery_outcomes:{source_queries_ok:true,jobs_visible:true,
    summary:{constraint_episodes:2},outcomes:[episode('R-1',46,'blocked_unresolved',{work_order_id:'WO-1'}),
      episode('R-2',8,'rescheduled_pending',{dispatch_schedule_item_id:'DS-2'})]}};}
async function boot(page,initial=fixture()){
  await page.setViewportSize({width:390,height:844});
  await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
  await page.addStyleTag({content:css});
  await page.evaluate(d=>{window.__data=d;window.YWIAPI={loadAdminDirectory:async()=>window.__data};},initial);
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('[data-owner517-lane]')).toHaveCount(3);
}
async function refresh(page,next){await page.evaluate(d=>window.__data=d,next);await page.locator('#owner508Refresh').click();}

test('initial read gives three source-required packets, never invented zero exceptions',async({page})=>{
  await boot(page);
  await expect(page.locator('[data-owner517-state="source_required"]')).toHaveCount(3);
  await expect(page.locator('#owner517Economic')).toContainText('SOURCE RECHECK REQUIRED');
  await expect(page.locator('#owner517Review')).not.toContainText('0 Missing original lineage');
  await expect(page.locator('.owner517-review')).toHaveAttribute('data-style','field-command');
});
test('economic source-lineage changes yield a filterable undecided review packet',async({page})=>{
  const initial=fixture();await boot(page,initial);
  const next=fixture(minutes(2));next.owner_jobs=initial.owner_jobs.map(r=>({...r}));
  next.owner_jobs[0].id='J-<script>unsafe</script>';
  await refresh(page,next);
  const lane=page.locator('#owner517Economic');
  await expect(lane).toHaveAttribute('data-owner517-state','source_compared');
  await expect(lane.locator('[data-owner517-kind="lineage"]')).toHaveCount(2);
  await page.locator('#owner517EconomicFilter').selectOption('date_shift');
  await expect(lane.locator('[data-owner517-kind]')).toHaveCount(0);
  await page.locator('#owner517EconomicFilter').selectOption('lineage');
  const detail=lane.locator('details').first();await detail.locator('summary').focus();await page.keyboard.press('Enter');
  await expect(detail).toHaveAttribute('open','');
  await expect(detail).toContainText('Recover original Jobs ID');
  await expect(lane).toContainText('not an approved Finance disposition');
  expect(await page.evaluate(()=>document.querySelector('#owner517Review script'))).toBeNull();
});
test('seasonal closure proof distinguishes new gaps and returned-but-unsigned fields',async({page})=>{
  await boot(page);const next=fixture(minutes(2));
  next.four_season_capacity_profitability_scenario_evidence.scenarios[1]=scenario('winter',{
    planned_item_count:null,missing_assumptions:[]});
  await refresh(page,next);await page.locator('#owner505Season').selectOption('winter');
  const lane=page.locator('#owner517Seasonal');
  await expect(lane.locator('[data-owner517-kind="new"]')).toHaveCount(1);
  await expect(lane.locator('[data-owner517-kind="unsigned"]')).toHaveCount(2);
  await page.locator('#owner517SeasonalFilter').selectOption('unsigned');
  await expect(lane.locator('[data-owner517-kind]')).toHaveCount(2);
  await expect(lane).toContainText('not a signed owner closure');
  await expect(lane).toContainText('Owner follow-up evidence');
});
test('reliability packet preserves older service-date age without an SLA inference',async({page})=>{
  const initial=fixture();await boot(page,initial);
  const next=fixture(minutes(2));next.workability_schedule_recovery_outcomes.outcomes[0]=
    episode('R-1',46,'completed_after_recovery',{work_order_id:'WO-1',outcome_date:ago(1).slice(0,10),recovery_days:45});
  await refresh(page,next);const lane=page.locator('#owner517Reliability');
  await expect(lane.locator('[data-owner517-kind="unsigned"]')).toHaveCount(1);
  await expect(lane.locator('[data-owner517-age="older"]')).toHaveCount(1);
  await page.locator('#owner517ReliabilityFilter').selectOption('unsigned');
  await expect(lane.locator('[data-owner517-kind]')).toHaveCount(1);
  await expect(lane.locator('details').first()).toContainText('older service-date age');
  await expect(lane).toContainText('never against a receipt due date');
});
test('missing current seasonal source retains review, not approved gap disappearance',async({page})=>{
  await boot(page);const next=fixture(minutes(2));
  next.four_season_capacity_profitability_scenario_evidence.scenarios=[scenario('spring_summer')];
  await refresh(page,next);await page.locator('#owner505Season').selectOption('winter');
  const lane=page.locator('#owner517Seasonal');
  await page.locator('#owner517SeasonalFilter').selectOption('source_gap');
  await expect(lane.locator('[data-owner517-kind="source_gap"]')).toHaveCount(2);
  await expect(lane).toContainText('Restore canonical scenario');
});
test('permissions and stale sources clear all previously visible Build 517 packets',async({page})=>{
  await boot(page);const valid=fixture(minutes(2));await refresh(page,valid);
  await expect(page.locator('[data-owner517-state="source_compared"]')).toHaveCount(3);
  const withheld=fixture(minutes(1));withheld.source_visibility.finance=false;
  withheld.source_freshness.dispatch.freshness_state='stale';
  withheld.four_season_capacity_profitability_scenario_evidence.coverage_complete=false;
  await refresh(page,withheld);
  await expect(page.locator('[data-owner517-state="source_required"]')).toHaveCount(3);
  await expect(page.locator('#owner517Economic')).toContainText('Finance permission required');
  withheld.source_visibility.jobs=false;await refresh(page,withheld);
  await expect(page.locator('[data-owner517-lane]')).toHaveCount(0);
  await expect(page.locator('#owner517Review')).toContainText('Jobs permission required');
});
test('mobile field-command skin keeps links and focus accessible without horizontal overflow',async({page})=>{
  await boot(page);const first=page.locator('.yw517-jumps a').first();
  await first.focus();await expect(first).toBeFocused();
  const properties=await first.evaluate(el=>({outline:getComputedStyle(el).outlineStyle,
    width:el.getBoundingClientRect().width}));
  expect(properties.outline).not.toBe('none');expect(properties.width).toBeGreaterThan(40);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({width:1280,height:900});
  await expect(page.locator('.yw517-card')).toHaveCount(3);
});
