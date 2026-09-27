import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'js/operations-cockpit.js'),'utf8');

async function boot(page){
  await page.setContent('<!doctype html><html><body><div id="triage"></div></body></html>');
  await page.addScriptTag({content:source});
  await expect.poll(()=>page.evaluate(()=>Boolean(window.YWIOperationsAttentionTriage?.attentionCardHtml))).toBe(true);
}

const fixture=()=>({
  source_key:'jobs:equipment_defect:eq-1',
  source_module:'jobs',
  source_type:'equipment_defect',
  source_id:'eq-1',
  title:'TRK-1 · LOCKED OUT',
  context:'Truck 1',
  priority:'critical',
  owner:'Unassigned',
  owner_state:'unassigned',
  due_at:'2026-08-28T12:00:00.000Z',
  due_state:'overdue',
  age_days:30,
  due_in_days:-30,
  triage_score:585,
  priority_reason:'CRITICAL source severity · 30 day(s) past due · owner unassigned',
  route_hint:'jobs',
  duplicate_count:2,
  source_authority:{
    module:'jobs',
    record_type:'equipment_defect',
    read_authority:'v_equipment_scan_resolution_queue',
    mutation_authority:'Equipment inspection / lockout authority'
  },
  next_safe_action:{
    kind:'navigate',
    label:'Review equipment defect',
    route_hint:'jobs',
    instruction:'Open Equipment and review the inspection / lockout record. This triage layer cannot unlock equipment.',
    authority_boundary:'Advisory navigation/preparation only; no source business record or provider state is changed.'
  }
});

test('Build 352 renders explainable deterministic triage and advisory next-safe-action',async({page})=>{
  await boot(page);
  await page.evaluate((row)=>{
    document.getElementById('triage').innerHTML=window.YWIOperationsAttentionTriage.attentionCardHtml(row,true,true);
  },fixture());
  const card=page.locator('.oc-attention-card');
  await expect(card).toContainText('score 585');
  await expect(card).toContainText('Why this priority');
  await expect(card).toContainText('30 day(s) past due');
  await expect(card).toContainText('owner unassigned');
  await expect(card).toContainText('v_equipment_scan_resolution_queue');
  await expect(card).toContainText('Equipment inspection / lockout authority');
  await expect(card).toContainText('Next safe action: Review equipment defect');
  await expect(card).toContainText('cannot unlock equipment');
  await expect(card).toContainText('2 duplicate source candidates collapsed');
  await expect(card.locator('[data-oc-action="attention-open"]')).toHaveCount(1);
  await expect(card.locator('[data-oc-action="attention-defer"]')).toHaveCount(1);
  await expect(card.locator('[data-oc-action="attention-resolve"]')).toHaveCount(1);
});

test('Build 352 preserves permission boundaries while still explaining the safe action',async({page})=>{
  await boot(page);
  await page.evaluate((row)=>{
    document.getElementById('triage').innerHTML=window.YWIOperationsAttentionTriage.attentionCardHtml(row,false,false);
  },fixture());
  const card=page.locator('.oc-attention-card');
  await expect(card).toContainText('Source restricted');
  await expect(card).toContainText('Manage restricted');
  await expect(card).toContainText('Advisory navigation/preparation only');
  await expect(card.locator('[data-oc-action="attention-open"]')).toHaveCount(0);
  await expect(card.locator('[data-oc-action="attention-defer"]')).toHaveCount(0);
  await expect(card.locator('[data-oc-action="attention-resolve"]')).toHaveCount(0);
});
