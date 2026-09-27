import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-owner-management-command-ui.js'),'utf8');

const now=()=>new Date().toISOString();
const stale=()=>new Date(Date.now()-10*24*60*60*1000).toISOString();
const src=(key,module,view,state='current',confidence='high',updated=now(),extra={})=>({
  source_key:key,source_module:module,source_view:view,retrieved_at:now(),row_count:1,query_limit:500,last_authoritative_update:updated,
  stale_after_hours:72,coverage_state:'within_query_limit',freshness_state:state,confidence,coverage_gap:false,
  reason:state==='stale'?'Latest authoritative update is older than the freshness window.':'Source is current and within the configured query limit.',...extra
});
const metric=(state='current',confidence='high',updated=now(),reason='All required authoritative sources are current.')=>({
  state,confidence,last_authoritative_update:updated,reason,source_keys:[]
});
function fixture(){
  const fresh=now(),old=stale();
  return {
    ok:true,source_visibility:{jobs:true,finance:true,safety:true,admin:true},
    source_freshness:{
      jobs:src('jobs','jobs','v_jobs_directory','current','high',fresh),
      dispatch:src('dispatch','jobs','v_crew_dispatch_schedule','current','high',fresh),
      production:src('production','jobs','v_landscape_production_session_directory','current','high',fresh),
      profitability:src('profitability','finance','v_job_profitability_variance_directory','stale','medium',old),
      timekeeping:src('timekeeping','admin','v_timekeeping_attendance_summary','current','high',fresh),
      workability:src('workability','jobs','v_weather_workability_queue','current','high',fresh),
      receivables:src('receivables','finance','v_ar_invoice_aging_detail','current','high',fresh),
      bank:src('bank','finance','v_bank_reconciliation_summary','current','high',fresh),
      safety:src('safety','safety','v_supervisor_safety_queue','current','high',fresh),
      equipment:src('equipment','jobs','v_equipment_registry_v2','current','high',fresh),
      maintenance:src('maintenance','jobs','v_preventive_maintenance_workbench','current','high',fresh),
      recurring_visits:src('recurring_visits','jobs','v_recurring_service_visit_schedule','current','high',fresh),
      storms:src('storms','jobs','seasonal_storm_events','current','high',fresh),
      storm_routes:src('storm_routes','jobs','v_seasonal_storm_route_directory','current','high',fresh),
      finance_exceptions:src('finance_exceptions','finance','v_accounting_reconciliation_manual_review_queue','current','high',fresh),
      close_dashboard:src('close_dashboard','finance','v_accounting_close_dashboard','current','high',fresh),
      training:src('training','safety','v_training_certification_matrix_summary','current','high',fresh),
      workforce:src('workforce','admin','v_workforce_summary','current','high',fresh),
      seasonal_work:src('seasonal_work','jobs','v_seasonal_operations_outstanding_work','current','high',fresh)
    },
    management_metric_confidence:{
      crews_today:metric(),completion_today:metric(),schedule_risk:metric(),
      revenue:metric('stale','medium',old,'Profitability source is stale.'),
      gross_margin:metric('stale','medium',old,'Profitability source is stale.'),
      labour_utilization:metric(),receivables:metric(),cash_bank:metric(),recurring_completion:metric(),
      winter_operations:metric(),fall_cleanup:metric(),safety_blockers:metric(),equipment_blockers:metric(),
      workforce_blockers:metric(),finance_readiness:metric()
    },
    owner_jobs:[{id:'j1',job_code:'JOB-1',job_name:'Fall cleanup',status:'completed',updated_at:fresh}],
    owner_dispatch:[{id:'d1',crew_name:'Crew A',job_name:'Snow Route A',site_name:'North',scheduled_start:fresh,schedule_status:'scheduled',updated_at:fresh}],
    owner_production:[{job_session_id:'p1',session_date:fresh,production_state:'completed_with_evidence',total_labour_hours:6,updated_at:fresh}],
    owner_profitability:[{group_type:'job',group_key:'JOB-1',actual_revenue_total:1200,actual_cost_total:700,actual_profit_total:500,updated_at:old}],
    owner_timekeeping_summary:[{recent_paid_minutes:480,updated_at:fresh}],owner_recurring:[],
    owner_recurring_visits:[{service_name:'Fall cleanup',season_context:'fall',service_date:fresh,visit_status:'completed',updated_at:fresh}],
    owner_storms:[{id:'s1',event_status:'active',event_name:'Winter storm',updated_at:fresh}],owner_storm_routes:[{id:'sr1',route_status:'active',route_name:'Snow Route A',updated_at:fresh}],
    owner_seasonal_work:[{id:'f1',service_name:'Fall leaf cleanup',status:'completed',updated_at:fresh}],owner_safety:[{queue_id:'q1',headline:'PPE',status:'open',updated_at:fresh}],
    owner_equipment:[{id:'e1',equipment_code:'TRK-1',is_locked_out:true,updated_at:fresh}],owner_maintenance:[{id:'m1',due_status:'overdue',updated_at:fresh}],
    owner_training_summary:[{attention_count:1,internal_authorization_pending_count:0,updated_at:fresh}],owner_workforce_summary:[{training_attention_count:1,authorization_attention_count:0,availability_attention_count:0,updated_at:fresh}],
    owner_receivables:[{id:'i1',invoice_number:'INV-1',balance_due:300,days_past_due:20,updated_at:fresh}],owner_bank:[{period_end:'2026-09-24',bank_balance:5000,updated_at:fresh}],
    owner_finance_exceptions:[{reconciliation_item_id:'x1',updated_at:fresh}],owner_close_dashboard:[{open_bank_reconciliation_count:1,open_tax_filing_count:0,open_payroll_remittance_count:0,updated_at:fresh}],owner_workability:[]
  };
}
async function boot(page,data=fixture()){
  await page.setViewportSize({width:390,height:844});
  await page.setContent('<!doctype html><html><head></head><body><section id="admin"></section></body></html>');
  await page.evaluate((payload)=>{
    window.YWIRouter={showSection:s=>window.__route=s};
    window.YWIAdminHub={open:s=>window.__group=s};
    window.YWIAPI={loadAdminDirectory:async()=>payload};
  },data);
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner351Freshness')).toBeVisible();
}
test('stale authoritative source is visible and reduces metric confidence',async({page})=>{
  await boot(page);
  await expect(page.locator('#owner351Freshness')).toContainText('Stale sources');
  await page.locator('#owner351Freshness details summary').click();
  await expect(page.locator('#owner351Freshness')).toContainText('v_job_profitability_variance_directory');
  await expect(page.locator('#owner351Freshness')).toContainText('STALE');
  const revenue=page.locator('#owner350Kpis .owner350-kpi').filter({hasText:'Revenue'});
  await expect(revenue.locator('strong')).toHaveText('$1,200');
  await expect(revenue.locator('.owner351-meta')).toContainText('STALE');
  await expect(revenue.locator('.owner351-meta')).toContainText('MEDIUM');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBeFalsy();
});
test('no-row source is not rendered as a zero-valued business fact',async({page})=>{
  const data=fixture();
  data.owner_profitability=[];
  data.source_freshness.profitability={...data.source_freshness.profitability,row_count:0,last_authoritative_update:null,coverage_state:'no_rows',freshness_state:'missing',confidence:'low',reason:'No authoritative source rows were returned; zero is not inferred.'};
  data.management_metric_confidence.revenue=metric('missing','low',null,'No authoritative source rows were returned; zero is not inferred.');
  data.management_metric_confidence.gross_margin=metric('missing','low',null,'No authoritative source rows were returned; zero is not inferred.');
  await boot(page,data);
  const revenue=page.locator('#owner350Kpis .owner350-kpi').filter({hasText:'Revenue'});
  await expect(revenue.locator('strong')).toHaveText('No source evidence');
  await expect(revenue).toContainText('zero is not inferred');
});
test('permission-hidden Finance is explicit and never fabricates a value',async({page})=>{
  const data=fixture();
  data.source_visibility.finance=false;
  data.owner_profitability=[];data.owner_receivables=[];data.owner_bank=[];data.owner_finance_exceptions=[];data.owner_close_dashboard=[];
  for(const key of ['profitability','receivables','bank','finance_exceptions','close_dashboard']){
    data.source_freshness[key]={...data.source_freshness[key],row_count:0,last_authoritative_update:null,coverage_state:'hidden',freshness_state:'hidden',confidence:'unavailable',reason:'Source module is not visible to this profile.'};
  }
  for(const key of ['revenue','gross_margin','receivables','cash_bank','finance_readiness']){
    data.management_metric_confidence[key]=metric('unavailable','unavailable',null,'Source module is not visible to this profile.');
  }
  await boot(page,data);
  const revenue=page.locator('#owner350Kpis .owner350-kpi').filter({hasText:'Revenue'});
  await expect(revenue.locator('strong')).toHaveText('Unavailable');
  await expect(revenue).toContainText('Source module is not visible');
  await expect(page.locator('#owner350Finance')).toContainText('Finance module is not visible');
});
