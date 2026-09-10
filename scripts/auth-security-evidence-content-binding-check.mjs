#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AUTH_EVIDENCE_CONTENT_BINDING_VERSION,
  attachWorkflowCandidateContentBinding,
  buildContentBindingMarkerNames,
  calculateWorkflowCandidateCommitment,
  expectedContentBindingArtifactName,
  verifyWorkflowCandidateContentBinding,
  writeGithubOutputMarkerNames,
} from './auth-security-evidence-content-binding.mjs';
import {buildAuthManagementApiEvidenceBundle} from './auth-security-management-api-capture.mjs';
import {prepareAuthEvidenceCandidatesFromCapture} from './auth-security-management-api-candidate-prep.mjs';

const RUN_ID='34430000000';
const ATTEMPT='1';
const SHA='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OBSERVED_AT='2026-09-10T01:10:00.000Z';
const LEAKED_NONCE='11'.repeat(32);
const MFA_NONCE='22'.repeat(32);
const provenance={
  repository:'RosevearCreations/yw',
  run_id:RUN_ID,
  run_attempt:ATTEMPT,
  commit_sha:SHA,
};
const rawConfig={
  password_hibp_enabled:true,
  mfa_totp_enroll_enabled:true,
  mfa_totp_verify_enabled:true,
  mfa_phone_enroll_enabled:false,
  mfa_phone_verify_enabled:false,
  mfa_web_authn_enroll_enabled:false,
  mfa_web_authn_verify_enabled:false,
};

const bundle=buildAuthManagementApiEvidenceBundle(rawConfig,{
  observedAt:OBSERVED_AT,
  intakeNow:OBSERVED_AT,
  workflowProvenance:provenance,
});
const prepared=prepareAuthEvidenceCandidatesFromCapture(bundle,{
  now:OBSERVED_AT,
  bindingNonces:{
    leaked_password_protection:LEAKED_NONCE,
    mfa_options:MFA_NONCE,
  },
});

assert.equal(AUTH_EVIDENCE_CONTENT_BINDING_VERSION,1);
assert.equal(prepared.boundaries.workflow_content_binding_applied,true);
assert.equal(prepared.boundaries.binding_nonce_publicly_exposed,false);

for(const controlKey of prepared.candidate_controls){
  const candidate=prepared.candidates[controlKey];
  const verified=verifyWorkflowCandidateContentBinding(candidate);
  assert.equal(verified.verified,true);
  assert.match(verified.commitment_sha256,/^[0-9a-f]{64}$/);
  assert.equal(candidate.workflow_content_binding.version,1);
  assert.match(candidate.workflow_content_binding.nonce,/^[0-9a-f]{64}$/);
  assert.equal(candidate.workflow_content_binding.commitment_sha256,verified.commitment_sha256);
  assert.equal(calculateWorkflowCandidateCommitment(candidate,candidate.workflow_content_binding.nonce),verified.commitment_sha256);
}

const leaked=prepared.candidates.leaked_password_protection;
const leakedCommitment=leaked.workflow_content_binding.commitment_sha256;
const expectedMarker=expectedContentBindingArtifactName(RUN_ID,ATTEMPT,'leaked_password_protection',leakedCommitment);
assert.equal(prepared.content_binding_markers.leaked_password_protection.artifact_name,expectedMarker);
assert.ok(expectedMarker.includes(leakedCommitment));
assert.equal(expectedMarker.includes(LEAKED_NONCE),false,'Marker artifact name must never expose the binding nonce.');
assert.equal(expectedMarker.includes('enabled'),false,'Marker artifact name must never expose Auth state.');

const markers=buildContentBindingMarkerNames(prepared);
assert.equal(markers.leaked_password_protection.artifact_name,expectedMarker);
assert.equal(markers.mfa_options.commitment_sha256,prepared.candidates.mfa_options.workflow_content_binding.commitment_sha256);

for(const mutate of [
  (value)=>{value.observed_state='disabled';},
  (value)=>{value.observed_at='2026-09-10T01:11:00.000Z';},
  (value)=>{value.source_capture.password_hibp_enabled=false;},
  (value)=>{value.source_capture_sha256='f'.repeat(64);},
  (value)=>{value.evidence_reference='https://github.com/RosevearCreations/yw/actions/runs/999/attempts/1';},
  (value)=>{value.database_record_candidate.verification_status='verified_followup';},
  (value)=>{value.database_record_candidate.evidence_detail.workflow_provenance.commit_sha='b'.repeat(40);},
]){
  const tampered=structuredClone(leaked);
  mutate(tampered);
  assert.throws(()=>verifyWorkflowCandidateContentBinding(tampered),/commitment does not match/);
}

const missing=structuredClone(leaked);
delete missing.workflow_content_binding;
assert.throws(()=>verifyWorkflowCandidateContentBinding(missing),/requires workflow_content_binding/);
const changedNonce=structuredClone(leaked);
changedNonce.workflow_content_binding.nonce='33'.repeat(32);
assert.throws(()=>verifyWorkflowCandidateContentBinding(changedNonce),/commitment does not match/);
const changedCommitment=structuredClone(leaked);
changedCommitment.workflow_content_binding.commitment_sha256='e'.repeat(64);
assert.throws(()=>verifyWorkflowCandidateContentBinding(changedCommitment),/commitment does not match/);

const manualBundle=buildAuthManagementApiEvidenceBundle(rawConfig,{observedAt:OBSERVED_AT,intakeNow:OBSERVED_AT});
const manualPrepared=prepareAuthEvidenceCandidatesFromCapture(manualBundle,{now:OBSERVED_AT});
assert.equal(manualPrepared.boundaries.workflow_content_binding_applied,false);
assert.deepEqual(manualPrepared.content_binding_markers,{});
assert.equal(Object.prototype.hasOwnProperty.call(manualPrepared.candidates.leaked_password_protection,'workflow_content_binding'),false);

const tmpDir=fs.mkdtempSync(path.join(os.tmpdir(),'ywi-auth-binding-'));
try{
  const outputPath=path.join(tmpDir,'github-output.txt');
  fs.writeFileSync(outputPath,'','utf8');
  const output=writeGithubOutputMarkerNames(prepared,outputPath);
  assert.equal(output.ok,true);
  const text=fs.readFileSync(outputPath,'utf8');
  assert.ok(text.includes(`leaked_password_protection_artifact_name=${markers.leaked_password_protection.artifact_name}`));
  assert.ok(text.includes(`mfa_options_artifact_name=${markers.mfa_options.artifact_name}`));
  assert.equal(text.includes(LEAKED_NONCE),false);
  assert.equal(text.includes(MFA_NONCE),false);
  assert.equal(text.includes('enabled'),false);
  assert.equal(text.includes('configured'),false);
}finally{
  fs.rmSync(tmpDir,{recursive:true,force:true});
}

const captureWorkflow=fs.readFileSync('.github/workflows/auth-security-evidence-capture.yml','utf8');
assert.ok(captureWorkflow.includes('node scripts/auth-security-evidence-content-binding.mjs'));
assert.ok(captureWorkflow.includes('${{ steps.content-binding.outputs.leaked_password_protection_artifact_name }}'));
assert.ok(captureWorkflow.includes('${{ steps.content-binding.outputs.mfa_options_artifact_name }}'));
assert.ok(captureWorkflow.indexOf('rm -rf "$YWI_AUTH_EVIDENCE_PREP_OUTPUT_DIR"') < captureWorkflow.indexOf('Publish leaked-password candidate commitment marker'));
assert.equal(captureWorkflow.includes('workflow_content_binding.nonce'),false);

const recorderEntrypoint=fs.readFileSync('scripts/auth-security-evidence-record.mjs','utf8');
const recorderCore=fs.readFileSync('scripts/auth-security-evidence-record-core.mjs','utf8');
assert.ok(recorderEntrypoint.includes("export * from './auth-security-evidence-record-core.mjs'"));
assert.ok(recorderCore.includes('verifyWorkflowCandidateContentBinding(candidate)'));
assert.ok(recorderCore.includes('content_binding_commitment_sha256:plan.workflow_content_binding.commitment_sha256'));
assert.ok(recorderCore.includes('if(!artifactVerification?.content_binding_verified)'));
assert.ok(recorderCore.includes('auth_capture_content_binding_verification'));
assert.ok(recorderCore.includes('candidate_nonce_persisted:false'));

console.log('Build 269 Auth evidence cryptographic content-binding contract: PASS.');
