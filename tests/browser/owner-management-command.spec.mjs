import {test,expect} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-owner-management-command-ui.js'),'utf8');
async function boot(page){
 await page.setViewportSize({width:390,height:844});await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(()=>{window.YWIRouter={showSection:s=>window.__route=s};window.YWIAdminHub={open:s=>window.__group=s};window.YWIAPI={loadAdminDirectory:async()=>({ok:true,source_visibility:{jobs:true,finance:true,safety:true,admin:true},
 owner_jobs:[{id:'j1',job_code:'JOB-1',job_name:'Fall cleanup',status:'completed'}],
 owner_dispatch:[{id:'d1',crew_name:'Crew A',job_name:'Snow Route A',site_name:'North',scheduled_start:new Date().toISOString(),schedule_status:'scheduled'}],
 owner_production:[{job_session_id:'p1',session_date:new Date().toISOString(),production_state:'completed_with_evidence',total_labour_hours:6}],
 owner_profitability:[{group_type:'job',group_key:'JOB-1',actual_revenue_total:1200,actual_cost_total:700,actual_profit_total:500}],
 owner_timekeeping_summary:[{recent_paid_minutes:480}],
 owner_recurring:[],owner_recurring_visits:[{service_name:'Fall cleanup',season_context:'fall',service_date:new Date().toISOString(),visit_status:'completed'}],
 owner_storms:[{id:'s1',event_status:'active',event_name:'Winter storm'}],owner_storm_routes:[{id:'sr1',route_status:'active',route_name:'Snow Route A'}],
 owner_seasonal_work:[{id:'f1',service_name:'Fall leaf cleanup',status:'completed'}],owner_safety:[{queue_id:'q1',headline:'PPE',status:'open'}],
 owner_equipment:[{id:'e1',equipment_code:'TRK-1',is_locked_out:true}],owner_maintenance:[{id:'m1',due_status:'overdue'}],
 owner_training_summary:[{attention_count:1,internal_authorization_pending_count:0}],owner_workforce_summary:[{training_attention_count:1,authorization_attention_count:0,availability_attention_count:0}],
 owner_receivables:[{id:'i1',invoice_number:'INV-1',balance_due:300,days_past_due:20}],owner_bank:[{period_end:'2026-09-24',bank_balance:5000}],
 owner_finance_exceptions:[{reconciliation_item_id:'x1'}],owner_close_dashboard:[{open_bank_reconciliation_count:1,open_tax_filing_count:0,open_payroll_remittance_count:0}],owner_workability:[]})};});
 await page.addScriptTag({content:source});await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));await expect(page.locator('#ownerCommand350')).toBeVisible();
}
test('owner cockpit shows four-season management evidence and deep links',async({page})=>{await boot(page);
 await expect(page.locator('#owner350Kpis')).toContainText('Crews today');await expect(page.locator('#owner350Kpis')).toContainText('$1,200');
 await expect(page.locator('#owner350Seasonal')).toContainText('Winter storms');await expect(page.locator('#owner350Seasonal')).toContainText('Fall cleanup progress');
 await expect(page.locator('#owner350Blockers')).toContainText('Safety blockers');await expect(page.locator('#owner350Attention')).toContainText('Overdue receivables');
 await page.locator('[data-owner350-open="finance"]').click();expect(await page.evaluate(()=>window.__route)).toBe('finance');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);expect(overflow).toBeFalsy();
});
test('hidden Finance is explicit rather than fabricated',async({page})=>{await boot(page);await page.evaluate(()=>{window.YWIAPI.loadAdminDirectory=async()=>({ok:true,source_visibility:{jobs:true,finance:false,safety:true,admin:true},owner_jobs:[],owner_dispatch:[],owner_production:[],owner_profitability:[],owner_timekeeping_summary:[],owner_recurring:[],owner_recurring_visits:[],owner_storms:[],owner_storm_routes:[],owner_seasonal_work:[],owner_safety:[],owner_equipment:[],owner_maintenance:[],owner_training_summary:[],owner_workforce_summary:[],owner_receivables:[],owner_bank:[],owner_finance_exceptions:[],owner_close_dashboard:[],owner_workability:[]});document.querySelector('#ownerCommand350').dataset.mounted='';document.querySelector('#ownerCommand350').remove();window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI});});await expect(page.locator('#owner350Finance')).toContainText('Finance module is not visible');});
