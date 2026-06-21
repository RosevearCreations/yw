#!/usr/bin/env node
/*
  Staging-only proof harness for schema 152.
  Default mode is read-only/static. Live mode refuses to run unless the caller
  explicitly names staging and supplies a confirmation phrase. It never uses
  production credentials by implication.
*/
import fs from 'node:fs';
import process from 'node:process';

const root = process.cwd();
const sql151 = fs.readFileSync('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql', 'utf8');
const sql152 = fs.readFileSync('sql/152_staging_proof_permissions_stripe_health_accountant_export.sql', 'utf8');
const operations = fs.readFileSync('supabase/functions/operations-manage/index.ts', 'utf8');
const webhook = fs.readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8');
const accountant = fs.readFileSync('supabase/functions/accountant-export/index.ts', 'utf8');
const config = fs.readFileSync('supabase/config.toml', 'utf8');

const checks = [];
function add(name, ok, details = '', severity = 'required') { checks.push({ name, ok, details, severity }); }
function hasAll(text, values) { return values.every((value) => text.includes(value)); }
function print() { for (const item of checks) console.log(`${item.ok ? 'PASS' : item.severity === 'optional' ? 'SKIP' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`); }
function exitForChecks() { return checks.some((item) => !item.ok && item.severity === 'required') ? 1 : 0; }

// Read-only source and wiring proof available to every developer/CI run.
add('schema151-transactional-rpcs', hasAll(sql151, [
  'ywi_rpc_post_payment_action', 'ywi_rpc_promote_bank_csv_import', 'ywi_rpc_apply_reconciliation_action',
  'ywi_rpc_accept_quote_package', 'ywi_rpc_prepare_deposit_request', 'ywi_rpc_attach_deposit_checkout',
  'ywi_rpc_record_portal_deposit_paid', 'ywi_rpc_mark_deposit_checkout_status'
]), 'Schema 151 must retain all transactional write RPCs.');
add('schema152-staging-test-records', hasAll(sql152, ['operations_staging_test_runs', 'operations_staging_test_results', 'v_operations_staging_test_summary']), 'Schema 152 must retain durable staging test run/result records.');
add('schema152-visible-role-capabilities', hasAll(sql152, ['ywi_get_operations_capabilities', 'payment_action_decision', 'accountant_export_prepare']), 'Schema 152 must provide server-calculated role capability data.');
add('schema152-stripe-health', hasAll(sql152, ['stripe_webhook_delivery_events', 'v_stripe_webhook_health', 'last_validation_reason']), 'Schema 152 must expose safe webhook delivery health.');
add('schema152-accountant-private-package', hasAll(sql152, ['accountant-exports', 'v_accountant_export_readiness', 'artifact_sha256']), 'Schema 152 must use private accountant artifacts and readiness data.');
add('operations-role-cues-and-fail-closed-deposit', hasAll(operations, ['ywi_get_operations_capabilities', 'v_stripe_webhook_health', 'Manual deposit-status changes are disabled', 'ywi_rpc_post_payment_action']), 'Operations function must return UI capability/health data and block manual paid-deposit bypasses.');
add('stripe-webhook-observability', hasAll(webhook, ['recordDelivery', 'stripe_webhook_delivery_events', 'Invalid Stripe signature.', 'ywi_rpc_record_portal_deposit_paid']), 'Webhook must log safe outcome data only after signature validation.');
add('accountant-export-role-storage-guards', hasAll(accountant, ['roleRank(profile.role) < 45', "const BUCKET = 'accountant-exports'", 'createSignedUrl', 'formula injection guard']), 'Accountant export must restrict access, use private storage/signed URLs, and protect CSV cells.');
add('accountant-function-jwt-config', /\[functions\.accountant-export\]\s+verify_jwt = true/s.test(config), 'accountant-export must require JWT verification.');

const liveRequested = process.env.YWI_RUN_STAGING_RPC_TESTS === '1';
if (!liveRequested) {
  print();
  console.log('\nSKIP live staging checks — set YWI_RUN_STAGING_RPC_TESTS=1 after deploying schema 152 to a non-production project.');
  process.exit(exitForChecks());
}

const url = (process.env.SUPABASE_URL || process.env.SB_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || '';
const label = String(process.env.YWI_STAGING_LABEL || '').trim().toLowerCase();
const confirmation = process.env.YWI_STAGING_CONFIRM || '';
if (!url || !serviceKey) {
  add('live-staging-credentials', false, 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SB_* aliases).');
  print(); process.exit(1);
}
if (label !== 'staging' || confirmation !== 'I_CONFIRM_STAGING_ONLY') {
  add('staging-safety-interlock', false, 'Set YWI_STAGING_LABEL=staging and YWI_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY. The harness refuses ambiguous targets.');
  print(); process.exit(1);
}

async function rest(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let body = null; try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!response.ok) throw new Error(`${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}
async function functionCall(name, token, body) {
  const response = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify(body)
  });
  const raw = await response.text(); let payload = null; try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  return { status: response.status, payload };
}

const runKey = `staging-rpc-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(16).slice(2, 8)}`;
let run = null;
const liveCases = [];
async function liveCase(caseKey, task, optional = false) {
  try {
    const details = await task();
    liveCases.push({ case_key:caseKey, case_status:'passed', details:details || {} });
    console.log(`PASS  live:${caseKey}`);
  } catch (error) {
    const details = { error: error instanceof Error ? error.message : String(error) };
    liveCases.push({ case_key:caseKey, case_status:optional ? 'skipped' : 'failed', details });
    console.log(`${optional ? 'SKIP' : 'FAIL'}  live:${caseKey} — ${details.error}`);
  }
}

try {
  const created = await rest('operations_staging_test_runs', { method:'POST', body:JSON.stringify({ run_key:runKey, environment_label:'staging', suite_name:'operations_rpc_e2e', run_status:'started', summary:{ build:'2026-06-20a', schema:152, source:'scripts/operations-rpc-staging-e2e.mjs' } }) });
  run = Array.isArray(created) ? created[0] : created;
} catch (error) {
  add('live-test-run-record', false, error instanceof Error ? error.message : String(error));
  print(); process.exit(1);
}

await liveCase('schema_drift_is_current', async () => {
  const rows = await rest('v_schema_drift_status?select=*'); const row = rows?.[0];
  if (!row || Number(row.latest_applied_schema_version) < 152 || row.drift_status !== 'current') throw new Error(`Schema 152 is not current: ${JSON.stringify(row || {})}`);
  return { latest_applied_schema_version:row.latest_applied_schema_version, drift_status:row.drift_status };
});
await liveCase('permission_matrix_available', async () => {
  const rows = await rest('v_operation_rpc_permission_matrix?select=test_key,rpc_name,minimum_rank');
  if (!Array.isArray(rows) || rows.length < 8) throw new Error('Expected schema 151/152 permission rows were not returned.');
  return { row_count:rows.length };
});
await liveCase('webhook_health_view_available', async () => {
  const rows = await rest('v_stripe_webhook_health?select=*'); return { present:Array.isArray(rows), latest:rows?.[0]?.latest_event_at || null };
});
await liveCase('accountant_readiness_view_available', async () => {
  const rows = await rest('v_accountant_export_readiness?select=*'); return { package_ready:rows?.[0]?.package_ready ?? null, readiness_message:rows?.[0]?.readiness_message || null };
});

const actorId = process.env.YWI_STAGING_JOB_ADMIN_PROFILE_ID || '';
if (actorId) {
  await liveCase('capability_rpc_for_job_admin', async () => {
    const rows = await rest('rpc/ywi_get_operations_capabilities', { method:'POST', body:JSON.stringify({ p_actor_profile_id:actorId }) });
    const snapshot = Array.isArray(rows) ? rows[0] : rows;
    if (!snapshot?.actions?.payment_action_decision?.permitted) throw new Error('Configured job-admin profile is not allowed to decide payment actions.');
    return { actor_role:snapshot.actor_role, actor_rank:snapshot.actor_rank };
  });
} else {
  liveCases.push({ case_key:'capability_rpc_for_job_admin', case_status:'skipped', details:{ reason:'Set YWI_STAGING_JOB_ADMIN_PROFILE_ID to prove the capability snapshot for a job-admin test account.' } });
  console.log('SKIP  live:capability_rpc_for_job_admin — no YWI_STAGING_JOB_ADMIN_PROFILE_ID');
}

const jobAdminToken = process.env.YWI_STAGING_JOB_ADMIN_JWT || '';
const workerToken = process.env.YWI_STAGING_WORKER_JWT || '';
if (jobAdminToken) {
  await liveCase('job_admin_queue_allowed', async () => {
    const response = await functionCall('operations-manage', jobAdminToken, { action:'operations_queue_list' });
    if (response.status !== 200 || !response.payload?.ok) throw new Error(`Expected job-admin queue success, got HTTP ${response.status}.`);
    return { schema:response.payload.schema, has_capabilities:!!response.payload?.queues?.capabilities };
  });
} else {
  liveCases.push({ case_key:'job_admin_queue_allowed', case_status:'skipped', details:{ reason:'Set YWI_STAGING_JOB_ADMIN_JWT to test protected queue access.' } });
  console.log('SKIP  live:job_admin_queue_allowed — no YWI_STAGING_JOB_ADMIN_JWT');
}
if (workerToken) {
  await liveCase('worker_queue_denied', async () => {
    const response = await functionCall('operations-manage', workerToken, { action:'operations_queue_list' });
    if (response.status !== 403) throw new Error(`Expected worker role rejection (403), got HTTP ${response.status}.`);
    return { status:response.status };
  });
} else {
  liveCases.push({ case_key:'worker_queue_denied', case_status:'skipped', details:{ reason:'Set YWI_STAGING_WORKER_JWT to prove the protected queue role gate.' } });
  console.log('SKIP  live:worker_queue_denied — no YWI_STAGING_WORKER_JWT');
}

const fixtureRaw = process.env.YWI_STAGING_RPC_FIXTURES_JSON || '';
if (jobAdminToken && fixtureRaw) {
  await liveCase('reconciliation_exact_cent_rejected', async () => {
    const fixture = JSON.parse(fixtureRaw);
    if (!fixture.reconciliation_item_id) throw new Error('Fixture JSON needs reconciliation_item_id.');
    const response = await functionCall('operations-manage', jobAdminToken, {
      action:'reconciliation_action', idempotency_key:`staging-invalid-split-${Date.now()}`,
      action_type:'split', bank_row_id:fixture.reconciliation_item_id,
      split_rows:[{ target_reference:'STAGING-INVALID-A', allocated_amount:0.01 },{ target_reference:'STAGING-INVALID-B', allocated_amount:0.01 }],
      signoff_note:'Automated staging guard test; invalid cents must be rejected before persistence.'
    });
    if (response.status < 400 || !String(response.payload?.error || '').includes('exactly to the cent')) throw new Error(`Expected exact-cent rejection, got HTTP ${response.status}: ${JSON.stringify(response.payload)}`);
    return { status:response.status, message:response.payload?.error };
  });
} else {
  liveCases.push({ case_key:'reconciliation_exact_cent_rejected', case_status:'skipped', details:{ reason:'Set YWI_STAGING_JOB_ADMIN_JWT and YWI_STAGING_RPC_FIXTURES_JSON with a reconciliation_item_id to test the exact-cent guard.' } });
  console.log('SKIP  live:reconciliation_exact_cent_rejected — no safe fixture or job-admin JWT');
}

const failedCount = liveCases.filter((item) => item.case_status === 'failed').length;
const passedCount = liveCases.filter((item) => item.case_status === 'passed').length;
const skippedCount = liveCases.filter((item) => item.case_status === 'skipped').length;
try {
  if (liveCases.length) await rest('operations_staging_test_results', { method:'POST', body:JSON.stringify(liveCases.map((item) => ({ ...item, run_id:run.id }))) });
  await rest(`operations_staging_test_runs?id=eq.${encodeURIComponent(run.id)}`, { method:'PATCH', body:JSON.stringify({ run_status:failedCount ? 'failed' : 'passed', finished_at:new Date().toISOString(), summary:{ case_count:liveCases.length, passed_count:passedCount, failed_count:failedCount, skipped_count:skippedCount, build:'2026-06-20a', schema:152 }, failure_reason:failedCount ? `${failedCount} staging case(s) failed.` : null }) });
} catch (error) {
  console.error('Could not finish the durable staging test record:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

print();
console.log(`\nLIVE staging proof recorded: ${passedCount} passed, ${failedCount} failed, ${skippedCount} skipped. Run key: ${runKey}`);
process.exit(failedCount || exitForChecks() ? 1 : 0);
