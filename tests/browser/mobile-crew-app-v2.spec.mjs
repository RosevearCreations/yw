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
