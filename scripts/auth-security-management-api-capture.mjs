#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  AUTH_EVIDENCE_INTAKE_VERSION,
  EXPECTED_PROJECT_REF,
  buildAuthEvidenceRecordCandidate,
} from './auth-security-evidence-intake.mjs';

export const AUTH_MANAGEMENT_API_CAPTURE_VERSION=2;
export const MANAGEMENT_API_ORIGIN='https://api.supabase.com';
export const AUTH_CONFIG_PATH=(projectRef)=>`/v1/projects/${projectRef}/config/auth`;
export const AUTH_CONFIG_URL=(projectRef)=>`${MANAGEMENT_API_ORIGIN}${AUTH_CONFIG_PATH(projectRef)}`;
export const EXPECTED_GITHUB_REPOSITORY='RosevearCreations/yw';
export const CAPTURED_AUTH_FIELDS=[
  'password_hibp_enabled',
  'mfa_totp_enroll_enabled',
  'mfa_totp_verify_enabled',
  'mfa_phone_enroll_enabled',
  'mfa_phone_verify_enabled',
  'mfa_web_authn_enroll_enabled',
  'mfa_web_authn_verify_enabled',
];

const clean=(value)=>String(value ?? '').trim();
const isPlainObject=(value)=>Boolean(value && typeof value==='object' && !Array.isArray(value));

export function normalizeWorkflowProvenance(value){
  if(value==null || value==='')return null;
  if(!isPlainObject(value))throw new Error('Workflow provenance must be a JSON object.');
  const repository=clean(value.repository);
  const runId=clean(value.run_id);
  const runAttempt=clean(value.run_attempt);
  const commitSha=clean(value.commit_sha).toLowerCase();
  if(repository!==EXPECTED_GITHUB_REPOSITORY)throw new Error(`Workflow provenance repository must equal ${EXPECTED_GITHUB_REPOSITORY}.`);
  if(!/^[1-9]\d*$/.test(runId))throw new Error('Workflow provenance run_id must be a positive integer.');
  if(!/^[1-9]\d*$/.test(runAttempt))throw new Error('Workflow provenance run_attempt must be a positive integer.');
  if(!/^[0-9a-f]{40}$/.test(commitSha))throw new Error('Workflow provenance commit_sha must be a 40-character hexadecimal SHA.');
  return {
    repository,
    run_id:runId,
    run_attempt:runAttempt,
    commit_sha:commitSha,
    event:'workflow_dispatch',
  };
}

export function workflowProvenanceFromEnv(env=process.env){
  const values={
    repository:env.YWI_AUTH_EVIDENCE_WORKFLOW_REPOSITORY,
    run_id:env.YWI_AUTH_EVIDENCE_WORKFLOW_RUN_ID,
    run_attempt:env.YWI_AUTH_EVIDENCE_WORKFLOW_RUN_ATTEMPT,
    commit_sha:env.YWI_AUTH_EVIDENCE_WORKFLOW_SHA,
  };
  if(Object.values(values).every((value)=>!clean(value)))return null;
  return normalizeWorkflowProvenance(values);
}

export function buildWorkflowEvidenceReference(value){
  const provenance=normalizeWorkflowProvenance(value);
  if(!provenance)throw new Error('Workflow provenance is required to build a workflow evidence reference.');
  return `https://github.com/${provenance.repository}/actions/runs/${provenance.run_id}/attempts/${provenance.run_attempt}`;
}

function requireBoolean(source,key){
  if(typeof source?.[key]!=='boolean')throw new Error(`Management API Auth config field ${key} must be a boolean.`);
  return source[key];
}

export function sanitizeManagementApiAuthConfig(rawConfig){
  if(!isPlainObject(rawConfig))throw new Error('Management API Auth config response must be a JSON object.');
  const sanitized={};
  for(const key of CAPTURED_AUTH_FIELDS)sanitized[key]=requireBoolean(rawConfig,key);
  return sanitized;
}

export function deriveAuthSecurityStates(sanitizedConfig){
  const passwordHibp=requireBoolean(sanitizedConfig,'password_hibp_enabled');
  const mfaPairs=[
    ['totp','mfa_totp_enroll_enabled','mfa_totp_verify_enabled'],
    ['phone','mfa_phone_enroll_enabled','mfa_phone_verify_enabled'],
    ['webauthn','mfa_web_authn_enroll_enabled','mfa_web_authn_verify_enabled'],
  ].map(([factor,enrollKey,verifyKey])=>({
    factor,
    enroll_enabled:requireBoolean(sanitizedConfig,enrollKey),
    verify_enabled:requireBoolean(sanitizedConfig,verifyKey),
  }));

  const configuredFactors=mfaPairs.filter((item)=>item.enroll_enabled && item.verify_enabled).map((item)=>item.factor);
  return {
    leaked_password_protection:passwordHibp ? 'enabled' : 'disabled',
    mfa_options:configuredFactors.length>0 ? 'configured' : 'not_configured',
    configured_mfa_factors:configuredFactors,
  };
}

function makeEvidenceReference(projectRef,observedAt){
  return `management-api://projects/${projectRef}/config/auth?observed_at=${encodeURIComponent(observedAt)}`;
}

export function buildAuthManagementApiEvidenceBundle(rawConfig,options={}){
  const projectRef=clean(options.projectRef || EXPECTED_PROJECT_REF);
  if(projectRef!==EXPECTED_PROJECT_REF)throw new Error(`projectRef must exactly equal the registered YardWeasels Production project ${EXPECTED_PROJECT_REF}.`);
  const observedAt=new Date(options.observedAt || new Date().toISOString()).toISOString();
  const sanitized=sanitizeManagementApiAuthConfig(rawConfig);
  const states=deriveAuthSecurityStates(sanitized);
  const workflowProvenance=normalizeWorkflowProvenance(options.workflowProvenance);
  const requestedReference=clean(options.evidenceReference);
  const workflowReference=workflowProvenance ? buildWorkflowEvidenceReference(workflowProvenance) : null;
  if(workflowReference && requestedReference && requestedReference!==workflowReference){
    throw new Error('Workflow-bound evidence_reference must equal the exact GitHub Actions run/attempt URL.');
  }
  const evidenceReference=requestedReference || workflowReference || makeEvidenceReference(projectRef,observedAt);
  const provenanceDetail=workflowProvenance ? {workflow_provenance:{...workflowProvenance}} : {};

  const common={
    evidence_capture_version:AUTH_EVIDENCE_INTAKE_VERSION,
    evidence_source:'supabase_management_api',
    project_ref:projectRef,
    observed_at:observedAt,
    evidence_reference:evidenceReference,
  };
  const leakedInput={
    ...common,
    control_key:'leaked_password_protection',
    observed_state:states.leaked_password_protection,
    source_capture:{
      project_ref:projectRef,
      control:'leaked_password_protection',
      password_hibp_enabled:sanitized.password_hibp_enabled,
    },
    evidence_detail:{
      capture_version:AUTH_MANAGEMENT_API_CAPTURE_VERSION,
      management_api_endpoint:AUTH_CONFIG_URL(projectRef),
      captured_field:'password_hibp_enabled',
      transport:'official_https_management_api',
      ...provenanceDetail,
    },
  };
  const mfaInput={
    ...common,
    control_key:'mfa_options',
    observed_state:states.mfa_options,
    source_capture:{
      project_ref:projectRef,
      control:'mfa_options',
      mfa_totp_enroll_enabled:sanitized.mfa_totp_enroll_enabled,
      mfa_totp_verify_enabled:sanitized.mfa_totp_verify_enabled,
      mfa_phone_enroll_enabled:sanitized.mfa_phone_enroll_enabled,
      mfa_phone_verify_enabled:sanitized.mfa_phone_verify_enabled,
      mfa_web_authn_enroll_enabled:sanitized.mfa_web_authn_enroll_enabled,
      mfa_web_authn_verify_enabled:sanitized.mfa_web_authn_verify_enabled,
    },
    evidence_detail:{
      capture_version:AUTH_MANAGEMENT_API_CAPTURE_VERSION,
      management_api_endpoint:AUTH_CONFIG_URL(projectRef),
      configured_mfa_factors:states.configured_mfa_factors,
      transport:'official_https_management_api',
      ...provenanceDetail,
    },
  };

  const intakeNow=options.intakeNow || observedAt;
  const leakedCandidate=buildAuthEvidenceRecordCandidate(leakedInput,{now:intakeNow});
  const mfaCandidate=buildAuthEvidenceRecordCandidate(mfaInput,{now:intakeNow});
  const errors=[
    ...leakedCandidate.errors.map((item)=>`leaked_password_protection: ${item}`),
    ...mfaCandidate.errors.map((item)=>`mfa_options: ${item}`),
  ];
  if(errors.length)throw new Error(`Generated Auth evidence failed the existing intake contract: ${errors.join('; ')}`);

  return {
    evidence_format_version:1,
    evidence_kind:'ywi_supabase_auth_management_api_capture',
    capture_contract_version:AUTH_MANAGEMENT_API_CAPTURE_VERSION,
    project_ref:projectRef,
    endpoint:AUTH_CONFIG_URL(projectRef),
    http_method:'GET',
    observed_at:observedAt,
    evidence_reference:evidenceReference,
    workflow_provenance:workflowProvenance,
    captured_fields:[...CAPTURED_AUTH_FIELDS],
    derived_states:{
      leaked_password_protection:states.leaked_password_protection,
      mfa_options:states.mfa_options,
      configured_mfa_factors:states.configured_mfa_factors,
    },
    intake_inputs:{
      leaked_password_protection:leakedInput,
      mfa_options:mfaInput,
    },
    intake_validation:{
      leaked_password_protection_ok:leakedCandidate.ok,
      mfa_options_ok:mfaCandidate.ok,
    },
    boundaries:{
      management_api_read_only:true,
      exact_official_endpoint_required:true,
      redirect_following_disabled:true,
      workflow_provenance_bound:Boolean(workflowProvenance),
      full_management_api_response_persisted:false,
      access_token_persisted:false,
      database_write_performed:false,
      auth_setting_mutation_performed:false,
      evidence_recording_performed:false,
      current_admin_todo_auto_closed:false,
      finance_or_provider_mutation_performed:false,
      production_promotion_performed:false,
    },
  };
}

export async function captureAuthSecurityManagementApi(options={}){
  const projectRef=clean(options.projectRef || EXPECTED_PROJECT_REF);
  if(projectRef!==EXPECTED_PROJECT_REF)throw new Error(`projectRef must exactly equal the registered YardWeasels Production project ${EXPECTED_PROJECT_REF}.`);
  const env=options.env || process.env;
  const workflowProvenance=options.workflowProvenance!==undefined
    ? normalizeWorkflowProvenance(options.workflowProvenance)
    : workflowProvenanceFromEnv(env);
  const accessToken=clean(options.accessToken ?? env.SUPABASE_ACCESS_TOKEN);
  if(!accessToken)throw new Error('SUPABASE_ACCESS_TOKEN is required for the read-only Supabase Management API capture.');
  const fetchImpl=options.fetchImpl || globalThis.fetch;
  if(typeof fetchImpl!=='function')throw new Error('A fetch implementation is required.');
  const endpoint=AUTH_CONFIG_URL(projectRef);
  const controller=new AbortController();
  const timeoutMs=Number(options.timeoutMs ?? 15000);
  const timeout=setTimeout(()=>controller.abort(),Number.isFinite(timeoutMs) && timeoutMs>0 ? timeoutMs : 15000);
  let response;
  try{
    response=await fetchImpl(endpoint,{
      method:'GET',
      headers:{
        accept:'application/json',
        authorization:`Bearer ${accessToken}`,
      },
      redirect:'error',
      signal:controller.signal,
    });
  }finally{
    clearTimeout(timeout);
  }
  if(!response || typeof response.ok!=='boolean')throw new Error('Management API returned an invalid response object.');
  if(!response.ok)throw new Error(`Supabase Management API Auth config read failed with HTTP ${response.status ?? 'unknown'}.`);
  const rawConfig=await response.json();
  return buildAuthManagementApiEvidenceBundle(rawConfig,{
    projectRef,
    observedAt:options.observedAt,
    intakeNow:options.intakeNow,
    evidenceReference:options.evidenceReference,
    workflowProvenance,
  });
}

export async function captureAndWriteAuthSecurityManagementApi(options={}){
  const outputPath=path.resolve(options.outputPath || process.env.YWI_AUTH_MANAGEMENT_CAPTURE_OUTPUT_PATH || 'auth-security-management-api-capture.json');
  try{
    const bundle=await captureAuthSecurityManagementApi(options);
    fs.writeFileSync(outputPath,`${JSON.stringify(bundle,null,2)}\n`,'utf8');
    return {ok:true,output_path:outputPath,bundle};
  }catch(error){
    try{ if(fs.existsSync(outputPath))fs.rmSync(outputPath,{force:true}); }catch{}
    return {ok:false,output_path:outputPath,error:error instanceof Error ? error.message : String(error)};
  }
}

function printSafeResult(result){
  if(!result.ok){
    console.error(`AUTH MANAGEMENT API CAPTURE: LOCKED\n- ${result.error}`);
    process.exitCode=1;
    return;
  }
  console.log(JSON.stringify({
    ok:true,
    output_path:result.output_path,
    project_ref:result.bundle.project_ref,
    endpoint:result.bundle.endpoint,
    http_method:result.bundle.http_method,
    observed_at:result.bundle.observed_at,
    derived_states:result.bundle.derived_states,
    boundaries:result.bundle.boundaries,
  },null,2));
  console.log('\nAUTH MANAGEMENT API CAPTURE: READ-ONLY EVIDENCE INPUT WRITTEN');
  console.log('No Auth setting, database row, provider, Finance control, acceptance rail, or Production release authority was changed.');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){
  captureAndWriteAuthSecurityManagementApi().then(printSafeResult).catch((error)=>{
    console.error(`AUTH MANAGEMENT API CAPTURE: LOCKED\n- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode=1;
  });
}
