import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const source=fs.readFileSync('js/hse-ops-ui.js','utf8');

function payload(){
  return {
    ok:true,
    linked_hse_packets:[],
    hse_packet_action_items:[],
    hse_dashboard_summary:[{total_packets:0,action_needed_packets:0}],
    accounting_review_summary:[],
    incident_near_miss_history:[
      {
        submission_id:32901,submission_date:'2026-09-21',status:'follow_up_required',
        site_label:'Maple Site',job_code:'JOB-329',work_order_number:'WO-329',
        route_code:'R-1',equipment_code:'MOWER-7',incident_kind:'near_miss',severity:'high',
        medical_treatment_required:false,lost_time:false,property_damage:false,vehicle_involved:false,
        event_time:'09:15',event_summary:'Thrown object passed near pedestrian',
        immediate_actions_taken:'Stopped mower and isolated walkway',
        root_cause_summary:'',corrective_action_required:'Inspect deflector and public separation controls',
        corrective_action_owner:'Crew Lead',corrective_action_status:'open',
        corrective_action_due_date:'2026-09-22',witness_names:'Pat Example',image_count:2,
        updated_at:'2026-09-21T13:20:00Z'
      },
      {
        submission_id:32902,submission_date:'2026-09-20',status:'under_review',
        site_label:'Oak Site',incident_kind:'equipment_damage',severity:'medium',
        equipment_code:'TRIM-3',event_summary:'Guard damaged during transport',
        immediate_actions_taken:'Equipment removed from service',image_count:1,
        updated_at:'2026-09-20T18:00:00Z'
      }
    ],
    incident_investigations:[
      {
        id:'32900000-0000-4000-8000-000000000001',
        investigation_number:'INV-20260921-DEMO3291',source_submission_id:32902,
        investigation_status:'ready_for_review',event_classification:'equipment_damage',severity:'medium',
        submission_date:'2026-09-20',site_label:'Oak Site',incident_kind:'equipment_damage',
        reported_equipment_code:'TRIM-3',event_summary:'Guard damaged during transport',
        photo_count:1,people_involved:['Crew A'],witness_accounts:['Supervisor statement'],
        equipment_involved:['TRIM-3'],initial_response_summary:'Removed from service',
        scene_secured:true,immediate_hazard_controlled:true,
        contributing_factors:['Loose transport placement'],root_factors:['Load securement gap'],
        root_cause_summary:'Equipment was not secured in the designated rack.',
        investigation_summary:'Reviewed transport sequence and equipment condition.',
        corrective_action_required:true,corrective_action_rationale:'Update securement control and verify repair.',
        external_reporting_assessment_note:'Supervisor assessed internal-only event; re-evaluate if new facts emerge.',
        corrective_action_count:1,open_corrective_action_count:1,overdue_corrective_action_count:0,
        supervisor_review_status:'pending',closure_summary:'',closure_evidence:[],
        review_ready:true,closure_ready:false,updated_at:'2026-09-21T13:30:00Z'
      }
    ],
    corrective_action_tasks:[{
      id:'ca-329',source_submission_id:32902,task_scope:'incident_corrective_action',
      task_title:'Repair guard and verify transport rack',status:'in_progress',priority:'high',
      due_date:'2026-09-23',updated_at:'2026-09-21T13:31:00Z'
    }],
    training_records:[],training_expiry_summary:[],supervisor_safety_queue:[],site_safety_scorecards:[],
    equipment_jsa_hazards:[],equipment_lockouts:[],safety_submissions:[],client_site_hazards:[],
    job_hazard_plan_templates:[],job_hazard_site_safety_plans:[],
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
    window.prompt=()=> 'Supervisor review note';
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'supervisor'})};
    window.YWISecurity={hasMinRole:()=>true,getRoleLabel:()=> 'Supervisor'};
    window.YWIRouter={showSection:()=>{}};
    window.YWIAPI={
      escHtml:(value)=>String(value ?? ''),
      loadAdminSelectors:async()=>{window.__loads+=1;return structuredClone(data);},
      manageOperations:async(payload)=>{
        window.__opsCalls.push(structuredClone(payload));
        if(payload.action==='incident_investigation_save') return {ok:true,record:{id:'32900000-0000-4000-8000-000000000002',investigation_number:'INV-20260921-NEW3292',supervisor_review_status:'pending'}};
        if(payload.action==='incident_investigation_review') return {ok:true,record:{id:payload.investigation_id,investigation_status:'ready_for_review',supervisor_review_status:payload.decision==='approve'?'approved':'changes_required'}};
        if(payload.action==='incident_investigation_close') return {ok:true,record:{id:payload.investigation_id,investigation_number:'INV-20260921-DEMO3291',closed_at:'2026-09-21T14:00:00Z'}};
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
  await expect(page.locator('#incidentNearMissInvestigation')).toBeVisible();
}

test('Build 329 renders investigation metrics without replacing immediate incident capture', async ({page})=>{
  await boot(page);
  const panel=page.locator('#incidentNearMissInvestigation');
  await expect(panel).toHaveAttribute('data-build','329');
  await expect(panel).toContainText('Incident & Near-Miss Investigation');
  await expect(panel).toContainText('Immediate safety response comes first');
  await expect(panel).toContainText('Awaiting investigation');
  await expect(panel).toContainText('1');
  await expect(panel.locator('[data-route="incident"]')).toHaveCount(1);
  await expect(panel.locator('[data-investigation-row]')).toHaveCount(1);
  await expect(panel).toContainText('Open actions: 1');
});

test('Build 329 seeds a new investigation from the existing incident report and saves structured facts', async ({page})=>{
  await boot(page);
  await page.locator('#inc_inv_submission').selectOption('32901');
  await expect(page.locator('#inc_inv_classification')).toHaveValue('near_miss');
  await expect(page.locator('#inc_inv_severity')).toHaveValue('high');
  await expect(page.locator('#inc_inv_response')).toHaveValue(/Stopped mower/);
  await expect(page.locator('#inc_inv_witnesses')).toHaveValue(/Pat Example/);
  await expect(page.locator('#inc_inv_equipment')).toHaveValue(/MOWER-7/);

  await page.locator('#inc_inv_people').fill('Crew Lead\nWorker B');
  await page.locator('#inc_inv_contributing').fill('Pedestrian entered work zone\nDeflector inspection gap');
  await page.locator('#inc_inv_root_factors').fill('Public separation control was incomplete');
  await page.locator('#inc_inv_root_summary').fill('Work-zone separation and pre-use inspection controls were incomplete.');
  await page.locator('#inc_inv_summary').fill('Interviewed crew and witness, reviewed photos and equipment condition.');
  await page.locator('#inc_inv_action_required').check();
  await page.locator('#inc_inv_action_rationale').fill('Correct equipment and public-separation controls.');
  await page.locator('#inc_inv_external_note').fill('Supervisor assessed notification duties and documented follow-up.');
  await page.locator('#inc_inv_status').selectOption('ready_for_review');
  await page.locator('[data-investigation-save]').click();

  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.some((row)=>row.action==='incident_investigation_save'))).toBeTruthy();
  const call=await page.evaluate(()=>window.__opsCalls.find((row)=>row.action==='incident_investigation_save'));
  expect(call.source_submission_id).toBe(32901);
  expect(call.investigation_status).toBe('ready_for_review');
  expect(call.people_involved).toEqual(['Crew Lead','Worker B']);
  expect(call.contributing_factors).toContain('Deflector inspection gap');
  expect(call.root_factors).toEqual(['Public separation control was incomplete']);
  expect(call.corrective_action_required).toBe(true);
});

test('Build 329 supervisor review remains a separate explicit operation', async ({page})=>{
  await boot(page);
  await page.locator('[data-investigation-review="approve"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.some((row)=>row.action==='incident_investigation_review'))).toBeTruthy();
  const call=await page.evaluate(()=>window.__opsCalls.find((row)=>row.action==='incident_investigation_review'));
  expect(call.investigation_id).toBe('32900000-0000-4000-8000-000000000001');
  expect(call.decision).toBe('approve');
  expect(call.note).toContain('Supervisor review');
});

test('Build 329 closure sends explicit evidence and derivation keeps corrective-action blockers visible', async ({page})=>{
  await boot(page);
  await page.locator('[data-investigation-load="32900000-0000-4000-8000-000000000001"]').click();
  await page.locator('#inc_inv_closure_summary').fill('Repair verified, transport rack control updated, supervisor verified closeout.');
  await page.locator('#inc_inv_closure_evidence').fill('submission-photo:32902/1\ncorrective-action:ca-329/closed\nsupervisor-verification:2026-09-21');
  await page.locator('[data-investigation-close]').click();
  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.some((row)=>row.action==='incident_investigation_close'))).toBeTruthy();
  const call=await page.evaluate(()=>window.__opsCalls.find((row)=>row.action==='incident_investigation_close'));
  expect(call.investigation_id).toBe('32900000-0000-4000-8000-000000000001');
  expect(call.closure_evidence).toHaveLength(3);

  const counts=await page.evaluate((base)=>{
    const derived=window.YWIHSEOpsUI.deriveIncidentInvestigations(base);
    return {uninvestigated:derived.uninvestigated.length,active:derived.active.length,ready:derived.ready.length,blocked:derived.closureBlocked.length,high:derived.highSeverityOpen.length};
  },payload());
  expect(counts).toEqual({uninvestigated:1,active:1,ready:1,blocked:0,high:0});
});
