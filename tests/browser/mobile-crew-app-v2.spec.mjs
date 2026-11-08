import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const source=fs.readFileSync('js/mobile-today.js','utf8');

function contextPayload(){
  return {
    ok:true,build:326,schema:214,
    profile:{id:'11111111-1111-4111-8111-111111111111',full_name:'Field Lead',role:'site_leader'},
    capabilities:{jobs_view:true,time_clock:true,safety_create:true,equipment_scan:true,live_update:true,production_capture:true,execution_proof:true,deficiency_rework:true,closeout_request:false,customer_signoff_review:false},
    my_route:[{
      dispatch:{id:'21111111-1111-4111-8111-111111111111',work_order_id:'31111111-1111-4111-8111-111111111111',schedule_status:'scheduled',scheduled_start:'2026-09-21T13:00:00Z',route_order:2,dispatch_notes:'Use north gate.',workability_state:'workable',weather_summary:'Clear'},
      work_order:{id:'31111111-1111-4111-8111-111111111111',work_order_number:'WO-326',work_type:'Lawn maintenance',status:'scheduled'},
      job:{id:326,job_code:'JOB-326',job_name:'Maple lawn service',client_name:'Maple Customer'},
      site:{id:'41111111-1111-4111-8111-111111111111',site_name:'Maple Property',service_address:'10 Test Rd',city:'Tillsonburg',access_notes:'North gate code is in dispatch.',hazard_notes:'Watch wet slope.',recurring_property_instructions:'Keep trailer clear of driveway.'},
      route:{id:'51111111-1111-4111-8111-111111111111',route_code:'R-2',name:'Tuesday route',stop:{stop_order:2}},
      latest_session:null,
      production:{session_count:0,quantities:[],material_issues:[{id:'m1',issue_number:'MI-1'}]},
      evidence:{proofs:[],live_updates:[]},
      closeout:null,
      equipment:[{id:4,equipment_code:'MOW-4',equipment_name:'Mower 4',defect_status:'clear',is_locked_out:false}],
      equipment_signouts:[]
    }],
    my_jobs:[],
    meta:{assignment_filtered:true,finance_exposed:false}
  };
}

async function boot(page,width){
  await page.setViewportSize({width,height:900});
  await page.setContent('<main><section id="today"><div id="mobileTodayStatus"></div><div id="mobileInstallCard"></div><div id="mobileTodayGrid"></div></section></main>');
  await page.evaluate((payload)=>{
    window.__opsCalls=[];
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'site_leader',profile:{id:payload.profile.id,role:'site_leader'}})};
    window.YWISecurity={
      normalizeRole:(r)=>r,
      getRoleLabel:()=> 'Site Leader',
      canViewSection:()=>true
    };
    window.YWIRouter={showSection:(value)=>{window.__route=value;}};
    window.YWIOutbox={getItems:()=>[],getActionSummary:()=>({total:0,conflicts:0,pending:0,items:[]})};
    window.YWIMobileFormAssist={countDrafts:()=>0,draftSummaries:()=>[]};
    window.YWIAPI={
      fetchMobileCrewContext:async()=>payload,
      manageOperations:async(body)=>{window.__opsCalls.push(body); return {ok:true};},
      mobileProductionTransition:async(body)=>{window.__opsCalls.push(body); return {ok:true,session_id:'61111111-1111-4111-8111-111111111111',session_status:'in_progress'};}
    };
  },contextPayload());
  await page.addScriptTag({content:source});
  await page.evaluate(async()=>{window.YWIMobileToday.bind(); await window.YWIMobileToday.loadMobileCrewContext(true);});
}

for (const width of [390,430]) {
  test('Build 326 fits phone width '+width+' and renders route authority', async ({page})=>{
    await boot(page,width);
    await expect(page.locator('#mobileCrewAppV2')).toContainText('Mobile Crew App v2');
    await expect(page.locator('#mobileCrewAppV2')).toContainText('My Route');
    await expect(page.locator('#mobileCrewAppV2')).toContainText('Maple lawn service');
    await expect(page.locator('#mobileCrewAppV2')).toContainText('Property access');
    await expect(page.locator('#mobileCrewAppV2')).toContainText('North gate code');
    await expect(page.locator('#mobileCrewAppV2')).toContainText('Watch wet slope');
    await expect(page.locator('[data-crew-action="start_visit"]')).toBeVisible();
    await expect(page.locator('[data-crew-action="quantity"]')).toBeDisabled();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('Build 326 uses canonical production action and disables writes offline', async ({page})=>{
  await boot(page,390);
  await page.locator('[data-crew-action="start_visit"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.length)).toBeGreaterThan(0);
  const call=await page.evaluate(()=>window.__opsCalls[0]);
  expect(call.transition).toBe('start');
  expect(call.intent_key).toMatch(/^[0-9a-f-]{36}$/i);
  expect(call.work_order_id).toBe('31111111-1111-4111-8111-111111111111');

  await page.evaluate(()=>{
    Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.locator('#mobileCrewAppV2')).toContainText('Offline');
  await expect(page.locator('[data-crew-action="start_visit"]')).toBeDisabled();
  await expect(page.locator('[data-crew-action="clock"]')).toBeEnabled();
  await expect(page.locator('[data-crew-action="safety"]')).toBeEnabled();
});

test('Build 542 finds only assigned work, preserves route action identity and keeps filters read-only', async ({page})=>{
  await boot(page,390);
  const secondId='71111111-1111-4111-8111-111111111111';
  await page.evaluate(async (id)=>{
    const original=await window.YWIAPI.fetchMobileCrewContext();
    const second=structuredClone(original.my_route[0]);
    second.dispatch.id=id;
    second.dispatch.route_order=3;
    second.job.job_name='Oak hedge trimming';
    second.job.job_code='JOB-542';
    second.site.site_name='Oak Property';
    second.site.service_address='44 Cedar Street';
    second.site.hazard_notes='';
    second.site.slope_notes='';
    second.site.drainage_wet_area_notes='';
    second.site.utility_locate_notes='';
    second.site.tree_brush_notes='';
    second.equipment=[];
    original.my_route.push(second);
    original.my_jobs=[second];
    window.YWIAPI.fetchMobileCrewContext=async()=>original;
    await window.YWIMobileToday.loadMobileCrewContext(true);
  },secondId);
  await expect(page.locator('[data-crew-match-count]')).toHaveText('2 of 2 assigned route stops shown');
  await page.locator('[data-crew-search]').fill('cedar');
  await expect(page.locator('.mobile-crew-v2-card')).toHaveCount(1);
  await expect(page.locator('.mobile-crew-v2-card')).toContainText('Oak hedge trimming');
  await expect(page.locator('[data-crew-match-count]')).toHaveText('1 of 2 assigned route stops shown');
  expect(await page.locator('.mobile-crew-v2-card').getAttribute('data-crew-card')).toBe('1');
  await page.locator('[data-crew-action="start_visit"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.length)).toBe(1);
  expect((await page.evaluate(()=>window.__opsCalls[0])).dispatch_schedule_item_id).toBe(secondId);

  await page.locator('[data-crew-clear]').click();
  await page.locator('[data-crew-cautions]').check();
  await expect(page.locator('.mobile-crew-v2-card')).toHaveCount(1);
  await expect(page.locator('.mobile-crew-v2-card')).toContainText('Maple lawn service');
  await page.locator('[data-crew-search]').fill('impossible address');
  await expect(page.locator('.mobile-crew-v2-empty')).toContainText('No assigned work matches');
  await expect(page.locator('[data-crew-match-count]')).toHaveText('0 of 2 assigned route stops shown');
  expect(await page.evaluate(()=>window.__opsCalls.length)).toBe(1);
  await page.locator('[data-crew-clear]').click();
  await page.locator('[data-crew-tab="jobs"]').click();
  await expect(page.locator('[data-crew-match-count]')).toHaveText('1 of 1 assigned jobs shown');
  await expect(page.locator('.mobile-crew-v2-card')).toContainText('Oak hedge trimming');
});

test('Build 542 resets private finder state when signed-in identity changes', async ({page})=>{
  await boot(page,430);
  await page.locator('[data-crew-search]').fill('Maple');
  await page.locator('[data-crew-cautions]').check();
  await page.evaluate(()=>document.dispatchEvent(new Event('ywi:auth-changed')));
  await expect(page.locator('[data-crew-search]')).toHaveValue('');
  await expect(page.locator('[data-crew-cautions]')).not.toBeChecked();
});

for (const width of [390,430]) {
  test('YW 543 quick job details and personal checklist fit '+width+'px and never become official signoff', async ({page})=>{
    await boot(page,width);
    await expect(page.locator('.mobile-crew-v2-card')).toContainText('Watch wet slope');
    const details=page.locator('[data-crew-details="0"]');
    await expect(details).not.toHaveAttribute('open');
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open');
    await expect(details).toContainText('WO-326');
    await expect(details).toContainText('Lawn maintenance');
    await expect(details).toContainText('Personal reminders only');
    await expect(details.locator('[data-crew-prep]')).toHaveCount(4);
    await details.locator('[data-crew-prep="task"]').check();
    await details.locator('[data-crew-prep="hazards"]').check();
    await expect(details.locator('[data-crew-prep-count]')).toHaveText('2 of 4 reviewed');
    expect(await page.evaluate(()=>window.__opsCalls.length)).toBe(0);
    await page.locator('[data-crew-search]').fill('Maple');
    await expect(page.locator('[data-crew-details="0"]')).toHaveAttribute('open');
    await expect(page.locator('[data-crew-prep="task"]')).toBeChecked();
    await page.locator('[data-crew-action="safety"]').click();
    expect(await page.evaluate(()=>window.__route)).toBe('inspect');
    expect(await page.evaluate(()=>window.__opsCalls.length)).toBe(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('YW 543 clears personal checklist on identity switch and ignores stale previous-user fetch', async ({page})=>{
  await boot(page,390);
  await page.locator('[data-crew-details="0"] summary').click();
  await page.locator('[data-crew-prep="access"]').check();
  await expect(page.locator('[data-crew-prep-count]')).toHaveText('1 of 4 reviewed');
  await page.evaluate(()=>{
    const originalFetch=window.YWIAPI.fetchMobileCrewContext;
    window.__oldFetchResolve=null;
    window.YWIAPI.fetchMobileCrewContext=()=>new Promise((resolve)=>{window.__oldFetchResolve=resolve;});
    window.YWIMobileToday.loadMobileCrewContext(true);
    window.YWI_AUTH.getState=()=>({isAuthenticated:true,role:'site_leader',profile:{id:'99999999-9999-4999-8999-999999999999',role:'site_leader'}});
    window.YWIAPI.fetchMobileCrewContext=async()=>{
      const payload=await originalFetch();
      const copy=structuredClone(payload);
      copy.profile.id='99999999-9999-4999-8999-999999999999';
      copy.my_route[0].dispatch.id='new-user-dispatch';
      copy.my_route[0].job.job_name='New user route';
      return copy;
    };
    document.dispatchEvent(new Event('ywi:auth-changed'));
  });
  await expect(page.locator('.mobile-crew-v2-card')).toContainText('New user route');
  await expect(page.locator('[data-crew-details="0"]')).not.toHaveAttribute('open');
  await page.locator('[data-crew-details="0"] summary').click();
  await expect(page.locator('[data-crew-prep-count]')).toHaveText('0 of 4 reviewed');
  await page.evaluate(()=>{
    window.__oldFetchResolve({ok:true,my_route:[{job:{job_name:'Old user private route'},dispatch:{id:'old-user-dispatch'}}],my_jobs:[]});
  });
  await expect(page.locator('.mobile-crew-v2-card')).toContainText('New user route');
  await expect(page.locator('.mobile-crew-v2-card')).not.toContainText('Old user private route');
});

for (const width of [390,430]) {
  test('YW 544 guided closeout shows real source gaps without granting approvals at '+width+'px', async ({page})=>{
    await boot(page,width);
    const guide=page.locator('[data-crew-closeout-index="0"]');
    await expect(guide.locator('summary')).toContainText('4 review prompts');
    await guide.locator('summary').click();
    await expect(guide).toHaveAttribute('open');
    await expect(guide).toContainText('No completed visit is shown');
    await expect(guide).toContainText('No quantity is recorded');
    await expect(guide).toContainText('No execution proof is recorded');
    await expect(guide).toContainText('Safety / PPE approval status is not included');
    await expect(guide).toContainText('do not certify readiness');
    expect(await page.evaluate(()=>window.__opsCalls.length)).toBe(0);
    await page.locator('[data-crew-search]').fill('Maple');
    await expect(page.locator('[data-crew-closeout-index="0"]')).toHaveAttribute('open');
    await page.locator('[data-crew-closeout-index="0"] [data-crew-guide-action="safety"]').click();
    expect(await page.evaluate(()=>window.__route)).toBe('inspect');
    expect(await page.evaluate(()=>window.__opsCalls.length)).toBe(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('YW 544 requires acknowledgement of closeout prompts, preserves server permission and sends no customer message', async ({page})=>{
  await boot(page,390);
  await page.evaluate(async()=>{
    const payload=structuredClone(await window.YWIAPI.fetchMobileCrewContext());
    payload.capabilities.closeout_request=true;
    payload.my_route[0].latest_session={id:'session-544',session_status:'in_progress'};
    payload.my_route[0].equipment=[{id:9,equipment_name:'Mower 9',is_locked_out:true,defect_status:'lockout'}];
    window.YWIAPI.fetchMobileCrewContext=async()=>payload;
    await window.YWIMobileToday.loadMobileCrewContext(true);
  });
  await expect(page.locator('[data-crew-closeout-index="0"]')).toContainText('Equipment caution');
  const messages=[];
  page.on('dialog',async(dialog)=>{
    messages.push({type:dialog.type(),message:dialog.message()});
    await dialog.dismiss();
  });
  await page.locator('.mobile-crew-v2-actions [data-crew-action="closeout"]').click();
  await expect(page.locator('[data-crew-save-state]')).toContainText('Closeout was not submitted');
  await expect(page.locator('[data-crew-closeout-index="0"]')).toHaveAttribute('open');
  expect(messages).toHaveLength(1);
  expect(messages[0].type).toBe('confirm');
  expect(messages[0].message).toContain('Equipment caution');
  expect(await page.evaluate(()=>window.__opsCalls.length)).toBe(0);
  await page.evaluate(()=>{
    const current=window.YWIAPI.fetchMobileCrewContext;
    window.YWIAPI.fetchMobileCrewContext=async()=>{
      const payload=await current();
      return {...payload,capabilities:{...payload.capabilities,closeout_request:false}};
    };
  });
  await page.evaluate(()=>window.YWIMobileToday.loadMobileCrewContext(true));
  await expect(page.locator('.mobile-crew-v2-actions [data-crew-action="closeout"]')).toHaveCount(0);
});

test('YW 544 allows explicitly confirmed closeout only through the original server action', async ({page})=>{
  await boot(page,430);
  await page.evaluate(async()=>{
    const payload=structuredClone(await window.YWIAPI.fetchMobileCrewContext());
    payload.capabilities.closeout_request=true;
    window.YWIAPI.fetchMobileCrewContext=async()=>payload;
    await window.YWIMobileToday.loadMobileCrewContext(true);
  });
  page.on('dialog',async(dialog)=>{
    if(dialog.type()==='confirm') await dialog.accept();
    else if(dialog.type()==='prompt') await dialog.accept('Mowing completed; client gate closed.');
    else await dialog.dismiss();
  });
  await page.locator('.mobile-crew-v2-actions [data-crew-action="closeout"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__opsCalls.length)).toBe(1);
  const result=await page.evaluate(()=>window.__opsCalls[0]);
  expect(result.action).toBe('work_order_closeout_submit');
  expect(result.work_order_id).toBe('31111111-1111-4111-8111-111111111111');
  expect(result.customer_summary).toBe('Mowing completed; client gate closed.');
  expect(result.invoice_ready_requested).toBe(false);
  expect(result.review_request_requested).toBe(false);
});

for (const width of [390,430]) {
  test(`YW 546 mobile rework inbox records own proof and resubmits only for supervisor at ${width}px`,async({page})=>{
    await boot(page,width);
    await page.evaluate(async()=>{
      const payload=structuredClone(await window.YWIAPI.fetchMobileCrewContext());
      const row=payload.my_route[0];
      row.closeout={id:'b1111111-1111-4111-8111-111111111111',closeout_status:'rework_required',rejected_at:'2026-11-08T10:00:00Z',rejection_reason:'Correct <script>alert(1)</script> east fence section.'};
      row.evidence={proof_count:0,correction_proofs:[]};
      payload.my_jobs=[row];
      window.YWIAPI.fetchMobileCrewContext=async()=>payload;
      window.YWIAPI.manageOperations=async(body)=>{
        window.__opsCalls.push(body);
        if(body.action==='work_order_rework_proof_submit'){
          row.evidence.correction_proofs=[{id:'c1111111-1111-4111-8111-111111111111',created_at:'2026-11-08T12:00:00Z',proof_status:'submitted'}];
          return {ok:true,proof:{execution_proof_id:'c1111111-1111-4111-8111-111111111111'}};
        }
        if(body.action==='work_order_rework_resubmit') return {ok:true,update_id:'d1111111-1111-4111-8111-111111111111',closeout_status:'rework_required'};
        return {ok:true};
      };
      await window.YWIMobileToday.loadMobileCrewContext(true);
    });
    await page.locator('[data-crew-tab="rework"]').click();
    await expect(page.locator('[data-crew-match-count]')).toHaveText('1 assigned rework job(s) shown');
    await expect(page.locator('.mobile-crew-v2-rework')).toContainText('Correct <script>alert(1)</script> east fence section.');
    expect(await page.locator('.mobile-crew-v2-rework script').count()).toBe(0);
    await expect(page.locator('[data-crew-action="rework_resubmit"]')).toBeDisabled();
    page.on('dialog',async(dialog)=>{
      if(dialog.type()==='prompt') await dialog.accept('The east fence panel is repaired and secured.');
      else if(dialog.type()==='confirm') await dialog.accept();
    });
    await page.locator('[data-crew-action="rework_proof"]').click();
    await expect.poll(()=>page.evaluate(()=>window.__opsCalls.length)).toBe(1);
    expect(await page.evaluate(()=>window.__opsCalls[0].action)).toBe('work_order_rework_proof_submit');
    await expect(page.locator('[data-crew-action="rework_resubmit"]')).toBeEnabled();
    await page.locator('[data-crew-action="rework_resubmit"]').click();
    await expect.poll(()=>page.evaluate(()=>window.__opsCalls.length)).toBe(2);
    const resubmit=await page.evaluate(()=>window.__opsCalls[1]);
    expect(resubmit.action).toBe('work_order_rework_resubmit');
    expect(resubmit.execution_proof_id).toBe('c1111111-1111-4111-8111-111111111111');
    await expect(page.locator('[data-crew-save-state]')).toContainText('Closeout remains on rework HOLD');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('YW 546 denied/offline rework actions and unassigned inbox have no write path',async({page})=>{
  await boot(page,390);
  await page.evaluate(async()=>{
    const payload=structuredClone(await window.YWIAPI.fetchMobileCrewContext());
    payload.my_route[0].closeout={closeout_status:'rework_required',rejected_at:'2026-11-08T10:00:00Z',rejection_reason:'Recheck gate hinge.'};
    payload.my_jobs=payload.my_route;
    payload.capabilities.execution_proof=false;
    window.YWIAPI.fetchMobileCrewContext=async()=>payload;
    await window.YWIMobileToday.loadMobileCrewContext(true);
  });
  await page.locator('[data-crew-tab="rework"]').click();
  await expect(page.locator('[data-crew-action="rework_proof"]')).toBeDisabled();
  await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'));});
  await expect(page.locator('[data-crew-action="rework_resubmit"]')).toBeDisabled();
  expect(await page.evaluate(()=>window.__opsCalls.length)).toBe(0);
  await page.evaluate(async()=>{
    Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});
    window.YWIAPI.fetchMobileCrewContext=async()=>({ok:true,profile:{id:'new-crew',role:'site_leader'},capabilities:{execution_proof:true},my_route:[],my_jobs:[]});
    await window.YWIMobileToday.loadMobileCrewContext(true);
  });
  await expect(page.locator('.mobile-crew-v2-card')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__opsCalls.length)).toBe(0);
});
