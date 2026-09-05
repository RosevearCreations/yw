#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  EXPECTED_REPOSITORY,
  EXPECTED_WORKFLOW,
  discoverLatestSchema,
} from './release-source-evidence-bundle.mjs';

export const EXPECTED_WORKFLOW_PATH='.github/workflows/staging-browser-integration.yml';
const SHA_RE=/^[0-9a-f]{40}$/;
const clean=(value)=>String(value ?? '').trim();
const positiveInteger=(value)=>{
  const parsed=Number.parseInt(clean(value),10);
  return Number.isInteger(parsed) && parsed>0 ? parsed : null;
};
const fullSha=(value)=>{
  const sha=clean(value).toLowerCase();
  return SHA_RE.test(sha) ? sha : null;
};

function parseJsonFile(filePath,label){
  try{
    const text=fs.readFileSync(filePath,'utf8');
    const parsed=JSON.parse(text);
    if(!parsed || typeof parsed!=='object' || Array.isArray(parsed))throw new Error('JSON root must be an object');
    return {ok:true,value:parsed};
  }catch(error){
    return {ok:false,error:`${label} could not be read as JSON: ${error.message}`};
  }
}

export function buildVerifiedReleaseSourceEvidence(candidate={},workflowRun={},mainBranch={},options={}){
  const errors=[];
  const sourceSha=fullSha(candidate.source_sha);
  const candidateReportedMainSha=fullSha(candidate.github_reported_main_sha);
  const candidateRunId=positiveInteger(candidate.workflow_run_id);
  const candidateRunAttempt=positiveInteger(candidate.workflow_run_attempt);
  const candidateSchema=Number.isInteger(candidate.schema_version) ? candidate.schema_version : Number.parseInt(candidate.schema_version,10);
  const latestSchema=Number.isInteger(options.latestSchema) ? options.latestSchema : discoverLatestSchema(options.root);
  const verifiedAt=clean(options.verifiedAt) || new Date().toISOString();

  if(candidate.evidence_format_version!==1)errors.push('Candidate evidence format version must be exactly 1.');
  if(candidate.evidence_kind!=='ywi_exact_main_release_source_candidate')errors.push('Input must be an exact-main release-source candidate.');
  if(candidate.repository!==EXPECTED_REPOSITORY)errors.push(`Candidate repository must exactly equal ${EXPECTED_REPOSITORY}.`);
  if(candidate.source_branch!=='main')errors.push('Candidate source branch must be main.');
  if(!sourceSha)errors.push('Candidate source SHA must be a full 40-character SHA.');
  if(!candidateReportedMainSha)errors.push('Candidate GitHub-reported main SHA must be a full 40-character SHA.');
  if(sourceSha && candidateReportedMainSha && sourceSha!==candidateReportedMainSha)errors.push('Candidate GitHub-reported main SHA must exactly match its source SHA.');
  if(candidate.exact_main_sha_verified!==true)errors.push('Candidate must record exact_main_sha_verified=true.');
  if(!candidateRunId)errors.push('Candidate workflow run ID must be a positive integer.');
  if(!candidateRunAttempt)errors.push('Candidate workflow run attempt must be a positive integer.');
  if(candidate.workflow_name!==EXPECTED_WORKFLOW)errors.push(`Candidate workflow name must exactly equal ${EXPECTED_WORKFLOW}.`);
  if(candidate.source_checks_result!=='success')errors.push('Candidate source-check result must be success.');
  if(candidate.workflow_conclusion!=='verify_after_run_completion')errors.push('Candidate workflow conclusion must still require post-run verification.');
  if(!Number.isInteger(candidateSchema) || candidateSchema<201)errors.push('Candidate schema version must be Schema 201 or newer.');
  if(!Number.isInteger(latestSchema) || latestSchema<201)errors.push('Current source schema discovery must resolve to Schema 201 or newer.');
  if(Number.isInteger(candidateSchema) && Number.isInteger(latestSchema) && candidateSchema!==latestSchema){
    errors.push('Candidate schema version must exactly match the verifier source schema.');
  }
  if(candidate.branch_protection_reported!==true)errors.push('Candidate must report main protected=true.');
  if(candidate.branch_policy_verified!==false)errors.push('Candidate detailed branch-policy verification must remain false.');

  const dbCandidate=candidate.database_record_candidate;
  if(!dbCandidate || typeof dbCandidate!=='object' || Array.isArray(dbCandidate)){
    errors.push('Candidate must contain a database-record candidate object.');
  }else{
    if(dbCandidate.source_branch!=='main')errors.push('Database-record candidate source branch must be main.');
    if(sourceSha && fullSha(dbCandidate.source_sha)!==sourceSha)errors.push('Database-record candidate source SHA must match the candidate source SHA.');
    if(positiveInteger(dbCandidate.workflow_run_id)!==candidateRunId)errors.push('Database-record candidate workflow run ID must match the candidate.');
    if(dbCandidate.workflow_name!==EXPECTED_WORKFLOW)errors.push('Database-record candidate workflow name must match the canonical workflow.');
    if(dbCandidate.workflow_status!=='unknown')errors.push('Candidate database workflow status must remain unknown until final verification.');
    if(Number.parseInt(dbCandidate.schema_version,10)!==candidateSchema)errors.push('Database-record candidate schema must match the candidate schema.');
    if(dbCandidate.branch_protection_reported!==true)errors.push('Database-record candidate must report branch protection true.');
    if(dbCandidate.branch_policy_verified!==false)errors.push('Database-record candidate detailed branch-policy verification must remain false.');
  }

  if(!candidate.boundaries || typeof candidate.boundaries!=='object'){
    errors.push('Candidate must retain explicit safety boundaries.');
  }else{
    if(candidate.boundaries.ci_source_validation_only!==true)errors.push('Candidate must remain CI/source validation only.');
    for(const key of ['database_evidence_recorded','production_promotion_performed','production_mutation_performed','provider_mutation_performed']){
      if(candidate.boundaries[key]!==false)errors.push(`Candidate boundary ${key} must remain false.`);
    }
  }

  const runId=positiveInteger(workflowRun.id);
  const runAttempt=positiveInteger(workflowRun.run_attempt);
  const runHeadSha=fullSha(workflowRun.head_sha);
  if(runId!==candidateRunId)errors.push('Completed workflow run ID must exactly match the candidate run ID.');
  if(runAttempt!==candidateRunAttempt)errors.push('Completed workflow run attempt must exactly match the candidate run attempt.');
  if(workflowRun.name!==EXPECTED_WORKFLOW)errors.push(`Completed workflow run name must exactly equal ${EXPECTED_WORKFLOW}.`);
  if(workflowRun.path!==EXPECTED_WORKFLOW_PATH)errors.push(`Completed workflow path must exactly equal ${EXPECTED_WORKFLOW_PATH}.`);
  if(workflowRun.event!=='push')errors.push('Completed workflow evidence must come from a push event.');
  if(workflowRun.head_branch!=='main')errors.push('Completed workflow evidence must target main.');
  if(!runHeadSha || (sourceSha && runHeadSha!==sourceSha))errors.push('Completed workflow head SHA must exactly match the candidate source SHA.');
  if(workflowRun.status!=='completed')errors.push('Workflow run must be completed before evidence can be verified.');
  if(workflowRun.conclusion!=='success')errors.push('Workflow run conclusion must be success before evidence can be verified.');
  if(workflowRun.repository?.full_name!==EXPECTED_REPOSITORY)errors.push(`Workflow run repository must exactly equal ${EXPECTED_REPOSITORY}.`);

  const currentMainSha=fullSha(mainBranch?.commit?.sha);
  if(mainBranch.name!=='main')errors.push('Current branch evidence must be for main.');
  if(!currentMainSha || (sourceSha && currentMainSha!==sourceSha))errors.push('Current main SHA must still exactly match the candidate source SHA.');
  if(mainBranch.protected!==true)errors.push('GitHub must still report current main protected=true at final verification time.');

  const evidence={
    evidence_format_version:1,
    evidence_kind:'ywi_exact_main_release_source_verified',
    verification_result:errors.length===0 ? 'passed' : 'locked',
    repository:candidate.repository || null,
    source_branch:'main',
    source_sha:sourceSha,
    github_reported_main_sha:currentMainSha,
    exact_main_sha_verified:Boolean(sourceSha && currentMainSha===sourceSha),
    workflow_run_id:candidateRunId,
    workflow_run_attempt:candidateRunAttempt,
    workflow_name:candidate.workflow_name || null,
    workflow_event:workflowRun.event || null,
    workflow_status:workflowRun.status || null,
    workflow_conclusion:workflowRun.conclusion || null,
    schema_version:Number.isInteger(candidateSchema) ? candidateSchema : null,
    branch_protection_reported:mainBranch.protected===true,
    branch_policy_verified:false,
    candidate_generated_at:candidate.generated_at || null,
    database_record_candidate:{
      source_branch:'main',
      source_sha:sourceSha,
      workflow_run_id:candidateRunId,
      workflow_name:candidate.workflow_name || null,
      workflow_status:errors.length===0 ? 'passed' : 'unknown',
      schema_version:Number.isInteger(candidateSchema) ? candidateSchema : null,
      branch_protection_reported:mainBranch.protected===true,
      branch_policy_verified:false,
    },
    boundaries:{
      verification_only:true,
      database_evidence_recorded:false,
      production_promotion_performed:false,
      production_mutation_performed:false,
      provider_mutation_performed:false,
    },
    required_followup:[
      'Record verified source evidence only through the authorized server/service release-evidence path when release review requires it.',
      'Detailed GitHub branch-policy verification remains false until authoritative ruleset/protection policy evidence exists.',
      'Production promotion remains a separate deliberate human action.',
    ],
    verified_at:verifiedAt,
  };

  return {ok:errors.length===0,errors,evidence};
}

export function verifyReleaseSourceEvidenceFiles(env={},options={}){
  const candidatePath=path.resolve(options.candidatePath || env.YWI_RELEASE_CANDIDATE_PATH || 'release-source-evidence.json');
  const workflowRunPath=path.resolve(options.workflowRunPath || env.YWI_RELEASE_WORKFLOW_RUN_PATH || 'release-workflow-run.json');
  const mainBranchPath=path.resolve(options.mainBranchPath || env.YWI_RELEASE_MAIN_BRANCH_PATH || 'release-main-branch.json');
  const outputPath=path.resolve(options.outputPath || env.YWI_RELEASE_VERIFIED_PATH || 'release-source-evidence-verified.json');
  const sources=[
    [candidatePath,'Release-source candidate'],
    [workflowRunPath,'Completed workflow run evidence'],
    [mainBranchPath,'Current main branch evidence'],
  ].map(([filePath,label])=>({filePath,label,result:parseJsonFile(filePath,label)}));
  const readErrors=sources.filter((source)=>!source.result.ok).map((source)=>source.result.error);
  if(readErrors.length){
    try{ if(fs.existsSync(outputPath))fs.rmSync(outputPath,{force:true}); }catch{}
    return {
      ok:false,
      errors:readErrors,
      evidence:{verification_result:'locked'},
      output_path:outputPath,
      candidate_path:candidatePath,
      workflow_run_path:workflowRunPath,
      main_branch_path:mainBranchPath,
    };
  }

  const result=buildVerifiedReleaseSourceEvidence(
    sources[0].result.value,
    sources[1].result.value,
    sources[2].result.value,
    options,
  );
  if(!result.ok){
    try{ if(fs.existsSync(outputPath))fs.rmSync(outputPath,{force:true}); }catch{}
    return {...result,output_path:outputPath,candidate_path:candidatePath,workflow_run_path:workflowRunPath,main_branch_path:mainBranchPath};
  }
  fs.writeFileSync(outputPath,`${JSON.stringify(result.evidence,null,2)}\n`,'utf8');
  return {...result,output_path:outputPath,candidate_path:candidatePath,workflow_run_path:workflowRunPath,main_branch_path:mainBranchPath};
}

function printResult(result){
  const summary={
    ok:result.ok,
    verification_result:result.evidence?.verification_result || 'locked',
    source_sha:result.evidence?.source_sha || null,
    workflow_run_id:result.evidence?.workflow_run_id || null,
    workflow_run_attempt:result.evidence?.workflow_run_attempt || null,
    workflow_conclusion:result.evidence?.workflow_conclusion || null,
    schema_version:result.evidence?.schema_version || null,
    branch_protection_reported:result.evidence?.branch_protection_reported === true,
    branch_policy_verified:false,
    output_path:result.output_path,
    errors:result.errors,
  };
  console.log(JSON.stringify(summary,null,2));
  if(!result.ok){
    console.error('\nEXACT-MAIN RELEASE SOURCE FINAL VERIFICATION: LOCKED');
    for(const error of result.errors)console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('\nEXACT-MAIN RELEASE SOURCE FINAL VERIFICATION: VERIFIED');
  console.log('The verified JSON is source/release evidence only. It does not write Supabase evidence, verify detailed GitHub policy, deploy, or promote Production.');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)printResult(verifyReleaseSourceEvidenceFiles(process.env));
