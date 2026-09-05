#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_REPOSITORY='RosevearCreations/yw';
export const EXPECTED_WORKFLOW='YWI source and staging checks';
const SHA_RE=/^[0-9a-f]{40}$/;
const clean=(value)=>String(value ?? '').trim();
const positiveInteger=(value)=>{
  const parsed=Number.parseInt(clean(value),10);
  return Number.isInteger(parsed) && parsed>0 ? parsed : null;
};

export function discoverLatestSchema(root=process.cwd()){
  const sqlDir=path.join(root,'sql');
  let names=[];
  try{ names=fs.readdirSync(sqlDir,{withFileTypes:true}).filter((entry)=>entry.isFile()).map((entry)=>entry.name); }
  catch{ return 0; }
  return names.reduce((latest,name)=>{
    const match=name.match(/^(\d{3})(?:[a-z])?_.+\.sql$/i);
    if(!match)return latest;
    return Math.max(latest,Number.parseInt(match[1],10));
  },0);
}

export function buildReleaseSourceEvidence(env={},options={}){
  const eventName=clean(env.YWI_GITHUB_EVENT_NAME);
  const ref=clean(env.YWI_GITHUB_REF);
  const repository=clean(env.YWI_GITHUB_REPOSITORY);
  const expectedMainSha=clean(env.YWI_EXPECTED_MAIN_SHA).toLowerCase();
  const reportedMainSha=clean(env.YWI_GITHUB_MAIN_SHA).toLowerCase();
  const protectedRaw=clean(env.YWI_GITHUB_MAIN_PROTECTED);
  const runId=positiveInteger(env.YWI_GITHUB_RUN_ID);
  const runAttempt=positiveInteger(env.YWI_GITHUB_RUN_ATTEMPT);
  const workflowName=clean(env.YWI_GITHUB_WORKFLOW_NAME);
  const sourceChecksResult=clean(env.YWI_SOURCE_CHECKS_RESULT).toLowerCase();
  const latestSchema=Number.isInteger(options.latestSchema) ? options.latestSchema : discoverLatestSchema(options.root);
  const generatedAt=clean(options.generatedAt || env.YWI_EVIDENCE_GENERATED_AT) || new Date().toISOString();
  const errors=[];

  if(eventName!=='push')errors.push('Release-source evidence is valid only for a push event.');
  if(ref!=='refs/heads/main')errors.push('Release-source evidence is valid only for refs/heads/main.');
  if(repository!==EXPECTED_REPOSITORY)errors.push(`Release-source evidence is valid only for ${EXPECTED_REPOSITORY}.`);
  if(!SHA_RE.test(expectedMainSha))errors.push('A full 40-character workflow main SHA is required.');
  if(!SHA_RE.test(reportedMainSha))errors.push('A full 40-character GitHub-reported main SHA is required.');
  if(SHA_RE.test(expectedMainSha) && SHA_RE.test(reportedMainSha) && expectedMainSha!==reportedMainSha){
    errors.push('GitHub main branch SHA must exactly match the workflow release SHA.');
  }
  if(protectedRaw!=='true')errors.push('GitHub must report main protected=true before release-source evidence is emitted.');
  if(sourceChecksResult!=='success')errors.push('The canonical source-checks job must complete successfully before release-source evidence is emitted.');
  if(!runId)errors.push('A positive GitHub workflow run ID is required.');
  if(!runAttempt)errors.push('A positive GitHub workflow run attempt is required.');
  if(workflowName!==EXPECTED_WORKFLOW)errors.push(`Workflow name must exactly equal ${EXPECTED_WORKFLOW}.`);
  if(!Number.isInteger(latestSchema) || latestSchema<201)errors.push('Repository schema discovery must resolve to Schema 201 or newer.');

  const exactMainShaVerified=Boolean(SHA_RE.test(expectedMainSha) && expectedMainSha===reportedMainSha);
  const evidence={
    evidence_format_version:1,
    evidence_kind:'ywi_exact_main_release_source_candidate',
    repository:repository || null,
    source_branch:'main',
    source_sha:expectedMainSha || null,
    github_reported_main_sha:reportedMainSha || null,
    exact_main_sha_verified:exactMainShaVerified,
    workflow_run_id:runId,
    workflow_run_attempt:runAttempt,
    workflow_name:workflowName || null,
    source_checks_result:sourceChecksResult || null,
    workflow_conclusion:'verify_after_run_completion',
    schema_version:Number.isInteger(latestSchema) ? latestSchema : null,
    branch_protection_reported:protectedRaw==='true',
    branch_policy_verified:false,
    database_record_candidate:{
      source_branch:'main',
      source_sha:expectedMainSha || null,
      workflow_run_id:runId,
      workflow_name:workflowName || null,
      workflow_status:'unknown',
      schema_version:Number.isInteger(latestSchema) ? latestSchema : null,
      branch_protection_reported:protectedRaw==='true',
      branch_policy_verified:false,
    },
    boundaries:{
      ci_source_validation_only:true,
      database_evidence_recorded:false,
      production_promotion_performed:false,
      production_mutation_performed:false,
      provider_mutation_performed:false,
    },
    required_followup:[
      'Verify the completed GitHub workflow run conclusion is success before recording workflow_status=passed.',
      'Record source evidence only through the authorized server/service release-evidence path when release review requires it.',
      'Production promotion remains a separate deliberate human action.',
    ],
    generated_at:generatedAt,
  };

  return {ok:errors.length===0,errors,evidence};
}

export function writeReleaseSourceEvidence(env={},options={}){
  const outputPath=path.resolve(options.outputPath || env.YWI_RELEASE_EVIDENCE_PATH || 'release-source-evidence.json');
  const result=buildReleaseSourceEvidence(env,options);
  if(!result.ok){
    try{ if(fs.existsSync(outputPath))fs.rmSync(outputPath,{force:true}); }catch{}
    return {...result,output_path:outputPath};
  }
  fs.writeFileSync(outputPath,`${JSON.stringify(result.evidence,null,2)}\n`,'utf8');
  return {...result,output_path:outputPath};
}

function printResult(result){
  const summary={
    ok:result.ok,
    source_sha:result.evidence.source_sha,
    workflow_run_id:result.evidence.workflow_run_id,
    workflow_run_attempt:result.evidence.workflow_run_attempt,
    schema_version:result.evidence.schema_version,
    exact_main_sha_verified:result.evidence.exact_main_sha_verified,
    branch_protection_reported:result.evidence.branch_protection_reported,
    branch_policy_verified:result.evidence.branch_policy_verified,
    output_path:result.output_path,
    errors:result.errors,
  };
  console.log(JSON.stringify(summary,null,2));
  if(!result.ok){
    console.error('\nEXACT-MAIN RELEASE SOURCE EVIDENCE: LOCKED');
    for(const error of result.errors)console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('\nEXACT-MAIN RELEASE SOURCE EVIDENCE: CANDIDATE WRITTEN');
  console.log('The artifact is CI/source evidence only. Verify the completed workflow conclusion before recording it as passed; Production promotion remains separate.');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)printResult(writeReleaseSourceEvidence(process.env));
