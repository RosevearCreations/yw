#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_REPOSITORY='RosevearCreations/yw';
export const EXPECTED_RULESET_NAME='main protection';
export const EXPECTED_SOURCE_WORKFLOW='YWI source and staging checks';
export const EXPECTED_SOURCE_WORKFLOW_PATH='.github/workflows/staging-browser-integration.yml';
export const EXPECTED_REQUIRED_STATUS='source-checks';
export const POLICY_CONTRACT_VERSION=1;
const SHA_RE=/^[0-9a-f]{40}$/;
const clean=(value)=>String(value ?? '').trim();
const positiveInteger=(value)=>{
  const parsed=Number.parseInt(clean(value),10);
  return Number.isInteger(parsed)&&parsed>0 ? parsed : null;
};
const fullSha=(value)=>{
  const sha=clean(value).toLowerCase();
  return SHA_RE.test(sha) ? sha : null;
};
const object=(value)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));

function parseJsonFile(filePath,label,allowArray=false){
  try{
    const parsed=JSON.parse(fs.readFileSync(filePath,'utf8'));
    if(allowArray){
      if(!Array.isArray(parsed))throw new Error('JSON root must be an array');
    }else if(!object(parsed))throw new Error('JSON root must be an object');
    return {ok:true,value:parsed};
  }catch(error){
    return {ok:false,error:`${label} could not be read as JSON: ${error.message}`};
  }
}

export function buildVerifiedRepositoryPolicyEvidence(rulesets=[],ruleset={},mainBranch={},workflowRun={},options={}){
  const errors=[];
  if(!Array.isArray(rulesets))errors.push('Repository rulesets evidence must be an array.');
  if(!object(ruleset))errors.push('Repository ruleset detail must be an object.');
  if(!object(mainBranch))errors.push('Current main branch evidence must be an object.');
  if(!object(workflowRun))errors.push('Source workflow run evidence must be an object.');

  const rulesetId=positiveInteger(ruleset?.id);
  const listed=Array.isArray(rulesets)&&rulesetId
    ? rulesets.find((entry)=>positiveInteger(entry?.id)===rulesetId)
    : null;
  const sourceSha=fullSha(workflowRun?.head_sha);
  const currentMainSha=fullSha(mainBranch?.commit?.sha);
  const sourceRunId=positiveInteger(workflowRun?.id);
  const sourceRunAttempt=positiveInteger(workflowRun?.run_attempt);
  const expectedSourceSha=fullSha(options.sourceSha);
  const expectedRunId=positiveInteger(options.sourceRunId);
  const expectedRunAttempt=positiveInteger(options.sourceRunAttempt);

  if(!rulesetId)errors.push('Ruleset detail must have a positive id.');
  if(!listed)errors.push('The detailed ruleset must be present in the current repository rulesets list.');
  if(ruleset?.name!==EXPECTED_RULESET_NAME)errors.push(`Ruleset name must exactly equal ${EXPECTED_RULESET_NAME}.`);
  if(listed&&listed.name!==EXPECTED_RULESET_NAME)errors.push('Ruleset list entry name does not match the required ruleset.');
  if(ruleset?.target!=='branch'||listed?.target!=='branch')errors.push('Repository policy evidence must come from a branch ruleset.');
  if(ruleset?.source_type!=='Repository'||ruleset?.source!==EXPECTED_REPOSITORY)errors.push('Ruleset must be owned by the YardWeasels repository.');
  if(ruleset?.enforcement!=='active'||listed?.enforcement!=='active')errors.push('Main protection ruleset must be actively enforced.');

  const include=Array.isArray(ruleset?.conditions?.ref_name?.include) ? ruleset.conditions.ref_name.include : [];
  const exclude=Array.isArray(ruleset?.conditions?.ref_name?.exclude) ? ruleset.conditions.ref_name.exclude : [];
  const defaultBranchTargeted=include.includes('~DEFAULT_BRANCH');
  if(!defaultBranchTargeted)errors.push('Ruleset must explicitly target the default branch.');
  if(exclude.length)errors.push('Main protection ruleset must not exclude branches from its default-branch target.');

  const rules=Array.isArray(ruleset?.rules) ? ruleset.rules : [];
  const deletionBlocked=rules.some((rule)=>rule?.type==='deletion');
  const forcePushBlocked=rules.some((rule)=>rule?.type==='non_fast_forward');
  const pullRequestRule=rules.find((rule)=>rule?.type==='pull_request');
  const statusRule=rules.find((rule)=>rule?.type==='required_status_checks');
  const requiredStatusContexts=[...new Set(
    (Array.isArray(statusRule?.parameters?.required_status_checks) ? statusRule.parameters.required_status_checks : [])
      .map((entry)=>clean(entry?.context))
      .filter(Boolean)
  )].sort();
  const sourceChecksRequired=requiredStatusContexts.includes(EXPECTED_REQUIRED_STATUS);
  if(!deletionBlocked)errors.push('Ruleset must block deletion of main.');
  if(!forcePushBlocked)errors.push('Ruleset must block non-fast-forward / force pushes to main.');
  if(!pullRequestRule)errors.push('Ruleset must require a pull request before merging to main.');
  if(!statusRule)errors.push('Ruleset must require status checks before merging to main.');
  if(!sourceChecksRequired)errors.push(`Ruleset must require the canonical ${EXPECTED_REQUIRED_STATUS} status check.`);

  const bypassActors=Array.isArray(ruleset?.bypass_actors) ? ruleset.bypass_actors : [];
  const currentUserCanBypass=clean(ruleset?.current_user_can_bypass);
  if(bypassActors.length!==0)errors.push('Main protection ruleset must not contain bypass actors.');
  if(currentUserCanBypass!=='never')errors.push('Current GitHub actor must not be able to bypass the ruleset.');

  if(mainBranch?.name!=='main')errors.push('Branch evidence must be for main.');
  if(mainBranch?.protected!==true)errors.push('GitHub must report main protected=true.');
  if(!sourceSha)errors.push('Source workflow run must expose a full 40-character head SHA.');
  if(!currentMainSha)errors.push('Current main branch must expose a full 40-character SHA.');
  if(sourceSha&&currentMainSha&&sourceSha!==currentMainSha)errors.push('Current main SHA must exactly match the successful source workflow SHA.');
  if(expectedSourceSha&&sourceSha&&expectedSourceSha!==sourceSha)errors.push('Expected source SHA does not match the source workflow run.');

  if(!sourceRunId)errors.push('Source workflow run id must be a positive integer.');
  if(!sourceRunAttempt)errors.push('Source workflow run attempt must be a positive integer.');
  if(expectedRunId&&sourceRunId!==expectedRunId)errors.push('Source workflow run id does not match the authorized workflow context.');
  if(expectedRunAttempt&&sourceRunAttempt!==expectedRunAttempt)errors.push('Source workflow run attempt does not match the authorized workflow context.');
  if(workflowRun?.name!==EXPECTED_SOURCE_WORKFLOW)errors.push(`Source workflow name must exactly equal ${EXPECTED_SOURCE_WORKFLOW}.`);
  if(workflowRun?.path!==EXPECTED_SOURCE_WORKFLOW_PATH)errors.push(`Source workflow path must exactly equal ${EXPECTED_SOURCE_WORKFLOW_PATH}.`);
  if(workflowRun?.event!=='push'||workflowRun?.head_branch!=='main')errors.push('Repository policy evidence is valid only for a successful main push workflow.');
  if(workflowRun?.status!=='completed'||workflowRun?.conclusion!=='success')errors.push('Source workflow must be completed successfully before repository policy evidence can be verified.');
  if(workflowRun?.repository?.full_name!==EXPECTED_REPOSITORY)errors.push('Source workflow repository does not match YardWeasels.');

  const rulesetUpdatedAt=clean(ruleset?.updated_at);
  const rulesetUpdatedMs=Date.parse(rulesetUpdatedAt);
  if(!Number.isFinite(rulesetUpdatedMs))errors.push('Ruleset updated_at must be a valid timestamp.');
  const verifiedAt=clean(options.verifiedAt)||new Date().toISOString();
  const verifiedMs=Date.parse(verifiedAt);
  if(!Number.isFinite(verifiedMs))errors.push('Verification timestamp must be valid.');
  if(Number.isFinite(rulesetUpdatedMs)&&Number.isFinite(verifiedMs)&&rulesetUpdatedMs>verifiedMs+5*60*1000){
    errors.push('Ruleset evidence cannot be materially future-dated relative to verification.');
  }

  const evidence={
    evidence_format_version:1,
    evidence_kind:'ywi_repository_policy_verified',
    verification_result:errors.length===0?'passed':'locked',
    policy_contract_version:POLICY_CONTRACT_VERSION,
    repository:EXPECTED_REPOSITORY,
    branch_name:'main',
    source_sha:sourceSha,
    source_workflow_run_id:sourceRunId,
    source_workflow_run_attempt:sourceRunAttempt,
    source_workflow_name:EXPECTED_SOURCE_WORKFLOW,
    branch_protection_reported:mainBranch?.protected===true,
    branch_policy_verified:errors.length===0,
    ruleset_id:rulesetId,
    ruleset_name:ruleset?.name||null,
    ruleset_target:ruleset?.target||null,
    ruleset_enforcement:ruleset?.enforcement||null,
    default_branch_targeted:defaultBranchTargeted,
    pull_request_required:Boolean(pullRequestRule),
    required_status_contexts:requiredStatusContexts,
    source_checks_required:sourceChecksRequired,
    force_push_blocked:forcePushBlocked,
    deletion_blocked:deletionBlocked,
    bypass_actor_count:bypassActors.length,
    current_user_can_bypass:currentUserCanBypass||null,
    ruleset_updated_at:Number.isFinite(rulesetUpdatedMs)?new Date(rulesetUpdatedMs).toISOString():null,
    boundaries:{
      verification_only:true,
      release_source_evidence_mutated:false,
      production_promotion_performed:false,
      business_data_mutated:false,
      finance_provider_mutation_performed:false,
    },
    verified_at:verifiedAt,
  };
  return {ok:errors.length===0,errors,evidence};
}

export function verifyRepositoryPolicyEvidenceFiles(env={},options={}){
  const rulesetsPath=path.resolve(options.rulesetsPath||env.YWI_REPOSITORY_RULESETS_PATH||'repository-rulesets.json');
  const rulesetPath=path.resolve(options.rulesetPath||env.YWI_REPOSITORY_RULESET_PATH||'repository-ruleset.json');
  const mainBranchPath=path.resolve(options.mainBranchPath||env.YWI_REPOSITORY_MAIN_BRANCH_PATH||'repository-main-branch.json');
  const workflowRunPath=path.resolve(options.workflowRunPath||env.YWI_REPOSITORY_POLICY_WORKFLOW_RUN_PATH||'repository-policy-workflow-run.json');
  const outputPath=path.resolve(options.outputPath||env.YWI_REPOSITORY_POLICY_VERIFIED_PATH||'repository-policy-evidence-verified.json');
  const sources=[
    [rulesetsPath,'Repository rulesets',true],
    [rulesetPath,'Repository ruleset detail',false],
    [mainBranchPath,'Current main branch evidence',false],
    [workflowRunPath,'Source workflow run evidence',false],
  ].map(([filePath,label,allowArray])=>({filePath,label,result:parseJsonFile(filePath,label,allowArray)}));
  const readErrors=sources.filter((source)=>!source.result.ok).map((source)=>source.result.error);
  if(readErrors.length){
    try{if(fs.existsSync(outputPath))fs.rmSync(outputPath,{force:true});}catch{}
    return {ok:false,errors:readErrors,evidence:{verification_result:'locked'},output_path:outputPath};
  }
  const result=buildVerifiedRepositoryPolicyEvidence(
    sources[0].result.value,
    sources[1].result.value,
    sources[2].result.value,
    sources[3].result.value,
    {
      ...options,
      sourceSha:options.sourceSha||env.SOURCE_HEAD_SHA,
      sourceRunId:options.sourceRunId||env.SOURCE_RUN_ID,
      sourceRunAttempt:options.sourceRunAttempt||env.SOURCE_RUN_ATTEMPT,
    },
  );
  if(!result.ok){
    try{if(fs.existsSync(outputPath))fs.rmSync(outputPath,{force:true});}catch{}
    return {...result,output_path:outputPath};
  }
  fs.writeFileSync(outputPath,`${JSON.stringify(result.evidence,null,2)}\n`,'utf8');
  return {...result,output_path:outputPath};
}

function printResult(result){
  console.log(JSON.stringify({
    ok:result.ok,
    verification_result:result.evidence?.verification_result||'locked',
    source_sha:result.evidence?.source_sha||null,
    source_workflow_run_id:result.evidence?.source_workflow_run_id||null,
    ruleset_id:result.evidence?.ruleset_id||null,
    ruleset_name:result.evidence?.ruleset_name||null,
    branch_protection_reported:result.evidence?.branch_protection_reported===true,
    branch_policy_verified:result.evidence?.branch_policy_verified===true,
    output_path:result.output_path,
    errors:result.errors,
  },null,2));
  if(!result.ok){
    console.error('\nREPOSITORY POLICY EVIDENCE: LOCKED');
    for(const error of result.errors)console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('\nREPOSITORY POLICY EVIDENCE: VERIFIED');
  console.log('Detailed GitHub repository policy is verified independently from release-source evidence and does not authorize Production promotion.');
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)printResult(verifyRepositoryPolicyEvidenceFiles(process.env));
