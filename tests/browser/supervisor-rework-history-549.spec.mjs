import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const cockpit=fs.readFileSync('js/operations-cockpit.js','utf8');
const guard=fs.readFileSync('js/closeout-runtime-guard.js','utf8');
const crew=fs.readFileSync('js/mobile-today.js','utf8');
const css=fs.readFileSync('style.css','utf8');
const closeoutId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const workOrderId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rejectedAt='2026-11-08T12:00:00Z';

async function mountSupervisor(page,permitted=true) {
  await page.setViewportSize({width:390,height:820});
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><section id="admin"><div id="ad_stats_grid"></div></section></body></html>`);
  await page.evaluate(({closeoutId,workOrderId,permitted})=>{
    window.__calls=[];
    const q={capabilities:{actor_rank:30,actions:{work_order_closeout_decision:{permitted}}},closeouts:[{
      id:closeoutId,work_order_id:workOrderId,closeout_status:'rework_required',work_order_number:'WO-549',
      client_name:'Rosevear Landscaping',customer_summary:'Lawn edging visit.',rejection_reason:'Retake missed edging.',
      customer_signoff_status:'not_requested',invoice_readiness_status:'blocked',approved_proof_count:1
    }]};
    window.YWIAPI={manageOperations:async(body)=>{window.__calls.push(body);return {ok:true,queues:q};},
      mobileReworkPhoto:async(body)=>{
        window.__calls.push(body);
        if(window.__deny) throw Error('This work order is assigned to another supervisor.');
        return {ok:true,staff_only:true,history_limited:true,closeout:{id:closeoutId,status:'rework_required',rejection_reason:'Retake missed edging.'},
          current_acknowledgements:[{actor_id:'crew-1',at:'2026-11-08T12:11:00Z'}],events:[
            {id:'audit-1',type:'supervisor_decision',at:'2026-11-08T12:00:00Z',title:'Supervisor rework',detail:'Correct missed <img onerror=alert(1)> edging.'},
            {id:'proof-1',type:'correction_proof',at:'2026-11-08T12:20:00Z',title:'Crew correction proof',detail:'Status: submitted'},
            {id:'update-1',type:'acknowledgement',at:'2026-11-08T12:11:00Z',title:'Crew member acknowledged instructions',detail:'Receipt only'}]};
      }};
  },{closeoutId,workOrderId,permitted});
  await page.addScriptTag({content:guard});
  await page.addScriptTag({content:cockpit});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#oc_closeout_queue')).toContainText('WO-549');
}

test('YW 549 supervisor reviews source-backed audit and individual crew receipt on a phone',async({page})=>{
  await mountSupervisor(page);
  await page.getByRole('button',{name:'View rework history'}).click();
  const history=page.locator('.oc-closeout-history');
  await expect(history).toContainText('3 recorded events');
  await expect(history).toContainText('1 individual crew member acknowledgement');
  await expect(history).toContainText('Supervisor rework');
  await expect(history).toContainText('Crew correction proof');
  await expect(history).toContainText('not acceptance, proof approval, or job completion');
  expect(await history.innerHTML()).toContain('&lt;img onerror=alert(1)&gt;');
  expect(await page.evaluate(()=>window.__calls.filter(x=>x.action==='work_order_closeout_decision'))).toEqual([]);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Hide rework history'}).click();
  await expect(history).toHaveCount(0);
});

test('YW 549 denies history when supervisor permission or assignment is missing',async({page})=>{
  await mountSupervisor(page,false);
  await expect(page.getByRole('button',{name:'View rework history'})).toBeDisabled();
  await page.evaluate(()=>{window.__calls.length=0;window.__deny=true;});
  // New authoritative queue result with approved capability.
  await page.evaluate(()=>{const original=window.YWIAPI.manageOperations;window.YWIAPI.manageOperations=async(body)=>{
    const r=await original(body);r.queues.capabilities.actions.work_order_closeout_decision.permitted=true;return r;};});
  await page.locator('#oc_refresh').click();
  await page.getByRole('button',{name:'View rework history'}).click();
  await expect(page.locator('.oc-closeout-history')).toContainText('assigned to another supervisor');
  await expect(page.locator('.oc-closeout-history-events')).toHaveCount(0);
});

async function mountCrew(page){
  await page.setViewportSize({width:390,height:820});
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main><section id="today"><div id="mobileTodayStatus"></div><div id="mobileInstallCard"></div><div id="mobileTodayGrid"></div></section></main></body></html>`);
  await page.evaluate(({closeoutId,workOrderId,rejectedAt})=>{
    const profileId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const job={dispatch:{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',work_order_id:workOrderId,scheduled_start:'2026-11-08T13:00:00Z',schedule_status:'scheduled'},
      work_order:{id:workOrderId,work_order_number:'WO-549',work_type:'Lawn maintenance'},
      job:{id:549,job_name:'Edging rework'},site:{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',site_name:'Test garden',service_address:'Test Road'},
      equipment:[],equipment_signouts:[],production:{},evidence:{proofs:[]},closeout:{id:closeoutId,rejected_at:rejectedAt,closeout_status:'rework_required',rejection_reason:'Retake missed edging.'}};
    const payload={ok:true,profile:{id:profileId,role:'site_leader'},capabilities:{jobs_view:true,execution_proof:true},
      my_route:[job],my_jobs:[job],meta:{assignment_filtered:true,finance_exposed:false}};
    window.__calls=[];
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'site_leader',profile:{id:profileId,role:'site_leader'}})};
    window.YWISecurity={normalizeRole:r=>r,getRoleLabel:()=> 'Site Leader',canViewSection:()=>true};
    window.YWIRouter={showSection:()=>{}};
    window.YWIOutbox={getItems:()=>[],getActionSummary:()=>({total:0,conflicts:0,pending:0,items:[]})};
    window.YWIMobileFormAssist={countDrafts:()=>0,draftSummaries:()=>[]};
    window.YWIAPI={fetchMobileCrewContext:async()=>payload,manageOperations:async(body)=>{window.__calls.push(body);return {ok:true};},
      mobileReworkPhoto:async(body)=>{window.__calls.push(body);
        if(body.action==='crew_history')return {ok:true,staff_only:true,closeout_id:closeoutId,rejected_at:rejectedAt,
          instructions:'Retake missed edging.',acknowledgement:null,status:'rework_required'};
        return {ok:true,staff_only:true,closeout_id:closeoutId,acknowledgement:{id:'ffffffff-ffff-4fff-8fff-ffffffffffff',at:'2026-11-08T14:00:00Z'},status:'rework_required'};}};
  },{closeoutId,workOrderId,rejectedAt});
  await page.addScriptTag({content:crew});
  await page.evaluate(async()=>{window.YWIMobileToday.bind();await window.YWIMobileToday.loadMobileCrewContext(true);});
  await page.locator('[data-crew-tab="rework"]').click();
}

test('YW 549 assigned crew explicitly acknowledges only the current instructions, without closeout authority',async({page})=>{
  await mountCrew(page);
  await page.getByRole('button',{name:'Review instruction acknowledgement'}).click();
  await expect(page.locator('.mobile-crew-v2-rework-ack')).toContainText('Retake missed edging.');
  await expect(page.locator('.mobile-crew-v2-rework-ack')).toContainText('Not yet acknowledged');
  page.once('dialog',d=>d.dismiss());
  await page.getByRole('button',{name:'I have read these instructions'}).click();
  expect(await page.evaluate(()=>window.__calls.filter(x=>x.action==='crew_acknowledge'))).toHaveLength(0);
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'I have read these instructions'}).click();
  await expect(page.locator('.mobile-crew-v2-rework-ack')).toContainText('Acknowledged by this signed-in crew member');
  expect(await page.evaluate(()=>window.__calls.filter(x=>x.action==='crew_acknowledge'))).toEqual([{
    action:'crew_acknowledge',work_order_id:workOrderId,closeout_package_id:closeoutId,rejected_at:rejectedAt,confirmed:true
  }]);
  expect(await page.evaluate(()=>window.__calls.filter(x=>x.action==='work_order_closeout_decision'))).toEqual([]);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
