#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  AUTH_CONFIG_URL,
  AUTH_MANAGEMENT_API_CAPTURE_VERSION,
  buildWorkflowEvidenceReference,
  normalizeWorkflowProvenance,
} from './auth-security-management-api-capture.mjs';
import {calculateSourceCaptureSha256} from './auth-security-evidence-intake.mjs';
import {verifyAuthEvidenceArtifact} from './auth-security-evidence-artifact-verify.mjs';
import {verifyWorkflowCandidateContentBinding} from './auth-security-evidence-content-binding.mjs';

export const EXPECTED_PROJECT_REF='jmqvkgiqlimdhcofwkxr';
export const RECORD_CONFIRM='I_CONFIRM_AUTH_EVIDENCE_RECORD';
export const SOURCE_CONFIRM='I_CONFIRM_OFFICIAL_SUPABASE_SOURCE';
export const EXPECTED_GITHUB_REPOSITORY='RosevearCreations/yw';
export const EXPECTED_CAPTURE_WORKFLOW_PATH='.github/workflows/auth-security-evidence-capture.yml';
export const EXPECTED_CAPTURE_BRANCH='main';
export const AUTH_ARTIFACT_OBSERVATION_MAX_LAG_MS=15*60*1000;
const MAX_AGE_MS=30*24*60*60*1000;
const FUTURE_SKEW_MS=5*60*1000;
const REPLAY_SELECT=[
  'evidence_id','control_key','evidence_source','observed_state','verification_status','is_authoritative',
  'observed_at','evidence_reference','evidence_detail','source_project_ref','source_capture_sha256','recording_contract_version',
].join(',');

const clean=(value)=>String(value ?? '').trim();
const isObject=(value)=>Boolean(value && typeof value==='object' && !Array.isArray(value));

function deriveVerification(controlKey,state){
  if(controlKey==='leaked_password_protection'){
    if(state==='enabled')return 'verified_secure';
    if(state==='disabled')return 'verified_followup';
    if(state==='unknown')return 'unverified';
    return null;
  }
  if(controlKey==='mfa_options'){
    if(state==='configured')return 'verified_secure';
    if(state==='not_configured')return 'verified_followup';
    if(state==='unknown')return 'unverified';
    return null;
  }
  return null;
}

function expectedCurrentStatus(verificationStatus){
  if(verificationStatus==='verified_secure')return 'verified_secure';
  if(verificationStatus==='verified_followup')return 'verified_followup';
  return 'pending_external_verification';
}

function projectRefFromUrl(value){
  let url;
  try{url=new URL(value);}catch{return null;}
  if(url.protocol!=='https:')return null;
  const match=url.hostname.match(/^([a-z0-9-]{8,80})\.supabase\.co$/i);
  return match ? match[1].toLowerCase() : null;
}

function sameInstant(left,right){
  const leftMs=Date.parse(clean(left));
  const rightMs=Date.parse(clean(right));
  return Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs===rightMs;
}

function validateWorkflowBoundManagementApiEvidence(evidenceSource,evidenceDetail,reference,errors){
  let workflowProvenance=null;
  if(evidenceSource!=='supabase_management_api'){
    if(evidenceDetail?.workflow_provenance!=null)errors.push('Workflow provenance is only valid for Supabase Management API evidence.');
    return workflowProvenance;
  }

  if(Number(evidenceDetail?.capture_version)!==AUTH_MANAGEMENT_API_CAPTURE_VERSION){
    errors.push(`Management API evidence capture_version must equal ${AUTH_MANAGEMENT_API_CAPTURE_VERSION}.`);
  }
  if(clean(evidenceDetail?.management_api_endpoint)!==AUTH_CONFIG_URL(EXPECTED_PROJECT_REF)){
    errors.push('Management API evidence endpoint must equal the exact official YardWeasels Auth config endpoint.');
  }
  if(clean(evidenceDetail?.transport)!=='official_https_management_api'){
    errors.push('Management API evidence transport must be official_https_management_api.');
  }

  if(evidenceDetail?.workflow_provenance!=null){
    try{
      workflowProvenance=normalizeWorkflowProvenance(evidenceDetail.workflow_provenance);
      const expectedReference=buildWorkflowEvidenceReference(workflowProvenance);
      if(reference!==expectedReference){
        errors.push('Workflow-bound evidence_reference must equal the exact GitHub Actions run/attempt URL encoded in workflow provenance.');
      }
    }catch(error){
      errors.push(`Workflow provenance is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }else if(/^https:\/\/github\.com\/RosevearCreations\/yw\/actions\/runs\//i.test(reference)){
    errors.push('GitHub Actions evidence_reference requires matching workflow_provenance in evidence_detail.');
  }

  return workflowProvenance;
}

export function buildAuthEvidenceRecordPlan(candidate,env=process.env,options={}){
  const nowMs=Date.parse(options.now || new Date().toISOString());
  const errors=[];
  if(!Number.isFinite(nowMs))errors.push('Current time is invalid.');
  if(!isObject(candidate))candidate={};

  const db=isObject(candidate.database_record_candidate) ? candidate.database_record_candidate : {};
  const projectRef=clean(candidate.project_ref).toLowerCase();
  const controlKey=clean(candidate.control_key);
  const evidenceSource=clean(candidate.evidence_source);
  const state=clean(candidate.observed_state);
  const observedAt=clean(candidate.observed_at);
  const reference=clean(candidate.evidence_reference);
  const captureSha=clean(candidate.source_capture_sha256).toLowerCase();
  const sourceCapture=candidate.source_capture;
  const derived=deriveVerification(controlKey,state);

  if(candidate.evidence_kind!=='ywi_auth_security_evidence_record_candidate')errors.push('Candidate evidence_kind is invalid.');
  if(candidate.intake_contract_version!==1)errors.push('Candidate intake contract version is unsupported.');
  if(projectRef!==EXPECTED_PROJECT_REF)errors.push(`Candidate project_ref must equal ${EXPECTED_PROJECT_REF}.`);
  if(!['supabase_dashboard','supabase_management_api'].includes(evidenceSource))errors.push('Candidate evidence source is not an official Supabase control-plane source.');
  if(!derived)errors.push('Candidate control/state combination is invalid.');
  if(!reference)errors.push('Candidate evidence_reference is required.');
  if(!/^[0-9a-f]{64}$/.test(captureSha))errors.push('Candidate source_capture_sha256 is invalid.');

  let recomputedCaptureSha=null;
  const sourceCaptureShapeOk=typeof sourceCapture==='string' || Array.isArray(sourceCapture) || isObject(sourceCapture);
  if(!sourceCaptureShapeOk){
    errors.push('Candidate source_capture is required so the recorder can recompute its SHA-256 digest.');
  }else{
    try{
      recomputedCaptureSha=calculateSourceCaptureSha256(sourceCapture);
    }catch(error){
      errors.push(`Candidate source_capture could not be canonicalized: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if(recomputedCaptureSha && /^[0-9a-f]{64}$/.test(captureSha) && recomputedCaptureSha!==captureSha){
    errors.push('Candidate source_capture_sha256 does not match the retained sanitized source_capture.');
  }
  if(candidate?.boundaries?.source_capture_persisted_for_digest_revalidation!==true){
    errors.push('Candidate must explicitly preserve sanitized source_capture for recorder digest revalidation.');
  }

  if(candidate.derived_verification_status!==derived)errors.push('Candidate derived verification status does not match the control/state.');
  if(db.control_key!==controlKey || db.evidence_source!==evidenceSource || db.observed_state!==state)errors.push('Database candidate identity fields do not match the intake candidate.');
  if(db.verification_status!==derived || db.is_authoritative!==true)errors.push('Database candidate authority/status fields were altered after intake.');
  if(clean(db.observed_at)!==observedAt || clean(db.evidence_reference)!==reference)errors.push('Database candidate timestamp/reference fields do not match the intake candidate.');
  if(!isObject(db.evidence_detail))errors.push('Database candidate evidence_detail must be an object.');
  if(isObject(db.evidence_detail)){
    if(clean(db.evidence_detail.project_ref).toLowerCase()!==projectRef)errors.push('Database candidate evidence_detail project_ref does not match.');
    if(clean(db.evidence_detail.source_capture_sha256).toLowerCase()!==captureSha)errors.push('Database candidate evidence_detail source capture digest does not match.');
  }
  if(candidate?.boundaries?.database_write_performed!==false)errors.push('Candidate must explicitly show that intake performed no database write.');
  if(candidate?.boundaries?.auth_setting_mutation_performed!==false)errors.push('Candidate must explicitly show that intake performed no Auth setting mutation.');

  const workflowProvenance=isObject(db.evidence_detail)
    ? validateWorkflowBoundManagementApiEvidence(evidenceSource,db.evidence_detail,reference,errors)
    : null;

  let workflowContentBinding={verified:false};
  if(workflowProvenance){
    try{
      workflowContentBinding=verifyWorkflowCandidateContentBinding(candidate);
    }catch(error){
      errors.push(`Workflow content binding is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const observedMs=Date.parse(observedAt);
  if(!Number.isFinite(observedMs))errors.push('Candidate observed_at is invalid.');
  if(Number.isFinite(observedMs) && Number.isFinite(nowMs)){
    if(observedMs>nowMs+FUTURE_SKEW_MS)errors.push('Candidate observed_at is materially future-dated.');
    if(nowMs-observedMs>MAX_AGE_MS)errors.push('Candidate observed_at is outside the 30-day evidence window.');
  }

  if(clean(env.YWI_AUTH_EVIDENCE_RECORD_CONFIRM)!==RECORD_CONFIRM)errors.push('Explicit Auth evidence recording confirmation is required.');
  if(clean(env.YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM)!==SOURCE_CONFIRM)errors.push('Explicit confirmation of the genuine official Supabase source is required.');

  const supabaseUrl=clean(env.SUPABASE_URL).replace(/\/$/,'');
  const urlProjectRef=projectRefFromUrl(supabaseUrl);
  if(urlProjectRef!==EXPECTED_PROJECT_REF)errors.push('SUPABASE_URL must resolve to the exact registered YardWeasels Production project.');
  const configuredProductionRef=clean(env.YWI_PRODUCTION_PROJECT_REF || EXPECTED_PROJECT_REF).toLowerCase();
  if(configuredProductionRef!==EXPECTED_PROJECT_REF)errors.push('Configured Production project ref does not match the registered YardWeasels Production authority.');
  if(urlProjectRef && urlProjectRef!==projectRef)errors.push('SUPABASE_URL project ref does not match the evidence candidate project ref.');

  const serviceKey=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if(!serviceKey)errors.push('SUPABASE_SERVICE_ROLE_KEY is required for the service-private recording RPC.');

  const digestRevalidated=Boolean(recomputedCaptureSha && recomputedCaptureSha===captureSha);
  const evidenceDetail=isObject(db.evidence_detail) ? {
    ...db.evidence_detail,
    source_capture_digest_revalidation:{
      verified:digestRevalidated,
      algorithm:'sha256',
      canonicalization:'stable-json-v1',
    },
    recording_authorization:'explicit_operator_confirmation',
    source_authenticity_confirmation:'explicit_operator_confirmation',
  } : {};

  const rpcBody={
    p_control_key:controlKey || null,
    p_evidence_source:evidenceSource || null,
    p_observed_state:state || null,
    p_observed_at:observedAt || null,
    p_source_project_ref:projectRef || null,
    p_evidence_reference:reference || null,
    p_source_capture_sha256:captureSha || null,
    p_evidence_detail:evidenceDetail,
    p_recorded_by_profile_id:clean(env.YWI_AUTH_EVIDENCE_RECORDED_BY_PROFILE_ID) || null,
  };

  return {
    ok:errors.length===0,
    errors,
    supabase_url:supabaseUrl,
    service_key:serviceKey,
    rpc_body:rpcBody,
    workflow_provenance:workflowProvenance,
    workflow_content_binding:workflowContentBinding,
    source_capture_digest_revalidated:digestRevalidated,
    expected_current_status:expectedCurrentStatus(derived),
  };
}

export function workflowRunAttemptApiUrl(provenance){
  const normalized=normalizeWorkflowProvenance(provenance);
  if(!normalized)throw new Error('Workflow provenance is required.');
  return `https://api.github.com/repos/${normalized.repository}/actions/runs/${normalized.run_id}/attempts/${normalized.run_attempt}`;
}

export async function verifyWorkflowProvenanceBeforeRecord(provenance,reference,options={}){
  const normalized=normalizeWorkflowProvenance(provenance);
  if(!normalized)return {verified:false,read_performed:false,provenance:null};
  const expectedReference=buildWorkflowEvidenceReference(normalized);
  if(clean(reference)!==expectedReference)throw new Error('Workflow evidence reference no longer matches the normalized provenance.');

  const fetchImpl=options.fetchImpl || fetch;
  const url=workflowRunAttemptApiUrl(normalized);
  const response=await fetchImpl(url,{
    method:'GET',
    headers:{
      accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28',
    },
    redirect:'error',
  });
  if(!response?.ok){
    const text=await response?.text?.().catch(()=> '') || '';
    throw new Error(`GitHub workflow provenance verification failed (${response?.status ?? 'unknown'})${text ? `: ${text.slice(0,300)}`:''}`);
  }
  const run=await response.json();
  if(String(run?.id)!==normalized.run_id)throw new Error('GitHub workflow run id does not match evidence provenance.');
  if(String(run?.run_attempt)!==normalized.run_attempt)throw new Error('GitHub workflow run attempt does not match evidence provenance.');
  if(clean(run?.head_sha).toLowerCase()!==normalized.commit_sha)throw new Error('GitHub workflow head SHA does not match evidence provenance.');
  if(clean(run?.head_branch)!==EXPECTED_CAPTURE_BRANCH)throw new Error(`GitHub workflow evidence must run from canonical ${EXPECTED_CAPTURE_BRANCH}.`);
  if(clean(run?.event)!=='workflow_dispatch')throw new Error('GitHub workflow evidence must come from workflow_dispatch.');
  if(clean(run?.path)!==EXPECTED_CAPTURE_WORKFLOW_PATH)throw new Error('GitHub workflow path does not match the protected Auth evidence capture workflow.');
  if(clean(run?.repository?.full_name)!==EXPECTED_GITHUB_REPOSITORY)throw new Error('GitHub workflow repository does not match YardWeasels.');
  if(clean(run?.head_repository?.full_name)!==EXPECTED_GITHUB_REPOSITORY)throw new Error('GitHub workflow head repository does not match YardWeasels.');
  if(clean(run?.status)!=='completed' || clean(run?.conclusion)!=='success')throw new Error('GitHub workflow evidence run must be completed successfully before recording.');

  return {
    verified:true,
    read_performed:true,
    api_url:url,
    provenance:normalized,
    workflow_path:EXPECTED_CAPTURE_WORKFLOW_PATH,
    head_branch:EXPECTED_CAPTURE_BRANCH,
    head_repository:EXPECTED_GITHUB_REPOSITORY,
    status:'completed',
    conclusion:'success',
  };
}

export function verifyAuthArtifactObservationTime(observedAt,artifactCreatedAt){
  const observedMs=Date.parse(clean(observedAt));
  const artifactCreatedMs=Date.parse(clean(artifactCreatedAt));
  if(!Number.isFinite(observedMs))throw new Error('Workflow-bound Auth evidence observed_at is invalid.');
  if(!Number.isFinite(artifactCreatedMs))throw new Error('Verified Auth capture artifact created_at is invalid.');
  if(observedMs>artifactCreatedMs+FUTURE_SKEW_MS){
    throw new Error('Workflow-bound Auth evidence observed_at is later than the verified artifact creation window.');
  }
  if(artifactCreatedMs-observedMs>AUTH_ARTIFACT_OBSERVATION_MAX_LAG_MS){
    throw new Error('Workflow-bound Auth evidence observed_at is too old relative to the verified artifact creation time.');
  }
  return {
    verified:true,
    observed_at:new Date(observedMs).toISOString(),
    artifact_created_at:new Date(artifactCreatedMs).toISOString(),
    maximum_artifact_lag_ms:AUTH_ARTIFACT_OBSERVATION_MAX_LAG_MS,
    future_clock_skew_ms:FUTURE_SKEW_MS,
  };
}

function provenanceVerificationFromArtifact(artifactVerification,provenance){
  return {
    verified:artifactVerification?.verified===true,
    read_performed:Number(artifactVerification?.network_reads || 0)>=1,
    provenance,
    workflow_path:artifactVerification?.workflow_path || EXPECTED_CAPTURE_WORKFLOW_PATH,
    head_branch:artifactVerification?.head_branch || EXPECTED_CAPTURE_BRANCH,
    head_repository:artifactVerification?.repository || EXPECTED_GITHUB_REPOSITORY,
    status:'completed',
    conclusion:'success',
  };
}

export function authEvidenceReplayLookupUrl(supabaseUrl,rpcBody){
  const filter=(value)=>encodeURIComponent(clean(value));
  return `${clean(supabaseUrl).replace(/\/$/,'')}/rest/v1/it_auth_security_evidence?select=${encodeURIComponent(REPLAY_SELECT)}`+
    `&control_key=eq.${filter(rpcBody?.p_control_key)}`+
    `&evidence_source=eq.${filter(rpcBody?.p_evidence_source)}`+
    `&source_project_ref=eq.${filter(rpcBody?.p_source_project_ref)}`+
    `&source_capture_sha256=eq.${filter(rpcBody?.p_source_capture_sha256)}`+
    '&limit=2';
}

function workflowReplayDetailMatches(rowDetail,expectedDetail){
  const rowWorkflow=rowDetail?.workflow_provenance_verification;
  const expectedWorkflow=expectedDetail?.workflow_provenance_verification;
  const rowArtifact=rowDetail?.auth_capture_artifact_verification;
  const expectedArtifact=expectedDetail?.auth_capture_artifact_verification;
  const rowBinding=rowDetail?.auth_capture_content_binding_verification;
  const expectedBinding=expectedDetail?.auth_capture_content_binding_verification;
  const rowTemporal=rowDetail?.auth_capture_temporal_verification;
  const expectedTemporal=expectedDetail?.auth_capture_temporal_verification;
  return rowWorkflow?.verified===true && expectedWorkflow?.verified===true &&
    clean(rowWorkflow.repository)===clean(expectedWorkflow.repository) &&
    clean(rowWorkflow.head_repository)===clean(expectedWorkflow.head_repository) &&
    clean(rowWorkflow.head_branch)===clean(expectedWorkflow.head_branch) &&
    clean(rowWorkflow.run_id)===clean(expectedWorkflow.run_id) &&
    clean(rowWorkflow.run_attempt)===clean(expectedWorkflow.run_attempt) &&
    clean(rowWorkflow.commit_sha).toLowerCase()===clean(expectedWorkflow.commit_sha).toLowerCase() &&
    rowArtifact?.verified===true && expectedArtifact?.verified===true &&
    Number(rowArtifact.artifact_id)===Number(expectedArtifact.artifact_id) &&
    clean(rowArtifact.artifact_digest)===clean(expectedArtifact.artifact_digest) &&
    rowBinding?.verified===true && expectedBinding?.verified===true &&
    clean(rowBinding.commitment_sha256).toLowerCase()===clean(expectedBinding.commitment_sha256).toLowerCase() &&
    Number(rowBinding.marker_artifact_id)===Number(expectedBinding.marker_artifact_id) &&
    clean(rowBinding.marker_artifact_digest)===clean(expectedBinding.marker_artifact_digest) &&
    rowTemporal?.verified===true && expectedTemporal?.verified===true &&
    sameInstant(rowTemporal.observed_at,expectedTemporal.observed_at) &&
    sameInstant(rowTemporal.artifact_created_at,expectedTemporal.artifact_created_at);
}

export async function inspectAuthEvidenceReplay(plan,candidate,rpcBody,headers,options={}){
  const fetchImpl=options.fetchImpl || fetch;
  const url=authEvidenceReplayLookupUrl(plan.supabase_url,rpcBody);
  const response=await fetchImpl(url,{method:'GET',headers});
  if(!response?.ok){
    const text=await response?.text?.().catch(()=> '') || '';
    throw new Error(`Auth evidence replay precheck failed (${response?.status ?? 'unknown'})${text ? `: ${text.slice(0,300)}`:''}`);
  }
  const rows=await response.json();
  if(!Array.isArray(rows))throw new Error('Auth evidence replay precheck returned an invalid response shape.');
  if(rows.length>1)throw new Error('Auth evidence replay precheck found duplicate rows for a unique capture key.');
  if(rows.length===0){
    return {checked:true,disposition:'new_capture',existing_evidence_id:null,lookup_url:url};
  }

  const row=rows[0];
  const evidenceId=Number(row?.evidence_id);
  if(!Number.isInteger(evidenceId) || evidenceId<1)throw new Error('Auth evidence replay precheck found an invalid existing evidence id.');
  const rowDetail=isObject(row?.evidence_detail) ? row.evidence_detail : {};
  const expectedDetail=isObject(rpcBody?.p_evidence_detail) ? rpcBody.p_evidence_detail : {};
  const exactBase=row.control_key===rpcBody.p_control_key &&
    row.evidence_source===rpcBody.p_evidence_source &&
    row.observed_state===rpcBody.p_observed_state &&
    row.verification_status===candidate.derived_verification_status &&
    row.is_authoritative===true &&
    sameInstant(row.observed_at,rpcBody.p_observed_at) &&
    clean(row.evidence_reference)===clean(rpcBody.p_evidence_reference) &&
    clean(row.source_project_ref).toLowerCase()===clean(rpcBody.p_source_project_ref).toLowerCase() &&
    clean(row.source_capture_sha256).toLowerCase()===clean(rpcBody.p_source_capture_sha256).toLowerCase() &&
    Number(row.recording_contract_version)===1;
  const workflowDetailMatch=!plan.workflow_provenance || workflowReplayDetailMatches(rowDetail,expectedDetail);
  if(!exactBase || !workflowDetailMatch){
    throw new Error('Auth evidence capture digest is already recorded with conflicting authoritative metadata; refusing replay before RPC.');
  }

  return {
    checked:true,
    disposition:'exact_replay_noop',
    existing_evidence_id:evidenceId,
    lookup_url:url,
  };
}

export async function recordAuthEvidenceCandidate(candidate,env=process.env,options={}){
  const plan=buildAuthEvidenceRecordPlan(candidate,env,options);
  if(!plan.ok)return {...plan,write_performed:false,replay_precheck_performed:false,replay_disposition:'not_checked',replay_existing_evidence_id:null,workflow_provenance_verified:false,auth_capture_artifact_verified:false,auth_capture_temporal_verified:false,auth_capture_content_binding_verified:false};
  const fetchImpl=options.fetchImpl || fetch;

  let provenanceVerification={verified:false,read_performed:false,provenance:null};
  let artifactVerification={verified:false,network_reads:0,artifact:null,content_binding:null};
  let temporalVerification={verified:false};
  if(plan.workflow_provenance){
    artifactVerification=await verifyAuthEvidenceArtifact({
      run_id:plan.workflow_provenance.run_id,
      run_attempt:plan.workflow_provenance.run_attempt,
      commit_sha:plan.workflow_provenance.commit_sha,
      control_key:plan.rpc_body.p_control_key,
      content_binding_commitment_sha256:plan.workflow_content_binding.commitment_sha256,
    },{fetchImpl});
    if(!artifactVerification?.verified){
      throw new Error('Workflow-bound Auth evidence artifact verification did not succeed.');
    }
    if(!artifactVerification?.content_binding_verified){
      throw new Error('Workflow-bound Auth evidence content-binding marker verification did not succeed.');
    }
    temporalVerification=verifyAuthArtifactObservationTime(
      plan.rpc_body.p_observed_at,
      artifactVerification.artifact?.created_at,
    );
    provenanceVerification=provenanceVerificationFromArtifact(artifactVerification,plan.workflow_provenance);
  }

  const rpcBody={
    ...plan.rpc_body,
    p_evidence_detail:{
      ...plan.rpc_body.p_evidence_detail,
      ...(provenanceVerification.verified ? {
        workflow_provenance_verification:{
          verified:true,
          verification_source:'github_actions_api',
          workflow_path:provenanceVerification.workflow_path,
          repository:provenanceVerification.provenance.repository,
          head_repository:provenanceVerification.head_repository,
          head_branch:provenanceVerification.head_branch,
          run_id:provenanceVerification.provenance.run_id,
          run_attempt:provenanceVerification.provenance.run_attempt,
          commit_sha:provenanceVerification.provenance.commit_sha,
        },
        auth_capture_artifact_verification:{
          verified:true,
          verification_version:artifactVerification.verification_version,
          verification_source:artifactVerification.verification_source,
          artifact_id:artifactVerification.artifact?.id ?? null,
          artifact_name:artifactVerification.artifact?.name ?? null,
          artifact_digest:artifactVerification.artifact?.digest ?? null,
          artifact_size_in_bytes:artifactVerification.artifact?.size_in_bytes ?? null,
          artifact_created_at:artifactVerification.artifact?.created_at ?? null,
          artifact_expired:artifactVerification.artifact?.expired ?? null,
          artifact_download_performed:false,
          artifact_decryption_performed:false,
        },
        auth_capture_content_binding_verification:{
          verified:artifactVerification.content_binding_verified===true,
          binding_version:plan.workflow_content_binding.version ?? null,
          algorithm:plan.workflow_content_binding.algorithm ?? null,
          canonicalization:plan.workflow_content_binding.canonicalization ?? null,
          commitment_sha256:plan.workflow_content_binding.commitment_sha256 ?? null,
          marker_artifact_id:artifactVerification.content_binding?.artifact?.id ?? null,
          marker_artifact_name:artifactVerification.content_binding?.artifact?.name ?? null,
          marker_artifact_digest:artifactVerification.content_binding?.artifact?.digest ?? null,
          marker_artifact_created_at:artifactVerification.content_binding?.artifact?.created_at ?? null,
          candidate_nonce_persisted:false,
          artifact_download_performed:false,
          artifact_decryption_performed:false,
        },
        auth_capture_temporal_verification:{
          verified:temporalVerification.verified===true,
          observed_at:temporalVerification.observed_at ?? null,
          artifact_created_at:temporalVerification.artifact_created_at ?? null,
          maximum_artifact_lag_ms:temporalVerification.maximum_artifact_lag_ms ?? null,
          future_clock_skew_ms:temporalVerification.future_clock_skew_ms ?? null,
        },
      } : {}),
    },
  };

  const headers={
    apikey:plan.service_key,
    authorization:`Bearer ${plan.service_key}`,
    'content-type':'application/json',
  };

  const replayInspection=await inspectAuthEvidenceReplay(plan,candidate,rpcBody,headers,{fetchImpl});
  if(replayInspection.disposition==='exact_replay_noop'){
    return {
      ok:true,
      errors:[],
      write_performed:false,
      replay_precheck_performed:true,
      replay_disposition:replayInspection.disposition,
      replay_existing_evidence_id:replayInspection.existing_evidence_id,
      workflow_provenance_verified:provenanceVerification.verified,
      workflow_provenance_read_performed:provenanceVerification.read_performed,
      auth_capture_artifact_verified:artifactVerification.verified,
      auth_capture_artifact_metadata_reads:Number(artifactVerification.network_reads || 0),
      auth_capture_artifact_id:artifactVerification.artifact?.id ?? null,
      auth_capture_artifact_digest:artifactVerification.artifact?.digest ?? null,
      auth_capture_content_binding_verified:artifactVerification.content_binding_verified===true,
      auth_capture_content_binding_commitment:plan.workflow_content_binding?.commitment_sha256 ?? null,
      auth_capture_content_binding_marker_artifact_id:artifactVerification.content_binding?.artifact?.id ?? null,
      auth_capture_temporal_verified:temporalVerification.verified===true,
      auth_capture_temporal_observed_at:temporalVerification.observed_at ?? null,
      auth_capture_temporal_artifact_created_at:temporalVerification.artifact_created_at ?? null,
      source_capture_digest_revalidated:plan.source_capture_digest_revalidated,
      evidence_id:replayInspection.existing_evidence_id,
      control_key:plan.rpc_body.p_control_key,
      current_status:plan.expected_current_status,
      source_project_ref:plan.rpc_body.p_source_project_ref,
      source_capture_sha256:plan.rpc_body.p_source_capture_sha256,
      recording_contract_version:1,
    };
  }

  const rpcResponse=await fetchImpl(`${plan.supabase_url}/rest/v1/rpc/ywi_record_auth_security_evidence`,{
    method:'POST',headers,body:JSON.stringify(rpcBody),
  });
  if(!rpcResponse.ok){
    const text=await rpcResponse.text().catch(()=> '');
    throw new Error(`Authorized Auth evidence RPC failed (${rpcResponse.status})${text ? `: ${text.slice(0,400)}`:''}`);
  }
  const evidenceId=Number(await rpcResponse.json());
  if(!Number.isInteger(evidenceId) || evidenceId<1)throw new Error('Authorized Auth evidence RPC returned an invalid evidence id.');

  const control=encodeURIComponent(plan.rpc_body.p_control_key);
  const verifyResponse=await fetchImpl(`${plan.supabase_url}/rest/v1/v_it_auth_security_evidence_current?select=evidence_id,control_key,current_status,source_project_ref,source_capture_sha256,recording_contract_version&control_key=eq.${control}`,{headers});
  if(!verifyResponse.ok)throw new Error(`Auth evidence verification read failed (${verifyResponse.status}).`);
  const rows=await verifyResponse.json();
  const row=Array.isArray(rows) ? rows[0] : null;
  if(!row || Number(row.evidence_id)!==evidenceId)throw new Error('Fresh Auth evidence authority does not surface the recorded evidence id.');
  if(row.control_key!==plan.rpc_body.p_control_key)throw new Error('Fresh Auth evidence authority control key mismatch.');
  if(row.current_status!==plan.expected_current_status)throw new Error(`Fresh Auth evidence authority status mismatch: expected ${plan.expected_current_status}, received ${row.current_status}.`);
  if(row.source_project_ref!==EXPECTED_PROJECT_REF)throw new Error('Fresh Auth evidence authority project binding mismatch.');
  if(row.source_capture_sha256!==plan.rpc_body.p_source_capture_sha256)throw new Error('Fresh Auth evidence authority capture digest mismatch.');
  if(Number(row.recording_contract_version)!==1)throw new Error('Fresh Auth evidence authority recording contract mismatch.');

  return {
    ok:true,
    errors:[],
    write_performed:true,
    replay_precheck_performed:true,
    replay_disposition:replayInspection.disposition,
    replay_existing_evidence_id:null,
    workflow_provenance_verified:provenanceVerification.verified,
    workflow_provenance_read_performed:provenanceVerification.read_performed,
    auth_capture_artifact_verified:artifactVerification.verified,
    auth_capture_artifact_metadata_reads:Number(artifactVerification.network_reads || 0),
    auth_capture_artifact_id:artifactVerification.artifact?.id ?? null,
    auth_capture_artifact_digest:artifactVerification.artifact?.digest ?? null,
    auth_capture_content_binding_verified:artifactVerification.content_binding_verified===true,
    auth_capture_content_binding_commitment:plan.workflow_content_binding?.commitment_sha256 ?? null,
    auth_capture_content_binding_marker_artifact_id:artifactVerification.content_binding?.artifact?.id ?? null,
    auth_capture_temporal_verified:temporalVerification.verified===true,
    auth_capture_temporal_observed_at:temporalVerification.observed_at ?? null,
    auth_capture_temporal_artifact_created_at:temporalVerification.artifact_created_at ?? null,
    source_capture_digest_revalidated:plan.source_capture_digest_revalidated,
    evidence_id:evidenceId,
    control_key:row.control_key,
    current_status:row.current_status,
    source_project_ref:row.source_project_ref,
    source_capture_sha256:row.source_capture_sha256,
    recording_contract_version:Number(row.recording_contract_version),
  };
}

function readCandidate(){
  const inputPath=path.resolve(process.argv[2] || process.env.YWI_AUTH_EVIDENCE_CANDIDATE_PATH || 'auth-security-evidence-record-candidate.json');
  return {inputPath,candidate:JSON.parse(fs.readFileSync(inputPath,'utf8'))};
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){
  try{
    const {inputPath,candidate}=readCandidate();
    const result=await recordAuthEvidenceCandidate(candidate);
    console.log(JSON.stringify({
      ok:result.ok,
      input_path:inputPath,
      write_performed:result.write_performed,
      replay_precheck_performed:result.replay_precheck_performed ?? false,
      replay_disposition:result.replay_disposition ?? 'not_checked',
      replay_existing_evidence_id:result.replay_existing_evidence_id ?? null,
      workflow_provenance_verified:result.workflow_provenance_verified ?? false,
      auth_capture_artifact_verified:result.auth_capture_artifact_verified ?? false,
      auth_capture_artifact_id:result.auth_capture_artifact_id ?? null,
      auth_capture_artifact_digest:result.auth_capture_artifact_digest ?? null,
      auth_capture_content_binding_verified:result.auth_capture_content_binding_verified ?? false,
      auth_capture_content_binding_commitment:result.auth_capture_content_binding_commitment ?? null,
      auth_capture_content_binding_marker_artifact_id:result.auth_capture_content_binding_marker_artifact_id ?? null,
      auth_capture_temporal_verified:result.auth_capture_temporal_verified ?? false,
      auth_capture_temporal_observed_at:result.auth_capture_temporal_observed_at ?? null,
      auth_capture_temporal_artifact_created_at:result.auth_capture_temporal_artifact_created_at ?? null,
      source_capture_digest_revalidated:result.source_capture_digest_revalidated ?? false,
      evidence_id:result.evidence_id ?? null,
      control_key:result.control_key ?? candidate.control_key ?? null,
      current_status:result.current_status ?? null,
      source_project_ref:result.source_project_ref ?? candidate.project_ref ?? null,
      source_capture_sha256:result.source_capture_sha256 ?? candidate.source_capture_sha256 ?? null,
      recording_contract_version:result.recording_contract_version ?? null,
      errors:result.errors ?? [],
    },null,2));
    if(!result.ok){
      console.error('\nAUTH SECURITY EVIDENCE RECORDING: LOCKED');
      for(const error of result.errors)console.error(`- ${error}`);
      process.exitCode=1;
    }else if(result.replay_disposition==='exact_replay_noop'){
      console.log('\nAUTH SECURITY EVIDENCE RECORDING: VERIFIED REPLAY NO-OP');
      console.log('The exact authoritative capture was already recorded. The recorder re-verified workflow/artifact/content/temporal provenance where applicable, confirmed the existing service-private row matches, and performed no RPC write.');
    }else{
      console.log('\nAUTH SECURITY EVIDENCE RECORDING: RECORDED AND RE-READ');
      console.log('The recorder recomputes the retained sanitized source-capture SHA-256 and workflow-bound Management API evidence requires the exact successful canonical-main GitHub Actions run, its exact non-expired SHA-256-backed encrypted capture artifact, an exact salted candidate-content commitment marker artifact, and an observed_at timestamp bound to the artifact creation window before the service-private write. A service-private replay precheck prevents exact replays from rewriting existing evidence and blocks conflicting digest reuse before the RPC. The artifacts are not downloaded or decrypted, and the binding nonce is not persisted in evidence_detail. This does not change Supabase Auth settings, enable Finance/provider mutation, run staging acceptance, or promote Production.');
    }
  }catch(error){
    console.error(`AUTH SECURITY EVIDENCE RECORDING: LOCKED\n- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode=1;
  }
}
