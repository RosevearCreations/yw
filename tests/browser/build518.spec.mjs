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

test('first read cannot imply decision readiness or zero outstanding cases',async({page})=>{
  await boot(page);
  await expect(page.locator('[data-owner518-state="source_required"]')).toHaveCount(3);
  await expect(page.locator('#owner518Readiness')).toContainText('INDEPENDENT SOURCE RECHECK REQUIRED');
  await expect(page.locator('#owner518Readiness')).not.toContainText('Approved closure');
});
test('economic lineage changes identify separate Finance review and keyboard-selectable filters',async({page})=>{
  const initial=fixture();await boot(page,initial);
  const next=fixture(minutes(2));next.owner_jobs=initial.owner_jobs.map(j=>({...j}));
  next.owner_jobs[0].id='J-<script>unsafe</script>';
  await refresh(page,next);
  const lane=page.locator('#owner518Economic');
  await expect(lane).toHaveAttribute('data-owner518-state','independent_review_required');
  await expect(lane.locator('[data-owner518-kind="lineage"]')).toHaveCount(2);
  await page.locator('#owner518EconomicFilter').selectOption('date_shift');
  await expect(lane.locator('[data-owner518-kind]')).toHaveCount(0);
  await page.locator('#owner518EconomicFilter').selectOption('lineage');
  const detail=lane.locator('details').first();await detail.locator('summary').focus();
  await page.keyboard.press('Enter');await expect(detail).toHaveAttribute('open','');
  await expect(detail).toContainText('Recover original Jobs ID');
  await expect(lane).toContainText('INDEPENDENT REVIEW REQUIRED · NOT APPROVED');
  expect(await page.evaluate(()=>document.querySelector('#owner518Readiness script'))).toBeNull();
});
test('seasonal owner closure continuity never treats a disappeared flag as signed closure',async({page})=>{
  await boot(page);const next=fixture(minutes(2));
  next.four_season_capacity_profitability_scenario_evidence.scenarios[1]=
    scenario('winter',{planned_item_count:null,missing_assumptions:[]});
  await refresh(page,next);await page.locator('#owner505Season').selectOption('winter');
  const lane=page.locator('#owner518Seasonal');
  await expect(lane.locator('[data-owner518-kind="new"]')).toHaveCount(1);
  await expect(lane.locator('[data-owner518-kind="unsigned"]')).toHaveCount(2);
  await page.locator('#owner518SeasonalFilter').selectOption('unsigned');
  await expect(lane.locator('[data-owner518-kind]')).toHaveCount(2);
  await expect(lane).toContainText('independently signed owner closure remain required');
});
test('completed Workability episode remains unsigned, with original-source link and age information',async({page})=>{
  const initial=fixture();await boot(page,initial);
  const next=fixture(minutes(2));
  next.workability_schedule_recovery_outcomes.outcomes[0]=episode('R-1',46,'completed_after_recovery',
    {work_order_id:'WO-1',outcome_date:ago(1).slice(0,10),recovery_days:45});
  await refresh(page,next);
  await page.locator('#owner518ReceiptFilter').selectOption('unsigned');
  const lane=page.locator('#owner518Reliability');
  await expect(lane.locator('[data-owner518-kind="unsigned"]')).toHaveCount(1);
  await expect(lane).toContainText('COMPLETION RECORDED · UNSIGNED');
  await expect(lane).toContainText('Over 30 recorded calendar days');
  await expect(lane.locator('a[href="#owner364Recovery"]')).toBeVisible();
});
test('permission and stale source changes clear prior evidence, rather than retaining cases',async({page})=>{
  await boot(page);await refresh(page,fixture(minutes(2)));
  await expect(page.locator('[data-owner518-state="independent_review_required"]')).toHaveCount(3);
  const next=fixture(minutes(1));next.source_visibility.finance=false;
  next.source_freshness.dispatch.freshness_state='stale';
  next.four_season_capacity_profitability_scenario_evidence.coverage_complete=false;
  await refresh(page,next);
  await expect(page.locator('#owner518Economic')).toHaveAttribute('data-owner518-state','permission_hidden');
  await expect(page.locator('[data-owner518-state="source_required"]')).toHaveCount(2);
  next.source_visibility.jobs=false;await refresh(page,next);
  await expect(page.locator('#owner518Readiness')).toContainText('Jobs permission required');
  await expect(page.locator('#owner518Readiness [data-owner518-kind]')).toHaveCount(0);
});
test('mobile and desktop forest/gold review controls remain keyboard accessible',async({page})=>{
  await boot(page);
  const link=page.locator('.owner518-readiness .yw518-header nav a').first();
  await link.focus();await expect(link).toBeFocused();
  const outline=await link.evaluate(el=>getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({width:1280,height:900});
  await expect(page.locator('.yw518-card')).toHaveCount(3);
});
