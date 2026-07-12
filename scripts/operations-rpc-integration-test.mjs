#!/usr/bin/env node
/**
 * Transactional operation and schema 156 wiring check.
 * It is safe without credentials; optional live checks only read metadata.
 */
import fs from 'node:fs';
import process from 'node:process';

const root = process.cwd();
const read = (file) => fs.readFileSync(file, 'utf8');
const sql151 = read('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql');
const sql153 = read('sql/153_release_fixture_policy_mapping_seo_alerts.sql');
const sql154 = read('sql/154_release_readiness_dashboard_and_evidence_snapshots.sql');
const sql155 = read('sql/155_live_job_updates_customer_timeline_and_visibility.sql');
const operations = read('supabase/functions/operations-manage/index.ts');
const portal = read('supabase/functions/customer-portal/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const upload = read('supabase/functions/upload-public-asset/index.ts');
const accountant = read('supabase/functions/accountant-export/index.ts');

const checks = [];
const add = (name, ok, details = '') => checks.push({ name, ok, details });
const hasAll = (text, values) => values.every((value) => text.includes(value));

const transactionalRpcs = [
  'ywi_rpc_post_payment_action', 'ywi_rpc_promote_bank_csv_import',
  'ywi_rpc_apply_reconciliation_action', 'ywi_rpc_accept_quote_package',
  'ywi_rpc_prepare_deposit_request', 'ywi_rpc_attach_deposit_checkout',
  'ywi_rpc_record_portal_deposit_paid', 'ywi_rpc_mark_deposit_checkout_status'
];
for (const rpc of transactionalRpcs) add(`schema151:${rpc}`, sql151.includes(`function public.${rpc}`), 'Transactional RPC remains defined.');
add('schema151-exact-cent-and-balance-guards', hasAll(sql151, ['ywi_cents', 'Split allocations must equal the bank item amount exactly to the cent', 'Journal entry is not balanced to the cent']), 'Exact split and balanced journal safeguards remain present.');
add('schema151-service-role-grants', transactionalRpcs.every((rpc) => sql151.includes(`grant execute on function public.${rpc}`)), 'Transactional RPC grants are explicit.');
add('operations-delegates-core-writes', hasAll(operations, ['ywi_rpc_post_payment_action', 'ywi_rpc_promote_bank_csv_import', 'ywi_rpc_apply_reconciliation_action']), 'Operations Edge Function delegates high-risk writes to RPCs.');
add('portal-delegates-conversion-and-deposit', hasAll(portal, ['ywi_rpc_accept_quote_package', 'ywi_rpc_prepare_deposit_request', 'ywi_rpc_attach_deposit_checkout']), 'Portal remains RPC-backed for quote conversion and deposits.');
add('webhook-remains-verified-and-observable', hasAll(webhook, ['STRIPE_WEBHOOK_SECRET', 'crypto.subtle', 'validateSession', 'ywi_rpc_record_portal_deposit_paid', 'ywi_refresh_stripe_webhook_alerts']), 'Webhook validates provider data, posts via RPC, and refreshes safe operational alerts.');
add('schema153-private-review-media', hasAll(sql153, ['review-assets', 'public=false', 'public-assets', 'review_storage_bucket']) && hasAll(operations, ['publishApprovedAsset', "reviewBucket", "from('public-assets')", "published_storage_bucket"]), 'Private review media is defined before approved public promotion.');
add('server-upload-private-review-path', hasAll(upload, ["const BUCKET = 'review-assets'", 'review_only:true', 'imageDimensions', 'checksum_sha256']), 'Upload handler verifies image dimensions/checksum and stores review assets privately.');
add('schema153-fixtures', hasAll(sql153, ['operations_staging_fixture_sets', 'ywi_rpc_create_staging_fixture_set', 'ywi_rpc_cleanup_staging_fixture_set', "Fixture label must start with STAGING-"]), 'Disposable fixture create/cleanup controls are defined.');
add('schema153-policy-assertions', hasAll(sql153, ['ywi_security_policy_assertions', 'v_security_policy_assertion_summary', 'review_assets_private', 'sensitive_tables_rls_enabled']), 'Security assertions cover private buckets and sensitive-table RLS.');
add('schema153-accountant-mapping', hasAll(sql153, ['accountant_export_mapping_rules', 'v_accountant_mapping_readiness', 'ywi_rpc_capture_accountant_close_snapshot']), 'Accountant mapping/close snapshot controls are defined.');
add('accountant-captures-close-mapping-snapshot', hasAll(accountant, ['ywi_rpc_capture_accountant_close_snapshot', 'close_mapping_snapshot']), 'Export function snapshots mapping/close review with the generated artifact.');
add('schema153-content-and-webhook-queues', hasAll(sql153, ['content_signal_observations', 'v_route_content_decision_queue', 'stripe_webhook_operational_alerts', 'v_stripe_webhook_alert_queue']), 'SEO decision evidence and payment-provider alert queues are defined.');
add('operations-release-proof-actions', hasAll(operations, ['staging_fixture_create', 'content_signal_record', 'stripe_webhook_alert_decision', 'YWI_ALLOW_STAGING_FIXTURES']), 'Protected release-proof actions and staging feature gate are wired.');
add('schema154-release-dashboard', hasAll(sql154, ['v_release_readiness_dashboard', 'release_readiness_review_snapshots', 'ywi_rpc_capture_release_readiness_snapshot', 'REVIEW ONLY']), 'Release review is evidence-only and snapshot-backed.');
add('operations-schema154-dashboard-wiring', hasAll(operations, ['v_release_readiness_dashboard', 'release_readiness_capture', 'ywi_rpc_capture_release_readiness_snapshot']) && (operations.match(/body = await req\.json\(\)\.catch\(\(\) => \(\{\}\)\);/g) || []).length === 1, 'Operations queue loads the dashboard and reads the request payload once.');
add('schema155-live-work-update-rpcs', hasAll(sql155, ['ywi_rpc_create_work_order_live_update', 'ywi_rpc_retract_work_order_live_update', 'v_customer_portal_live_updates', 'v_work_order_live_update_queue']), 'Live job updates are token-portal-safe and RPC-backed.');
add('schema155-customer-media-and-role-guards', hasAll(sql155, ['Customer-visible updates may attach only approved assets with a public delivery URL.', 'Customer-visible updates require supervisor or higher.', 'Only a supervisor or higher may retract a live work update.']), 'Customer-visible updates require approved media and supervisor review.');
add('operations-schema155-live-update-wiring', hasAll(operations, ['const SCHEMA = 156', 'work_order_live_update_create', 'work_order_live_update_retract', 'ywi_rpc_create_work_order_live_update', 'v_work_order_live_update_queue']), 'Operations Edge Function uses live-update RPCs and queue.');
add('portal-schema155-live-update-filter', hasAll(portal, ['const SCHEMA = 156', 'portalLiveUpdates', 'v_customer_portal_live_updates', 'live_updates: liveUpdates']), 'Portal is limited to the portal-safe update view.');

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
if (failed.length) process.exit(1);

const url = (process.env.SUPABASE_URL || process.env.SB_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || '';
if (!url || !serviceKey) {
  console.log('\nSKIP live read-only checks — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for a deployed staging project.');
  process.exit(0);
}
const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
async function get(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${raw}`);
  return raw ? JSON.parse(raw) : null;
}
try {
  const [schema, policy, readiness, releaseDashboard] = await Promise.all([
    get('v_schema_drift_status?select=*'),
    get('v_security_policy_assertion_summary?select=*'),
    get('v_accountant_export_readiness?select=mapping_ready,unresolved_required_mapping_count,package_ready'),
    get('v_release_readiness_dashboard?select=staging_evidence_status,public_content_status,policy_ready')
  ]);
  const schemaRow = schema?.[0] || {};
  if (Number(schemaRow.latest_applied_schema_version) < 156 || schemaRow.drift_status !== 'current') throw new Error(`Schema 156 is not current: ${JSON.stringify(schemaRow)}`);
  console.log(`\nLIVE  schema ${schemaRow.latest_applied_schema_version} is current.`);
  console.log(`LIVE  policy assertions: ${policy?.[0]?.passed_count ?? 0}/${policy?.[0]?.assertion_count ?? 0} passed.`);
  console.log(`LIVE  mapping readiness: ${readiness?.[0]?.mapping_ready === true ? 'ready' : 'review required'}.`);
  console.log(`LIVE  release evidence: ${releaseDashboard?.[0]?.staging_evidence_status || 'not available'}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
