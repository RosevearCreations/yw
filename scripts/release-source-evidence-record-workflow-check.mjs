#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath='.github/workflows/release-source-evidence-authorized-record.yml';
const recorderPath='scripts/release-source-evidence-record.mjs';
const verifierPath='scripts/release-source-evidence-verify.mjs';
const edgePath='supabase/functions/release-source-evidence-record/index.ts';
const configPath='supabase/config.toml';
const workflow=fs.readFileSync(workflowPath,'utf8');
const recorder=fs.readFileSync(recorderPath,'utf8');
const verifier=fs.readFileSync(verifierPath,'utf8');
const edge=fs.readFileSync(edgePath,'utf8');
const config=fs.readFileSync(configPath,'utf8');
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:Boolean(ok),detail});
const has=(text)=>workflow.includes(text);
const edgeHas=(text)=>edge.includes(text);

add('workflow-exact-main-completion-trigger',
  has('workflow_run:')&&has('workflows:\n      - YWI source and staging checks')&&has('types:\n      - completed'),
  'Automatic recording may start only after the canonical source workflow completes.');
add('workflow-manual-recovery-dispatch-preserved',
  has('workflow_dispatch:')&&has('source_run_id:')&&has('source_run_attempt:')&&has('confirm_record:'),
  'Manual exact-run recovery remains available if automatic recording cannot complete.');
add('workflow-pr-contract-only',
  has("if: ${{ github.event_name == 'pull_request' }}")&&has('node scripts/release-source-evidence-record-workflow-check.mjs'));
add('workflow-auto-recording-requires-successful-main-push',
  has("github.event_name == 'workflow_run'")&&
  has("github.event.workflow_run.conclusion == 'success'")&&
  has("github.event.workflow_run.event == 'push'")&&
  has("github.event.workflow_run.head_branch == 'main'"),
  'PR, failed, non-main and non-push workflow completions cannot record Production evidence.');
add('workflow-manual-recording-remains-explicit-main-only',
  has("github.event_name == 'workflow_dispatch'")&&
  has("github.ref == 'refs/heads/main'")&&
  has("inputs.confirm_record == 'I_CONFIRM_RELEASE_EVIDENCE_RECORD'"));
add('workflow-source-identity-derived-from-trigger',
  has("SOURCE_RUN_ID: ${{ github.event_name == 'workflow_run' && github.event.workflow_run.id || inputs.source_run_id }}")&&
  has("SOURCE_RUN_ATTEMPT: ${{ github.event_name == 'workflow_run' && github.event.workflow_run.run_attempt || inputs.source_run_attempt }}")&&
  has("SOURCE_HEAD_SHA: ${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}"),
  'Automatic recording is pinned to the exact completed run and head SHA.');
add('workflow-checkout-pinned-to-source-head',has('ref: ${{ env.SOURCE_HEAD_SHA }}'));
add('workflow-github-permissions-minimal-plus-oidc',
  has('permissions:\n  contents: read\n  actions: read\n  id-token: write'),
  'GitHub source access remains read-only; id-token:write only permits short-lived OIDC token minting.');
add('workflow-concurrency-serialized',has('group: ywi-authorized-release-source-evidence-recording')&&has('cancel-in-progress: false'));
add('workflow-current-action-runtimes',!/@v4\b/.test(workflow.match(/actions\/(?:checkout|setup-node)@v\d+/g)?.join('\n')||'')&&has('actions/checkout@v7')&&has('actions/setup-node@v7'));
add('workflow-node22',has("node-version: '22'")&&!has("node-version: '20'"));
add('workflow-production-recorder-pinned',
  has('YWI_RELEASE_RECORDER_URL: https://jmqvkgiqlimdhcofwkxr.supabase.co/functions/v1/release-source-evidence-record')&&
  has("[[ \"$YWI_RELEASE_RECORDER_URL\" == 'https://jmqvkgiqlimdhcofwkxr.supabase.co/functions/v1/release-source-evidence-record' ]]"));
add('workflow-oidc-audience-pinned',has('YWI_RELEASE_OIDC_AUDIENCE: ywi-release-evidence')&&has("[[ \"$YWI_RELEASE_OIDC_AUDIENCE\" == 'ywi-release-evidence' ]]"));
add('workflow-no-long-lived-database-secret',
  !has('SUPABASE_SERVICE_ROLE_KEY')&&!has('secrets.SUPABASE_SERVICE_ROLE_KEY'),
  'Automatic recording must not duplicate the Production service-role credential into GitHub.');
add('workflow-positive-source-validation',
  has('source_run_id must be a positive integer.')&&
  has('source_run_attempt must be a positive integer.')&&
  has('source_head_sha must be a full lowercase commit SHA.'));
add('workflow-run-attempt-scoped-artifact',has('ywi-main-release-source-${{ env.SOURCE_RUN_ID }}-${{ env.SOURCE_RUN_ATTEMPT }}'));
add('workflow-downloads-from-exact-run',has('run-id: ${{ env.SOURCE_RUN_ID }}')&&has('repository: ${{ github.repository }}')&&has('github-token: ${{ github.token }}'));
add('workflow-fresh-run-and-main-lookups',has('gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${SOURCE_RUN_ID}"')&&has('gh api "repos/${GITHUB_REPOSITORY}/branches/main"'));
const verifyPos=workflow.indexOf('node scripts/release-source-evidence-verify.mjs');
const oidcPos=workflow.indexOf('ACTIONS_ID_TOKEN_REQUEST_TOKEN');
const recorderCallPos=workflow.indexOf('"$YWI_RELEASE_RECORDER_URL"');
add('workflow-verifies-before-oidc-recording',verifyPos>=0&&oidcPos>verifyPos&&recorderCallPos>oidcPos);
add('workflow-requests-short-lived-github-oidc',
  has('ACTIONS_ID_TOKEN_REQUEST_TOKEN')&&has('ACTIONS_ID_TOKEN_REQUEST_URL')&&has('audience=${YWI_RELEASE_OIDC_AUDIENCE}'));
add('workflow-sends-verified-payload-only',
  has('--slurpfile verified "$YWI_RELEASE_VERIFIED_PATH"')&&
  has('{verified:$verified[0],source_run_id:$source_run_id,source_run_attempt:$source_run_attempt}'));
add('workflow-requires-green-recorder-response',
  has('.ok == true')&&has('.source_gate_status == "green"')&&has('.repository_enforcement_status == "green"'));
add('workflow-cleanup-always',has('if: ${{ always() }}')&&has('release-record-request.json')&&has('release-record-response.json'));
add('workflow-no-production-source-promotion',!has('git push')&&!has('gh pr merge')&&!has('update_ref'));
add('workflow-no-provider-or-staging-mutation',!has('STRIPE')&&!has('PAYPAL')&&!has('YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED'));

add('edge-custom-auth-source-present',edgeHas("from \"npm:jose@6.1.0\"")&&edgeHas('GitHub OIDC bearer token is required.'));
add('edge-github-issuer-and-jwks-pinned',
  edgeHas("const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com'")&&
  edgeHas("https://token.actions.githubusercontent.com/.well-known/jwks"));
add('edge-audience-pinned',edgeHas("const EXPECTED_AUDIENCE = 'ywi-release-evidence'")&&edgeHas('audience: EXPECTED_AUDIENCE'));
add('edge-repository-identity-pinned',
  edgeHas("const EXPECTED_REPOSITORY = 'RosevearCreations/yw'")&&
  edgeHas("const EXPECTED_REPOSITORY_ID = '1148400822'")&&
  edgeHas("const EXPECTED_OWNER = 'RosevearCreations'"));
add('edge-main-ref-and-recorder-workflow-pinned',
  edgeHas("const EXPECTED_REF = 'refs/heads/main'")&&
  edgeHas("RosevearCreations/yw/.github/workflows/release-source-evidence-authorized-record.yml@refs/heads/main")&&
  edgeHas('payload.workflow_ref !== EXPECTED_RECORDER_WORKFLOW_REF'));
add('edge-only-recorder-events',edgeHas("['workflow_run', 'workflow_dispatch'].includes(clean(payload.event_name, 80))"));
add('edge-oidc-sha-binds-verified-source',edgeHas("fullSha(oidc.sha) !== sourceSha"));
add('edge-production-project-pinned',edgeHas("const EXPECTED_PROJECT_REF = 'jmqvkgiqlimdhcofwkxr'")&&edgeHas('actualProjectRef !== EXPECTED_PROJECT_REF'));
add('edge-service-role-stays-inside-supabase',
  edgeHas("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')")&&
  !workflow.includes('SUPABASE_SERVICE_ROLE_KEY'),
  'The service role is consumed only inside the Supabase runtime, never exported to GitHub.');
add('edge-requires-current-schema-authority',
  edgeHas(".from('v_schema_drift_status')")&&
  edgeHas("schema?.drift_status !== 'current'")&&
  edgeHas('expectedSchema !== liveSchema')&&
  edgeHas('schemaVersion !== expectedSchema'));
add('edge-fresh-github-reverification',
  edgeHas(`/repos/${'${EXPECTED_REPOSITORY}'}/actions/runs/${'${runId}'}`)&&
  edgeHas(`/repos/${'${EXPECTED_REPOSITORY}'}/branches/main`));
add('edge-requires-fresh-protected-current-main',
  edgeHas("run.status !== 'completed' || run.conclusion !== 'success'")&&
  edgeHas('fullSha(main?.commit?.sha) !== sourceSha')&&
  edgeHas('main.protected !== true'));
add('edge-24-hour-freshness',edgeHas('MAX_VERIFICATION_AGE_MS = 24 * 60 * 60 * 1000')&&edgeHas('verified evidence is older than 24 hours'));
add('edge-keeps-detailed-policy-unverified',edgeHas("verified.branch_policy_verified !== false")&&edgeHas("db.branch_policy_verified !== false"));
add('edge-release-metadata-only',
  edgeHas("supabase.rpc('ywi_record_verified_release_source_evidence'")&&
  !edgeHas('finance_job_completion_posting_execution_controls')&&
  !edgeHas('operations_staging_test_runs')&&
  !edgeHas('profiles')&&
  !edgeHas('auth.admin'),
  'OIDC recorder has one narrow metadata RPC and no business, staging, identity or provider mutation path.');
add('edge-rereads-green-authority',
  edgeHas(".from('v_it_release_source_evidence_current')")&&
  edgeHas("current.source_gate_status !== 'green'")&&
  edgeHas("current.repository_enforcement_status !== 'green'"));
add('config-custom-auth-explicit',
  /\[functions\.release-source-evidence-record\]\s*\nverify_jwt\s*=\s*false/.test(config),
  'Supabase JWT verification is intentionally disabled only because the function performs GitHub OIDC JWT verification itself.');

add('legacy-recorder-fresh-github-reverification',recorder.includes('/actions/runs/${shape.runId}')&&recorder.includes('/branches/main'));
add('legacy-recorder-requires-protected-main',recorder.includes("mainBranch.protected!==true")&&recorder.includes('GitHub must still report current main protected=true immediately before recording.'));
add('legacy-recorder-release-metadata-only',recorder.includes('ywi_record_verified_release_source_evidence')&&!recorder.includes('operations_staging_test_runs'));
add('verifier-keeps-detailed-policy-unverified',verifier.includes('branch_policy_verified:false'));
add('verifier-does-not-record',verifier.includes('does not write Supabase evidence'));

const passed=checks.filter((check)=>check.ok).length;
console.log(`Authorized release evidence workflow/OIDC contract: ${passed}/${checks.length} passed`);
for(const check of checks)console.log(`${check.ok?'PASS':'FAIL'}  ${check.name}${check.detail?' — '+check.detail:''}`);
if(passed!==checks.length)process.exitCode=1;
