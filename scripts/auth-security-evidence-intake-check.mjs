#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AUTH_EVIDENCE_INTAKE_VERSION,
  EXPECTED_PROJECT_REF,
  buildAuthEvidenceRecordCandidate,
  writeAuthEvidenceRecordCandidate,
} from './auth-security-evidence-intake.mjs';

const NOW='2026-09-05T00:00:00.000Z';
const OBSERVED='2026-09-04T23:45:00.000Z';
const base={
  evidence_capture_version:AUTH_EVIDENCE_INTAKE_VERSION,
  control_key:'leaked_password_protection',
  evidence_source:'supabase_dashboard',
  project_ref:EXPECTED_PROJECT_REF,
  observed_state:'enabled',
  observed_at:OBSERVED,
  evidence_reference:'dashboard://project/jmqvkgiqlimdhcofwkxr/auth/password-security/2026-09-04T23:45Z',
  source_capture:{project_ref:EXPECTED_PROJECT_REF,control:'leaked_password_protection',enabled:true},
  evidence_detail:{operator_note:'Observed in current Auth password settings.'},
};

const valid=buildAuthEvidenceRecordCandidate(base,{now:NOW});
assert.equal(valid.ok,true,valid.errors.join('; '));
assert.equal(valid.candidate.project_ref,EXPECTED_PROJECT_REF);
assert.equal(valid.candidate.control_key,'leaked_password_protection');
assert.equal(valid.candidate.evidence_source,'supabase_dashboard');
assert.equal(valid.candidate.observed_state,'enabled');
assert.equal(valid.candidate.derived_verification_status,'verified_secure');
assert.equal(valid.candidate.database_record_candidate.verification_status,'verified_secure');
assert.equal(valid.candidate.database_record_candidate.is_authoritative,true);
assert.equal(valid.candidate.source_authenticity_verified_by_tool,false);
assert.equal(valid.candidate.recording_authorized_by_tool,false);
assert.equal(valid.candidate.boundaries.database_write_performed,false);
assert.equal(valid.candidate.boundaries.auth_setting_mutation_performed,false);
assert.equal(valid.candidate.boundaries.current_admin_todo_auto_closed,false);
assert.match(valid.candidate.source_capture_sha256,/^[0-9a-f]{64}$/);
assert.equal(JSON.stringify(valid.candidate).includes('operator_note'),true);
assert.equal(JSON.stringify(valid.candidate).includes('"enabled":true'),false,'Raw source capture must not be serialized into the record candidate.');
assert.equal(valid.candidate.database_record_candidate.evidence_detail.source_capture_sha256,valid.candidate.source_capture_sha256);
assert.ok(valid.candidate.required_followup.some((item)=>item.includes('genuine current Supabase Dashboard or Management API evidence')));

const stableA=buildAuthEvidenceRecordCandidate({...base,source_capture:{b:2,a:1}},{now:NOW});
const stableB=buildAuthEvidenceRecordCandidate({...base,source_capture:{a:1,b:2}},{now:NOW});
assert.equal(stableA.ok,true);
assert.equal(stableB.ok,true);
assert.equal(stableA.candidate.source_capture_sha256,stableB.candidate.source_capture_sha256,'Capture digest must be stable across object-key ordering.');

const mfaSecure=buildAuthEvidenceRecordCandidate({
  ...base,
  control_key:'mfa_options',
  evidence_source:'supabase_management_api',
  observed_state:'configured',
  evidence_reference:'management-api://projects/jmqvkgiqlimdhcofwkxr/auth/config/request-1234',
  source_capture:{project_ref:EXPECTED_PROJECT_REF,mfa:{enrollment_api:'enabled',challenge_verify_api:'enabled'}},
},{now:NOW});
assert.equal(mfaSecure.ok,true,mfaSecure.errors.join('; '));
assert.equal(mfaSecure.candidate.derived_verification_status,'verified_secure');

const leakFollowup=buildAuthEvidenceRecordCandidate({...base,observed_state:'disabled'},{now:NOW});
assert.equal(leakFollowup.ok,true);
assert.equal(leakFollowup.candidate.derived_verification_status,'verified_followup');
const mfaFollowup=buildAuthEvidenceRecordCandidate({...mfaSecure.candidate.database_record_candidate,
  evidence_capture_version:1,
  control_key:'mfa_options',
  evidence_source:'supabase_management_api',
  project_ref:EXPECTED_PROJECT_REF,
  observed_state:'not_configured',
  observed_at:OBSERVED,
  evidence_reference:'management-api://projects/jmqvkgiqlimdhcofwkxr/auth/config/request-5678',
  source_capture:{mfa_configured:false},
},{now:NOW});
assert.equal(mfaFollowup.ok,false,'Derived/database-only fields copied back into input must fail closed.');

const cleanMfaFollowup=buildAuthEvidenceRecordCandidate({
  evidence_capture_version:1,
  control_key:'mfa_options',
  evidence_source:'supabase_management_api',
  project_ref:EXPECTED_PROJECT_REF,
  observed_state:'not_configured',
  observed_at:OBSERVED,
  evidence_reference:'management-api://projects/jmqvkgiqlimdhcofwkxr/auth/config/request-5678',
  source_capture:{mfa_configured:false},
},{now:NOW});
assert.equal(cleanMfaFollowup.ok,true);
assert.equal(cleanMfaFollowup.candidate.derived_verification_status,'verified_followup');

const unknown=buildAuthEvidenceRecordCandidate({...base,observed_state:'unknown'},{now:NOW});
assert.equal(unknown.ok,true);
assert.equal(unknown.candidate.derived_verification_status,'unverified');

const failCases=[
  ['wrong capture version',{evidence_capture_version:2}],
  ['manual source',{evidence_source:'manual_external'}],
  ['advisor source',{evidence_source:'supabase_advisor'}],
  ['wrong project',{project_ref:'aaaaaaaaaaaaaaaaaaaa'}],
  ['missing reference',{evidence_reference:''}],
  ['invalid leak state',{observed_state:'configured'}],
  ['stale observation',{observed_at:'2026-07-01T00:00:00.000Z'}],
  ['future observation',{observed_at:'2026-09-05T01:00:00.000Z'}],
  ['operator supplied verification',{verification_status:'verified_secure'}],
  ['operator supplied authority',{is_authoritative:true}],
  ['operator supplied expiry',{expires_at:'2026-10-01T00:00:00.000Z'}],
  ['empty capture',{source_capture:''}],
  ['missing capture',{source_capture:undefined}],
  ['secret-bearing capture',{source_capture:{authorization:'Bearer secret'}}],
  ['secret-bearing detail',{evidence_detail:{service_role_key:'secret'}}],
];
for(const [label,override] of failCases){
  const result=buildAuthEvidenceRecordCandidate({...base,...override},{now:NOW});
  assert.equal(result.ok,false,`${label} must fail closed.`);
  assert.ok(result.errors.length>0,`${label} must report a reason.`);
}

const secretInput={
  ...base,
  source_capture:'actual-observation-without-credentials',
  evidence_detail:{note:'safe'},
  SUPABASE_SERVICE_ROLE_KEY:'service-role-secret-must-never-appear',
  access_token:'token-secret-must-never-appear',
};
const secretResult=buildAuthEvidenceRecordCandidate(secretInput,{now:NOW});
assert.equal(secretResult.ok,true,'Unrecognized top-level fields must not be copied into candidate output.');
const serialized=JSON.stringify(secretResult.candidate);
assert.equal(serialized.includes('service-role-secret-must-never-appear'),false);
assert.equal(serialized.includes('token-secret-must-never-appear'),false);

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'ywi-auth-evidence-intake-'));
try{
  const outputPath=path.join(tempDir,'candidate.json');
  const written=writeAuthEvidenceRecordCandidate(base,{now:NOW,outputPath});
  assert.equal(written.ok,true);
  assert.equal(fs.existsSync(outputPath),true);
  const parsed=JSON.parse(fs.readFileSync(outputPath,'utf8'));
  assert.equal(parsed.database_record_candidate.verification_status,'verified_secure');
  assert.equal(parsed.source_authenticity_verified_by_tool,false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed,'source_capture'),false);

  fs.writeFileSync(outputPath,'stale candidate','utf8');
  const locked=writeAuthEvidenceRecordCandidate({...base,evidence_source:'manual_external'},{now:NOW,outputPath});
  assert.equal(locked.ok,false);
  assert.equal(fs.existsSync(outputPath),false,'Locked intake must remove stale candidate output.');
} finally {
  fs.rmSync(tempDir,{recursive:true,force:true});
}

const packageJson=fs.readFileSync('package.json','utf8');
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const handbook=fs.readFileSync('docs/ACTIVE_PROJECT_HANDBOOK.md','utf8');
const nextSteps=fs.readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
const help=fs.readFileSync('help.html','utf8');
assert.ok(packageJson.includes('"auth:evidence:intake": "node scripts/auth-security-evidence-intake.mjs"'));
assert.ok(packageJson.includes('"test:auth-security-evidence-intake": "node scripts/auth-security-evidence-intake-check.mjs"'));
assert.ok(workflow.includes('npm run test:auth-security-evidence-intake'));
for(const text of [handbook,nextSteps]){
  assert.ok(text.includes('auth:evidence:intake'));
  assert.ok(text.includes('source authenticity'));
  assert.ok(text.includes('service-role'));
}
assert.ok(help.includes('auth:evidence:intake'));
assert.ok(help.includes('source authenticity'));
assert.ok(help.includes('service-role'));
assert.equal([handbook,nextSteps].some((text)=>/Build\s+\d+|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)),false,'Active docs must not become build/run/SHA ledgers.');

console.log('Auth security evidence intake contract gate: PASS.');
