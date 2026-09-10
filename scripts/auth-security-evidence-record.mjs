#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as core from './auth-security-evidence-record-core.mjs';

export * from './auth-security-evidence-record-core.mjs';

const CURRENT_AUTHORITY_SELECT=[
  'evidence_id','control_key','current_status','source_project_ref','source_capture_sha256','recording_contract_version',
].join(',');
const clean=(value)=>String(value ?? '').trim();

function productionProjectRefFromUrl(value){
  let url;
  try{url=new URL(clean(value));}catch{return null;}
  if(url.protocol!=='https:')return null;
  const match=url.hostname.match(/^([a-z0-9-]{8,80})\.supabase\.co$/i);
  return match ? match[1].toLowerCase() : null;
}

export function authEvidenceCurrentAuthorityUrl(supabaseUrl,controlKey){
  const base=clean(supabaseUrl).replace(/\/$/,'');
  return `${base}/rest/v1/v_it_auth_security_evidence_current?select=${encodeURIComponent(CURRENT_AUTHORITY_SELECT)}`+
    `&control_key=eq.${encodeURIComponent(clean(controlKey))}`;
}

export async function verifyExactReplayCurrentAuthority(result,env=process.env,options={}){
  if(result?.replay_disposition!=='exact_replay_noop'){
    return {verified:false,read_performed:false,evidence_id:null,current_status:null};
  }

  const supabaseUrl=clean(env.SUPABASE_URL).replace(/\/$/,'');
  if(productionProjectRefFromUrl(supabaseUrl)!==core.EXPECTED_PROJECT_REF){
    throw new Error('Exact replay current-authority verification requires the registered YardWeasels Production Supabase URL.');
  }
  const serviceKey=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if(!serviceKey)throw new Error('Exact replay current-authority verification requires SUPABASE_SERVICE_ROLE_KEY.');

  const controlKey=clean(result?.control_key);
  const captureSha=clean(result?.source_capture_sha256).toLowerCase();
  const replayEvidenceId=Number(result?.replay_existing_evidence_id ?? result?.evidence_id);
  if(!controlKey)throw new Error('Exact replay current-authority verification requires a control key.');
  if(!/^[0-9a-f]{64}$/.test(captureSha))throw new Error('Exact replay current-authority verification requires a valid capture digest.');
  if(!Number.isInteger(replayEvidenceId) || replayEvidenceId<1)throw new Error('Exact replay current-authority verification requires the existing evidence id.');

  const fetchImpl=options.fetchImpl || fetch;
  const url=authEvidenceCurrentAuthorityUrl(supabaseUrl,controlKey);
  const headers={apikey:serviceKey,authorization:`Bearer ${serviceKey}`};
  const response=await fetchImpl(url,{method:'GET',headers});
  if(!response?.ok){
    const text=await response?.text?.().catch(()=> '') || '';
    throw new Error(`Exact replay current-authority verification failed (${response?.status ?? 'unknown'})${text ? `: ${text.slice(0,300)}`:''}`);
  }
  const rows=await response.json();
  if(!Array.isArray(rows) || rows.length!==1){
    throw new Error('Exact replay current-authority verification did not return exactly one control authority row.');
  }
  const row=rows[0];
  if(Number(row?.evidence_id)!==replayEvidenceId){
    throw new Error('Exact Auth evidence replay is historical or superseded; refusing to report it as current authority.');
  }
  if(clean(row?.control_key)!==controlKey)throw new Error('Exact replay current-authority control key mismatch.');
  if(clean(row?.current_status)!==clean(result?.current_status))throw new Error('Exact replay current-authority status mismatch.');
  if(clean(row?.source_project_ref).toLowerCase()!==core.EXPECTED_PROJECT_REF)throw new Error('Exact replay current-authority project binding mismatch.');
  if(clean(row?.source_capture_sha256).toLowerCase()!==captureSha)throw new Error('Exact replay current-authority capture digest mismatch.');
  if(Number(row?.recording_contract_version)!==1)throw new Error('Exact replay current-authority recording contract mismatch.');

  return {
    verified:true,
    read_performed:true,
    evidence_id:replayEvidenceId,
    current_status:clean(row.current_status),
    source_project_ref:clean(row.source_project_ref).toLowerCase(),
    source_capture_sha256:clean(row.source_capture_sha256).toLowerCase(),
    recording_contract_version:Number(row.recording_contract_version),
  };
}

export async function recordAuthEvidenceCandidateWithCurrentAuthority(candidate,env=process.env,options={}){
  const recordImpl=options.recordImpl || core.recordAuthEvidenceCandidate;
  const result=await recordImpl(candidate,env,options);
  if(!result?.ok || result.replay_disposition!=='exact_replay_noop'){
    return {
      ...result,
      replay_current_authority_verified:false,
      replay_current_authority_read_performed:false,
    };
  }

  const verification=await verifyExactReplayCurrentAuthority(result,env,options);
  return {
    ...result,
    replay_current_authority_verified:verification.verified,
    replay_current_authority_read_performed:verification.read_performed,
    replay_current_authority_evidence_id:verification.evidence_id,
    replay_current_authority_status:verification.current_status,
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
    const result=await recordAuthEvidenceCandidateWithCurrentAuthority(candidate);
    console.log(JSON.stringify({
      ok:result.ok,
      input_path:inputPath,
      write_performed:result.write_performed,
      replay_precheck_performed:result.replay_precheck_performed ?? false,
      replay_disposition:result.replay_disposition ?? 'not_checked',
      replay_existing_evidence_id:result.replay_existing_evidence_id ?? null,
      replay_current_authority_verified:result.replay_current_authority_verified ?? false,
      replay_current_authority_read_performed:result.replay_current_authority_read_performed ?? false,
      replay_current_authority_evidence_id:result.replay_current_authority_evidence_id ?? null,
      replay_current_authority_status:result.replay_current_authority_status ?? null,
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
      for(const error of result.errors ?? [])console.error(`- ${error}`);
      process.exitCode=1;
    }else if(result.replay_disposition==='exact_replay_noop'){
      console.log('\nAUTH SECURITY EVIDENCE RECORDING: VERIFIED CURRENT REPLAY NO-OP');
      console.log('The exact capture was already recorded, remains the current authoritative row, and was re-verified without an RPC write. Historical or superseded replays are rejected rather than reported as current.');
    }else{
      console.log('\nAUTH SECURITY EVIDENCE RECORDING: RECORDED AND RE-READ');
      console.log('New evidence retains the existing digest, workflow, artifact, content-binding, temporal, authorized-RPC, and post-write current-authority verification chain. Build 271 adds no new mutation authority.');
    }
  }catch(error){
    console.error(`AUTH SECURITY EVIDENCE RECORDING: LOCKED\n- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode=1;
  }
}
