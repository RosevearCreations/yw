import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const cockpitSource=fs.readFileSync(path.join(process.cwd(),'js/operations-cockpit.js'),'utf8');

async function mount(page){
  await page.route('https://recon315.test/**',async(route)=>{
    await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><section id="admin"><div id="ad_stats_grid"></div></section></body></html>'});
  });
  await page.goto('https://recon315.test/');
  await page.evaluate(()=>{
    window.__recon315Calls=[];
    const clone=(value)=>JSON.parse(JSON.stringify(value));
    const item={
      id:'10000000-0000-4000-8000-000000000315',
      reconciliation_session_id:'20000000-0000-4000-8000-000000000315',
      item_date:'2026-08-01',
      item_description:'Bank deposit differs from invoice total',
      amount:1450,
      match_status:'exception',
      clearing_status:'open',
      difference_reason:'Amount mismatch needs supporting invoice.',
      manual_review_status:'exception',
      reviewed_by_profile_id:'30000000-0000-4000-8000-000000000315',
      reviewed_at:'2026-09-18T12:00:00Z',
      review_notes:'{}',
      created_at:'2026-08-01T12:00:00Z'
    };
    const exception={
      ...item,
      exception_severity:'high',
      exception_category:'amount_mismatch',
      owner_profile_id:'30000000-0000-4000-8000-000000000315',
      owner_name:'Finance Reviewer',
      age_days:48,
      evidence_reference:'Bank statement line 81 + invoice INV-315',
      resolution_reason:null,
      resolution_status:'open',
      material:true,
      finance_readiness_blocker:true,
      month_end_close_blocker:true
    };
    window.YWIAPI={
      async manageOperations(payload){
        window.__recon315Calls.push(clone(payload));
        if(payload.action==='operations_queue_list'){
          return {ok:true,build:'315',queues:{
            bank_items:[clone(item)],reconciliation_exceptions:[clone(exception)],reconciliation:[],payments:[],bank_imports:[],
            equipment:[],equipment_service:[],assets:[],routes:[],quotes:[],portal:[],job_costs:[],job_updates:[],
            customer_notifications:[],execution_proofs:[],execution_costs:[],closeouts:[],
            profiles:[{id:'30000000-0000-4000-8000-000000000315',full_name:'Finance Reviewer',email:'finance@example.invalid',role:'admin'}],
            banks:[],rails:[],content_signals:[],webhook_alerts:[],staging_tests:[],
            capabilities:{actions:{reconciliation_action:{permitted:true,label:'Reconciliation approval'}}}
          }};
        }
        if(payload.action==='reconciliation_action'){
          return {ok:true,build:315,record:clone(item),posting_execution_authorized:false,provider_mutation:false};
        }
        throw new Error('Unexpected action '+payload.action);
      }
    };
  });
  await page.addScriptTag({content:cockpitSource});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#operationsCockpit')).toBeVisible();
  const panel=page.locator('#operationsCockpit details').filter({hasText:'Smart Reconciliation Workbench'}).first();
  await panel.locator(':scope > summary').click();
  await expect(page.locator('#oc_recon_exception_form')).toBeVisible();
}

test('Build 315 exposes owned material reconciliation blockers to Finance readiness and month-end close',async({page})=>{
  await mount(page);
  const queue=page.locator('#oc_recon_exception_queue');
  await expect(queue).toContainText('1 material unresolved exception(s)');
  await expect(queue).toContainText('Finance Reviewer');
  await expect(queue).toContainText('amount mismatch');
  await expect(queue).toContainText('48 day(s)');
  await expect(queue).toContainText('Bank statement line 81 + invoice INV-315');
  await expect(queue).toContainText('BLOCKS Finance readiness / month-end close');
  await expect(page.getByRole('button',{name:/execute posting/i})).toHaveCount(0);
});

test('Build 315 resolves an exception only through explicit human evidence and reason',async({page})=>{
  await mount(page);
  await page.locator('[data-oc-action="recon-exception-resolve"]').click();
  const form=page.locator('#oc_recon_exception_form');
  await expect(form.locator('[name="bank_row_id"]')).toHaveValue('10000000-0000-4000-8000-000000000315');
  await expect(form.locator('[name="exception_severity"]')).toHaveValue('high');
  await expect(form.locator('[name="exception_category"]')).toHaveValue('amount_mismatch');
  await expect(form.locator('[name="owner_profile_id"]')).toHaveValue('30000000-0000-4000-8000-000000000315');
  await expect(form.locator('[name="resolution_status"]')).toHaveValue('resolved');
  await form.locator('[name="resolution_reason"]').fill('Invoice support confirms a timing-related amount correction.');
  await form.locator('button[type="submit"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__recon315Calls.filter((call)=>call.action==='reconciliation_action'&&call.action_type==='exception_resolve').length)).toBe(1);
  const call=await page.evaluate(()=>window.__recon315Calls.find((entry)=>entry.action==='reconciliation_action'&&entry.action_type==='exception_resolve'));
  expect(call.exception_severity).toBe('high');
  expect(call.exception_category).toBe('amount_mismatch');
  expect(call.owner_profile_id).toBe('30000000-0000-4000-8000-000000000315');
  expect(call.evidence_reference).toContain('Bank statement line 81');
  expect(call.resolution_reason).toContain('Invoice support confirms');
  expect(call).not.toHaveProperty('posting_authorized');
  expect(call).not.toHaveProperty('provider_mutation');
  const calls=await page.evaluate(()=>window.__recon315Calls);
  expect(calls.some((entry)=>/execute_posting|provider_mutation/i.test(String(entry.action||'')))).toBe(false);
});
