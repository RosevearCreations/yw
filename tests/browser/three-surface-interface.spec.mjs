import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const css = read('style.css');
const index = read('index.html');
const clean = (html) => html.replace(/<script\b[\s\S]*?<\/script>/gi, '');

const surfaces = [
  { name:'phone-390', kind:'mobile', width:390, height:844 },
  { name:'phone-430', kind:'mobile', width:430, height:932 },
  { name:'desktop-1366', kind:'desktop', width:1366, height:768 },
  { name:'desktop-1440', kind:'desktop', width:1440, height:960 },
];

async function mountShell(page, surface) {
  await page.setViewportSize({ width: surface.width, height: surface.height });
  await page.setContent(clean(index));
  await page.addStyleTag({ content: css });
  await page.locator('body').evaluate((body) => body.setAttribute('data-authenticated', 'true'));
}

async function assertNoDocumentOverflow(page, width) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(result.scrollWidth).toBeLessThanOrEqual(Math.max(width, result.clientWidth) + 1);
}

for (const surface of surfaces) {
  test(`application interface contract on ${surface.name}`, async ({ page }) => {
    await mountShell(page, surface);
    expect(await page.locator('h1').count()).toBe(1);
    await expect(page.getByRole('link', { name: 'Open online help' })).toBeVisible();

    if (surface.kind === 'mobile') {
      const quickNav = page.locator('#mobileQuickNav.mobile-quick-nav');
      await expect(quickNav).toBeVisible();
      const moduleKeys = await quickNav.locator('a[data-mobile-module]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute('data-mobile-module'))) ]);
      expect(moduleKeys).toEqual(expect.arrayContaining(['safety', 'finance', 'jobs', 'admin']));
      const tapTargets = await quickNav.locator('a:visible').evaluateAll((nodes) => nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { height: rect.height, width: rect.width };
      }));
      expect(tapTargets.length).toBeGreaterThanOrEqual(4);
      for (const target of tapTargets) expect(target.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator('#mainMenuToggle')).toBeVisible();
    } else {
      await expect(page.locator('#mainNav')).toBeVisible();
      const moduleKeys = await page.locator('#mainNav a[data-module]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-module')));
      expect(moduleKeys).toEqual(['safety', 'finance', 'jobs', 'admin']);
      await expect(page.locator('#mainMenuToggle')).toBeHidden();
    }

    await assertNoDocumentOverflow(page, surface.width);
  });

  test(`wide table containment contract on ${surface.name}`, async ({ page }) => {
    await page.setViewportSize({ width: surface.width, height: surface.height });
    await page.setContent('<main class="container"><div class="table-scroll" data-test-table-scroll><table><thead><tr><th>One</th><th>Two</th><th>Three</th><th>Four</th><th>Five</th><th>Six</th></tr></thead><tbody><tr><td>Long operational value</td><td>Long operational value</td><td>Long operational value</td><td>Long operational value</td><td>Long operational value</td><td>Long operational value</td></tr></tbody></table></div></main>');
    await page.addStyleTag({ content: css });
    const metrics = await page.locator('[data-test-table-scroll]').evaluate((node) => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }));
    if (surface.kind === 'mobile') expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    await assertNoDocumentOverflow(page, surface.width);
  });

  test(`public website authority on ${surface.name}`, async ({ page }) => {
    await page.setViewportSize({ width: surface.width, height: surface.height });
    await page.setContent(clean(index));
    await page.addStyleTag({ content: css });
    expect(await page.locator('h1').count()).toBe(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://yardweasels.ca/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index,follow/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Southern Ontario/);
    await expect(page.getByRole('link', { name: 'Open online help' })).toBeVisible();
    await assertNoDocumentOverflow(page, surface.width);
  });
}

test('keyboard focus remains visible on a primary shell action', async ({ page }) => {
  await mountShell(page, surfaces[2]);
  const help = page.getByRole('link', { name: 'Open online help' });
  await help.focus();
  const focusState = await help.evaluate((node) => ({
    active: document.activeElement === node,
    outlineStyle: getComputedStyle(node).outlineStyle,
  }));
  expect(focusState.active).toBe(true);
  expect(focusState.outlineStyle).not.toBe('none');
});
