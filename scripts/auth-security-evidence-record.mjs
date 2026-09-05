#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const EXPECTED_PROJECT_REF='jmqvkgiqlimdhcofwkxr';
export const RECORD_CONFIRM='I_CONFIRM_AUTH_EVIDENCE_RECORD';
export const SOURCE_CONFIRM='I_CONFIRM_OFFICIAL_SUPABASE_SOURCE';
const MAX_AGE_MS=30*24*60*60*1000;
const FUTURE_SKEW_MS=5*60*1000;

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
  try{ url=new URL(value); }catch{ return null; }
  if(url.protocol!=='https:')return null;
  const match=url.hostname.match(/^([a-z0-9-]{8,80})\.supabase\.co$/i);
  return match ? match[1].toLowerCase() : null;
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
  const derived=deriveVerification(controlKey,state);

  if(candidate.evidence_kind!=='ywi_auth_security_evidence_record_candidate')errors.push('Candidate evidence_kind is invalid.');
  if(candidate.intake_contract_version!==1)errors.push('Candidate intake contract version is unsupported.');
  if(projectRef!==EXPECTED_PROJECT_REF)errors.push(`Candidate project_ref must equal ${EXPECTED_PROJECT_REF}.`);
  if(!['supabase_dashboard','supabase_management_api'].includes(evidenceSource))errors.push('Candidate evidence source is not an official Supabase control-plane source.');
  if(!derived)errors.push('Candidate control/state combination is invalid.');
  if(!reference)errors.push('Candidate evidence_reference is required.');
  if(!/^[0-9a-f]{64}$/.test(captureSha))errors.push('Candidate source_capture_sha256 is invalid.');
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

  const evidenceDetail=isObject(db.evidence_detail) ? {
    ...db.evidence_detail,
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
    expected_current_status:expectedCurrentStatus(derived),
  };
}

export async function recordAuthEvidenceCandidate(candidate,env=process.env,options={}){
  const plan=buildAuthEvidenceRecordPlan(candidate,env,options);
  if(!plan.ok)return {...plan,write_performed:false};
  const fetchImpl=options.fetchImpl || fetch;
  const headers={
    apikey:plan.service_key,
    authorization:`Bearer ${plan.service_key}`,
    'content-type':'application/json',
  };

  const rpcResponse=await fetchImpl(`${plan.supabase_url}/rest/v1/rpc/ywi_record_auth_security_evidence`,{
    method:'POST',headers,body:JSON.stringify(plan.rpc_body),
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
    }else{
      console.log('\nAUTH SECURITY EVIDENCE RECORDING: RECORDED AND RE-READ');
      console.log('This records the confirmed evidence observation only. It does not change Supabase Auth settings, enable Finance/provider mutation, run staging acceptance, or promote Production.');
    }
  }catch(error){
    console.error(`AUTH SECURITY EVIDENCE RECORDING: LOCKED\n- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode=1;
  }
}
