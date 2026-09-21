import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const source=fs.readFileSync('js/hse-ops-ui.js','utf8');

function payload(){
  return {
    ok:true,
    linked_hse_packets:[],hse_packet_action_items:[],hse_dashboard_summary:[{total_packets:0,action_needed_packets:0}],
    accounting_review_summary:[],incident_near_miss_history:[],incident_investigations:[],corrective_action_tasks:[],
    training_records:[{
      id:'tr-1',profile_id:'11111111-1111-4111-8111-111111111111',profile_name:'Alex Crew',
      course_code:'MOWER_TRACTOR',course_name:'Mower / Tractor Authorization Training',
      completion_status:'completed',completed_at:'2026-09-01',expires_at:'2027-09-01',
      is_expired:false,expires_within_30_days:false,updated_at:'2026-09-21T13:00:00Z'
    }],
    training_expiry_summary:[{record_count:1,expired_count:0,expiring_30_days_count:0,scheduled_count:0}],
    training_courses:[
      {id:'21111111-1111-4111-8111-111111111111',course_code:'MOWER_TRACTOR',course_name:'Mower / Tractor Authorization Training',category:'equipment',validity_months:12,reminder_days_before:30,require_supervisor_verification:true,is_active:true},
      {id:'22222222-2222-4222-8222-222222222222',course_code:'PESTICIDE_APPLICATION',course_name:'Pesticide / Application Credential Evidence',category:'application',validity_months:12,reminder_days_before:60,require_supervisor_verification:true,is_active:true}
    ],
    training_requirements:[
      {id:'31111111-1111-4111-8111-111111111111',requirement_code:'MOWER_TRACTOR_AUTH',requirement_name:'Mower / Tractor Authorization',course_id:'21111111-1111-4111-8111-111111111111',course_name:'Mower / Tractor Authorization Training',requirement_mode:'explicit',internal_authorization_required:true,external_credential_expected:false,equipment_context_required:true,applicability_note:'Assign to mower operators.'},
      {id:'32222222-2222-4222-8222-222222222222',requirement_code:'PESTICIDE_APPLICATION_CREDENTIAL',requirement_name:'Pesticide / Application Credential — where required',course_id:'22222222-2222-4222-8222-222222222222',course_name:'Pesticide / Application Credential Evidence',requirement_mode:'explicit',internal_authorization_required:true,external_credential_expected:true,equipment_context_required:false,applicability_note:'External credential evidence required where applicable.'}
    ],
    training_matrix:[
      {
        profile_id:'11111111-1111-4111-8111-111111111111',profile_name:'Alex Crew',employee_number:'E-101',profile_role:'employee',current_position:'Crew Member',
        requirement_id:'31111111-1111-4111-8111-111111111111',requirement_code:'MOWER_TRACTOR_AUTH',requirement_name:'Mower / Tractor Authorization',
        course_id:'21111111-1111-4111-8111-111111111111',course_code:'MOWER_TRACTOR',course_name:'Mower / Tractor Authorization Training',
        applicability_source:'explicit_assignment',equipment_category:'mower',equipment_item_id:10,equipment_code:'MOW-10',equipment_name:'Zero Turn Mower',
        internal_authorization_required:true,external_credential_expected:false,equipment_context_required:true,
        legal_authorization_inferred:false,training_record_id:'tr-1',completion_status:'completed',completed_at:'2026-09-01',expires_at:'2027-09-01',
        verified_at:'2026-09-02',internal_authorization_status:'pending',authorization_scope:null,
        readiness_status:'internal_authorization_pending',days_until_training_expiry:345,updated_at:'2026-09-21T13:10:00Z'
      },
      {
        profile_id:'13333333-3333-4333-8333-333333333333',profile_name:'Sam Field',employee_number:'E-102',profile_role:'employee',current_position:'Crew Member',
        requirement_id:'32222222-2222-4222-8222-222222222222',requirement_code:'PESTICIDE_APPLICATION_CREDENTIAL',requirement_name:'Pesticide / Application Credential — where required',
        course_id:'22222222-2222-4222-8222-222222222222',course_code:'PESTICIDE_APPLICATION',course_name:'Pesticide / Application Credential Evidence',
        applicability_source:'explicit_assignment',equipment_category:'application',equipment_item_id:null,
        internal_authorization_required:true,external_credential_expected:true,equipment_context_required:false,
        legal_authorization_inferred:false,training_record_id:'tr-2',completion_status:'completed',completed_at:'2026-08-01',expires_at:'2027-08-01',
        verified_at:'2026-08-02',certificate_number:null,license_number:null,internal_authorization_status:'pending',
        readiness_status:'external_credential_evidence_missing',days_until_training_expiry:314,updated_at:'2026-09-21T13:05:00Z'
      }
    ],
    training_matrix_summary:[{
      requirement_row_count:2,current_count:0,missing_count:0,scheduled_count:0,in_progress_count:0,
      expired_count:0,expiring_count:0,verification_pending_count:0,external_credential_evidence_missing_count:1,
      internal_authorization_pending_count:1,attention_count:2,last_updated_at:'2026-09-21T13:10:00Z'
    }],
    training_people:[
      {id:'11111111-1111-4111-8111-111111111111',full_name:'Alex Crew',employee_number:'E-101',role:'employee',current_position:'Crew Member',is_active:true},
      {id:'13333333-3333-4333-8333-333333333333',full_name:'Sam Field',employee_number:'E-102',role:'employee',current_position:'Crew Member',is_active:true}
    ],
    training_equipment:[
      {id:10,equipment_code:'MOW-10',equipment_name:'Zero Turn Mower',category:'mower',status:'active',is_locked_out:false}
    ],
    supervisor_safety_queue:[],site_safety_scorecards:[],equipment_jsa_hazards:[],equipment_lockouts:[],
    safety_submissions:[],client_site_hazards:[],job_hazard_plan_templates:[],job_hazard_site_safety_plans:[],
    field_upload_failures:[],backend_monitor_events:[],app_traffic_daily_summary:[],monitor_threshold_alerts:[],
    hse_link_context_summary:[],monitor_review_summary:[],operations_dashboard_summary:[],site_activity_summary:[]
  };
}

async function boot(page){
  await page.setContent('<main><section id="hseops"></section></main>');
  await page.evaluate((data)=>{
    window.__loads=0;
    window.__opsCalls=[];
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'supervisor'})};
    window.YWISecurity={hasMinRole:()=>true,getRoleLabel:()=> 'Supervisor'};
    window.YWIRouter={showSection:()=>{}};
    window.YWIAPI={
      escHtml:(value)=>String(value ?? ''),
      loadAdminSelectors:async()=>{window.__loads+=1;return structuredClone(data);},
      manageOperations:async(payload)=>{
        window.__opsCalls.push(structuredClone(payload));
        if(payload.action==='training_assignment_save') return {ok:true,record:{id:'41111111-1111-4111-8111-111111111111',assignment_status:payload.assignment_status}};
        if(payload.action==='training_record_save') return {ok:true,record:{id:'42222222-2222-4222-8222-222222222222',completion_status:payload.completion_status,expires_at:payload.expires_at}};
        if(payload.action==='training_internal_authorization_decision') return {ok:true,record:{id:'43333333-3333-4333-8333-333333333333',authorization_status:payload.authorization_status,authorization_scope:'internal_company_only'}};
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
  await expect(page.locator('#trainingCertificationMatrix')).toBeVisible();
}

test('Build 330 renders attention-first matrix with explicit legal boundary', async ({page})=>{
  await boot(page);
  const panel=page.locator('#trainingCertificationMatrix');
  await expect(panel).toHaveAttribute('data-build','330');
  await expect(panel).toContainText('Training & Certification Matrix');
  await expect(panel).toContainText('Internal readiness is not legal authorization');
  await expect(panel).toContainText('External credential evidence missing');
  await expect(panel).toContainText('Internal authorization pending');
  await expect(panel.locator('[data-training-matrix-row]')).toHaveCount(2);
  await expect(panel).toContainText('Needs attention');
  await expect(panel).toContainText('2');
});

test('Build 330 loads matrix context and saves an explicit equipment requirement assignment', async ({page})=>{
  await boot(page);
  await page.locator('[data-training-load-profile="11111111-1111-4111-8111-111111111111"]').first().click();
  await expect(page.locator('#tm_assign_profile')).toHaveValue('11111111-1111-4111-8111-111111111111');
  await expect(page.locator('#tm_assign_requirement')).toHaveValue('31111111-1111-4111-8111-111111111111');
  await expect(page.locator('#tm_assign_equipment')).toHaveValue('10');
  await expect(page.locator('#tm_assign_category')).toHaveValue('mower');
  await page.locator('#tm_assign_due').fill('2026-10-01');
  await page.locator('#tm_assign_note').fill('Assigned for fall mowing rotation.');
  await page.locator('[data-training-assignment-save]').click();

  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.some((row)=>row.action==='training_assignment_save'))).toBeTruthy();
  const call=await page.evaluate(()=>window.__opsCalls.find((row)=>row.action==='training_assignment_save'));
  expect(call.profile_id).toBe('11111111-1111-4111-8111-111111111111');
  expect(call.requirement_id).toBe('31111111-1111-4111-8111-111111111111');
  expect(call.equipment_item_id).toBe('10');
  expect(call.equipment_category).toBe('mower');
});

test('Build 330 records training evidence in the existing record authority', async ({page})=>{
  await boot(page);
  await page.locator('[data-training-load-profile="11111111-1111-4111-8111-111111111111"]').first().click();
  await page.locator('#tm_record_completed').fill('2026-09-15');
  await page.locator('#tm_record_expires').fill('2027-09-15');
  await page.locator('#tm_record_trainer').fill('Supervisor A');
  await page.locator('#tm_record_provider').fill('Internal practical training');
  await page.locator('#tm_record_verified').check();
  await page.locator('[data-training-record-save]').click();

  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.some((row)=>row.action==='training_record_save'))).toBeTruthy();
  const call=await page.evaluate(()=>window.__opsCalls.find((row)=>row.action==='training_record_save'));
  expect(call.profile_id).toBe('11111111-1111-4111-8111-111111111111');
  expect(call.course_id).toBe('21111111-1111-4111-8111-111111111111');
  expect(call.completion_status).toBe('completed');
  expect(call.supervisor_verified).toBe(true);
});

test('Build 330 internal authorization decision is explicit and company-only', async ({page})=>{
  await boot(page);
  await page.locator('[data-training-load-profile="11111111-1111-4111-8111-111111111111"]').first().click();
  await page.locator('#tm_auth_status').selectOption('authorized');
  await page.locator('#tm_auth_evidence').fill('practical-check:2026-09-21');
  await page.locator('#tm_auth_note').fill('Supervisor practical check complete for MOW-10.');
  await page.locator('[data-training-authorization-save]').click();

  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.some((row)=>row.action==='training_internal_authorization_decision'))).toBeTruthy();
  const call=await page.evaluate(()=>window.__opsCalls.find((row)=>row.action==='training_internal_authorization_decision'));
  expect(call.profile_id).toBe('11111111-1111-4111-8111-111111111111');
  expect(call.requirement_id).toBe('31111111-1111-4111-8111-111111111111');
  expect(call.authorization_status).toBe('authorized');
  expect(call.equipment_item_id).toBe('10');
});

test('Build 330 derivation keeps readiness states distinct', async ({page})=>{
  await boot(page);
  const counts=await page.evaluate((data)=>{
    const result=window.YWIHSEOpsUI.deriveTrainingMatrix(data);
    return result.counts;
  },payload());
  expect(counts.total).toBe(2);
  expect(counts.attention).toBe(2);
  expect(counts.externalEvidenceMissing).toBe(1);
  expect(counts.internalAuthorizationPending).toBe(1);
});
