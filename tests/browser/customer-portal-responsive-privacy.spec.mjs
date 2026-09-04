import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');

async function mountPortal(page, viewport) {
  await page.setViewportSize(viewport);
  await page.setContent(`<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
    <style>${css}</style>
    </head><body class="customer-portal-mode">
    <main id="customerPortalView" class="customer-portal-shell">
      <header class="customer-portal-header">
        <a class="customer-portal-brand" href="/"><span class="customer-portal-mark">YWI</span><span><strong>Yard Weasels Inc.</strong><small>Secure customer quote portal</small></span></a>
        <span class="customer-portal-security">Token-protected link</span>
      </header>
      <section class="customer-portal-status customer-portal-status-success">Quote loaded securely.</section>
      <section class="customer-portal-hero"><div><span class="customer-portal-kicker">Quote Q-210</span><h1>Your service quote</h1><p>Review, accept, pay a hosted deposit, and follow service progress from one secure page.</p></div><div class="customer-portal-hero-visual"><strong>Approved service visual</strong><small>Customer-safe evidence only.</small></div></section>
      <section class="customer-portal-summary"><article><small>Estimate</small><strong>$1,250.00</strong></article><article><small>Deposit</small><strong>$250.00</strong></article><article><small>Status</small><strong>Accepted</strong></article><article class="customer-portal-total"><small>Total</small><strong>$1,250.00</strong></article></section>
      <section class="customer-portal-updates"><header><div><span class="customer-portal-kicker">Live service updates</span><h2>Work progress shared with you</h2></div></header><ol><li class="customer-portal-update"><article><header><div><span>Work in progress</span><h3>Crew arrived</h3></div></header><p>Your service is underway.</p></article></li></ol></section>
      <section class="customer-portal-proofs"><header><div><span class="customer-portal-kicker">Approved proof</span><h2>Arrival, completion, and service evidence</h2></div></header><ol><li class="customer-portal-proof"><article><h3>Completion proof approved</h3><p>Approved customer-safe evidence is ready.</p></article></li></ol></section>
      <section class="customer-portal-closeout"><header><div><span class="customer-portal-kicker">Final closeout</span><h2>Review completed work</h2></div><strong class="is-off">Signoff requested</strong></header><p>The supervisor-approved summary is ready.</p><form class="customer-portal-form customer-portal-closeout-form"><label>Your name<input type="text" value="Customer"></label><div class="customer-portal-button-row"><button class="primary" type="button">Approve completed work</button><button class="secondary" type="button">Request follow-up</button></div></form></section>
      <section class="customer-portal-notification-preference"><header><div><span class="customer-portal-kicker">Your choice</span><h2>Service update email</h2></div><strong class="is-on">Email updates are on</strong></header><form class="customer-portal-form"><label>Contact email<input type="email" value="customer@example.invalid"></label><button class="primary" type="button">Save email preference</button></form></section>
      <div class="customer-portal-layout"><article class="customer-portal-document"><div class="customer-portal-section-heading"><span>Quote details</span><small>Status: accepted</small></div><div class="customer-portal-document-body"><h2>Approved scope</h2><p>Customer-visible scope and totals.</p></div></article><aside class="customer-portal-actions-panel"><section class="customer-portal-progress"><h2>Progress</h2><ol><li class="is-complete"><span>1</span><div><strong>Quote available</strong><small>Ready</small></div></li><li class="is-complete"><span>2</span><div><strong>Quote acceptance</strong><small>Accepted</small></div></li><li class="is-current"><span>3</span><div><strong>Deposit</strong><small>Hosted checkout</small></div></li><li><span>4</span><div><strong>Scheduling</strong><small>Pending</small></div></li></ol></section><section class="customer-portal-deposit"><h2>Deposit</h2><button class="primary" type="button">Pay deposit securely</button><small>Payment is completed on Stripe Checkout.</small></section><section class="customer-portal-schedule"><h2>Dispatch and schedule</h2><dl><div><dt>Work order</dt><dd>WO-210</dd></div><div><dt>Scheduled</dt><dd>Sep 10</dd></div></dl></section></aside></div>
      <footer class="customer-portal-footer"><strong>Need help?</strong><span>Use the follow-up form. Never send payment-card details in a message.</span></footer>
    </main>
    </body></html>`);
}

for (const viewport of [{name:'phone-390',width:390,height:844},{name:'phone-430',width:430,height:932}]) {
  test(`${viewport.name} customer portal remains usable, private and overflow-free`, async ({ page }) => {
    await mountPortal(page, viewport);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#operationsCockpit')).toHaveCount(0);
    await expect(page.locator('.customer-portal-updates')).toBeVisible();
    await expect(page.locator('.customer-portal-proofs')).toBeVisible();
    await expect(page.locator('.customer-portal-closeout')).toBeVisible();
    await expect(page.locator('.customer-portal-notification-preference')).toBeVisible();
    await expect(page.getByRole('button', { name:'Pay deposit securely' })).toBeVisible();
    await expect(page.getByRole('button', { name:'Approve completed work' })).toBeVisible();
    await expect(page.locator('.customer-portal-security')).toBeHidden();
    const inputHeights = await page.locator('.customer-portal-form input').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.min(...inputHeights)).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of ['labour $','material $','equipment $','margin $','staff-only note','private review path','service role key']) expect(body).not.toContain(forbidden);
  });
}

test('desktop customer portal preserves two-column quote/action workspace without staff controls', async ({ page }) => {
  await mountPortal(page, {width:1440,height:960});
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.customer-portal-security')).toBeVisible();
  const layout = page.locator('.customer-portal-layout');
  const children = layout.locator(':scope > *');
  await expect(children).toHaveCount(2);
  const boxes = await children.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
  expect(Math.abs(boxes[0].top - boxes[1].top)).toBeLessThan(8);
  expect(boxes[0].width).toBeGreaterThan(boxes[1].width);
  await expect(page.locator('#operationsCockpit')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
