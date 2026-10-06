import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'js/admin-owner-management-command-ui.js'),'utf8');
const now=()=>new Date().toISOString();
const meta=()=>({state:'current',confidence:'high',last_authoritative_update:now(),reason:'All required authoritative sources are current.'});

function fixture(){
  return {
    ok:true,
    source_visibility:{jobs:true,finance:true,safety:false,admin:false},
    source_freshness:{},
    management_metric_confidence:{estimate_accuracy_calibration:meta()},
    estimate_accuracy_change_order_margin_calibration:{
      generated_at:now(),timezone:'America/Toronto',source_queries_ok:true,jobs_visible:true,finance_visible:true,
      summary:{
        accepted_estimates_reviewed:3,work_orders_with_accepted_baseline_snapshot:3,comparison_ready_jobs:3,
        approved_change_orders:2,approved_applied_change_orders:1,
        comparable_labour_cost_jobs:3,comparable_material_cost_jobs:2,comparable_equipment_cost_jobs:2,
        labour_hours_comparable_jobs:3,margin_comparable_jobs:3,recurring_calibration_pattern_count:2
      },
      component_summary:[
        {component:'labour',comparable_jobs:3,estimated_cost_total:900,actual_cost_total:1110,cost_variance_total:210,adverse_jobs:2,favorable_jobs:1,exact_jobs:0},
        {component:'material',comparable_jobs:2,estimated_cost_total:500,actual_cost_total:560,cost_variance_total:60,adverse_jobs:2,favorable_jobs:0,exact_jobs:0},
        {component:'equipment',comparable_jobs:2,estimated_cost_total:220,actual_cost_total:200,cost_variance_total:-20,adverse_jobs:0,favorable_jobs:2,exact_jobs:0}
      ],
      recurring_calibration_patterns:[
        {template_key:'SPRING-CLEANUP',pattern_type:'component_cost_variance',component:'labour',direction:'actual_cost_above_estimate',occurrence_count:2,comparable_count:3,recorded_variance_total:240,review_note:'Repeated recorded variance is a calibration review signal only; estimate assumptions are not changed automatically.'},
        {template_key:'SPRING-CLEANUP',pattern_type:'recorded_margin_variance',component:'margin',direction:'actual_margin_below_recorded_estimate_margin',occurrence_count:2,comparable_count:3,recorded_variance_total:-8.5,review_note:'This compares recorded estimate margin with recorded actual margin; it is not a target-margin recommendation.'}
      ],
      calibration_records:[{
        estimate_id:'e367',estimate_number:'EST-367',work_order_id:'wo367',work_order_number:'WO-367',legacy_job_id:367,
        client_name:'Maple Customer',site_name:'Maple Site',template_key:'SPRING-CLEANUP',template_code:'SPRING-CLEANUP',template_name:'Spring Cleanup',
        baseline_snapshot_version:4,baseline_source:'accepted_work_order_assumption_snapshot',baseline_cost_total:650,
        approved_applied_change_order_count:1,approved_change_order_count:2,approved_applied_estimated_cost_delta:75,
        approved_applied_estimated_charge_delta:125,approved_applied_actual_cost_delta:80,approved_applied_actual_charge_delta:125,
        adjusted_baseline_cost_total:725,actual_known_cost_total:815,total_cost_variance:90,
        estimated_margin_percent:28,actual_margin_percent:23.5,margin_variance_percentage_points:-4.5,
        estimated_labour_hours:8,recorded_production_labour_hours:9.5,labour_hours_variance:1.5,
        component_cost_variance:[
          {component:'labour',estimated_cost:300,actual_cost:390,comparable:true,cost_variance:90,cost_variance_percent:30},
          {component:'material',estimated_cost:250,actual_cost:290,comparable:true,cost_variance:40,cost_variance_percent:16},
          {component:'equipment',estimated_cost:100,actual_cost:85,comparable:true,cost_variance:-15,cost_variance_percent:-15}
        ],
        assumption_unit_evidence:[
          {assumption_type:'labour',source_unit_labels:['hours'],source_quantity_total:8,quantity_aggregation_state:'same_recorded_unit'},
          {assumption_type:'material',source_unit_labels:['bags','m³'],source_quantity_total:null,quantity_aggregation_state:'not_aggregated_due_to_missing_or_mixed_units'},
          {assumption_type:'equipment',source_unit_labels:['hours'],source_quantity_total:2,quantity_aggregation_state:'same_recorded_unit'}
        ],
        production_session_count:2,completion_evidence_recorded:true,production_material_issue_count:3,production_equipment_signout_count:1,
        finance_cost_event_count:4,comparison_ready:true
      }],
      baseline_boundary:'Accepted work-order assumption snapshots are preferred for baseline cost by type. Current estimate assumptions are only a fallback when no accepted snapshot exists, and the source is disclosed on each record.',
      unit_boundary:'Recorded assumption unit labels are preserved exactly. Labour quantity variance is calculated only between recorded estimate labour hours and recorded Production labour hours; material and equipment quantities are not converted or compared across mixed or missing units.',
      change_order_boundary:'Adjusted baseline cost includes only recorded customer-approved and applied change-order estimated cost deltas. Approved but unapplied changes remain visible in counts and do not silently alter the baseline.',
      margin_boundary:'Margin calibration compares recorded estimate margin percent with recorded actual job margin percent only. It does not invent a target margin, required markup, price change or profitability threshold.',
      actuals_boundary:'Actual labour, material and equipment comparisons use recorded job/Production cost evidence. Missing cost evidence remains unavailable; zero is not inferred from a missing source.',
      authority_boundary:'Read-only calibration only. Estimate assumptions, customer approvals, change-order approvals/application, job-cost closeout and Finance posting remain under their existing source authorities; this layer cannot edit estimates, approve extras, change pricing or post accounting.'
    },
    four_season_capacity_forecast:null,workability_schedule_recovery_outcomes:null,
    route_crew_efficiency_evidence:null,route_plan_actual_stop_sequence_learning:null,
    recurring_renewal_retention_workbench:null,recurring_renewal_conversion_churn_outcomes:null,
    estimate_to_cash_leakage_workbench:null,labour_equipment_fleet_utilization_support:null,
    materials_consumables_seasonal_stock_readiness:null,customer_communication_readiness_queue:null,
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
  await expect(page.locator('#owner367Calibration')).toBeVisible();
}

test('Build 367 renders recorded estimate calibration without automatic repricing',async({page})=>{
  await boot(page);
  const host=page.locator('#owner367Calibration');
  await expect(host).toContainText('Accepted estimates');
  await expect(host).toContainText('Comparable closeouts');
  await expect(host).toContainText('Labour cost comparisons');
  await expect(host.locator('[data-owner367-component="labour"]')).toContainText('recorded variance');
  await host.getByText('Recurring calibration patterns').click();
  await expect(host.locator('[data-owner367-pattern="component_cost_variance"]')).toContainText('SPRING-CLEANUP');
  await expect(host).toContainText('estimate assumptions are not changed automatically');
  await host.getByText('Estimate-to-actual calibration records').click();
  const record=host.locator('[data-owner367-record="e367"]');
  await expect(record).toContainText('EST-367 → WO-367');
  await expect(record).toContainText('adjusted baseline');
  await expect(record).toContainText('labour hours 8 estimated → 9.5 recorded');
  await expect(record).toContainText('margin 28.0% estimated → 23.5% recorded');
  await expect(record).toContainText('Source units: labour: hours · material: bags, m³ · equipment: hours');
  await host.getByText('Evidence, units and authority boundaries').click();
  await expect(host).toContainText('material and equipment quantities are not converted or compared across mixed or missing units');
  await expect(host).toContainText('does not invent a target margin');
  await expect(host).toContainText('cannot edit estimates, approve extras, change pricing or post accounting');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});

test('Build 367 withholds calibration when cross-module authority is unavailable',async({page})=>{
  const data=fixture();
  data.source_visibility.finance=false;
  data.management_metric_confidence.estimate_accuracy_calibration={state:'unavailable',confidence:'unavailable',reason:'Finance hidden.'};
  await boot(page,data);
  await expect(page.locator('#owner367Calibration')).toContainText('requires both Jobs and Finance visibility');
  await expect(page.locator('[data-owner367-record]')).toHaveCount(0);
  await expect(page.locator('.owner367-calibration')).toContainText('never edits assumptions');
  await expect(page.locator('.owner367-calibration')).toContainText('never');
});
