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
    management_metric_confidence:{labour_capture_payroll_exceptions:meta()},
    labour_capture_completeness_payroll_exception_reduction:{
      generated_at:now(),timezone:'America/Toronto',lookback_days:30,lookback_start:'2026-09-06',lookback_end:'2026-10-05',
      source_queries_ok:true,jobs_visible:true,admin_visible:true,
      summary:{
        work_units:12,complete_payroll_evidence_work_units:7,payroll_evidence_completion_rate_percent:58.3,
        missing_time_capture_work_units:2,open_shift_work_units:1,correction_pending_work_units:1,
        attendance_review_work_units:1,supervisor_approval_work_units:0,other_unready_work_units:0,
        explicit_late_exception_work_units:1,repeated_pattern_count:1,
        recent_exception_rate_percent:25,prior_exception_rate_percent:50,exception_rate_change_percentage_points:-25
      },
      recent_period:{start_date:'2026-09-22',end_date:'2026-10-05',work_units:8,complete_work_units:6,exception_work_units:2,completion_rate_percent:75,exception_rate_percent:25},
      prior_period:{start_date:'2026-09-08',end_date:'2026-09-21',work_units:4,complete_work_units:2,exception_work_units:2,completion_rate_percent:50,exception_rate_percent:50},
      exception_reduction_state:'recorded_exception_rate_lower',
      repeated_patterns:[
        {crew_id:'crew-north',crew_name:'Crew North',job_id:101,job_code:'JOB-369',job_name:'Seasonal Cleanup',capture_state:'missing_time_capture',occurrence_count:2,first_service_date:'2026-09-18',last_service_date:'2026-10-01',open_review_count:0,pending_correction_count:0,explicit_late_exception_count:0}
      ],
      work_unit_evidence:[
        {service_date:'2026-10-01',crew_id:'crew-north',crew_name:'Crew North',job_id:101,job_code:'JOB-369',job_name:'Seasonal Cleanup',dispatch_count:1,production_session_count:1,production_labour_hours:12,production_duration_minutes:360,time_entry_count:0,signed_out_time_entry_count:0,payroll_ready_time_entry_count:0,paid_hours:0,job_work_hours:0,open_review_count:0,pending_correction_count:0,explicit_late_exception_count:0,payroll_readiness_statuses:[],open_review_codes:[],capture_state:'missing_time_capture',capture_complete:false},
        {service_date:'2026-10-02',crew_id:'crew-south',crew_name:'Crew South',job_id:202,job_code:'JOB-369B',job_name:'Fall Cleanup',dispatch_count:1,production_session_count:1,production_labour_hours:8,production_duration_minutes:300,time_entry_count:2,signed_out_time_entry_count:2,payroll_ready_time_entry_count:1,paid_hours:8,job_work_hours:7,open_review_count:1,pending_correction_count:0,explicit_late_exception_count:1,payroll_readiness_statuses:['attendance_review','ready'],open_review_codes:['late_clock_out'],capture_state:'attendance_review',capture_complete:false}
      ],
      matching_boundary:'Coverage is evaluated at recorded job/service-date and crew context where available. A scheduled or Production work unit is complete only when matching time entries exist and every matched entry is payroll-ready.',
      late_boundary:'Late capture is counted only when the canonical payroll evidence explicitly carries a late, missed or untimely exception/review code. No arbitrary lateness threshold is invented.',
      reduction_boundary:'Exception reduction compares the most recent 14 completed calendar days with the preceding 14 completed calendar days. It describes recorded exception-rate movement only and is not an employee-performance target.',
      privacy_boundary:'Returned evidence is aggregated to crew/job/service-date. Individual employee names, employee numbers, explanations, supervisor notes and approver identities are not returned.',
      safety_boundary:'Safety restrictions and fitness-for-work decisions remain under existing Safety authority and are not inferred from attendance, payroll readiness or missing time evidence.',
      authority_boundary:'Read-only management evidence. This layer cannot edit time entries, approve payroll, approve corrections, change pay codes, rank employees, make employment decisions or override Safety restrictions.'
    },
    four_season_capacity_forecast:null,workability_schedule_recovery_outcomes:null,
    route_crew_efficiency_evidence:null,route_plan_actual_stop_sequence_learning:null,
    recurring_renewal_retention_workbench:null,recurring_renewal_conversion_churn_outcomes:null,
    estimate_to_cash_leakage_workbench:null,estimate_accuracy_change_order_margin_calibration:null,
    completed_to_invoiced_cycle_time_cash_conversion:null,labour_equipment_fleet_utilization_support:null,
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
  await expect(page.locator('#owner369LabourCapture')).toBeVisible();
}

test('Build 369 renders crew/job payroll completeness and exception-rate movement without employee scoring',async({page})=>{
  await boot(page);
  const host=page.locator('#owner369LabourCapture');
  await expect(host).toContainText('Payroll-ready coverage');
  await expect(host).toContainText('58.3%');
  await expect(host).toContainText('Missing time capture');
  await expect(host).toContainText('Recent exception rate');
  await expect(host).toContainText('prior 50.0% · change -25 pp');
  await expect(host).toContainText('recorded exception rate lower');
  const pattern=host.locator('[data-owner369-pattern="crew-north:101:missing_time_capture"]');
  await expect(pattern).toContainText('Crew North · JOB-369');
  await expect(pattern).toContainText('2 occurrence(s)');
  await host.getByText('Crew/job/service-date evidence').click();
  await expect(host).toContainText('late_clock_out');
  await expect(host).toContainText('explicit late-coded 1');
  await host.getByText('Matching, lateness, privacy & authority boundaries').click();
  await expect(host).toContainText('No arbitrary lateness threshold is invented');
  await expect(host).toContainText('Individual employee names, employee numbers, explanations, supervisor notes and approver identities are not returned');
  await expect(host).toContainText('cannot edit time entries, approve payroll, approve corrections, change pay codes, rank employees');
  await expect(page.locator('.owner369-labour-capture')).toContainText('not employee scoring');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});

test('Build 369 keeps payroll evidence permission scoped',async({page})=>{
  const data=fixture();
  data.source_visibility.admin=false;
  data.management_metric_confidence.labour_capture_payroll_exceptions={state:'unavailable',confidence:'unavailable',reason:'Admin hidden.'};
  await boot(page,data);
  await expect(page.locator('#owner369LabourCapture')).toContainText('requires Jobs visibility and Admin management access');
  await expect(page.locator('[data-owner369-evidence]')).toHaveCount(0);
});

test('Build 369 navigation stays deliberate',async({page})=>{
  await boot(page);
  await page.locator('.owner369-labour-capture button').filter({hasText:'Open Operations'}).first().click();
  await page.waitForTimeout(10);
  expect(await page.evaluate(()=>window.__route)).toBe('admin');
  expect(await page.evaluate(()=>window.__group)).toBe('operations');
});
