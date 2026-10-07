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
    management_metric_confidence:{material_usage_variance_reorder_calibration:meta()},
    material_usage_variance_reorder_calibration:{
      generated_at:now(),source_queries_ok:true,jobs_visible:true,
      summary:{
        planned_lines_with_actual_evidence:5,comparable_lines:4,unit_mismatch_lines:1,
        over_use_lines:2,under_use_lines:1,on_plan_lines:1,repeated_over_use_patterns:1,
        repeated_under_use_patterns:0,stockout_materials:1,reorder_review_materials:2,
        issue_linked_actual_events:3,production_actual_events:2
      },
      service_season_summary:[
        {service_context:'snow_clearing_removal',season_context:'winter',lines_with_actual_evidence:3,comparable_lines:2,unit_mismatch_lines:1,over_use_lines:2,under_use_lines:0,on_plan_lines:0},
        {service_context:'landscape_installation',season_context:'spring_summer',lines_with_actual_evidence:2,comparable_lines:2,unit_mismatch_lines:0,over_use_lines:0,under_use_lines:1,on_plan_lines:1}
      ],
      calibration_attention:[
        {
          service_context:'snow_clearing_removal',season_context:'winter',material_id:'mat-salt',
          material_sku:'SALT-BAG',material_label:'Salt / De-icer',material_category:'winter',
          compared_line_count:2,planned_quantity_total:20,actual_quantity_total:28,variance_quantity_total:8,variance_percent:40,
          over_use_line_count:2,under_use_line_count:0,on_plan_line_count:0,repeated_over_use:true,repeated_under_use:false,
          issue_linked_event_count:2,production_actual_event_count:1,stock_on_hand:0,stock_unit:'bag',
          reorder_point:5,reorder_quantity:20,target_stock_quantity:30,stock_status:'reorder',stockout_evidence:true,reorder_evidence:true,
          review_state:'repeated_over_use_with_stock_pressure',
          suggested_next_action:'Review the recorded estimator assumptions, actual-use evidence and current Materials Control reorder/target settings. No setting is changed by this evidence layer.'
        }
      ],
      pattern_evidence:[],
      line_variance_evidence:[
        {
          material_estimate_line_id:'line-371a',estimator_code:'MAT-371-A',material_id:'mat-salt',material_sku:'SALT-BAG',
          material_label:'Salt / De-icer',service_context:'snow_clearing_removal',season_context:'winter',
          planned_quantity:10,planned_unit:'bag',recorded_actual_event_count:1,compatible_actual_event_count:1,unit_mismatch_event_count:0,
          comparison_complete:true,actual_quantity_planned_unit:14,variance_quantity:4,variance_percent:40,variance_direction:'over_use',
          issue_linked_event_count:1,production_actual_event_count:0
        },
        {
          material_estimate_line_id:'line-371b',estimator_code:'MAT-371-B',material_id:'mat-salt',material_sku:'SALT-BAG',
          material_label:'Salt / De-icer',service_context:'snow_clearing_removal',season_context:'winter',
          planned_quantity:8,planned_unit:'bag',recorded_actual_event_count:1,compatible_actual_event_count:0,unit_mismatch_event_count:1,
          comparison_complete:false,actual_quantity_planned_unit:null,variance_quantity:null,variance_percent:null,variance_direction:'not_comparable',
          issue_linked_event_count:0,production_actual_event_count:1
        }
      ],
      comparison_boundary:'Planned quantity comes from canonical Landscape Material Estimator lines. Actual use comes only from recorded actual-use events; variance is calculated only when every recorded event on the line uses the planned unit or carries a non-default explicit conversion factor to the planned unit. Any unresolved unit mismatch withholds that line variance.',
      repeat_boundary:'Repeated over-use or under-use means at least two comparable estimator lines for the same material, service context and season with the same variance direction. No hidden percentage threshold or target usage rate is invented.',
      stock_boundary:'Stockout and reorder evidence reuses current canonical Materials Control stock_on_hand, reorder_required, reorder_point, reorder_quantity and target_stock_quantity. Missing settings stay missing and no replacement reorder value is calculated.',
      source_boundary:'Issue-linked actual-use events are counted separately from production actual-use events that have no material_issue_id so recorded inventory issues and production consumption evidence remain distinguishable.',
      authority_boundary:'Read-only calibration evidence. This layer cannot edit estimator assumptions, actual-use events, inventory quantities, reorder points, reorder quantities or target stock; it cannot create purchase orders, contact suppliers, reserve stock or create vendor commitments.'
    },
    four_season_capacity_forecast:null,workability_schedule_recovery_outcomes:null,
    route_crew_efficiency_evidence:null,route_plan_actual_stop_sequence_learning:null,
    recurring_renewal_retention_workbench:null,recurring_renewal_conversion_churn_outcomes:null,
    estimate_to_cash_leakage_workbench:null,estimate_accuracy_change_order_margin_calibration:null,
    completed_to_invoiced_cycle_time_cash_conversion:null,labour_equipment_fleet_utilization_support:null,
    equipment_downtime_cost_replacement_readiness:null,labour_capture_completeness_payroll_exception_reduction:null,
    materials_consumables_seasonal_stock_readiness:null,customer_communication_readiness_queue:null,
    data_quality_duplicate_orphan_reconciliation:null,
    owner_jobs:[],owner_dispatch:[],owner_production:[],owner_profitability:[],owner_timekeeping_summary:[],
    owner_recurring:[],owner_recurring_visits:[],owner_crews:[],owner_storms:[],owner_storm_routes:[],
    owner_seasonal_work:[],owner_safety:[],owner_equipment:[],owner_maintenance:[],owner_training_summary:[],
    owner_workforce_summary:[],owner_receivables:[],owner_bank:[],owner_finance_exceptions:[],owner_close_dashboard:[],
    owner_workability:[],owner_equipment_use:[],owner_fleet:[],owner_material_stock:[],owner_material_plans:[],
    owner_crm_followups:[],owner_notification_delivery:[],owner_closeouts:[],owner_crm_properties:[]
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
  await expect(page.locator('#owner371MaterialVariance')).toBeVisible();
}

test('Build 371 renders repeated variance with stock and reorder evidence without changing thresholds',async({page})=>{
  await boot(page);
  const host=page.locator('#owner371MaterialVariance');
  await expect(host).toContainText('Comparable planned/actual');
  await expect(host).toContainText('4');
  await expect(host).toContainText('Unit mismatch lines');
  await expect(host).toContainText('SALT-BAG · Salt / De-icer · repeated over use with stock pressure');
  await expect(host).toContainText('snow_clearing_removal · winter · 2 comparable line(s)');
  await expect(host).toContainText('planned 20 · actual 28 · 8 bag (40.0%)');
  await expect(host).toContainText('stock 0 bag · reorder point 5 · reorder qty 20 · target 30');
  await expect(host).toContainText('No setting is changed by this evidence layer.');
  await host.getByText('Comparison, repeat, stock & authority boundaries').click();
  await expect(host).toContainText('Any unresolved unit mismatch withholds that line variance');
  await expect(host).toContainText('at least two comparable estimator lines');
  await expect(host).toContainText('no replacement reorder value is calculated');
  await expect(host).toContainText('cannot create purchase orders');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});

test('Build 371 keeps unit mismatch lines explicit instead of computing variance',async({page})=>{
  await boot(page);
  const host=page.locator('#owner371MaterialVariance');
  await host.getByText('Line-level planned vs recorded actual evidence').click();
  const line=host.locator('[data-owner371-line="line-371b"]');
  await expect(line).toContainText('variance withheld · 1 unit-mismatch event(s)');
  await expect(line).toContainText('0 issue-linked actual event(s) · 1 production actual event(s)');
  await expect(line).not.toContainText('under use');
});

test('Build 371 Materials button routes deliberately to Jobs',async({page})=>{
  await boot(page);
  await page.locator('.owner371-material-variance button').filter({hasText:'Open Materials'}).click();
  await page.waitForTimeout(10);
  expect(await page.evaluate(()=>window.__route)).toBe('admin');
  expect(await page.evaluate(()=>window.__group)).toBe('jobs');
});
