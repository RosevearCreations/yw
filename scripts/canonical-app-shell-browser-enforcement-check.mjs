#!/usr/bin/env node
/** Build 213: make the actual canonical app shell a deterministic mandatory browser authority. */
import fs from 'node:fs';
import process from 'node:process';

const read = (file) => fs.readFileSync(file, 'utf8');
const hasAll = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok, detail });

const packageJson = read('package.json');
const workflow = read('.github/workflows/staging-browser-integration.yml');
const browser = read('tests/browser/operations-portal.spec.mjs');
const versions = fs.readdirSync('sql')
  .map((name) => Number(name.match(/^(\d+)_/)?.[1] || 0))
  .filter(Boolean);
const latestRepositorySchema = Math.max(...versions);

add('historical-browser-entrypoint-preserved', packageJson.includes('"test:browser": "playwright test --config=playwright.config.mjs tests/browser/operations-portal.spec.mjs"'), 'The existing real-shell browser entrypoint remains canonical.');
add('deterministic-repository-server', hasAll(browser, ["import http from 'node:http'", 'http.createServer', "localServer.listen(0, '127.0.0.1'", "decodedPath === '/' ? 'index.html'", "'cache-control': 'no-store'"]), 'The browser smoke serves the checked-out repository on an ephemeral loopback port.');
add('external-base-url-remains-explicit', hasAll(browser, ['YWI_E2E_BASE_URL', 'if (externalBaseURL) return']), 'An explicit external base URL can still be supplied without silently changing the default deterministic CI boundary.');
add('third-party-runtime-is-deterministic', hasAll(browser, ["page.route('https://cdn.jsdelivr.net/**'", '@supabase/supabase-js', 'window.SignaturePad']), 'CDN dependencies are stubbed for the canonical unauthenticated shell smoke.');
add('production-supabase-all-traffic-intercepted', hasAll(browser, ["page.route('https://jmqvkgiqlimdhcofwkxr.supabase.co/**'", 'productionNonTelemetryRequests', 'sensitiveTelemetryRequests']), 'Every Production Supabase request is intercepted inside the deterministic runner.');
add('production-telemetry-is-exact-and-local-only', hasAll(browser, ["requestUrl.pathname === '/functions/v1/analytics-traffic'", "method === 'POST'", "status: 204", 'interceptedProductionTelemetryCount += 1']), 'Only exact anonymous analytics POSTs are locally swallowed; the test runner never forwards them to Production.');
add('production-business-data-access-fails-closed', hasAll(browser, ['productionNonTelemetryRequests.push', 'Production business/data access blocked by deterministic browser smoke', 'expect(productionBoundary.getProductionNonTelemetryRequests()).toEqual([])']), 'Any Production request outside the analytics endpoint is blocked and fails the browser authority.');
add('telemetry-sensitive-data-fails-closed', hasAll(browser, ['access_token|refresh_token|authorization|password|contact_email|customer_email|invoice_reference|payment_reference|staff_note|labou?r_cost|material_cost|equipment_cost', 'sensitiveTelemetryRequests.push', 'expect(productionBoundary.getSensitiveTelemetryRequests()).toEqual([])']), 'Telemetry cannot carry auth credentials, contact email, Finance references, staff notes, or cost fields.');
add('phone-tablet-desktop-matrix', hasAll(browser, ["{ name: 'phone', width: 390", "{ name: 'tablet', width: 768", "{ name: 'desktop', width: 1440"]), 'The real shell is rendered at phone, tablet, and computer widths.');
add('canonical-public-authority-rendered', hasAll(browser, ["link[rel=\"canonical\"]", "'https://yardweasels.ca/'", "meta[name=\"robots\"]", '/index,follow/i']), 'Canonical and index authority are asserted in the actual served document.');
add('unauthenticated-shell-boundary-rendered', hasAll(browser, ["page.locator('h1')", "#mainNav a[data-module]", "#operationsCockpit", "page.locator('main.container')).toBeHidden()", "page.locator('.public-home-intro')).toBeVisible()", "page.locator('#publicQuoteContactForm')).toBeVisible()", 'Authorized staff can sign in above', 'scrollWidth > window.innerWidth + 1']), 'The canonical root proves one H1, four module authorities in the shell, hidden protected workspace, visible public information/intake, no staff cockpit leakage, and no horizontal overflow.');
add('optional-live-cases-remain-explicit', hasAll(browser, ['test.skip(!process.env.YWI_E2E_PUBLIC_ROUTE_URL', 'test.skip(!process.env.YWI_E2E_PORTAL_URL', 'test.skip(!process.env.YWI_E2E_ADMIN_URL']), 'Authenticated/live staging checks remain opt-in and cannot run accidentally in normal CI.');
add('build213-source-gate-is-mandatory', workflow.includes('node scripts/canonical-app-shell-browser-enforcement-check.mjs'), 'Build 213 source authority runs on every release PR.');
add('real-shell-browser-gate-is-mandatory', workflow.includes('npm run test:browser'), 'The actual app-shell browser smoke now runs on every release PR.');
add('browser-runs-after-chromium-install', workflow.indexOf('npm run test:browser') > workflow.indexOf('npx playwright install --with-deps chromium'), 'The mandatory real-shell browser gate runs only after Chromium is installed.');
add('three-surface-regression-remains-mandatory', hasAll(workflow, ['npm run test:three-surface', 'npm run test:browser:three-surface']), 'Mobile application, computer application, and public website fixture regression remains alongside the real shell.');
add('staging-proof-remains-manual-only', workflow.includes("if: github.event_name == 'workflow_dispatch' && inputs.run_staging == 'true'"), 'Making the actual shell mandatory does not enable live staging mutation.');
add('current-schema-authority-remains-separate', latestRepositorySchema >= 201, `Repository schema history reaches ${latestRepositorySchema}; Build 213 adds no schema identity.`);

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
if (failed.length) process.exit(1);
console.log(`Build 213 canonical app-shell browser authority passed (${checks.length}/${checks.length}).`);
