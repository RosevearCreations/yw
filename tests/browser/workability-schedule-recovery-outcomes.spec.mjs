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
    management_metric_confidence:{workability_schedule_recovery:meta()},
    workability_schedule_recovery_outcomes:{
      source_queries_ok:true,jobs_visible:true,lookback_days:90,lookback_start:'2026-07-05',lookback_end:'2026-10-03',
      summary:{
        constraint_episodes:5,linked_dispatch_count:5,full_completion_recovery_count:3,same_day_completion_count:1,
        completed_after_recovery_count:2,partial_or_return_visit_count:1,reschedule_pending_count:1,unresolved_count:0,
        completion_recovery_rate_percent:60,average_recovery_days:1.7,recorded_completed_service_minutes:420
      },
      season_outcomes:[
        {season_context:'spring_summer',constraint_episodes:1,full_completion_recovery_count:1,partial_or_return_visit_count:0,reschedule_pending_count:0,unresolved_count:0,recovery_rate_percent:100},
        {season_context:'fall',constraint_episodes:1,full_completion_recovery_count:0,partial_or_return_visit_count:1,reschedule_pending_count:0,unresolved_count:0,recovery_rate_percent:0},
        {season_context:'winter',constraint_episodes:2,full_completion_recovery_count:1,partial_or_return_visit_count:0,reschedule_pending_count:1,unresolved_count:0,recovery_rate_percent:50},
        {season_context:'four_season',constraint_episodes:1,full_completion_recovery_count:1,partial_or_return_visit_count:0,reschedule_pending_count:0,unresolved_count:0,recovery_rate_percent:100}
      ],
      outcomes:[
        {source_key:'WK-ICE-1',work_order_number:'WO-100',service_date:'2026-09-30',season_context:'winter',decision_state:'reschedule',workability_state:'blocked',decision_reason:'Freezing rain / ice review',outcome_state:'completed_after_recovery',outcome_date:'2026-10-02',recovery_days:2,completed_service_minutes:180},
        {source_key:'WK-FALL-1',work_order_number:'WO-101',service_date:'2026-09-29',season_context:'fall',decision_state:'postpone',workability_state:'delayed',decision_reason:'Wet leaf cleanup review',outcome_state:'partial_or_return_visit',outcome_date:'2026-09-30',recovery_days:1,completed_service_minutes:0}
      ],
      evidence_boundary:'A recovery outcome is emitted only from recorded YW Workability, Dispatch and Production evidence.',
      capacity_boundary:'Completed-capacity evidence uses recorded production duration_minutes only. No jobs-per-crew target, productivity rate or missing duration is invented.',
      weather_boundary:'No external weather provider is queried. Human/source-authoritative Workability observations and decisions remain the weather/workability authority.',
      authority_boundary:'Read-only learning only. This outcome layer cannot change a Workability decision, move or dispatch a schedule item, complete work, send a customer message or alter Safety, Equipment or Finance state.'
    },
    four_season_capacity_forecast:null,route_crew_efficiency_evidence:null,recurring_renewal_retention_workbench:null,
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
  await expect(page.locator('#owner364Recovery')).toBeVisible();
}

test('Build 364 renders recorded recovery outcomes and four-season evidence',async({page})=>{
  await boot(page);
  const host=page.locator('#owner364Recovery');
  await expect(host).toContainText('Constraint episodes');
  await expect(host).toContainText('Full completion recovery');
  await expect(host).toContainText('60.0%');
  await expect(host).toContainText('1.7 d');
  await expect(host).toContainText('7.0 h recorded completed service');
  await expect(host).toContainText('spring / summer');
  await expect(host).toContainText('fall');
  await expect(host).toContainText('winter');
  await expect(host).toContainText('four / season');
  await host.getByText('Recent recovery evidence').click();
  await expect(host.locator('[data-owner364-state="completed_after_recovery"]')).toContainText('WO-100');
  await expect(host).toContainText('Freezing rain / ice review');
  await expect(host).toContainText('No external weather provider is queried');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});

test('Build 364 remains permission-aware and cannot become dispatch authority',async({page})=>{
  const data=fixture();
  data.source_visibility.jobs=false;
  data.management_metric_confidence.workability_schedule_recovery={state:'unavailable',confidence:'unavailable',reason:'Jobs evidence hidden.'};
  await boot(page,data);
  const host=page.locator('#owner364Recovery');
  await expect(host).toContainText('Jobs/operations evidence is unavailable');
  await expect(host.locator('[data-owner364-state]')).toHaveCount(0);
  await expect(page.locator('.owner364-recovery')).toContainText('cannot change a Workability decision');
  await expect(page.locator('.owner364-recovery')).toContainText('move a schedule item');
  await expect(page.locator('.owner364-recovery')).toContainText('dispatch crews');
});
