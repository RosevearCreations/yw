import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const jobsSource=fs.readFileSync(path.join(process.cwd(),'js/jobs-ui.js'),'utf8');

function payload(){
  return {
    jobs:[],crews:[],crew_members:[],profiles:[],requirements:[],pools:[],signouts:[],notifications:[],inspections:[],maintenance:[],
    equipment:[{id:334,equipment_code:'MOW-334',equipment_name:'Zero Turn Mower',category:'mower',status:'available',meter_type:'hours',meter_unit:'hours',current_meter_value:242.5,is_locked_out:false}],
    equipment_registry_v2:[],equipment_registry_v2_summary:[],
    equipment_daily_inspection_templates:[],equipment_daily_inspection_workbench:[],equipment_daily_inspection_summary:[],
    fleet_vehicle_operations:[],fleet_operations_summary:[],fleet_towing_assignments:[],
    preventive_maintenance_workbench:[{
      id:'33400000-0000-4000-8000-000000000001',equipment_item_id:334,equipment_code:'MOW-334',equipment_name:'Zero Turn Mower',
      plan_code:'OIL-50H',plan_name:'Engine oil and filter',maintenance_type:'oil',schedule_basis:'hours',interval_meter:50,meter_unit:'hours',
      due_meter:250,current_meter_value:242.5,lead_meter:10,lead_days:14,plan_status:'active',due_status:'due_soon',estimated_cost:65,
      default_provider_name:'Shop',instructions:'Oil and filter'
    }],
    preventive_maintenance_summary:[{active_plan_count:1,overdue_count:0,due_count:0,due_soon_count:1,open_service_task_count:0,active_estimated_cost:65}],
    equipment_transfer_verifications:[],equipment_return_exceptions:[],operational_depth_gates:[],equipment_accountability:[],equipment_service_tasks:[]
  };
}

async function mount(page){
  await page.route('https://pm334.test/**',async(route)=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><section id="jobs"></section><section id="equipment"></section></body></html>'}));
  await page.goto('https://pm334.test/');
  await page.evaluate((data)=>{
    window.__calls=[];
    window.prompt=(message,def)=>{
      if(String(message).includes('Provider')) return 'Shop';
      if(String(message).includes('Cost')) return '72.50';
      if(String(message).includes('Completion notes')) return 'Oil, filter and grease completed';
      return def || '';
    };
    window.confirm=()=>true;
    window.__api={
      async fetchJobsDirectory(){return structuredClone(data);},
      async manageJobsEntity(req){
        window.__calls.push(structuredClone(req));
        return {ok:true,build:334,schema:222,record:{id:req.plan_id || 'new-334'},due_status:'scheduled'};
      }
    };
  },payload());
  await page.addScriptTag({content:jobsSource});
  await page.evaluate(async()=>{
    const ui=window.YWIJobsUI.create({api:window.__api,getAccessProfile:()=>({canManageJobs:true,canManageAdminDirectory:true}),getCurrentRole:()=> 'admin'});
    await ui.init();
  });
}

test('Build 334 renders preventive plan and saves meter schedule',async({page})=>{
  await mount(page);
  const panel=page.locator('#equipment_preventive_maintenance_v1');
  await expect(panel).toHaveAttribute('data-build','334');
  await expect(panel).toContainText('Preventive Maintenance Engine');
  await page.locator('[data-equipment-load="MOW-334"]').click();
  await expect(page.locator('#eq_pm_plan_code')).toHaveValue('OIL-50H');
  await expect(page.locator('#eq_pm_schedule_basis')).toHaveValue('hours');
  await page.locator('#eq_pm_interval_meter').fill('60');
  await page.getByRole('button',{name:'Save Maintenance Plan'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='preventive_maintenance_plan_upsert'))).toBe(true);
  const call=await page.evaluate(()=>window.__calls.find((row)=>row.action==='preventive_maintenance_plan_upsert'));
  expect(call.equipment_code).toBe('MOW-334');
  expect(call.interval_meter).toBe(60);
});

test('Build 334 opens due service work and records completion',async({page})=>{
  await mount(page);
  await page.locator('[data-equipment-load="MOW-334"]').click();
  await page.getByRole('button',{name:'Open Due Service Task'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='preventive_maintenance_open_task'))).toBe(true);
  await page.getByRole('button',{name:'Complete Maintenance'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='preventive_maintenance_complete'))).toBe(true);
  const completed=await page.evaluate(()=>window.__calls.find((row)=>row.action==='preventive_maintenance_complete'));
  expect(completed.plan_id).toBe('33400000-0000-4000-8000-000000000001');
  expect(completed.meter_value).toBe(242.5);
});

test('Build 334 exposes due-state workbench',async({page})=>{
  await mount(page);
  await expect(page.locator('#eq_pm_table')).toContainText('OIL-50H');
  await expect(page.locator('#eq_pm_table')).toContainText('due soon');
  await expect(page.locator('#eq_pm_summary')).toContainText('1 due soon');
});
