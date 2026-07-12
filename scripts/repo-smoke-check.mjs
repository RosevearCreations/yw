#!/usr/bin/env node
/** Repository-level static sanity check for build 2026-07-07a / schema 156. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const all = (text, values) => values.every((value) => text.includes(value));
const results = [];
const add = (name, ok, details = '') => results.push({ name, ok, details });
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const schema = read('sql/000_full_schema_reference.sql');
const migration151 = read('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql');
const migration153 = read('sql/153_release_fixture_policy_mapping_seo_alerts.sql');
const migration154 = read('sql/154_release_readiness_dashboard_and_evidence_snapshots.sql');
const migration155 = read('sql/155_live_job_updates_customer_timeline_and_visibility.sql');
const migration156 = read('sql/156_customer_notification_consent_outbox_delivery.sql');
const operations = read('supabase/functions/operations-manage/index.ts');
const portal = read('supabase/functions/customer-portal/index.ts');
const dispatcher = read('supabase/functions/customer-notification-dispatch/index.ts');
const upload = read('supabase/functions/upload-public-asset/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const accountant = read('supabase/functions/accountant-export/index.ts');
const cockpit = read('js/operations-cockpit.js');
const customerPortal = read('js/customer-portal.js');
const index = read('index.html');
const css = read('style.css');
const config = read('supabase/config.toml');
const routeGenerator = read('scripts/generate-public-routes.mjs');

// Documentation and archive integrity.
const ignoredDocRoots = [`${path.sep}archive${path.sep}`, `${path.sep}node_modules${path.sep}`, `${path.sep}.git${path.sep}`];
const activeMd = walk(root)
  .filter((file) => file.endsWith('.md') && !ignoredDocRoots.some((segment) => file.includes(segment)))
  .map((file) => path.relative(root, file).replaceAll('\\', '/'))
  .sort();
add('active-markdown-exactly-three', JSON.stringify(activeMd) === JSON.stringify(['README.md', 'docs/ACTIVE_PROJECT_HANDBOOK.md', 'docs/NEXT_STEPS_AND_SANITY_CHECK.md']), `Active Markdown: ${activeMd.join(', ') || 'none'}`);
add('retired-markdown-archive-present', exists('archive/retired-markdown-2026-07-07a') && walk(path.join(root, 'archive/retired-markdown-2026-07-07a')).filter((file) => file.endsWith('.md')).length >= 80, 'Historical Markdown is preserved in the dated archive.');
add('temp-write-files-retired', !walk(root).filter((file) => !file.includes(`${path.sep}archive${path.sep}`) && /test_write/i.test(path.basename(file))).length, 'No temporary write files remain active.');
add('active-readme-schema156', all(read('README.md'), ['2026-07-07a', 'schema `156`', 'consent-controlled']), 'README identifies the current release and notification scope.');
add('handoff-docs-current', all(read('docs/ACTIVE_PROJECT_HANDBOOK.md').toLowerCase(), ['schema target:', '156', 'customer email']) && all(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').toLowerCase(), ['schema 156', 'customer opt-in', 'protected delivery batch']), 'Active handoff explains current controls and detailed test process.');

// Schema/reference integrity.
const migrationBlocks = (schema.match(/BEGIN MIGRATION:/g) || []).length;
add('canonical-schema-through-156', schema.includes('BEGIN MIGRATION: 030_') && schema.includes('BEGIN MIGRATION: 156_') && migrationBlocks === 127, `Canonical schema has ${migrationBlocks} migration blocks.`);
add('canonical-schema-includes-schema156-verbatim', schema.includes(migration156.trim()), 'Full schema contains the current migration.');
for (const [number, text] of [[151, migration151], [153, migration153], [154, migration154], [155, migration155], [156, migration156]]) {
  add(`schema${number}-transaction-balanced`, (text.match(/^begin;$/gmi) || []).length === 1 && (text.match(/^commit;$/gmi) || []).length === 1, `Schema ${number} has one BEGIN and one COMMIT marker.`);
}
add('schema155-live-update-privacy', all(migration155, ['enable row level security', 'Customer-visible updates may attach only approved assets with a public delivery URL.', 'revoke all on public.v_customer_portal_live_updates, public.v_work_order_live_update_queue from anon, authenticated']), 'Live updates remain token/JWT-service-only.');
add('schema156-notification-objects', all(migration156, ['customer_notification_preferences', 'customer_notification_outbox', 'customer_notification_delivery_attempts', 'v_customer_notification_delivery_queue']), 'Consent, outbox, attempt log, and safe queue exist.');
add('schema156-email-only-explicit-consent', all(migration156, ["channel in ('email')", 'live_work_update_opt_in', 'consent_status', 'customer_portal']), 'Schema starts email-only and requires explicit preference data.');
add('schema156-status-compatibility', all(migration156, ['work_order_live_updates_customer_notification_status_check', "'pending_consent'", "'retry_scheduled'", "'manual_review'", "'opted_out'"]), 'Live-update notification states are compatible with the outbox lifecycle.');
add('schema156-retraction-and-optout-protection', all(migration156, ['customer_opted_out', 'live_update_not_customer_visible', "delivery_status='cancelled'", 'customer_notified_at=case when v_result=\'sent\'']), 'Opt-out/retraction prevents unsent delivery and sent status records timestamps.');
add('schema156-rpc-privacy', all(migration156, ['revoke all on public.customer_notification_preferences, public.customer_notification_outbox, public.customer_notification_delivery_attempts from anon, authenticated', 'grant execute on function public.ywi_rpc_claim_customer_notification(uuid,text) to service_role', 'ywi_rpc_retry_customer_notification']), 'Browser roles cannot access direct notification data or RPCs.');

// Function and UI wiring.
add('operations-schema156-wiring', all(operations, ["const BUILD = '2026-07-07a'", 'const SCHEMA = 156', 'work_order_live_update_create', 'customer_notification_retry', 'ywi_rpc_enqueue_customer_live_update_notification', "customer_notifications: 'v_customer_notification_delivery_queue'"]), 'Operations function wires role-checked creation, safe queue data, and retry.');
add('operations-request-body-once', (operations.match(/body = await req\.json\(\)\.catch\(\(\) => \(\{\}\)\);/g) || []).length === 1, 'Operations request payload is consumed once.');
add('portal-schema156-preferences', all(portal, ["const BUILD = '2026-07-07a'", 'const SCHEMA = 156', 'portalLiveUpdates', 'portalNotificationPreference', "action === 'set_live_update_notifications'", 'ywi_rpc_set_customer_live_update_email_preference']), 'Customer portal returns safe preference flags and writes only through the token-validating function.');
add('dispatcher-protected', all(dispatcher, ["const BUILD = '2026-07-07a'", 'const SCHEMA = 156', 'YWI_CUSTOMER_NOTIFICATION_DELIVERY_ENABLED', 'YWI_CUSTOMER_NOTIFICATION_RUN_TOKEN', "'Idempotency-Key'", "p_result_status:'manual_review'"]), 'Dispatcher requires an independent run token and safely handles uncertain provider outcomes.');
add('portal-ui-preferences', all(customerPortal, ['customerPortalNotificationPreferenceForm', 'Service update email', 'never includes staff-only notes, private images, access information, or internal costing']), 'Customer portal explains and controls future notification preference.');
add('cockpit-notification-ui', all(cockpit, ['renderCustomerNotificationQueue', 'oc_customer_notification_queue', "'customer-notification-retry':'customer_notification_retry'", 'Email addresses, portal tokens, staff notes, and private media are never shown in this queue.']), 'Cockpit delivery queue is role-aware and excludes private fields.');
add('upload-private-review-asset', all(upload, ["const BUCKET = 'review-assets'", "const BUILD = '2026-07-07a'", 'const SCHEMA = 156', 'review_only:true', 'imageDimensions', 'checksum_sha256']), 'Upload handler verifies and stores review media privately.');
add('webhook-marker-current', all(webhook, ["const BUILD='2026-07-07a'", 'const SCHEMA=156', 'validateSession', 'ywi_rpc_record_portal_deposit_paid', 'ywi_refresh_stripe_webhook_alerts']), 'Webhook retains verified payment and alert logic.');
add('accountant-marker-current', all(accountant, ["const BUILD = '2026-07-07a'", 'const SCHEMA = 156', 'ywi_rpc_capture_accountant_close_snapshot', 'createSignedUrl']), 'Accountant export retains private close/mapping handling.');
add('jwt-config-protected-functions', /\[functions\.operations-manage\]\s+verify_jwt = true/s.test(config) && /\[functions\.upload-public-asset\]\s+verify_jwt = true/s.test(config) && /\[functions\.accountant-export\]\s+verify_jwt = true/s.test(config), 'Protected functions retain JWT verification.');
add('dispatcher-config-explicit', /\[functions\.customer-notification-dispatch\]\s+verify_jwt = false/s.test(config), 'Dispatcher has explicit no-JWT config and performs its own run-token check.');

// SEO/CSS/cache guardrails.
const h1Count = (index.match(/<h1\b/gi) || []).length;
add('homepage-one-h1', h1Count === 1, `Homepage H1 count: ${h1Count}.`);
const ids = [...index.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const duplicateIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);
add('homepage-no-duplicate-ids', duplicateIds.length === 0, duplicateIds.length ? `Duplicates: ${[...new Set(duplicateIds)].join(', ')}` : 'No duplicate IDs.');
add('build-cache-marker-current', all(index, ['2026-07-07a', 'operations-cockpit.js?v=2026-07-07a']) && read('server-worker.js').includes('ywi-shell-v2026-07-07a'), 'HTML and service-worker cache marker are current.');
add('route-generator-cache-marker-current', routeGenerator.includes("const build = '2026-07-07a';"), 'Generated public pages reference the current static build marker.');
add('visual-input-mime-match', cockpit.includes('accept="image/jpeg,image/png,image/webp"') && !migration153.includes('image/avif'), 'UI/storage MIME promise matches server verification.');
add('cockpit-dark-contrast-remediation', all(css, ['--oc-text: #f8fbff', '--oc-surface: #0c172b', '.operations-cockpit .oc-badge-approved', '.operations-cockpit .oc-permission.is-allowed', '.operations-cockpit .oc-permission.is-restricted', '.operations-cockpit .operations-status[data-status="error"]', '@media (forced-colors: active)']), 'Cockpit dark-surface tokens and state contrast overrides remain present.');
add('notification-responsive-css', all(css, ['.customer-portal-notification-preference', '.operations-cockpit .oc-notification-delivery-status', '.operations-cockpit .oc-notification-delivery-card', '@media(max-width:620px)']), 'Notification preference and Cockpit queue include responsive rules.');

// Supporting scripts and syntax.
for (const file of [
  'scripts/staging-fixtures.mjs', 'scripts/security-policy-assertions.mjs', 'scripts/operations-cockpit-contrast-check.mjs',
  'scripts/release-readiness-dashboard-check.mjs', 'scripts/live-work-updates-check.mjs', 'scripts/customer-notification-delivery-check.mjs',
  'tests/browser/operations-portal.spec.mjs', 'playwright.config.mjs', 'package-lock.json', '.github/workflows/staging-browser-integration.yml', '.gitignore', 'package.json'
]) add(`exists:${file}`, exists(file), 'Required support file is present.');

const jsFiles = [
  'js/api.js', 'js/operations-cockpit.js', 'js/customer-portal.js', 'js/public-routes.js',
  'scripts/generate-public-routes.mjs', 'scripts/operations-rpc-integration-test.mjs', 'scripts/security-policy-assertions.mjs',
  'scripts/staging-fixtures.mjs', 'scripts/operations-rpc-staging-e2e.mjs', 'scripts/operations-cockpit-contrast-check.mjs',
  'scripts/release-readiness-dashboard-check.mjs', 'scripts/live-work-updates-check.mjs', 'scripts/customer-notification-delivery-check.mjs',
  'scripts/repo-smoke-check.mjs', 'playwright.config.mjs', 'app.js', 'server-worker.js'
];
for (const file of jsFiles) {
  const run = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  add(`syntax:${file}`, run.status === 0, run.status === 0 ? 'Syntax OK.' : (run.stderr || run.stdout).trim());
}

let ts;
try {
  const require = createRequire(import.meta.url);
  try { ts = require('typescript'); } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
} catch (error) { add('typescript-compiler-available', false, String(error)); }
if (ts) {
  for (const file of [
    'supabase/functions/operations-manage/index.ts', 'supabase/functions/upload-public-asset/index.ts',
    'supabase/functions/customer-portal/index.ts', 'supabase/functions/public-content/index.ts',
    'supabase/functions/stripe-webhook/index.ts', 'supabase/functions/accountant-export/index.ts',
    'supabase/functions/customer-notification-dispatch/index.ts'
  ]) {
    const output = ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true, fileName: file });
    const errors = (output.diagnostics || []).filter((diag) => diag.category === ts.DiagnosticCategory.Error);
    add(`typescript-syntax:${file}`, errors.length === 0, errors.length ? errors.map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, '\n')).join(' | ') : 'TypeScript syntax OK.');
  }
}

for (const script of [
  'scripts/operations-rpc-integration-test.mjs', 'scripts/security-policy-assertions.mjs',
  'scripts/operations-cockpit-contrast-check.mjs', 'scripts/release-readiness-dashboard-check.mjs',
  'scripts/live-work-updates-check.mjs', 'scripts/customer-notification-delivery-check.mjs',
  'scripts/operations-rpc-staging-e2e.mjs'
]) {
  const run = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  add(`static:${path.basename(script)}`, run.status === 0, run.status === 0 ? 'Static checks passed.' : (run.stderr || run.stdout).trim());
}

const passed = results.filter((item) => item.ok).length;
console.log(`\nYWI repository smoke check: ${passed}/${results.length} passed\n`);
for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
process.exit(results.some((item) => !item.ok) ? 1 : 0);
