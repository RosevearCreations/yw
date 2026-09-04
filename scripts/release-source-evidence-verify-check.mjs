import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EXPECTED_REPOSITORY,
  EXPECTED_WORKFLOW,
  buildReleaseSourceEvidence,
  discoverLatestSchema,
} from './release-source-evidence-bundle.mjs';
import {
  EXPECTED_WORKFLOW_PATH,
  buildVerifiedReleaseSourceEvidence,
  verifyReleaseSourceEvidenceFiles,
} from './release-source-evidence-verify.mjs';

const clone=(value)=>JSON.parse(JSON.stringify(value));
const SHA='c'.repeat(40);
const OTHER_SHA='d'.repeat(40);
const RUN_ID=33999999991;
const RUN_ATTEMPT=3;
const latestSchema=discoverLatestSchema();
assert.ok(latestSchema>=202,`Expected repository schema 202 or newer, got ${latestSchema}.`);

const candidateResult=buildReleaseSourceEvidence({
  YWI_GITHUB_EVENT_NAME:'push',
  YWI_GITHUB_REF:'refs/heads/main',
  YWI_GITHUB_REPOSITORY:EXPECTED_REPOSITORY,
  YWI_EXPECTED_MAIN_SHA:SHA,
  YWI_GITHUB_MAIN_SHA:SHA,
  YWI_GITHUB_MAIN_PROTECTED:'true',
  YWI_GITHUB_RUN_ID:String(RUN_ID),
  YWI_GITHUB_RUN_ATTEMPT:String(RUN_ATTEMPT),
  YWI_GITHUB_WORKFLOW_NAME:EXPECTED_WORKFLOW,
  YWI_SOURCE_CHECKS_RESULT:'success',
},{latestSchema,generatedAt:'2026-09-04T23:55:00.000Z'});
assert.equal(candidateResult.ok,true,'The canonical candidate fixture must be valid.');
const candidate=candidateResult.evidence;
const workflowRun={
  id:RUN_ID,
  name:EXPECTED_WORKFLOW,
  path:EXPECTED_WORKFLOW_PATH,
  event:'push',
  head_branch:'main',
  head_sha:SHA,
  status:'completed',
  conclusion:'success',
  run_attempt:RUN_ATTEMPT,
  repository:{full_name:EXPECTED_REPOSITORY},
};
const mainBranch={name:'main',commit:{sha:SHA},protected:true};

const valid=buildVerifiedReleaseSourceEvidence(candidate,workflowRun,mainBranch,{latestSchema,verifiedAt:'2026-09-04T23:56:00.000Z'});
assert.equal(valid.ok,true);
assert.equal(valid.evidence.evidence_kind,'ywi_exact_main_release_source_verified');
assert.equal(valid.evidence.verification_result,'passed');
assert.equal(valid.evidence.repository,EXPECTED_REPOSITORY);
assert.equal(valid.evidence.source_branch,'main');
assert.equal(valid.evidence.source_sha,SHA);
assert.equal(valid.evidence.github_reported_main_sha,SHA);
assert.equal(valid.evidence.exact_main_sha_verified,true);
assert.equal(valid.evidence.workflow_run_id,RUN_ID);
assert.equal(valid.evidence.workflow_run_attempt,RUN_ATTEMPT);
assert.equal(valid.evidence.workflow_name,EXPECTED_WORKFLOW);
assert.equal(valid.evidence.workflow_event,'push');
assert.equal(valid.evidence.workflow_status,'completed');
assert.equal(valid.evidence.workflow_conclusion,'success');
assert.equal(valid.evidence.schema_version,latestSchema);
assert.equal(valid.evidence.branch_protection_reported,true);
assert.equal(valid.evidence.branch_policy_verified,false);
assert.equal(valid.evidence.database_record_candidate.workflow_status,'passed');
assert.equal(valid.evidence.database_record_candidate.source_sha,SHA);
assert.equal(valid.evidence.database_record_candidate.branch_policy_verified,false);
assert.equal(valid.evidence.boundaries.verification_only,true);
assert.equal(valid.evidence.boundaries.database_evidence_recorded,false);
assert.equal(valid.evidence.boundaries.production_promotion_performed,false);
assert.equal(valid.evidence.boundaries.production_mutation_performed,false);
assert.equal(valid.evidence.boundaries.provider_mutation_performed,false);
assert.ok(valid.evidence.required_followup.some((item)=>item.includes('authorized server/service')));
assert.ok(valid.evidence.required_followup.some((item)=>item.includes('Detailed GitHub branch-policy verification remains false')));
assert.ok(valid.evidence.required_followup.some((item)=>item.includes('Production promotion remains')));

const lockedCases=[
  ['candidate format',()=>{const v=clone(candidate);v.evidence_format_version=2;return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate kind',()=>{const v=clone(candidate);v.evidence_kind='unexpected';return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate repository',()=>{const v=clone(candidate);v.repository='Other/repo';return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate branch',()=>{const v=clone(candidate);v.source_branch='dev';return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate source sha',()=>{const v=clone(candidate);v.source_sha=OTHER_SHA;return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate exact main flag',()=>{const v=clone(candidate);v.exact_main_sha_verified=false;return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate source result',()=>{const v=clone(candidate);v.source_checks_result='failure';return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate premature conclusion',()=>{const v=clone(candidate);v.workflow_conclusion='success';return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate detailed policy tamper',()=>{const v=clone(candidate);v.branch_policy_verified=true;return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate database status tamper',()=>{const v=clone(candidate);v.database_record_candidate.workflow_status='passed';return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate database sha tamper',()=>{const v=clone(candidate);v.database_record_candidate.source_sha=OTHER_SHA;return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['candidate database boundary tamper',()=>{const v=clone(candidate);v.boundaries.database_evidence_recorded=true;return [v,workflowRun,mainBranch,{latestSchema}];}],
  ['schema mismatch',()=>[candidate,workflowRun,mainBranch,{latestSchema:latestSchema+1}]],
  ['run id mismatch',()=>{const v=clone(workflowRun);v.id=RUN_ID+1;return [candidate,v,mainBranch,{latestSchema}];}],
  ['run attempt mismatch',()=>{const v=clone(workflowRun);v.run_attempt=RUN_ATTEMPT+1;return [candidate,v,mainBranch,{latestSchema}];}],
  ['run workflow mismatch',()=>{const v=clone(workflowRun);v.name='Another workflow';return [candidate,v,mainBranch,{latestSchema}];}],
  ['run path mismatch',()=>{const v=clone(workflowRun);v.path='.github/workflows/other.yml';return [candidate,v,mainBranch,{latestSchema}];}],
  ['run event mismatch',()=>{const v=clone(workflowRun);v.event='pull_request';return [candidate,v,mainBranch,{latestSchema}];}],
  ['run branch mismatch',()=>{const v=clone(workflowRun);v.head_branch='dev';return [candidate,v,mainBranch,{latestSchema}];}],
  ['run sha mismatch',()=>{const v=clone(workflowRun);v.head_sha=OTHER_SHA;return [candidate,v,mainBranch,{latestSchema}];}],
  ['run still active',()=>{const v=clone(workflowRun);v.status='in_progress';v.conclusion=null;return [candidate,v,mainBranch,{latestSchema}];}],
  ['run failed',()=>{const v=clone(workflowRun);v.conclusion='failure';return [candidate,v,mainBranch,{latestSchema}];}],
  ['run repository mismatch',()=>{const v=clone(workflowRun);v.repository.full_name='Other/repo';return [candidate,v,mainBranch,{latestSchema}];}],
  ['main branch name mismatch',()=>{const v=clone(mainBranch);v.name='dev';return [candidate,workflowRun,v,{latestSchema}];}],
  ['main moved after run',()=>{const v=clone(mainBranch);v.commit.sha=OTHER_SHA;return [candidate,workflowRun,v,{latestSchema}];}],
  ['main unprotected',()=>{const v=clone(mainBranch);v.protected=false;return [candidate,workflowRun,v,{latestSchema}];}],
];
for(const [label,make] of lockedCases){
  const result=buildVerifiedReleaseSourceEvidence(...make());
  assert.equal(result.ok,false,`${label} must fail closed.`);
  assert.equal(result.evidence.verification_result,'locked',`${label} must remain locked.`);
  assert.notEqual(result.evidence.database_record_candidate.workflow_status,'passed',`${label} must never emit a passed database payload.`);
  assert.ok(result.errors.length>0,`${label} must report a reason.`);
}

const candidateWithSecret=clone(candidate);
candidateWithSecret.untrusted_extra='candidate-secret-must-never-appear';
const secretResult=buildVerifiedReleaseSourceEvidence(candidateWithSecret,workflowRun,mainBranch,{latestSchema});
assert.equal(secretResult.ok,true);
const serialized=JSON.stringify(secretResult);
assert.equal(serialized.includes('candidate-secret-must-never-appear'),false,'Unknown candidate fields must not be copied to verified evidence.');

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'ywi-release-verify-'));
try{
  const candidatePath=path.join(tempDir,'release-source-evidence.json');
  const workflowRunPath=path.join(tempDir,'release-workflow-run.json');
  const mainBranchPath=path.join(tempDir,'release-main-branch.json');
  const outputPath=path.join(tempDir,'release-source-evidence-verified.json');
  fs.writeFileSync(candidatePath,JSON.stringify(candidate),'utf8');
  fs.writeFileSync(workflowRunPath,JSON.stringify(workflowRun),'utf8');
  fs.writeFileSync(mainBranchPath,JSON.stringify(mainBranch),'utf8');

  const written=verifyReleaseSourceEvidenceFiles({}, {
    candidatePath,workflowRunPath,mainBranchPath,outputPath,latestSchema,verifiedAt:'2026-09-04T23:56:00.000Z',
  });
  assert.equal(written.ok,true);
  assert.equal(fs.existsSync(outputPath),true);
  const parsed=JSON.parse(fs.readFileSync(outputPath,'utf8'));
  assert.equal(parsed.verification_result,'passed');
  assert.equal(parsed.database_record_candidate.workflow_status,'passed');

  fs.writeFileSync(outputPath,'stale verified evidence','utf8');
  fs.writeFileSync(mainBranchPath,JSON.stringify({...mainBranch,protected:false}),'utf8');
  const locked=verifyReleaseSourceEvidenceFiles({}, {candidatePath,workflowRunPath,mainBranchPath,outputPath,latestSchema});
  assert.equal(locked.ok,false);
  assert.equal(fs.existsSync(outputPath),false,'Locked verification must remove any stale verified output.');

  fs.writeFileSync(outputPath,'stale verified evidence','utf8');
  fs.writeFileSync(mainBranchPath,JSON.stringify(mainBranch),'utf8');
  fs.writeFileSync(workflowRunPath,'not-json','utf8');
  const malformed=verifyReleaseSourceEvidenceFiles({}, {candidatePath,workflowRunPath,mainBranchPath,outputPath,latestSchema});
  assert.equal(malformed.ok,false);
  assert.equal(fs.existsSync(outputPath),false,'Unreadable evidence input must remove stale verified output.');
} finally {
  fs.rmSync(tempDir,{recursive:true,force:true});
}

const packageJson=fs.readFileSync('package.json','utf8');
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const nextSteps=fs.readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
const help=fs.readFileSync('help.html','utf8');
assert.ok(packageJson.includes('"release:evidence:verify": "node scripts/release-source-evidence-verify.mjs"'),'Verifier command must be wired in package.json.');
assert.ok(packageJson.includes('"test:release-source-evidence-verify": "node scripts/release-source-evidence-verify-check.mjs"'),'Verifier regression gate must be wired in package.json.');
assert.ok(workflow.includes('npm run test:release-source-evidence-verify'),'Canonical source workflow must enforce verifier regressions.');
for(const text of [nextSteps,help]){
  assert.ok(text.includes('release-source-evidence-verified.json'),'Operator guidance must identify the verified evidence output.');
  assert.ok(text.includes('workflow_status=passed'),'Operator guidance must explain the passed-status boundary.');
  assert.ok(text.includes('branch_policy_verified=false'),'Operator guidance must preserve the detailed-policy boundary.');
}
assert.equal(/Build\s+219|[0-9a-f]{40}/i.test(nextSteps),false,'Active next-steps documentation must not become a build/SHA ledger.');

console.log(`Exact-main release-source final verifier gate: PASS (schema ${latestSchema}).`);
