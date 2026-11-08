import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const cockpit=fs.readFileSync('js/operations-cockpit.js','utf8');
const css=fs.readFileSync('style.css','utf8');
const guard=fs.readFileSync('js/closeout-runtime-guard.js','utf8');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function mount(page,role='permitted') {
  await page.setViewportSize({width:390,height:820});
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><section id="admin"><div id="ad_stats_grid"></div></section></body></html>`);
  await page.evaluate(({id,role})=>{
    window.__decisions=[];window.__photoCalls=[];
    window.__queue={capabilities:{actor_rank:30,actions:{work_order_closeout_decision:{permitted:role==='permitted',reason:'Jobs approval denied'}}},closeouts:[{
      id,work_order_id:id,closeout_status:'submitted',work_order_number:'WO-548',client_name:'Rosevear Landscaping',
      customer_summary:'Landscaping visit completed; requested correction submitted.',submitted_at:'2026-11-08T13:00:00Z',
      approved_proof_count:1,submitted_proof_count:1,customer_signoff_required:true,customer_signoff_status:'not_requested',
      invoice_readiness_status:'blocked',before_count:0,after_count:0
    }]};
    window.YWIAPI={
      manageOperations:async(body)=>{
        if (body.action==='operations_queue_list') return {ok:true,queues:window.__queue};
        window.__decisions.push(body);return {ok:true};
      },
      mobileReworkPhoto:async(body)=>{
        window.__photoCalls.push(body);
        if (window.__denyPrivate) throw Error('The work order is assigned to another supervisor.');
        return {ok:true,staff_only:true,closeout:{id,status:'submitted',invoice_readiness_status:'blocked'},expires_in:300,
          baseline:[{id:'before-1',url:'https://example.test/secure-before.jpg',name:'Arrival before.jpg',proof_status:'approved',proof_title:'Arrival'}],
          corrections:[{id:'after-1',url:'https://example.test/secure-after.jpg',name:'Retake <script>.jpg',proof_status:'submitted',proof_title:'Crew rework correction'}],
          correction_proof:{id:'proof-548',status:'submitted',staff_notes:'Replaced missed edge trimming; awaiting supervisor approval.',created_at:'2026-11-08T14:00:00Z'}};
      }
    };
  },{id,role});
  await page.addScriptTag({content:guard});
  await page.addScriptTag({content:cockpit});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#oc_closeout_queue')).toContainText('WO-548');
}

test('YW 548 supervisor compares private evidence on mobile without changing a closeout',async({page})=>{
  await mount(page);
  await page.getByRole('button',{name:'Compare correction photos'}).click();
  await expect(page.locator('.oc-closeout-photo-pair img')).toHaveCount(2);
  await expect(page.locator('.oc-closeout-photo-review')).toContainText('Earlier visit evidence');
  await expect(page.locator('.oc-closeout-photo-review')).toContainText('Latest correction evidence');
  await expect(page.locator('.oc-closeout-photo-review')).toContainText('resubmitted and awaits a new human supervisor decision');
  await expect(page.locator('.oc-closeout-photo-review')).toContainText('Customer signoff and invoice readiness remain separate');
  expect(await page.locator('.oc-closeout-photo-review').innerHTML()).toContain('Retake &lt;script&gt;.jpg');
  expect(await page.evaluate(()=>window.__photoCalls)).toEqual([{action:'supervisor_review',closeout_package_id:id}]);
  expect(await page.evaluate(()=>window.__decisions)).toEqual([]);
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Hide photo comparison'}).click();
  await expect(page.locator('.oc-closeout-photo-review')).toHaveCount(0);
});

test('YW 548 respects denied supervisor capability and failed private photo reads',async({page})=>{
  await mount(page,'denied');
  await expect(page.getByRole('button',{name:/Compare correction photos/})).toBeDisabled();
  expect(await page.evaluate(()=>window.__photoCalls)).toEqual([]);
  await page.evaluate(()=>{window.__queue.capabilities.actions.work_order_closeout_decision.permitted=true;window.__denyPrivate=true;});
  await page.locator('#oc_refresh').click();
  await page.getByRole('button',{name:'Compare correction photos'}).click();
  await expect(page.locator('.oc-closeout-photo-review')).toContainText('assigned to another supervisor');
  await expect(page.locator('.oc-closeout-photo-review img')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__decisions)).toEqual([]);
});
