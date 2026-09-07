import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');
const cockpitRuntime = fs.readFileSync('js/operations-cockpit.js', 'utf8');
const proofGuardRuntime = fs.readFileSync('js/execution-proof-runtime-guard.js', 'utf8');
const closeoutGuardRuntime = fs.readFileSync('js/closeout-runtime-guard.js', 'utf8');
const customerPortalRuntime = fs.readFileSync('js/customer-portal.js', 'utf8');

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
  await expect(page.locator('#oc_execution_proof_form [data-oc-work-order-select] option')).toHaveCount(2);
}

async function mountActualCloseoutCockpit(page) {
  await page.setViewportSize({ width:1280, height:960 });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main><section id="admin"><div id="ad_stats_grid"></div></section></main></body></html>`);
  await page.evaluate(() => {
    const workOrderId = '41111111-1111-4111-8111-111111111111';
    const beforeAssetId = '42222222-2222-4222-8222-222222222222';
    const afterAssetId = '43333333-3333-4333-8333-333333333333';
    const closeoutId = '44444444-4444-4444-8444-444444444444';
    window.__opsCalls = [];
    const queueState = new Proxy({
      capabilities:{ actions:{
        work_order_closeout_submit:{ permitted:true, reason:'' },
        work_order_closeout_decision:{ permitted:true, reason:'' }
      }},
      portal:[{ work_order_id:workOrderId, work_order_number:'WO-STAGING-254', client_name:'Staging Customer' }],
      assets:[
        { id:beforeAssetId, asset_status:'approved', public_url:'https://example.test/before.jpg', asset_key:'staging-before', image_role:'before' },
        { id:afterAssetId, asset_status:'approved', public_url:'https://example.test/after.jpg', asset_key:'staging-after', image_role:'after' }
      ],
      execution_proofs:[{
        id:'45555555-5555-4555-8555-555555555555', work_order_id:workOrderId, work_order_number:'WO-STAGING-254', client_name:'Staging Customer',
        proof_type:'completion', title:'Completion proof approved', proof_status:'approved', occurred_at:'2026-09-07T16:00:00Z',
        customer_visible:true, total_cost:205, labour_cost_total:125, material_cost_total:45, equipment_cost_total:35,
        approved_public_asset_count:2, attached_asset_count:2, cost_status:'approved'
      }],
      execution_costs:[{
        work_order_id:workOrderId, work_order_number:'WO-STAGING-254', client_name:'Staging Customer', cost_status:'approved',
        accepted_estimate_total:500, total_actual_cost:205, margin_amount:295, margin_percent:59,
        approved_proof_count:1, submitted_proof_count:0
      }],
      closeouts:[],
      banks:[], rails:[], payments:[], bank_imports:[], bank_items:[], reconciliation:[], equipment:[], equipment_scans:[],
      routes:[], quotes:[], live_updates:[], customer_notifications:[], webhook_alerts:[], content_signals:[]
    }, { get(target, prop) { return prop in target ? target[prop] : []; } });
    window.__closeoutState = queueState;
    window.YWIAPI = {
      manageOperations: async (payload) => {
        window.__opsCalls.push(JSON.parse(JSON.stringify(payload)));
        if (payload?.action === 'operations_queue_list') return { ok:true, build:'build254-runtime-fixture', queues:queueState };
        if (payload?.action === 'work_order_closeout_submit') {
          queueState.closeouts = [{
            id:closeoutId, work_order_id:workOrderId, work_order_number:'WO-STAGING-254', client_name:'Staging Customer',
            closeout_status:'submitted', customer_signoff_status:'not_requested',
            invoice_ready_requested:payload.invoice_ready_requested === true,
            invoice_readiness_status:payload.invoice_ready_requested === true ? 'blocked' : 'not_requested',
            review_request_requested:payload.review_request_requested === true,
            review_request_status:payload.review_request_requested === true ? 'waiting_signoff' : 'not_requested',
            maintenance_followup_status:payload.maintenance_followup_due_at ? 'scheduled' : 'not_requested',
            maintenance_followup_due_at:payload.maintenance_followup_due_at || null,
            customer_summary:payload.customer_summary, staff_closeout_notes:payload.staff_closeout_notes,
            approved_proof_count:1, before_count:payload.before_asset_ids.length, after_count:payload.after_asset_ids.length,
            margin_amount:295, margin_percent:59, cost_status:'approved',
            closeout_message:'Closeout is ready for supervisor review.'
          }];
          return { ok:true, closeout:queueState.closeouts[0] };
        }
        if (payload?.action === 'work_order_closeout_decision') {
          const row = queueState.closeouts[0];
          if (payload.decision === 'approve') {
            Object.assign(row, { closeout_status:'approved', customer_signoff_status:'requested', invoice_readiness_status:'waiting_customer_signoff', closeout_message:'Waiting for customer signoff in the secure portal.' });
          } else if (payload.decision === 'invoice_ready') {
            Object.assign(row, { closeout_status:'invoice_ready', invoice_readiness_status:'ready', closeout_message:'Closeout is invoice-ready.' });
          }
          return { ok:true, closeout:row };
        }
        return { ok:true };
      },
      escHtml:(value)=>String(value ?? '')
    };
  });
  await page.addScriptTag({ content: closeoutGuardRuntime });
  await page.addScriptTag({ content: cockpitRuntime });
  await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect(page.locator('#oc_closeout_form')).toBeVisible();
  await expect(page.locator('#oc_closeout_form [data-oc-work-order-select] option')).toHaveCount(2);
  await expect(page.locator('#oc_closeout_form [data-oc-closeout-before-assets] option')).toHaveCount(2);
  await expect(page.locator('#oc_closeout_form [data-oc-closeout-after-assets] option')).toHaveCount(2);
}

async function mountActualCustomerCloseoutPortal(page) {
  const portalUrl = 'https://portal.test/?portal=staging-closeout-token-254';
  await page.route('https://portal.test/**', (route) => route.fulfill({
    status:200,
    contentType:'text/html',
    body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><header class="app-header"><h1>Yard Weasels</h1></header></body></html>`
  }));
  await page.goto(portalUrl);
  await page.evaluate(() => {
    const closeoutId = '44444444-4444-4444-8444-444444444444';
    window.__portalCalls = [];
    window.__portalState = {
      quote_package_id:'46666666-6666-4666-8666-666666666666',
      package_status:'accepted',
      rendered_title:'Staging service closeout',
      rendered_html:'<h2>Approved scope</h2><p>Customer-safe staging scope.</p>',
      rendered_markdown:'',
      accepted_at:'2026-09-07T13:00:00Z',
      accepted_by_name:'Staging Customer',
      deposit_required_amount:0,
      deposit_status:'not_required',
      estimate:{ id:'47777777-7777-4777-8777-777777777777', number:'Q-STAGING-254', status:'accepted', subtotal:500, tax_total:0, total:500, valid_until:'2026-09-30' },
      customer:{ name:'Staging Customer' },
      work_order:{ id:'41111111-1111-4111-8111-111111111111', number:'WO-STAGING-254', status:'completed', scheduled_start:'2026-09-07T13:00:00Z', scheduled_end:'2026-09-07T17:00:00Z', schedule_status:'completed' },
      deposit:null,
      live_updates:[],
      execution_proofs:[{ id:'45555555-5555-4555-8555-555555555555', type:'completion', title:'Completion proof approved', customer_summary:'The agreed service was completed and quality checked.', occurred_at:'2026-09-07T16:00:00Z', progress_percent:100, media:[] }],
      closeouts:[{
        id:closeoutId, status:'approved', customer_signoff_required:true, customer_signoff_status:'requested',
        customer_summary:'The agreed service is complete. Please review the approved before and after gallery and sign off when satisfied.',
        approved_at:'2026-09-07T16:30:00Z', signed_off_at:null, invoice_readiness_status:'waiting_customer_signoff',
        review_request_status:'waiting_signoff', maintenance_followup_due_at:'2026-10-07',
        total_actual_cost:205, margin_amount:295, staff_closeout_notes:'PRIVATE STAFF NOTE MUST NOT RENDER',
        gallery:[
          { asset_id:'42222222-2222-4222-8222-222222222222', role:'before', url:'https://example.test/before.jpg', thumbnail_url:'https://example.test/before.jpg', alt_text:'Approved before service condition image', width:1200, height:800 },
          { asset_id:'43333333-3333-4333-8333-333333333333', role:'after', url:'https://example.test/after.jpg', thumbnail_url:'https://example.test/after.jpg', alt_text:'Approved completed service condition image', width:1200, height:800 }
        ]
      }],
      notification_preferences:{ live_work_update_email_opt_in:false, consent_status:'unknown', email_configured:false }
    };
    window.YWIAPI = {
      customerPortal: async (payload) => {
        window.__portalCalls.push(JSON.parse(JSON.stringify(payload)));
        if (payload?.action === 'load') return { ok:true, portal:window.__portalState };
        if (payload?.action === 'sign_closeout') {
          const row = window.__portalState.closeouts[0];
          row.customer_signoff_status = payload.accept_closeout === true ? 'signed' : 'declined';
          row.signed_off_at = payload.accept_closeout === true ? '2026-09-07T17:00:00Z' : null;
          row.review_request_status = payload.accept_closeout === true ? 'queued' : 'waiting_signoff';
          return { ok:true, portal:window.__portalState };
        }
        return { ok:true, portal:window.__portalState };
      }
    };
  });
  await page.addScriptTag({ content: customerPortalRuntime });
  await expect(page.locator('.customer-portal-closeout')).toBeVisible();
  await expect(page.getByText('Signoff requested')).toBeVisible();
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

test('real Operations Cockpit closeout runtime blocks duplicate gallery roles and waits for customer signoff before invoice readiness', async ({ page }) => {
  await mountActualCloseoutCockpit(page);
  const form = page.locator('#oc_closeout_form');
  await form.locator('[name="work_order_id"]').selectOption('41111111-1111-4111-8111-111111111111');
  await form.locator('[name="customer_summary"]').fill('The agreed service is complete. Please review the approved before and after gallery and sign off when satisfied.');
  await form.locator('[name="staff_closeout_notes"]').fill('Internal invoice and cost review note for staging acceptance.');
  await form.locator('[name="maintenance_followup_due_at"]').fill('2026-10-07');
  await form.locator('[name="invoice_ready_requested"]').check();
  await form.locator('[name="review_request_requested"]').check();
  await form.locator('[name="before_asset_ids"]').selectOption('42222222-2222-4222-8222-222222222222');
  await form.locator('[name="after_asset_ids"]').selectOption('42222222-2222-4222-8222-222222222222');

  await form.evaluate((node) => node.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })));
  await expect(page.locator('#oc_status')).toContainText('Choose different approved images for BEFORE and AFTER closeout gallery positions.');
  let submits = await page.evaluate(() => window.__opsCalls.filter((row) => row.action === 'work_order_closeout_submit'));
  expect(submits).toHaveLength(0);

  await form.locator('[name="after_asset_ids"]').selectOption('43333333-3333-4333-8333-333333333333');
  await form.evaluate((node) => node.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })));
  await expect.poll(async () => page.evaluate(() => window.__opsCalls.filter((row) => row.action === 'work_order_closeout_submit').length)).toBe(1);
  const payload = await page.evaluate(() => window.__opsCalls.find((row) => row.action === 'work_order_closeout_submit'));
  expect(payload).toMatchObject({
    work_order_id:'41111111-1111-4111-8111-111111111111',
    customer_summary:'The agreed service is complete. Please review the approved before and after gallery and sign off when satisfied.',
    staff_closeout_notes:'Internal invoice and cost review note for staging acceptance.',
    invoice_ready_requested:true,
    review_request_requested:true,
    maintenance_followup_due_at:'2026-10-07',
    before_asset_ids:['42222222-2222-4222-8222-222222222222'],
    after_asset_ids:['43333333-3333-4333-8333-333333333333']
  });

  await expect(page.locator('#oc_closeout_queue')).toContainText('Internal margin');
  await expect(page.getByRole('button', { name:'Approve closeout' })).toBeVisible();
  await page.evaluate(() => { window.prompt = () => 'Supervisor approved customer-safe closeout'; });
  await page.getByRole('button', { name:'Approve closeout' }).click();
  await expect.poll(async () => page.evaluate(() => window.__opsCalls.filter((row) => row.action === 'work_order_closeout_decision' && row.decision === 'approve').length)).toBe(1);

  const waiting = page.locator('[data-oc-action="closeout-invoice"]');
  await expect(waiting).toHaveText('Waiting for customer signoff');
  await expect(waiting).toBeDisabled();
  await waiting.dispatchEvent('click');
  let invoiceDecisions = await page.evaluate(() => window.__opsCalls.filter((row) => row.action === 'work_order_closeout_decision' && row.decision === 'invoice_ready'));
  expect(invoiceDecisions).toHaveLength(0);

  await page.evaluate(() => {
    const row = window.__closeoutState.closeouts[0];
    row.customer_signoff_status = 'signed';
    row.invoice_readiness_status = 'waiting_customer_signoff';
    row.closeout_message = 'Customer signoff complete. Invoice readiness may proceed.';
  });
  await page.locator('#oc_refresh').click();
  const invoiceButton = page.getByRole('button', { name:'Mark invoice-ready' });
  await expect(invoiceButton).toBeVisible();
  await expect(invoiceButton).toBeEnabled();
  await page.evaluate(() => { window.prompt = () => 'Customer signed; invoice may proceed'; });
  await invoiceButton.click();
  await expect.poll(async () => page.evaluate(() => window.__opsCalls.filter((row) => row.action === 'work_order_closeout_decision' && row.decision === 'invoice_ready').length)).toBe(1);
  invoiceDecisions = await page.evaluate(() => window.__opsCalls.filter((row) => row.action === 'work_order_closeout_decision' && row.decision === 'invoice_ready'));
  expect(invoiceDecisions[0]).toMatchObject({ closeout_package_id:'44444444-4444-4444-8444-444444444444', decision:'invoice_ready' });
});

test('real customer portal closeout runtime keeps internal costs private and records customer signoff through the intended action', async ({ page }) => {
  await mountActualCustomerCloseoutPortal(page);
  await expect(page.getByRole('button', { name:'Approve completed work' })).toBeVisible();
  await expect(page.locator('.customer-portal-closeout-gallery img')).toHaveCount(2);
  let body = (await page.locator('body').innerText()).toLowerCase();
  for (const forbidden of ['205', '295', 'private staff note must not render', 'staff_closeout_notes', 'margin_amount', 'total_actual_cost']) expect(body).not.toContain(forbidden);

  const form = page.locator('#customerPortalCloseoutSignoffForm');
  await form.locator('[name="customer_name"]').fill('Staging Customer');
  await form.locator('[name="customer_email"]').fill('staging.customer@example.invalid');
  await form.locator('[name="customer_note"]').fill('Completed work reviewed and approved.');
  await page.getByRole('button', { name:'Approve completed work' }).click();
  await expect.poll(async () => page.evaluate(() => window.__portalCalls.filter((row) => row.action === 'sign_closeout').length)).toBe(1);
  const signoff = await page.evaluate(() => window.__portalCalls.find((row) => row.action === 'sign_closeout'));
  expect(signoff).toMatchObject({
    token:'staging-closeout-token-254',
    closeout_package_id:'44444444-4444-4444-8444-444444444444',
    customer_name:'Staging Customer',
    customer_email:'staging.customer@example.invalid',
    customer_note:'Completed work reviewed and approved.',
    accept_closeout:true
  });
  await expect(page.getByText('Signed off')).toBeVisible();
  await expect(page.getByText('Closeout signed')).toBeVisible();
  await expect(page.locator('#customerPortalCloseoutSignoffForm')).toHaveCount(0);
  body = (await page.locator('body').innerText()).toLowerCase();
  for (const forbidden of ['private staff note must not render', 'staff_closeout_notes', 'margin_amount', 'total_actual_cost']) expect(body).not.toContain(forbidden);
});
