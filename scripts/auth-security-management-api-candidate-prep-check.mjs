#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AUTH_CONFIG_URL,
  buildAuthManagementApiEvidenceBundle,
} from './auth-security-management-api-capture.mjs';
import {
  AUTH_MANAGEMENT_API_CANDIDATE_PREP_VERSION,
  PREPARED_CONTROL_KEYS,
  captureAndPrepareAuthEvidenceCandidates,
  prepareAuthEvidenceCandidatesFromCapture,
  validateAuthManagementCaptureBundle,
  writePreparedAuthEvidenceCandidateSet,
} from './auth-security-management-api-candidate-prep.mjs';
import { EXPECTED_PROJECT_REF } from './auth-security-evidence-intake.mjs';
import {
  RECORD_CONFIRM,
  SOURCE_CONFIRM,
  buildAuthEvidenceRecordPlan,
} from './auth-security-evidence-record.mjs';

const OBSERVED_AT='2026-09-09T15:30:00.000Z';
const TOKEN='sbp_build260_fake_management_token_never_persist';
const SERVICE_KEY='service-role-build260-fake-never-persist';
const secureConfig={
  password_hibp_enabled:true,
  mfa_totp_enroll_enabled:true,
  mfa_totp_verify_enabled:true,
  mfa_phone_enroll_enabled:false,
  mfa_phone_verify_enabled:false,
  mfa_web_authn_enroll_enabled:false,
  mfa_web_authn_verify_enabled:false,
  smtp_pass:'do-not-persist-smtp-secret',
  external_google_secret:'do-not-persist-provider-secret',
};

const bundle=buildAuthManagementApiEvidenceBundle(secureConfig,{
  projectRef:EXPECTED_PROJECT_REF,
  observedAt:OBSERVED_AT,
  intakeNow:OBSERVED_AT,
});
assert.equal(validateAuthManagementCaptureBundle(bundle),bundle);

const prepared=prepareAuthEvidenceCandidatesFromCapture(bundle,{now:OBSERVED_AT});
assert.equal(prepared.evidence_kind,'ywi_auth_security_record_candidate_set');
assert.equal(prepared.preparation_contract_version,AUTH_MANAGEMENT_API_CANDIDATE_PREP_VERSION);
assert.deepEqual(prepared.candidate_controls,PREPARED_CONTROL_KEYS);
assert.equal(prepared.project_ref,EXPECTED_PROJECT_REF);
assert.equal(prepared.source_endpoint,AUTH_CONFIG_URL(EXPECTED_PROJECT_REF));
assert.equal(prepared.source_http_method,'GET');
assert.equal(prepared.observed_at,OBSERVED_AT);
assert.equal(prepared.boundaries.database_write_performed,false);
assert.equal(prepared.boundaries.auth_setting_mutation_performed,false);
assert.equal(prepared.boundaries.evidence_recording_performed,false);
assert.equal(prepared.boundaries.production_promotion_performed,false);

const leaked=prepared.candidates.leaked_password_protection;
const mfa=prepared.candidates.mfa_options;
assert.equal(leaked.control_key,'leaked_password_protection');
assert.equal(leaked.observed_state,'enabled');
assert.equal(leaked.derived_verification_status,'verified_secure');
assert.equal(mfa.control_key,'mfa_options');
assert.equal(mfa.observed_state,'configured');
assert.equal(mfa.derived_verification_status,'verified_secure');
for(const candidate of [leaked,mfa]){
  assert.equal(candidate.project_ref,EXPECTED_PROJECT_REF);
  assert.equal(candidate.evidence_source,'supabase_management_api');
  assert.equal(candidate.observed_at,OBSERVED_AT);
  assert.match(candidate.source_capture_sha256,/^[0-9a-f]{64}$/);
  assert.equal(candidate.boundaries.database_write_performed,false);
  assert.equal(candidate.boundaries.auth_setting_mutation_performed,false);
  assert.equal(candidate.source_authenticity_verified_by_tool,false);
  assert.equal(candidate.recording_authorized_by_tool,false);
}
assert.notEqual(leaked.source_capture_sha256,mfa.source_capture_sha256,'Each control must remain bound to its own allowlisted source capture.');

const authorizedEnv={
  YWI_AUTH_EVIDENCE_RECORD_CONFIRM:RECORD_CONFIRM,
  YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM:SOURCE_CONFIRM,
  SUPABASE_URL:`https://${EXPECTED_PROJECT_REF}.supabase.co`,
  YWI_PRODUCTION_PROJECT_REF:EXPECTED_PROJECT_REF,
  SUPABASE_SERVICE_ROLE_KEY:SERVICE_KEY,
};
for(const candidate of [leaked,mfa]){
  const plan=buildAuthEvidenceRecordPlan(candidate,authorizedEnv,{now:OBSERVED_AT});
  assert.equal(plan.ok,true,plan.errors.join('; '));
  assert.equal(plan.rpc_body.p_control_key,candidate.control_key);
  assert.equal(plan.rpc_body.p_source_capture_sha256,candidate.source_capture_sha256);
}
const lockedPlan=buildAuthEvidenceRecordPlan(leaked,{}, {now:OBSERVED_AT});
assert.equal(lockedPlan.ok,false,'Preparation must not bypass the recorder explicit-confirmation boundary.');
assert.ok(lockedPlan.errors.some((item)=>item.includes('recording confirmation')));
assert.ok(lockedPlan.errors.some((item)=>item.includes('official Supabase source')));

for(const mutation of [
  (copy)=>{copy.project_ref='wrongprojectref';},
  (copy)=>{copy.endpoint='https://example.invalid/config/auth';},
  (copy)=>{copy.http_method='POST';},
  (copy)=>{copy.boundaries.database_write_performed=true;},
  (copy)=>{copy.intake_validation.mfa_options_ok=false;},
  (copy)=>{copy.intake_inputs.mfa_options.observed_state='not_configured';},
]){
  const copy=structuredClone(bundle);
  mutation(copy);
  assert.throws(()=>prepareAuthEvidenceCandidatesFromCapture(copy,{now:OBSERVED_AT}));
}

const serialized=JSON.stringify(prepared);
assert.equal(serialized.includes(TOKEN),false);
assert.equal(serialized.includes(SERVICE_KEY),false);
assert.equal(serialized.includes('do-not-persist-smtp-secret'),false);
assert.equal(serialized.includes('do-not-persist-provider-secret'),false);

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'ywi-auth-candidate-prep-'));
try{
  const outputDir=path.join(tempRoot,'prepared');
  const diskResult=writePreparedAuthEvidenceCandidateSet(bundle,{now:OBSERVED_AT,outputDir});
  assert.equal(diskResult.ok,true);
  const expectedFiles=['capture.json','candidate-set.json','leaked-password-protection.json','mfa-options.json'];
  assert.deepEqual(fs.readdirSync(outputDir).sort(),expectedFiles.sort());
  for(const file of expectedFiles){
    const text=fs.readFileSync(path.join(outputDir,file),'utf8');
    assert.equal(text.includes(TOKEN),false);
    assert.equal(text.includes(SERVICE_KEY),false);
    assert.equal(text.includes('do-not-persist-smtp-secret'),false);
    assert.equal(text.includes('do-not-persist-provider-secret'),false);
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(outputDir,'leaked-password-protection.json'),'utf8')).control_key,'leaked_password_protection');
  assert.equal(JSON.parse(fs.readFileSync(path.join(outputDir,'mfa-options.json'),'utf8')).control_key,'mfa_options');

  fs.writeFileSync(path.join(outputDir,'stale.txt'),'stale','utf8');
  let fetchCalls=0;
  let seenRequest=null;
  const liveResult=await captureAndPrepareAuthEvidenceCandidates({
    projectRef:EXPECTED_PROJECT_REF,
    accessToken:TOKEN,
    fetchImpl:async(url,options)=>{
      fetchCalls+=1;
      seenRequest={url,options};
      return {ok:true,status:200,json:async()=>secureConfig};
    },
    observedAt:OBSERVED_AT,
    intakeNow:OBSERVED_AT,
    now:OBSERVED_AT,
    outputDir,
  });
  assert.equal(liveResult.ok,true,liveResult.error);
  assert.equal(fetchCalls,1,'Capture-and-prepare must perform exactly one Management API read.');
  assert.equal(seenRequest.url,AUTH_CONFIG_URL(EXPECTED_PROJECT_REF));
  assert.equal(seenRequest.options.method,'GET');
  assert.equal(seenRequest.options.redirect,'error');
  assert.equal(fs.existsSync(path.join(outputDir,'stale.txt')),false,'Successful preparation must replace stale generated output.');
  assert.equal(JSON.stringify(liveResult).includes(TOKEN),false,'Management API access token must never enter preparation output.');

  fs.writeFileSync(path.join(outputDir,'stale.txt'),'stale','utf8');
  const failed=await captureAndPrepareAuthEvidenceCandidates({
    projectRef:EXPECTED_PROJECT_REF,
    accessToken:TOKEN,
    fetchImpl:async()=>({ok:false,status:403,json:async()=>({})}),
    observedAt:OBSERVED_AT,
    outputDir,
  });
  assert.equal(failed.ok,false);
  assert.equal(fs.existsSync(outputDir),false,'Failed live capture/preparation must remove stale generated candidates.');
  assert.equal(failed.error.includes(TOKEN),false);
} finally {
  fs.rmSync(tempRoot,{recursive:true,force:true});
}

const packageJson=JSON.parse(fs.readFileSync('package.json','utf8'));
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
assert.equal(packageJson.scripts['auth:evidence:prepare'],'node scripts/auth-security-management-api-candidate-prep.mjs');
assert.equal(packageJson.scripts['auth:evidence:capture-prepare'],'YWI_AUTH_CAPTURE_AND_PREPARE=true node scripts/auth-security-management-api-candidate-prep.mjs');
assert.equal(packageJson.scripts['test:auth-security-management-api-candidate-prep'],'node scripts/auth-security-management-api-candidate-prep-check.mjs');
assert.equal(packageJson.scripts['test:auth-security-evidence-intake'],'node scripts/auth-security-evidence-intake-check.mjs && node scripts/auth-security-management-api-capture-check.mjs && node scripts/auth-security-management-api-candidate-prep-check.mjs');
assert.ok(workflow.includes('npm run test:auth-security-evidence-intake'));
assert.equal(workflow.includes('npm run auth:evidence:capture-prepare'),false,'Canonical CI must never perform the live Management API capture-and-prepare command.');
assert.equal(workflow.includes('YWI_AUTH_CAPTURE_AND_PREPARE'),false,'Canonical CI must never opt into live Management API capture.');
assert.equal(workflow.includes('SUPABASE_ACCESS_TOKEN'),false,'Canonical CI must not require a Supabase Management API access token.');

console.log('Auth Management API capture-to-record-candidate preparation gate: PASS.');
