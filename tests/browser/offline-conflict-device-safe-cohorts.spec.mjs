import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const mobileSource=fs.readFileSync('js/mobile-today.js','utf8');

function compactContext(overrides={}){
  const row={
    dispatch:{id:'d374',work_order_id:'w374',schedule_status:'scheduled',scheduled_start:'2026-10-08T14:00:00Z',route_order:1},
    work_order:{id:'w374',work_order_number:'WO-374',work_type:'Fall cleanup',status:'scheduled'},
    job:{id:374,job_code:'JOB-374',job_name:'Reliability guardrail route'},
    site:{id:'s374',site_name:'Guardrail Site',service_address:'1 Test Rd',city:'Tillsonburg'},
    route:{stop:{stop_order:1}},
    latest_session:null,
    production:{session_count:1,quantity_count:2,material_issue_count:1},
    evidence:{proof_count:1},
    closeout:{closeout_status:'draft'},
    equipment:[]
  };
  const readBudget={
    business_read_budget_max:13,
    permission_evaluation_budget_max:2,
    read_round_budget_max:4,
    payload_budget_bytes:180000,
    payload_bytes_estimate:42100,
    payload_budget_state:'within_budget',
    ...(overrides.read_budget||{})
  };
  return {
    ok:true,build:326,schema:215,
    profile:{id:'owner-374',full_name:'Field Lead',role:'site_leader'},
    capabilities:{jobs_view:true,time_clock:true,safety_create:true,equipment_scan:true,live_update:true,production_capture:true,execution_proof:true,deficiency_rework:true,closeout_request:false,customer_signoff_review:false},
    my_route:[row],my_jobs:[row],
    meta:{assignment_filtered:true,finance_exposed:false,optimization_build:361,payload_contract:'mobile_summary_v361',read_budget:readBudget}
  };
}

async function bootMobile(page,payload=compactContext(),summary={total:3,conflicts:1,pending:2}){
  await page.setViewportSize({width:390,height:900});
  await page.setContent('<main><section id="today"><div id="mobileTodayStatus"></div><div id="mobileInstallCard"></div><div id="mobileTodayGrid"></div></section><section id="jobs"><table id="job_list_table"><tbody></tbody></table></section></main>');
  await page.evaluate(({payload,summary})=>{
    window.__crewReads=0;
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'site_leader',profile:{id:'owner-374',role:'site_leader'}})};
    window.YWISecurity={normalizeRole:(r)=>r,getRoleLabel:()=> 'Site Leader',canViewSection:()=>true};
    window.YWIRouter={showSection:()=>{}};
    window.YWIOutbox={
      getItems:()=>[],
      getActionSummary:()=>({...summary,items:[]}),
      getActionItems:()=>[]
    };
    window.YWIMobileFormAssist={countDrafts:()=>0,draftSummaries:()=>[]};
    window.YWIAPI={
      fetchMobileCrewContext:async()=>{window.__crewReads+=1; return payload;},
      manageOperations:async()=>({ok:true})
    };
  },{payload,summary});
  await page.addScriptTag({content:mobileSource});
  await page.evaluate(()=>window.YWIMobileToday.bind());
  await expect.poll(()=>page.evaluate(()=>window.__crewReads)).toBe(1);
  await expect(page.locator('#mobileCrewAppV2')).toBeVisible();
}


test('Build 388 Mobile Crew card keeps local-owner closure and age evidence visible on phones',async({page})=>{
  await bootMobile(page);
  await page.evaluate(()=>{
    window.YWIOutbox.getDeviceSafeReliabilityCohorts=()=>({
      state:'current',reason:'Local choices only',summary:{local_recovery_decisions:12,active_conflicts:2,pending_actions:3},
      queue_age:{current_conflicts:2,within_day:1,days_1_to_7:0,over_7_days:1,unknown_age:0,pending_actions:3},
      cohorts:[{window_key:'last_7_days',label:'Last 7 days',decision_events:6,local_removal_choices:3,replay_preparation_choices:3,sufficient_sample:true,local_removal_share_percent:50,decision_events_per_7_days:6},
        {window_key:'preceding_23_days',label:'Preceding 23 days',decision_events:6,local_removal_choices:2,replay_preparation_choices:4,sufficient_sample:true,local_removal_share_percent:33.3,decision_events_per_7_days:1.8}],
      comparison_basis:'Current local browser only',closure_boundary:'Local removal is not server delivery',
      authority_boundary:'No automatic merge or replay'
    });
    window.YWIMobileToday.renderMobileCrewApp();
  });
  const panel=page.locator('.mobile-reliability-v388');
  await expect(panel).toContainText('Build 388 · Offline conflict closure');
  await expect(panel).toContainText('≤1 day 1 · 1–7 days 0 · >7 days 1');
  await expect(panel.locator('[data-offline388-cohort="last_7_days"]')).toContainText('50%');
  await expect(panel.locator('[data-offline388-cohort="preceding_23_days"]')).toContainText('33.3%');
  await expect(panel).not.toContainText('private note');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('Build 388 withholds sparse rate and owner-hidden data',async({page})=>{
  await bootMobile(page);
  await page.evaluate(()=>{
    window.YWIOutbox.getDeviceSafeReliabilityCohorts=()=>({state:'insufficient_sample',reason:'At least five decisions required',
      summary:{local_recovery_decisions:2},queue_age:{current_conflicts:0,within_day:0,days_1_to_7:0,over_7_days:0,unknown_age:0,pending_actions:0},
      cohorts:[{window_key:'last_7_days',label:'Last 7 days',decision_events:2,local_removal_choices:2,replay_preparation_choices:0,sufficient_sample:false,local_removal_share_percent:null}],
      comparison_basis:'Local only',closure_boundary:'Not synced',authority_boundary:'No automatic replay'});
    window.YWIMobileToday.renderMobileCrewApp();
  });
  await page.locator('.mobile-reliability-v388').evaluate(el=>el.open=true);
  await expect(page.locator('[data-offline388-cohort="last_7_days"]')).toContainText('Rate withheld');
  await page.evaluate(()=>{
    window.YWIOutbox.getDeviceSafeReliabilityCohorts=()=>({state:'permission_hidden',reason:'Sign in to inspect only your evidence'});
    window.YWIMobileToday.renderMobileCrewApp();
  });
  await page.locator('.mobile-reliability-v388').evaluate(el=>el.open=true);
  await expect(page.locator('.mobile-reliability-v388')).toContainText('sign-in required');
  await expect(page.locator('[data-offline388-cohort]')).toHaveCount(0);
});
