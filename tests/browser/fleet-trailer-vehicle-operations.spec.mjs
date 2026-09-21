import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const jobsSource=fs.readFileSync(path.join(process.cwd(),'js/jobs-ui.js'),'utf8');

function payload(){
  return {
    jobs:[{id:3330,job_code:'JOB-333',job_name:'Fleet test',site_code:'YARD',site_name:'Main Yard'}],
    crews:[{id:'33300000-0000-4000-8000-000000000001',crew_code:'CREW-333',crew_name:'Fleet Crew'}],
    crew_members:[],profiles:[],requirements:[],pools:[],signouts:[],notifications:[],inspections:[],maintenance:[],
    equipment:[
      {id:333,equipment_code:'TRK-333',equipment_name:'Tow Truck',category:'truck',status:'available',meter_type:'odometer',meter_unit:'km',current_meter_value:82500,is_locked_out:false},
      {id:334,equipment_code:'TRL-333',equipment_name:'Landscape Trailer',category:'trailer',status:'available',meter_type:'none',meter_unit:null,current_meter_value:null,is_locked_out:false}
    ],
    equipment_registry_v2:[],equipment_registry_v2_summary:[],
    equipment_daily_inspection_templates:[],equipment_daily_inspection_workbench:[],equipment_daily_inspection_summary:[],
    fleet_vehicle_operations:[
      {equipment_item_id:333,equipment_code:'TRK-333',equipment_name:'Tow Truck',asset_class:'truck',plate_number:'ABC123',registration_expiry:'2027-05-01',insurance_policy_reference:'POL-333',insurance_expiry:'2027-04-01',annual_vehicle_inspection_due:'2027-03-01',tire_status:'good',hitch_class:'class-4',max_tow_kg:4500,fuel_type:'gasoline',operational_status:'ready',damage_status:'clear',latest_readiness_status:'ready',open_downtime_count:0,fuel_quantity_litres:120,fuel_cost_total:210},
      {equipment_item_id:334,equipment_code:'TRL-333',equipment_name:'Landscape Trailer',asset_class:'trailer',plate_number:'TRL333',tire_status:'monitor',hitch_class:'class-4',trailer_gvwr_kg:3200,trailer_connector:'7-pin',fuel_type:'none',operational_status:'ready',damage_status:'clear',latest_readiness_status:'needs_review',open_downtime_count:0}
    ],
    fleet_operations_summary:[{fleet_asset_count:2,truck_count:1,trailer_count:1,downtime_count:0,registration_attention_count:0,insurance_attention_count:0,inspection_attention_count:0,tire_attention_count:0}],
    fleet_towing_assignments:[{id:'33330000-0000-4000-8000-000000000001',truck_equipment_code:'TRK-333',trailer_equipment_code:'TRL-333',job_id:3330,assigned_at:'2026-09-21T18:00:00Z',released_at:null,hitch_compatible:true,tow_capacity_compatible:true}],
    equipment_transfer_verifications:[],equipment_return_exceptions:[],operational_depth_gates:[],equipment_accountability:[],equipment_service_tasks:[]
  };
}

async function mount(page){
  await page.route('https://fleet333.test/**',async(route)=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><section id="jobs"></section><section id="equipment"></section></body></html>'}));
  await page.goto('https://fleet333.test/');
  await page.evaluate((data)=>{
    window.__calls=[];
    window.prompt=(message,def)=>{
      if(String(message).includes('Downtime reason')) return 'Trailer light damage';
      if(String(message).includes('Damage summary')) return 'Left light cracked';
      if(String(message).includes('resolution')) return 'Light replaced and function checked';
      return def || '';
    };
    window.confirm=()=>true;
    window.__api={
      async fetchJobsDirectory(){return structuredClone(data);},
      async manageJobsEntity(req){
        window.__calls.push(structuredClone(req));
        return {ok:true,build:333,schema:221,record:{id:req.assignment_id || 'new-333'},compatibility:{hitch_compatible:true,tow_capacity_compatible:true}};
      }
    };
  },payload());
  await page.addScriptTag({content:jobsSource});
  await page.evaluate(async()=>{
    const ui=window.YWIJobsUI.create({api:window.__api,getAccessProfile:()=>({canManageJobs:true,canManageAdminDirectory:true}),getCurrentRole:()=> 'admin'});
    await ui.init();
  });
}

test('Build 333 renders fleet profile and records operational evidence',async({page})=>{
  await mount(page);
  const panel=page.locator('#equipment_fleet_operations_v1');
  await expect(panel).toHaveAttribute('data-build','333');
  await expect(panel).toContainText('Fleet, Trailer & Vehicle Operations');
  await page.locator('[data-equipment-load="TRK-333"]').click();
  await expect(page.locator('#eq_fleet_asset_class')).toHaveValue('truck');
  await expect(page.locator('#eq_fleet_plate')).toHaveValue('ABC123');
  await page.locator('#eq_fleet_plate').fill('NEW333');
  await page.getByRole('button',{name:'Save Fleet Profile'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='fleet_profile_upsert'))).toBe(true);
  const call=await page.evaluate(()=>window.__calls.find((row)=>row.action==='fleet_profile_upsert'));
  expect(call.equipment_code).toBe('TRK-333');
  expect(call.plate_number).toBe('NEW333');
});

test('Build 333 submits towing compatibility assignment and supports downtime closure',async({page})=>{
  await mount(page);
  await page.locator('#eq_fleet_tow_truck').fill('TRK-333');
  await page.locator('#eq_fleet_tow_trailer').fill('TRL-333');
  await page.locator('#eq_fleet_tow_job').fill('JOB-333');
  await page.getByRole('button',{name:'Assign Tow Pair'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='fleet_towing_assign'))).toBe(true);
  const tow=await page.evaluate(()=>window.__calls.find((row)=>row.action==='fleet_towing_assign'));
  expect(tow).toMatchObject({truck_equipment_code:'TRK-333',trailer_equipment_code:'TRL-333',job_code:'JOB-333'});
  await page.locator('[data-equipment-load="TRL-333"]').click();
  await page.getByRole('button',{name:'Start Downtime'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='fleet_downtime_start'))).toBe(true);
  await page.getByRole('button',{name:'Clear Downtime'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='fleet_downtime_clear'))).toBe(true);
});

test('Build 333 lists active tow assignments with release action',async({page})=>{
  await mount(page);
  await expect(page.locator('#eq_fleet_towing_table')).toContainText('TRK-333');
  await expect(page.locator('#eq_fleet_towing_table')).toContainText('TRL-333');
  await page.locator('[data-fleet-tow-release="33330000-0000-4000-8000-000000000001"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some((row)=>row.action==='fleet_towing_release'))).toBe(true);
});
