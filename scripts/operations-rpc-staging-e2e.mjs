#!/usr/bin/env node
/*
  Current-schema staging acceptance runner backed by the Schema 187 scenario catalog.

  Source mode is non-mutating and runs in normal CI.
  Live mode is manual-only and refuses the YardWeasels Production Supabase ref.
  A live run requires the dedicated staging database to match the repository's exact
  current schema marker before any runner-controlled evidence is recorded.
  Human catalog cases remain pending for Admin > I.T. review, finalization, and signoff.
  No evidence path auto-closes a readiness rail.
*/
import fs from 'node:fs';
import process from 'node:process';

const read = (file) => fs.readFileSync(file, 'utf8');
const migration186 = read('sql/186_staging_acceptance_control_plane.sql');
const migration187 = read('sql/187_staging_acceptance_scenario_catalog.sql');
const fixturesScript = read('scripts/staging-fixtures.mjs');
const workflow = read('.github/workflows/staging-browser-integration.yml');
const operations = read('supabase/functions/operations-manage/index.ts');
const config = read('supabase/config.toml');
const all = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok, details = '') => checks.push({ name, ok:!!ok, details });
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
const sha40 = (value) => /^[0-9a-f]{40}$/.test(String(value || '').trim());
const CATALOG_SCHEMA_VERSION = 187;
const schemaFiles = fs.readdirSync('sql').filter((name) => /^\d{3}_.+\.sql$/i.test(name));
const schemaVersions = schemaFiles.map((name) => Number(name.slice(0,3))).filter(Number.isFinite);
const repoLatestSchema = Math.max(...schemaVersions);
const currentSchemaFile = schemaFiles.find((name) => Number(name.slice(0,3)) === repoLatestSchema) || '';
const currentSchemaMigration = currentSchemaFile ? read(`sql/${currentSchemaFile}`) : '';
const expectedMarkerPattern = new RegExp(`\\b${repoLatestSchema}(?:::int)?\\s+as\\s+expected_schema_version\\b`,'i');
const allowedRails = new Set([
  'operations_cockpit_live','quote_intake_live','live_job_updates',
  'customer_live_update_notifications','service_execution_proof_costing',
  'supervisor_closeout_signoff_invoice_followup'
]);

add('schema186-control-plane-still-present', all(migration186,[
  'ywi_rpc_signoff_staging_acceptance_run','staging_evidence_never_auto_closes_scorecard',
  'v_it_staging_acceptance_status'
]));
add('schema187-catalog-authority', all(migration187,[
  'operations_staging_acceptance_scenarios','v_it_staging_acceptance_scenario_plan',
  'ywi_staging_acceptance_catalog_assertions','catalog_exact_six_business_rails'
]));
add('schema187-start-seeds-pending-catalog', all(migration187,[
  "'catalog_case_count'","'catalog_schema',187","s.case_key,'pending'",
  'from public.operations_staging_acceptance_scenarios s'
]));
add('schema187-record-cannot-weaken-catalog', all(migration187,[
  'v_catalog.evidence_kind','v_catalog.is_blocking','v_catalog.expected_outcome',
  'Case % is not enabled in the Schema 187 catalog'
]));
add('schema187-finalize-fail-closed', all(migration187,[
  "case_status='pending'","case_status in ('failed','skipped')",
  'cannot be finalized while % evidence row(s) are pending'
]));
add('current-repository-schema-detected', Number.isInteger(repoLatestSchema) && repoLatestSchema >= CATALOG_SCHEMA_VERSION && !!currentSchemaFile, `${repoLatestSchema}:${currentSchemaFile}`);
add('current-repository-schema-marker-exact', expectedMarkerPattern.test(currentSchemaMigration));
add('fixture-script-project-ref-guard', all(fixturesScript,[
  'YWI_STAGING_PROJECT_REF','YWI_PRODUCTION_PROJECT_REF',
  "'jmqvkgiqlimdhcofwkxr'",'Refusing staging fixture mutation against the YardWeasels Production project ref.'
]));
add('workflow-remains-manual-staging-only', all(workflow,[
  'workflow_dispatch','run_staging','environment: staging','npm run test:staging',
  'Run current-schema staging catalog evidence'
]));
add('operations-cockpit-authority-still-present', all(operations,[
  "action === 'operations_queue_list'",'capabilities: capabilitySnapshot','stripe_health:'
]));
add('operations-manage-source-jwt-required', /\[functions\.operations-manage\]\s*\nverify_jwt = true/.test(config));

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
if (checks.some((item) => !item.ok)) process.exit(1);

const live = process.env.YWI_RUN_STAGING_RPC_TESTS === '1';
if (!live) {
  console.log(`\nSKIP live staging acceptance — source checks only. Repository schema ${repoLatestSchema}; catalog schema ${CATALOG_SCHEMA_VERSION}. Live evidence requires manual workflow dispatch and a dedicated non-production project ref.`);
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
const fixtureLabel = String(process.env.YWI_STAGING_FIXTURE_LABEL || `STAGING-S${repoLatestSchema}-RUN`).trim().toUpperCase();

function fail(message) { console.error(`ERROR  ${message}`); process.exit(1); }
function projectRefFromUrl(value) {
  try {
    const host = new URL(value).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] || '';
  } catch { return ''; }
}

if (!url || !key) fail('Live staging requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
if (label !== 'staging' || confirmation !== 'I_CONFIRM_STAGING_ONLY') fail('Live staging requires YWI_STAGING_LABEL=staging and YWI_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY.');
if (!uuid(actorId)) fail('Set YWI_STAGING_JOB_ADMIN_PROFILE_ID to the dedicated staging admin profile UUID.');
if (!expectedStagingRef) fail('Set YWI_STAGING_PROJECT_REF to the dedicated non-production Supabase project ref.');
if (!sha40(sourceSha)) fail('Set YWI_STAGING_SOURCE_SHA to the exact 40-character commit under test.');
if (!allowedRails.has(targetRail)) fail(`Unsupported staging acceptance rail in catalog Schema ${CATALOG_SCHEMA_VERSION}: ${targetRail}.`);
if (targetRail === 'operations_cockpit_live' && (!jobAdminJwt || !workerJwt)) {
  fail('Operations Cockpit evidence requires both YWI_STAGING_JOB_ADMIN_JWT and YWI_STAGING_WORKER_JWT.');
}
const actualProjectRef = projectRefFromUrl(url);
if (!actualProjectRef || actualProjectRef !== expectedStagingRef) fail(`SUPABASE_URL project ref ${actualProjectRef || '(unresolved)'} does not match YWI_STAGING_PROJECT_REF.`);
if (actualProjectRef === productionRef) fail('Refusing current-schema staging acceptance against the YardWeasels Production project ref.');

const headers = { apikey:key, authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=representation' };
async function rest(path, options = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...options, headers:{ ...headers, ...(options.headers || {}) } });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!res.ok) throw new Error(`${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}
async function rpc(name, body) { return rest(`rpc/${name}`, { method:'POST', body:JSON.stringify(body) }); }
async function functionCall(name, token, body) {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method:'POST',headers:{ apikey:key, authorization:`Bearer ${token}`, 'Content-Type':'application/json' },body:JSON.stringify(body),
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
const latestAppliedSchema = Number(schema.latest_applied_schema_version || 0);
if (schema.drift_status !== 'current' || expectedSchema !== repoLatestSchema || latestAppliedSchema !== repoLatestSchema) {
  fail(`Dedicated staging database must exactly match repository Schema ${repoLatestSchema} before acceptance: ${JSON.stringify(schema)}`);
}

const catalogRows = await rest(`operations_staging_acceptance_scenarios?select=case_key,evidence_kind,verification_mode,is_blocking,expected_outcome,sort_order&rail_key=eq.${encodeURIComponent(targetRail)}&is_enabled=eq.true&order=sort_order.asc`);
if (!Array.isArray(catalogRows) || !catalogRows.length) fail(`No enabled staging catalog scenarios (catalog Schema ${CATALOG_SCHEMA_VERSION}) were returned for ${targetRail}.`);
if (!catalogRows.some((row) => row.verification_mode === 'human' && row.is_blocking === true)) fail(`Target rail ${targetRail} has no blocking human evidence case.`);
const catalogByKey = new Map(catalogRows.map((row) => [row.case_key,row]));

let fixture = null;
let run = null;
const recordedCases = [];
let cleanupFailure = null;
try {
  if (createFixtures) {
    const createdFixture = await rpc('ywi_rpc_create_staging_fixture_set', { p_actor_profile_id:actorId,p_fixture_label:fixtureLabel });
    fixture = scalarJson(createdFixture) || createdFixture;
    if (!fixture?.fixture_set_id) throw new Error('Staging fixture RPC did not return fixture_set_id.');
    console.log(`FIXTURE  ${fixture.fixture_set_id} created in ${actualProjectRef}`);
  }

  const runKey = `staging-s${repoLatestSchema}-${targetRail}-${new Date().toISOString().replace(/[:.]/g,'-')}-${Math.random().toString(16).slice(2,8)}`;
  const started = await rpc('ywi_rpc_start_staging_acceptance_run', {
    p_actor_profile_id:actorId,p_run_key:runKey,p_suite_name:`schema${repoLatestSchema}_${targetRail}_acceptance`,p_target_rail_key:targetRail,
    p_source_sha:sourceSha,p_schema_version:expectedSchema,p_source_workflow_run_id:workflowRunId,p_fixture_set_id:fixture?.fixture_set_id || null,
  });
  run = scalarJson(started) || started;
  if (!uuid(run?.run_id)) throw new Error(`Start acceptance RPC did not return run_id: ${JSON.stringify(run)}`);
  if (Number(run?.catalog_case_count || 0) !== catalogRows.length) throw new Error(`Run seeded ${run?.catalog_case_count} cases but catalog returned ${catalogRows.length}.`);
  console.log(`RUN  ${run.run_id} started for ${targetRail} on repository Schema ${repoLatestSchema} with ${catalogRows.length} catalog cases.`);

  async function liveCase(caseKey, fn) {
    const catalog = catalogByKey.get(caseKey);
    if (!catalog) throw new Error(`Runner attempted uncatalogued case ${caseKey} for ${targetRail}.`);
    if (catalog.verification_mode !== 'runner') throw new Error(`Runner cannot mark human-controlled case ${caseKey}.`);
    let status='passed'; let observed=''; let details={};
    try {
      const value = await fn(); details = value && typeof value === 'object' ? value : { value }; observed='passed';
      console.log(`PASS  live:${caseKey}`);
    } catch (error) {
      status='failed'; observed=error instanceof Error ? error.message : String(error); details={ error:observed };
      console.log(`FAIL  live:${caseKey} — ${observed}`);
    }
    await rpc('ywi_rpc_record_staging_acceptance_result', {
      p_run_id:run.run_id,p_actor_profile_id:actorId,p_case_key:caseKey,p_case_status:status,
      p_evidence_kind:catalog.evidence_kind,p_is_blocking:catalog.is_blocking,p_expected_outcome:catalog.expected_outcome,
      p_observed_outcome:observed || null,p_details:details,
    });
    recordedCases.push({ case_key:caseKey,case_status:status,is_blocking:catalog.is_blocking });
  }

  await liveCase('schema_current', async () => ({ ...schema, repository_schema:repoLatestSchema, catalog_schema:CATALOG_SCHEMA_VERSION }));
  await liveCase('staging_security_assertions', async () => {
    const [securityRows,catalogAssertions] = await Promise.all([
      rpc('ywi_staging_acceptance_security_assertions',{}),rpc('ywi_staging_acceptance_catalog_assertions',{})
    ]);
    const failed = [...(Array.isArray(securityRows)?securityRows:[]),...(Array.isArray(catalogAssertions)?catalogAssertions:[])]
      .filter((row) => row?.assertion_status !== 'passed');
    if (failed.length) throw new Error(`Staging acceptance assertions failed: ${JSON.stringify(failed)}`);
    return { security_assertion_count:Array.isArray(securityRows)?securityRows.length:0,catalog_assertion_count:Array.isArray(catalogAssertions)?catalogAssertions.length:0 };
  });
  await liveCase('target_rail_visible', async () => {
    const rows = await rest(`v_it_staging_acceptance_status?select=rail_key,staging_acceptance_status,requires_human,acceptance_complete&rail_key=eq.${encodeURIComponent(targetRail)}`);
    const row=rows?.[0];
    if (!row || row.rail_key!==targetRail || row.requires_human!==true || row.acceptance_complete===true) throw new Error(`Target rail is not open and human-gated: ${JSON.stringify(row)}`);
    return row;
  });

  if (targetRail === 'operations_cockpit_live') {
    await liveCase('operations_cockpit_admin_allowed', async () => {
      const result=await functionCall('operations-manage',jobAdminJwt,{action:'operations_queue_list'});
      if (result.status!==200 || !result.data?.ok || !result.data?.capabilities || !result.data?.stripe_health) throw new Error(`Expected protected Cockpit HTTP 200 with capabilities/Stripe health, received ${result.status}: ${JSON.stringify(result.data)}`);
      return { http_status:result.status,schema:result.data?.schema,has_capabilities:true,has_stripe_health:true };
    });
    await liveCase('operations_cockpit_worker_denied', async () => {
      const result=await functionCall('operations-manage',workerJwt,{action:'operations_queue_list'});
      if (result.status!==403) throw new Error(`Expected HTTP 403 for lower-rank worker, received ${result.status}.`);
      return { http_status:result.status };
    });
  }

  if (fixture?.fixture_set_id) {
    const cleaned=await rpc('ywi_rpc_cleanup_staging_fixture_set',{
      p_fixture_set_id:fixture.fixture_set_id,p_actor_profile_id:actorId,
      p_cleanup_note:`Current-schema staging runner cleanup for Schema ${repoLatestSchema}, run ${run.run_id}.`
    });
    const result=scalarJson(cleaned)||cleaned;
    if (result?.cleaned!==true && result?.already_cleaned!==true) throw new Error(`Fixture cleanup did not confirm completion: ${JSON.stringify(result)}`);
    fixture.cleaned=true;
    console.log(`FIXTURE  ${fixture.fixture_set_id} cleaned.`);
  }

  const plan = await rest(`v_it_staging_acceptance_scenario_plan?select=case_key,case_title,verification_mode,is_blocking,evidence_status,human_action_required&run_id=eq.${run.run_id}&order=case_sort_order.asc`);
  const pendingHuman=(Array.isArray(plan)?plan:[]).filter((row)=>row.verification_mode==='human' && row.evidence_status==='pending_evidence');
  const runnerFailed=recordedCases.filter((row)=>row.case_status==='failed' && row.is_blocking).length;
  console.log(JSON.stringify({
    staging_project_ref:actualProjectRef,target_rail:targetRail,source_sha:sourceSha,workflow_run_id:workflowRunId,
    repository_schema:repoLatestSchema,catalog_schema:CATALOG_SCHEMA_VERSION,
    run_id:run.run_id,catalog_case_count:catalogRows.length,runner_case_count:recordedCases.length,
    runner_blocking_failed_count:runnerFailed,pending_human_case_count:pendingHuman.length,
    next_action:runnerFailed
      ? 'Resolve failed runner evidence before recording human cases. The scorecard rail remains open.'
      : 'Open Admin > I.T., record every pending human catalog case, finalize the run, then explicitly approve/reject it. The scorecard rail remains open.',
  },null,2));
  if (runnerFailed) process.exitCode=1;
} catch (error) {
  if (fixture?.fixture_set_id && fixture.cleaned!==true) {
    try {
      await rpc('ywi_rpc_cleanup_staging_fixture_set',{
        p_fixture_set_id:fixture.fixture_set_id,p_actor_profile_id:actorId,
        p_cleanup_note:`Emergency cleanup after current-schema staging runner failure on Schema ${repoLatestSchema}.`
      });
    } catch (cleanupError) { cleanupFailure=cleanupError instanceof Error?cleanupError.message:String(cleanupError); }
  }
  console.error(`ERROR  ${error instanceof Error?error.message:String(error)}`);
  if (cleanupFailure) console.error(`ERROR  fixture cleanup also failed: ${cleanupFailure}`);
  process.exitCode=1;
}
