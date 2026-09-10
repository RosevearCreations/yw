#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildWorkflowEvidenceReference} from './auth-security-management-api-capture.mjs';
import {
  EXPECTED_PROJECT_REF,
  RECORD_CONFIRM,
  SOURCE_CONFIRM,
  EXPECTED_GITHUB_REPOSITORY,
} from './auth-security-evidence-record-core.mjs';

export const AUTH_EVIDENCE_RECORD_WORKFLOW_PREFLIGHT_VERSION=1;
export const EXPECTED_RECORD_WORKFLOW_REF='refs/heads/main';
export const EXPECTED_RECORD_WORKFLOW_EVENT='workflow_dispatch';
export const CONTROL_CANDIDATE_FILES=Object.freeze({
  leaked_password_protection:'leaked-password-protection.json',
  mfa_options:'mfa-options.json',
});

const clean=(value)=>String(value ?? '').trim();
const isObject=(value)=>Boolean(value && typeof value==='object' && !Array.isArray(value));

export function buildAuthEvidenceRecordWorkflowPlan(input={},candidate=null){
  const errors=[];
  const runId=clean(input.capture_run_id);
  const runAttempt=clean(input.capture_run_attempt);
  const controlKey=clean(input.control_key);
  const repository=clean(input.workflow_repository);
  const ref=clean(input.workflow_ref);
  const eventName=clean(input.workflow_event);
  const recordConfirm=clean(input.record_confirm);
  const sourceConfirm=clean(input.source_authenticity_confirm);

  if(!/^\d+$/.test(runId))errors.push('capture_run_id must be numeric.');
  if(!/^\d+$/.test(runAttempt))errors.push('capture_run_attempt must be numeric.');
  if(!Object.prototype.hasOwnProperty.call(CONTROL_CANDIDATE_FILES,controlKey))errors.push('control_key is not an allowed Auth evidence control.');
  if(repository!==EXPECTED_GITHUB_REPOSITORY)errors.push(`Recording workflow repository must equal ${EXPECTED_GITHUB_REPOSITORY}.`);
  if(ref!==EXPECTED_RECORD_WORKFLOW_REF)errors.push('Authorized Auth evidence recording must run from refs/heads/main.');
  if(eventName!==EXPECTED_RECORD_WORKFLOW_EVENT)errors.push('Authorized Auth evidence recording must be manually dispatched.');
  if(recordConfirm!==RECORD_CONFIRM)errors.push('Explicit Auth evidence recording confirmation is required.');
  if(sourceConfirm!==SOURCE_CONFIRM)errors.push('Explicit official-source authenticity confirmation is required.');

  let candidateVerified=false;
  let provenance=null;
  if(candidate!=null){
    if(!isObject(candidate)){
      errors.push('Decrypted Auth evidence candidate must be a JSON object.');
    }else{
      const db=isObject(candidate.database_record_candidate) ? candidate.database_record_candidate : {};
      const detail=isObject(db.evidence_detail) ? db.evidence_detail : {};
      provenance=isObject(detail.workflow_provenance) ? detail.workflow_provenance : null;

      if(candidate.evidence_kind!=='ywi_auth_security_evidence_record_candidate')errors.push('Decrypted candidate evidence_kind is invalid.');
      if(clean(candidate.project_ref).toLowerCase()!==EXPECTED_PROJECT_REF)errors.push('Decrypted candidate project_ref is not the registered YardWeasels Production project.');
      if(clean(candidate.control_key)!==controlKey)errors.push('Decrypted candidate control_key does not match the selected workflow control.');
      if(clean(candidate.evidence_source)!=='supabase_management_api')errors.push('Workflow recording accepts only the Management API capture artifact path.');
      if(candidate?.boundaries?.database_write_performed!==false)errors.push('Decrypted candidate must prove intake performed no database write.');
      if(candidate?.boundaries?.auth_setting_mutation_performed!==false)errors.push('Decrypted candidate must prove capture/intake performed no Auth setting mutation.');
      if(!isObject(candidate.workflow_content_binding))errors.push('Decrypted workflow candidate must retain its cryptographic content binding.');

      if(!provenance){
        errors.push('Decrypted candidate is missing workflow provenance.');
      }else{
        const provenanceRunId=clean(provenance.run_id);
        const provenanceAttempt=clean(provenance.run_attempt);
        const provenanceRepository=clean(provenance.repository);
        const provenanceSha=clean(provenance.commit_sha).toLowerCase();
        if(provenanceRepository!==EXPECTED_GITHUB_REPOSITORY)errors.push('Decrypted candidate provenance repository mismatch.');
        if(provenanceRunId!==runId)errors.push('Decrypted candidate capture run id does not match the selected artifact run.');
        if(provenanceAttempt!==runAttempt)errors.push('Decrypted candidate capture run attempt does not match the selected artifact attempt.');
        if(!/^[0-9a-f]{40}$/.test(provenanceSha))errors.push('Decrypted candidate provenance commit SHA is invalid.');
        try{
          const expectedReference=buildWorkflowEvidenceReference({
            repository:provenanceRepository,
            run_id:provenanceRunId,
            run_attempt:provenanceAttempt,
            commit_sha:provenanceSha,
          });
          if(clean(candidate.evidence_reference)!==expectedReference)errors.push('Decrypted candidate evidence reference does not match its exact capture run/attempt provenance.');
        }catch(error){
          errors.push(`Decrypted candidate workflow provenance is invalid: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      candidateVerified=errors.length===0;
    }
  }

  return {
    ok:errors.length===0,
    errors,
    version:AUTH_EVIDENCE_RECORD_WORKFLOW_PREFLIGHT_VERSION,
    capture_run_id:runId,
    capture_run_attempt:runAttempt,
    control_key:controlKey,
    candidate_filename:CONTROL_CANDIDATE_FILES[controlKey] || null,
    repository,
    ref,
    event:eventName,
    explicit_record_confirmation:recordConfirm===RECORD_CONFIRM,
    explicit_source_authenticity_confirmation:sourceConfirm===SOURCE_CONFIRM,
    candidate_checked:candidate!=null,
    candidate_verified:candidate!=null ? candidateVerified : false,
    candidate_provenance_sha:provenance ? clean(provenance.commit_sha).toLowerCase() : null,
    boundaries:{
      network_call_performed:false,
      artifact_download_performed:false,
      artifact_decryption_performed:false,
      database_write_performed:false,
      auth_setting_mutation_performed:false,
    },
  };
}

function inputFromEnv(){
  return {
    capture_run_id:process.env.YWI_AUTH_EVIDENCE_CAPTURE_RUN_ID,
    capture_run_attempt:process.env.YWI_AUTH_EVIDENCE_CAPTURE_RUN_ATTEMPT,
    control_key:process.env.YWI_AUTH_EVIDENCE_CONTROL_KEY,
    workflow_repository:process.env.YWI_AUTH_EVIDENCE_RECORD_WORKFLOW_REPOSITORY,
    workflow_ref:process.env.YWI_AUTH_EVIDENCE_RECORD_WORKFLOW_REF,
    workflow_event:process.env.YWI_AUTH_EVIDENCE_RECORD_WORKFLOW_EVENT,
    record_confirm:process.env.YWI_AUTH_EVIDENCE_RECORD_CONFIRM,
    source_authenticity_confirm:process.env.YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM,
  };
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){
  try{
    const candidatePath=process.argv.find((arg,index)=>index>1 && arg!=='--input-only') || null;
    const candidate=candidatePath ? JSON.parse(fs.readFileSync(path.resolve(candidatePath),'utf8')) : null;
    const result=buildAuthEvidenceRecordWorkflowPlan(inputFromEnv(),candidate);
    console.log(JSON.stringify({
      ok:result.ok,
      version:result.version,
      capture_run_id:result.capture_run_id,
      capture_run_attempt:result.capture_run_attempt,
      control_key:result.control_key,
      candidate_filename:result.candidate_filename,
      candidate_checked:result.candidate_checked,
      candidate_verified:result.candidate_verified,
      explicit_record_confirmation:result.explicit_record_confirmation,
      explicit_source_authenticity_confirmation:result.explicit_source_authenticity_confirmation,
      boundaries:result.boundaries,
      errors:result.errors,
    },null,2));
    if(!result.ok){
      console.error('\nAUTH EVIDENCE RECORD WORKFLOW PREFLIGHT: LOCKED');
      for(const error of result.errors)console.error(`- ${error}`);
      process.exitCode=1;
    }else{
      console.log(`\nAUTH EVIDENCE RECORD WORKFLOW PREFLIGHT: ${candidate ? 'CANDIDATE BOUND' : 'AUTHORIZED INPUTS VERIFIED'}`);
    }
  }catch(error){
    console.error(`AUTH EVIDENCE RECORD WORKFLOW PREFLIGHT: LOCKED\n- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode=1;
  }
}
