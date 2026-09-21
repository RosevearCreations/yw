import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const jobsSource=fs.readFileSync(path.join(process.cwd(),'js/jobs-ui.js'),'utf8');

function directoryPayload(){
  return {
    jobs:[{id:3310,job_code:'JOB-331',job_name:'Registry test',site_id:'site-331',site_code:'YARD',site_name:'Main Yard'}],
    crews:[{id:'33111111-1111-4111-8111-111111111111',crew_code:'CREW-A',crew_name:'Crew A'}],
    crew_members:[],profiles:[],requirements:[],pools:[],signouts:[],notifications:[],inspections:[],maintenance:[],
    equipment:[{
      id:331,equipment_code:'MOW-331',equipment_name:'Zero Turn Mower',category:'mower',status:'available',
      serial_number:'SER-331',asset_tag:'ASSET-331',manufacturer:'ExampleCo',model_number:'ZT-331',
      purchase_year:2025,purchase_date:'2025-04-01',purchase_price:9000,purchase_vendor:'Dealer A',purchase_cost:9000,
      warranty_expiry_date:'2028-04-01',year_of_manufacture:2025,condition_status:'ready',
      home_site_code:'YARD',home_site_name:'Main Yard',current_site_code:'YARD',current_site_name:'Main Yard',
      assigned_crew_id:'33111111-1111-4111-8111-111111111111',assigned_crew_code:'CREW-A',assigned_crew_name:'Crew A',
      qr_code_value:'YWI-EQ-331-OPAQUE',qr_identity_status:'ready',barcode_value:'BAR-331',exact_identifier_count:5,
      verifier_role_required:'supervisor',accessory_checklist_required:true,
      meter_type:'hours',meter_unit:'hours',current_meter_value:412.5,current_meter_at:'2026-09-21T14:00:00Z',
      replacement_state:'monitor',replacement_target_date:'2028-10-01',replacement_estimated_cost:12000,
      replacement_reason:'Monitor hydrostatic drive and lifecycle economics.',
      registry_documents:[
        {document_type:'manual',title:'Owner Manual',document_url:'https://docs.example.invalid/mow331.pdf',version_label:'2025',notes:'OEM manual'}
      ],
      registry_photos:[
        {photo_kind:'profile',photo_url:'https://images.example.invalid/mow331.jpg',caption:'Front profile',is_primary:true}
      ],
      registry_accessories:[
        {accessory_name:'Battery',expected_quantity:1,accessory_status:'active',serial_number:'BAT-331',replacement_cost:180,notes:'Installed'}
      ],
      document_count:1,registry_photo_count:1,expected_accessory_quantity:1,accessory_attention_count:0,
      recorded_service_event_count:3,recorded_service_cost_total:725,recorded_lifecycle_cost_total:9725,
      open_service_task_count:1,open_service_estimated_cost:350,registry_readiness_status:'service_attention',
      next_service_due_date:'2026-10-15',next_inspection_due_date:'2026-09-30',is_locked_out:false,
      registry_v2_updated_at:'2026-09-21T14:00:00Z'
    }],
    equipment_registry_v2:[],
    equipment_registry_v2_summary:[{
      asset_count:1,qr_ready_count:1,qr_attention_count:0,locked_out_count:0,
      open_service_asset_count:1,replacement_attention_count:1,
      recorded_lifecycle_cost_total:9725,open_service_estimated_cost:350
    }],
    equipment_transfer_verifications:[],equipment_return_exceptions:[],operational_depth_gates:[],
    equipment_accountability:[],equipment_service_tasks:[]
  };
}

async function mount(page){
  await page.route('https://registry331.test/**',async(route)=>{
    await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><section id="jobs"></section><section id="equipment"></section></body></html>'});
  });
  await page.goto('https://registry331.test/');
  await page.evaluate((payload)=>{
    window.__registry331Calls=[];
    window.__clipboard=[];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value)=>{window.__clipboard.push(value);}}});
    window.__registry331Api={
      async fetchJobsDirectory(){ return structuredClone(payload); },
      async manageJobsEntity(request){
        window.__registry331Calls.push(structuredClone(request));
        if(request.entity==='equipment' && request.action==='upsert'){
          return {ok:true,build:331,schema:219,record:{
            ...payload.equipment[0],
            ...request,
            qr_code_value:request.qr_code_value || 'YWI-EQ-331-OPAQUE',
            qr_identity_status:'ready',
            registry_readiness_status:'service_attention'
          }};
        }
        return {ok:true,record:{}};
      }
    };
  },directoryPayload());
  await page.addScriptTag({content:jobsSource});
  await page.evaluate(async()=>{
    const ui=window.YWIJobsUI.create({
      api:window.__registry331Api,
      getAccessProfile:()=>({canManageJobs:true,canManageAdminDirectory:true}),
      getCurrentRole:()=> 'admin'
    });
    await ui.init();
  });
  await expect(page.locator('#equipment_registry_v2')).toBeVisible();
}

test('Build 331 renders existing equipment authority as Registry & QR v2',async({page})=>{
  await mount(page);
  const panel=page.locator('#equipment_registry_v2');
  await expect(panel).toHaveAttribute('data-build','331');
  await expect(panel).toContainText('Equipment Registry & QR System v2');
  await expect(panel).toContainText('existing exact server-side identifier registry');

  await page.locator('[data-equipment-load="MOW-331"]').click();
  await expect(page.locator('#eq_qr_code_value')).toHaveValue('YWI-EQ-331-OPAQUE');
  await expect(page.locator('#eq_qr_label_preview')).toHaveValue('YWI-EQ-331-OPAQUE');
  await expect(page.locator('#eq_assigned_crew')).toHaveValue('33111111-1111-4111-8111-111111111111');
  await expect(page.locator('#eq_meter_type')).toHaveValue('hours');
  await expect(page.locator('#eq_meter_value')).toHaveValue('412.5');
  await expect(page.locator('#eq_replacement_state')).toHaveValue('monitor');
  await expect(page.locator('#eq_registry_documents')).toHaveValue(/Owner Manual/);
  await expect(page.locator('#eq_registry_photos')).toHaveValue(/mow331\.jpg/);
  await expect(page.locator('#eq_registry_accessories')).toHaveValue(/Battery/);
  await expect(page.locator('#eq_registry_summary')).toContainText('Recorded lifecycle $9725.00');
  await expect(page.locator('#eq_registry_summary')).toContainText('Open service estimate $350.00');
  await expect(page.locator('#eq_scan_code')).toBeAttached();
});

test('Build 331 saves structured registry evidence through the existing equipment upsert',async({page})=>{
  await mount(page);
  await page.locator('[data-equipment-load="MOW-331"]').click();

  await page.locator('#eq_meter_value').fill('420.75');
  await page.locator('#eq_replacement_state').selectOption('plan_replacement');
  await page.locator('#eq_replacement_target_date').fill('2028-06-01');
  await page.locator('#eq_replacement_estimated_cost').fill('12500');
  await page.locator('#eq_registry_documents').fill('manual | Owner Manual | https://docs.example.invalid/mow331-v2.pdf | 2026 | revised\nwarranty | Warranty | https://docs.example.invalid/warranty331.pdf |  | coverage');
  await page.locator('#eq_registry_photos').fill('profile | https://images.example.invalid/front331.jpg | Front\nserial | https://images.example.invalid/serial331.jpg | Serial plate');
  await page.locator('#eq_registry_accessories').fill('Battery | 1 | active | BAT-331 | 180 | installed\nBlade set | 2 | damaged |  | 95 | replace next service');
  await page.getByRole('button',{name:'Save Equipment'}).click();

  await expect.poll(()=>page.evaluate(()=>window.__registry331Calls.filter((row)=>row.entity==='equipment'&&row.action==='upsert').length)).toBe(1);
  const call=await page.evaluate(()=>window.__registry331Calls.find((row)=>row.entity==='equipment'&&row.action==='upsert'));
  expect(call.equipment_code).toBe('MOW-331');
  expect(call.assigned_crew_id).toBe('33111111-1111-4111-8111-111111111111');
  expect(call.current_meter_value).toBe(420.75);
  expect(call.replacement_state).toBe('plan_replacement');
  expect(call.replacement_estimated_cost).toBe(12500);
  expect(call.registry_documents).toHaveLength(2);
  expect(call.registry_documents[1].document_type).toBe('warranty');
  expect(call.registry_photos).toHaveLength(2);
  expect(call.registry_photos[1].photo_kind).toBe('serial');
  expect(call.registry_accessories).toHaveLength(2);
  expect(call.registry_accessories[1]).toMatchObject({accessory_name:'Blade set',expected_quantity:2,accessory_status:'damaged',replacement_cost:95});
});

test('Build 331 exposes the exact QR label token without replacing the scanner',async({page})=>{
  await mount(page);
  await page.locator('[data-equipment-load="MOW-331"]').click();
  await page.getByRole('button',{name:'Copy QR Label Value'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__clipboard[0] || '')).toBe('YWI-EQ-331-OPAQUE');
  await expect(page.locator('#eq_registry_summary')).toContainText('Physical QR/barcode labels must encode this exact value');
  await expect(page.locator('#eq_scan_code')).toBeAttached();
});
