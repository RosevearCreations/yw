#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AUTH_CONFIG_URL,
  CAPTURED_AUTH_FIELDS,
  EXPECTED_GITHUB_REPOSITORY,
  buildAuthManagementApiEvidenceBundle,
  buildWorkflowEvidenceReference,
  captureAndWriteAuthSecurityManagementApi,
  captureAuthSecurityManagementApi,
  deriveAuthSecurityStates,
  normalizeWorkflowProvenance,
  sanitizeManagementApiAuthConfig,
  workflowProvenanceFromEnv,
} from './auth-security-management-api-capture.mjs';
import {
  prepareAuthEvidenceCandidatesFromCapture,
  validateAuthManagementCaptureBundle,
} from './auth-security-management-api-candidate-prep.mjs';
import { EXPECTED_PROJECT_REF } from './auth-security-evidence-intake.mjs';

const OBSERVED_AT='2026-09-09T14:20:00.000Z';
const TOKEN='sbp_test_management_token_that_must_never_be_persisted';
const WORKFLOW_PROVENANCE={
  repository:EXPECTED_GITHUB_REPOSITORY,
  run_id:'34380000000',
  run_attempt:'2',
  commit_sha:'a'.repeat(40),
};
const WORKFLOW_REFERENCE=`https://github.com/${EXPECTED_GITHUB_REPOSITORY}/actions/runs/34380000000/attempts/2`;
const secureConfig={
  password_hibp_enabled:true,
  mfa_totp_enroll_enabled:true,
  mfa_totp_verify_enabled:true,
  mfa_phone_enroll_enabled:false,
  mfa_phone_verify_enabled:false,
  mfa_web_authn_enroll_enabled:false,
  mfa_web_authn_verify_enabled:false,
  external_google_secret:'provider-secret-must-never-be-persisted',
  smtp_pass:'smtp-secret-must-never-be-persisted',
  site_url:'https://example.invalid',
};

const normalizedProvenance=normalizeWorkflowProvenance(WORKFLOW_PROVENANCE);
assert.deepEqual(normalizedProvenance,{...WORKFLOW_PROVENANCE,event:'workflow_dispatch'});
assert.equal(buildWorkflowEvidenceReference(WORKFLOW_PROVENANCE),WORKFLOW_REFERENCE);
assert.deepEqual(workflowProvenanceFromEnv({
  YWI_AUTH_EVIDENCE_WORKFLOW_REPOSITORY:EXPECTED_GITHUB_REPOSITORY,
  YWI_AUTH_EVIDENCE_WORKFLOW_RUN_ID:'34380000000',
  YWI_AUTH_EVIDENCE_WORKFLOW_RUN_ATTEMPT:'2',
  YWI_AUTH_EVIDENCE_WORKFLOW_SHA:'A'.repeat(40),
}),normalizedProvenance);
assert.equal(workflowProvenanceFromEnv({}),null);
assert.throws(()=>normalizeWorkflowProvenance({...WORKFLOW_PROVENANCE,repository:'other/repo'}),/repository must equal/);
assert.throws(()=>normalizeWorkflowProvenance({...WORKFLOW_PROVENANCE,run_id:'0'}),/run_id must be a positive integer/);
assert.throws(()=>normalizeWorkflowProvenance({...WORKFLOW_PROVENANCE,commit_sha:'bad'}),/40-character hexadecimal SHA/);

const sanitized=sanitizeManagementApiAuthConfig(secureConfig);
assert.deepEqual(Object.keys(sanitized),CAPTURED_AUTH_FIELDS);
assert.equal(JSON.stringify(sanitized).includes('provider-secret-must-never-be-persisted'),false);
assert.equal(JSON.stringify(sanitized).includes('smtp-secret-must-never-be-persisted'),false);

const secureStates=deriveAuthSecurityStates(sanitized);
assert.equal(secureStates.leaked_password_protection,'enabled');
assert.equal(secureStates.mfa_options,'configured');
assert.deepEqual(secureStates.configured_mfa_factors,['totp']);

const bundle=buildAuthManagementApiEvidenceBundle(secureConfig,{projectRef:EXPECTED_PROJECT_REF,observedAt:OBSERVED_AT,intakeNow:OBSERVED_AT});
assert.equal(bundle.project_ref,EXPECTED_PROJECT_REF);
assert.equal(bundle.endpoint,AUTH_CONFIG_URL(EXPECTED_PROJECT_REF));
assert.equal(bundle.http_method,'GET');
assert.equal(bundle.workflow_provenance,null);
assert.equal(bundle.boundaries.workflow_provenance_bound,false);
assert.equal(bundle.derived_states.leaked_password_protection,'enabled');
assert.equal(bundle.derived_states.mfa_options,'configured');
assert.equal(bundle.intake_validation.leaked_password_protection_ok,true);
assert.equal(bundle.intake_validation.mfa_options_ok,true);
assert.equal(bundle.intake_inputs.leaked_password_protection.evidence_source,'supabase_management_api');
assert.equal(bundle.intake_inputs.mfa_options.evidence_source,'supabase_management_api');
assert.equal(bundle.boundaries.management_api_read_only,true);
assert.equal(bundle.boundaries.database_write_performed,false);
assert.equal(bundle.boundaries.auth_setting_mutation_performed,false);
assert.equal(bundle.boundaries.evidence_recording_performed,false);
assert.equal(bundle.boundaries.production_promotion_performed,false);
const serializedBundle=JSON.stringify(bundle);
assert.equal(serializedBundle.includes(TOKEN),false);
assert.equal(serializedBundle.includes('provider-secret-must-never-be-persisted'),false);
assert.equal(serializedBundle.includes('smtp-secret-must-never-be-persisted'),false);
assert.equal(serializedBundle.includes('site_url'),false,'Only allowlisted Auth security fields may be persisted.');

const workflowBundle=buildAuthManagementApiEvidenceBundle(secureConfig,{
  projectRef:EXPECTED_PROJECT_REF,
  observedAt:OBSERVED_AT,
  intakeNow:OBSERVED_AT,
  workflowProvenance:WORKFLOW_PROVENANCE,
});
assert.equal(workflowBundle.evidence_reference,WORKFLOW_REFERENCE);
assert.deepEqual(workflowBundle.workflow_provenance,normalizedProvenance);
assert.equal(workflowBundle.boundaries.workflow_provenance_bound,true);
for(const controlKey of ['leaked_password_protection','mfa_options']){
  const input=workflowBundle.intake_inputs[controlKey];
  assert.equal(input.evidence_reference,WORKFLOW_REFERENCE);
  assert.deepEqual(input.evidence_detail.workflow_provenance,normalizedProvenance);
}
assert.equal(validateAuthManagementCaptureBundle(workflowBundle),workflowBundle);
const workflowPrepared=prepareAuthEvidenceCandidatesFromCapture(workflowBundle,{now:OBSERVED_AT});
assert.equal(workflowPrepared.evidence_reference,WORKFLOW_REFERENCE);
assert.deepEqual(workflowPrepared.workflow_provenance,normalizedProvenance);
assert.equal(workflowPrepared.boundaries.workflow_provenance_bound,true);
for(const candidate of Object.values(workflowPrepared.candidates))assert.equal(candidate.evidence_reference,WORKFLOW_REFERENCE);
const tamperedWorkflowBundle=structuredClone(workflowBundle);
tamperedWorkflowBundle.evidence_reference='https://github.com/RosevearCreations/yw/actions/runs/1/attempts/1';
assert.throws(()=>validateAuthManagementCaptureBundle(tamperedWorkflowBundle),/does not match its exact GitHub Actions run\/attempt/);
assert.throws(()=>buildAuthManagementApiEvidenceBundle(secureConfig,{
  projectRef:EXPECTED_PROJECT_REF,
  observedAt:OBSERVED_AT,
  workflowProvenance:WORKFLOW_PROVENANCE,
  evidenceReference:'https://example.invalid/wrong-reference',
}),/must equal the exact GitHub Actions run\/attempt URL/);

const disabledBundle=buildAuthManagementApiEvidenceBundle({
  password_hibp_enabled:false,
  mfa_totp_enroll_enabled:false,
  mfa_totp_verify_enabled:false,
  mfa_phone_enroll_enabled:false,
  mfa_phone_verify_enabled:false,
  mfa_web_authn_enroll_enabled:false,
  mfa_web_authn_verify_enabled:false,
},{projectRef:EXPECTED_PROJECT_REF,observedAt:OBSERVED_AT,intakeNow:OBSERVED_AT});
assert.equal(disabledBundle.derived_states.leaked_password_protection,'disabled');
assert.equal(disabledBundle.derived_states.mfa_options,'not_configured');

const partialMfa=deriveAuthSecurityStates(sanitizeManagementApiAuthConfig({
  ...secureConfig,
  mfa_totp_verify_enabled:false,
}));
assert.equal(partialMfa.mfa_options,'not_configured','Enrollment without verification must not count as configured MFA.');

const phoneMfa=deriveAuthSecurityStates(sanitizeManagementApiAuthConfig({
  ...secureConfig,
  mfa_totp_enroll_enabled:false,
  mfa_totp_verify_enabled:false,
  mfa_phone_enroll_enabled:true,
  mfa_phone_verify_enabled:true,
}));
assert.equal(phoneMfa.mfa_options,'configured');
assert.deepEqual(phoneMfa.configured_mfa_factors,['phone']);

for(const key of CAPTURED_AUTH_FIELDS){
  const missing={...secureConfig};
  delete missing[key];
  assert.throws(()=>sanitizeManagementApiAuthConfig(missing),new RegExp(key),`${key} missing must fail closed.`);
  assert.throws(()=>sanitizeManagementApiAuthConfig({...secureConfig,[key]:'true'}),new RegExp(key),`${key} non-boolean must fail closed.`);
}
assert.throws(()=>buildAuthManagementApiEvidenceBundle(secureConfig,{projectRef:'wrongprojectref',observedAt:OBSERVED_AT}),/registered YardWeasels Production project/);

let fetchCalls=0;
let seenRequest=null;
const fakeFetch=async (url,options)=>{
  fetchCalls+=1;
  seenRequest={url,options};
  return {ok:true,status:200,json:async()=>secureConfig};
};
const captured=await captureAuthSecurityManagementApi({
  projectRef:EXPECTED_PROJECT_REF,
  accessToken:TOKEN,
  fetchImpl:fakeFetch,
  observedAt:OBSERVED_AT,
  intakeNow:OBSERVED_AT,
  timeoutMs:1000,
  workflowProvenance:WORKFLOW_PROVENANCE,
});
assert.equal(fetchCalls,1);
assert.equal(seenRequest.url,AUTH_CONFIG_URL(EXPECTED_PROJECT_REF));
assert.equal(seenRequest.options.method,'GET');
assert.equal(seenRequest.options.redirect,'error');
assert.equal(seenRequest.options.headers.accept,'application/json');
assert.equal(seenRequest.options.headers.authorization,`Bearer ${TOKEN}`);
assert.equal(captured.evidence_reference,WORKFLOW_REFERENCE);
assert.deepEqual(captured.workflow_provenance,normalizedProvenance);
assert.equal(JSON.stringify(captured).includes(TOKEN),false,'Access token must never enter the returned evidence bundle.');
assert.equal(JSON.stringify(captured).includes('provider-secret-must-never-be-persisted'),false);

let forbiddenFetchCalled=false;
await assert.rejects(
  ()=>captureAuthSecurityManagementApi({projectRef:'wrongprojectref',accessToken:TOKEN,fetchImpl:async()=>{forbiddenFetchCalled=true;}}),
  /registered YardWeasels Production project/,
);
assert.equal(forbiddenFetchCalled,false,'Wrong project must be rejected before any network call.');
let wrongProvenanceFetchCalled=false;
await assert.rejects(
  ()=>captureAuthSecurityManagementApi({
    projectRef:EXPECTED_PROJECT_REF,
    accessToken:TOKEN,
    workflowProvenance:{...WORKFLOW_PROVENANCE,repository:'wrong/repo'},
    fetchImpl:async()=>{wrongProvenanceFetchCalled=true;},
  }),
  /repository must equal/,
);
assert.equal(wrongProvenanceFetchCalled,false,'Invalid workflow provenance must be rejected before any network call.');
let missingTokenFetchCalled=false;
await assert.rejects(
  ()=>captureAuthSecurityManagementApi({projectRef:EXPECTED_PROJECT_REF,accessToken:'',fetchImpl:async()=>{missingTokenFetchCalled=true;}}),
  /SUPABASE_ACCESS_TOKEN is required/,
);
assert.equal(missingTokenFetchCalled,false,'Missing token must be rejected before any network call.');

for(const status of [401,403,429,500]){
  await assert.rejects(
    ()=>captureAuthSecurityManagementApi({
      projectRef:EXPECTED_PROJECT_REF,
      accessToken:TOKEN,
      fetchImpl:async()=>({ok:false,status,json:async()=>({})}),
      observedAt:OBSERVED_AT,
    }),
    new RegExp(`HTTP ${status}`),
  );
}

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'ywi-auth-management-capture-'));
try{
  const outputPath=path.join(tempDir,'capture.json');
  const written=await captureAndWriteAuthSecurityManagementApi({
    projectRef:EXPECTED_PROJECT_REF,
    accessToken:TOKEN,
    fetchImpl:fakeFetch,
    observedAt:OBSERVED_AT,
    intakeNow:OBSERVED_AT,
    workflowProvenance:WORKFLOW_PROVENANCE,
    outputPath,
  });
  assert.equal(written.ok,true,written.error);
  assert.equal(fs.existsSync(outputPath),true);
  const disk=fs.readFileSync(outputPath,'utf8');
  assert.equal(disk.includes(TOKEN),false);
  assert.equal(disk.includes('provider-secret-must-never-be-persisted'),false);
  assert.equal(disk.includes('smtp-secret-must-never-be-persisted'),false);
  const diskJson=JSON.parse(disk);
  assert.equal(diskJson.boundaries.evidence_recording_performed,false);
  assert.equal(diskJson.evidence_reference,WORKFLOW_REFERENCE);
  assert.deepEqual(diskJson.workflow_provenance,normalizedProvenance);

  fs.writeFileSync(outputPath,'stale unsafe capture','utf8');
  const locked=await captureAndWriteAuthSecurityManagementApi({
    projectRef:EXPECTED_PROJECT_REF,
    accessToken:TOKEN,
    fetchImpl:async()=>({ok:false,status:403,json:async()=>({})}),
    observedAt:OBSERVED_AT,
    outputPath,
  });
  assert.equal(locked.ok,false);
  assert.equal(fs.existsSync(outputPath),false,'Failed capture must remove stale output.');
  assert.equal(locked.error.includes(TOKEN),false);
} finally {
  fs.rmSync(tempDir,{recursive:true,force:true});
}

const packageJson=fs.readFileSync('package.json','utf8');
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
assert.ok(packageJson.includes('"auth:evidence:capture": "node scripts/auth-security-management-api-capture.mjs"'));
assert.ok(packageJson.includes('"test:auth-security-management-api-capture": "node scripts/auth-security-management-api-capture-check.mjs"'));
assert.ok(packageJson.includes('"test:auth-security-evidence-intake": "node scripts/auth-security-evidence-intake-check.mjs && node scripts/auth-security-management-api-capture-check.mjs && node scripts/auth-security-management-api-candidate-prep-check.mjs"'));
assert.ok(workflow.includes('npm run test:auth-security-evidence-intake'),'Canonical source CI must continue to execute the combined Auth evidence intake/capture/preparation regression gate.');
assert.equal(workflow.includes('npm run auth:evidence:capture'),false,'Canonical CI must never perform a live Management API capture.');
assert.equal(workflow.includes('SUPABASE_ACCESS_TOKEN'),false,'Canonical source CI must not require a Supabase Management API access token.');

console.log('Auth security Management API capture contract gate: PASS.');
