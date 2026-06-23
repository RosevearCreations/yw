import { test, expect } from '@playwright/test';

const baseURL = process.env.YWI_E2E_BASE_URL || 'http://127.0.0.1:4173';
const widths = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 960 }
];

for (const device of widths) {
  test(`public shell stays readable on ${device.name}`, async ({ page }) => {
    await page.setViewportSize({ width: device.width, height: device.height });
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBeFalsy();
    await expect(page.locator('main, #main, body')).toBeVisible();
  });
}

test('approved public route does not leak staff controls when a staging route URL is supplied', async ({ page }) => {
  test.skip(!process.env.YWI_E2E_PUBLIC_ROUTE_URL, 'Set YWI_E2E_PUBLIC_ROUTE_URL after generating an approved staging route.');
  await page.goto(process.env.YWI_E2E_PUBLIC_ROUTE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('#operationsCockpit')).toHaveCount(0);
});

test('customer portal contract stays isolated when a staging portal URL is supplied', async ({ page }) => {
  test.skip(!process.env.YWI_E2E_PORTAL_URL, 'Set YWI_E2E_PORTAL_URL only with a disposable STAGING portal token.');
  await page.goto(process.env.YWI_E2E_PORTAL_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#operationsCockpit')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBeFalsy();
});
