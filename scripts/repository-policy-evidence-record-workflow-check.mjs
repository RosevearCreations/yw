#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const workflow=read('.github/workflows/repository-policy-evidence-record.yml');
const verifier=read('scripts/repository-policy-evidence-verify.mjs');
const edge=read('supabase/functions/repository-policy-evidence-record/index.ts');
const migration=read('sql/208_repository_policy_evidence_authority.sql');
const sourceBundle=read('scripts/release-source-evidence-bundle.mjs');
const sourceVerifier=read('scripts/release-source-evidence-verify.mjs');
const sourceRecorder=read('supabase/functions/release-source-evidence-record/index.ts');
const config=read('supabase/config.toml');
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
const has=(value)=>workflow.includes(value);
const all=(text,values)=>values.every((value)=>text.includes(value));

add('workflow-has-pr-contract-and-auto-main-trigger',
  has('pull_request:')&&has('workflow_run:')&&has('YWI source and staging checks')&&has('workflow_dispatch:'));
add('workflow-manual-recovery-is-explicit',
  has('source_run_id:')&&has('source_run_attempt:')&&has('confirm_record:')&&has('I_CONFIRM_REPOSITORY_POLICY_RECORD'));
add('workflow-auto-recording-requires-successful-main-push',
  has("github.event_name == 'workflow_run'")&&
  has("github.event.workflow_run.conclusion == 'success'")&&
  has("github.event.workflow_run.event == 'push'")&&
  has("github.event.workflow_run.head_branch == 'main'"));
add('workflow-manual-recording-main-only',
  has("github.event_name == 'workflow_dispatch'")&&has("github.ref == 'refs/heads/main'")&&has("inputs.confirm_record == 'I_CONFIRM_REPOSITORY_POLICY_RECORD'"));
add('workflow-pr-contract-only',
  has("if: ${{ github.event_name == 'pull_request' }}")&&has('node scripts/repository-policy-evidence-record-workflow-check.mjs'));
add('workflow-read-only-github-plus-oidc',
  has('contents: read')&&has('actions: read')&&has('id-token: write')&&!has('contents: write')&&!has('pull-requests: write'));
add('workflow-serialized',has('group: ywi-repository-policy-evidence-recording')&&has('cancel-in-progress: false'));
add('workflow-current-actions-runtime',
  (workflow.match(/actions\/checkout@v7/g)||[]).length>=2&&
  (workflow.match(/actions\/setup-node@v7/g)||[]).length>=2&&
  has("node-version: '22'"));
add('workflow-production-recorder-pinned',
  has('https://jmqvkgiqlimdhcofwkxr.supabase.co/functions/v1/repository-policy-evidence-record')&&
  has('ywi-repository-policy-evidence'));
add('workflow-has-no-service-role-secret',
  !workflow.includes('SUPABASE_SERVICE_ROLE_KEY')&&!workflow.includes('SB_SERVICE_ROLE_KEY'));
add('workflow-fresh-source-main-and-ruleset-reads',all(workflow,[
  'actions/runs/${SOURCE_RUN_ID}',
  'branches/main',
  'rulesets?per_page=100',
  "select(.name == $name and .target == \"branch\" and .enforcement == \"active\")",
  'rulesets/${ruleset_id}',
]));
add('workflow-exact-main-protection-ruleset-name',has("--arg name 'main protection'"));
add('workflow-verifies-before-recording',
  workflow.indexOf('node scripts/repository-policy-evidence-verify.mjs')>=0&&
  workflow.indexOf('node scripts/repository-policy-evidence-verify.mjs')<workflow.indexOf('ACTIONS_ID_TOKEN_REQUEST_TOKEN'));
add('workflow-oidc-recording-only',
  has('ACTIONS_ID_TOKEN_REQUEST_TOKEN')&&has('ACTIONS_ID_TOKEN_REQUEST_URL')&&has('Authorization: Bearer ${oidc_token}'));
add('workflow-response-requires-recorded-policy',all(workflow,[
  '.ok == true',
  '.source_sha == $sha',
  '.workflow_run_id == $run_id',
  '.branch_policy_evidence_recorded == true',
  '.repository_enforcement_status == "amber" or .repository_enforcement_status == "green"',
]));
add('workflow-cleans-sensitive-workspace',
  has('Destroy repository policy evidence workspace')&&has('repository-policy-record-request.json')&&has('repository-policy-record-response.json'));
add('workflow-does-not-promote-or-run-business-rails',
  !/merge_pull_request|git\s+push|gh\s+pr\s+merge|stripe|paypal|run_staging|staging-proof|finance.*posting/i.test(workflow));

add('verifier-requires-complete-detailed-policy',all(verifier,[
  "EXPECTED_RULESET_NAME='main protection'",
  "EXPECTED_REQUIRED_STATUS='source-checks'",
  "include.includes('~DEFAULT_BRANCH')",
  "rule?.type==='deletion'",
  "rule?.type==='non_fast_forward'",
  "rule?.type==='pull_request'",
  "rule?.type==='required_status_checks'",
  "bypassActors.length!==0",
  "currentUserCanBypass!=='never'",
  "mainBranch?.protected!==true",
  "workflowRun?.conclusion!=='success'",
]));
add('verifier-normalizes-policy-true-only-on-full-pass',
  verifier.includes("branch_policy_verified:errors.length===0")&&verifier.includes("verification_result:errors.length===0?'passed':'locked'"));
add('verifier-does-not-copy-untrusted-api-payloads',
  !verifier.includes('...ruleset')&&!verifier.includes('...workflowRun')&&!verifier.includes('ruleset_payload:')&&!verifier.includes('workflow_payload:'));

add('edge-oidc-identity-pinned',all(edge,[
  "EXPECTED_REPOSITORY = 'RosevearCreations/yw'",
  "EXPECTED_REPOSITORY_ID = '1148400822'",
  "EXPECTED_REF = 'refs/heads/main'",
  "EXPECTED_RECORDER_WORKFLOW_REF = 'RosevearCreations/yw/.github/workflows/repository-policy-evidence-record.yml@refs/heads/main'",
  "EXPECTED_AUDIENCE = 'ywi-repository-policy-evidence'",
  'jwtVerify',
]));
add('edge-production-project-pinned',all(edge,[
  "EXPECTED_PROJECT_REF = 'jmqvkgiqlimdhcofwkxr'",
  "actualProjectRef !== EXPECTED_PROJECT_REF",
  "v_schema_drift_status",
]));
add('edge-revalidates-source-run-and-main',all(edge,[
  'actions/runs/${runId}',
  'branches/main',
  "run.status !== 'completed'",
  "run.conclusion !== 'success'",
  'main.protected !== true',
]));
add('edge-records-through-narrow-policy-rpc',
  edge.includes("supabase.rpc('ywi_record_verified_repository_policy_evidence'")&&
  !edge.includes(".from('it_repository_policy_evidence').insert")&&
  !edge.includes(".from('it_release_source_evidence')."));
add('edge-race-safe-final-convergence',all(edge,[
  'branch_policy_evidence_recorded: true',
  'branch_policy_verified: current.branch_policy_verified === true',
  "repository_enforcement_status: current.repository_enforcement_status || 'amber'",
]));
add('edge-config-custom-oidc-boundary',
  config.includes('[functions.repository-policy-evidence-record]')&&
  /\[functions\.repository-policy-evidence-record\][\s\S]*?verify_jwt\s*=\s*false/.test(config));

add('schema208-private-policy-store',all(migration,[
  'create table if not exists public.it_repository_policy_evidence',
  'alter table public.it_repository_policy_evidence enable row level security',
  'revoke all on table public.it_repository_policy_evidence from public,anon,authenticated,service_role',
  'grant select on table public.it_repository_policy_evidence to service_role',
]));
add('schema208-service-only-recorder',all(migration,[
  'create or replace function public.ywi_record_verified_repository_policy_evidence(',
  'security definer',
  'set search_path=public,pg_temp',
  'revoke execute on function public.ywi_record_verified_repository_policy_evidence',
  'from public,anon,authenticated,service_role',
  'to service_role',
]));
add('schema208-policy-controls-fail-closed',all(migration,[
  "ruleset_name='main protection'",
  "ruleset_target='branch'",
  "ruleset_enforcement='active'",
  "required_status_contexts @> array['source-checks']::text[]",
  'force_push_blocked=true',
  'deletion_blocked=true',
  'bypass_actor_count=0',
  "current_user_can_bypass='never'",
]));
add('schema208-source-policy-separation',all(migration,[
  'release_source_policy_separation_preserved',
  "where workflow_status='passed' and branch_policy_verified is distinct from false",
  'from public.v_it_repository_policy_evidence_current',
]));
add('schema208-does-not-fabricate-policy-row',
  !/insert\s+into\s+public\.it_repository_policy_evidence\s*\([\s\S]*?values\s*\(/i.test(migration.split('create or replace function public.ywi_record_verified_repository_policy_evidence')[0]||''));
add('schema208-keeps-business-rails-and-finance-off',all(migration,[
  "count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11",
  'execution_enabled=true or provider_mutation_enabled=true',
]));
add('schema208-marker',migration.includes("208,'208_repository_policy_evidence_authority'")&&migration.includes('208 as expected_schema_version'));

add('release-source-candidate-remains-policy-false',
  sourceBundle.includes('branch_policy_verified:false')&&!sourceBundle.includes('branch_policy_verified:true'));
add('release-source-verifier-remains-policy-false',
  sourceVerifier.includes('branch_policy_verified:false')&&sourceVerifier.includes('Candidate detailed branch-policy verification must remain false.'));
add('release-source-recorder-remains-policy-amber-boundary',all(sourceRecorder,[
  "verified.branch_policy_verified !== false",
  "current.branch_policy_verified !== false",
  "current.repository_enforcement_status !== 'amber'",
]));

const failed=checks.filter((item)=>!item.ok);
for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.detail?` — ${item.detail}`:''}`);
console.log(`\n${checks.length-failed.length}/${checks.length} repository-policy recording workflow checks passed.`);
if(failed.length)process.exit(1);
