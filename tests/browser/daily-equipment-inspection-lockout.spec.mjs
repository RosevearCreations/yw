import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const jobsSource=fs.readFileSync(path.join(process.cwd(),'js/jobs-ui.js'),'utf8');

function payload(){
  return {
    jobs:[{id:3320,job_code:'JOB-332',job_name:'Inspection test',site_code:'YARD',site_name:'Main Yard'}],
    crews:[],crew_members:[],profiles:[],requirements:[],pools:[],signouts:[],notifications:[],inspections:[],maintenance:[],
    equipment:[{id:332,equipment_code:'MOW-332',equipment_name:'Zero Turn Mower',category:'mower',status:'available',meter_unit:'hours',current_meter_value:120.5,is_locked_out:false}],
    equipment_registry_v2:[],equipment_registry_v2_summary:[],
    equipment_daily_inspection_templates:[{
      id:'33210000-0000-4000-8000-000000000001',template_code:'DAILY-MOWER-PRE',template_name:'Mower pre-use',equipment_category:'mower',inspection_stage:'pre_use',
      checklist_items:[
        {id:'33220000-0000-4000-8000-000000000001',item_key:'guards',inspection_area:'guards_safety',item_label:'Guards and safety systems',is_safety_critical:true},
        {id:'33220000-0000-4000-8000-000000000002',item_key:'fluids',inspection_area:'fluids',item_label:'Fluids and leaks',is_safety_critical:true},
        {id:'33220000-0000-4000-8000-000000000003',item_key:'accessories',inspection_area:'accessories',item_label:'Accessories',is_safety_critical:false}
      ]
    }],
    equipment_daily_inspection_workbench:[{
      id:'33230000-0000-4000-8000-000000000001',equipment_code:'MOW-332',inspection_stage:'pre_use',overall_status:'fail',
      safety_critical_failure:true,supervisor_review_status:'pending',return_to_service_status:'blocked',
      service_task_id:'33240000-0000-4000-8000-000000000001',service_task_status:'resolved'
    }],
    equipment_daily_inspection_summary:[{today_count:1,today_pre_use_count:1,today_post_use_count:0,critical_failure_count:1,supervisor_review_pending_count:1,return_to_service_pending_count:1}],
    equipment_transfer_verifications:[],equipment_return_exceptions:[],operational_depth_gates:[],equipment_accountability:[],equipment_service_tasks:[]
  };
}

async function mount(page){
  await page.route('https://inspect332.test/**',async(route)=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><section id="jobs"></section><section id="equipment"></section></body></html>'}));
  await page.goto('https://inspect332.test/');
  await page.evaluate((data)=>{
    window.__calls=[];
    window.prompt=(message,def)=>{
      if(String(message).includes('Supervisor review')) return 'approved';
      if(String(message).includes('review notes')) return 'Repair verified.';
      if(String(message).includes('return-to-service')) return 'Resolved service task and functional check completed.';
      return def || '';
    };
    window.confirm=()=>true;
    window.__api={
      async fetchJobsDirectory(){return structuredClone(data);},
      async manageJobsEntity(req){
        window.__calls.push(structuredClone(req));
        if(req.action==='daily_inspection_submit') return {ok:true,build:332,schema:220,locked_out:true,record:{id:'new-332'}};
        if(req.action==='daily_inspection_review') return {ok:true,build:332,record:{id:req.inspection_id,supervisor_review_status:req.review_status}};
        if(req.action==='daily_inspection_return_to_service') return {ok:true,build:332,record:{id:req.inspection_id,return_to_service_status:'verified'}};
        return {ok:true,record:{}};
      }
    };
  },payload());
  await page.addScriptTag({content:jobsSource});
  await page.evaluate(async()=>{
    const ui=window.YWIJobsUI.create({api:window.__api,getAccessProfile:()=>({canManageJobs:true,canManageAdminDirectory:true}),getCurrentRole:()=> 'admin'});
    await ui.init();
  });
}

test('Build 332 renders machine-specific daily inspection controls and submits critical lockout evidence',async({page})=>{
  await mount(page);
  const panel=page.locator('#equipment_daily_inspection_v1');
  await expect(panel).toHaveAttribute('data-build','332');
  await expect(panel).toContainText('Daily Equipment Inspection & Lockout');
  await page.locator('[data-equipment-load="MOW-332"]').click();
  await expect(page.locator('#eq_daily_inspection_template')).toHaveValue('33210000-0000-4000-8000-000000000001');
  await expect(page.locator('#eq_daily_inspection_items')).toHaveValue(/guards \| pass \| critical/);
  await page.locator('#eq_daily_inspection_items').fill('guards | fail | critical | Missing discharge guard\nfluids | pass | critical |\naccessories | pass | normal |');
  await page.locator('#eq_daily_inspection_defect_summary').fill('Missing discharge guard.');
  await page.getByRole('button',{name:'Submit Daily Inspection'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='daily_inspection_submit'))).toBe(true);
  const call=await page.evaluate(()=>window.__calls.find((row)=>row.action==='daily_inspection_submit'));
  expect(call.equipment_code).toBe('MOW-332');
  expect(call.inspection_stage).toBe('pre_use');
  expect(call.checklist_items.find((row)=>row.item_key==='guards')).toMatchObject({result_status:'fail',is_safety_critical:true});
});

test('Build 332 exposes separate supervisor review and verified return-to-service actions',async({page})=>{
  await mount(page);
  await expect(page.locator('#eq_daily_inspection_table')).toContainText('YES — LOCKOUT');
  await page.locator('[data-daily-inspection-review="33230000-0000-4000-8000-000000000001"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='daily_inspection_review'))).toBe(true);
  await page.locator('[data-daily-inspection-return="33230000-0000-4000-8000-000000000001"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='daily_inspection_return_to_service'))).toBe(true);
  const verify=await page.evaluate(()=>window.__calls.find((row)=>row.action==='daily_inspection_return_to_service'));
  expect(verify.verification_status).toBe('verified');
});
