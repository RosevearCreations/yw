#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const AUTH_EVIDENCE_ARTIFACT_VERIFY_VERSION=1;
export const EXPECTED_REPOSITORY='RosevearCreations/yw';
export const EXPECTED_CAPTURE_WORKFLOW_PATH='.github/workflows/auth-security-evidence-capture.yml';
export const EXPECTED_CAPTURE_BRANCH='main';

const clean=(value)=>String(value ?? '').trim();
const isSha=(value)=>/^[0-9a-f]{40}$/i.test(clean(value));
const isDigest=(value)=>/^sha256:[0-9a-f]{64}$/i.test(clean(value));

export function expectedArtifactName(runId,runAttempt){
  return `ywi-auth-security-evidence-${clean(runId)}-${clean(runAttempt)}`;
}

export function runAttemptUrl(runId,runAttempt){
  return `https://api.github.com/repos/${EXPECTED_REPOSITORY}/actions/runs/${clean(runId)}/attempts/${clean(runAttempt)}`;
}

export function runArtifactsUrl(runId){
  return `https://api.github.com/repos/${EXPECTED_REPOSITORY}/actions/runs/${clean(runId)}/artifacts?per_page=100`;
}

export function validateArtifactVerificationInput(input={}){
  const errors=[];
  const runId=clean(input.run_id);
  const runAttempt=clean(input.run_attempt);
  const commitSha=clean(input.commit_sha).toLowerCase();
  if(!/^\d+$/.test(runId))errors.push('run_id must be numeric.');
  if(!/^\d+$/.test(runAttempt))errors.push('run_attempt must be numeric.');
  if(!isSha(commitSha))errors.push('commit_sha must be a 40-character Git SHA.');
  return {ok:errors.length===0,errors,run_id:runId,run_attempt:runAttempt,commit_sha:commitSha};
}

async function getJson(fetchImpl,url,label){
  const response=await fetchImpl(url,{
    method:'GET',
    headers:{accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'},
    redirect:'error',
  });
  if(!response?.ok){
    const text=await response?.text?.().catch(()=> '') || '';
    throw new Error(`${label} failed (${response?.status ?? 'unknown'})${text ? `: ${text.slice(0,240)}`:''}`);
  }
  return response.json();
}

export async function verifyAuthEvidenceArtifact(input,options={}){
  const parsed=validateArtifactVerificationInput(input);
  if(!parsed.ok)return {...parsed,verified:false,network_reads:0};
  const fetchImpl=options.fetchImpl || fetch;
  const runUrl=runAttemptUrl(parsed.run_id,parsed.run_attempt);
  const artifactsUrl=runArtifactsUrl(parsed.run_id);

  const run=await getJson(fetchImpl,runUrl,'GitHub workflow provenance read');
  if(String(run?.id)!==parsed.run_id)throw new Error('Workflow run id mismatch.');
  if(String(run?.run_attempt)!==parsed.run_attempt)throw new Error('Workflow run attempt mismatch.');
  if(clean(run?.head_sha).toLowerCase()!==parsed.commit_sha)throw new Error('Workflow head SHA mismatch.');
  if(clean(run?.head_branch)!==EXPECTED_CAPTURE_BRANCH)throw new Error('Workflow must run from canonical main.');
  if(clean(run?.event)!=='workflow_dispatch')throw new Error('Workflow must be workflow_dispatch.');
  if(clean(run?.path)!==EXPECTED_CAPTURE_WORKFLOW_PATH)throw new Error('Workflow path mismatch.');
  if(clean(run?.repository?.full_name)!==EXPECTED_REPOSITORY)throw new Error('Workflow repository mismatch.');
  if(clean(run?.head_repository?.full_name)!==EXPECTED_REPOSITORY)throw new Error('Workflow head repository mismatch.');
  if(clean(run?.status)!=='completed' || clean(run?.conclusion)!=='success')throw new Error('Workflow must be completed successfully.');

  const artifactList=await getJson(fetchImpl,artifactsUrl,'GitHub artifact metadata read');
  const expectedName=expectedArtifactName(parsed.run_id,parsed.run_attempt);
  const matches=Array.isArray(artifactList?.artifacts)
    ? artifactList.artifacts.filter((item)=>clean(item?.name)===expectedName)
    : [];
  if(matches.length!==1)throw new Error(`Expected exactly one ${expectedName} artifact; found ${matches.length}.`);
  const artifact=matches[0];
  if(artifact?.expired===true)throw new Error('Auth evidence artifact is expired.');
  const digest=clean(artifact?.digest).toLowerCase();
  if(!isDigest(digest))throw new Error('Auth evidence artifact must expose a GitHub SHA-256 digest.');
  if(String(artifact?.workflow_run?.id ?? parsed.run_id)!==parsed.run_id)throw new Error('Artifact workflow run id mismatch.');
  if(clean(artifact?.workflow_run?.head_branch || EXPECTED_CAPTURE_BRANCH)!==EXPECTED_CAPTURE_BRANCH)throw new Error('Artifact workflow branch mismatch.');
  if(clean(artifact?.workflow_run?.head_sha || parsed.commit_sha).toLowerCase()!==parsed.commit_sha)throw new Error('Artifact workflow SHA mismatch.');
  if(run?.repository?.id && artifact?.workflow_run?.repository_id && Number(artifact.workflow_run.repository_id)!==Number(run.repository.id))throw new Error('Artifact repository id mismatch.');
  if(run?.head_repository?.id && artifact?.workflow_run?.head_repository_id && Number(artifact.workflow_run.head_repository_id)!==Number(run.head_repository.id))throw new Error('Artifact head repository id mismatch.');

  return {
    ok:true,
    verified:true,
    verification_version:AUTH_EVIDENCE_ARTIFACT_VERIFY_VERSION,
    verification_source:'github_actions_api',
    network_reads:2,
    repository:EXPECTED_REPOSITORY,
    workflow_path:EXPECTED_CAPTURE_WORKFLOW_PATH,
    head_branch:EXPECTED_CAPTURE_BRANCH,
    run_id:parsed.run_id,
    run_attempt:parsed.run_attempt,
    commit_sha:parsed.commit_sha,
    artifact:{
      id:Number(artifact?.id) || null,
      name:expectedName,
      digest,
      size_in_bytes:Number(artifact?.size_in_bytes) || null,
      expired:false,
      created_at:clean(artifact?.created_at) || null,
    },
    boundaries:{
      artifact_download_performed:false,
      artifact_decryption_performed:false,
      supabase_call_performed:false,
      database_write_performed:false,
      auth_setting_mutation_performed:false,
    },
  };
}

function readCliInput(){
  const file=process.argv[2] || process.env.YWI_AUTH_EVIDENCE_ARTIFACT_VERIFY_INPUT;
  if(file)return JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
  return {
    run_id:process.env.YWI_AUTH_EVIDENCE_WORKFLOW_RUN_ID,
    run_attempt:process.env.YWI_AUTH_EVIDENCE_WORKFLOW_RUN_ATTEMPT,
    commit_sha:process.env.YWI_AUTH_EVIDENCE_WORKFLOW_SHA,
  };
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){
  try{
    const result=await verifyAuthEvidenceArtifact(readCliInput());
    console.log(JSON.stringify(result,null,2));
    if(!result.ok){
      console.error('\nAUTH EVIDENCE ARTIFACT VERIFICATION: LOCKED');
      for(const error of result.errors || [])console.error(`- ${error}`);
      process.exitCode=1;
    }else{
      console.log('\nAUTH EVIDENCE ARTIFACT VERIFICATION: VERIFIED');
      console.log('Verified GitHub run/artifact metadata only; no artifact download, decryption, Supabase call, database write, Auth mutation, staging execution, Finance posting, or Production promotion occurred.');
    }
  }catch(error){
    console.error(`AUTH EVIDENCE ARTIFACT VERIFICATION: LOCKED\n- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode=1;
  }
}
