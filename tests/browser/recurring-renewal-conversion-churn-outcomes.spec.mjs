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
    management_metric_confidence:{recurring_outcomes:meta()},
    recurring_renewal_conversion_churn_outcomes:{
      generated_at:now(),timezone:'America/Toronto',source_queries_ok:true,
      summary:{
        loaded_agreements:5,renewed_count:1,declined_count:1,held_count:1,expired_count:1,unresolved_count:1,
        explicit_renewal_decision_count:2,recorded_renewal_conversion_rate_percent:50,
        recorded_churn_outcome_count:2,outcomes_with_unresolved_service_issues:1,finance_evidence_visible:true
      },
      outcome_groups:[
        {outcome_state:'renewed',count:1,recorded_profit_total:420},
        {outcome_state:'declined',count:1,recorded_profit_total:-80},
        {outcome_state:'held',count:1,recorded_profit_total:75},
        {outcome_state:'expired',count:1,recorded_profit_total:10},
        {outcome_state:'unresolved',count:1,recorded_profit_total:null}
      ],
      outcomes:[
        {agreement_id:'a2',agreement_code:'RSA-2',client_name:'Decline Customer',service_name:'Weekly mowing',agreement_status:'cancelled',renewal_status:'overdue',outcome_state:'declined',outcome_date:'2026-09-20',outcome_source:'crm_interaction',reason_evidence:[{source:'crm_interaction',type:'renewal_decision',text:'Customer declined renewal',recorded_at:'2026-09-20T12:00:00Z'}],unresolved_service_issue_count:1,finance_evidence_state:'available',actual_profit_total:-80,actual_margin_percent:-4},
        {agreement_id:'a1',agreement_code:'RSA-1',client_name:'Renew Customer',service_name:'Seasonal lawn care',agreement_status:'active',renewal_status:'future',outcome_state:'renewed',outcome_date:'2026-09-18',outcome_source:'seasonal_rollover',reason_evidence:[{source:'seasonal_rollover',type:'renewal_decision',text:'Renewal accepted for next season',recorded_at:'2026-09-18T12:00:00Z'}],unresolved_service_issue_count:0,finance_evidence_state:'available',actual_profit_total:420,actual_margin_percent:18}
      ],
      classification_boundary:'Renewed and declined require explicit CRM/seasonal renewal-decision evidence or an explicitly renewal-related cancellation reason. Active, overdue, cancelled or future status alone is not converted into a renewal decision. Held uses recorded pause/hold evidence. Expired requires recorded ended/expired lifecycle evidence or an end date already passed on a non-active lifecycle.',
      conversion_boundary:'Recorded renewal conversion rate is renewed divided by explicit renewed plus declined decisions only. Held, expired and unresolved agreements are excluded from that rate rather than being guessed.',
      churn_boundary:'Recorded churn outcomes are explicit declined plus expired outcomes only. Ambiguous cancellation or missing renewal evidence remains unresolved.',
      finance_boundary:'Profit and margin are shown only when Finance evidence is visible and recorded. No target profitability, renewal price or retention value is invented.',
      authority_boundary:'Read-only outcome learning only. This layer cannot renew or cancel an agreement, change pricing, send customer contact, resolve a complaint, or mutate CRM, recurring-service, seasonal-rollover or Finance records.'
    },
    four_season_capacity_forecast:null,workability_schedule_recovery_outcomes:null,route_crew_efficiency_evidence:null,
    route_plan_actual_stop_sequence_learning:null,recurring_renewal_retention_workbench:null,
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
  await expect(page.locator('#owner366Outcomes')).toBeVisible();
}

test('Build 366 renders explicit conversion and churn outcomes without automatic action',async({page})=>{
  await boot(page);
  const host=page.locator('#owner366Outcomes');
  await expect(host).toContainText('Recorded conversion');
  await expect(host).toContainText('50.0%');
  await expect(host.locator('[data-owner366-state="declined"]')).toContainText('Decline Customer');
  await expect(host.locator('[data-owner366-state="declined"]')).toContainText('Customer declined renewal');
  await expect(host.locator('[data-owner366-state="declined"]')).toContainText('recorded profit');
  await expect(host.locator('[data-owner366-state="renewed"]')).toContainText('Renew Customer');
  await expect(host).toContainText('Active, overdue, cancelled or future status alone is not converted into a renewal decision');
  await expect(host).toContainText('Ambiguous cancellation or missing renewal evidence remains unresolved');
  await expect(page.locator('.owner366-outcomes')).toContainText('does not renew/cancel agreements, change pricing, contact customers or resolve complaints');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});

test('Build 366 remains permission-aware for Jobs and Finance evidence',async({page})=>{
  const hidden=fixture();
  hidden.source_visibility.jobs=false;
  hidden.management_metric_confidence.recurring_outcomes={state:'unavailable',confidence:'unavailable',reason:'Jobs evidence hidden.'};
  await boot(page,hidden);
  await expect(page.locator('#owner366Outcomes')).toContainText('Recurring-service outcome evidence is unavailable');
  await expect(page.locator('[data-owner366-state]')).toHaveCount(0);

  const finance=fixture();
  finance.source_visibility.finance=false;
  finance.recurring_renewal_conversion_churn_outcomes.summary.finance_evidence_visible=false;
  finance.recurring_renewal_conversion_churn_outcomes.outcomes.forEach(r=>{r.finance_evidence_state='not_visible';r.actual_profit_total=null;r.actual_margin_percent=null});
  finance.recurring_renewal_conversion_churn_outcomes.outcome_groups.forEach(g=>{g.recorded_profit_total=null});
  await boot(page,finance);
  await expect(page.locator('#owner366Outcomes')).not.toContainText('recorded profit $');
  await expect(page.locator('#owner366Outcomes')).toContainText('Profit and margin are shown only when Finance evidence is visible and recorded');
});
