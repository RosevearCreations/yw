import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');

async function mountDesktopReview(page) {
  await page.setViewportSize({ width:1440, height:960 });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>
    *{box-sizing:border-box}.fixture{max-width:1180px;margin:0 auto;padding:20px}.fixture-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.oc-media-card{min-width:0;padding:16px;border:1px solid rgba(148,163,184,.22);border-radius:14px}.oc-media-thumb{min-height:150px;display:grid;place-items:center;border-radius:12px;background:rgba(148,163,184,.08)}.oc-row-actions{display:flex;gap:8px;flex-wrap:wrap}.oc-row-actions button{min-height:44px}
  </style></head><body><main class="fixture"><section id="operationsCockpit" class="operations-cockpit"><header><h1>Visual evidence review</h1><p>Private review evidence must be approved before a public copy exists.</p></header><div class="fixture-grid">
    <article class="oc-queue-card oc-media-card" data-asset-state="review"><div class="oc-media-thumb"><span class="oc-private-media" aria-label="Private review asset">Private<br>review</span></div><div class="oc-media-body"><header><strong>arrival-proof-01</strong><span class="oc-badge">review</span></header><dl><div><dt>Storage</dt><dd>private review · not published</dd></div><div><dt>Public URL</dt><dd>None</dd></div><div><dt>Readiness</dt><dd>review required</dd></div></dl><div class="oc-row-actions"><button type="button" class="oc-row-action">Approve</button><button type="button" class="secondary oc-row-action">Reject</button></div></div></article>
    <article class="oc-queue-card oc-media-card" data-asset-state="approved"><div class="oc-media-thumb"><img alt="Approved completed service evidence" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect width='1200' height='800' fill='%23dbeafe'/%3E%3C/svg%3E"></div><div class="oc-media-body"><header><strong>completion-proof-02</strong><span class="oc-badge">approved</span></header><dl><div><dt>Storage</dt><dd>public/linked · published</dd></div><div><dt>Alt</dt><dd>Approved completed service evidence</dd></div></dl></div></article>
  </div></section></main></body></html>`);
}

async function mountCustomerPortal(page, width) {
  await page.setViewportSize({ width, height: width <= 390 ? 844 : 932 });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><style>${css}</style><style>*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}</style></head><body class="customer-portal-mode"><main id="customerPortalView" class="customer-portal-shell"><header class="customer-portal-header"><a class="customer-portal-brand"><span class="customer-portal-mark">YWI</span><span><strong>Yard Weasels Inc.</strong><small>Secure customer quote portal</small></span></a></header><section class="customer-portal-hero"><div><span class="customer-portal-kicker">Service evidence</span><h1>Your service progress</h1><p>Only approved customer-safe evidence appears here.</p></div></section><section class="customer-portal-proofs" aria-label="Approved service proof"><header><div><span class="customer-portal-kicker">Approved proof</span><h2>Arrival and completion evidence</h2></div></header><ol><li class="customer-portal-proof"><article><h3>Completion proof approved</h3><p>Work completed and reviewed for customer visibility.</p><div class="customer-portal-update-media-grid"><a class="customer-portal-update-media"><img alt="Approved completed service evidence" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect width='1200' height='800' fill='%23dbeafe'/%3E%3C/svg%3E"></a></div></article></li></ol></section></main></body></html>`);
}

async function mountPublicRoute(page, width) {
  await page.setViewportSize({ width, height: width < 800 ? 844 : 960 });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}</style></head><body class="public-route-mode"><main id="publicRouteView" class="public-route-shell"><header class="public-route-header"><a class="public-route-brand"><span>YWI</span><strong>Yard Weasels Inc.</strong></a></header><article class="public-route-article"><section class="public-route-hero"><div><span class="public-route-kicker">Southern Ontario</span><h1>Approved service page</h1><p>Public pages use approved content and approved public visual evidence.</p></div><figure><img alt="Approved exterior service result" width="1200" height="800" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect width='1200' height='800' fill='%23dcfce7'/%3E%3C/svg%3E"><figcaption>Approved service visual</figcaption></figure></section></article></main></body></html>`);
}

test('desktop Operations review clearly distinguishes private evidence from approved public media', async ({ page }) => {
  await mountDesktopReview(page);
  await expect(page.locator('[data-asset-state="review"] .oc-private-media')).toHaveAttribute('aria-label', 'Private review asset');
  await expect(page.locator('[data-asset-state="review"]')).toContainText(/private review.*not published/i);
  await expect(page.locator('[data-asset-state="review"]')).toContainText(/Public URL.*None/i);
  await expect(page.getByRole('button', { name:'Approve' })).toBeVisible();
  await expect(page.getByRole('button', { name:'Reject' })).toBeVisible();
  await expect(page.locator('[data-asset-state="approved"] img')).toHaveAttribute('alt', /Approved completed service evidence/i);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

for (const width of [390, 430]) {
  test(`customer portal at ${width}px exposes approved evidence only`, async ({ page }) => {
    await mountCustomerPortal(page, width);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('.customer-portal-proofs img')).toHaveAttribute('alt', /Approved completed service evidence/i);
    await expect(page.locator('#operationsCockpit')).toHaveCount(0);
    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of ['review-assets','private review asset','staff note','labour $','material $','equipment $','margin $']) expect(body).not.toContain(forbidden);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

for (const viewport of [{name:'phone',width:390},{name:'desktop',width:1440}]) {
  test(`public website ${viewport.name} uses approved public visual without private-review leakage`, async ({ page }) => {
    await mountPublicRoute(page, viewport.width);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.public-route-hero img')).toHaveAttribute('alt', /Approved exterior service result/i);
    await expect(page.locator('figcaption')).toHaveText(/Approved service visual/i);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('review-assets');
    expect(body).not.toContain('private review');
    expect(body).not.toContain('operations cockpit');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
