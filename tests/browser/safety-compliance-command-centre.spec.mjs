import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const source=fs.readFileSync('js/hse-ops-ui.js','utf8');

function payload(){
  return {
    ok:true,
    linked_hse_packets:[{
      id:'p1',packet_number:'HSE-327',packet_type:'field',
      packet_status:'open',inspection_required:true,inspection_completed:false,
      field_signoff_required:true,field_signoff_completed:false,updated_at:'2026-09-20T20:00:00Z'
    }],
    hse_packet_action_items:[{id:'a1',needs_attention:true,action_priority:1}],
    hse_dashboard_summary:[{total_packets:1,action_needed_packets:1,ready_for_closeout_packets:0}],
    accounting_review_summary:[],
    incident_near_miss_history:[{
      submission_id:327,submission_date:'2026-09-20',status:'submitted',site_label:'Maple Site',
      incident_kind:'near_miss',severity:'high',event_summary:'Blade guard close call',
      corrective_action_required:'Replace guard',corrective_action_owner:'Crew Lead',
      corrective_action_status:'open',corrective_action_due_date:'2026-09-19',
      last_reviewed_at:null,updated_at:'2026-09-20T20:10:00Z'
    }],
    corrective_action_tasks:[{
      id:'c1',task_title:'Replace guard',status:'open',priority:'high',is_overdue:true,
      due_date:'2026-09-19',site_label:'Maple Site',owner_name:'Crew Lead',updated_at:'2026-09-20T20:12:00Z'
    }],
    training_records:[{
      id:'t1',profile_name:'Crew Lead',course_name:'First Aid / CPR',
      completion_status:'completed',is_expired:false,expires_within_30_days:true,
      expires_at:'2026-10-01',updated_at:'2026-09-20T20:00:00Z'
    }],
    supervisor_safety_queue:[{
      queue_type:'corrective_action',queue_id:'c1',primary_context:'Maple Site',
      headline:'Replace guard',queue_status:'open',queue_priority:'high',
      owner_name:'Crew Lead',due_label:'2026-09-19',sort_at:'2026-09-20T20:12:00Z'
    }],
    site_safety_scorecards:[{
      site_id:'s1',site_label:'Maple Site',open_corrective_count:1,
      overdue_corrective_count:1,escalation_attention_count:0,scorecard_status:'attention'
    }],
    equipment_jsa_hazards:[{
      id:'h1',equipment_code:'MOW-4',hazard_title:'Guard damage',status:'open',
      is_overdue:true,updated_at:'2026-09-20T20:01:00Z'
    }],
    equipment_lockouts:[{
      id:4,equipment_code:'MOW-4',equipment_name:'Mower 4',is_locked_out:true,
      lockout_reason:'Guard damage',locked_out_at:'2026-09-20T20:02:00Z'
    }],
    safety_submissions:[
      {id:1,form_type:'C',date:'2026-09-20',status:'submitted',signed_off_at:null,requires_admin_review:false},
      {id:2,form_type:'D',date:'2026-09-20',status:'submitted',signed_off_at:null,requires_admin_review:false},
      {id:3,form_type:'E',date:'2026-09-20',status:'submitted',signed_off_at:null,requires_admin_review:false}
    ],
    client_site_hazards:[{
      id:'s1',site_name:'Maple Site',hazard_notes:'Wet slope',is_active:true,property_reviewed_at:null
    }],
    field_upload_failures:[],backend_monitor_events:[],app_traffic_daily_summary:[],
    monitor_threshold_alerts:[],hse_link_context_summary:[],monitor_review_summary:[],
    operations_dashboard_summary:[],site_activity_summary:[]
  };
}

async function boot(page){
  await page.setContent('<main><section id="hseops"></section></main>');
  await page.evaluate((data)=>{
    window.__routes=[];
    window.__loads=0;
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'supervisor'})};
    window.YWISecurity={
      hasMinRole:()=>true,
      getRoleLabel:()=> 'Supervisor'
    };
    window.YWIRouter={showSection:(value)=>window.__routes.push(value)};
    window.YWIAPI={
      escHtml:(value)=>String(value ?? ''),
      loadAdminSelectors:async()=>{window.__loads+=1; return data;}
    };
  },payload());
  await page.addScriptTag({content:source});
  await page.evaluate(()=>{
    window.YWIHSEOpsUI.init();
    document.dispatchEvent(new CustomEvent('ywi:route-shown',{detail:{allowed:'hseops'}}));
  });
  await expect.poll(()=>page.evaluate(()=>window.__loads)).toBeGreaterThan(0);
}

test('Build 327 renders the bounded Safety & Compliance command centre', async ({page})=>{
  await boot(page);
  const centre=page.locator('#safetyComplianceCommandCentre');
  await expect(centre).toBeVisible();
  await expect(centre).toHaveAttribute('data-build','327');
  await expect(centre).toContainText('Safety & Compliance Command Centre');
  await expect(centre).toContainText('not a legal-compliance certificate');
  await expect(centre.locator('[data-safety-metric]')).toHaveCount(11);
  await expect(centre.locator('[data-safety-metric="equipment_lockouts"] strong')).toHaveText('1');
  await expect(centre.locator('[data-safety-metric="training_expiries"] strong')).toHaveText('1');
  await expect(centre.locator('[data-safety-metric="ppe_issues"] strong')).toHaveText('1');
  await expect(centre.locator('[data-safety-metric="overdue_actions"] strong')).toHaveText('1');
  await expect(centre).toContainText('Replace guard');
  await expect(centre).toContainText('Equipment locked out: MOW-4');
});

test('Build 327 cards deep-link to existing source workflows', async ({page})=>{
  await boot(page);
  await page.locator('[data-safety-metric="incidents"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__routes.at(-1))).toBe('incident');
  await page.locator('[data-safety-metric="ppe_issues"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__routes.at(-1))).toBe('ppe');
  await page.locator('[data-safety-metric="equipment_lockouts"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__routes.at(-1))).toBe('equipment');
});

test('Build 327 derivation keeps safety signals separate and conservative', async ({page})=>{
  await boot(page);
  const counts=await page.evaluate((data)=>window.YWIHSEOpsUI.deriveSafetyCommandCentre(data).counts,payload());
  expect(counts.open_hazards).toBe(2);
  expect(counts.required_assessments).toBe(2);
  expect(counts.toolbox_talks).toBe(1);
  expect(counts.incidents).toBe(1);
  expect(counts.corrective_actions).toBe(1);
  expect(counts.training_expiries).toBe(1);
  expect(counts.equipment_lockouts).toBe(1);
  expect(counts.site_hazards).toBe(1);
  expect(counts.overdue_actions).toBe(1);
});
