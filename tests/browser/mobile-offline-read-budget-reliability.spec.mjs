import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const mobileSource=fs.readFileSync('js/mobile-today.js','utf8');
const outboxSource=fs.readFileSync('js/outbox.js','utf8');

function compactContext(){
  const row={
    dispatch:{id:'d361',work_order_id:'w361',schedule_status:'scheduled',scheduled_start:'2026-09-30T14:00:00Z',route_order:1},
    work_order:{id:'w361',work_order_number:'WO-361',work_type:'Fall cleanup',status:'scheduled'},
    job:{id:361,job_code:'JOB-361',job_name:'Build 361 field route'},
    site:{id:'s361',site_name:'Reliability Site',service_address:'1 Test Rd',city:'Tillsonburg'},
    route:{stop:{stop_order:1}},
    latest_session:null,
    production:{session_count:1,quantity_count:4,material_issue_count:2},
    evidence:{proof_count:1},
    closeout:{closeout_status:'draft'},
    equipment:[]
  };
  return {
    ok:true,build:326,schema:215,
    profile:{id:'owner-361',full_name:'Field Lead',role:'site_leader'},
    capabilities:{jobs_view:true,time_clock:true,safety_create:true,equipment_scan:true,live_update:true,production_capture:true,execution_proof:true,deficiency_rework:true,closeout_request:false,customer_signoff_review:false},
    my_route:[row],my_jobs:[row],
    meta:{assignment_filtered:true,finance_exposed:false,optimization_build:361,payload_contract:'mobile_summary_v361',read_budget:{business_read_budget_max:13,payload_bytes_estimate:42100,payload_budget_state:'within_budget'}}
  };
}

async function bootMobile(page){
  await page.setViewportSize({width:390,height:900});
  await page.setContent('<main><section id="today"><div id="mobileTodayStatus"></div><div id="mobileInstallCard"></div><div id="mobileTodayGrid"></div></section><section id="jobs"><table id="job_list_table"><tbody></tbody></table></section></main>');
  await page.evaluate((payload)=>{
    window.__crewReads=0;
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'site_leader',profile:{id:'owner-361',role:'site_leader'}})};
    window.YWISecurity={normalizeRole:(r)=>r,getRoleLabel:()=> 'Site Leader',canViewSection:()=>true};
    window.YWIRouter={showSection:()=>{}};
    window.YWIOutbox={getItems:()=>[],getActionSummary:()=>({total:0,conflicts:0,pending:0,items:[]})};
    window.YWIMobileFormAssist={countDrafts:()=>0,draftSummaries:()=>[]};
    window.YWIAPI={
      fetchMobileCrewContext:async()=>{window.__crewReads+=1; return payload;},
      manageOperations:async()=>({ok:true})
    };
  },compactContext());
  await page.addScriptTag({content:mobileSource});
  await page.evaluate(()=>window.YWIMobileToday.bind());
  await expect.poll(()=>page.evaluate(()=>window.__crewReads)).toBe(1);
}

test('Build 361 renders compact mobile counts and does not reread on local render churn',async({page})=>{
  await bootMobile(page);
  await expect(page.locator('#mobileCrewAppV2')).toContainText('2 material use');
  await expect(page.locator('#mobileCrewAppV2')).toContainText('4 production qty');
  await expect(page.locator('#mobileCrewAppV2')).toContainText('1 proof');
  await expect(page.locator('#mobileCrewAppV2')).toContainText('Read budget ≤13 business reads');
  await page.evaluate(()=>{ for(let i=0;i<8;i++) window.YWIMobileToday.render(); });
  await page.waitForTimeout(50);
  expect(await page.evaluate(()=>window.__crewReads)).toBe(1);
  await page.locator('[data-crew-refresh]').click();
  await expect.poll(()=>page.evaluate(()=>window.__crewReads)).toBe(2);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('Build 361 conflict replay waits for explicit recovery and stays profile isolated',async({page})=>{
  await page.setContent('<main></main>');
  await page.evaluate(()=>{
    window.YWI_AUTH={getState:()=>({profile:{id:'owner-a'}})};
    window.YWIMobileMenu={syncBadges:()=>{}};
  });
  await page.addScriptTag({content:outboxSource});
  await page.evaluate(()=>window.YWIOutbox.queueAction({scope:'jobs',action_type:'save_note',payload:{job_id:'361'},label:'Build 361 note'}));

  const first=await page.evaluate(async()=>{
    window.__replayCalls=0;
    return window.YWIOutbox.retryQueuedActions({handlers:{save_note:async()=>{window.__replayCalls+=1;throw new Error('stale conflict: server changed');}}});
  });
  expect(first.processed).toBe(1);
  expect(first.conflicts).toHaveLength(1);

  const second=await page.evaluate(async()=>window.YWIOutbox.retryQueuedActions({handlers:{save_note:async()=>{window.__replayCalls+=1;}}}));
  expect(second.skipped_conflicts).toBe(1);
  expect(await page.evaluate(()=>window.__replayCalls)).toBe(1);

  await page.evaluate(()=>{
    const id=window.YWIOutbox.getActionItems()[0].id;
    window.YWIOutbox.applyRecoveryAction(id,'retry',{note:'Explicit operator retry'});
  });
  const third=await page.evaluate(async()=>window.YWIOutbox.retryQueuedActions({handlers:{save_note:async()=>{window.__replayCalls+=1;}}}));
  expect(third.retried).toBe(1);
  expect(await page.evaluate(()=>window.__replayCalls)).toBe(2);
  expect(await page.evaluate(()=>window.YWIOutbox.getActionItems().length)).toBe(0);

  await page.evaluate(()=>{
    window.YWIOutbox.setActionItems([{id:'foreign',status:'pending',scope:'jobs',action_type:'save_note',payload:{job_id:'foreign'},owner_key:'owner-b'}]);
  });
  const foreign=await page.evaluate(async()=>window.YWIOutbox.retryQueuedActions({handlers:{save_note:async()=>{window.__replayCalls+=1;}}}));
  expect(foreign.skipped_owner).toBe(1);
  expect(await page.evaluate(()=>window.__replayCalls)).toBe(2);
  expect(await page.evaluate(()=>window.YWIOutbox.getActionItems()[0].id)).toBe('foreign');
});

test('Build 361 bounds one replay batch to twelve queued actions',async({page})=>{
  await page.setContent('<main></main>');
  await page.evaluate(()=>{
    window.YWI_AUTH={getState:()=>({profile:{id:'owner-a'}})};
    window.YWIMobileMenu={syncBadges:()=>{}};
  });
  await page.addScriptTag({content:outboxSource});
  await page.evaluate(()=>{
    const rows=Array.from({length:15},(_,i)=>({id:'q'+i,status:'pending',scope:'jobs',action_type:'save',payload:{i},owner_key:'owner-a'}));
    window.YWIOutbox.setActionItems(rows);
    window.__batchCalls=0;
  });
  const result=await page.evaluate(async()=>window.YWIOutbox.retryQueuedActions({handlers:{save:async()=>{window.__batchCalls+=1;}}}));
  expect(result.processed).toBe(12);
  expect(result.deferred).toBe(3);
  expect(await page.evaluate(()=>window.__batchCalls)).toBe(12);
  expect(await page.evaluate(()=>window.YWIOutbox.getActionItems().length)).toBe(3);
});
