#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  EXPECTED_REPOSITORY,
  EXPECTED_RULESET_NAME,
  EXPECTED_SOURCE_WORKFLOW,
  EXPECTED_SOURCE_WORKFLOW_PATH,
  EXPECTED_REQUIRED_STATUS,
  POLICY_CONTRACT_VERSION,
  buildVerifiedRepositoryPolicyEvidence,
  verifyRepositoryPolicyEvidenceFiles,
} from './repository-policy-evidence-verify.mjs';

const clone=(value)=>JSON.parse(JSON.stringify(value));
const SHA='2812812812812812812812812812812812812812';
const OTHER_SHA='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const RUN_ID=34555512106;
const RUN_ATTEMPT=1;
const RULESET_ID=22841852;
const VERIFIED_AT='2026-09-11T03:00:00.000Z';

const list=[{
  id:RULESET_ID,name:EXPECTED_RULESET_NAME,target:'branch',source_type:'Repository',source:EXPECTED_REPOSITORY,
  enforcement:'active',updated_at:'2026-09-10T23:20:43.195Z',
}];
const ruleset={
  id:RULESET_ID,
  name:EXPECTED_RULESET_NAME,
  target:'branch',
  source_type:'Repository',
  source:EXPECTED_REPOSITORY,
  enforcement:'active',
  conditions:{ref_name:{exclude:[],include:['~DEFAULT_BRANCH']}},
  rules:[
    {type:'deletion'},
    {type:'non_fast_forward'},
    {type:'pull_request',parameters:{required_approving_review_count:0}},
    {type:'required_status_checks',parameters:{strict_required_status_checks_policy:false,required_status_checks:[{context:EXPECTED_REQUIRED_STATUS,integration_id:15368}]}},
  ],
  bypass_actors:[],
  current_user_can_bypass:'never',
  updated_at:'2026-09-10T23:20:43.195Z',
};
const main={name:'main',commit:{sha:SHA},protected:true};
const run={
  id:RUN_ID,run_attempt:RUN_ATTEMPT,name:EXPECTED_SOURCE_WORKFLOW,path:EXPECTED_SOURCE_WORKFLOW_PATH,
  event:'push',head_branch:'main',head_sha:SHA,status:'completed',conclusion:'success',repository:{full_name:EXPECTED_REPOSITORY},
};
const options={sourceSha:SHA,sourceRunId:RUN_ID,sourceRunAttempt:RUN_ATTEMPT,verifiedAt:VERIFIED_AT};

const valid=buildVerifiedRepositoryPolicyEvidence(list,ruleset,main,run,options);
assert.equal(valid.ok,true);
assert.equal(valid.evidence.verification_result,'passed');
assert.equal(valid.evidence.policy_contract_version,POLICY_CONTRACT_VERSION);
assert.equal(valid.evidence.repository,EXPECTED_REPOSITORY);
assert.equal(valid.evidence.branch_name,'main');
assert.equal(valid.evidence.source_sha,SHA);
assert.equal(valid.evidence.source_workflow_run_id,RUN_ID);
assert.equal(valid.evidence.branch_protection_reported,true);
assert.equal(valid.evidence.branch_policy_verified,true);
assert.equal(valid.evidence.ruleset_id,RULESET_ID);
assert.equal(valid.evidence.ruleset_name,EXPECTED_RULESET_NAME);
assert.equal(valid.evidence.ruleset_enforcement,'active');
assert.equal(valid.evidence.default_branch_targeted,true);
assert.equal(valid.evidence.pull_request_required,true);
assert.equal(valid.evidence.source_checks_required,true);
assert.equal(valid.evidence.force_push_blocked,true);
assert.equal(valid.evidence.deletion_blocked,true);
assert.equal(valid.evidence.bypass_actor_count,0);
assert.equal(valid.evidence.current_user_can_bypass,'never');
assert.deepEqual(valid.evidence.required_status_contexts,[EXPECTED_REQUIRED_STATUS]);
assert.equal(valid.evidence.boundaries.verification_only,true);
assert.equal(valid.evidence.boundaries.release_source_evidence_mutated,false);
assert.equal(valid.evidence.boundaries.production_promotion_performed,false);
assert.equal(valid.evidence.boundaries.business_data_mutated,false);
assert.equal(valid.evidence.boundaries.finance_provider_mutation_performed,false);

const lockedCases=[
  ['ruleset absent from list',[],ruleset,main,run,options],
  ['wrong ruleset name',list,{...ruleset,name:'other'},main,run,options],
  ['wrong ruleset target',list,{...ruleset,target:'tag'},main,run,options],
  ['wrong repository',list,{...ruleset,source:'Other/repo'},main,run,options],
  ['inactive ruleset',list,{...ruleset,enforcement:'disabled'},main,run,options],
  ['missing default branch target',list,{...ruleset,conditions:{ref_name:{exclude:[],include:['refs/heads/dev']}}},main,run,options],
  ['default target excluded',list,{...ruleset,conditions:{ref_name:{exclude:['refs/heads/main'],include:['~DEFAULT_BRANCH']}}},main,run,options],
  ['deletion not blocked',list,{...ruleset,rules:ruleset.rules.filter((r)=>r.type!=='deletion')},main,run,options],
  ['force push not blocked',list,{...ruleset,rules:ruleset.rules.filter((r)=>r.type!=='non_fast_forward')},main,run,options],
  ['pull request not required',list,{...ruleset,rules:ruleset.rules.filter((r)=>r.type!=='pull_request')},main,run,options],
  ['source checks not required',list,{...ruleset,rules:ruleset.rules.map((r)=>r.type==='required_status_checks'?{...r,parameters:{required_status_checks:[{context:'other-check'}]}}:r)},main,run,options],
  ['bypass actor exists',list,{...ruleset,bypass_actors:[{actor_id:1,actor_type:'RepositoryRole'}]},main,run,options],
  ['current actor can bypass',list,{...ruleset,current_user_can_bypass:'always'},main,run,options],
  ['main unprotected',list,ruleset,{...main,protected:false},run,options],
  ['main moved',list,ruleset,{...main,commit:{sha:OTHER_SHA}},run,options],
  ['source run id crossed',list,ruleset,main,{...run,id:RUN_ID+1},run?options:options],
  ['source run attempt crossed',list,ruleset,main,{...run,run_attempt:2},options],
  ['wrong workflow name',list,ruleset,main,{...run,name:'Other workflow'},options],
  ['wrong workflow path',list,ruleset,main,{...run,path:'.github/workflows/other.yml'},options],
  ['wrong event',list,ruleset,main,{...run,event:'pull_request'},options],
  ['wrong branch',list,ruleset,main,{...run,head_branch:'dev'},options],
  ['failed workflow',list,ruleset,main,{...run,conclusion:'failure'},options],
  ['active workflow',list,ruleset,main,{...run,status:'in_progress',conclusion:null},options],
  ['wrong workflow repository',list,ruleset,main,{...run,repository:{full_name:'Other/repo'}},options],
];
for(const [label,rulesets,rulesetValue,mainValue,runValue,opts] of lockedCases){
  const result=buildVerifiedRepositoryPolicyEvidence(rulesets,rulesetValue,mainValue,runValue,opts);
  assert.equal(result.ok,false,`${label} must fail closed.`);
  assert.equal(result.evidence.verification_result,'locked',`${label} must remain locked.`);
  assert.equal(result.evidence.branch_policy_verified,false,`${label} must never emit verified policy.`);
  assert.ok(result.errors.length>0,`${label} must report a reason.`);
}

const injected=clone(ruleset);
injected.untrusted_secret='policy-secret-must-never-appear';
const injectedRun=clone(run);
injectedRun.token='workflow-secret-must-never-appear';
const sanitized=buildVerifiedRepositoryPolicyEvidence(list,injected,main,injectedRun,options);
assert.equal(sanitized.ok,true);
const serialized=JSON.stringify(sanitized);
assert.equal(serialized.includes('policy-secret-must-never-appear'),false);
assert.equal(serialized.includes('workflow-secret-must-never-appear'),false);

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'ywi-repository-policy-'));
try{
  const rulesetsPath=path.join(tempDir,'repository-rulesets.json');
  const rulesetPath=path.join(tempDir,'repository-ruleset.json');
  const mainBranchPath=path.join(tempDir,'repository-main-branch.json');
  const workflowRunPath=path.join(tempDir,'repository-policy-workflow-run.json');
  const outputPath=path.join(tempDir,'repository-policy-evidence-verified.json');
  fs.writeFileSync(rulesetsPath,JSON.stringify(list));
  fs.writeFileSync(rulesetPath,JSON.stringify(ruleset));
  fs.writeFileSync(mainBranchPath,JSON.stringify(main));
  fs.writeFileSync(workflowRunPath,JSON.stringify(run));
  const written=verifyRepositoryPolicyEvidenceFiles({}, {rulesetsPath,rulesetPath,mainBranchPath,workflowRunPath,outputPath,...options});
  assert.equal(written.ok,true);
  assert.equal(fs.existsSync(outputPath),true);
  const parsed=JSON.parse(fs.readFileSync(outputPath,'utf8'));
  assert.equal(parsed.branch_policy_verified,true);
  assert.equal(parsed.ruleset_id,RULESET_ID);

  fs.writeFileSync(outputPath,'stale verified policy','utf8');
  fs.writeFileSync(mainBranchPath,JSON.stringify({...main,protected:false}));
  const locked=verifyRepositoryPolicyEvidenceFiles({}, {rulesetsPath,rulesetPath,mainBranchPath,workflowRunPath,outputPath,...options});
  assert.equal(locked.ok,false);
  assert.equal(fs.existsSync(outputPath),false,'Locked policy verification must remove stale output.');

  fs.writeFileSync(outputPath,'stale verified policy','utf8');
  fs.writeFileSync(mainBranchPath,JSON.stringify(main));
  fs.writeFileSync(rulesetPath,'not-json');
  const malformed=verifyRepositoryPolicyEvidenceFiles({}, {rulesetsPath,rulesetPath,mainBranchPath,workflowRunPath,outputPath,...options});
  assert.equal(malformed.ok,false);
  assert.equal(fs.existsSync(outputPath),false,'Malformed policy evidence must remove stale output.');
} finally {
  fs.rmSync(tempDir,{recursive:true,force:true});
}

const migration=fs.readFileSync('sql/208_repository_policy_evidence_authority.sql','utf8');
for(const value of [
  'create table if not exists public.it_repository_policy_evidence',
  'create or replace function public.ywi_record_verified_repository_policy_evidence(',
  'create or replace view public.v_it_repository_policy_evidence_current',
  "ruleset_name='main protection'",
  "required_status_contexts @> array['source-checks']::text[]",
  'bypass_actor_count=0',
  "current_user_can_bypass='never'",
  'create or replace view public.v_it_release_authority_status',
  'from public.v_it_repository_policy_evidence_current',
  'release_source_policy_separation_preserved',
  "208,'208_repository_policy_evidence_authority'",
  '208 as expected_schema_version',
]) assert.ok(migration.includes(value),`Schema 208 migration missing ${value}`);
assert.ok(migration.includes("where workflow_status='passed' and branch_policy_verified is distinct from false"),'Release-source evidence must remain separate from policy evidence.');
assert.ok(migration.includes("count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11"),'Human/provider/accounting/content/staging rails must remain open.');
assert.ok(migration.includes('execution_enabled=true or provider_mutation_enabled=true'),'Finance/provider execution must remain OFF.');

console.log('Build 281 repository-policy evidence verifier gate: PASS.');
