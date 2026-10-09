import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'js/admin-owner-management-command-ui.js'),'utf8');
const now=()=>new Date().toISOString();
const meta=()=>({state:'current',confidence:'high',last_authoritative_update:now(),reason:'Canonical CRM, closeout and delivery sources are current.'});

function fixture(){
  return {
    ok:true,
    source_visibility:{jobs:true,finance:false,safety:false,admin:false},
    source_freshness:{},
    management_metric_confidence:{communication_outcomes:meta()},
    customer_communication_outcome_followup_effectiveness:{
      generated_at:now(),source_queries_ok:true,jobs_visible:true,
      summary:{
        outbound_interactions:4,recorded_inbound_responses:1,outbound_outcomes_recorded:2,
        followups_total:4,followups_completed:2,followups_completed_on_time:1,followups_completed_late:1,
        followups_open:2,followups_overdue:1,repeated_unresolved_work_orders:1,
        notification_sent:2,notification_delivery_attention:1,
        completion_followups_with_outbound:2,completion_followups_with_recorded_response:1
      },
      outreach_evidence:[
        {interaction_id:'out-372a',client_id:'c1',client_name:'Maple Customer',work_order_id:'wo-372a',work_order_number:'WO-372-A',channel:'email',interaction_type:'communication',interaction_status:'resolved',season_context:'fall',service_type:'fall_cleanup',occurred_at:'2026-10-01T13:00:00Z',outcome_recorded:true,recorded_outcome:'Reschedule acknowledged',response_state:'recorded_inbound_response',response_at:'2026-10-01T14:00:00Z',response_channel:'email',linked_followup_count:1,completed_followup_count:1,unresolved_followup_count:0,overdue_followup_count:0},
        {interaction_id:'out-372b',client_id:'c2',client_name:'Pine Customer',work_order_id:'wo-372b',work_order_number:'WO-372-B',channel:'phone',interaction_type:'communication',interaction_status:'open',season_context:'winter',service_type:'snow_clearing',occurred_at:'2026-10-02T12:00:00Z',outcome_recorded:false,recorded_outcome:null,response_state:'no_recorded_inbound_response',response_at:null,response_channel:null,linked_followup_count:1,completed_followup_count:0,unresolved_followup_count:1,overdue_followup_count:1}
      ],
      followup_evidence:[
        {followup_id:'fu-372a',client_id:'c1',client_name:'Maple Customer',interaction_id:'out-372a',source_direction:'outbound',source_channel:'email',followup_type:'service_review',followup_status:'completed',priority:'normal',season_context:'fall',service_type:'fall_cleanup',due_at:'2026-10-03T15:00:00Z',completed_at:'2026-10-03T14:00:00Z',timeliness:'completed_on_time',resolution_recorded:true},
        {followup_id:'fu-372b',client_id:'c2',client_name:'Pine Customer',interaction_id:'out-372b',source_direction:'outbound',source_channel:'phone',followup_type:'general',followup_status:'pending',priority:'high',season_context:'winter',service_type:'snow_clearing',due_at:'2026-10-02T15:00:00Z',completed_at:null,timeliness:'open_overdue',resolution_recorded:false}
      ],
      completion_followup_outcomes:[
        {closeout_id:'co-372',work_order_id:'wo-372a',work_order_number:'WO-372-A',client_id:'c1',client_name:'Maple Customer',closeout_at:'2026-09-30T18:00:00Z',outbound_count_after_closeout:1,first_outbound_at:'2026-10-01T13:00:00Z',response_at:'2026-10-01T14:00:00Z',outcome_state:'recorded_inbound_response'}
      ],
      repeated_unresolved_outreach:[
        {work_order_id:'wo-372b',work_order_number:'WO-372-B',client_id:'c2',client_name:'Pine Customer',outbound_count:2,first_outbound_at:'2026-10-02T12:00:00Z',last_outbound_at:'2026-10-04T12:00:00Z',response_at:null}
      ],
      delivery_outcomes:[
        {outbox_id:'n-372a',work_order_id:'wo-372a',work_order_number:'WO-372-A',client_id:'c1',client_name:'Maple Customer',delivery_status:'sent',sent_at:'2026-10-01T13:01:00Z',attempt_count:1,last_attempt_at:'2026-10-01T13:01:00Z',live_update_title:'Schedule updated'},
        {outbox_id:'n-372b',work_order_id:'wo-372b',work_order_number:'WO-372-B',client_id:'c2',client_name:'Pine Customer',delivery_status:'manual_review',sent_at:null,attempt_count:2,last_attempt_at:'2026-10-02T12:30:00Z',live_update_title:'Weather delay'}
      ],
      delivery_attention:[{outbox_id:'n-372b'}],
      channel_summary:[{key:'email',outbound_count:2,response_recorded_count:1,outcome_recorded_count:1},{key:'phone',outbound_count:2,response_recorded_count:0,outcome_recorded_count:1}],
      season_summary:[{key:'fall',outbound_count:2,response_recorded_count:1,outcome_recorded_count:1},{key:'winter',outbound_count:2,response_recorded_count:0,outcome_recorded_count:1}],
      response_boundary:'A recorded customer response requires a later inbound CRM interaction linked to the same work order as the outbound CRM interaction. Customer silence is not inferred when that linkage is unavailable.',
      outcome_boundary:'CRM interaction outcome/status is reported separately from response evidence. A resolved/closed interaction or recorded outcome text is not treated as proof that the customer replied.',
      followup_boundary:'Follow-up timeliness compares canonical completed_at with due_at. Cancelled follow-ups are not counted as completed; open overdue evidence remains open until CRM authority records completion or cancellation.',
      delivery_boundary:'Notification status sent is provider delivery evidence only. It is not proof that a customer read, understood or replied to the message; retry/failed/manual-review/blocked states remain provider-authority evidence.',
      recurrence_boundary:'Repeated unresolved outreach means at least two recorded outbound CRM interactions for the same work order with no later recorded inbound interaction after the first outbound. It is a review signal, not a customer-quality or staff-performance score.',
      coverage_boundary:'This view is bounded by the loaded canonical CRM interaction, follow-up, closeout and protected notification-delivery evidence. Missing or failed source reads are never converted into successful outcomes.',
      authority_boundary:'Read-only communication-outcome evidence. This layer cannot send email/text, retry providers, create or close CRM follow-ups/interactions, change consent/preferences, reschedule work, publish customer updates, collect payment or contact a provider.'
    },
    four_season_capacity_forecast:null,workability_schedule_recovery_outcomes:null,
    route_crew_efficiency_evidence:null,route_plan_actual_stop_sequence_learning:null,
    recurring_renewal_retention_workbench:null,recurring_renewal_conversion_churn_outcomes:null,
    estimate_to_cash_leakage_workbench:null,estimate_accuracy_change_order_margin_calibration:null,
    completed_to_invoiced_cycle_time_cash_conversion:null,labour_equipment_fleet_utilization_support:null,
    equipment_downtime_cost_replacement_readiness:null,labour_capture_completeness_payroll_exception_reduction:null,
    materials_consumables_seasonal_stock_readiness:null,material_usage_variance_reorder_calibration:null,
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
  await expect(page.locator('#owner372CommunicationOutcomes')).toBeVisible();
}

test('Build 372 renders recorded response, follow-up and provider evidence without inferring engagement',async({page})=>{
  await boot(page);
  const host=page.locator('#owner372CommunicationOutcomes');
  await expect(host).toContainText('Outbound CRM');
  await expect(host).toContainText('Recorded responses');
  await expect(host).toContainText('Open overdue');
  await expect(host.locator('[data-owner372-outreach="out-372a"]')).toContainText('recorded inbound response');
  await expect(host.locator('[data-owner372-outreach="out-372b"]')).toContainText('no recorded inbound response');
  await expect(host.locator('[data-owner372-followup="fu-372a"]')).toContainText('completed on time');
  await expect(host.locator('[data-owner372-followup="fu-372b"]')).toContainText('open overdue');
  await host.getByText('Repeated outreach needing review').click();
  await expect(host).toContainText('WO-372-B · 2 outbound interaction(s)');
  await host.getByText('Protected provider delivery outcomes').click();
  await expect(host).toContainText('WO-372-A · sent');
  await host.getByText('Response, outcome, follow-up & authority boundaries').click();
  await expect(host).toContainText('provider delivery evidence only');
  await expect(host).toContainText('not proof that a customer read, understood or replied');
  await expect(host).toContainText('not a customer-quality or staff-performance score');
  await expect(host).not.toContainText('customer@example.com');
  await expect(host).not.toContainText('555-0100');
  await expect(host).not.toContainText('portal-secret');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});

test('Build 372 withholds outcome facts when canonical source reads fail',async({page})=>{
  const d=fixture();d.customer_communication_outcome_followup_effectiveness.source_queries_ok=false;
  await boot(page,d);
  const host=page.locator('#owner372CommunicationOutcomes');
  await expect(host).toContainText('evidence reads failed');
  await expect(host).not.toContainText('WO-372-A');
  await expect(host).not.toContainText('Maple Customer');
});

test('Build 372 Operations button keeps navigation deliberate',async({page})=>{
  await boot(page);
  await page.locator('.owner372-communication-outcomes button').filter({hasText:'Open Operations'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__route)).toBe('admin');
  await expect.poll(()=>page.evaluate(()=>window.__group)).toBe('operations');
});
