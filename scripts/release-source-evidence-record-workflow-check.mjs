#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath='.github/workflows/release-source-evidence-authorized-record.yml';
const recorderPath='scripts/release-source-evidence-record.mjs';
const verifierPath='scripts/release-source-evidence-verify.mjs';
const workflow=fs.readFileSync(workflowPath,'utf8');
const recorder=fs.readFileSync(recorderPath,'utf8');
const verifier=fs.readFileSync(verifierPath,'utf8');
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:Boolean(ok),detail});
const has=(text)=>workflow.includes(text);

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
add('workflow-read-only-github-permissions',has('permissions:\n  contents: read\n  actions: read'));
add('workflow-concurrency-serialized',has('group: ywi-authorized-release-source-evidence-recording')&&has('cancel-in-progress: false'));
add('workflow-current-action-runtimes',!/@v4\b/.test(workflow.match(/actions\/(?:checkout|setup-node)@v\d+/g)?.join('\n')||'')&&has('actions/checkout@v7')&&has('actions/setup-node@v7'));
add('workflow-node22',has("node-version: '22'")&&!has("node-version: '20'"));
add('workflow-exact-production-binding',has('SUPABASE_URL: https://jmqvkgiqlimdhcofwkxr.supabase.co')&&has('YWI_PRODUCTION_PROJECT_REF: jmqvkgiqlimdhcofwkxr'));
add('workflow-service-role-secret-only',has('SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}')&&!has('SUPABASE_SERVICE_ROLE_KEY: jmq'));
add('workflow-explicit-record-confirmation-contract',has('YWI_RELEASE_EVIDENCE_RECORD_CONFIRM: I_CONFIRM_RELEASE_EVIDENCE_RECORD'));
add('workflow-positive-source-validation',
  has('source_run_id must be a positive integer.')&&
  has('source_run_attempt must be a positive integer.')&&
  has('source_head_sha must be a full lowercase commit SHA.'));
add('workflow-run-attempt-scoped-artifact',has('ywi-main-release-source-${{ env.SOURCE_RUN_ID }}-${{ env.SOURCE_RUN_ATTEMPT }}'));
add('workflow-downloads-from-exact-run',has('run-id: ${{ env.SOURCE_RUN_ID }}')&&has('repository: ${{ github.repository }}')&&has('github-token: ${{ github.token }}'));
add('workflow-fresh-run-and-main-lookups',has('gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${SOURCE_RUN_ID}"')&&has('gh api "repos/${GITHUB_REPOSITORY}/branches/main"'));
const verifyPos=workflow.indexOf('node scripts/release-source-evidence-verify.mjs');
const recordPos=workflow.indexOf('node scripts/release-source-evidence-record.mjs "$YWI_RELEASE_VERIFIED_PATH"');
add('workflow-verifies-before-recording',verifyPos>=0&&recordPos>verifyPos);
add('workflow-cleanup-always',has('if: ${{ always() }}')&&has('rm -rf release-source-evidence-download')&&has('release-source-evidence-verified.json'));
add('workflow-no-production-source-promotion',!has('git push')&&!has('gh pr merge')&&!has('update_ref'));
add('workflow-no-provider-or-staging-mutation',!has('STRIPE')&&!has('PAYPAL')&&!has('YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED'));

add('recorder-fresh-github-reverification',recorder.includes('/actions/runs/${shape.runId}')&&recorder.includes('/branches/main'));
add('recorder-requires-protected-main',recorder.includes("mainBranch.protected!==true")&&recorder.includes('GitHub must still report current main protected=true immediately before recording.'));
add('recorder-requires-completed-success',recorder.includes("workflowRun.status!=='completed' || workflowRun.conclusion!=='success'"));
add('recorder-requires-exact-current-main-sha',recorder.includes('Current main SHA moved after final verification'));
add('recorder-requires-current-schema',recorder.includes('Verified schema must exactly equal the current source schema.'));
add('recorder-explicit-confirmation-contract',recorder.includes("RECORD_CONFIRM='I_CONFIRM_RELEASE_EVIDENCE_RECORD'"));
add('recorder-release-metadata-only',
  recorder.includes('ywi_record_verified_release_source_evidence')&&
  !recorder.includes('finance_job_completion_posting_execution_controls')&&
  !recorder.includes('operations_staging_test_runs'),
  'Automatic path records verified release metadata only and does not mutate business acceptance, Finance or staging state.');
add('verifier-keeps-detailed-policy-unverified',verifier.includes('branch_policy_verified:false'));
add('verifier-does-not-record',verifier.includes('does not write Supabase evidence'));

const passed=checks.filter((check)=>check.ok).length;
console.log(`Authorized release evidence workflow contract: ${passed}/${checks.length} passed`);
for(const check of checks)console.log(`${check.ok?'PASS':'FAIL'}  ${check.name}${check.detail?' — '+check.detail:''}`);
if(passed!==checks.length)process.exitCode=1;
