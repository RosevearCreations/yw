import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const jobsSource=fs.readFileSync(path.join(process.cwd(),'js/jobs-ui.js'),'utf8');
const materialsSource=fs.readFileSync(path.join(process.cwd(),'js/jobs-materials-control.js'),'utf8');

function payload(){
  return {
    jobs:[],crews:[],crew_members:[],profiles:[],requirements:[],pools:[],signouts:[],notifications:[],inspections:[],maintenance:[],
    equipment:[],equipment_registry_v2:[],equipment_registry_v2_summary:[],equipment_daily_inspection_templates:[],equipment_daily_inspection_workbench:[],equipment_daily_inspection_summary:[],
    fleet_vehicle_operations:[],fleet_operations_summary:[],fleet_towing_assignments:[],preventive_maintenance_workbench:[],preventive_maintenance_summary:[],
    work_orders:[{id:'wo-335',work_order_number:'WO-335',legacy_job_id:null,status:'scheduled'}],
    material_vendors:[{id:'vendor-335',display_name:'Landscape Supply',legal_name:'Landscape Supply Ltd.'}],
    material_units:[{id:'unit-kg',code:'kg',name:'Kilogram'}],
    material_stock_control:[{
      id:'mat-335',sku:'MULCH-BLK',item_name:'Black Mulch',material_category:'mulch',unit_id:'unit-kg',unit_code:'kg',
      default_unit_cost:0.65,current_unit_cost:0.7,inventory_tracked:true,reorder_point:100,reorder_quantity:500,target_stock_quantity:700,
      opening_quantity:200,preferred_vendor_id:'vendor-335',preferred_vendor_name:'Landscape Supply',supplier_sku:'BLK-MULCH',storage_location:'Bin 2',
      stock_on_hand:95,stock_value:66.5,job_use_quantity:110,waste_quantity:5,usage_variance_quantity:2,reorder_required:true,stock_status:'reorder',is_active:true
    }],
    material_control_summary:[{active_material_count:1,tracked_material_count:1,reorder_required_count:1,stock_value_total:66.5,job_use_quantity_total:110,waste_quantity_total:5,usage_variance_quantity_total:2}],
    fuel_consumables_summary:[{fuel_type:'gasoline',fuel_event_count:3,quantity_litres:75,total_cost:112.5,average_cost_per_litre:1.5}],
    estimates:[],estimate_lines:[],work_order_lines:[],equipment_transfer_verifications:[],equipment_return_exceptions:[],operational_depth_gates:[],equipment_accountability:[],equipment_service_tasks:[]
  };
}

async function mount(page){
  await page.route('https://mat335.test/**',async(route)=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><section id="jobs"></section><section id="equipment"></section></body></html>'}));
  await page.goto('https://mat335.test/');
  await page.evaluate((data)=>{
    window.__calls=[];
    window.prompt=(message,def)=>{
      const promptText=String(message).toLowerCase();
      if(promptText.includes('quantity received')) return '25';
      if(promptText.includes('unit cost')) return '0.72';
      if(promptText.includes('quantity to issue')) return '10';
      if(promptText.includes('planned quantity')) return '8';
      if(promptText.includes('quantity delta')) return '-2';
      if(promptText.includes('counted quantity')) return '90';
      if(promptText.includes('reason')) return 'Cycle count';
      return def || '';
    };
    window.confirm=()=>true;
    window.__api={
      async fetchJobsDirectory(){return structuredClone(data);},
      async manageJobsEntity(req){window.__calls.push(structuredClone(req)); return {ok:true,build:335,schema:223,record:{id:'ok-335'}};}
    };
  },payload());
  await page.addScriptTag({content:materialsSource});
  await page.addScriptTag({content:jobsSource});
  await page.evaluate(async()=>{
    const ui=window.YWIJobsUI.create({api:window.__api,getAccessProfile:()=>({canManageJobs:true,canManageAdminDirectory:true}),getCurrentRole:()=> 'admin'});
    await ui.init();
  });
}

test('Build 335 renders stock and reorder control',async({page})=>{
  await mount(page);
  const panel=page.locator('#fuel_consumables_materials_control_v1');
  await expect(panel).toHaveAttribute('data-build','335');
  await expect(panel).toContainText('Fuel, Consumables & Materials Control');
  await expect(page.locator('#material_control_table')).toContainText('MULCH-BLK');
  await expect(page.locator('#material_control_table')).toContainText('reorder');
  await expect(page.locator('#material_control_summary')).toContainText('1 reorder');
});

test('Build 335 records canonical material receipt and issue',async({page})=>{
  await mount(page);
  await page.locator('[data-material-load="mat-335"]').click();
  await page.getByRole('button',{name:'Record Receipt'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some(r=>r.action==='material_stock_receipt'))).toBe(true);
  await page.getByRole('button',{name:'Record Issue'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some(r=>r.action==='material_stock_issue'))).toBe(true);
  const issue=await page.evaluate(()=>window.__calls.find(r=>r.action==='material_stock_issue'));
  expect(issue.material_id).toBe('mat-335');
  expect(issue.quantity).toBe(10);
  expect(issue.planned_quantity).toBe(8);
});

test('Build 335 records adjustment and cycle count',async({page})=>{
  await mount(page);
  await page.locator('[data-material-load="mat-335"]').click();
  await page.getByRole('button',{name:'Record Adjustment'}).click();
  await page.getByRole('button',{name:'Record Cycle Count'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__calls.some(r=>r.action==='material_stock_adjust'))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__calls.some(r=>r.action==='material_cycle_count'))).toBe(true);
});
