import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/mobile-today.js','utf8');
function payload(active=false) {
 return {ok:true,build:326,schema:215,profile:{id:'11111111-1111-4111-8111-111111111111',full_name:'Field Lead',role:'site_leader'},
 capabilities:{jobs_view:true,time_clock:true,safety_create:true,equipment_scan:false,live_update:true,production_capture:true,execution_proof:true,deficiency_rework:true,closeout_request:false},
 my_route:[{dispatch:{id:'21111111-1111-4111-8111-111111111111',work_order_id:'31111111-1111-4111-8111-111111111111',schedule_status:'scheduled',scheduled_start:'2026-10-14T13:00:00Z',workability_state:'workable'},
 work_order:{id:'31111111-1111-4111-8111-111111111111',work_order_number:'WO-396',work_type:'Fall cleanup'},
 job:{id:396,job_name:'Maple fall cleanup'},site:{id:'41111111-1111-4111-8111-111111111111',site_name:'Maple'},
 latest_session:active?{id:'61111111-1111-4111-8111-111111111111',session_status:'in_progress'}:null,
 production:{session_count:active?1:0,quantity_count:0,material_issue_count:0},evidence:{proof_count:0},equipment:[]}],
 my_jobs:[],meta:{assignment_filtered:true,finance_exposed:false}};
}
async function boot(page,{active=false,mode='success'}={}) {
 await page.setViewportSize({width:390,height:850});
 await page.setContent('<main><section id="today"><div id="mobileTodayStatus"></div><div id="mobileInstallCard"></div><div id="mobileTodayGrid"></div></section></main>');
 await page.evaluate(({payload,mode})=>{
   window.__calls=[];window.__mode=mode;window.__current=payload;window.__settle=null;
   window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'site_leader',profile:{id:payload.profile.id}})};
   window.YWISecurity={normalizeRole:r=>r,getRoleLabel:()=> 'Site Leader',canViewSection:()=>true};
   window.YWIRouter={showSection:()=>{}};
   window.YWIOutbox={getItems:()=>[],getActionSummary:()=>({total:0,conflicts:0,pending:0,items:[]})};
   window.YWIMobileFormAssist={countDrafts:()=>0,draftSummaries:()=>[]};
   window.prompt=()=> 'Completion note: cleaned leaves';
   window.YWIAPI={fetchMobileCrewContext:async()=>window.__current,
     manageOperations:async()=>{throw Error('Legacy session write is forbidden')},
     mobileProductionTransition:async(body)=>{
       window.__calls.push(body);
       if(window.__mode==='pending')await new Promise(resolve=>{window.__settle=resolve});
       if(window.__mode==='failOnce'&&window.__calls.length===1)throw Error('Connection interrupted after submission');
       const finished=body.transition==='finish';
       window.__current.my_route[0].latest_session={id:'61111111-1111-4111-8111-111111111111',session_status:finished?'completed':'in_progress'};
       return {ok:true,transition:body.transition,session_id:'61111111-1111-4111-8111-111111111111',
         session_status:finished?'completed':'in_progress',replayed:window.__calls.length>1};
     }
   };
 },{payload:payload(active),mode});
 await page.addScriptTag({content:source});
 await page.evaluate(async()=>{window.YWIMobileToday.bind();await window.YWIMobileToday.loadMobileCrewContext(true);});
}
test('Build 396 pending Start disables duplicate clicks and waits for acknowledged save',async({page})=>{
 await boot(page,{mode:'pending'});
 const start=page.locator('[data-crew-action="start_visit"]');
 await start.click();
 await expect(page.locator('[data-crew-save-state]')).toContainText('Saving start');
 await expect(page.locator('[data-crew-action="start_visit"]')).toBeDisabled();
 await expect.poll(()=>page.evaluate(()=>window.__calls.length)).toBe(1);
 await page.evaluate(()=>window.__settle());
 await expect(page.locator('[data-crew-save-state]')).toContainText('Saved: visit started');
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls).toHaveLength(1);
 expect(calls[0].intent_key).toMatch(/^[0-9a-f-]{36}$/i);
 await expect(page.locator('[data-crew-action="finish_visit"]')).toBeVisible();
});
test('Build 396 retries an uncertain network failure with the original action key',async({page})=>{
 await boot(page,{mode:'failOnce'});
 await page.locator('[data-crew-action="start_visit"]').click();
 await expect(page.locator('[data-crew-save-state]')).toContainText('Not confirmed');
 await page.locator('[data-crew-action="start_visit"]').click();
 await expect(page.locator('[data-crew-save-state]')).toContainText('Confirmed prior save');
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls).toHaveLength(2);
 expect(calls[0].intent_key).toBe(calls[1].intent_key);
});
test('Build 396 completion is tied to the existing session ID and production note',async({page})=>{
 await boot(page,{active:true});
 await page.locator('[data-crew-action="finish_visit"]').click();
 await expect(page.locator('[data-crew-save-state]')).toContainText('Saved: visit completed');
 await expect(page.locator('[data-crew-save-state]')).toContainText('Execution Proof');
 const call=await page.evaluate(()=>window.__calls[0]);
 expect(call.transition).toBe('finish');
 expect(call.session_id).toBe('61111111-1111-4111-8111-111111111111');
 expect(call.completion_note).toContain('cleaned leaves');
});
