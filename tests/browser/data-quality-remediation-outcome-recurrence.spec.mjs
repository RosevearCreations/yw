import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'js/admin-owner-management-command-ui.js'),'utf8');
const now=()=>new Date().toISOString();
const meta=()=>({state:'current',confidence:'high',last_authoritative_update:now(),reason:'Data-quality scan and management outcome evidence are current.'});

function fixture(){
  return {
    ok:true,
    source_visibility:{jobs:true,finance:false,safety:false,admin:true},
    source_freshness:{},
    management_metric_confidence:{data_quality_remediation_outcomes:meta()},
    data_quality_remediation_outcome_recurrence:{
      generated_at:now(),source_queries_ok:true,coverage_complete:true,admin_visible:true,
      summary:{
        current_signals:3,still_open_tracked:1,still_open_untracked:1,recurring_current:1,
        confirmed_resolved:1,historical_not_currently_detected:0,coverage_withheld_history:0,journal_rows:4
      },
      current_outcomes:[
        {
          source_key:'admin:data_quality_signal:duplicate_customer_candidate:customer_pair:cust-a|cust-b',
          source_id:'duplicate_customer_candidate:customer_pair:cust-a|cust-b',signal_type:'duplicate_customer_candidate',
          entity_type:'customer_pair',entity_id:'cust-a|cust-b',reference:'CUST-A ↔ CUST-B',title:'Maple Holdings duplicate candidate',
          severity:'high_review',navigation_target:'crm',outcome_state:'recurring',decision_count:2,recurrence_count:1,
          latest_outcome_status:'recurring',latest_decision_at:'2026-10-05T12:00:00Z',latest_outcome_recorded_at:'2026-10-05T12:30:00Z',
          recurrence_basis:'recorded_recurrence_signal',suggested_action:'Review CRM identity-entry evidence deliberately.'
        },
        {
          source_key:'admin:data_quality_signal:stale_assignment:dispatch:dispatch-373',
          source_id:'stale_assignment:dispatch:dispatch-373',signal_type:'stale_assignment',entity_type:'dispatch',entity_id:'dispatch-373',
          reference:'WO-373',title:'Active dispatch includes unavailable equipment',severity:'high_review',navigation_target:'jobs',
          outcome_state:'still_open_tracked',decision_count:1,recurrence_count:0,latest_outcome_status:'pending',
          latest_decision_at:'2026-10-06T12:00:00Z',latest_outcome_recorded_at:null,recurrence_basis:null,
          suggested_action:'Review Dispatch and Equipment Registry deliberately.'
        },
        {
          source_key:'admin:data_quality_signal:conflicting_season_service_tag:material_plan:mat-373',
          source_id:'conflicting_season_service_tag:material_plan:mat-373',signal_type:'conflicting_season_service_tag',
          entity_type:'material_plan',entity_id:'mat-373',reference:'EST-373',title:'Season/service tags conflict',
          severity:'review',navigation_target:'jobs',outcome_state:'still_open_untracked',decision_count:0,recurrence_count:0,
          latest_outcome_status:null,latest_decision_at:null,latest_outcome_recorded_at:null,recurrence_basis:null,
          suggested_action:'Review the authoritative service/season source.'
        }
      ],
      confirmed_resolved:[
        {
          source_key:'admin:data_quality_signal:broken_canonical_reference:job:job-373-resolved',
          source_id:'broken_canonical_reference:job:job-373-resolved',latest_outcome_status:'resolved',
          latest_decision_at:'2026-10-01T12:00:00Z',latest_outcome_recorded_at:'2026-10-02T12:00:00Z',
          decision_count:1,recurrence_count:0,outcome_state:'resolved',outcome_note:'Canonical reference repaired.'
        }
      ],
      historical_outcomes:[],
      recurrence_prevention_candidates:[
        {
          signal_type:'duplicate_customer_candidate',recurring_source_count:1,
          source_keys:['admin:data_quality_signal:duplicate_customer_candidate:customer_pair:cust-a|cust-b'],
          preventive_review:'Review the upstream identity-entry and duplicate-detection workflow before future record creation; do not auto-merge existing identities.'
        }
      ],
      signal_type_summary:[
        {signal_type:'duplicate_customer_candidate',current_count:1,tracked_count:1,recurring_count:1},
        {signal_type:'stale_assignment',current_count:1,tracked_count:1,recurring_count:0},
        {signal_type:'conflicting_season_service_tag',current_count:1,tracked_count:0,recurring_count:0}
      ],
      source_key_boundary:'Each Build 360 signal uses a stable admin:data_quality_signal source key built from signal type, entity type and retained source identity so journal history can follow the same defect without replacing canonical record IDs.',
      resolution_boundary:'A journal row is shown as confirmed resolved by absence only when every source required by the data-quality scan completed successfully and remained below its configured row cap. Partial/capped coverage never proves resolution.',
      recurrence_boundary:'A currently detected signal is recurring when the same source key has recorded recurrence evidence or reappears after a recorded resolved/improved outcome. Recurrence is a data-quality pattern, not an employee or customer score.',
      prevention_boundary:'Recurrence-prevention guidance is advisory root-cause review only. It does not auto-merge/delete identities, rewrite foreign keys, reassign crews/equipment, clear lockouts or rewrite season/service history.',
      journal_boundary:'The existing private Management Decision Outcome Journal stores bounded decision/outcome metadata only. Build 373 reads that journal but does not create, update or close journal rows automatically.',
      authority_boundary:'Read-only remediation outcome evidence. Canonical CRM, Jobs, Dispatch, Recurring Service, Crew, Equipment, Route, Workability and Material Estimator workflows remain the only source-mutation authorities.'
    },
    data_quality_duplicate_orphan_reconciliation:null,
    four_season_capacity_forecast:null,workability_schedule_recovery_outcomes:null,route_crew_efficiency_evidence:null,
    route_plan_actual_stop_sequence_learning:null,recurring_renewal_retention_workbench:null,recurring_renewal_conversion_churn_outcomes:null,
    estimate_to_cash_leakage_workbench:null,estimate_accuracy_change_order_margin_calibration:null,
    completed_to_invoiced_cycle_time_cash_conversion:null,labour_equipment_fleet_utilization_support:null,
    labour_capture_completeness_payroll_exception_reduction:null,equipment_downtime_cost_replacement_readiness:null,
    materials_consumables_seasonal_stock_readiness:null,material_usage_variance_reorder_calibration:null,
    customer_communication_readiness_queue:null,customer_communication_outcome_followup_effectiveness:null,
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
  await expect(page.locator('#owner373DataQualityOutcomes')).toBeVisible();
}

test('Build 373 renders stable source-key outcomes, recurrence and prevention without destructive controls',async({page})=>{
  await boot(page);
  const host=page.locator('#owner373DataQualityOutcomes');
  await expect(host).toContainText('Current signals');
  await expect(host).toContainText('Open · tracked');
  await expect(host).toContainText('Recurring');
  const recurring=host.locator('[data-owner373-source="admin:data_quality_signal:duplicate_customer_candidate:customer_pair:cust-a|cust-b"]');
  await expect(recurring).toContainText('CUST-A ↔ CUST-B · recurring');
  await expect(recurring).toContainText('recorded recurrence signal');
  await expect(recurring).toContainText('admin:data_quality_signal:duplicate_customer_candidate:customer_pair:cust-a|cust-b');
  await host.getByText('Confirmed resolved history').click();
  await expect(host.locator('[data-owner373-resolved="admin:data_quality_signal:broken_canonical_reference:job:job-373-resolved"]')).toContainText('confirmed resolved');
  await host.getByText('Recurring defects & prevention review').click();
  await expect(host.locator('[data-owner373-prevention="duplicate_customer_candidate"]')).toContainText('do not auto-merge existing identities');
  await host.getByText('Source-key, resolution, recurrence & authority boundaries').click();
  await expect(host).toContainText('Partial/capped coverage never proves resolution');
  await expect(host).toContainText('not an employee or customer score');
  await expect(host).toContainText('does not auto-merge/delete identities');
  await expect(host.getByRole('button',{name:/merge|delete|clear lockout/i})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});

test('Build 373 withholds confirmed resolution when current data-quality coverage is incomplete',async({page})=>{
  const d=fixture();d.data_quality_remediation_outcome_recurrence.coverage_complete=false;
  await boot(page,d);
  const host=page.locator('#owner373DataQualityOutcomes');
  await expect(host).toContainText('Resolution by absence withheld');
  await expect(host).toContainText('Withheld');
});

test('Build 373 withholds outcomes when current scan or journal reads fail',async({page})=>{
  const d=fixture();d.data_quality_remediation_outcome_recurrence.source_queries_ok=false;
  await boot(page,d);
  const host=page.locator('#owner373DataQualityOutcomes');
  await expect(host).toContainText('evidence reads failed');
  await expect(host).not.toContainText('CUST-A ↔ CUST-B');
});

test('Build 373 Management Journal button routes deliberately to Admin operations',async({page})=>{
  await boot(page);
  await page.locator('.owner373-data-quality-outcomes button').filter({hasText:'Open Management Journal'}).click();
  await page.waitForTimeout(10);
  expect(await page.evaluate(()=>window.__route)).toBe('admin');
  expect(await page.evaluate(()=>window.__group)).toBe('operations');
});
