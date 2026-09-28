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
    management_metric_confidence:{
      recurring_retention:meta(),route_efficiency:{state:'missing',confidence:'low',reason:'No route fixture.'},
      capacity_forecast:{state:'missing',confidence:'low',reason:'No forecast fixture.'},crews_today:meta(),completion_today:meta(),schedule_risk:meta(),
      revenue:meta(),gross_margin:meta(),labour_utilization:{state:'unavailable',confidence:'unavailable'},receivables:meta(),cash_bank:meta(),
      recurring_completion:meta(),winter_operations:meta(),fall_cleanup:meta(),safety_blockers:{state:'unavailable',confidence:'unavailable'},
      equipment_blockers:meta(),workforce_blockers:{state:'unavailable',confidence:'unavailable'},finance_readiness:meta()
    },
    four_season_capacity_forecast:null,route_crew_efficiency_evidence:null,
    recurring_renewal_retention_workbench:{
      generated_at:now(),timezone:'America/Toronto',event_lookback_days:180,
      summary:{loaded_agreements:4,attention_agreements:3,renewal_candidates:2,retention_attention:2,repeated_service_friction:1,unresolved_service_issues:1,customer_holds:1,price_review_candidates:1,finance_evidence_visible:true},
      attention_queue:[{
        agreement_id:'a1',agreement_code:'RSA-1',client_name:'Maple Customer',site_name:'Maple Property',site_city:'Tillsonburg',
        service_name:'Weekly mowing',season_context:'spring_summer',agreement_status:'active',renewal_status:'due_30_days',
        skip_cancel_180d:1,weather_delay_180d:2,repeated_service_friction:true,unresolved_service_issue_count:1,
        seasonal_rollover_review_count:1,actual_profit_total:-120,actual_margin_percent:-8.5,finance_evidence_state:'available',
        renewal_candidate:true,retention_attention:true,price_review_candidate:true,attention_required:true,
        attention_reasons:['renewal window due 30 days','1 skip/cancel + 2 delay event(s) in 180d','1 unresolved CRM service/complaint issue(s)','recorded agreement profit is negative'],
        suggested_next_action:'Review renewal context',action_boundary:'review_only'
      }],
      agreements:[],
      margin_boundary:'Price-review candidates use only negative recorded agreement profit or a planned visit charge that does not exceed the recorded planned visit cost. No target margin or automatic price change is invented.',
      retention_boundary:'Repeated service friction means two or more recorded skip/cancel/weather-delay events in the loaded 180-day history; unresolved issues come from open CRM complaint/service-review evidence linked to the agreement.',
      communication_boundary:'Renewal/contact suggestions are preparation context only. No customer message is sent and no renewal is accepted automatically.',
      pricing_boundary:'Pricing review is advisory only. No agreement price, estimate, invoice or customer commitment is changed.',
      authority_boundary:'Recurring agreements, CRM interactions, seasonal rollover and Finance profitability remain their existing authorities; this workbench is read-only decision support.'
    },
    owner_jobs:[],owner_dispatch:[],owner_production:[],owner_profitability:[],owner_timekeeping_summary:[],owner_recurring:[],owner_recurring_visits:[],owner_crews:[],
    owner_storms:[],owner_storm_routes:[],owner_seasonal_work:[],owner_safety:[],owner_equipment:[],owner_maintenance:[],owner_training_summary:[],owner_workforce_summary:[],
    owner_receivables:[],owner_bank:[],owner_finance_exceptions:[],owner_close_dashboard:[],owner_workability:[]
  };
}
async function boot(page,data=fixture()){
  await page.setViewportSize({width:390,height:844});
  await page.setContent('<!doctype html><html><head></head><body><section id="admin"></section></body></html>');
  await page.evaluate(payload=>{
    window.YWIRouter={showSection:s=>window.__route=s};
    window.YWIAdminHub={open:s=>window.__group=s};
    window.YWIAPI={loadAdminDirectory:async()=>payload};
  },data);
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner355Retention')).toBeVisible();
}
test('Build 355 renders renewal and retention review evidence without automatic action',async({page})=>{
  await boot(page);
  const host=page.locator('#owner355Retention');
  await expect(host).toContainText('Renewal candidates');
  await expect(host).toContainText('Retention attention');
  await expect(host).toContainText('Repeated service friction');
  await expect(host).toContainText('Maple Customer');
  await expect(host).toContainText('Weekly mowing');
  await expect(host).toContainText('actual margin -8.5%');
  await expect(host).toContainText('No customer message is sent and no renewal is accepted automatically');
  await expect(page.locator('.owner355-retention')).toContainText('does not renew an agreement, change pricing, send a customer message or create a customer commitment');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});
test('Build 355 hides recurring evidence when Jobs access is unavailable',async({page})=>{
  const data=fixture();data.source_visibility.jobs=false;data.management_metric_confidence.recurring_retention={state:'unavailable',confidence:'unavailable',reason:'Jobs evidence hidden.'};
  await boot(page,data);
  await expect(page.locator('#owner355Retention')).toContainText('Recurring-service evidence is unavailable');
  await expect(page.locator('#owner355Retention')).not.toContainText('Maple Customer');
});
test('Build 355 keeps price-review evidence unavailable when Finance is hidden',async({page})=>{
  const data=fixture();data.source_visibility.finance=false;data.recurring_renewal_retention_workbench.summary.finance_evidence_visible=false;
  data.recurring_renewal_retention_workbench.attention_queue[0].finance_evidence_state='not_visible';
  data.recurring_renewal_retention_workbench.attention_queue[0].actual_margin_percent=null;
  await boot(page,data);
  await expect(page.locator('#owner355Retention')).toContainText('Finance evidence not visible');
  await expect(page.locator('#owner355Retention')).not.toContainText('actual margin -8.5%');
});
