#!/usr/bin/env node
/*
  Schema 186 staging acceptance runner.

  Source mode is non-mutating and runs in normal CI.
  Live mode is manual-only and refuses the YardWeasels Production Supabase ref.
  Every live case is written to the canonical operations_staging_test_* evidence tables
  through service-role-only Schema 186 RPCs. Automated success never closes a scorecard rail;
  human-required rails stop at awaiting_human_signoff.
*/
import fs from 'node:fs';
import process from 'node:process';

const read = (file) => fs.readFileSync(file, 'utf8');
const migration = read('sql/186_staging_acceptance_control_plane.sql');
const fixturesScript = read('scripts/staging-fixtures.mjs');
const workflow = read('.github/workflows/staging-browser-integration.yml');
const operations = read('supabase/functions/operations-manage/index.ts');
const config = read('supabase/config.toml');
const all = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok, details = '') => checks.push({ name, ok:!!ok, details });
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
const sha40 = (value) => /^[0-9a-f]{40}$/.test(String(value || '').trim());

add('schema186-control-plane-rpcs', all(migration,[
  'ywi_rpc_start_staging_acceptance_run','ywi_rpc_record_staging_acceptance_result',
  'ywi_rpc_finalize_staging_acceptance_run','ywi_rpc_signoff_staging_acceptance_run'
]));
add('schema186-human-signoff-fail-closed', all(migration,[
  'human_signoff_required','awaiting_human_signoff','scorecard_auto_closed',
  "human_signoff_status='approved'",'staging_evidence_never_auto_closes_scorecard'
]));
add('schema186-private-staging-authority', all(migration,[
  'revoke all on table public.operations_staging_test_runs from public,anon,authenticated;',
  'revoke all on table public.operations_staging_test_results from public,anon,authenticated;',
  'revoke all on function public.ywi_rpc_create_staging_fixture_set(uuid,text) from public,anon,authenticated;',
  'staging_acceptance_rpcs_service_only'
]));
add('schema186-current-source-binding', all(migration,[
  'target_rail_key','source_sha','source_workflow_run_id','schema_version',
  'v_schema_drift_status','staging_active_runs_current_schema'
]));
add('schema186-it-status-view', all(migration,[
  'v_it_staging_acceptance_status','staging_acceptance_status','acceptance_complete'
]));
add('schema186-marker-converges-now', migration.includes('186::int as expected_schema_version') && migration.includes("186,'186_staging_acceptance_control_plane'"));
add('fixture-script-project-ref-guard', all(fixturesScript,[
  'YWI_STAGING_PROJECT_REF','YWI_PRODUCTION_PROJECT_REF',
  "'jmqvkgiqlimdhcofwkxr'",'Refusing staging fixture mutation against the YardWeasels Production project ref.'
]));
add('workflow-remains-manual-staging-only', all(workflow,[
  'workflow_dispatch','run_staging','environment: staging','npm run test:staging'
]));
add('operations-cockpit-authority-still-present', all(operations,[
  "action === 'operations_queue_list'",'capabilities: capabilitySnapshot','stripe_health:'
]));
add('operations-manage-source-jwt-required', /\[functions\.operations-manage\]\s*\nverify_jwt = true/.test(config));

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
if (checks.some((item) => !item.ok)) process.exit(1);

const live = process.env.YWI_RUN_STAGING_RPC_TESTS === '1';
if (!live) {
  console.log('\nSKIP live staging acceptance — source checks only. Manual staging requires YWI_RUN_STAGING_RPC_TESTS=1 and a dedicated non-production project ref.');
  process.exit(0);
}

const url = (process.env.SUPABASE_URL || process.env.SB_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || '';
const label = String(process.env.YWI_STAGING_LABEL || '').trim().toLowerCase();
const confirmation = process.env.YWI_STAGING_CONFIRM || '';
const actorId = String(process.env.YWI_STAGING_JOB_ADMIN_PROFILE_ID || '').trim();
const jobAdminJwt = String(process.env.YWI_STAGING_JOB_ADMIN_JWT || '').trim();
const workerJwt = String(process.env.YWI_STAGING_WORKER_JWT || '').trim();
const expectedStagingRef = String(process.env.YWI_STAGING_PROJECT_REF || '').trim();
const productionRef = String(process.env.YWI_PRODUCTION_PROJECT_REF || 'jmqvkgiqlimdhcofwkxr').trim();
const sourceSha = String(process.env.YWI_STAGING_SOURCE_SHA || '').trim().toLowerCase();
const workflowRunId = Number(process.env.YWI_STAGING_WORKFLOW_RUN_ID || 0) || null;
const targetRail = String(process.env.YWI_STAGING_TARGET_RAIL || 'operations_cockpit_live').trim();
const createFixtures = process.env.YWI_STAGING_CREATE_FIXTURES === '1';
const fixtureLabel = String(process.env.YWI_STAGING_FIXTURE_LABEL || 'STAGING-B186-OPS').trim().toUpperCase();

function fail(message) { console.error(`ERROR  ${message}`); process.exit(1); }
function projectRefFromUrl(value) {
  try {
    const host = new URL(value).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

if (!url || !key) fail('Live staging requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
if (label !== 'staging' || confirmation !== 'I_CONFIRM_STAGING_ONLY') fail('Live staging requires YWI_STAGING_LABEL=staging and YWI_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY.');
if (!uuid(actorId)) fail('Set YWI_STAGING_JOB_ADMIN_PROFILE_ID to the dedicated staging admin profile UUID.');
if (!jobAdminJwt || !workerJwt) fail('Set both YWI_STAGING_JOB_ADMIN_JWT and YWI_STAGING_WORKER_JWT for role-boundary acceptance.');
if (!expectedStagingRef) fail('Set YWI_STAGING_PROJECT_REF to the dedicated non-production Supabase project ref.');
if (!sha40(sourceSha)) fail('Set YWI_STAGING_SOURCE_SHA to the exact 40-character commit under test.');
if (targetRail !== 'operations_cockpit_live') fail('Build 186 live execution is bounded to operations_cockpit_live. Later builds may add other rail-specific suites.');
const actualProjectRef = projectRefFromUrl(url);
if (!actualProjectRef || actualProjectRef !== expectedStagingRef) fail(`SUPABASE_URL project ref ${actualProjectRef || '(unresolved)'} does not match YWI_STAGING_PROJECT_REF.`);
if (actualProjectRef === productionRef) fail('Refusing Build 186 staging acceptance against the YardWeasels Production project ref.');

const headers = { apikey:key, authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=representation' };
async function rest(path, options = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...options, headers:{ ...headers, ...(options.headers || {}) } });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!res.ok) throw new Error(`${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}
async function rpc(name, body) {
  return rest(`rpc/${name}`, { method:'POST', body:JSON.stringify(body) });
}
async function functionCall(name, token, body) {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method:'POST',
    headers:{ apikey:key, authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
    body:JSON.stringify(body),
  });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status:res.status, data };
}
const scalarJson = (value) => Array.isArray(value) ? value[0] : value;

const schemaRows = await rest('v_schema_drift_status?select=expected_schema_version,latest_applied_schema_version,drift_status');
const schema = schemaRows?.[0] || {};
const expectedSchema = Number(schema.expected_schema_version || 0);
if (schema.drift_status !== 'current' || expectedSchema < 186 || Number(schema.latest_applied_schema_version || 0) < expectedSchema) {
  fail(`Dedicated staging database must be current on Schema 186+ before acceptance: ${JSON.stringify(schema)}`);
}

let fixture = null;
let run = null;
const recordedCases = [];
let cleanupFailure = null;
try {
  if (createFixtures) {
    const createdFixture = await rpc('ywi_rpc_create_staging_fixture_set', {
      p_actor_profile_id:actorId,
      p_fixture_label:fixtureLabel,
    });
    fixture = scalarJson(createdFixture) || createdFixture;
    if (!fixture?.fixture_set_id) throw new Error('Staging fixture RPC did not return fixture_set_id.');
    console.log(`FIXTURE  ${fixture.fixture_set_id} created in ${actualProjectRef}`);
  }

  const runKey = `staging-b186-${targetRail}-${new Date().toISOString().replace(/[:.]/g,'-')}-${Math.random().toString(16).slice(2,8)}`;
  const started = await rpc('ywi_rpc_start_staging_acceptance_run', {
    p_actor_profile_id:actorId,
    p_run_key:runKey,
    p_suite_name:'build186_operations_cockpit_acceptance',
    p_target_rail_key:targetRail,
    p_source_sha:sourceSha,
    p_schema_version:expectedSchema,
    p_source_workflow_run_id:workflowRunId,
    p_fixture_set_id:fixture?.fixture_set_id || null,
  });
  run = scalarJson(started) || started;
  if (!uuid(run?.run_id)) throw new Error(`Start acceptance RPC did not return run_id: ${JSON.stringify(run)}`);
  console.log(`RUN  ${run.run_id} started for ${targetRail}`);

  async function liveCase(caseKey, fn, { kind='runtime', blocking=true, expected='' } = {}) {
    let status='passed';
    let observed='';
    let details={};
    try {
      const value = await fn();
      details = value && typeof value === 'object' ? value : { value };
      observed = 'passed';
      console.log(`PASS  live:${caseKey}`);
    } catch (error) {
      status='failed';
      observed = error instanceof Error ? error.message : String(error);
      details={ error:observed };
      console.log(`FAIL  live:${caseKey} — ${observed}`);
    }
    await rpc('ywi_rpc_record_staging_acceptance_result', {
      p_run_id:run.run_id,
      p_actor_profile_id:actorId,
      p_case_key:caseKey,
      p_case_status:status,
      p_evidence_kind:kind,
      p_is_blocking:blocking,
      p_expected_outcome:expected || null,
      p_observed_outcome:observed || null,
      p_details:details,
    });
    recordedCases.push({ case_key:caseKey, case_status:status, is_blocking:blocking });
  }

  await liveCase('schema_186_current', async () => {
    if (schema.drift_status !== 'current' || expectedSchema < 186) throw new Error(`Schema not current: ${JSON.stringify(schema)}`);
    return schema;
  }, { expected:'Dedicated staging schema is current at Schema 186 or later.' });

  await liveCase('staging_acceptance_security_assertions', async () => {
    const rows = await rpc('ywi_staging_acceptance_security_assertions', {});
    const failed = (Array.isArray(rows) ? rows : []).filter((row) => row?.assertion_status !== 'passed');
    if (failed.length) throw new Error(`Staging acceptance security assertions failed: ${JSON.stringify(failed)}`);
    return { assertion_count:Array.isArray(rows) ? rows.length : 0, failed_count:failed.length };
  }, { expected:'All Schema 186 staging acceptance security assertions pass.' });

  await liveCase('target_rail_visible_in_it_status', async () => {
    const rows = await rest(`v_it_staging_acceptance_status?select=rail_key,staging_acceptance_status,requires_human,acceptance_complete&rail_key=eq.${encodeURIComponent(targetRail)}`);
    const row = rows?.[0];
    if (!row || row.rail_key !== targetRail) throw new Error('Target staging rail is not visible in the I.T. acceptance status view.');
    if (row.requires_human !== true) throw new Error('Operations Cockpit staging acceptance must remain human-gated.');
    return row;
  }, { expected:'Operations Cockpit appears as a human-gated staging acceptance rail.' });

  await liveCase('operations_capability_snapshot', async () => {
    const data = await rpc('ywi_get_operations_capabilities', { p_actor_profile_id:actorId });
    const snap = scalarJson(data) || data;
    if (!snap?.actor_role || Number(snap?.actor_rank || 0) < 30) throw new Error(`Unexpected Operations capability snapshot: ${JSON.stringify(snap)}`);
    return { actor_role:snap.actor_role, actor_rank:snap.actor_rank, actions:snap.actions || {} };
  }, { expected:'Staging admin resolves to an Operations-capable role/rank.' });

  await liveCase('operations_cockpit_job_admin_allowed', async () => {
    const result = await functionCall('operations-manage',jobAdminJwt,{ action:'operations_queue_list' });
    if (result.status !== 200 || !result.data?.ok) throw new Error(`Expected HTTP 200 from Operations Cockpit queue, received ${result.status}: ${JSON.stringify(result.data)}`);
    if (!result.data?.capabilities) throw new Error('Operations Cockpit payload is missing capability evidence.');
    if (!result.data?.stripe_health) throw new Error('Operations Cockpit payload is missing Stripe health evidence card data.');
    return { http_status:result.status, schema:result.data?.schema, has_capabilities:true, has_stripe_health:true };
  }, { kind:'browser', expected:'Authorized staging job admin can load Operations Cockpit capabilities and Stripe health.' });

  await liveCase('operations_cockpit_worker_denied', async () => {
    const result = await functionCall('operations-manage',workerJwt,{ action:'operations_queue_list' });
    if (result.status !== 403) throw new Error(`Expected HTTP 403 for worker Cockpit queue access, received ${result.status}.`);
    return { http_status:result.status };
  }, { kind:'browser', expected:'Lower-rank worker is denied the protected Operations Cockpit queue.' });

  if (fixture?.fixture_set_id) {
    await liveCase('fixture_cleanup', async () => {
      const cleaned = await rpc('ywi_rpc_cleanup_staging_fixture_set', {
        p_fixture_set_id:fixture.fixture_set_id,
        p_actor_profile_id:actorId,
        p_cleanup_note:`Build 186 acceptance cleanup for ${run.run_id}.`,
      });
      const result = scalarJson(cleaned) || cleaned;
      if (result?.cleaned !== true && result?.already_cleaned !== true) throw new Error(`Fixture cleanup did not confirm completion: ${JSON.stringify(result)}`);
      fixture.cleaned = true;
      return { fixture_set_id:fixture.fixture_set_id, cleaned:true };
    }, { kind:'automated', expected:'Any disposable Build 186 fixture set is cleaned before run finalization.' });
  }

  const blockingFailed = recordedCases.filter((row) => row.case_status === 'failed' && row.is_blocking).length;
  const finalized = await rpc('ywi_rpc_finalize_staging_acceptance_run', {
    p_run_id:run.run_id,
    p_actor_profile_id:actorId,
    p_failure_reason:blockingFailed ? `${blockingFailed} blocking Build 186 staging acceptance case(s) failed.` : null,
  });
  const finalResult = scalarJson(finalized) || finalized;
  console.log(JSON.stringify({
    staging_project_ref:actualProjectRef,
    target_rail:targetRail,
    source_sha:sourceSha,
    workflow_run_id:workflowRunId,
    run:finalResult,
    case_count:recordedCases.length,
    blocking_failed_count:blockingFailed,
    next_action:finalResult?.acceptance_status === 'awaiting_human_signoff'
      ? 'Human staging reviewer must inspect the Cockpit evidence and explicitly approve/reject the run. The scorecard rail remains open.'
      : 'Resolve failed staging cases. The scorecard rail remains open.',
  }, null, 2));
  if (blockingFailed || finalResult?.run_status !== 'passed') process.exitCode=1;
} catch (error) {
  if (fixture?.fixture_set_id && fixture.cleaned !== true) {
    try {
      await rpc('ywi_rpc_cleanup_staging_fixture_set', {
        p_fixture_set_id:fixture.fixture_set_id,
        p_actor_profile_id:actorId,
        p_cleanup_note:'Emergency cleanup after Build 186 staging runner failure.',
      });
    } catch (cleanupError) {
      cleanupFailure = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    }
  }
  console.error(`ERROR  ${error instanceof Error ? error.message : String(error)}`);
  if (cleanupFailure) console.error(`ERROR  fixture cleanup also failed: ${cleanupFailure}`);
  process.exitCode=1;
}
