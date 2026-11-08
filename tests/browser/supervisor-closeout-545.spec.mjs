import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const cockpit = fs.readFileSync('js/operations-cockpit.js', 'utf8');
const closeoutGuard = fs.readFileSync('js/closeout-runtime-guard.js', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');

async function mount(page, width = 390) {
  await page.setViewportSize({ width, height: 850 });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><section id="admin"><div id="ad_stats_grid"></div></section></body></html>`);
  await page.evaluate(() => {
    const row = (id, state, proof = 1) => ({
      id, work_order_id:id, work_order_number:`WO-${id.slice(0,4)}`, client_name:'Rosevear Landscaping Test',
      closeout_status:state, customer_signoff_required:true, customer_signoff_status:'not_requested',
      invoice_readiness_status:'blocked', approved_proof_count:proof, submitted_proof_count:0,
      before_count:0, after_count:0, margin_amount:35, margin_percent:15,
      customer_summary:'The lawn and beds were serviced per the approved scope.',
      submitted_by_name:'Crew Lead', submitted_at:'2026-11-08T08:00:00Z',
      closeout_message:'Supervisor decision remains required.'
    });
    window.__ids = {
      a:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      b:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      c:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      d:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    };
    window.__calls = [];
    window.__state = new Proxy({
      capabilities:{ actor_role:'supervisor', actor_rank:30, actions:{
        work_order_closeout_decision:{ permitted:true, reason:'' },
        work_order_closeout_submit:{ permitted:true, reason:'' }
      }},
      closeouts:[
        row(window.__ids.a,'submitted',1),
        row(window.__ids.b,'submitted',0),
        {...row(window.__ids.c,'rework_required'),rejection_reason:'<img src=x onerror=alert(1)> Fix the evidence.'},
        {...row(window.__ids.d,'approved'),customer_signoff_status:'requested',invoice_readiness_status:'waiting_customer_signoff'}
      ]
    }, { get(target, key) { return key in target ? target[key] : []; } });
    window.YWIAPI = {
      manageOperations:async (payload) => {
        window.__calls.push(JSON.parse(JSON.stringify(payload)));
        if (payload.action === 'operations_queue_list') return {ok:true,queues:window.__state};
        if (payload.action === 'work_order_closeout_decision') {
          if (window.__denyDecision) throw new Error('Server denied this closeout decision.');
          const row = window.__state.closeouts.find((item) => item.id === payload.closeout_package_id);
          if (row && payload.decision === 'rework') {
            row.closeout_status = 'rework_required'; row.rejection_reason = payload.decision_note;
          }
          return {ok:true};
        }
        return {ok:true};
      },
      escHtml:(value)=>String(value ?? '')
    };
  });
  await page.addScriptTag({ content:closeoutGuard });
  await page.addScriptTag({ content:cockpit });
  await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#oc_closeout_review_summary')).toContainText('2 awaiting supervisor decision');
}

test('YW 545 review queue filters canonical statuses and keeps rework guidance staff-only on narrow screens', async ({ page }) => {
  await mount(page, 390);
  await expect(page.locator('#oc_closeout_queue .oc-closeout-card')).toHaveCount(4);
  await expect(page.locator('#oc_closeout_review_summary')).toContainText('1 rework / rejected');
  await expect(page.locator('#oc_closeout_review_summary')).toContainText('1 waiting on customer');
  await expect(page.locator('#oc_closeout_queue [data-review-kind="block"]')).toContainText('No approved execution proof');
  await expect(page.locator('#oc_closeout_queue [data-review-kind="advisory"]').first()).toContainText('optional');
  await expect(page.locator('#oc_closeout_queue [data-oc-action="closeout-approve"]')).toHaveCount(1);
  await expect(page.locator('#oc_closeout_queue img')).toHaveCount(0);
  await expect(page.locator('#oc_closeout_queue')).toContainText('<img src=x onerror=alert(1)>');
  expect(await page.locator('#oc_closeout_queue').innerHTML()).toContain('&lt;img src=x onerror=alert(1)&gt;');

  await page.locator('#oc_closeout_filter').selectOption('rework');
  await expect(page.locator('#oc_closeout_queue .oc-closeout-card')).toHaveCount(1);
  await expect(page.locator('#oc_closeout_result_count')).toHaveText('1 of 4 closeout packages');
  await page.locator('#oc_closeout_filter').selectOption('all');
  await page.locator('#oc_closeout_search').fill('WO-aaaa');
  await expect(page.locator('#oc_closeout_queue .oc-closeout-card')).toHaveCount(1);
  await expect(page.locator('#oc_closeout_queue')).toContainText('WO-aaaa');
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.locator('#oc_closeout_queue [data-oc-action="closeout-invoice"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__calls.filter((x) => x.action !== 'operations_queue_list'))).toEqual([]);
});

test('YW 545 rework guidance requires an authorized human-confirmed canonical decision; cancellation does not write', async ({ page }) => {
  await mount(page, 430);
  const card = page.locator('#oc_closeout_queue .oc-closeout-card').filter({hasText:'WO-aaaa'});
  await card.getByRole('button', {name:'Guide crew rework'}).click();
  const form = card.locator('[data-oc-closeout-rework-form]');
  await expect(form).toBeVisible();
  expect(await page.evaluate(() => window.__calls.filter((x) => x.action === 'work_order_closeout_decision'))).toEqual([]);
  await form.getByRole('button', {name:'Cancel'}).click();
  await expect(form).toHaveCount(0);
  await card.getByRole('button', {name:'Guide crew rework'}).click();
  await card.locator('[name="issue_category"]').selectOption('missing_proof');
  await card.locator('[name="crew_instructions"]').fill('Check the site photos, retake the completion proof, and resubmit the visit.');
  page.once('dialog', (dialog) => dialog.dismiss());
  await card.getByRole('button', {name:'Record rework decision'}).click();
  expect(await page.evaluate(() => window.__calls.filter((x) => x.action === 'work_order_closeout_decision'))).toEqual([]);
  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', {name:'Record rework decision'}).click();
  await expect.poll(async () => page.evaluate(() => window.__calls.filter((x) => x.action === 'work_order_closeout_decision').length)).toBe(1);
  const payload = await page.evaluate(() => window.__calls.find((x) => x.action === 'work_order_closeout_decision'));
  expect(payload).toMatchObject({
    closeout_package_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', decision:'rework',
    decision_note:'Rework category: Missing or unapproved proof. Crew correction instructions: Check the site photos, retake the completion proof, and resubmit the visit.'
  });
  await expect(page.locator('#oc_closeout_queue')).toContainText('Existing crew rework / rejection guidance');
  const writes = await page.evaluate(() => window.__calls.filter((x) => x.action !== 'operations_queue_list'));
  expect(writes).toHaveLength(1);
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('YW 545 fail-closed permission and denied-server decisions never record rework as approved', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => { window.__state.capabilities.actions.work_order_closeout_decision = {permitted:false,reason:'Supervisor authorization missing'}; });
  await page.locator('#oc_refresh').click();
  await expect(page.locator('[data-oc-action="closeout-rework"]').first()).toBeDisabled();
  expect(await page.evaluate(() => window.__calls.filter((x) => x.action === 'work_order_closeout_decision'))).toEqual([]);
  await page.evaluate(() => { window.__state.capabilities.actions.work_order_closeout_decision = {permitted:true}; window.__denyDecision=true; });
  await page.locator('#oc_refresh').click();
  const card = page.locator('#oc_closeout_queue .oc-closeout-card').filter({hasText:'WO-aaaa'});
  await card.getByRole('button', {name:'Guide crew rework'}).click();
  await card.locator('[name="issue_category"]').selectOption('quality');
  await card.locator('[name="crew_instructions"]').fill('Reinspect all edge trimming and correct missed work before resubmission.');
  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', {name:'Record rework decision'}).click();
  await expect(page.locator('#oc_status')).toContainText('Server denied this closeout decision');
  await expect(card.locator('[data-oc-closeout-rework-form]')).toBeVisible();
  await expect(card.getByRole('button', {name:'Record rework decision'})).toBeEnabled();
  expect(await page.evaluate(() => window.__state.closeouts[0].closeout_status)).toBe('submitted');
  await expect(page.locator('#oc_retry_wrap')).toBeHidden();
});
