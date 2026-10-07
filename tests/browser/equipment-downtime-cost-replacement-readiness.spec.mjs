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
    management_metric_confidence:{equipment_downtime_replacement_readiness:meta()},
    equipment_downtime_cost_replacement_readiness:{
      generated_at:now(),timezone:'America/Toronto',lookback_days:365,lookback_start:'2025-10-06',lookback_end:'2026-10-06',
      source_queries_ok:true,jobs_visible:true,finance_visible:true,
      summary:{
        equipment_assets:4,locked_out_assets:1,current_fleet_downtime_assets:1,assets_with_downtime_history_365:2,
        repeated_downtime_assets:1,recorded_downtime_hours_365:126.5,repeated_maintenance_assets:2,
        open_service_task_assets:1,preventive_overdue_assets:1,recorded_replacement_plan_assets:1,
        recorded_replacement_hold_assets:1,lifecycle_attention_assets:3,recorded_service_cost_total_all_time:6250,
        recorded_lifecycle_cost_total:48600,recorded_replacement_estimated_cost_total:18000,
        assets_with_finance_job_cost_context:1
      },
      lifecycle_attention:[
        {
          equipment_item_id:370,equipment_code:'TRK-370',equipment_name:'Winter Truck 370',category:'truck',status:'active',
          condition_status:'needs_service',registry_readiness_status:'locked_out',purchase_year:2018,purchase_date:'2018-04-01',
          year_of_manufacture:2018,acquisition_cost:30000,warranty_expiry_date:'2023-04-01',
          locked_out:true,locked_out_at:'2026-10-01T12:00:00Z',lockout_age_days:5.2,
          fleet_asset:true,fleet_operational_status:'downtime',fleet_readiness_status:'blocked',fleet_downtime:true,
          current_fleet_downtime_started_at:'2026-10-01T12:00:00Z',current_fleet_downtime_hours:125.5,
          downtime_event_count_365:3,open_downtime_event_count:1,recorded_downtime_hours_365:126.5,repeated_downtime:true,
          maintenance_history_count_365:3,maintenance_history_cost_365:1800,service_task_count_365:2,open_service_task_count_365:1,
          service_task_actual_cost_365:900,open_service_estimated_cost_365:1200,repeated_maintenance_or_service:true,
          preventive_overdue_count:1,preventive_due_count:0,signout_count_365:27,damage_report_count_365:1,last_recorded_use_at:'2026-09-30T13:00:00Z',
          recorded_service_event_count_all_time:6,recorded_service_cost_total_all_time:4500,service_task_actual_cost_total_all_time:1400,
          recorded_lifecycle_cost_total:34500,service_cost_to_acquisition_percent:15,
          replacement_state:'plan_replacement',replacement_target_date:'2027-03-01',replacement_reason:'Recorded lifecycle planning',
          replacement_estimated_cost:18000,lifecycle_review_state:'recorded_replacement_plan',
          lifecycle_review_signals:['current equipment lockout','current fleet downtime','repeated recorded downtime in 365 days','repeated recorded maintenance/service activity in 365 days','preventive maintenance overdue','open service task','recorded replacement state plan_replacement'],
          linked_job_cost_context_count:1,
          linked_job_cost_context:[{
            job_id:77,job_code:'JOB-370',job_name:'Winter Route',
            job_equipment_repair_cost_total:800,equipment_repair_event_cost_total:800,equipment_replacement_cost_total:0,job_delay_cost_total:350,
            cost_context_boundary:'Job-level cost context only; these amounts are not attributed to this asset unless the underlying Finance source explicitly does so.'
          }]
        },
        {
          equipment_item_id:371,equipment_code:'MOW-371',equipment_name:'Mower 371',category:'mower',status:'active',
          locked_out:false,fleet_asset:false,fleet_downtime:false,downtime_event_count_365:0,recorded_downtime_hours_365:0,repeated_downtime:false,
          maintenance_history_count_365:2,maintenance_history_cost_365:650,service_task_count_365:0,open_service_task_count_365:0,
          service_task_actual_cost_365:0,open_service_estimated_cost_365:0,repeated_maintenance_or_service:true,
          preventive_overdue_count:0,preventive_due_count:1,signout_count_365:42,damage_report_count_365:0,last_recorded_use_at:'2026-10-02T14:00:00Z',
          acquisition_cost:8500,recorded_service_cost_total_all_time:1750,recorded_lifecycle_cost_total:10250,service_cost_to_acquisition_percent:20.59,
          replacement_state:'retain',replacement_target_date:null,replacement_reason:null,replacement_estimated_cost:null,
          lifecycle_review_state:'lifecycle_burden_review',
          lifecycle_review_signals:['repeated recorded maintenance/service activity in 365 days','preventive maintenance due / due soon'],
          linked_job_cost_context_count:0,linked_job_cost_context:[]
        }
      ],
      asset_evidence:[
        {equipment_item_id:370,equipment_code:'TRK-370',equipment_name:'Winter Truck 370',registry_readiness_status:'locked_out',replacement_state:'plan_replacement',lifecycle_review_state:'recorded_replacement_plan',downtime_event_count_365:3,maintenance_history_count_365:3,service_task_count_365:2,signout_count_365:27,last_recorded_use_at:'2026-09-30T13:00:00Z'},
        {equipment_item_id:372,equipment_code:'TRL-372',equipment_name:'Trailer 372',registry_readiness_status:'ready',replacement_state:'retain',lifecycle_review_state:'recorded_no_lifecycle_attention',downtime_event_count_365:0,maintenance_history_count_365:0,service_task_count_365:0,signout_count_365:18,last_recorded_use_at:'2026-10-03T13:00:00Z'}
      ],
      downtime_boundary:'Downtime exposure uses recorded fleet_downtime_events started_at/ended_at. Open events are measured only from their recorded start through the evidence-generation time; no downtime before the recorded start is inferred.',
      maintenance_boundary:'Maintenance burden uses recorded maintenance history and service-task events. Registry all-time cost rollups are shown separately and are not added again to 365-day history/task costs, avoiding double counting.',
      cost_boundary:'Equipment-specific recorded service/lifecycle costs remain separate from linked job-level Finance context. Job repair, replacement or delay totals are shown as context only and are never attributed to an asset unless the Finance source already provides that attribution.',
      replacement_boundary:'Replacement readiness reports the existing replacement_state, target date, reason and estimated cost plus recorded lifecycle signals. Repeated downtime means at least two recorded downtime events; repeated maintenance means at least two recorded maintenance/service events. These are review signals, not replacement recommendations or cost thresholds.',
      safety_boundary:'Lockout and return-to-service remain controlled Equipment/Safety authorities. This layer cannot clear a lockout, mark an asset ready or override an inspection/readiness restriction.',
      authority_boundary:'Read-only lifecycle evidence. This layer cannot create/complete service tasks, purchase or replace equipment, create vendor commitments, alter fleet downtime, post Finance, or mutate equipment assignments.'
    },
    four_season_capacity_forecast:null,workability_schedule_recovery_outcomes:null,
    route_crew_efficiency_evidence:null,route_plan_actual_stop_sequence_learning:null,
    recurring_renewal_retention_workbench:null,recurring_renewal_conversion_churn_outcomes:null,
    estimate_to_cash_leakage_workbench:null,estimate_accuracy_change_order_margin_calibration:null,
    completed_to_invoiced_cycle_time_cash_conversion:null,labour_equipment_fleet_utilization_support:null,
    labour_capture_completeness_payroll_exception_reduction:null,materials_consumables_seasonal_stock_readiness:null,
    customer_communication_readiness_queue:null,data_quality_duplicate_orphan_reconciliation:null,
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
  await expect(page.locator('#owner370EquipmentLifecycle')).toBeVisible();
}

test('Build 370 renders recorded downtime/cost/replacement evidence without recommending replacement',async({page})=>{
  await boot(page);
  const host=page.locator('#owner370EquipmentLifecycle');
  await expect(host).toContainText('Equipment assets');
  await expect(host).toContainText('Downtime, 365d');
  await expect(host).toContainText('126.5 h');
  await expect(host).toContainText('Recorded service cost');
  await expect(host).toContainText('$6,250.00');
  const truck=host.locator('[data-owner370-asset="370"]');
  await expect(truck).toContainText('TRK-370 · Winter Truck 370 · recorded replacement plan');
  await expect(truck).toContainText('repeated recorded downtime in 365 days');
  await expect(truck).toContainText('3 downtime event(s) · 126.5 recorded h');
  await expect(truck).toContainText('3 maintenance history event(s) / $1,800.00');
  await expect(truck).toContainText('acquisition $30,000.00 · recorded service $4,500.00 · recorded lifecycle $34,500.00 · service/acquisition 15.0%');
  await expect(truck).toContainText('replacement state plan_replacement · target 2027-03-01 · recorded estimate $18,000.00');
  await expect(truck).toContainText('JOB-370 · job repair $800.00');
  await host.getByText('Downtime, cost, replacement & authority boundaries').click();
  await expect(host).toContainText('no downtime before the recorded start is inferred');
  await expect(host).toContainText('avoiding double counting');
  await expect(host).toContainText('never attributed to an asset unless the Finance source already provides that attribution');
  await expect(host).toContainText('review signals, not replacement recommendations or cost thresholds');
  await expect(host).toContainText('cannot clear a lockout, mark an asset ready');
  await expect(page.locator('.owner370-equipment-lifecycle')).toContainText('not replacement recommendations');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});

test('Build 370 hides job-level Finance context when Finance visibility is unavailable',async({page})=>{
  const data=fixture();
  data.source_visibility.finance=false;
  data.equipment_downtime_cost_replacement_readiness.finance_visible=false;
  data.equipment_downtime_cost_replacement_readiness.lifecycle_attention[0].linked_job_cost_context=[];
  data.equipment_downtime_cost_replacement_readiness.lifecycle_attention[0].linked_job_cost_context_count=0;
  await boot(page,data);
  const host=page.locator('#owner370EquipmentLifecycle');
  await expect(host).toContainText('Finance job context');
  await expect(host).toContainText('Finance module unavailable');
  await expect(host.locator('[data-owner370-asset="370"]')).toContainText('Job-cost context: Finance context unavailable');
  await expect(host).not.toContainText('JOB-370');
});

test('Build 370 keeps equipment authority deliberate',async({page})=>{
  await boot(page);
  await page.locator('.owner370-equipment-lifecycle button').filter({hasText:'Open Operations'}).first().click();
  await page.waitForTimeout(10);
  expect(await page.evaluate(()=>window.__route)).toBe('admin');
  expect(await page.evaluate(()=>window.__group)).toBe('operations');
});
