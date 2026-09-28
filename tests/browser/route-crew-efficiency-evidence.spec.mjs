import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-owner-management-command-ui.js'),'utf8');
const now=()=>new Date().toISOString();
const meta=()=>({state:'current',confidence:'high',last_authoritative_update:now(),reason:'All required authoritative sources are current.'});
function fixture(){
  return {
    ok:true,
    source_visibility:{jobs:true,finance:false,safety:false,admin:true},
    source_freshness:{},
    management_metric_confidence:{
      route_efficiency:meta(),capacity_forecast:{state:'missing',confidence:'low',reason:'No forecast fixture.'},
      crews_today:meta(),completion_today:meta(),schedule_risk:meta(),
      revenue:{state:'unavailable',confidence:'unavailable'},gross_margin:{state:'unavailable',confidence:'unavailable'},
      labour_utilization:{state:'unavailable',confidence:'unavailable'},receivables:{state:'unavailable',confidence:'unavailable'},
      cash_bank:{state:'unavailable',confidence:'unavailable'},recurring_completion:meta(),winter_operations:meta(),fall_cleanup:meta(),
      safety_blockers:{state:'unavailable',confidence:'unavailable'},equipment_blockers:meta(),workforce_blockers:{state:'unavailable',confidence:'unavailable'},
      finance_readiness:{state:'unavailable',confidence:'unavailable'}
    },
    four_season_capacity_forecast:null,
    route_crew_efficiency_evidence:{
      generated_at:now(),timezone:'America/Toronto',lookback_days:90,
      summary:{
        planned_items:8,items_with_actual_service_evidence:6,service_duration_overrun_items:2,route_order_deviation_items:1,
        return_visit_items:1,recorded_delay_minutes:45,workability_effect_items:1,recorded_crew_travel_coverage_items:4,
        repeated_route_friction_count:1,clustering_opportunity_count:1,route_days_with_configured_capacity_headroom:2
      },
      route_days:[{
        route_id:'r1',route_name:'North Route',service_date:'2026-09-27',season_context:'fall',
        planned_item_count:4,planned_service_minutes:240,planned_travel_allowance_minutes:60,planned_demand_minutes:300,
        configured_daily_capacity_minutes:480,configured_capacity_headroom_minutes:180,over_configured_capacity_minutes:0,
        actual_service_minutes:265,actual_crew_hours:8.5,delay_minutes:30,return_visit_count:1,route_order_deviation_count:1,
        workability_effect_count:1,friction_item_count:2
      }],
      repeated_route_friction:[{
        route_id:'r1',route_name:'North Route',service_days:4,friction_service_date_count:2,delay_minutes:45,
        return_visit_count:1,route_order_deviation_count:1,workability_effect_count:1
      }],
      clustering_opportunities:[{
        service_date:'2026-09-27',city:'Tillsonburg',planned_item_count:3,route_count:2,route_names:['North Route','South Route'],
        advisory_reason:'Multiple planned stops in the same city are split across routes; review clustering only if service windows, equipment and dispatch authority allow it.'
      }],
      item_evidence:[],
      comparison_boundary:'Service-duration variance uses recorded planned duration versus recorded production duration. Planned travel allowance is shown beside linked crew travel minutes, but no direct travel variance is inferred because crew-time travel is not the same measure as vehicle elapsed travel.',
      clustering_boundary:'Clustering is advisory evidence only. It identifies same-day city overlap across existing routes and never rewrites route membership or stop order.',
      performance_boundary:'Crew and route evidence is operational context only. It does not score, rank or infer individual employee performance.',
      authority_boundary:'Read-only evidence. Routing and dispatch remain the existing operator authorities; Build 354 does not mutate schedules, routes, workability decisions or source records.'
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
  await expect(page.locator('#owner354Efficiency')).toBeVisible();
}
test('Build 354 renders route and crew efficiency evidence without worker scoring',async({page})=>{
  await boot(page);
  const host=page.locator('#owner354Efficiency');
  await expect(host).toContainText('Actual service coverage');
  await expect(host).toContainText('Duration overruns');
  await expect(host).toContainText('Route-order differences');
  await expect(host).toContainText('North Route');
  await expect(host).toContainText('Tillsonburg');
  await expect(host).toContainText('configured headroom');
  await expect(host).toContainText('does not score, rank or infer individual employee performance');
  await expect(page.locator('.owner354-efficiency')).toContainText('does not rank workers, rewrite routes or change dispatch');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});
test('Build 354 remains permission-aware when Jobs evidence is hidden',async({page})=>{
  const data=fixture();
  data.source_visibility.jobs=false;
  data.management_metric_confidence.route_efficiency={state:'unavailable',confidence:'unavailable',reason:'Jobs evidence hidden.'};
  await boot(page,data);
  await expect(page.locator('#owner354Efficiency')).toContainText('Jobs/operations evidence is unavailable');
  await expect(page.locator('#owner354Efficiency')).not.toContainText('North Route');
});
