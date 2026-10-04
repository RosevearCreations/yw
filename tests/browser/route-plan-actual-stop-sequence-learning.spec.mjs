import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-owner-management-command-ui.js'),'utf8');
const now=()=>new Date().toISOString();
const meta=()=>({state:'current',confidence:'high',last_authoritative_update:now(),reason:'All required authoritative sources are current.'});

function fixture(){
  return {
    ok:true,
    source_visibility:{jobs:true,finance:false,safety:false,admin:false},
    source_freshness:{},
    management_metric_confidence:{route_sequence_learning:meta()},
    route_plan_actual_stop_sequence_learning:{
      generated_at:now(),timezone:'America/Toronto',lookback_days:90,
      summary:{
        loaded_item_evidence:8,route_days_reviewed:3,comparable_sequence_items:7,
        route_days_with_sequence_deviation:2,exact_sequence_route_days:1,
        stable_friction_pattern_routes:1,candidate_sequence_review_count:1,
        service_duration_overrun_items:2,recorded_delay_minutes:55,return_visit_items:1,
        planned_travel_allowance_minutes:90,recorded_crew_travel_minutes:66
      },
      route_day_comparisons:[{
        route_id:'r1',route_name:'North Route',service_date:'2026-10-01',season_context:'fall',
        stop_count:3,comparable_stop_count:3,exact_sequence:false,order_deviation_count:2,
        planned_sequence:[
          {dispatch_id:'d1',position:1,site_name:'Maple Site'},
          {dispatch_id:'d2',position:2,site_name:'Oak Site'},
          {dispatch_id:'d3',position:3,site_name:'Pine Site'}
        ],
        recorded_start_sequence:[
          {dispatch_id:'d2',position:1,site_name:'Oak Site',actual_start_at:'2026-10-01T13:00:00Z'},
          {dispatch_id:'d1',position:2,site_name:'Maple Site',actual_start_at:'2026-10-01T14:00:00Z'},
          {dispatch_id:'d3',position:3,site_name:'Pine Site',actual_start_at:'2026-10-01T15:00:00Z'}
        ],
        service_duration_overrun_count:1,recorded_delay_minutes:25,return_visit_count:1,workability_effect_count:0,
        planned_travel_allowance_minutes:45,recorded_crew_travel_minutes:32,recorded_crew_travel_coverage_count:3,
        friction_types:['recorded stop order differed','recorded delay','return visit required']
      }],
      stable_friction_patterns:[{
        route_id:'r1',route_name:'North Route',service_days:3,order_deviation_service_days:2,
        duration_overrun_service_days:2,delay_service_days:2,return_visit_service_days:1,workability_effect_service_days:0,
        repeated_friction_types:['stop order differed on multiple service dates','recorded delay on multiple service dates']
      }],
      candidate_sequence_reviews:[{
        route_id:'r1',route_name:'North Route',planned_position:1,recorded_start_position:2,
        repeat_service_date_count:2,service_dates:['2026-09-30','2026-10-01'],sample_sites:['Maple Site'],
        review_reason:'The same planned position and recorded production-start position differed on multiple service dates. Review sequencing context only; do not auto-reorder.'
      }],
      source_scope_boundary:'Learning is derived only from the bounded Build 354 route evidence already loaded from Dispatch, Production, Timekeeping, Workability and Route sources. Missing production start, duration or travel evidence stays missing.',
      travel_boundary:'Planned travel allowance and recorded crew travel minutes are shown side by side only. YW does not treat crew travel time as vehicle elapsed time and does not invent GPS or travel facts.',
      learning_boundary:'A stable pattern means the same recorded friction type occurred on at least two service dates for a route. A sequencing review candidate requires the same planned-position to recorded-start-position difference on at least two dates; it is not a routing recommendation.',
      performance_boundary:'Plan-versus-actual learning is route-day operational evidence only. It does not score, rank or infer individual employee performance.',
      authority_boundary:'Read-only learning only. Routing and Dispatch remain operator authorities; this layer cannot rewrite routes, reorder stops, dispatch work, change Workability decisions or mutate source records.'
    },
    four_season_capacity_forecast:null,
    workability_schedule_recovery_outcomes:null,
    route_crew_efficiency_evidence:null,
    recurring_renewal_retention_workbench:null,
    estimate_to_cash_leakage_workbench:null,
    labour_equipment_fleet_utilization_support:null,
    materials_consumables_seasonal_stock_readiness:null,
    customer_communication_readiness_queue:null,
    data_quality_duplicate_orphan_reconciliation:null
  };
}

async function boot(page,data=fixture()){
  await page.setViewportSize({width:390,height:900});
  await page.setContent('<!doctype html><html><head></head><body><section id="admin"></section></body></html>');
  await page.evaluate(payload=>{
    window.YWIRouter={showSection:s=>window.__route=s};
    window.YWIAdminHub={open:s=>window.__group=s};
    window.YWIAPI={loadAdminDirectory:async()=>payload};
  },data);
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner365Sequence')).toBeVisible();
}

test('Build 365 renders repeated route-day plan-vs-actual learning',async({page})=>{
  await boot(page);
  const host=page.locator('#owner365Sequence');
  await expect(host).toContainText('Comparable stop evidence');
  await expect(host).toContainText('Route days with order difference');
  await expect(host).toContainText('North Route');
  await expect(host).toContainText('Plan: 1. Maple Site → 2. Oak Site → 3. Pine Site');
  await expect(host).toContainText('Recorded starts: 1. Oak Site → 2. Maple Site → 3. Pine Site');
  await host.getByText('Stable route-day friction patterns').click();
  await expect(host).toContainText('stop order differed on multiple service dates');
  await host.getByText('Candidate sequencing review').click();
  await expect(host.locator('[data-owner365-candidate="r1"]')).toContainText('planned 1 → recorded start 2');
  await expect(host).toContainText('do not auto-reorder');
  await expect(host).toContainText('does not invent GPS or travel facts');
  await expect(host).toContainText('does not score, rank or infer individual employee performance');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});

test('Build 365 remains permission-aware and cannot become routing authority',async({page})=>{
  const data=fixture();
  data.source_visibility.jobs=false;
  data.management_metric_confidence.route_sequence_learning={state:'unavailable',confidence:'unavailable',reason:'Jobs evidence hidden.'};
  await boot(page,data);
  const host=page.locator('#owner365Sequence');
  await expect(host).toContainText('Jobs/operations evidence is unavailable');
  await expect(host.locator('[data-owner365-candidate]')).toHaveCount(0);
  await expect(page.locator('.owner365-sequence')).toContainText('never automatic route changes');
  await expect(page.locator('.owner365-sequence')).toContainText('No worker scoring');
  await expect(page.locator('.owner365-sequence')).toContainText('stop reordering');
  await expect(page.locator('.owner365-sequence')).toContainText('dispatch mutation');
});
