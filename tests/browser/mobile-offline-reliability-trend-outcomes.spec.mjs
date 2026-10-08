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

test('Build 374 renders release-over-release guardrail evidence and privacy-safe runtime aggregates at 390px',async({page})=>{
  await bootMobile(page);
  const card=page.locator('.mobile-reliability-v374');
  await expect(card).toContainText('item 361 → 374');
  await expect(card).toContainText('Within retained guardrails');
  await expect(card).toContainText('Read ceiling: 13 → 13 business reads');
  await expect(card).toContainText('Payload: 41 KB · band healthy · retained ceiling 176 KB');
  await expect(card).toContainText('Refresh: ≥5 min live TTL · local 30-second renders do not reread');
  await expect(card).toContainText('Offline replay: ≤12 actions/batch · local conflict rate 33.3% (1/3)');
  await expect(card).toContainText('signed-in session snapshot ≤4 h · Admin duplicate reads coalesce ≥3 s');
  await expect(card).toContainText('no customer data, notes, queued payload bodies or device identifiers');
  await expect(card).not.toContainText('REGRESSION / RELEASE HOLD');

  const history=await page.evaluate(()=>window.YWIMobileToday.reliabilityReleaseHistory());
  expect(history).toEqual([
    {build:361,business_read_ceiling:13,payload_budget_bytes:180000,live_ttl_ms:300000,cache_stale_ms:14400000,replay_batch_max:12,admin_read_coalesce_ms:3000},
    {build:374,business_read_ceiling:13,payload_budget_bytes:180000,live_ttl_ms:300000,cache_stale_ms:14400000,replay_batch_max:12,admin_read_coalesce_ms:3000}
  ]);

  await page.evaluate(()=>{ for(let i=0;i<8;i++) window.YWIMobileToday.render(); });
  await page.waitForTimeout(50);
  expect(await page.evaluate(()=>window.__crewReads)).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('Build 374 fails closed when a runtime read ceiling or payload crosses the retained baseline',async({page})=>{
  await bootMobile(page,compactContext({read_budget:{business_read_budget_max:14,payload_bytes_estimate:190000,payload_budget_state:'over_budget'}}),{total:4,conflicts:2,pending:2});
  const card=page.locator('.mobile-reliability-v374');
  await expect(card).toHaveAttribute('open','');
  await expect(card).toContainText('REGRESSION / RELEASE HOLD');
  await expect(card).toContainText('business read ceiling increased');
  await expect(card).toContainText('observed payload exceeded the retained release budget');
  await expect(card).toContainText('local conflict rate 50.0% (2/4)');
  await expect(card).toContainText('do not raise the retained budgets');
  await expect(card.getByRole('button',{name:/increase|raise|expand.*budget/i})).toHaveCount(0);
});

test('Build 374 evidence helper remains aggregate and does not require a server write',async({page})=>{
  await bootMobile(page,compactContext(),{total:0,conflicts:0,pending:0});
  const evidence=await page.evaluate(()=>window.YWIMobileToday.mobileReliabilityEvidence());
  expect(evidence.state).toBe('within_guardrails');
  expect(evidence.conflict_rate_percent).toBe(0);
  expect(evidence.queued_action_count).toBe(0);
  expect(evidence.privacy_contract).toContain('aggregate counts and release contracts only');
  expect(evidence).not.toHaveProperty('payload');
  expect(evidence).not.toHaveProperty('jobs');
  expect(evidence).not.toHaveProperty('sites');
});
