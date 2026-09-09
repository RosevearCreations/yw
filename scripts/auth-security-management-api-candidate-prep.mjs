#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  AUTH_CONFIG_URL,
  AUTH_MANAGEMENT_API_CAPTURE_VERSION,
  captureAuthSecurityManagementApi,
} from './auth-security-management-api-capture.mjs';
import {
  EXPECTED_PROJECT_REF,
  buildAuthEvidenceRecordCandidate,
} from './auth-security-evidence-intake.mjs';

export const AUTH_MANAGEMENT_API_CANDIDATE_PREP_VERSION=1;
export const PREPARED_CONTROL_KEYS=['leaked_password_protection','mfa_options'];

const clean=(value)=>String(value ?? '').trim();
const isPlainObject=(value)=>Boolean(value && typeof value==='object' && !Array.isArray(value));

function requirePlainObject(value,label){
  if(!isPlainObject(value))throw new Error(`${label} must be a JSON object.`);
  return value;
}

function validateCaptureBoundary(bundle,key,expected){
  if(bundle?.boundaries?.[key]!==expected)throw new Error(`Capture boundary ${key} must equal ${expected}.`);
}

export function validateAuthManagementCaptureBundle(bundle){
  requirePlainObject(bundle,'Auth Management API capture bundle');
  if(bundle.evidence_format_version!==1)throw new Error('Capture evidence format version is unsupported.');
  if(bundle.evidence_kind!=='ywi_supabase_auth_management_api_capture')throw new Error('Capture evidence kind is invalid.');
  if(bundle.capture_contract_version!==AUTH_MANAGEMENT_API_CAPTURE_VERSION)throw new Error('Capture contract version is unsupported.');
  if(clean(bundle.project_ref)!==EXPECTED_PROJECT_REF)throw new Error(`Capture project_ref must equal ${EXPECTED_PROJECT_REF}.`);
  if(clean(bundle.endpoint)!==AUTH_CONFIG_URL(EXPECTED_PROJECT_REF))throw new Error('Capture endpoint does not match the exact official YardWeasels Auth config endpoint.');
  if(bundle.http_method!=='GET')throw new Error('Capture must come from a GET request.');
  const observedAt=clean(bundle.observed_at);
  if(!Number.isFinite(Date.parse(observedAt)))throw new Error('Capture observed_at is invalid.');
  const inputs=requirePlainObject(bundle.intake_inputs,'Capture intake_inputs');
  const validation=requirePlainObject(bundle.intake_validation,'Capture intake_validation');
  const derived=requirePlainObject(bundle.derived_states,'Capture derived_states');
  validateCaptureBoundary(bundle,'management_api_read_only',true);
  validateCaptureBoundary(bundle,'exact_official_endpoint_required',true);
  validateCaptureBoundary(bundle,'full_management_api_response_persisted',false);
  validateCaptureBoundary(bundle,'access_token_persisted',false);
  validateCaptureBoundary(bundle,'database_write_performed',false);
  validateCaptureBoundary(bundle,'auth_setting_mutation_performed',false);
  validateCaptureBoundary(bundle,'evidence_recording_performed',false);
  validateCaptureBoundary(bundle,'current_admin_todo_auto_closed',false);
  validateCaptureBoundary(bundle,'finance_or_provider_mutation_performed',false);
  validateCaptureBoundary(bundle,'production_promotion_performed',false);

  for(const controlKey of PREPARED_CONTROL_KEYS){
    const input=requirePlainObject(inputs[controlKey],`Capture intake input ${controlKey}`);
    if(input.control_key!==controlKey)throw new Error(`Capture intake input ${controlKey} has the wrong control key.`);
    if(input.evidence_source!=='supabase_management_api')throw new Error(`Capture intake input ${controlKey} is not Management API evidence.`);
    if(input.project_ref!==EXPECTED_PROJECT_REF)throw new Error(`Capture intake input ${controlKey} project mismatch.`);
    if(clean(input.observed_at)!==observedAt)throw new Error(`Capture intake input ${controlKey} timestamp mismatch.`);
    if(validation[`${controlKey}_ok`]!==true)throw new Error(`Capture intake validation for ${controlKey} is not green.`);
  }
  if(inputs.leaked_password_protection.observed_state!==derived.leaked_password_protection)throw new Error('Leaked-password derived state does not match its intake input.');
  if(inputs.mfa_options.observed_state!==derived.mfa_options)throw new Error('MFA derived state does not match its intake input.');
  return bundle;
}

export function prepareAuthEvidenceCandidatesFromCapture(bundle,options={}){
  validateAuthManagementCaptureBundle(bundle);
  const now=options.now || bundle.observed_at;
  const candidates={};
  for(const controlKey of PREPARED_CONTROL_KEYS){
    const result=buildAuthEvidenceRecordCandidate(bundle.intake_inputs[controlKey],{now});
    if(!result.ok)throw new Error(`Prepared ${controlKey} candidate failed the existing intake contract: ${result.errors.join('; ')}`);
    const candidate=result.candidate;
    if(candidate.control_key!==controlKey)throw new Error(`Prepared ${controlKey} candidate control key mismatch.`);
    if(candidate.project_ref!==EXPECTED_PROJECT_REF)throw new Error(`Prepared ${controlKey} candidate project mismatch.`);
    if(candidate.evidence_source!=='supabase_management_api')throw new Error(`Prepared ${controlKey} candidate source mismatch.`);
    if(candidate.observed_at!==bundle.observed_at)throw new Error(`Prepared ${controlKey} candidate timestamp mismatch.`);
    if(candidate.boundaries?.database_write_performed!==false)throw new Error(`Prepared ${controlKey} candidate must remain write-free.`);
    if(candidate.boundaries?.auth_setting_mutation_performed!==false)throw new Error(`Prepared ${controlKey} candidate must remain Auth-mutation-free.`);
    candidates[controlKey]=candidate;
  }

  return {
    evidence_format_version:1,
    evidence_kind:'ywi_auth_security_record_candidate_set',
    preparation_contract_version:AUTH_MANAGEMENT_API_CANDIDATE_PREP_VERSION,
    capture_contract_version:bundle.capture_contract_version,
    project_ref:EXPECTED_PROJECT_REF,
    source_endpoint:bundle.endpoint,
    source_http_method:bundle.http_method,
    observed_at:bundle.observed_at,
    derived_states:{...bundle.derived_states},
    candidate_controls:[...PREPARED_CONTROL_KEYS],
    candidates,
    boundaries:{
      source_capture_revalidated:true,
      existing_intake_contract_reused:true,
      source_authenticity_verified_by_prep:false,
      database_write_performed:false,
      auth_setting_mutation_performed:false,
      evidence_recording_performed:false,
      current_admin_todo_auto_closed:false,
      finance_or_provider_mutation_performed:false,
      production_promotion_performed:false,
    },
    required_followup:[
      'Confirm the capture came from the genuine official Supabase Management API for the registered YardWeasels Production project.',
      'Record each prepared candidate only through the existing authorized Auth evidence recorder with its explicit confirmation gates.',
      'Re-read current Auth evidence authority after each recording. Do not change Supabase Auth settings as part of evidence recording.',
    ],
    prepared_at:new Date(Date.parse(now)).toISOString(),
  };
}

function safeWriteJson(filePath,value){
  fs.writeFileSync(filePath,`${JSON.stringify(value,null,2)}\n`,'utf8');
}

export function writePreparedAuthEvidenceCandidateSet(bundle,options={}){
  const outputDir=path.resolve(options.outputDir || process.env.YWI_AUTH_EVIDENCE_PREP_OUTPUT_DIR || 'auth-security-evidence-prepared');
  const prepared=prepareAuthEvidenceCandidatesFromCapture(bundle,options);
  const parent=path.dirname(outputDir);
  fs.mkdirSync(parent,{recursive:true});
  const tempDir=fs.mkdtempSync(path.join(parent,`.${path.basename(outputDir)}-tmp-`));
  try{
    safeWriteJson(path.join(tempDir,'capture.json'),bundle);
    safeWriteJson(path.join(tempDir,'candidate-set.json'),prepared);
    safeWriteJson(path.join(tempDir,'leaked-password-protection.json'),prepared.candidates.leaked_password_protection);
    safeWriteJson(path.join(tempDir,'mfa-options.json'),prepared.candidates.mfa_options);
    fs.rmSync(outputDir,{recursive:true,force:true});
    fs.renameSync(tempDir,outputDir);
    return {ok:true,output_dir:outputDir,prepared};
  }catch(error){
    try{fs.rmSync(tempDir,{recursive:true,force:true});}catch{}
    throw error;
  }
}

export async function captureAndPrepareAuthEvidenceCandidates(options={}){
  const outputDir=path.resolve(options.outputDir || process.env.YWI_AUTH_EVIDENCE_PREP_OUTPUT_DIR || 'auth-security-evidence-prepared');
  try{
    const bundle=await captureAuthSecurityManagementApi(options);
    const result=writePreparedAuthEvidenceCandidateSet(bundle,{...options,outputDir});
    return {...result,bundle};
  }catch(error){
    try{fs.rmSync(outputDir,{recursive:true,force:true});}catch{}
    return {ok:false,output_dir:outputDir,error:error instanceof Error ? error.message : String(error)};
  }
}

function readCaptureBundle(){
  const positional=process.argv.slice(2).find((arg)=>!arg.startsWith('--'));
  const inputPath=path.resolve(positional || process.env.YWI_AUTH_MANAGEMENT_CAPTURE_INPUT_PATH || 'auth-security-management-api-capture.json');
  return {inputPath,bundle:JSON.parse(fs.readFileSync(inputPath,'utf8'))};
}

function printSafeResult(result,mode,inputPath=null){
  if(!result.ok){
    console.error(`AUTH EVIDENCE CANDIDATE PREPARATION: LOCKED\n- ${result.error}`);
    process.exitCode=1;
    return;
  }
  console.log(JSON.stringify({
    ok:true,
    mode,
    input_path:inputPath,
    output_dir:result.output_dir,
    project_ref:result.prepared.project_ref,
    observed_at:result.prepared.observed_at,
    candidate_controls:result.prepared.candidate_controls,
    candidate_digests:{
      leaked_password_protection:result.prepared.candidates.leaked_password_protection.source_capture_sha256,
      mfa_options:result.prepared.candidates.mfa_options.source_capture_sha256,
    },
    boundaries:result.prepared.boundaries,
  },null,2));
  console.log('\nAUTH EVIDENCE CANDIDATE PREPARATION: PREPARED');
  console.log('No database row, Auth setting, Finance/provider control, staging rail, or Production release authority was changed.');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){
  const liveCapture=process.argv.includes('--capture') || process.env.YWI_AUTH_CAPTURE_AND_PREPARE==='true';
  if(liveCapture){
    captureAndPrepareAuthEvidenceCandidates().then((result)=>printSafeResult(result,'live_management_api_capture')).catch((error)=>{
      console.error(`AUTH EVIDENCE CANDIDATE PREPARATION: LOCKED\n- ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode=1;
    });
  }else{
    try{
      const {inputPath,bundle}=readCaptureBundle();
      const result=writePreparedAuthEvidenceCandidateSet(bundle);
      printSafeResult(result,'existing_capture_bundle',inputPath);
    }catch(error){
      console.error(`AUTH EVIDENCE CANDIDATE PREPARATION: LOCKED\n- ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode=1;
    }
  }
}
