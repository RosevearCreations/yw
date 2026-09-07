import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');
const cockpitRuntime = fs.readFileSync('js/operations-cockpit.js', 'utf8');
const proofGuardRuntime = fs.readFileSync('js/execution-proof-runtime-guard.js', 'utf8');

async function mountStaff(page, { width = 390, height = 844 } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>
    *{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}.fixture-shell{max-width:1180px;margin:0 auto;padding:12px}.fixture-lifecycle{display:grid;gap:12px}.fixture-step{min-width:0;padding:14px;border:1px solid rgba(148,163,184,.22);border-radius:14px}.fixture-actions{display:flex;gap:8px;flex-wrap:wrap}.fixture-actions button{min-height:44px}.fixture-private{padding:10px;border-radius:10px;background:rgba(148,163,184,.08)}
    @media(min-width:900px){.fixture-lifecycle{grid-template-columns:repeat(3,minmax(0,1fr))}}
  </style></head><body><main class="fixture-shell"><section id="operationsCockpit" class="operations-cockpit">
    <header><h1>Job lifecycle</h1><p>Field update → execution proof → supervisor closeout.</p></header>
    <div class="fixture-lifecycle">
      <article class="oc-live-update-card fixture-step" data-lifecycle-step="update"><h2>1. Live update</h2><p>Record a staff-only or customer-visible service update. Customer-visible updates require approved public media.</p><div class="fixture-actions"><button class="secondary">Staff note</button><button class="primary">Customer update</button></div></article>
      <article class="oc-execution-proof-card fixture-step" data-lifecycle-step="proof"><h2>2. Execution proof</h2><p>Capture arrival/completion proof and internal labour, material and equipment context for supervisor review.</p><div class="fixture-actions"><button class="primary">Capture proof</button><button class="secondary">Supervisor review</button></div></article>
      <article class="oc-closeout-card fixture-step" data-lifecycle-step="closeout"><h2>3. Closeout</h2><p>Approve customer-safe summary, obtain customer signoff, then permit invoice readiness and follow-up.</p><div class="fixture-actions"><button class="primary">Approve closeout</button><button class="secondary">Invoice readiness</button></div></article>
    </div>
    <aside class="fixture-private" data-internal-cost-context><strong>Internal staff context</strong><p>Labour $180 • Materials $75 • Equipment $40 • Margin review pending</p></aside>
  </section></main></body></html>`);
}

async function mountCustomer(page, { width = 390, height = 844 } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>
    *{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}.fixture-shell{max-width:900px;margin:0 auto;padding:12px}.fixture-card{min-width:0;margin:0 0 12px;padding:14px;border:1px solid rgba(148,163,184,.22);border-radius:14px}.fixture-card button{min-height:44px}
  </style></head><body><main class="fixture-shell"><h1>Your service progress</h1>
    <section class="customer-portal-updates fixture-card"><h2>Live service updates</h2><article class="customer-portal-update"><strong>Crew arrived</strong><p>Your service is underway. Approved customer-visible photo evidence may appear here.</p></article></section>
    <section class="customer-portal-proofs fixture-card"><h2>Service proof</h2><article><strong>Completion proof approved</strong><p>Customer-safe before/after evidence is ready for review.</p></article></section>
    <section class="customer-portal-closeout fixture-card"><h2>Closeout</h2><p>Please review the completed-work summary and approved gallery.</p><form class="customer-portal-closeout-form"><button class="primary" type="button">Approve completed work</button><button class="secondary" type="button">Request follow-up</button></form></section>
  </main></body></html>`);
}

async function mountActualExecutionProofCockpit(page) {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main><section id="admin"><div id="ad_stats_grid"></div></section></main></body></html>`);
  await page.evaluate(() => {
    const workOrderId = '11111111-1111-4111-8111-111111111111';
    const assetId = '22222222-2222-4222-8222-222222222222';
    const proofId = '33333333-3333-4333-8333-333333333333';
    window.__opsCalls = [];
    const queueState = new Proxy({
      capabilities:{ actions:{
        work_order_execution_proof_submit:{ permitted:true, reason:'' },
        work_order_execution_proof_decision:{ permitted:true, reason:'' }
      }},
      portal:[{ work_order_id:workOrderId, work_order_number:'WO-STAGING-253', client_name:'Staging Customer' }],
      assets:[{ id:assetId, asset_status:'approved', public_url:'https://example.test/approved-proof.jpg', asset_key:'staging-proof', image_role:'service_proof' }],
      execution_proofs:[{
        id:proofId, work_order_id:workOrderId, work_order_number:'WO-STAGING-253', client_name:'Staging Customer',
        proof_type:'arrival', title:'Arrival proof awaiting review', proof_status:'submitted', occurred_at:'2026-09-07T14:00:00Z',
        customer_visible:true, total_cost:111.00, labour_cost_total:63.75, material_cost_total:25.25,
        equipment_cost_total:17.00, other_cost_total:5.00, approved_public_asset_count:1, attached_asset_count:1,
        cost_status:'proof_pending', staff_notes:'Internal staging-only cost context.'
      }],
      execution_costs:[{
        work_order_id:workOrderId, work_order_number:'WO-STAGING-253', client_name:'Staging Customer', cost_status:'review',
        accepted_estimate_total:500, total_actual_cost:111, margin_amount:389, margin_percent:77.8,
        approved_proof_count:0, submitted_proof_count:1
      }],
      banks:[], rails:[], payments:[], bank_imports:[], bank_items:[], reconciliation:[], equipment:[], equipment_scans:[],
      routes:[], quotes:[], live_updates:[], closeouts:[], customer_notifications:[], webhook_alerts:[], content_signals:[]
    }, { get(target, prop) { return prop in target ? target[prop] : []; } });
    window.YWIAPI = {
      manageOperations: async (payload) => {
        window.__opsCalls.push(JSON.parse(JSON.stringify(payload)));
        if (payload?.action === 'operations_queue_list') return { ok:true, build:'build253-runtime-fixture', queues:queueState };
        if (payload?.action === 'work_order_execution_proof_submit') return { ok:true, proof:{ id:proofId, ...payload } };
        if (payload?.action === 'work_order_execution_proof_decision') return { ok:true, proof:{ id:proofId, proof_status:payload.decision === 'approve' ? 'approved' : 'rejected' } };
        return { ok:true };
      },
      escHtml:(value)=>String(value ?? '')
    };
  });
  await page.addScriptTag({ content: proofGuardRuntime });
  await page.addScriptTag({ content: cockpitRuntime });
  await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#oc_execution_proof_form')).toBeVisible();
  await expect(page.locator('[data-oc-work-order-select] option')).toHaveCount(2);
}

for (const viewport of [{name:'phone-390',width:390,height:844},{name:'phone-430',width:430,height:932}]) {
  test(`${viewport.name} staff lifecycle keeps the three execution stages usable`, async ({ page }) => {
    await mountStaff(page, viewport);
    await expect(page.locator('[data-lifecycle-step]')).toHaveCount(3);
    await expect(page.getByText('1. Live update')).toBeVisible();
    await expect(page.getByText('2. Execution proof')).toBeVisible();
    await expect(page.getByText('3. Closeout')).toBeVisible();
    const heights = await page.locator('.fixture-actions button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('desktop lifecycle presents update proof closeout together without losing internal review context', async ({ page }) => {
  await mountStaff(page, { width:1440, height:960 });
  const steps = page.locator('[data-lifecycle-step]');
  await expect(steps).toHaveCount(3);
  const boxes = await steps.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
  expect(Math.max(...boxes.map((box) => box.top)) - Math.min(...boxes.map((box) => box.top))).toBeLessThan(8);
  await expect(page.locator('[data-internal-cost-context]')).toContainText(/Labour.*Materials.*Equipment.*Margin/i);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('customer portal lifecycle remains customer-safe on phone', async ({ page }) => {
  await mountCustomer(page, { width:390, height:844 });
  await expect(page.locator('.customer-portal-updates')).toBeVisible();
  await expect(page.locator('.customer-portal-proofs')).toBeVisible();
  await expect(page.locator('.customer-portal-closeout')).toBeVisible();
  await expect(page.getByRole('button', { name:'Approve completed work' })).toBeVisible();
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const forbidden of ['labour $','material $','equipment $','margin $','staff note','private review']) {
    expect(body).not.toContain(forbidden);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('real Operations Cockpit execution-proof runtime blocks unsafe capture and sends representative costing only after valid preflight', async ({ page }) => {
  await mountActualExecutionProofCockpit(page);
  const form = page.locator('#oc_execution_proof_form');
  await form.locator('[name="work_order_id"]').selectOption('11111111-1111-4111-8111-111111111111');
  await form.locator('[name="proof_type"]').selectOption('arrival');
  await form.locator('[name="title"]').fill('Arrival walkaround captured');
  await form.locator('[name="customer_visible"]').check();

  await form.evaluate((node) => node.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })));
  await expect(page.locator('#oc_status')).toContainText('Customer-visible execution proof requires a customer-safe summary.');
  let submits = await page.evaluate(() => window.__opsCalls.filter((row) => row.action === 'work_order_execution_proof_submit'));
  expect(submits).toHaveLength(0);

  await form.locator('[name="customer_summary"]').fill('Crew arrived and completed the customer-safe walkaround.');
  await form.locator('[name="labour_minutes"]').fill('-5');
  await form.evaluate((node) => node.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })));
  await expect(page.locator('#oc_status')).toContainText('Execution proof costs must be zero or positive numbers.');
  submits = await page.evaluate(() => window.__opsCalls.filter((row) => row.action === 'work_order_execution_proof_submit'));
  expect(submits).toHaveLength(0);

  await form.locator('[name="labour_minutes"]').fill('90');
  await form.locator('[name="labour_hourly_rate"]').fill('42.50');
  await form.locator('[name="material_cost_total"]').fill('35.25');
  await form.locator('[name="equipment_cost_total"]').fill('18');
  await form.locator('[name="other_cost_total"]').fill('5');
  await form.locator('[name="asset_ids"]').selectOption('22222222-2222-4222-8222-222222222222');
  await form.evaluate((node) => node.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })));
  await expect.poll(async () => page.evaluate(() => window.__opsCalls.filter((row) => row.action === 'work_order_execution_proof_submit').length)).toBe(1);

  const payload = await page.evaluate(() => window.__opsCalls.find((row) => row.action === 'work_order_execution_proof_submit'));
  expect(payload).toMatchObject({
    work_order_id:'11111111-1111-4111-8111-111111111111', proof_type:'arrival', customer_visible:true,
    labour_minutes:90, labour_hourly_rate:42.5, material_cost_total:35.25, equipment_cost_total:18, other_cost_total:5,
    customer_summary:'Crew arrived and completed the customer-safe walkaround.', asset_ids:['22222222-2222-4222-8222-222222222222']
  });

  await expect(page.locator('#oc_execution_proof_queue')).toContainText('Internal cost');
  await expect(page.locator('#oc_execution_proof_queue')).toContainText('Margin');
  await expect(page.locator('#oc_execution_proof_queue')).toContainText('Internal staging-only cost context.');
  await expect(page.getByRole('button', { name:'Approve proof' })).toBeVisible();
  await page.evaluate(() => { window.prompt = () => 'Supervisor reviewed staging proof'; });
  await page.getByRole('button', { name:'Approve proof' }).click();
  await expect.poll(async () => page.evaluate(() => window.__opsCalls.filter((row) => row.action === 'work_order_execution_proof_decision').length)).toBe(1);
  const decision = await page.evaluate(() => window.__opsCalls.find((row) => row.action === 'work_order_execution_proof_decision'));
  expect(decision).toMatchObject({ execution_proof_id:'33333333-3333-4333-8333-333333333333', decision:'approve' });
});
