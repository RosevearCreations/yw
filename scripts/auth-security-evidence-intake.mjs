#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const AUTH_EVIDENCE_INTAKE_VERSION=1;
export const EXPECTED_PROJECT_REF='jmqvkgiqlimdhcofwkxr';
export const OFFICIAL_SOURCES=new Set(['supabase_dashboard','supabase_management_api']);
const MAX_AGE_MS=30*24*60*60*1000;
const FUTURE_SKEW_MS=5*60*1000;
const SENSITIVE_KEY_RE=/(?:authorization|access[_-]?token|refresh[_-]?token|service[_-]?role|api[_-]?key|apikey|jwt|secret|cookie|private[_-]?key)/i;

const clean=(value)=>String(value ?? '').trim();
const isPlainObject=(value)=>Boolean(value && typeof value==='object' && !Array.isArray(value));

function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(isPlainObject(value)){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=stableValue(value[key]);
    return out;
  }
  return value;
}

function findSensitiveKey(value,pathParts=[]){
  if(Array.isArray(value)){
    for(let index=0;index<value.length;index+=1){
      const found=findSensitiveKey(value[index],[...pathParts,String(index)]);
      if(found)return found;
    }
    return null;
  }
  if(!isPlainObject(value))return null;
  for(const [key,nested] of Object.entries(value)){
    if(SENSITIVE_KEY_RE.test(key))return [...pathParts,key].join('.');
    const found=findSensitiveKey(nested,[...pathParts,key]);
    if(found)return found;
  }
  return null;
}

function deriveVerification(controlKey,observedState){
  if(controlKey==='leaked_password_protection'){
    if(observedState==='enabled')return 'verified_secure';
    if(observedState==='disabled')return 'verified_followup';
    if(observedState==='unknown')return 'unverified';
    return null;
  }
  if(controlKey==='mfa_options'){
    if(observedState==='configured')return 'verified_secure';
    if(observedState==='not_configured')return 'verified_followup';
    if(observedState==='unknown')return 'unverified';
    return null;
  }
  return null;
}

export function buildAuthEvidenceRecordCandidate(input={},options={}){
  const nowValue=options.now || new Date().toISOString();
  const nowMs=Date.parse(nowValue);
  if(!Number.isFinite(nowMs))throw new Error('options.now must be a valid ISO timestamp.');

  const errors=[];
  if(!isPlainObject(input))input={};

  const captureVersion=Number(input.evidence_capture_version);
  const controlKey=clean(input.control_key);
  const evidenceSource=clean(input.evidence_source);
  const projectRef=clean(input.project_ref);
  const observedState=clean(input.observed_state);
  const observedAt=clean(input.observed_at);
  const evidenceReference=clean(input.evidence_reference);
  const evidenceDetail=input.evidence_detail ?? {};
  const sourceCapture=input.source_capture;

  if(captureVersion!==AUTH_EVIDENCE_INTAKE_VERSION)errors.push(`evidence_capture_version must equal ${AUTH_EVIDENCE_INTAKE_VERSION}.`);
  if(!['leaked_password_protection','mfa_options'].includes(controlKey))errors.push('control_key must identify a supported Auth security control.');
  if(!OFFICIAL_SOURCES.has(evidenceSource))errors.push('Only Supabase Dashboard or Management API evidence may enter the authoritative intake contract.');
  if(projectRef!==EXPECTED_PROJECT_REF)errors.push(`project_ref must exactly equal the registered YardWeasels Production project ${EXPECTED_PROJECT_REF}.`);
  if(!evidenceReference)errors.push('A durable evidence_reference is required.');
  if(evidenceReference.length>1000)errors.push('evidence_reference must be 1000 characters or fewer.');
  if(Object.prototype.hasOwnProperty.call(input,'verification_status'))errors.push('verification_status is derived by the intake contract and must not be supplied.');
  if(Object.prototype.hasOwnProperty.call(input,'is_authoritative'))errors.push('is_authoritative is derived by the intake contract and must not be supplied.');
  if(Object.prototype.hasOwnProperty.call(input,'expires_at'))errors.push('expires_at is derived from observed_at and must not be supplied.');

  const verificationStatus=deriveVerification(controlKey,observedState);
  if(!verificationStatus)errors.push('observed_state is invalid for the selected Auth control.');

  const observedMs=Date.parse(observedAt);
  if(!Number.isFinite(observedMs))errors.push('observed_at must be a valid ISO timestamp.');
  if(Number.isFinite(observedMs)){
    if(observedMs>nowMs+FUTURE_SKEW_MS)errors.push('observed_at must not be materially future-dated.');
    if(nowMs-observedMs>MAX_AGE_MS)errors.push('observed_at is older than the 30-day current-evidence window.');
  }

  if(!(typeof sourceCapture==='string' || Array.isArray(sourceCapture) || isPlainObject(sourceCapture))){
    errors.push('source_capture must contain the actual captured Dashboard/Management API observation as JSON-compatible text/object/array.');
  }else if(typeof sourceCapture==='string' && !sourceCapture.trim()){
    errors.push('source_capture must not be empty.');
  }

  if(!isPlainObject(evidenceDetail))errors.push('evidence_detail must be a JSON object when supplied.');
  const sensitiveCaptureKey=findSensitiveKey(sourceCapture);
  const sensitiveDetailKey=findSensitiveKey(evidenceDetail);
  if(sensitiveCaptureKey)errors.push(`source_capture contains a secret-bearing field (${sensitiveCaptureKey}); remove credentials before intake.`);
  if(sensitiveDetailKey)errors.push(`evidence_detail contains a secret-bearing field (${sensitiveDetailKey}); remove credentials before intake.`);

  let sourceCaptureSha256=null;
  if(!errors.some((error)=>error.startsWith('source_capture')) && sourceCapture!==undefined){
    const canonical=JSON.stringify(stableValue(sourceCapture));
    sourceCaptureSha256=crypto.createHash('sha256').update(canonical,'utf8').digest('hex');
  }

  const expiresAt=Number.isFinite(observedMs) ? new Date(observedMs+MAX_AGE_MS).toISOString() : null;
  const generatedAt=new Date(nowMs).toISOString();
  const candidate={
    evidence_format_version:1,
    evidence_kind:'ywi_auth_security_evidence_record_candidate',
    intake_contract_version:AUTH_EVIDENCE_INTAKE_VERSION,
    project_ref:projectRef || null,
    control_key:controlKey || null,
    evidence_source:evidenceSource || null,
    evidence_reference:evidenceReference || null,
    observed_state:observedState || null,
    observed_at:Number.isFinite(observedMs) ? new Date(observedMs).toISOString() : null,
    expires_at:expiresAt,
    source_capture_sha256:sourceCaptureSha256,
    derived_verification_status:verificationStatus,
    source_authenticity_verified_by_tool:false,
    recording_authorized_by_tool:false,
    database_record_candidate:{
      control_key:controlKey || null,
      evidence_source:evidenceSource || null,
      observed_state:observedState || null,
      verification_status:verificationStatus,
      is_authoritative:true,
      observed_at:Number.isFinite(observedMs) ? new Date(observedMs).toISOString() : null,
      expires_at:expiresAt,
      evidence_reference:evidenceReference || null,
      evidence_detail:isPlainObject(evidenceDetail) ? {
        ...stableValue(evidenceDetail),
        intake_contract_version:AUTH_EVIDENCE_INTAKE_VERSION,
        project_ref:projectRef || null,
        source_capture_sha256:sourceCaptureSha256,
      } : {},
    },
    boundaries:{
      structure_and_freshness_validation_only:true,
      source_authenticity_verified:false,
      database_write_performed:false,
      auth_setting_mutation_performed:false,
      current_admin_todo_auto_closed:false,
      finance_or_provider_mutation_performed:false,
      production_promotion_performed:false,
    },
    required_followup:[
      'Confirm the supplied capture is genuine current Supabase Dashboard or Management API evidence for the named project and control.',
      'Record the candidate only through an authorized service-role evidence path; do not edit the derived verification status by hand.',
      'Re-read current Auth evidence authority after recording. Production promotion remains separate and deliberate.',
    ],
    generated_at:generatedAt,
  };

  return {ok:errors.length===0,errors,candidate};
}

export function writeAuthEvidenceRecordCandidate(input={},options={}){
  const outputPath=path.resolve(options.outputPath || process.env.YWI_AUTH_EVIDENCE_OUTPUT_PATH || 'auth-security-evidence-record-candidate.json');
  const result=buildAuthEvidenceRecordCandidate(input,options);
  if(!result.ok){
    try{ if(fs.existsSync(outputPath))fs.rmSync(outputPath,{force:true}); }catch{}
    return {...result,output_path:outputPath};
  }
  fs.writeFileSync(outputPath,`${JSON.stringify(result.candidate,null,2)}\n`,'utf8');
  return {...result,output_path:outputPath};
}

function readInputFile(){
  const inputPath=path.resolve(process.argv[2] || process.env.YWI_AUTH_EVIDENCE_INPUT_PATH || 'auth-security-evidence-input.json');
  return {inputPath,input:JSON.parse(fs.readFileSync(inputPath,'utf8'))};
}

function printResult(result,inputPath){
  console.log(JSON.stringify({
    ok:result.ok,
    input_path:inputPath,
    output_path:result.output_path,
    control_key:result.candidate.control_key,
    evidence_source:result.candidate.evidence_source,
    observed_state:result.candidate.observed_state,
    derived_verification_status:result.candidate.derived_verification_status,
    source_capture_sha256:result.candidate.source_capture_sha256,
    source_authenticity_verified_by_tool:result.candidate.source_authenticity_verified_by_tool,
    recording_authorized_by_tool:result.candidate.recording_authorized_by_tool,
    errors:result.errors,
  },null,2));
  if(!result.ok){
    console.error('\nAUTH SECURITY EVIDENCE INTAKE: LOCKED');
    for(const error of result.errors)console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('\nAUTH SECURITY EVIDENCE INTAKE: RECORD CANDIDATE WRITTEN');
  console.log('This validates structure/freshness and derives database fields. It does not authenticate the external source, write Supabase, change Auth, or close a follow-up.');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){
  try{
    const {inputPath,input}=readInputFile();
    printResult(writeAuthEvidenceRecordCandidate(input),inputPath);
  }catch(error){
    console.error(`AUTH SECURITY EVIDENCE INTAKE: LOCKED\n- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode=1;
  }
}
