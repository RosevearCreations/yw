#!/usr/bin/env node
/** Build 211: make private-review/public-media security policy a mandatory release authority. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const read = (path) => fs.readFileSync(path, 'utf8');
const hasAll = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });

// The historical policy assertion script has an optional live-service-role mode.
// Build 211 exercises its source assertions with all database credentials stripped,
// so an ambient Production secret can never turn a PR gate into a live database read.
const childEnv = { ...process.env };
for (const key of ['SUPABASE_URL','SB_URL','SUPABASE_SERVICE_ROLE_KEY','SB_SERVICE_ROLE_KEY']) delete childEnv[key];
execFileSync(process.execPath, ['scripts/security-policy-assertions.mjs'], {
  cwd: process.cwd(), env: childEnv, stdio: 'inherit'
});

const workflow = read('.github/workflows/staging-browser-integration.yml');
const legacyPolicy = read('scripts/security-policy-assertions.mjs');
const upload = read('supabase/functions/upload-public-asset/index.ts');
const operations = read('supabase/functions/operations-manage/index.ts');
const cockpit = read('js/operations-cockpit.js');
const portal = read('js/customer-portal.js');
const publicRoutes = read('js/public-routes.js');
const sql155 = read('sql/155_live_job_updates_customer_timeline_and_visibility.sql');
const sql157 = read('sql/157_service_execution_proof_cost_capture.sql');
const help = read('help.html');
const handbook = read('docs/ACTIVE_PROJECT_HANDBOOK.md');

const schemaVersions = fs.readdirSync('sql').map((name) => Number(name.match(/^(\d+)_/)?.[1] || 0)).filter(Boolean);
const latestRepositorySchema = Math.max(...schemaVersions);

add('historical-security-policy-source-contract-exercised', hasAll(legacyPolicy, ['private-review-bucket','rls-assertion-function','portal-function-uses-filtered-view','staff-queue-service-role-only']), 'The existing security policy assertions remain the underlying audit contract.');
add('review-uploads-stay-private', hasAll(upload, ["const BUCKET = 'review-assets'", "asset_status: 'review'", 'source_url:null, public_url:null, thumbnail_url:null', 'review_only:true']), 'New visual evidence enters private review storage without a public URL.');
add('approval-is-the-only-public-copy-path', hasAll(operations, ['async function publishApprovedAsset', "from('public-assets').upload", "from('public-assets').remove", "'asset-approve':'visual_asset_decision'"]), 'Public asset copies remain behind the protected approval path.');
add('computer-review-ui-distinguishes-private-from-public', hasAll(cockpit, ['function renderAssetQueue()', 'aria-label="Private review asset"', "publicImage ? 'public/linked' : 'private review'", "button('Approve','asset-approve'", "button('Reject','asset-reject'"]), 'Desktop Operations review visibly separates private review evidence from published assets.');
add('customer-live-updates-require-approved-public-media', hasAll(sql155, ["asset_status='approved'", "coalesce(public_url,'') <> ''", 'v_customer_portal_live_updates']), 'Customer-visible live update media remains approved/public only.');
add('customer-execution-proof-keeps-cost-and-private-media-internal', hasAll(sql157, ['review_assets_private', 'Customer portal receives approved proof summaries and public images only. Internal costing remains Cockpit/service-role only.']), 'Execution proof preserves the private/public evidence boundary.');
add('customer-portal-never-describes-private-media-as-visible', hasAll(portal, ['Only customer-safe summaries and approved public images are shown.', 'private review images are never shown in this customer portal.']), 'Customer portal copy states and preserves the approved-public-only boundary.');
add('public-route-renders-public-visual-contract', hasAll(publicRoutes, ['visual?.public_url || visual?.source_url', 'Approved service visual', 'Approved service image placeholder']), 'Public route rendering consumes only the public visual contract and otherwise shows a placeholder.');
add('help-documents-private-review-boundary', hasAll(help, ['Staff notes, internal costing, access details, and private review media must stay internal.', 'Public service pages are published only from approved content.']), 'Online Help already states the customer/public privacy and approval boundary.');
add('handbook-documents-private-review-boundary', hasAll(handbook, ['private review media remain staff-only', 'Public pages require one H1', 'approved content']), 'The durable handbook already records the private/customer/public evidence boundary.');
add('current-schema-authority-remains-separate', latestRepositorySchema >= 201, `Repository schema history reaches ${latestRepositorySchema}; historical Schema 153-158 policy work is not used as current release identity.`);
add('build211-source-gate-is-mandatory', workflow.includes('node scripts/private-evidence-security-policy-enforcement-check.mjs'), 'Build 211 source authority runs on every release PR.');
add('build211-browser-gate-is-mandatory', workflow.includes('tests/browser/private-evidence-security-policy.spec.mjs'), 'Build 211 rendered privacy acceptance runs on every release PR.');
add('three-surface-regression-remains-mandatory', hasAll(workflow, ['npm run test:three-surface','npm run test:browser:three-surface']), 'Mobile app, computer app and public website remain mandatory alongside Build 211.');

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
if (failed.length) process.exit(1);
console.log(`Build 211 private evidence/security policy authority passed (${checks.length}/${checks.length}).`);
