import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EXPECTED_REPOSITORY,
  EXPECTED_WORKFLOW,
  buildReleaseSourceEvidence,
  discoverLatestSchema,
  writeReleaseSourceEvidence,
} from './release-source-evidence-bundle.mjs';

const SHA='a'.repeat(40);
const baseEnv={
  YWI_GITHUB_EVENT_NAME:'push',
  YWI_GITHUB_REF:'refs/heads/main',
  YWI_GITHUB_REPOSITORY:EXPECTED_REPOSITORY,
  YWI_EXPECTED_MAIN_SHA:SHA,
  YWI_GITHUB_MAIN_SHA:SHA,
  YWI_GITHUB_MAIN_PROTECTED:'true',
  YWI_GITHUB_RUN_ID:'33999999999',
  YWI_GITHUB_RUN_ATTEMPT:'2',
  YWI_GITHUB_WORKFLOW_NAME:EXPECTED_WORKFLOW,
  YWI_SOURCE_CHECKS_RESULT:'success',
};
const latestSchema=discoverLatestSchema();
assert.ok(latestSchema>=201,`Expected repository schema 201 or newer, got ${latestSchema}.`);

const valid=buildReleaseSourceEvidence(baseEnv,{latestSchema,generatedAt:'2026-09-04T23:10:00.000Z'});
assert.equal(valid.ok,true);
assert.equal(valid.evidence.source_branch,'main');
assert.equal(valid.evidence.source_sha,SHA);
assert.equal(valid.evidence.github_reported_main_sha,SHA);
assert.equal(valid.evidence.exact_main_sha_verified,true);
assert.equal(valid.evidence.workflow_run_id,33999999999);
assert.equal(valid.evidence.workflow_run_attempt,2);
assert.equal(valid.evidence.workflow_name,EXPECTED_WORKFLOW);
assert.equal(valid.evidence.source_checks_result,'success');
assert.equal(valid.evidence.workflow_conclusion,'verify_after_run_completion');
assert.equal(valid.evidence.schema_version,latestSchema);
assert.equal(valid.evidence.branch_protection_reported,true);
assert.equal(valid.evidence.branch_policy_verified,false);
assert.equal(valid.evidence.database_record_candidate.workflow_status,'unknown');
assert.equal(valid.evidence.database_record_candidate.branch_policy_verified,false);
assert.equal(valid.evidence.boundaries.ci_source_validation_only,true);
assert.equal(valid.evidence.boundaries.database_evidence_recorded,false);
assert.equal(valid.evidence.boundaries.production_promotion_performed,false);
assert.equal(valid.evidence.boundaries.production_mutation_performed,false);
assert.equal(valid.evidence.boundaries.provider_mutation_performed,false);
assert.ok(valid.evidence.required_followup.some((item)=>item.includes('workflow run conclusion is success')));
assert.ok(valid.evidence.required_followup.some((item)=>item.includes('Production promotion remains')));

const cases=[
  ['pull request event',{YWI_GITHUB_EVENT_NAME:'pull_request'}],
  ['wrong ref',{YWI_GITHUB_REF:'refs/heads/dev'}],
  ['wrong repository',{YWI_GITHUB_REPOSITORY:'Other/repo'}],
  ['short workflow SHA',{YWI_EXPECTED_MAIN_SHA:'abc'}],
  ['short reported SHA',{YWI_GITHUB_MAIN_SHA:'abc'}],
  ['crossed SHA',{YWI_GITHUB_MAIN_SHA:'b'.repeat(40)}],
  ['unprotected main',{YWI_GITHUB_MAIN_PROTECTED:'false'}],
  ['missing run id',{YWI_GITHUB_RUN_ID:''}],
  ['invalid run attempt',{YWI_GITHUB_RUN_ATTEMPT:'0'}],
  ['wrong workflow',{YWI_GITHUB_WORKFLOW_NAME:'Another workflow'}],
  ['source checks not green',{YWI_SOURCE_CHECKS_RESULT:'failure'}],
];
for(const [label,override] of cases){
  const result=buildReleaseSourceEvidence({...baseEnv,...override},{latestSchema});
  assert.equal(result.ok,false,`${label} must fail closed.`);
  assert.ok(result.errors.length>0,`${label} must report a reason.`);
}

const staleSchema=buildReleaseSourceEvidence(baseEnv,{latestSchema:200});
assert.equal(staleSchema.ok,false,'Schema discovery below the current source floor must fail closed.');

const secretEnv={
  ...baseEnv,
  SUPABASE_SERVICE_ROLE_KEY:'service-role-secret-must-never-appear',
  YWI_STAGING_JOB_ADMIN_JWT:'jwt-secret-must-never-appear',
  GITHUB_TOKEN:'github-token-must-never-appear',
};
const serialized=JSON.stringify(buildReleaseSourceEvidence(secretEnv,{latestSchema}));
for(const secret of ['service-role-secret-must-never-appear','jwt-secret-must-never-appear','github-token-must-never-appear']){
  assert.equal(serialized.includes(secret),false,'Release-source evidence must never serialize unrelated credentials.');
}

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'ywi-release-source-'));
try{
  const outputPath=path.join(tempDir,'release-source-evidence.json');
  const written=writeReleaseSourceEvidence(baseEnv,{latestSchema,generatedAt:'2026-09-04T23:10:00.000Z',outputPath});
  assert.equal(written.ok,true);
  assert.equal(fs.existsSync(outputPath),true);
  const parsed=JSON.parse(fs.readFileSync(outputPath,'utf8'));
  assert.equal(parsed.source_sha,SHA);
  assert.equal(parsed.workflow_run_id,33999999999);
  assert.equal(parsed.database_record_candidate.workflow_status,'unknown');

  fs.writeFileSync(outputPath,'stale evidence','utf8');
  const locked=writeReleaseSourceEvidence({...baseEnv,YWI_GITHUB_MAIN_PROTECTED:'false'},{latestSchema,outputPath});
  assert.equal(locked.ok,false);
  assert.equal(fs.existsSync(outputPath),false,'Locked generation must remove any stale candidate file.');
} finally {
  fs.rmSync(tempDir,{recursive:true,force:true});
}

console.log(`Build 217 exact-main release-source evidence gate: PASS (schema ${latestSchema}).`);
