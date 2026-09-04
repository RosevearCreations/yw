#!/usr/bin/env node
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const sql = read('sql/156_customer_notification_consent_outbox_delivery.sql');
const ops = read('supabase/functions/operations-manage/index.ts');
const portal = read('supabase/functions/customer-portal/index.ts');
const dispatch = read('supabase/functions/customer-notification-dispatch/index.ts');
const cockpit = read('js/operations-cockpit.js');
const customer = read('js/customer-portal.js');
const workflow = read('.github/workflows/staging-browser-integration.yml');
const pkg = JSON.parse(read('package.json'));
const help = read('help.html');
const readme = read('README.md');
const handbook = read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps = read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const all = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok) => checks.push([name, !!ok]);

const schemaFiles = fs.readdirSync('sql').filter((name) => /^\d{3}_.+\.sql$/i.test(name));
const schemaVersions = schemaFiles.map((name) => Number(name.slice(0, 3))).filter(Number.isFinite);
const repoLatestSchema = Math.max(...schemaVersions);
const currentSchemaFile = schemaFiles.find((name) => Number(name.slice(0, 3)) === repoLatestSchema) || '';
const currentSchema = currentSchemaFile ? read(`sql/${currentSchemaFile}`) : '';
const markerPattern = new RegExp(`\\b${repoLatestSchema}(?:::int)?\\s+as\\s+expected_schema_version\\b`, 'i');

add('historical-notification-authority', all(sql, [
  'customer_notification_preferences', 'customer_notification_outbox', 'customer_notification_delivery_attempts',
  "channel in ('email')", 'live_work_update_opt_in', 'ywi_rpc_set_customer_live_update_email_preference',
  'ywi_rpc_enqueue_customer_live_update_notification', 'ywi_rpc_claim_customer_notification',
  'ywi_rpc_complete_customer_notification', 'ywi_rpc_retry_customer_notification',
  'v_customer_notification_delivery_queue'
]));
add('browser-direct-data-remains-revoked', sql.includes('revoke all on public.customer_notification_preferences, public.customer_notification_outbox, public.customer_notification_delivery_attempts from anon, authenticated'));
add('operations-runtime-wires-notification-queue-and-retry', all(ops, [
  "customer_notifications: 'v_customer_notification_delivery_queue'",
  "action === 'customer_notification_retry'",
  'ywi_rpc_enqueue_customer_live_update_notification'
]));
add('customer-portal-wires-explicit-consent', all(portal, [
  "action === 'set_live_update_notifications'",
  'portalNotificationPreference'
]) && all(customer, [
  'customerPortalNotificationPreferenceForm',
  'live_work_update_email_opt_in',
  'Email me when a new customer-visible service update is published.'
]));
add('dispatcher-fail-closed-and-idempotent', all(dispatch, [
  'YWI_CUSTOMER_NOTIFICATION_DELIVERY_ENABLED',
  'YWI_CUSTOMER_NOTIFICATION_RUN_TOKEN',
  "'Idempotency-Key'",
  "p_result_status:'manual_review'"
]));
add('staff-ui-wires-safe-delivery-review', all(cockpit, [
  'renderCustomerNotificationQueue',
  "'customer-notification-retry':'customer_notification_retry'"
]));
add('current-schema-authority-separate-from-feature-history', Number.isInteger(repoLatestSchema) && repoLatestSchema >= 201 && markerPattern.test(currentSchema));
add('notification-source-tests-present',
  pkg.scripts?.['test:notifications'] === 'node scripts/customer-notification-delivery-check.mjs' &&
  pkg.scripts?.['test:notification-enforcement'] === 'node scripts/customer-notification-release-enforcement-check.mjs');
add('notification-browser-test-present', pkg.scripts?.['test:browser:notifications'] === 'playwright test --config=playwright.config.mjs tests/browser/customer-notification-delivery.spec.mjs');
add('workflow-runs-notification-gates', all(workflow, [
  'npm run test:notifications',
  'npm run test:notification-enforcement',
  'npm run test:browser:notifications'
]));
add('durable-help-notification-guidance', all(help, [
  'Customer service update emails',
  'explicit opt-in',
  'manual review',
  'customer-safe'
]));
add('active-docs-notification-contract', [readme, handbook, nextSteps].every((text) => all(text, [
  'customer notification',
  'explicit opt-in',
  'manual review'
])));
add('active-docs-no-build-ledger', ![readme, handbook, nextSteps].some((text) => /Build\s+207|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));

for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
const failed = checks.filter(([, ok]) => !ok);
console.log(`\n${checks.length - failed.length}/${checks.length} customer notification release-enforcement checks passed. Repository schema ${repoLatestSchema}.`);
if (failed.length) process.exit(1);
