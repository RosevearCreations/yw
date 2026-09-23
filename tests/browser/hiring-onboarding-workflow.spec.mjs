import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'js/admin-hiring-onboarding-ui.js'),'utf8');

async function boot(page){
  await page.setContent('<!doctype html><html><body><section id="admin"><details id="performanceDevelopment338"></details></section></body></html>');
  await page.evaluate(()=>{
    window.__hire339Calls=[];
    const payload={
      ok:true,
      onboarding_overview:[{
        candidate_id:'c1',full_name:'Sam Winter',target_position:'Crew Member',employment_type:'seasonal',season_profile:'winter',
        stage:'orientation',profile_id:'p1',planned_crew_id:'crew1',planned_crew_name:'Snow Crew',current_crew_id:null,current_crew_name:null,
        onboarding_blocker_count:1,training_blocker_count:0,equipment_authorization_blocker_count:0,winter_readiness_blocker_count:1,
        next_readiness_gate:'seasonal_service_orientation',pre_field_ready:false,is_archived:false
      }],
      onboarding_items:[
        {id:'i1',candidate_id:'c1',item_code:'WINTER_SNOW_OPERATIONS_ORIENTATION',item_name:'Winter snow clearing and snow removal orientation',item_category:'seasonal_service',item_status:'pending',is_required:true}
      ],
      onboarding_stage_events:[],
      onboarding_profiles:[{profile_id:'p1',full_name:'Sam Winter',employee_number:'E-339'}],
      onboarding_crews:[{crew_id:'crew1',crew_name:'Snow Crew'}],
      onboarding_training:[]
    };
    window.YWIAPI={
      loadAdminDirectory:async(req)=>{window.__hire339Calls.push({kind:'load',req:structuredClone(req)});return structuredClone(payload);},
      manageAdminEntity:async(req)=>{window.__hire339Calls.push({kind:'manage',req:structuredClone(req)});return {ok:true,record:{id:req.item_id||'new-id',...req}};}
    };
  });
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIHiringOnboardingUI.mount({api:window.YWIAPI}));
}

test('Build 339 renders four-season Ontario hiring readiness',async({page})=>{
  await boot(page);
  const panel=page.locator('#hiringOnboarding339');
  await expect(panel).toHaveAttribute('data-admin-hub-groups','people');
  await expect(panel.locator('[data-build="339"]')).toBeVisible();
  await expect(panel).toContainText('Four-season Ontario operating model');
  await expect(panel).toContainText('winter snow clearing/removal');
  await expect(page.locator('#hire339Pipeline')).toContainText('Sam Winter');
  await expect(page.locator('#hire339Selected')).toContainText('Winter snow clearing and snow removal orientation');
});

test('Build 339 creates candidates and updates onboarding evidence',async({page})=>{
  await boot(page);
  await page.fill('#hire339Name','Taylor Four Season');
  await page.fill('#hire339Position','Crew Member');
  await page.selectOption('#hire339Season','four_season');
  await page.selectOption('#hire339Crew','crew1');
  await page.click('#hire339Add');
  await expect.poll(async()=>page.evaluate(()=>window.__hire339Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(1);

  await page.selectOption('[data-status="i1"]','completed');
  await page.click('[data-save-item="i1"]');
  await expect.poll(async()=>page.evaluate(()=>window.__hire339Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(2);

  const calls=await page.evaluate(()=>window.__hire339Calls.filter((x)=>x.kind==='manage').map((x)=>x.req));
  expect(calls.some((x)=>x.entity==='hiring_candidate'&&x.action==='create'&&x.season_profile==='four_season'&&x.planned_crew_id==='crew1')).toBeTruthy();
  expect(calls.some((x)=>x.entity==='hiring_onboarding_item'&&x.action==='update'&&x.item_id==='i1'&&x.item_status==='completed')).toBeTruthy();
});

test('Build 339 links canonical employee profile instead of creating a duplicate employee authority',async({page})=>{
  await boot(page);
  await page.selectOption('#hire339Profile','p1');
  await page.click('#hire339LinkProfile');
  await expect.poll(async()=>page.evaluate(()=>window.__hire339Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(1);
  const calls=await page.evaluate(()=>window.__hire339Calls.filter((x)=>x.kind==='manage').map((x)=>x.req));
  expect(calls.some((x)=>x.entity==='hiring_candidate'&&x.action==='link_profile'&&x.item_id==='c1'&&x.profile_id==='p1')).toBeTruthy();
});
