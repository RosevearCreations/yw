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

test('initial navigation requires source recheck and never invents owner approval',async({page})=>{
 await boot(page);
 const nav=page.locator('#owner520Navigation');
 await expect(nav.locator('[data-owner520-lane]')).toHaveCount(3);
 await expect(nav.locator('[data-owner520-state="source_required"]')).toHaveCount(3);
 await expect(nav).toContainText('SOURCE RECHECK REQUIRED');
 await expect(nav).not.toContainText('0 approved');
 await expect(page.locator('.owner520-navigation')).toContainText('Seek separate owner decision');
});
test('guided navigation focus changes only its own map and keeps real review links',async({page})=>{
 await boot(page);await refresh(page,fixture(minutes(2)));
 await expect(page.locator('[data-owner520-state="source_compared"]')).toHaveCount(3);
 await page.locator('#owner520Focus').selectOption('capacity');
 const lane=page.locator('[data-owner520-lane="capacity"]');
 await expect(page.locator('#owner520Navigation [data-owner520-lane]')).toHaveCount(1);
 await expect(lane.locator('a[href="#owner375Scenarios"]')).toHaveCount(1);
 await expect(lane.locator('a[href="#owner517Seasonal"]')).toHaveCount(1);
 await expect(lane.locator('a[href="#owner518Seasonal"]')).toHaveCount(1);
 await expect(page.locator('[data-owner518-lane]')).toHaveCount(0);
 await expect(page.locator('#owner518Seasonal')).toHaveCount(1);
 await page.locator('#owner520Focus').selectOption('all');
 await expect(page.locator('#owner520Navigation [data-owner520-lane]')).toHaveCount(3);
});
test('economic membership change shows only observed evidence, not approved disposition',async({page})=>{
 const initial=fixture();await boot(page,initial);
 const next=fixture(minutes(2));next.owner_jobs=initial.owner_jobs.map(x=>({...x}));
 next.owner_jobs[0].id='J-<script>unsafe</script>';
 await refresh(page,next);
 const lane=page.locator('[data-owner520-lane="economic"]');
 await expect(lane).toHaveAttribute('data-owner520-state','source_compared');
 await expect(lane).toContainText('2 source changes observed in this session');
 await expect(lane).toContainText('INDEPENDENT REVIEW · NOT APPROVED');
 expect(await page.evaluate(()=>document.querySelector('#owner520Navigation script'))).toBeNull();
});
test('season selector updates navigation without changing focus or authorizing closure',async({page})=>{
 await boot(page);await refresh(page,fixture(minutes(2)));
 await page.locator('#owner520Focus').selectOption('reliability');
 await page.locator('#owner505Season').selectOption('winter');
 await expect(page.locator('#owner520Focus')).toHaveValue('reliability');
 await expect(page.locator('#owner520Navigation [data-owner520-lane]')).toHaveCount(1);
 await expect(page.locator('[data-owner520-lane="reliability"]')).toContainText('not a signed owner receipt');
 await expect(page.locator('.owner520-navigation .yw520-boundary')).toContainText('QL-269 remains');
});
test('loss of Finance or Jobs access withholds details after prior paired source read',async({page})=>{
 await boot(page);await refresh(page,fixture(minutes(2)));
 const restricted=fixture(minutes(1));restricted.source_visibility.finance=false;
 await refresh(page,restricted);
 await expect(page.locator('[data-owner520-lane="economic"]')).toHaveAttribute('data-owner520-state','permission_hidden');
 await expect(page.locator('[data-owner520-lane="economic"]')).toContainText('FINANCE ACCESS REQUIRED');
 restricted.source_visibility.jobs=false;await refresh(page,restricted);
 await expect(page.locator('#owner520Navigation')).toContainText('Jobs permission required');
 await expect(page.locator('#owner520Navigation [data-owner520-lane]')).toHaveCount(0);
});
test('keyboard focus, mobile containment and desktop card hierarchy',async({page})=>{
 await boot(page);
 const first=page.locator('.owner520-navigation .yw520-quick a').first();
 await first.focus();await expect(first).toBeFocused();
 expect(await first.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
 const select=page.locator('#owner520Focus');await select.focus();await expect(select).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.setViewportSize({width:1280,height:900});
 await expect(page.locator('.owner520-navigation .yw520-card')).toHaveCount(3);
});
