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
    management_metric_confidence:{completed_invoiced_cash_conversion:meta()},
    completed_to_invoiced_cycle_time_cash_conversion:{
      generated_at:now(),timezone:'America/Toronto',source_queries_ok:true,jobs_visible:true,finance_visible:true,
      summary:{
        completed_or_approved_closeouts:4,invoice_ready_count:3,invoiced_count:2,fully_collected_with_payment_evidence_count:1,
        completed_not_invoice_ready_count:1,invoice_ready_not_invoiced_count:1,invoiced_open_count:1,
        average_completion_to_invoice_hours:28,average_closeout_to_invoice_hours:20,
        average_invoice_to_first_payment_days:3,average_invoice_to_collection_days:7,
        average_completion_to_collection_days:8.2,recorded_invoiced_value_total:1800,
        recorded_open_balance_total:450,recorded_fully_collected_invoice_value_total:900
      },
      aging_cohorts:[
        {stage:'completed_not_invoice_ready',age_bucket:'2_3_days',count:1,invoice_value_total:0,open_balance_total:0},
        {stage:'invoice_ready_not_invoiced',age_bucket:'4_7_days',count:1,invoice_value_total:0,open_balance_total:0},
        {stage:'invoiced_open',age_bucket:'8_plus_days',count:1,invoice_value_total:900,open_balance_total:450}
      ],
      cycle_records:[
        {
          work_order_id:'wo368-open',work_order_number:'WO-368-OPEN',estimate_number:'EST-368-OPEN',client_name:'Maple Customer',site_name:'Maple Site',
          completion_at:'2026-09-20T19:00:00Z',completion_source:'latest_recorded_completed_production_session',
          closeout_approved_at:'2026-09-21T13:00:00Z',closeout_status:'approved',
          invoice_readiness_status:'ready',invoice_candidate_id:'cand-open',invoice_candidate_number:'IC-368-OPEN',
          invoice_ready_at:'2026-09-21T15:00:00Z',invoice_ready_source:'job_invoice_candidates.created_at',
          invoice_id:'inv-open',invoice_number:'INV-368-OPEN',invoice_status:'open',invoice_created_at:'2026-09-21T23:00:00Z',
          invoice_total_amount:900,invoice_balance_due:450,payment_application_count:1,payment_applied_total:450,
          first_payment_at:'2026-09-24T00:00:00Z',latest_payment_at:'2026-09-24T00:00:00Z',collection_at:null,
          fully_collected_with_payment_evidence:false,completion_to_closeout_hours:18,completion_to_invoice_ready_hours:20,
          closeout_to_invoice_ready_hours:2,invoice_ready_to_invoice_hours:8,completion_to_invoice_hours:28,
          closeout_to_invoice_hours:10,invoice_to_first_payment_days:2,invoice_to_collection_days:null,
          completion_to_collection_days:null,current_stage:'invoiced_open',current_stage_age_days:14.4,current_stage_age_bucket:'8_plus_days'
        },
        {
          work_order_id:'wo368-paid',work_order_number:'WO-368-PAID',estimate_number:'EST-368-PAID',client_name:'Oak Customer',site_name:'Oak Site',
          completion_at:'2026-09-10T18:00:00Z',closeout_approved_at:'2026-09-10T20:00:00Z',
          invoice_ready_at:'2026-09-11T12:00:00Z',invoice_created_at:'2026-09-11T18:00:00Z',
          invoice_id:'inv-paid',invoice_number:'INV-368-PAID',invoice_status:'paid',invoice_total_amount:900,invoice_balance_due:0,
          payment_application_count:1,payment_applied_total:900,first_payment_at:'2026-09-18T00:00:00Z',latest_payment_at:'2026-09-18T00:00:00Z',
          collection_at:'2026-09-18T00:00:00Z',fully_collected_with_payment_evidence:true,
          completion_to_invoice_hours:24,invoice_to_first_payment_days:6.3,invoice_to_collection_days:6.3,completion_to_collection_days:7.3,
          current_stage:'collected',current_stage_age_days:0,current_stage_age_bucket:'0_1_days'
        }
      ],
      completion_boundary:'Completion time uses the latest recorded Production session explicitly carrying completed evidence. Completion is not inferred from a work-order status alone.',
      closeout_boundary:'Approved closeout time uses recorded closeout approved_at only. Generic closeout updated_at is not treated as approval or invoice-readiness time.',
      invoice_readiness_boundary:'Invoice readiness time uses the recorded job_invoice_candidates created_at event. A readiness status without a candidate timestamp is not assigned a synthetic time.',
      invoice_boundary:'Invoice creation time uses recorded A/R invoice created_at, with invoice_date only as a source fallback when creation time is absent.',
      payment_boundary:'Payment timing uses recorded payment-application evidence. Full collection requires an A/R balance at or below zero plus at least one recorded applied payment; a paid-looking status alone is not treated as cash collection.',
      aging_boundary:'Aging buckets are descriptive elapsed-time cohorts (0–1, 2–3, 4–7 and 8+ days), not service-level targets or collection thresholds.',
      authority_boundary:'Read-only cash-conversion evidence only. This layer cannot create invoices, apply payments, send collection messages, post journals, alter closeout approvals or mutate payment/provider state.'
    },
    four_season_capacity_forecast:null,workability_schedule_recovery_outcomes:null,
    route_crew_efficiency_evidence:null,route_plan_actual_stop_sequence_learning:null,
    recurring_renewal_retention_workbench:null,recurring_renewal_conversion_churn_outcomes:null,
    estimate_to_cash_leakage_workbench:null,estimate_accuracy_change_order_margin_calibration:null,
    labour_equipment_fleet_utilization_support:null,materials_consumables_seasonal_stock_readiness:null,
    customer_communication_readiness_queue:null,data_quality_duplicate_orphan_reconciliation:null
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
  await expect(page.locator('#owner368CashCycle')).toBeVisible();
}

test('Build 368 renders recorded completion-to-cash cycles and aging without mutations',async({page})=>{
  await boot(page);
  const host=page.locator('#owner368CashCycle');
  await expect(host).toContainText('Completed / approved');
  await expect(host).toContainText('Invoice ready');
  await expect(host).toContainText('Completion → invoice');
  await expect(host).toContainText('28 h');
  await expect(host).toContainText('Invoice → collection');
  await expect(host).toContainText('7 d');
  await expect(host.locator('[data-owner368-cohort="invoiced_open:8_plus_days"]')).toContainText('8+ days');
  await host.getByText('Recorded cycle traces').click();
  const open=host.locator('[data-owner368-record="wo368-open"]');
  await expect(open).toContainText('WO-368-OPEN · INV-368-OPEN');
  await expect(open).toContainText('completion → invoice 28 h');
  await expect(open).toContainText('invoice → first payment 2 d');
  await expect(open).toContainText('balance');
  const paid=host.locator('[data-owner368-record="wo368-paid"]');
  await expect(paid).toContainText('collected');
  await host.getByText('Timing and authority boundaries').click();
  await expect(host).toContainText('Completion is not inferred from a work-order status alone');
  await expect(host).toContainText('Generic closeout updated_at is not treated as approval');
  await expect(host).toContainText('paid-looking status alone is not treated as cash collection');
  await expect(host).toContainText('cannot create invoices, apply payments, send collection messages, post journals');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});

test('Build 368 withholds cross-module cash timing when Finance visibility is missing',async({page})=>{
  const data=fixture();
  data.source_visibility.finance=false;
  data.management_metric_confidence.completed_invoiced_cash_conversion={state:'unavailable',confidence:'unavailable',reason:'Finance hidden.'};
  await boot(page,data);
  await expect(page.locator('#owner368CashCycle')).toContainText('requires both Jobs and Finance visibility');
  await expect(page.locator('[data-owner368-record]')).toHaveCount(0);
  await expect(page.locator('.owner368-cash-cycle')).toContainText('never creates invoices');
});
