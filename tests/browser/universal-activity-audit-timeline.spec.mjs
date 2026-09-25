import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.join(process.cwd(),'js/admin-universal-activity-audit-timeline-ui.js'),'utf8');
async function boot(page){
  await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
  await page.evaluate(()=>{
    window.__activity347=[];
    const payload={ok:true,source_visibility:{jobs:true,safety:true,finance:false,admin:false},activity_timeline:[
      {event_id:'1',occurred_at:'2026-09-25T11:10:00Z',actor_label:'Supervisor',source_module:'jobs',entity_group:'job_visit',source_entity_type:'work_order',entity_id:'job-1',action_key:'quality_control_review',activity_kind:'approved',event_status:'captured',activity_label:'Quality Control Review',evidence_reference:'jobs.quality_control.reviewed'},
      {event_id:'2',occurred_at:'2026-09-25T10:10:00Z',actor_label:'HSE Lead',source_module:'safety',entity_group:'safety',source_entity_type:'equipment_inspection',entity_id:'eq-2',action_key:'equipment_inspection_save',activity_kind:'inspected',event_status:'captured',activity_label:'Equipment Inspection Save',evidence_reference:'safety.equipment.inspected'}
    ]};
    window.YWIAPI={loadAdminDirectory:async(q)=>{window.__activity347.push(q);return structuredClone(payload);}};
  });
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIUniversalActivityTimelineUI.mount({api:window.YWIAPI}));
}
test('Build 347 renders permission-aware read-only evidence',async({page})=>{
  await boot(page);
  const panel=page.locator('#universalActivityAudit347');
  await expect(panel).toHaveAttribute('data-admin-hub-groups','operations');
  await expect(panel).toContainText('Permission-aware');
  await expect(panel).toContainText('Read-only authority boundary');
  await expect(panel).toContainText('Quality Control Review');
  await expect(panel).toContainText('Equipment Inspection Save');
  expect(await page.evaluate(()=>window.__activity347)).toEqual([{scope:'activity_timeline',limit:500}]);
});
test('Build 347 filters without write APIs',async({page})=>{
  await boot(page);
  await page.selectOption('#activity347Module','safety');
  await expect(page.locator('#activity347Rows')).toContainText('Equipment Inspection Save');
  await expect(page.locator('#activity347Rows')).not.toContainText('Quality Control Review');
  await page.selectOption('#activity347Module',''); await page.selectOption('#activity347Group','job_visit');
  await expect(page.locator('#activity347Rows')).toContainText('Quality Control Review');
  await page.fill('#activity347Search','no-match');
  await expect(page.locator('#activity347Rows')).toContainText('No visible timeline events match');
  expect(await page.evaluate(()=>typeof window.YWIAPI.manageOperations)).toBe('undefined');
});
