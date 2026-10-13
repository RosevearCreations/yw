import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'js/admin-owner-management-command-ui.js'),'utf8');
const now=()=>new Date().toISOString();
const meta=()=>({state:'current',confidence:'high',last_authoritative_update:now(),reason:'Recorded seasonal operating evidence is current.'});

function scenario(key,label,extra={}){
  return {
    scenario_key:key,scenario_label:label,scenario_state:'recorded_evidence_complete',
    horizon_start:'2026-10-08',horizon_end:'2026-10-21',planned_dispatch_count:2,planned_recurring_visit_count:1,
    planned_item_count:3,recorded_demand_minutes:360,planned_mix_share_percent:25,
    forecast_days_with_season_load:2,shared_active_crew_day_evidence:6,shared_scheduled_crew_day_evidence:4,constrained_forecast_day_count:1,
    configured_route_capacity_day_count:2,configured_route_capacity_headroom_minutes:180,over_configured_capacity_minutes:30,
    workability_constraint_episodes:2,workability_full_completion_recovery_count:1,workability_recovery_rate_percent:50,
    material_count:5,material_attention_count:1,material_shortage_count:0,material_reorder_review_count:1,
    recurring_visits_without_quantified_material_plan:0,finance_evidence_state:'visible',
    recorded_job_profitability_group_count:1,recorded_job_revenue_total:2400,recorded_job_cost_total:1600,recorded_job_profit_total:800,recorded_job_margin_percent:33.3,
    recorded_recurring_profit_agreement_count:2,recorded_recurring_profit_total:420,
    missing_assumptions:[],
    review_note:'Compare recorded evidence before making an operator decision.',
    ...extra
  };
}

function fixture(financeVisible=true){
  const scenarios=[
    scenario('spring_summer','Spring / summer landscaping & lawn'),
    scenario('fall','Fall cleanup & leaf',{planned_item_count:2,planned_mix_share_percent:16.7,missing_assumptions:['No recorded workability constraint/recovery history is available for this season; recovery performance is not assumed.'],scenario_state:'partial_recorded_evidence',workability_constraint_episodes:0,workability_full_completion_recovery_count:0,workability_recovery_rate_percent:null}),
    scenario('winter','Winter snow / storm / ice',{planned_item_count:5,planned_mix_share_percent:41.7,material_shortage_count:1}),
    scenario('four_season','General four-season operations',{planned_item_count:2,planned_mix_share_percent:16.7})
  ];
  if(!financeVisible){
    for(const r of scenarios){
      r.finance_evidence_state='not_visible';
      r.recorded_job_profitability_group_count=0;r.recorded_job_revenue_total=null;r.recorded_job_cost_total=null;r.recorded_job_profit_total=null;r.recorded_job_margin_percent=null;
      r.recorded_recurring_profit_agreement_count=0;r.recorded_recurring_profit_total=null;
      r.missing_assumptions=[...(r.missing_assumptions||[]),'Finance profitability evidence is hidden by permission; no margin or profit assumption is substituted.'];
      r.scenario_state='partial_recorded_evidence';
    }
  }
  return {
    ok:true,
    source_visibility:{jobs:true,finance:financeVisible,safety:false,admin:true},
    source_freshness:{},
    management_metric_confidence:{four_season_capacity_profitability_scenarios:meta()},
    four_season_crew_day_mix_constraint_backtesting:{
      state:'current',reason:'Retrospective proxy only',summary:{
        planned_items_14_days:12,mixed_assigned_crew_days:2,days_with_multiple_season_loads:3,
        days_with_readiness_constraints:2,unambiguous_completion_pairs_90_days:14,
        ambiguous_work_orders_excluded:2,unpaired_work_orders_excluded:1
      },
      backtest_cohorts:[
        {window_key:'latest_30_days',label:'Latest 30 dated plan days',matched_completed_pairs:6,completed_on_recorded_scheduled_day:4,
        completed_after_recorded_scheduled_day:1,completed_before_recorded_scheduled_day:1,sufficient_sample:true,
        on_day_alignment_percent:66.7,mean_absolute_day_gap:0.3},
        {window_key:'preceding_60_days',label:'Preceding 60 dated plan days',matched_completed_pairs:8,
        completed_on_recorded_scheduled_day:5,completed_after_recorded_scheduled_day:2,completed_before_recorded_scheduled_day:1,
        sufficient_sample:true,on_day_alignment_percent:62.5,mean_absolute_day_gap:0.5}
      ],
      seasons:['spring_summer','fall','winter','four_season'].map((season_context,i)=>({
        season_context,planned_dispatch_items:i+1,forecast_days_with_load:i+2,mixed_crew_days_for_season:i===0?2:1,
        constrained_shared_days:i,workability_blocked_shared_days:0,unassigned_dispatch_shared_signals:1,equipment_attention_shared_signals:1,
        plan_completion_alignment:{matched_completed_pairs:6,sufficient_sample:true,on_day_alignment_percent:50}
      })),
      method_boundary:'Shared crew-day is not an automatic conflict.',backtest_boundary:'No immutable historic forecast snapshots.',
      capacity_boundary:'No invented shifts.',privacy_boundary:'No customer or employee IDs.',authority_boundary:'Read-only; no dispatch, Safety or Finance writes.'
    },
    four_season_capacity_profitability_scenario_evidence:{
      generated_at:now(),timezone:'America/Toronto',source_queries_ok:true,coverage_complete:true,jobs_visible:true,finance_visible:financeVisible,
      horizon_start:'2026-10-08',horizon_end:'2026-10-21',
      summary:{planned_items_14_days:12,recorded_demand_minutes_14_days:1440,seasons_with_planned_work:4,seasons_with_configured_route_capacity:4,seasons_with_material_attention:4,seasons_with_recorded_profitability:financeVisible?4:0,scenarios_with_missing_assumptions:financeVisible?1:4},
      scenarios,
      mix_boundary:'Seasonal mix share is the share of recorded dispatch plus recurring-visit items inside the current 14-day horizon. No sales target, jobs-per-crew target, growth rate or missing workload is invented.',
      capacity_boundary:'Crew counts are shared crew-day evidence on dates carrying that season, not dedicated seasonal capacity. Route headroom is shown only where a configured daily route capacity exists; missing headroom is never inferred.',
      profitability_boundary:'Job-family profitability and recurring-agreement profitability are displayed as separate recorded sources and are not added together because their populations can overlap. No target margin, price, wage, utilization rate or revenue assumption is invented.',
      materials_boundary:'Material readiness reuses current stock and quantified planned demand. Missing units or recurring material plans remain explicit gaps; no unit conversion, reorder quantity or purchase requirement is invented.',
      scenario_boundary:'These are evidence scenarios for comparing current recorded seasonal mix and constraints, not forecasts of customer demand or committed operating plans.',
      authority_boundary:'Read-only decision support only. This layer cannot auto-price, dispatch, hire, schedule, purchase, contact suppliers/customers, create estimates/invoices, or commit customer/vendor work.'
    },
    four_season_capacity_forecast:null,workability_schedule_recovery_outcomes:null,route_crew_efficiency_evidence:null,
    route_plan_actual_stop_sequence_learning:null,recurring_renewal_retention_workbench:null,recurring_renewal_conversion_churn_outcomes:null,
    estimate_to_cash_leakage_workbench:null,estimate_accuracy_change_order_margin_calibration:null,
    completed_to_invoiced_cycle_time_cash_conversion:null,labour_equipment_fleet_utilization_support:null,
    labour_capture_completeness_payroll_exception_reduction:null,equipment_downtime_cost_replacement_readiness:null,
    materials_consumables_seasonal_stock_readiness:null,material_usage_variance_reorder_calibration:null,
    customer_communication_readiness_queue:null,customer_communication_outcome_followup_effectiveness:null,
    data_quality_duplicate_orphan_reconciliation:null,data_quality_remediation_outcome_recurrence:null,
    owner_jobs:[],owner_dispatch:[],owner_production:[],owner_profitability:[],owner_timekeeping_summary:[],
    owner_recurring:[],owner_recurring_visits:[],owner_crews:[],owner_storms:[],owner_storm_routes:[],owner_seasonal_work:[],
    owner_safety:[],owner_equipment:[],owner_maintenance:[],owner_training_summary:[],owner_workforce_summary:[],
    owner_receivables:[],owner_bank:[],owner_finance_exceptions:[],owner_close_dashboard:[],owner_workability:[],
    owner_equipment_use:[],owner_fleet:[],owner_material_stock:[],owner_material_plans:[],owner_crm_followups:[],
    owner_notification_delivery:[],owner_closeouts:[],owner_crm_properties:[]
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
  await expect(page.locator('#owner389CrewDayBacktest')).toBeVisible();
}


test('Build 389 compares seasonal mixed crew-days and retrospective dated plan cohorts at mobile width',async({page})=>{
  await boot(page);
  const host=page.locator('#owner389CrewDayBacktest');
  await expect(host).toContainText('Mixed assigned crew-days');
  await expect(host).toContainText('Constrained days');
  await expect(host.locator('[data-owner389-season="spring_summer"]')).toContainText('2 mixed assigned crew-day');
  await expect(host.locator('[data-owner389-season="winter"]')).toContainText('winter');
  await host.getByText('Recorded-plan completion backtesting · 30 / 60 days').click();
  await expect(host.locator('[data-owner389-cohort="latest_30_days"]')).toContainText('66.7%');
  await expect(host.locator('[data-owner389-cohort="preceding_60_days"]')).toContainText('62.5%');
  await host.getByText('Method, limits, privacy and source authority').click();
  await expect(host).toContainText('No immutable historic forecast snapshots');
  await expect(host.getByRole('button',{name:/reassign|schedule crew|unlock|post invoice/i})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('Build 389 withholds comparisons when required canonical source is stale',async({page})=>{
  const d=fixture();d.four_season_crew_day_mix_constraint_backtesting={state:'freshness_withheld',reason:'Required production evidence is stale'};
  await boot(page,d);
  const host=page.locator('#owner389CrewDayBacktest');
  await expect(host).toContainText('Scenario/backtest withheld');
  await expect(host).toContainText('Required production evidence is stale');
  await expect(host.locator('[data-owner389-season]')).toHaveCount(0);
});
test('Build 389 withholds historical comparison percentages under five completed pairs',async({page})=>{
  const d=fixture();d.four_season_crew_day_mix_constraint_backtesting.state='insufficient_historical_pairs';
  d.four_season_crew_day_mix_constraint_backtesting.backtest_cohorts[0].sufficient_sample=false;
  d.four_season_crew_day_mix_constraint_backtesting.backtest_cohorts[0].on_day_alignment_percent=null;
  await boot(page,d);
  const host=page.locator('#owner389CrewDayBacktest');
  await host.getByText('Recorded-plan completion backtesting · 30 / 60 days').click();
  await expect(host.locator('[data-owner389-cohort="latest_30_days"]')).toContainText('Alignment withheld');
});
test('Build 389 hides crew-day analytics without Jobs visibility',async({page})=>{
  const d=fixture();d.source_visibility.jobs=false;
  await boot(page,d);
  await expect(page.locator('#owner389CrewDayBacktest')).toContainText('Jobs / Business & Operations view permission');
});
