import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'js/admin-timekeeping-ui.js'),'utf8');

async function boot(page){
  await page.setContent('<!doctype html><html><body><section id="admin"><div class="admin-hub-shell"></div></section></body></html>');
  await page.evaluate(()=>{
    window.__time337Calls=[];
    const payload={
      ok:true,
      timekeeping_summary:[{entry_count:2,open_shift_count:0,attendance_review_count:0,correction_pending_count:1,supervisor_approval_count:1,payroll_ready_count:1,recent_paid_minutes:900,recent_travel_minutes:60}],
      timekeeping_evidence:[
        {time_entry_id:'t1',profile_id:'p1',full_name:'Avery Lead',employee_number:'E-001',job_code:'JOB-1',job_name:'Mowing',clock_status:'signed_out',signed_in_at:'2026-09-21T12:00:00Z',signed_out_at:'2026-09-21T20:00:00Z',paid_minutes:450,break_minutes:30,travel_minutes:30,job_work_minutes:420,regular_hours:7.5,overtime_hours:0,pay_code:'regular',open_review_count:0,pending_correction_count:0,correction_version:1,supervisor_approval_status:'approved',supervisor_approved_by_name:'Morgan Admin',payroll_readiness_status:'ready',payroll_ready:true},
        {time_entry_id:'t2',profile_id:'p2',full_name:'Sam Crew',employee_number:'E-002',job_code:'JOB-2',job_name:'Cleanup',clock_status:'signed_out',signed_in_at:'2026-09-21T13:00:00Z',signed_out_at:'2026-09-21T21:00:00Z',paid_minutes:450,break_minutes:30,travel_minutes:30,job_work_minutes:420,regular_hours:7.5,overtime_hours:0,pay_code:'regular',open_review_count:0,pending_correction_count:1,correction_version:0,supervisor_approval_status:'pending',payroll_readiness_status:'correction_pending',payroll_ready:false}
      ],
      timekeeping_corrections:[{id:'c1',time_entry_id:'t2',full_name:'Sam Crew',employee_number:'E-002',job_code:'JOB-2',correction_status:'pending',correction_reason:'Missed punch',employee_explanation:'Clocked out late',requested_signed_in_at:'2026-09-21T13:00:00Z',requested_signed_out_at:'2026-09-21T20:30:00Z',requested_break_minutes:30,requested_travel_minutes:30}],
      attendance_review_queue:[],
      finance_boundary:{payroll_export_authority:'payroll_export_runs'}
    };
    window.YWIAPI={
      loadAdminDirectory:async(req)=>{window.__time337Calls.push({kind:'load',req:structuredClone(req)});return structuredClone(payload);},
      manageAdminEntity:async(req)=>{window.__time337Calls.push({kind:'manage',req:structuredClone(req)});return {ok:true,record:{id:req.item_id||'new-id',...req}};}
    };
  });
  await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWITimekeepingUI.mount({api:window.YWIAPI}));
}

test('Build 337 renders payroll readiness without duplicating Finance authority',async({page})=>{
  await boot(page);
  const panel=page.locator('#timekeepingAttendance337');
  await expect(panel).toHaveAttribute('data-admin-hub-groups','people');
  await expect(panel.locator('[data-build="337"]')).toBeVisible();
  await expect(panel).toContainText('Timekeeping, Attendance & Payroll Evidence');
  await expect(panel).toContainText('Finance keeps payroll-export generation, delivery and close controls');
  await expect(page.locator('#time337Summary')).toContainText('Payroll ready');
  await expect(page.locator('#time337EvidenceBody')).toContainText('Avery Lead');
  await expect(page.locator('#time337EvidenceBody')).toContainText('30m travel');
  await expect(page.locator('#time337EvidenceBody')).toContainText('correction pending');
});

test('Build 337 records corrections and explicit supervisor approval',async({page})=>{
  await boot(page);
  await page.selectOption('#time337Entry','t2');
  await page.fill('#time337Reason','Missed punch correction');
  await page.fill('#time337Explanation','I forgot to clock out at the end of the visit.');
  await page.fill('#time337Travel','25');
  await page.click('#time337RequestCorrection');
  await page.fill('#time337ApprovalNote','Reviewed against route and job evidence.');
  await page.click('#time337Approve');
  await page.click('[data-approve-correction="c1"]');

  const calls=await page.evaluate(()=>window.__time337Calls.filter((x)=>x.kind==='manage').map((x)=>x.req));
  expect(calls.some((x)=>x.entity==='timekeeping_correction'&&x.action==='create'&&x.time_entry_id==='t2'&&x.requested_travel_minutes===25)).toBeTruthy();
  expect(calls.some((x)=>x.entity==='timekeeping_approval'&&x.action==='approve'&&x.time_entry_id==='t2')).toBeTruthy();
  expect(calls.some((x)=>x.entity==='timekeeping_correction'&&x.action==='approve'&&x.item_id==='c1')).toBeTruthy();
});
