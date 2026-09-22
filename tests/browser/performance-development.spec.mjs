import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'js/admin-performance-development-ui.js'),'utf8');

async function boot(page){
  await page.setContent('<!doctype html><html><body><section id="admin"><div class="admin-hub-shell"></div><details id="timekeepingAttendance337"></details></section></body></html>');
  await page.evaluate(()=>{
    window.__perf338Calls=[];
    const payload={
      ok:true,
      performance_overview:[{profile_id:'p1',full_name:'Avery Lead',employee_number:'E-001',role:'supervisor',coaching_record_count:2,recognition_count:1,open_development_plan_count:1,review_count:1,open_improvement_action_count:1,attendance_review_count:1}],
      performance_expectations:[{id:'e1',role_key:'supervisor',expectation_area:'quality',expectation_title:'Quality checks',expectation_text:'Verify service quality before closeout.'}],
      performance_coaching:[{id:'c1',profile_id:'p1',record_type:'recognition',topic:'Customer care',summary:'Handled a difficult callback well.',observed_on:'2026-09-20',follow_up_date:'2026-10-01',record_status:'open'}],
      performance_development_plans:[{id:'d1',profile_id:'p1',plan_title:'Crew leadership',goal_text:'Lead morning dispatch confidently.',target_date:'2026-11-01',plan_status:'active'}],
      performance_reviews:[{id:'r1',profile_id:'p1',review_status:'draft',summary:'Quarterly review draft',review_period_start:'2026-07-01',review_period_end:'2026-09-30',follow_up_date:'2026-10-15'}],
      performance_improvement_actions:[{id:'a1',profile_id:'p1',action_status:'open',action_text:'Close route notes same day.',due_date:'2026-10-05',follow_up_date:'2026-10-07'}],
      performance_skills:[{id:'s1',skill_code:'CREW_LEAD',skill_name:'Crew leadership'}],
      training_readiness:[]
    };
    window.YWIAPI={
      loadAdminDirectory:async(req)=>{window.__perf338Calls.push({kind:'load',req:structuredClone(req)});return structuredClone(payload);},
      manageAdminEntity:async(req)=>{window.__perf338Calls.push({kind:'manage',req:structuredClone(req)});return {ok:true,record:{id:req.item_id||'new-id',...req}};}
    };
  });
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIPerformanceDevelopmentUI.mount({api:window.YWIAPI}));
}

test('Build 338 renders development evidence with Safety separation',async({page})=>{
  await boot(page);
  const panel=page.locator('#performanceDevelopment338');
  await expect(panel).toHaveAttribute('data-admin-hub-groups','people');
  await expect(panel.locator('[data-build="338"]')).toBeVisible();
  await expect(panel).toContainText('Performance & Development');
  await expect(panel).toContainText('Safety incident and near-miss truth stays in Safety');
  await expect(page.locator('#perf338Summary')).toContainText('Attendance reviews (90d)');
  await expect(page.locator('#perf338Expectations')).toContainText('Quality checks');
  await expect(page.locator('#perf338Record')).toContainText('Crew leadership');
});

test('Build 338 records coaching, plans, reviews and improvement actions',async({page})=>{
  await boot(page);
  await page.fill('#perf338CoachingTopic','Route closeout');
  await page.fill('#perf338CoachingSummary','Reviewed same-day note expectations.');
  await page.click('#perf338AddCoaching');
  await expect.poll(async()=>page.evaluate(()=>window.__perf338Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(1);

  await page.fill('#perf338PlanTitle','Advanced crew leadership');
  await page.fill('#perf338PlanGoal','Lead two complex routes.');
  await page.selectOption('#perf338PlanSkill','s1');
  await page.click('#perf338AddPlan');
  await expect.poll(async()=>page.evaluate(()=>window.__perf338Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(2);

  await page.fill('#perf338ReviewSummary','Documented review');
  await page.click('#perf338AddReview');
  await expect.poll(async()=>page.evaluate(()=>window.__perf338Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(3);

  await page.fill('#perf338ActionText','Complete route notes before clock-out.');
  await page.click('#perf338AddAction');
  await expect.poll(async()=>page.evaluate(()=>window.__perf338Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(4);

  await page.click('[data-complete-plan="d1"]');
  await expect.poll(async()=>page.evaluate(()=>window.__perf338Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(5);
  await page.click('[data-complete-review="r1"]');
  await expect.poll(async()=>page.evaluate(()=>window.__perf338Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(6);
  await page.click('[data-complete-action="a1"]');
  await expect.poll(async()=>page.evaluate(()=>window.__perf338Calls.filter((x)=>x.kind==='manage').length)).toBeGreaterThanOrEqual(7);

  const calls=await page.evaluate(()=>window.__perf338Calls.filter((x)=>x.kind==='manage').map((x)=>x.req));
  expect(calls.some((x)=>x.entity==='performance_coaching'&&x.action==='create'&&x.profile_id==='p1')).toBeTruthy();
  expect(calls.some((x)=>x.entity==='performance_development_plan'&&x.action==='create'&&x.skill_id==='s1')).toBeTruthy();
  expect(calls.some((x)=>x.entity==='performance_review'&&x.action==='create')).toBeTruthy();
  expect(calls.some((x)=>x.entity==='performance_improvement_action'&&x.action==='create')).toBeTruthy();
  expect(calls.some((x)=>x.entity==='performance_development_plan'&&x.action==='complete'&&x.item_id==='d1')).toBeTruthy();
  expect(calls.some((x)=>x.entity==='performance_review'&&x.action==='complete'&&x.item_id==='r1')).toBeTruthy();
  expect(calls.some((x)=>x.entity==='performance_improvement_action'&&x.action==='complete'&&x.item_id==='a1')).toBeTruthy();
});
