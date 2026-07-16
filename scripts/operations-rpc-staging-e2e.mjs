#!/usr/bin/env node
/*
  Schema 157 staging proof harness.
  Default: source-only checks. Live mode is locked to a named staging target.
  Optional fixture creation, live update creation, and cleanup are explicit so
  this command never silently changes business data.
*/
import fs from 'node:fs';
import process from 'node:process';

const root = process.cwd();
const read = (file) => fs.readFileSync(file, 'utf8');
const sql151 = read('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql');
const sql152 = read('sql/152_staging_proof_permissions_stripe_health_accountant_export.sql');
const sql153 = read('sql/153_release_fixture_policy_mapping_seo_alerts.sql');
const sql154 = read('sql/154_release_readiness_dashboard_and_evidence_snapshots.sql');
const sql155 = read('sql/155_live_job_updates_customer_timeline_and_visibility.sql');
const sql156 = read('sql/156_customer_notification_consent_outbox_delivery.sql');
const dispatcher = read('supabase/functions/customer-notification-dispatch/index.ts');
const operations = read('supabase/functions/operations-manage/index.ts');
const portal = read('supabase/functions/customer-portal/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const accountant = read('supabase/functions/accountant-export/index.ts');
const upload = read('supabase/functions/upload-public-asset/index.ts');
const config = read('supabase/config.toml');
const all = (text, values) => values.every((value) => text.includes(value));
const checks = [];
function add(name, ok, details = '') { checks.push({ name, ok, details }); }
function printChecks() { for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`); }
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

add('schema151-transactional-rpcs', all(sql151, ['ywi_rpc_post_payment_action', 'ywi_rpc_promote_bank_csv_import', 'ywi_rpc_apply_reconciliation_action', 'ywi_rpc_accept_quote_package', 'ywi_rpc_record_portal_deposit_paid']), 'Core multi-row writes remain transactional.');
add('schema152-durable-release-proof', all(sql152, ['operations_staging_test_runs', 'v_stripe_webhook_health', 'accountant-exports']), 'Prior release proof remains present.');
add('schema153-disposable-fixture-rpcs', all(sql153, ['ywi_rpc_create_staging_fixture_set', 'ywi_rpc_cleanup_staging_fixture_set', "environment_label = 'staging'", 'Fixture label must start with STAGING-']), 'Fixture creation/cleanup is staged and labelled.');
add('schema153-policy-evidence', all(sql153, ['ywi_security_policy_assertions', 'v_security_policy_assertion_summary', 'review_assets_private', 'sensitive_tables_rls_enabled']), 'Policy assertions are deployable.');
add('schema153-private-media-promotion', all(sql153, ['review-assets', 'review_storage_bucket', 'published_storage_bucket']) && all(upload, ["const BUCKET = 'review-assets'", 'review_only:true']), 'Review media is private until protected approval copy.');
add('schema153-accountant-mapping', all(sql153, ['accountant_export_mapping_rules', 'v_accountant_mapping_readiness', 'ywi_rpc_capture_accountant_close_snapshot']) && accountant.includes('ywi_rpc_capture_accountant_close_snapshot'), 'Accountant close mapping is captured with exports.');
add('schema153-seo-observation-queue', all(sql153, ['content_signal_observations', 'v_route_content_decision_queue']) && all(operations, ['content_signal_record', 'content_signal_decision']), 'Search/local observations have a human decision queue.');
add('schema153-webhook-alert-queue', all(sql153, ['stripe_webhook_operational_alerts', 'ywi_refresh_stripe_webhook_alerts', 'v_stripe_webhook_alert_queue']) && webhook.includes('ywi_refresh_stripe_webhook_alerts'), 'Webhook failures/staleness are turned into review alerts.');
add('schema154-release-dashboard', all(sql154, ['v_release_readiness_dashboard', 'ywi_rpc_capture_release_readiness_snapshot', 'REVIEW ONLY', 'release_readiness_snapshot']) && all(operations, ['v_release_readiness_dashboard', 'release_readiness_capture']), 'Human release evidence is dashboarded and cannot auto-release.');
add('schema155-live-update-rpcs', all(sql155, ['ywi_rpc_create_work_order_live_update', 'ywi_rpc_retract_work_order_live_update', 'v_customer_portal_live_updates', 'v_work_order_live_update_queue']), 'Live updates are RPC-backed and portal-filtered.');
add('schema155-privacy-and-role-guards', all(sql155, ['Customer-visible updates require supervisor or higher.', 'Customer-visible updates may attach only approved assets with a public delivery URL.', 'Only a supervisor or higher may retract a live work update.', 'grant select on public.v_customer_portal_live_updates, public.v_work_order_live_update_queue to service_role']), 'Customer visibility, media, and service-role boundaries are explicit.');
add('schema156-consent-outbox', all(sql156, ['customer_notification_preferences', 'customer_notification_outbox', 'customer_notification_delivery_attempts', 'v_customer_notification_delivery_queue', "channel in ('email')", 'live_work_update_opt_in']), 'Customer e-mail is explicit opt-in and recorded in a private outbox.');
add('schema156-delivery-safety', all(sql156, ['live_update_not_customer_visible', 'customer_opted_out', "'manual_review'", 'ywi_rpc_claim_customer_notification', 'ywi_rpc_complete_customer_notification', 'ywi_rpc_recover_stale_customer_notification_claims', 'ywi_rpc_retry_customer_notification']), 'Retraction/opt-out prevent delivery and uncertain provider outcomes require review.');
add('schema156-private-rpcs', all(sql156, ['revoke all on public.customer_notification_preferences, public.customer_notification_outbox, public.customer_notification_delivery_attempts from anon, authenticated', 'grant execute on function public.ywi_rpc_claim_customer_notification(uuid,text) to service_role']), 'Notification tables and RPCs are not browser-callable.');
add('dispatcher-schema156-guard', all(dispatcher, ['YWI_CUSTOMER_NOTIFICATION_DELIVERY_ENABLED', 'YWI_CUSTOMER_NOTIFICATION_RUN_TOKEN', 'ywi_rpc_recover_stale_customer_notification_claims', "'Idempotency-Key'", "p_result_status:'manual_review'"]), 'Protected delivery requires enablement, a run token, idempotency, and manual review for uncertainty.');
add('operations-schema155-live-update-actions', all(operations, ["const SCHEMA = 157", 'work_order_live_update_create', 'work_order_live_update_retract', 'customer_notification_retry', 'ywi_rpc_enqueue_customer_live_update_notification', 'v_work_order_live_update_queue']), 'Operations action path is wired.');
add('portal-schema155-live-update-filter', all(portal, ["const SCHEMA = 157", 'portalLiveUpdates', 'portalNotificationPreference', "action === 'set_live_update_notifications'", 'v_customer_portal_live_updates', 'live_updates: liveUpdates']), 'Portal stays constrained to published customer-safe updates.');
add('operations-body-read-once', (operations.match(/body = await req\.json\(\)\.catch\(\(\) => \(\{\}\)\);/g) || []).length === 1, 'Operations action body is consumed once.');
add('protected-function-jwt-settings', all(config, ['[functions.operations-manage]', '[functions.accountant-export]', '[functions.upload-public-asset]']) && /\[functions\.operations-manage\]\s+verify_jwt = true/s.test(config), 'Protected Edge Functions retain JWT verification.');

printChecks();
if (checks.some((item) => !item.ok)) process.exit(1);

const live = process.env.YWI_RUN_STAGING_RPC_TESTS === '1';
if (!live) {
  console.log('\nSKIP live staging proof — set YWI_RUN_STAGING_RPC_TESTS=1 only after schema 157 is deployed to a dedicated non-production project.');
  process.exit(0);
}
const url = (process.env.SUPABASE_URL || process.env.SB_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || '';
const label = String(process.env.YWI_STAGING_LABEL || '').trim().toLowerCase();
const confirmation = process.env.YWI_STAGING_CONFIRM || '';
const actorId = process.env.YWI_STAGING_JOB_ADMIN_PROFILE_ID || '';
if (!url || !key || !uuid(actorId) || label !== 'staging' || confirmation !== 'I_CONFIRM_STAGING_ONLY') {
  console.error('ERROR  Live mode requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YWI_STAGING_JOB_ADMIN_PROFILE_ID, YWI_STAGING_LABEL=staging, and YWI_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY.');
  process.exit(1);
}
const headers = { apikey: key, authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
async function rest(path, options = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!res.ok) throw new Error(`${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}
async function functionCall(name, token, body) {
  const res = await fetch(`${url}/functions/v1/${name}`, { method: 'POST', headers: { apikey: key, authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: res.status, data };
}
const runKey = `staging-schema156-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(16).slice(2, 8)}`;
const created = await rest('operations_staging_test_runs', { method: 'POST', body: JSON.stringify({ run_key: runKey, environment_label: 'staging', suite_name: 'operations_rpc_e2e_schema157', run_status: 'started', requested_by_profile_id: actorId, summary: { build: '2026-07-12a', schema: 157, fixture_mode: process.env.YWI_STAGING_CREATE_FIXTURES === '1' } }) });
const run = Array.isArray(created) ? created[0] : created;
const cases = [];
async function liveCase(caseKey, fn, optional = false) {
  try {
    const details = await fn();
    cases.push({ case_key: caseKey, case_status: 'passed', details: details || {} });
    console.log(`PASS  live:${caseKey}`);
  } catch (error) {
    const details = { error: error instanceof Error ? error.message : String(error) };
    cases.push({ case_key: caseKey, case_status: optional ? 'skipped' : 'failed', details });
    console.log(`${optional ? 'SKIP' : 'FAIL'}  live:${caseKey} — ${details.error}`);
  }
}
let fixture = null;
await liveCase('schema_drift_is_current', async () => {
  const rows = await rest('v_schema_drift_status?select=*'); const row = rows?.[0] || {};
  if (Number(row.latest_applied_schema_version) < 156 || row.drift_status !== 'current') throw new Error(`Expected schema 157 current: ${JSON.stringify(row)}`);
  return row;
});
await liveCase('policy_assertions_pass', async () => {
  const rows = await rest('v_security_policy_assertion_summary?select=*'); const row = rows?.[0] || {};
  if (row.policy_ready !== true) throw new Error(`Policy assertions need review: ${JSON.stringify(row.assertions || [])}`);
  return { passed_count: row.passed_count, assertion_count: row.assertion_count };
});
await liveCase('accountant_mapping_readiness_view', async () => (await rest('v_accountant_export_readiness?select=mapping_ready,unresolved_required_mapping_count,readiness_message'))?.[0] || {});
await liveCase('release_readiness_dashboard_view', async () => {
  const rows = await rest('v_release_readiness_dashboard?select=staging_evidence_status,public_content_status,policy_ready,backup_rehearsal_status'); const row = rows?.[0] || {};
  if (!row.staging_evidence_status) throw new Error('Release readiness dashboard is unavailable.');
  return row;
});
await liveCase('capability_snapshot_has_schema155-actions', async () => {
  const result = await rest('rpc/ywi_get_operations_capabilities', { method: 'POST', body: JSON.stringify({ p_actor_profile_id: actorId }) });
  const snap = Array.isArray(result) ? result[0] : result;
  if (!snap?.actions?.work_order_live_update || !snap?.actions?.work_order_live_update_retract || !snap?.actions?.customer_notification_retry || !snap?.actions?.release_readiness_snapshot) throw new Error('Schema 157 capability actions are missing.');
  return { role: snap.actor_role, rank: snap.actor_rank };
});
const jobAdminJwt = process.env.YWI_STAGING_JOB_ADMIN_JWT || '';
const workerJwt = process.env.YWI_STAGING_WORKER_JWT || '';
if (jobAdminJwt) await liveCase('job_admin_queue_allowed', async () => {
  const result = await functionCall('operations-manage', jobAdminJwt, { action: 'operations_queue_list' });
  if (result.status !== 200 || !result.data?.ok || Number(result.data?.schema) < 156) throw new Error(`Expected allowed schema-155 queue, received HTTP ${result.status}`);
  return { schema: result.data.schema, policy_ready: result.data?.queues?.security_policy?.policy_ready, live_update_queue: Array.isArray(result.data?.queues?.job_updates) };
}); else cases.push({ case_key: 'job_admin_queue_allowed', case_status: 'skipped', details: { reason: 'Set YWI_STAGING_JOB_ADMIN_JWT.' } });
if (workerJwt) await liveCase('worker_queue_denied', async () => {
  const result = await functionCall('operations-manage', workerJwt, { action: 'operations_queue_list' });
  if (result.status !== 403) throw new Error(`Expected HTTP 403, received ${result.status}`);
  return { status: result.status };
}); else cases.push({ case_key: 'worker_queue_denied', case_status: 'skipped', details: { reason: 'Set YWI_STAGING_WORKER_JWT.' } });
if (process.env.YWI_STAGING_CREATE_FIXTURES === '1') await liveCase('fixture_create', async () => {
  const data = await rest('rpc/ywi_rpc_create_staging_fixture_set', { method: 'POST', body: JSON.stringify({ p_actor_profile_id: actorId, p_fixture_label: process.env.YWI_STAGING_FIXTURE_LABEL || 'STAGING-E2E' }) });
  fixture = Array.isArray(data) ? data[0] : data;
  if (!fixture?.fixture_set_id) throw new Error('Fixture RPC did not return fixture_set_id.');
  return { fixture_set_id: fixture.fixture_set_id, ar_invoice_id: fixture.ar_invoice_id, quote_package_id: fixture.quote_package_id };
}); else cases.push({ case_key: 'fixture_create', case_status: 'skipped', details: { reason: 'Set YWI_STAGING_CREATE_FIXTURES=1 to create disposable STAGING records.' } });

const fixtureJson = process.env.YWI_STAGING_RPC_FIXTURES_JSON ? JSON.parse(process.env.YWI_STAGING_RPC_FIXTURES_JSON) : {};
if (fixtureJson.reconciliation_item_id) await liveCase('reconciliation_exact_cent_rejected', async () => {
  const response = await fetch(`${url}/rest/v1/rpc/ywi_rpc_apply_reconciliation_action`, { method: 'POST', headers, body: JSON.stringify({ p_actor_profile_id: actorId, p_payload: { action_type: 'split', bank_row_id: fixtureJson.reconciliation_item_id, reconciliation_item_id: fixtureJson.reconciliation_item_id, split_rows: [{ reference: 'STAGING-A', amount: 0.01 }, { reference: 'STAGING-B', amount: 0.01 }], signoff_note: 'Intentional invalid test split' } }) });
  const raw = await response.text();
  if (response.ok) throw new Error(`Invalid split was unexpectedly accepted: ${raw}`);
  return { http_status: response.status, rejected: true };
}); else cases.push({ case_key: 'reconciliation_exact_cent_rejected', case_status: 'skipped', details: { reason: 'Provide YWI_STAGING_RPC_FIXTURES_JSON with a dedicated reconciliation_item_id.' } });

const liveWorkOrderId = process.env.YWI_STAGING_LIVE_WORK_ORDER_ID || '';
if (uuid(liveWorkOrderId)) await liveCase('staff_live_update_create_and_retract', async () => {
  const createdUpdate = await rest('rpc/ywi_rpc_create_work_order_live_update', { method: 'POST', body: JSON.stringify({
    p_work_order_id: liveWorkOrderId,
    p_actor_profile_id: actorId,
    p_visibility: 'staff',
    p_update_type: 'note',
    p_title: 'STAGING: automated private work update',
    p_message: 'Staging-only harness test. This must not appear in the customer portal.',
    p_metadata: { source: 'operations-rpc-staging-e2e', schema: 157, staging: true }
  }) });
  const row = Array.isArray(createdUpdate) ? createdUpdate[0] : createdUpdate;
  if (!uuid(row?.live_update_id)) throw new Error(`Live update RPC did not return an id: ${JSON.stringify(row)}`);
  const portalRows = await rest(`v_customer_portal_live_updates?select=live_update_id&work_order_id=eq.${encodeURIComponent(liveWorkOrderId)}&live_update_id=eq.${encodeURIComponent(row.live_update_id)}`);
  if ((portalRows || []).length) throw new Error('Staff-only update leaked into the portal view.');
  const retracted = await rest('rpc/ywi_rpc_retract_work_order_live_update', { method: 'POST', body: JSON.stringify({ p_live_update_id: row.live_update_id, p_actor_profile_id: actorId, p_retraction_reason: 'STAGING harness cleanup' }) });
  return { live_update_id: row.live_update_id, portal_rows: portalRows.length, retracted: (Array.isArray(retracted) ? retracted[0] : retracted)?.retracted === true };
}); else cases.push({ case_key: 'staff_live_update_create_and_retract', case_status: 'skipped', details: { reason: 'Set YWI_STAGING_LIVE_WORK_ORDER_ID to a clearly labelled staging work order UUID.' } });

if (fixture && process.env.YWI_STAGING_CLEANUP_FIXTURE === '1') await liveCase('fixture_cleanup', async () => {
  const data = await rest('rpc/ywi_rpc_cleanup_staging_fixture_set', { method: 'POST', body: JSON.stringify({ p_fixture_set_id: fixture.fixture_set_id, p_actor_profile_id: actorId, p_cleanup_note: 'Harness cleanup.' }) });
  return Array.isArray(data) ? data[0] : data;
}); else if (fixture) cases.push({ case_key: 'fixture_cleanup', case_status: 'skipped', details: { reason: 'Fixture kept for manual browser testing. Set YWI_STAGING_CLEANUP_FIXTURE=1 or run scripts/staging-fixtures.mjs cleanup.' } });

const failed = cases.filter((item) => item.case_status === 'failed');
try {
  await rest('operations_staging_test_results', { method: 'POST', body: JSON.stringify(cases.map((item) => ({ ...item, run_id: run.id }))) });
  await rest(`operations_staging_test_runs?id=eq.${encodeURIComponent(run.id)}`, { method: 'PATCH', body: JSON.stringify({ run_status: failed.length ? 'failed' : 'passed', finished_at: new Date().toISOString(), summary: { build: '2026-07-12a', schema: 157, case_count: cases.length, failed_count: failed.length, fixture_set_id: fixture?.fixture_set_id || null, live_work_order_id: uuid(liveWorkOrderId) ? liveWorkOrderId : null } }) });
} catch (error) {
  console.error(`WARN  Could not record full test outcome: ${error instanceof Error ? error.message : String(error)}`);
}
if (failed.length) process.exit(1);
console.log(`\nLIVE staging proof finished: ${cases.filter((c) => c.case_status === 'passed').length} passed, ${cases.filter((c) => c.case_status === 'skipped').length} skipped.`);
