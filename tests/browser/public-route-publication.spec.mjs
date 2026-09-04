import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');

async function mountAdmin(page, { width = 1440, height = 960 } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>
    *{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}.fixture-shell{max-width:1180px;margin:0 auto;padding:16px}.fixture-grid{display:grid;gap:14px}.fixture-card{min-width:0;padding:16px;border:1px solid rgba(148,163,184,.22);border-radius:14px}.fixture-actions{display:flex;gap:8px;flex-wrap:wrap}.fixture-actions button{min-height:44px}.fixture-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}@media(min-width:1000px){.fixture-grid{grid-template-columns:1fr 1fr}}
  </style></head><body><main class="fixture-shell"><section id="operationsCockpit" class="operations-cockpit"><header><h1>Public route approval</h1><p>Approve visual evidence and route content before publication.</p></header><div class="fixture-grid">
    <article class="fixture-card" data-route-asset><h2>Approved visual</h2><div class="fixture-meta"><span>Status</span><strong>approved</strong><span>Alt text</span><strong>Commercial property cleanup crew at work</strong></div><div class="fixture-actions"><button class="secondary">Reject visual</button></div></article>
    <article class="fixture-card" data-route-review><h2>Service route</h2><div class="fixture-meta"><span>Route</span><strong>/commercial-property-cleanup</strong><span>Status</span><strong>approved</strong><span>Canonical</span><strong>https://yardweasels.ca/commercial-property-cleanup</strong></div><div class="fixture-actions"><button class="secondary">Reject route</button><button class="primary" data-publish-route>Publish approved route</button></div><p>Publishing is a deliberate Admin action after approval. It is not implied by saving a draft.</p></article>
  </div></section></main></body></html>`);
}

async function mountPublic(page, { width, height }) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html lang="en-CA"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commercial Property Cleanup | Yard Weasels Inc.</title><meta name="description" content="Commercial property cleanup service for Southern Ontario."><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="https://yardweasels.ca/commercial-property-cleanup"><style>${css}</style><style>*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}.public-route-shell{max-width:1180px;margin:0 auto;padding:16px}.fixture-hero{display:grid;gap:16px}.fixture-hero img{max-width:100%;height:auto;border-radius:12px}.fixture-actions{display:flex;gap:8px;flex-wrap:wrap}.fixture-actions a{min-height:44px;display:inline-flex;align-items:center}@media(min-width:900px){.fixture-hero{grid-template-columns:1.1fr .9fr;align-items:center}}</style><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Service"},{"@type":"BreadcrumbList"}]}</script></head><body class="public-route-mode static-public-route"><main id="publicRouteView" class="public-route-shell"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <span>Commercial Property Cleanup</span></nav><section class="fixture-hero"><div><p>Southern Ontario</p><h1>Commercial Property Cleanup</h1><p>Approved customer-facing service information with local proof and a clear quote path.</p><div class="fixture-actions"><a class="primary" href="/#quote-intake">Request a quote</a><a class="secondary" href="/">Home</a></div></div><figure><img alt="Commercial property cleanup crew at work" width="1200" height="800" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect width='1200' height='800' fill='%23111827'/%3E%3C/svg%3E"><figcaption>Approved service visual</figcaption></figure></section><section><h2>What the service covers</h2><p>Cleanup planning, access review, visible service scope, and customer-safe proof.</p></section></main></body></html>`);
}

test('desktop Admin publication workbench keeps approval and publish actions distinct', async ({ page }) => {
  await mountAdmin(page, { width:1440, height:960 });
  await expect(page.locator('[data-route-asset]')).toContainText(/approved/i);
  await expect(page.locator('[data-route-review]')).toContainText(/approved/i);
  await expect(page.locator('[data-publish-route]')).toBeVisible();
  await expect(page.locator('[data-publish-route]')).toHaveText(/Publish approved route/i);
  const height = await page.locator('[data-publish-route]').evaluate((button) => button.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

for (const viewport of [{name:'phone-390',width:390,height:844},{name:'desktop-1440',width:1440,height:960}]) {
  test(`${viewport.name} approved public route is customer-safe, canonical and overflow-free`, async ({ page }) => {
    await mountPublic(page, viewport);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://yardweasels.ca/commercial-property-cleanup');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index,follow/);
    await expect(page.locator('img')).toHaveAttribute('alt', /Commercial property cleanup crew at work/i);
    await expect(page.locator('#operationsCockpit')).toHaveCount(0);
    const schema = await page.locator('script[type="application/ld+json"]').textContent();
    expect(schema).toContain('WebPage');
    expect(schema).toContain('Service');
    expect(schema).toContain('BreadcrumbList');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
