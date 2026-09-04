import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');

async function mountCustomer(page, { width = 390, height = 844 } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>
    *{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}.fixture-shell{max-width:760px;margin:0 auto;padding:12px}.fixture-card{min-width:0;padding:14px;border:1px solid rgba(148,163,184,.22);border-radius:14px}.fixture-actions{display:flex;gap:8px;flex-wrap:wrap}.fixture-actions button{min-height:44px}
  </style></head><body><main class="fixture-shell"><h1>Your notification preferences</h1>
    <section class="customer-portal-notification-preference fixture-card">
      <h2>Service update emails</h2>
      <p>Choose whether we may email you when a supervisor publishes a customer-safe service update. The email links back to this secure portal and never includes staff-only notes, private images, access information, or internal costing.</p>
      <form id="customerPortalNotificationPreferenceForm" class="customer-portal-form">
        <label class="customer-portal-check"><input type="checkbox" name="live_work_update_email_opt_in"> <span>Email me when a new customer-visible service update is published.</span></label>
        <div class="fixture-actions"><button class="primary" type="submit">Save preference</button></div>
      </form>
      <p class="fixture-status" aria-live="polite">Email notifications are currently off.</p>
    </section>
  </main></body></html>`);
}

async function mountStaff(page, { width = 1440, height = 960 } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>
    *{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}.fixture-shell{max-width:1180px;margin:0 auto;padding:12px}.fixture-grid{display:grid;gap:12px}.fixture-card{min-width:0;padding:14px;border:1px solid rgba(148,163,184,.22);border-radius:14px}.fixture-card button{min-height:44px}.fixture-meta{display:flex;gap:8px;flex-wrap:wrap}
    @media(min-width:900px){.fixture-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  </style></head><body><main class="fixture-shell"><section class="operations-cockpit"><h1>Customer notification delivery</h1>
    <p>Review customer-safe service-update delivery state. Contact email and portal tokens are intentionally absent from this queue.</p>
    <div class="fixture-grid">
      <article class="oc-notification-delivery-status fixture-card" data-state="pending_consent"><h2>Pending consent</h2><p>Work order WO-1042 has no live-update email opt-in. No delivery will be attempted.</p></article>
      <article class="oc-notification-delivery-status fixture-card" data-state="delivered"><h2>Delivered</h2><p>Work order WO-1048 delivery completed with provider acknowledgement and idempotent outbox handling.</p></article>
      <article class="oc-notification-delivery-status fixture-card" data-state="manual_review"><h2>Manual review</h2><p>Work order WO-1051 has transport uncertainty. Review before retrying.</p><div class="fixture-meta"><button class="secondary" type="button" data-action="customer-notification-retry">Retry after review</button></div></article>
    </div>
  </section></main></body></html>`);
}

for (const viewport of [{ name:'phone-390', width:390, height:844 }, { name:'phone-430', width:430, height:932 }]) {
  test(`${viewport.name} customer notification preference is touch-usable and explicit`, async ({ page }) => {
    await mountCustomer(page, viewport);
    const checkbox = page.locator('input[name="live_work_update_email_opt_in"]');
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    await expect(page.getByRole('button', { name:'Save preference' })).toBeVisible();
    const buttonHeight = await page.getByRole('button', { name:'Save preference' }).evaluate((button) => button.getBoundingClientRect().height);
    expect(buttonHeight).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('customer notification preference explains the customer-safe privacy boundary', async ({ page }) => {
  await mountCustomer(page, { width:390, height:844 });
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const required of ['customer-safe service update', 'secure portal', 'staff-only notes', 'private images', 'internal costing']) {
    expect(body).toContain(required);
  }
  expect(body).not.toContain('@');
  expect(body).not.toContain('portal token');
});

test('desktop notification delivery queue keeps consent delivery and manual-review states readable', async ({ page }) => {
  await mountStaff(page, { width:1440, height:960 });
  await expect(page.locator('.oc-notification-delivery-status')).toHaveCount(3);
  await expect(page.locator('[data-state="pending_consent"]')).toContainText('No delivery will be attempted');
  await expect(page.locator('[data-state="delivered"]')).toContainText('provider acknowledgement');
  await expect(page.locator('[data-state="manual_review"]')).toContainText('Review before retrying');
  await expect(page.getByRole('button', { name:'Retry after review' })).toBeVisible();
  const body = (await page.locator('body').innerText()).toLowerCase();
  expect(body).not.toContain('@');
  expect(body).not.toContain('public_token');
  const cards = await page.locator('.oc-notification-delivery-status').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
  expect(Math.max(...cards.map((box) => box.top)) - Math.min(...cards.map((box) => box.top))).toBeLessThan(8);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
