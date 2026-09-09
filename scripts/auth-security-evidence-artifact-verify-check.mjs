#!/usr/bin/env node
import fs from 'node:fs';
import {
  AUTH_EVIDENCE_ARTIFACT_VERIFY_VERSION,
  EXPECTED_CAPTURE_BRANCH,
  EXPECTED_CAPTURE_WORKFLOW_PATH,
  EXPECTED_REPOSITORY,
  expectedArtifactName,
  runArtifactsUrl,
  runAttemptUrl,
  validateArtifactVerificationInput,
  verifyAuthEvidenceArtifact,
} from './auth-security-evidence-artifact-verify.mjs';

const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});
const RUN_ID='34390000000';
const ATTEMPT='2';
const SHA='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ARTIFACT_DIGEST='sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const ARTIFACT_NAME=expectedArtifactName(RUN_ID,ATTEMPT);
const RUN_URL=runAttemptUrl(RUN_ID,ATTEMPT);
const ARTIFACTS_URL=runArtifactsUrl(RUN_ID);

const validRun={
  id:Number(RUN_ID),
  run_attempt:Number(ATTEMPT),
  head_sha:SHA,
  head_branch:EXPECTED_CAPTURE_BRANCH,
  event:'workflow_dispatch',
  path:EXPECTED_CAPTURE_WORKFLOW_PATH,
  status:'completed',
  conclusion:'success',
  repository:{id:1148400822,full_name:EXPECTED_REPOSITORY},
  head_repository:{id:1148400822,full_name:EXPECTED_REPOSITORY},
};
const validArtifact={
  id:10199999999,
  name:ARTIFACT_NAME,
  size_in_bytes:812,
  expired:false,
  digest:ARTIFACT_DIGEST,
  created_at:'2026-09-09T18:00:00Z',
  workflow_run:{
    id:Number(RUN_ID),
    repository_id:1148400822,
    head_repository_id:1148400822,
    head_branch:EXPECTED_CAPTURE_BRANCH,
    head_sha:SHA,
  },
};

function fakeFetchFor({run=validRun,artifacts=[validArtifact]}={}){
  const calls=[];
  const fetchImpl=async (url)=>{
    calls.push(url);
    if(url===RUN_URL)return {ok:true,status:200,json:async()=>structuredClone(run),text:async()=>''};
    if(url===ARTIFACTS_URL)return {ok:true,status:200,json:async()=>({total_count:artifacts.length,artifacts:structuredClone(artifacts)}),text:async()=>''};
    throw new Error(`Unexpected URL: ${url}`);
  };
  return {calls,fetchImpl};
}

add('version',AUTH_EVIDENCE_ARTIFACT_VERIFY_VERSION===1);
add('exact-artifact-name',ARTIFACT_NAME===`ywi-auth-security-evidence-${RUN_ID}-${ATTEMPT}`);
add('exact-run-url',RUN_URL===`https://api.github.com/repos/${EXPECTED_REPOSITORY}/actions/runs/${RUN_ID}/attempts/${ATTEMPT}`);
add('exact-artifacts-url',ARTIFACTS_URL===`https://api.github.com/repos/${EXPECTED_REPOSITORY}/actions/runs/${RUN_ID}/artifacts?per_page=100`);
add('invalid-input-locks',!validateArtifactVerificationInput({run_id:'x',run_attempt:'1',commit_sha:'bad'}).ok);

let harness=fakeFetchFor();
const verified=await verifyAuthEvidenceArtifact({run_id:RUN_ID,run_attempt:ATTEMPT,commit_sha:SHA},{fetchImpl:harness.fetchImpl});
add('valid-artifact-verifies',verified.ok && verified.verified && verified.artifact?.name===ARTIFACT_NAME && verified.artifact?.digest===ARTIFACT_DIGEST);
add('exact-two-read-order',harness.calls.length===2 && harness.calls[0]===RUN_URL && harness.calls[1]===ARTIFACTS_URL);
add('sanitized-boundaries',verified.boundaries?.artifact_download_performed===false && verified.boundaries?.artifact_decryption_performed===false && verified.boundaries?.supabase_call_performed===false && verified.boundaries?.database_write_performed===false && verified.boundaries?.auth_setting_mutation_performed===false);
add('no-download-url-persisted',!JSON.stringify(verified).includes('archive_download_url'));

async function rejects(name,config,needle){
  let rejected=false;
  let secondRead=false;
  const base=fakeFetchFor(config);
  try{
    await verifyAuthEvidenceArtifact({run_id:RUN_ID,run_attempt:ATTEMPT,commit_sha:SHA},{fetchImpl:async (url)=>{
      if(url===ARTIFACTS_URL)secondRead=true;
      return base.fetchImpl(url);
    }});
  }catch(error){
    rejected=String(error?.message || error).includes(needle);
  }
  add(name,rejected);
  return secondRead;
}

const nonMainSecondRead=await rejects('non-main-run-rejected',{run:{...validRun,head_branch:'feature'}},'canonical main');
add('non-main-fails-before-artifact-read',nonMainSecondRead===false);
await rejects('wrong-head-repository-rejected',{run:{...validRun,head_repository:{id:22,full_name:'example/fork'}}},'head repository mismatch');
await rejects('unsuccessful-run-rejected',{run:{...validRun,conclusion:'failure'}},'completed successfully');
await rejects('expired-artifact-rejected',{artifacts:[{...validArtifact,expired:true}]},'expired');
await rejects('missing-digest-rejected',{artifacts:[{...validArtifact,digest:null}]},'SHA-256 digest');
await rejects('wrong-artifact-name-rejected',{artifacts:[{...validArtifact,name:'other'}]},'found 0');
await rejects('duplicate-artifact-name-rejected',{artifacts:[validArtifact,{...validArtifact,id:10200000000}]},'found 2');
await rejects('artifact-sha-mismatch-rejected',{artifacts:[{...validArtifact,workflow_run:{...validArtifact.workflow_run,head_sha:'cccccccccccccccccccccccccccccccccccccccc'}}]},'Artifact workflow SHA mismatch');
await rejects('artifact-repository-mismatch-rejected',{artifacts:[{...validArtifact,workflow_run:{...validArtifact.workflow_run,repository_id:999}}]},'Artifact repository id mismatch');

const source=fs.readFileSync('scripts/auth-security-evidence-artifact-verify.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/auth-security-evidence-artifact-verify.yml','utf8');
add('verifier-has-no-supabase-transport',!source.includes('.supabase.co') && !source.includes('/rest/v1/') && !source.includes('SUPABASE_SERVICE_ROLE_KEY'));
add('workflow-pr-only',workflow.includes('pull_request:') && !workflow.includes('workflow_dispatch:'));
add('workflow-runs-test',workflow.includes('node scripts/auth-security-evidence-artifact-verify-check.mjs'));
add('workflow-no-secrets',!workflow.includes('secrets.') && !workflow.includes('SUPABASE_ACCESS_TOKEN'));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} Build 266 Auth artifact verification checks passed.`);
if(failed.length)process.exit(1);
