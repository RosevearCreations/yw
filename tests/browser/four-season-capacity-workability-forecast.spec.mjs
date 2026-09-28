import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-owner-management-command-ui.js'),'utf8');
const now=()=>new Date().toISOString();
const meta=()=>({state:'current',confidence:'high',last_authoritative_update:now(),reason:'All required authoritative sources are current.'});
function day(date,state,season,extra={}){
  return {
    date,horizon_day:1,readiness_state:state,readiness_reason:state==='blocked'?'1 workability restriction/block signal(s)':'No loaded blocker signal for this date',
    dispatch_count:1,recurring_visit_count:1,total_planned_items:2,recorded_demand_minutes:240,
    active_crew_count:3,scheduled_crew_count:2,unassigned_dispatch_count:0,unresolved_dispatch_conflict_count:0,
    required_equipment_count:2,ready_equipment_count:2,equipment_attention_count:0,fleet_ready_equipment_count:5,fleet_equipment_attention_count:1,workability_blocked_count:state==='blocked'?1:0,workability_review_count:0,
    storm_event_count:season==='winter'?1:0,storm_route_count:season==='winter'?1:0,seasonal_due_count:0,
    season_load:{spring_summer:season==='spring_summer'?2:0,fall:season==='fall'?2:0,winter:season==='winter'?2:0,four_season:season==='four_season'?2:0},
    ...extra
  };
}
function fixture(){
  const days=[
    day('2026-09-28','ready','spring_summer'),
    day('2026-09-29','attention','fall',{equipment_attention_count:1,readiness_reason:'1 equipment readiness attention item(s)'}),
    day('2026-09-30','blocked','winter'),
    day('2026-10-01','review','four_season',{workability_review_count:1,readiness_reason:'1 workability review signal(s)'}),
    ...Array.from({length:10},(_,i)=>day('2026-10-'+String(i+2).padStart(2,'0'),'ready','four_season'))
  ];
  return {
    ok:true,source_visibility:{jobs:true,finance:false,safety:false,admin:false},
    source_freshness:{},
    management_metric_confidence:{
      capacity_forecast:meta(),crews_today:meta(),completion_today:meta(),schedule_risk:meta(),revenue:{state:'unavailable',confidence:'unavailable'},gross_margin:{state:'unavailable',confidence:'unavailable'},labour_utilization:{state:'unavailable',confidence:'unavailable'},receivables:{state:'unavailable',confidence:'unavailable'},cash_bank:{state:'unavailable',confidence:'unavailable'},recurring_completion:meta(),winter_operations:meta(),fall_cleanup:meta(),safety_blockers:{state:'unavailable',confidence:'unavailable'},equipment_blockers:meta(),workforce_blockers:{state:'unavailable',confidence:'unavailable'},finance_readiness:{state:'unavailable',confidence:'unavailable'}
    },
    four_season_capacity_forecast:{
      generated_at:now(),timezone:'America/Toronto',days,
      windows:{seven_day:{days:7,planned_items:14,recorded_demand_minutes:1680,blocked_days:1,attention_days:1,review_days:1,ready_days:4,peak_date:'2026-09-28',peak_recorded_demand_minutes:240},fourteen_day:{days:14,planned_items:28,recorded_demand_minutes:3360,blocked_days:1,attention_days:1,review_days:1,ready_days:11,peak_date:'2026-09-28',peak_recorded_demand_minutes:240}},
      capacity_method:'Evidence-only forecast: planned work, assigned crews, recorded durations, equipment readiness, stored workability evidence and seasonal operations. No jobs-per-crew target or external weather forecast is assumed.',
      weather_boundary:'Uses stored YW workability observations/rules and seasonal evidence only; no external weather provider is queried.',
      authority_boundary:'Advisory only. Forecasting does not dispatch crews, rewrite routes, change workability decisions, unlock equipment, send messages or mutate provider state.'
    },
    owner_jobs:[],owner_dispatch:[],owner_production:[],owner_profitability:[],owner_timekeeping_summary:[],owner_recurring:[],owner_recurring_visits:[],owner_crews:[],
    owner_storms:[],owner_storm_routes:[],owner_seasonal_work:[],owner_safety:[],owner_equipment:[],owner_maintenance:[],owner_training_summary:[],owner_workforce_summary:[],
    owner_receivables:[],owner_bank:[],owner_finance_exceptions:[],owner_close_dashboard:[],owner_workability:[]
  };
}
async function boot(page,data=fixture()){
  await page.setViewportSize({width:390,height:844});
  await page.setContent('<!doctype html><html><head></head><body><section id="admin"></section></body></html>');
  await page.evaluate(payload=>{
    window.YWIRouter={showSection:s=>window.__route=s};
    window.YWIAdminHub={open:s=>window.__group=s};
    window.YWIAPI={loadAdminDirectory:async()=>payload};
  },data);
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner353Forecast')).toBeVisible();
}
test('Build 353 renders 7/14 day four-season readiness without invented capacity',async({page})=>{
  await boot(page);
  const host=page.locator('#owner353Forecast');
  await expect(host).toContainText('7-day planned');
  await expect(host).toContainText('14-day planned');
  await expect(host).toContainText('28.0 h recorded demand');
  await expect(host).toContainText('56.0 h recorded demand');
  await expect(host).toContainText('Spring/summer');
  await expect(host).toContainText('Fall');
  await expect(host).toContainText('Winter');
  await expect(host).toContainText('Four-season');
  await expect(host).toContainText('No jobs-per-crew target or external weather forecast is assumed');
  await expect(host.locator('[data-owner353-state="blocked"]')).toContainText('workability restriction');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});
test('Build 353 keeps forecast advisory and permission-aware',async({page})=>{
  const data=fixture();data.source_visibility.jobs=false;data.management_metric_confidence.capacity_forecast={state:'unavailable',confidence:'unavailable',reason:'Jobs evidence hidden.'};
  await boot(page,data);
  const host=page.locator('#owner353Forecast');
  await expect(host).toContainText('Jobs/operations evidence is unavailable');
  await expect(page.locator('.owner353-day')).toHaveCount(0);
  await expect(page.locator('.owner353-forecast')).toContainText('does not auto-dispatch or change source records');
});
