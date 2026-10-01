import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'js/operations-cockpit.js'),'utf8');

async function boot(page){
  await page.setViewportSize({width:390,height:900});
  await page.setContent('<!doctype html><html><body><main><div id="fixture"></div></main></body></html>');
  await page.addScriptTag({content:source});
  await expect.poll(()=>page.evaluate(()=>Boolean(window.YWIOperationsAttentionTriage?.managementLearningCardHtml))).toBe(true);
}
const attention=()=>({
  source_key:'jobs:equipment_defect:eq-1',source_module:'jobs',source_type:'equipment_defect',source_id:'eq-1',
  title:'TRK-1 · LOCKED OUT',context:'Truck 1',priority:'critical',owner:'Unassigned',owner_state:'unassigned',
  due_at:'2026-09-28T12:00:00.000Z',due_state:'overdue',age_days:3,due_in_days:-3,triage_score:540,
  priority_reason:'CRITICAL source severity · owner unassigned',route_hint:'jobs',duplicate_count:1,
  source_authority:{read_authority:'v_equipment_scan_resolution_queue',mutation_authority:'Equipment lockout authority'},
  next_safe_action:{label:'Review equipment defect',instruction:'Review the canonical equipment lockout record.',authority_boundary:'Advisory only; source authority is unchanged.'}
});
const journal=()=>({
  id:'11111111-1111-4111-8111-111111111111',source_key:'jobs:equipment_defect:eq-1',source_module:'jobs',source_type:'equipment_defect',
  recommendation_key:'equipment_defect:next_safe_action',recommendation_label:'Review equipment defect',
  chosen_safe_action:'Review lockout evidence with the source workflow.',decision_at:'2026-10-01T12:00:00.000Z',
  source_status_at_review:'open',source_due_state_at_review:'overdue',outcome_status:'recurring',recurrence_signal:true,
  followup_due_at:'2026-10-02T12:00:00.000Z',followup_evidence:'Defect recurred after prior review.',outcome_note:'Recurring source condition.'
});

test('Build 363 adds record-decision control without replacing source actions',async({page})=>{
  await boot(page);
  await page.evaluate((row)=>document.getElementById('fixture').innerHTML=window.YWIOperationsAttentionTriage.attentionCardHtml(row,true,true),attention());
  const card=page.locator('.oc-attention-card');
  await expect(card.getByRole('button',{name:'Record decision'})).toBeVisible();
  await expect(card.getByRole('button',{name:'Defer'})).toBeVisible();
  await expect(card.getByRole('button',{name:'Resolve'})).toBeVisible();
  await expect(card).toContainText('Next safe action: Review equipment defect');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('Build 363 renders bounded outcome and recurrence evidence',async({page})=>{
  await boot(page);
  await page.evaluate((row)=>document.getElementById('fixture').innerHTML=window.YWIOperationsAttentionTriage.managementLearningCardHtml(row,true),journal());
  const card=page.locator('.oc-management-learning-card');
  await expect(card).toContainText('Review equipment defect');
  await expect(card).toContainText('Review lockout evidence with the source workflow.');
  await expect(card).toContainText('recurring');
  await expect(card).toContainText('Defect recurred after prior review.');
  await expect(card.getByRole('button',{name:'Update outcome'})).toBeVisible();
  await expect(card).toHaveAttribute('data-recurrence','true');
});

test('Build 363 keeps outcome mutation restricted when Admin manage is absent',async({page})=>{
  await boot(page);
  await page.evaluate((row)=>document.getElementById('fixture').innerHTML=window.YWIOperationsAttentionTriage.managementLearningCardHtml(row,false),journal());
  const card=page.locator('.oc-management-learning-card');
  await expect(card).toContainText('Outcome restricted');
  await expect(card.locator('[data-oc-action="management-outcome"]')).toHaveCount(0);
});
