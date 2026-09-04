import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const externalBaseURL = String(process.env.YWI_E2E_BASE_URL || '').trim();
let baseURL = externalBaseURL;
let localServer = null;

const widths = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 960 }
];

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon']
]);

async function serveRepositoryFile(req, res) {
  try {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    const repositoryRoot = path.resolve(process.cwd());
    const filePath = path.resolve(repositoryRoot, relativePath);
    const insideRepository = filePath === repositoryRoot || filePath.startsWith(`${repositoryRoot}${path.sep}`);
    if (!insideRepository) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      'content-type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(body);
  } catch (error) {
    const status = error?.code === 'ENOENT' ? 404 : 500;
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(status === 404 ? 'Not found' : 'Static test server error');
  }
}

async function stubDeterministicThirdPartyRuntime(page) {
  let productionSupabaseRequests = 0;
  await page.route('https://cdn.jsdelivr.net/**', async (route) => {
    const url = route.request().url();
    let body = '';
    if (url.includes('@supabase/supabase-js')) {
      body = `window.supabase={createClient(){const chain={select(){return chain},eq(){return chain},order(){return chain},limit(){return chain},maybeSingle:async()=>({data:null,error:null}),single:async()=>({data:null,error:null}),then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return {auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),refreshSession:async()=>({data:{session:null},error:null}),exchangeCodeForSession:async()=>({data:{session:null},error:null}),setSession:async()=>({data:{session:null},error:null})},from(){return chain},functions:{invoke:async()=>({data:null,error:null})}}}};`;
    } else if (url.includes('signature_pad')) {
      body = 'window.SignaturePad=class SignaturePad{clear(){} isEmpty(){return true} toDataURL(){return ""}};';
    }
    await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body });
  });
  await page.route('https://jmqvkgiqlimdhcofwkxr.supabase.co/**', async (route) => {
    productionSupabaseRequests += 1;
    await route.fulfill({ status: 503, contentType: 'application/json; charset=utf-8', body: '{"error":"blocked by deterministic browser smoke"}' });
  });
  return () => productionSupabaseRequests;
}

test.beforeAll(async () => {
  if (externalBaseURL) return;
  localServer = http.createServer((req, res) => {
    serveRepositoryFile(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Static test server error');
    });
  });
  await new Promise((resolve, reject) => {
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', resolve);
  });
  const address = localServer.address();
  if (!address || typeof address === 'string') throw new Error('Deterministic test server did not expose a local TCP port.');
  baseURL = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (!localServer) return;
  await new Promise((resolve) => localServer.close(resolve));
});

for (const device of widths) {
  test(`public shell stays canonical and readable on ${device.name}`, async ({ page }) => {
    const getProductionSupabaseRequests = await stubDeterministicThirdPartyRuntime(page);
    await page.setViewportSize({ width: device.width, height: device.height });
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://yardweasels.ca/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index,follow/i);
    await expect(page.locator('#mainNav a[data-module]')).toHaveCount(4);
    await expect(page.locator('#operationsCockpit')).toHaveCount(0);
    await expect(page.locator('main.container')).toBeHidden();
    await expect(page.locator('.public-home-intro')).toBeVisible();
    await expect(page.locator('#publicQuoteContactForm')).toBeVisible();
    await expect(page.locator('.public-home-intro')).toContainText(/Authorized staff can sign in above/i);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBeFalsy();
    expect(getProductionSupabaseRequests()).toBe(0);
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
  await expect(page.locator('.customer-portal-updates')).toBeVisible();
  const preference = page.locator('.customer-portal-notification-preference');
  await expect(preference).toBeVisible();
  await expect(preference).toContainText(/Service update email/i);
  const notificationEmail = preference.locator('input[name="contact_email"]');
  await expect(notificationEmail).toHaveValue('');
  if (process.env.YWI_E2E_PORTAL_EXPECT_LIVE_UPDATE === '1') {
    await expect(page.locator('.customer-portal-update').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.customer-portal-updates')).toContainText(/Live service updates/i);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBeFalsy();
});


test('Operations Cockpit has readable dark contrast when a protected staging admin URL is supplied', async ({ page }) => {
  test.skip(!process.env.YWI_E2E_ADMIN_URL, 'Set YWI_E2E_ADMIN_URL for an authenticated staging admin page.');
  await page.goto(process.env.YWI_E2E_ADMIN_URL, { waitUntil: 'domcontentloaded' });
  const cockpit = page.locator('#operationsCockpit');
  await expect(cockpit).toBeVisible();
  const releaseDashboard = page.locator('#oc_release_dashboard');
  await expect(releaseDashboard).toBeVisible();
  const styles = await cockpit.evaluate((element) => {
    const style = getComputedStyle(element);
    const heading = element.querySelector('h3, h4, summary, strong');
    const headingStyle = heading ? getComputedStyle(heading) : null;
    return { background: style.backgroundColor, color: style.color, heading: headingStyle?.color || '' };
  });
  expect(styles.color).not.toBe(styles.background);
  expect(styles.heading).not.toBe(styles.background);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBeFalsy();
});
