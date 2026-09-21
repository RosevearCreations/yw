import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const source=fs.readFileSync('js/hse-ops-ui.js','utf8');

function payload(){
  return {
    ok:true,
    linked_hse_packets:[{
      id:'11111111-1111-4111-8111-111111111111',
      packet_number:'HSE-328-01',packet_status:'open',
      field_signoff_required:true,field_signoff_completed:false,
      inspection_required:true,inspection_completed:false
    }],
    job_hazard_plan_templates:[
      {
        id:'22222222-2222-4222-8222-222222222222',
        template_code:'mowing',template_name:'Mowing',work_type:'mowing',revision:1,is_active:true,
        hazard_prompts:['moving blades','thrown objects','public exposure'],
        default_controls:['inspect work area before start','verify guards','keep public clear'],
        required_ppe:['eye protection','hearing protection'],
        requires_toolbox_talk:true,requires_site_inspection:true,requires_weather_review:true,
        requires_heat_review:true,requires_chemical_review:false,requires_traffic_control:false,
        requires_machinery_review:true,requires_lifting_review:false,requires_utility_locate_review:false,
        requires_public_control:true
      },
      {
        id:'33333333-3333-4333-8333-333333333333',
        template_code:'underground_utility',template_name:'Underground Utility Concern',work_type:'underground_utility',
        revision:1,is_active:true,hazard_prompts:['unverified locate'],default_controls:['confirm locate before disturbing ground'],
        required_ppe:['task-specific PPE'],requires_site_inspection:true,requires_utility_locate_review:true
      }
    ],
    job_hazard_site_safety_plans:[{
      id:'44444444-4444-4444-8444-444444444444',
      plan_number:'JHSP-20260921-DEMO0001',
      hse_packet_id:'11111111-1111-4111-8111-111111111111',
      template_id:'22222222-2222-4222-8222-222222222222',
      template_name:'Mowing',work_type:'mowing',plan_status:'ready_for_signoff',
      supervisor_review_status:'pending',active_controls:['verify guards'],
      packet_number:'HSE-328-01',site_name:'Maple Site',field_signoff_completed:false,
      updated_at:'2026-09-21T12:00:00Z'
    }],
    hse_packet_action_items:[],hse_dashboard_summary:[{total_packets:1,action_needed_packets:1}],
    accounting_review_summary:[],incident_near_miss_history:[],corrective_action_tasks:[],
    training_records:[],supervisor_safety_queue:[],site_safety_scorecards:[],equipment_jsa_hazards:[],
    equipment_lockouts:[],safety_submissions:[],client_site_hazards:[],
    field_upload_failures:[],backend_monitor_events:[],app_traffic_daily_summary:[],
    monitor_threshold_alerts:[],hse_link_context_summary:[],monitor_review_summary:[],
    operations_dashboard_summary:[],site_activity_summary:[]
  };
}

async function boot(page){
  await page.setContent('<main><section id="hseops"></section></main>');
  await page.evaluate((data)=>{
    window.__loads=0;
    window.__opsCalls=[];
    window.prompt=()=> 'Reviewed for field conditions';
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'supervisor'})};
    window.YWISecurity={hasMinRole:()=>true,getRoleLabel:()=> 'Supervisor'};
    window.YWIRouter={showSection:()=>{}};
    window.YWIAPI={
      escHtml:(value)=>String(value ?? ''),
      loadAdminSelectors:async()=>{window.__loads+=1;return structuredClone(data);},
      manageOperations:async(payload)=>{
        window.__opsCalls.push(structuredClone(payload));
        if(payload.action==='job_hazard_plan_save') return {ok:true,record:{id:'55555555-5555-4555-8555-555555555555',plan_number:'JHSP-20260921-NEW00001'}};
        if(payload.action==='job_hazard_plan_review') return {ok:true,record:{id:payload.plan_id,supervisor_review_status:payload.decision==='approve'?'approved':'changes_required'}};
        return {ok:false,error:'unexpected action'};
      }
    };
  },payload());
  await page.addScriptTag({content:source});
  await page.evaluate(()=>{
    window.YWIHSEOpsUI.init();
    document.dispatchEvent(new CustomEvent('ywi:route-shown',{detail:{allowed:'hseops'}}));
  });
  await expect.poll(()=>page.evaluate(()=>window.__loads)).toBeGreaterThan(0);
}

test('Build 328 renders reusable templates and field-plan evidence controls', async ({page})=>{
  await boot(page);
  const panel=page.locator('#jobHazardSiteSafetyPlans');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-build','328');
  await expect(panel).toContainText('Job Hazard & Site Safety Plans');
  await expect(panel).toContainText('Templates are prompts, not proof that a site is safe');
  await expect(panel.locator('[data-hazard-template]')).toHaveCount(2);
  await expect(panel).toContainText('Supervisor review is explicit and separate from HSE field signoff/closeout');
  await expect(panel.locator('[data-hazard-plan-row]')).toHaveCount(1);
});

test('Build 328 template selection seeds prompts but plan captures actual edited field values', async ({page})=>{
  await boot(page);
  await page.locator('[data-hazard-template="22222222-2222-4222-8222-222222222222"]').click();
  await expect(page.locator('#jh_plan_hazards')).toHaveValue(/moving blades/);
  await expect(page.locator('#jh_plan_controls')).toHaveValue(/verify guards/);

  await page.locator('#jh_plan_packet').selectOption('11111111-1111-4111-8111-111111111111');
  await page.locator('#jh_plan_conditions').fill('Wet south slope; two pedestrians using front walkway.');
  await page.locator('#jh_plan_hazards').fill('moving blades\nwet slope\npedestrian entry');
  await page.locator('#jh_plan_controls').fill('verify guards\nwork across safe grade only\nspotter at walkway');
  await page.locator('#jh_plan_status').selectOption('in_progress');
  await page.locator('[data-hazard-plan-save]').click();

  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.length)).toBeGreaterThan(0);
  const call=await page.evaluate(()=>window.__opsCalls.find((row)=>row.action==='job_hazard_plan_save'));
  expect(call.hse_packet_id).toBe('11111111-1111-4111-8111-111111111111');
  expect(call.template_id).toBe('22222222-2222-4222-8222-222222222222');
  expect(call.actual_conditions.field_notes).toContain('Wet south slope');
  expect(call.identified_hazards).toEqual(['moving blades','wet slope','pedestrian entry']);
  expect(call.active_controls).toContain('spotter at walkway');
});

test('Build 328 supervisor review is a separate explicit operation', async ({page})=>{
  await boot(page);
  await page.locator('[data-hazard-review="approve"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.some((row)=>row.action==='job_hazard_plan_review'))).toBeTruthy();
  const call=await page.evaluate(()=>window.__opsCalls.find((row)=>row.action==='job_hazard_plan_review'));
  expect(call.plan_id).toBe('44444444-4444-4444-8444-444444444444');
  expect(call.decision).toBe('approve');
  expect(call.note).toContain('Reviewed');
});

test('Build 328 derivation keeps stop-work and utility-locate attention visible', async ({page})=>{
  await boot(page);
  const counts=await page.evaluate((base)=>{
    base.job_hazard_site_safety_plans.push({
      id:'66666666-6666-4666-8666-666666666666',plan_status:'in_progress',supervisor_review_status:'pending',
      stop_work_required:true,requires_utility_locate_review:true,utility_locate_confirmed:false
    });
    const derived=window.YWIHSEOpsUI.deriveJobHazardPlanning(base);
    return {stopWork:derived.stopWork.length,utilityOpen:derived.utilityOpen.length,templates:derived.templates.length};
  },payload());
  expect(counts.stopWork).toBe(1);
  expect(counts.utilityOpen).toBe(1);
  expect(counts.templates).toBe(2);
});
