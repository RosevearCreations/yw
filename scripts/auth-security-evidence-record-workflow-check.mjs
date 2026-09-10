#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AUTH_EVIDENCE_RECORD_WORKFLOW_PREFLIGHT_VERSION,
  CONTROL_CANDIDATE_FILES,
  EXPECTED_RECORD_WORKFLOW_EVENT,
  EXPECTED_RECORD_WORKFLOW_REF,
  buildAuthEvidenceRecordWorkflowPlan,
} from './auth-security-evidence-record-workflow-preflight.mjs';
import {
  EXPECTED_PROJECT_REF,
  RECORD_CONFIRM,
  SOURCE_CONFIRM,
  EXPECTED_GITHUB_REPOSITORY,
} from './auth-security-evidence-record-core.mjs';
import {buildWorkflowEvidenceReference} from './auth-security-management-api-capture.mjs';

const RUN_ID='34490000000';
const RUN_ATTEMPT='2';
const CAPTURE_SHA='a'.repeat(40);
const CONTROL='leaked_password_protection';

function invocation(overrides={}){
  return {
    capture_run_id:RUN_ID,
    capture_run_attempt:RUN_ATTEMPT,
    control_key:CONTROL,
    workflow_repository:EXPECTED_GITHUB_REPOSITORY,
    workflow_ref:EXPECTED_RECORD_WORKFLOW_REF,
    workflow_event:EXPECTED_RECORD_WORKFLOW_EVENT,
    record_confirm:RECORD_CONFIRM,
    source_authenticity_confirm:SOURCE_CONFIRM,
    ...overrides,
  };
}

function candidate(overrides={}){
  const provenance={
    repository:EXPECTED_GITHUB_REPOSITORY,
    run_id:RUN_ID,
    run_attempt:RUN_ATTEMPT,
    commit_sha:CAPTURE_SHA,
  };
  const value={
    evidence_kind:'ywi_auth_security_evidence_record_candidate',
    project_ref:EXPECTED_PROJECT_REF,
    control_key:CONTROL,
    evidence_source:'supabase_management_api',
    evidence_reference:buildWorkflowEvidenceReference(provenance),
    workflow_content_binding:{
      version:1,
      nonce:'b'.repeat(64),
      commitment_sha256:'c'.repeat(64),
    },
    boundaries:{
      database_write_performed:false,
      auth_setting_mutation_performed:false,
    },
    database_record_candidate:{
      evidence_detail:{workflow_provenance:provenance},
    },
  };
  return Object.assign(value,overrides);
}

assert.equal(AUTH_EVIDENCE_RECORD_WORKFLOW_PREFLIGHT_VERSION,1);
assert.equal(CONTROL_CANDIDATE_FILES.leaked_password_protection,'leaked-password-protection.json');
assert.equal(CONTROL_CANDIDATE_FILES.mfa_options,'mfa-options.json');

const inputOnly=buildAuthEvidenceRecordWorkflowPlan(invocation());
assert.equal(inputOnly.ok,true);
assert.equal(inputOnly.candidate_checked,false);
assert.equal(inputOnly.explicit_record_confirmation,true);
assert.equal(inputOnly.explicit_source_authenticity_confirmation,true);
assert.equal(inputOnly.boundaries.network_call_performed,false);
assert.equal(inputOnly.boundaries.database_write_performed,false);

const bound=buildAuthEvidenceRecordWorkflowPlan(invocation(),candidate());
assert.equal(bound.ok,true);
assert.equal(bound.candidate_checked,true);
assert.equal(bound.candidate_verified,true);
assert.equal(bound.candidate_filename,'leaked-password-protection.json');
assert.equal(bound.candidate_provenance_sha,CAPTURE_SHA);

for(const [name,override,needle] of [
  ['non-numeric-run',{capture_run_id:'run-123'},'numeric'],
  ['non-numeric-attempt',{capture_run_attempt:'attempt-1'},'numeric'],
  ['unknown-control',{control_key:'password_policy'},'allowed Auth evidence control'],
  ['wrong-repository',{workflow_repository:'example/fork'},'repository'],
  ['non-main-ref',{workflow_ref:'refs/heads/dev'},'refs/heads/main'],
  ['non-manual-event',{workflow_event:'push'},'manually dispatched'],
  ['missing-record-confirm',{record_confirm:'false'},'recording confirmation'],
  ['missing-source-confirm',{source_authenticity_confirm:'false'},'official-source authenticity'],
]){
  const result=buildAuthEvidenceRecordWorkflowPlan(invocation(override));
  assert.equal(result.ok,false,name);
  assert.ok(result.errors.some((error)=>error.includes(needle)),name);
}

for(const [name,mutate,needle] of [
  ['wrong-project',(value)=>{value.project_ref='differentproject';},'project_ref'],
  ['wrong-control',(value)=>{value.control_key='mfa_options';},'control_key'],
  ['wrong-source',(value)=>{value.evidence_source='supabase_dashboard';},'Management API'],
  ['prior-write-claimed',(value)=>{value.boundaries.database_write_performed=true;},'no database write'],
  ['prior-auth-mutation-claimed',(value)=>{value.boundaries.auth_setting_mutation_performed=true;},'no Auth setting mutation'],
  ['missing-content-binding',(value)=>{delete value.workflow_content_binding;},'cryptographic content binding'],
  ['run-id-mismatch',(value)=>{value.database_record_candidate.evidence_detail.workflow_provenance.run_id='999';},'run id'],
  ['attempt-mismatch',(value)=>{value.database_record_candidate.evidence_detail.workflow_provenance.run_attempt='9';},'run attempt'],
  ['repo-mismatch',(value)=>{value.database_record_candidate.evidence_detail.workflow_provenance.repository='example/fork';},'repository'],
  ['invalid-sha',(value)=>{value.database_record_candidate.evidence_detail.workflow_provenance.commit_sha='not-a-sha';},'commit SHA'],
  ['reference-mismatch',(value)=>{value.evidence_reference='https://github.com/RosevearCreations/yw/actions/runs/1/attempts/1';},'evidence reference'],
]){
  const value=candidate();
  mutate(value);
  const result=buildAuthEvidenceRecordWorkflowPlan(invocation(),value);
  assert.equal(result.ok,false,name);
  assert.ok(result.errors.some((error)=>error.includes(needle)),name);
}

const workflow=fs.readFileSync('.github/workflows/auth-security-evidence-authorized-record.yml','utf8');
const captureWorkflow=fs.readFileSync('.github/workflows/auth-security-evidence-capture.yml','utf8');

assert.ok(workflow.includes('workflow_dispatch:'),'Authorized recording workflow must be manually dispatchable.');
assert.ok(workflow.includes('pull_request:'),'Authorized recording workflow must validate its contract on PRs.');
assert.equal(/^\s*push:/m.test(workflow),false,'Authorized recording workflow must never run on push.');
assert.equal(/^\s*schedule:/m.test(workflow),false,'Authorized recording workflow must never be scheduled.');
assert.ok(workflow.includes('permissions:\n  contents: read\n  actions: read'),'Workflow permissions must stay read-only for repository/actions metadata.');
assert.equal(workflow.includes('id-token: write'),false,'Authorized recording workflow must not gain OIDC write authority.');

const contractStart=workflow.indexOf('  contract-check:');
const authorizeStart=workflow.indexOf('  authorize-recording:');
const recordStart=workflow.indexOf('  record-auth-evidence:');
assert.ok(contractStart>=0 && authorizeStart>contractStart && recordStart>authorizeStart,'Contract, authorization and recording jobs must remain separated.');
const contractBlock=workflow.slice(contractStart,authorizeStart);
const authorizeBlock=workflow.slice(authorizeStart,recordStart);
const recordBlock=workflow.slice(recordStart);

assert.ok(contractBlock.includes("if: ${{ github.event_name == 'pull_request' }}"),'Contract validation must be PR-only.');
assert.ok(contractBlock.includes('node scripts/auth-security-evidence-record-workflow-check.mjs'),'PR contract job must execute this regression.');
assert.equal(contractBlock.includes('secrets.'),false,'PR contract job must receive no secrets.');

assert.ok(authorizeBlock.includes("if: ${{ github.event_name == 'workflow_dispatch' }}"),'Authorization job must be manual-dispatch-only.');
assert.ok(authorizeBlock.includes('node scripts/auth-security-evidence-record-workflow-preflight.mjs --input-only >/dev/null'),'Authorization job must validate explicit inputs before any secret-bearing job.');
assert.ok(authorizeBlock.includes('YWI_AUTH_EVIDENCE_RECORD_CONFIRM: ${{ inputs.confirm_record }}'),'Authorization must preserve the operator recording confirmation input.');
assert.ok(authorizeBlock.includes('YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM: ${{ inputs.confirm_source_authenticity }}'),'Authorization must preserve the operator source-authenticity confirmation input.');
assert.equal(authorizeBlock.includes('secrets.'),false,'Authorization job must validate without receiving secrets.');

assert.ok(recordBlock.includes('needs: authorize-recording'),'Secret-bearing recording must depend on successful secret-free authorization.');
assert.ok(recordBlock.includes("needs.authorize-recording.result == 'success'"),'Recording job must require successful authorization.');
assert.ok(recordBlock.includes(`SUPABASE_URL: https://${EXPECTED_PROJECT_REF}.supabase.co`),'Recording job must pin the registered Production Supabase URL.');
assert.ok(recordBlock.includes(`YWI_PRODUCTION_PROJECT_REF: ${EXPECTED_PROJECT_REF}`),'Recording job must pin the registered Production project ref.');
assert.ok(recordBlock.includes('SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}'),'Service-role authority must come only from a secret.');
assert.ok(recordBlock.includes('YWI_AUTH_EVIDENCE_ARTIFACT_PASSPHRASE: ${{ secrets.YWI_AUTH_EVIDENCE_ARTIFACT_PASSPHRASE }}'),'Artifact decryption passphrase must come only from a secret.');
assert.equal(recordBlock.includes('SUPABASE_AUTH_CONFIG_READ_TOKEN'),false,'Recording workflow must not receive the Management API capture token.');

assert.ok(recordBlock.includes('actions/download-artifact@v4'),'Recording must consume the existing encrypted capture artifact through GitHub Actions.');
assert.ok(recordBlock.includes('github-token: ${{ github.token }}'),'Cross-run artifact download must use the workflow read token.');
assert.ok(recordBlock.includes('run-id: ${{ inputs.capture_run_id }}'),'Artifact download must bind to the exact selected capture run.');
assert.ok(recordBlock.includes('name: ywi-auth-security-evidence-${{ inputs.capture_run_id }}-${{ inputs.capture_run_attempt }}'),'Artifact name must bind to run id and run attempt.');
assert.ok(recordBlock.includes('openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000'),'Recording must decrypt with the exact capture encryption contract.');
assert.ok(recordBlock.includes('candidate-set.json') && recordBlock.includes('capture.json') && recordBlock.includes('leaked-password-protection.json') && recordBlock.includes('mfa-options.json'),'Decrypted archive allowlist must contain only the four expected preparation files.');
assert.ok(recordBlock.includes('diff -u auth-security-evidence-expected-files.txt auth-security-evidence-actual-files.txt'),'Archive contents must fail closed before extraction when unexpected paths exist.');
assert.ok(recordBlock.includes('tar --no-same-owner --no-same-permissions -xzf'),'Archive extraction must not restore owner/permission metadata.');
assert.ok(recordBlock.indexOf('node scripts/auth-security-evidence-record-workflow-preflight.mjs "$YWI_AUTH_EVIDENCE_CANDIDATE_PATH"') < recordBlock.indexOf('node scripts/auth-security-evidence-record.mjs "$YWI_AUTH_EVIDENCE_CANDIDATE_PATH"'),'Decrypted candidate provenance must be re-bound before the recorder runs.');
assert.ok(recordBlock.includes('node scripts/auth-security-evidence-record.mjs "$YWI_AUTH_EVIDENCE_CANDIDATE_PATH" >/dev/null'),'Existing fail-closed recorder must execute without printing captured state to the Actions log.');
assert.ok(recordBlock.includes("if: ${{ always() }}"),'Plaintext cleanup must run even after a failed recording attempt.');
assert.ok(recordBlock.includes('rm -rf auth-security-evidence-prepared auth-security-evidence-download'),'Cleanup must destroy decrypted/downloaded evidence workspace.');

for(const forbidden of [
  'method: PATCH',
  "method:'PATCH'",
  'auth:evidence:capture-prepare',
  'SUPABASE_ACCESS_TOKEN',
  'supabase db',
  'psql ',
  'workflow_content_binding.nonce',
]){
  assert.equal(recordBlock.includes(forbidden),false,`Recording workflow must not mutate Auth/capture state or expose binding internals: ${forbidden}`);
}

assert.equal(captureWorkflow.includes('SUPABASE_SERVICE_ROLE_KEY'),false,'Read-only capture workflow must remain separated from service-role recording authority.');
assert.equal(captureWorkflow.includes('auth-security-evidence-authorized-record.yml'),false,'Capture workflow must not chain automatically into Production evidence recording.');

console.log('Build 272 authorized Auth evidence recording workflow contract: PASS.');
