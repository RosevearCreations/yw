#!/usr/bin/env node
import {buildAuthEvidenceRecordCandidate} from './auth-security-evidence-intake.mjs';
import {expectedArtifactName,runArtifactsUrl} from './auth-security-evidence-artifact-verify.mjs';
import {
  attachWorkflowCandidateContentBinding,
  expectedContentBindingArtifactName,
} from './auth-security-evidence-content-binding.mjs';
import {
  AUTH_ARTIFACT_OBSERVATION_MAX_LAG_MS,
  EXPECTED_CAPTURE_BRANCH,
  EXPECTED_CAPTURE_WORKFLOW_PATH,
  EXPECTED_GITHUB_REPOSITORY,
  EXPECTED_PROJECT_REF,
  RECORD_CONFIRM,
  SOURCE_CONFIRM,
  recordAuthEvidenceCandidate,
  verifyAuthArtifactObservationTime,
  workflowRunAttemptApiUrl,
} from './auth-security-evidence-record.mjs';

const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});
const RUN_ID='34420000000';
const ATTEMPT='1';
const SHA='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const NOW='2026-09-10T00:20:00.000Z';
const OBSERVED_AT='2026-09-10T00:10:00.000Z';
const ARTIFACT_CREATED_AT='2026-09-10T00:12:00.000Z';
const REFERENCE=`https://github.com/${EXPECTED_GITHUB_REPOSITORY}/actions/runs/${RUN_ID}/attempts/${ATTEMPT}`;
const RUN_URL=workflowRunAttemptApiUrl({repository:EXPECTED_GITHUB_REPOSITORY,run_id:RUN_ID,run_attempt:ATTEMPT,commit_sha:SHA});
const ARTIFACTS_URL=runArtifactsUrl(RUN_ID);
const ARTIFACT_NAME=expectedArtifactName(RUN_ID,ATTEMPT);
const REPOSITORY_ID=1148400822;
const ARTIFACT_ID=10140000001;
const ARTIFACT_DIGEST=`sha256:${'d'.repeat(64)}`;
const MARKER_ID=10140000002;
const MARKER_DIGEST=`sha256:${'e'.repeat(64)}`;
const BINDING_NONCE='44'.repeat(32);

function makeCandidate(observedAt=OBSERVED_AT){
  const result=buildAuthEvidenceRecordCandidate({
    evidence_capture_version:1,
    control_key:'leaked_password_protection',
    evidence_source:'supabase_management_api',
    project_ref:EXPECTED_PROJECT_REF,
    observed_state:'enabled',
    observed_at:observedAt,
    evidence_reference:REFERENCE,
    evidence_detail:{
      capture_version:2,
      management_api_endpoint:`https://api.supabase.com/v1/projects/${EXPECTED_PROJECT_REF}/config/auth`,
      captured_field:'password_hibp_enabled',
      transport:'official_https_management_api',
      workflow_provenance:{
        repository:EXPECTED_GITHUB_REPOSITORY,
        run_id:RUN_ID,
        run_attempt:ATTEMPT,
        commit_sha:SHA,
        event:'workflow_dispatch',
      },
    },
    source_capture:{
      project_ref:EXPECTED_PROJECT_REF,
      control:'leaked_password_protection',
      password_hibp_enabled:true,
    },
  },{now:NOW});
  if(!result.ok)throw new Error(`Fixture intake failed: ${result.errors.join('; ')}`);
  return attachWorkflowCandidateContentBinding(result.candidate,{nonce:BINDING_NONCE});
}

function env(){
  return {
    YWI_AUTH_EVIDENCE_RECORD_CONFIRM:RECORD_CONFIRM,
    YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM:SOURCE_CONFIRM,
    YWI_PRODUCTION_PROJECT_REF:EXPECTED_PROJECT_REF,
    SUPABASE_URL:`https://${EXPECTED_PROJECT_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key-never-print',
  };
}

function workflowRun(){
  return {
    id:Number(RUN_ID),run_attempt:Number(ATTEMPT),head_sha:SHA,head_branch:EXPECTED_CAPTURE_BRANCH,
    event:'workflow_dispatch',path:EXPECTED_CAPTURE_WORKFLOW_PATH,status:'completed',conclusion:'success',
    repository:{id:REPOSITORY_ID,full_name:EXPECTED_GITHUB_REPOSITORY},
    head_repository:{id:REPOSITORY_ID,full_name:EXPECTED_GITHUB_REPOSITORY},
  };
}

function workflowArtifactShape(){
  return {id:Number(RUN_ID),repository_id:REPOSITORY_ID,head_repository_id:REPOSITORY_ID,head_branch:EXPECTED_CAPTURE_BRANCH,head_sha:SHA};
}

function artifact(createdAt=ARTIFACT_CREATED_AT){
  return {
    id:ARTIFACT_ID,name:ARTIFACT_NAME,size_in_bytes:4096,expired:false,digest:ARTIFACT_DIGEST,created_at:createdAt,
    workflow_run:workflowArtifactShape(),
  };
}

function marker(candidate,createdAt=ARTIFACT_CREATED_AT){
  return {
    id:MARKER_ID,
    name:expectedContentBindingArtifactName(RUN_ID,ATTEMPT,candidate.control_key,candidate.workflow_content_binding.commitment_sha256),
    size_in_bytes:74,expired:false,digest:MARKER_DIGEST,created_at:createdAt,
    workflow_run:workflowArtifactShape(),
  };
}

function fetchHarness({artifactCreatedAt=ARTIFACT_CREATED_AT,candidate=makeCandidate()}={}){
  const calls=[];
  const fetchImpl=async (url,options={})=>{
    calls.push({url,options});
    if(url===RUN_URL)return {ok:true,status:200,json:async()=>workflowRun(),text:async()=>''};
    if(url===ARTIFACTS_URL)return {ok:true,status:200,json:async()=>({total_count:2,artifacts:[artifact(artifactCreatedAt),marker(candidate)]}),text:async()=>''};
    if(url.includes('/rpc/ywi_record_auth_security_evidence'))return {ok:true,status:200,json:async()=>88,text:async()=>''};
    if(url.includes('/v_it_auth_security_evidence_current?'))return {ok:true,status:200,json:async()=>[{
      evidence_id:88,control_key:'leaked_password_protection',current_status:'verified_secure',source_project_ref:EXPECTED_PROJECT_REF,
      source_capture_sha256:candidate.source_capture_sha256,recording_contract_version:1,
    }]};
    throw new Error(`Unexpected URL: ${url}`);
  };
  return {calls,fetchImpl};
}

add('max-lag-is-bounded',AUTH_ARTIFACT_OBSERVATION_MAX_LAG_MS===15*60*1000);
const direct=verifyAuthArtifactObservationTime(OBSERVED_AT,ARTIFACT_CREATED_AT);
add('direct-valid-temporal-binding',direct.verified && direct.observed_at===OBSERVED_AT && direct.artifact_created_at===ARTIFACT_CREATED_AT && direct.maximum_artifact_lag_ms===15*60*1000);

let oldRelativeRejected=false;
try{verifyAuthArtifactObservationTime('2026-09-09T23:40:00.000Z',ARTIFACT_CREATED_AT);}catch(error){oldRelativeRejected=String(error?.message || error).includes('too old relative');}
add('observation-too-old-for-artifact-rejected',oldRelativeRejected);
let relabelledFutureRejected=false;
try{verifyAuthArtifactObservationTime('2026-09-10T00:20:00.000Z',ARTIFACT_CREATED_AT);}catch(error){relabelledFutureRejected=String(error?.message || error).includes('later than the verified artifact creation window');}
add('freshened-observation-after-old-artifact-rejected',relabelledFutureRejected);
let invalidArtifactTimeRejected=false;
try{verifyAuthArtifactObservationTime(OBSERVED_AT,'not-a-time');}catch(error){invalidArtifactTimeRejected=String(error?.message || error).includes('artifact created_at is invalid');}
add('invalid-artifact-created-at-rejected',invalidArtifactTimeRejected);

const goodCandidate=makeCandidate();
let harness=fetchHarness({candidate:goodCandidate});
const recorded=await recordAuthEvidenceCandidate(goodCandidate,env(),{now:NOW,fetchImpl:harness.fetchImpl});
add('valid-record-path-temporally-verified',recorded.ok && recorded.write_performed && recorded.auth_capture_content_binding_verified===true && recorded.auth_capture_temporal_verified===true && recorded.auth_capture_temporal_observed_at===OBSERVED_AT && recorded.auth_capture_temporal_artifact_created_at===ARTIFACT_CREATED_AT);
add('valid-record-network-order',harness.calls.length===4 && harness.calls[0].url===RUN_URL && harness.calls[1].url===ARTIFACTS_URL && harness.calls[2].url.includes('/rpc/ywi_record_auth_security_evidence'));
const rpcBody=JSON.parse(harness.calls[2].options.body);
add('rpc-persists-temporal-verification',rpcBody.p_evidence_detail?.auth_capture_temporal_verification?.verified===true && rpcBody.p_evidence_detail?.auth_capture_temporal_verification?.observed_at===OBSERVED_AT && rpcBody.p_evidence_detail?.auth_capture_temporal_verification?.artifact_created_at===ARTIFACT_CREATED_AT && rpcBody.p_evidence_detail?.auth_capture_temporal_verification?.maximum_artifact_lag_ms===15*60*1000);
add('rpc-also-persists-content-binding-proof',rpcBody.p_evidence_detail?.auth_capture_content_binding_verification?.verified===true && rpcBody.p_evidence_detail?.auth_capture_content_binding_verification?.candidate_nonce_persisted===false && !JSON.stringify(rpcBody.p_evidence_detail).includes(BINDING_NONCE));

const refreshedCandidate=makeCandidate('2026-09-10T00:20:00.000Z');
let refreshedSupabaseCalled=false;
let refreshedRejected=false;
try{
  const badHarness=fetchHarness({candidate:refreshedCandidate});
  await recordAuthEvidenceCandidate(refreshedCandidate,env(),{now:'2026-09-10T00:21:00.000Z',fetchImpl:async (url,options={})=>{
    if(url.includes('.supabase.co'))refreshedSupabaseCalled=true;
    return badHarness.fetchImpl(url,options);
  }});
}catch(error){refreshedRejected=String(error?.message || error).includes('later than the verified artifact creation window');}
add('metadata-refresh-attack-blocks-before-supabase',refreshedRejected && !refreshedSupabaseCalled);

const earlyCandidate=makeCandidate('2026-09-09T23:50:00.000Z');
let earlySupabaseCalled=false;
let earlyRejected=false;
try{
  const badHarness=fetchHarness({candidate:earlyCandidate});
  await recordAuthEvidenceCandidate(earlyCandidate,env(),{now:NOW,fetchImpl:async (url,options={})=>{
    if(url.includes('.supabase.co'))earlySupabaseCalled=true;
    return badHarness.fetchImpl(url,options);
  }});
}catch(error){earlyRejected=String(error?.message || error).includes('too old relative');}
add('artifact-lag-over-15-minutes-blocks-before-supabase',earlyRejected && !earlySupabaseCalled);

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} Build 268 Auth temporal provenance checks passed under Build 269 content binding.`);
if(failed.length)process.exit(1);
