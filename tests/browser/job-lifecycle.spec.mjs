import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');

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
