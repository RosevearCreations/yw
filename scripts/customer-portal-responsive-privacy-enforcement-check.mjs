#!/usr/bin/env node
/** Build 210: deterministic customer-portal responsive/privacy release authority. */
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const hasAll = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });

const portal = read('js/customer-portal.js');
const portalFn = read('supabase/functions/customer-portal/index.ts');
const css = read('style.css');
const workflow = read('.github/workflows/staging-browser-integration.yml');
const oldBrowser = read('tests/browser/operations-portal.spec.mjs');

add('token-mode-is-explicit', hasAll(portal, ["params.get('portal')", "document.body.classList.add('customer-portal-mode')"]), 'Portal mode requires an explicit URL token and hides the protected staff shell.');
add('portal-is-noindex', portal.includes("ensureMeta('robots','noindex,nofollow,noarchive,nosnippet')"), 'Tokenized customer portals stay out of search indexes.');
add('single-h1-contract', hasAll(portal, ['demoteAppShellH1()', 'customer-portal-hero', '<h1>${esc(row.rendered_title']), 'The app-shell H1 is demoted before the portal renders its single customer H1.');
add('html-and-url-sanitization', hasAll(portal, ['function sanitizeHtml', 'const allowed = new Set', "['http:','https:'].includes(parsed.protocol)"]), 'Customer document HTML and media URLs remain bounded to the safe renderer.');
add('quote-acceptance-is-wired', portal.includes("action:'accept_quote'"), 'Quote acceptance remains a deliberate customer action.');
add('deposit-checkout-is-hosted', hasAll(portal, ["action:'create_deposit_checkout'", 'Stripe Checkout', 'Card details are not entered into this application.']), 'Card entry remains outside the YWI portal.');
add('notification-preference-is-explicit', portal.includes("action:'set_live_update_notifications'"), 'Customer email consent remains explicitly changeable from the portal.');
add('closeout-signoff-is-explicit', portal.includes("action:'sign_closeout'"), 'Customer closeout approval/follow-up remains an explicit action.');
add('customer-lifecycle-panels-exist', hasAll(portal, ['liveUpdateTimeline(liveUpdates)', 'executionProofTimeline(executionProofs)', 'closeoutPackagePanel(closeouts)', 'notificationPreferencePanel(notificationPreference)']), 'Updates, approved proof, closeout and notification preference remain part of one customer surface.');
add('customer-server-view-remains-bounded', hasAll(portalFn, ['v_customer_portal_live_updates', 'v_customer_portal_execution_proofs']), 'Server-side customer reads continue through portal-safe views.');
add('internal-cost-fields-not-rendered', !portal.includes('row.margin_amount') && !portal.includes('row.labour_cost_total') && !portal.includes('row.material_cost_total') && !portal.includes('row.equipment_cost_total') && !portal.includes('row.staff_notes'), 'Internal costing and staff-note fields are not rendered by customer-portal.js.');
add('responsive-portal-css-exists', hasAll(css, ['.customer-portal-layout{display:grid', '@media(max-width:960px)', '@media(max-width:620px)', '.customer-portal-shell,.public-route-shell']), 'Portal has distinct desktop/tablet/phone layout rules.');
add('legacy-live-portal-case-stays-staging-only', hasAll(oldBrowser, ['YWI_E2E_PORTAL_URL', 'disposable STAGING portal token']), 'Optional live portal evidence remains staging-only and separate from deterministic CI.');
add('build210-source-gate-is-mandatory', workflow.includes('node scripts/customer-portal-responsive-privacy-enforcement-check.mjs'), 'Build 210 source authority is required by the release workflow.');
add('build210-browser-gate-is-mandatory', workflow.includes('tests/browser/customer-portal-responsive-privacy.spec.mjs'), 'Build 210 rendered portal acceptance is required by the release workflow.');
add('three-surface-regression-remains-mandatory', hasAll(workflow, ['npm run test:three-surface', 'npm run test:browser:three-surface']), 'Mobile app, desktop app and public website regression still run alongside the portal gate.');

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
if (failed.length) process.exit(1);
console.log(`Build 210 customer portal authority passed (${checks.length}/${checks.length}).`);
