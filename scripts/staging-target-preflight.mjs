#!/usr/bin/env node
/**
 * Build 288 staging-target preflight.
 *
 * The pure evaluateStagingTarget() helper validates only local configuration so
 * source tests can stay network-free. The executable staging:preflight command
 * now goes further: it must prove explicit registered staging runtime authority
 * and exact current-schema parity before it may report READY. It never mutates
 * Supabase and never prints secret values.
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { verifyRuntimeAuthority } from './staging-runtime-authority-preflight.mjs';

export const KNOWN_PRODUCTION_PROJECT_REF='jmqvkgiqlimdhcofwkxr';
export const STAGING_ACCEPTANCE_RAILS=Object.freeze([
  'operations_cockpit_live',
  'quote_intake_live',
  'live_job_updates',
  'customer_live_update_notifications',
  'service_execution_proof_costing',
  'supervisor_closeout_signoff_invoice_followup',
]);

const clean=(value)=>String(value ?? '').trim();
const truth=(value)=>clean(value)==='1';

export function projectRefFromSupabaseUrl(value){
  try{
    const url=new URL(clean(value));
    if(url.protocol!=='https:')return '';
    const match=url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1]?.toLowerCase() || '';
  }catch{return '';}
}

export function repositorySchemaVersion(){
  const versions=fs.readdirSync('sql')
    .filter((name)=>/^\d{3}_.+\.sql$/i.test(name))
    .map((name)=>Number(name.slice(0,3)))
    .filter(Number.isFinite);
  return versions.length ? Math.max(...versions) : 0;
}

export function evaluateStagingTarget(env={}){
  const configuredProductionRef=clean(env.YWI_PRODUCTION_PROJECT_REF || KNOWN_PRODUCTION_PROJECT_REF).toLowerCase();
  const productionRefs=new Set([KNOWN_PRODUCTION_PROJECT_REF,configuredProductionRef].filter(Boolean));
  const expectedRef=clean(env.YWI_STAGING_PROJECT_REF).toLowerCase();
  const actualRef=projectRefFromSupabaseUrl(env.SUPABASE_URL);
  const targetRail=clean(env.YWI_STAGING_TARGET_RAIL || env.TARGET_RAIL || 'operations_cockpit_live').toLowerCase();
  const targetRailSupported=STAGING_ACCEPTANCE_RAILS.includes(targetRail);
  const operationsIdentityPairRequired=targetRail==='operations_cockpit_live';
  const publicKeyRequired=targetRail==='quote_intake_live';
  const serviceRoleKeyPresent=Boolean(clean(env.SUPABASE_SERVICE_ROLE_KEY));
  const jobAdminJwtPresent=Boolean(clean(env.YWI_STAGING_JOB_ADMIN_JWT));
  const workerJwtPresent=Boolean(clean(env.YWI_STAGING_WORKER_JWT));
  const publicKeyPresent=Boolean(clean(env.YWI_STAGING_PUBLIC_KEY));
  const errors=[];

  if(!truth(env.YWI_RUN_STAGING_RPC_TESTS))errors.push('YWI_RUN_STAGING_RPC_TESTS must be exactly 1.');
  if(!clean(env.SUPABASE_URL))errors.push('SUPABASE_URL is required.');
  else if(!actualRef)errors.push('SUPABASE_URL must be an https://<project-ref>.supabase.co URL.');
  if(!serviceRoleKeyPresent)errors.push('SUPABASE_SERVICE_ROLE_KEY is required.');
  if(!expectedRef)errors.push('YWI_STAGING_PROJECT_REF is required.');
  if(!clean(env.YWI_STAGING_JOB_ADMIN_PROFILE_ID))errors.push('YWI_STAGING_JOB_ADMIN_PROFILE_ID is required.');
  if(clean(env.YWI_STAGING_LABEL).toLowerCase()!=='staging')errors.push('YWI_STAGING_LABEL must be exactly staging.');
  if(clean(env.YWI_STAGING_CONFIRM)!=='I_CONFIRM_STAGING_ONLY')errors.push('YWI_STAGING_CONFIRM must be exactly I_CONFIRM_STAGING_ONLY.');
  if(!targetRailSupported)errors.push(`YWI_STAGING_TARGET_RAIL must be one of: ${STAGING_ACCEPTANCE_RAILS.join(', ')}.`);

  if(expectedRef && productionRefs.has(expectedRef))errors.push('YWI_STAGING_PROJECT_REF must not equal any known or configured Production project ref.');
  if(actualRef && productionRefs.has(actualRef))errors.push('SUPABASE_URL resolves to a known or configured Production project and is forbidden for staging proof.');
  if(actualRef && expectedRef && actualRef!==expectedRef)errors.push('SUPABASE_URL project ref must exactly match YWI_STAGING_PROJECT_REF.');

  if(operationsIdentityPairRequired && !jobAdminJwtPresent)errors.push('YWI_STAGING_JOB_ADMIN_JWT is required for operations_cockpit_live staging proof.');
  if(operationsIdentityPairRequired && !workerJwtPresent)errors.push('YWI_STAGING_WORKER_JWT is required for operations_cockpit_live staging proof.');
  if(publicKeyRequired && !publicKeyPresent)errors.push('YWI_STAGING_PUBLIC_KEY is required for quote_intake_live staging proof.');

  const nonProductionTarget=Boolean(actualRef && expectedRef && !productionRefs.has(actualRef) && !productionRefs.has(expectedRef));
  const requiredSecretInputs=[
    'SUPABASE_SERVICE_ROLE_KEY',
    ...(operationsIdentityPairRequired?['YWI_STAGING_JOB_ADMIN_JWT','YWI_STAGING_WORKER_JWT']:[]),
    ...(publicKeyRequired?['YWI_STAGING_PUBLIC_KEY']:[]),
  ];
  const missingSecretInputs=requiredSecretInputs.filter((name)=>!clean(env[name]));

  return {
    ok:errors.length===0,
    target_rail:targetRail,
    target_rail_supported:targetRailSupported,
    supported_target_rails:[...STAGING_ACCEPTANCE_RAILS],
    known_production_project_ref:KNOWN_PRODUCTION_PROJECT_REF,
    configured_production_project_ref:configuredProductionRef || KNOWN_PRODUCTION_PROJECT_REF,
    expected_staging_project_ref:expectedRef || null,
    actual_url_project_ref:actualRef || null,
    exact_project_ref_match:Boolean(actualRef && expectedRef && actualRef===expectedRef),
    non_production_target:nonProductionTarget,
    runner_enabled:truth(env.YWI_RUN_STAGING_RPC_TESTS),
    service_role_key_present:serviceRoleKeyPresent,
    admin_profile_present:Boolean(clean(env.YWI_STAGING_JOB_ADMIN_PROFILE_ID)),
    operations_identity_pair_required:operationsIdentityPairRequired,
    job_admin_jwt_present:jobAdminJwtPresent,
    worker_jwt_present:workerJwtPresent,
    public_key_required:publicKeyRequired,
    public_key_present:publicKeyPresent,
    required_secret_inputs:requiredSecretInputs,
    missing_secret_inputs:missingSecretInputs,
    staging_label_confirmed:clean(env.YWI_STAGING_LABEL).toLowerCase()==='staging',
    staging_phrase_confirmed:clean(env.YWI_STAGING_CONFIRM)==='I_CONFIRM_STAGING_ONLY',
    errors
  };
}

function runtimeAuthoritySummary(authority){
  return authority ? {
    authority_present:authority.authority_present===true,
    project_ref:authority.project_ref || null,
    environment_class:authority.environment_class || null,
    staging_acceptance_mutation_allowed:authority.staging_acceptance_mutation_allowed===true,
  } : null;
}

async function verifySchemaAuthority(env,fetchImpl){
  const repoLatestSchema=repositorySchemaVersion();
  if(!Number.isInteger(repoLatestSchema) || repoLatestSchema<1){
    return {ok:false,exact_schema_match:false,repository_schema_version:repoLatestSchema || null,errors:['Could not determine the current repository schema version.']};
  }
  const url=clean(env.SUPABASE_URL).replace(/\/$/,'');
  const key=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  const endpoint=`${url}/rest/v1/v_schema_drift_status?select=expected_schema_version,latest_applied_schema_version,drift_status&limit=2`;
  let response;
  try{
    response=await fetchImpl(endpoint,{
      method:'GET',
      headers:{apikey:key,authorization:`Bearer ${key}`,Accept:'application/json'},
    });
  }catch(error){
    return {ok:false,exact_schema_match:false,repository_schema_version:repoLatestSchema,errors:[`Runtime schema authority read failed before staging execution: ${String(error?.message || error || 'network error')}`]};
  }
  if(!response?.ok){
    return {ok:false,exact_schema_match:false,repository_schema_version:repoLatestSchema,errors:[`Runtime schema authority read returned HTTP ${Number(response?.status || 0) || 'error'} before staging execution.`]};
  }
  let rows;
  try{rows=await response.json();}
  catch{return {ok:false,exact_schema_match:false,repository_schema_version:repoLatestSchema,errors:['Runtime schema authority response was not valid JSON.']};}
  if(!Array.isArray(rows) || rows.length!==1){
    return {ok:false,exact_schema_match:false,repository_schema_version:repoLatestSchema,errors:['Runtime schema authority must return exactly one current-schema row.']};
  }
  const row=rows[0] || {};
  const expectedSchema=Number(row.expected_schema_version || 0);
  const latestAppliedSchema=Number(row.latest_applied_schema_version || 0);
  const driftStatus=clean(row.drift_status).toLowerCase();
  const exact=driftStatus==='current' && expectedSchema===repoLatestSchema && latestAppliedSchema===repoLatestSchema;
  return {
    ok:exact,
    exact_schema_match:exact,
    repository_schema_version:repoLatestSchema,
    expected_schema_version:expectedSchema || null,
    latest_applied_schema_version:latestAppliedSchema || null,
    drift_status:driftStatus || null,
    errors:exact?[]:[`Dedicated staging database must exactly match repository Schema ${repoLatestSchema} before staging execution.`],
  };
}

export async function verifyStagingTargetRuntime(env={},fetchImpl=fetch){
  const configuration=evaluateStagingTarget(env);
  if(!configuration.ok){
    return {ok:false,configuration,runtime_authority:null,schema_authority:null,errors:[...configuration.errors]};
  }

  const authority=await verifyRuntimeAuthority(env,fetchImpl);
  if(authority?.skipped || authority?.ok!==true){
    const authorityErrors=authority?.errors?.length ? authority.errors : [authority?.reason || 'Explicit staging runtime authority could not be proven.'];
    return {
      ok:false,
      configuration,
      runtime_authority:runtimeAuthoritySummary(authority),
      schema_authority:null,
      errors:authorityErrors,
    };
  }
  if(authority.project_ref!==configuration.actual_url_project_ref || authority.environment_class!=='staging' || authority.staging_acceptance_mutation_allowed!==true){
    return {
      ok:false,
      configuration,
      runtime_authority:runtimeAuthoritySummary(authority),
      schema_authority:null,
      errors:['Runtime authority did not return an explicit staging allow for this exact target project.'],
    };
  }

  const schemaAuthority=await verifySchemaAuthority(env,fetchImpl);
  if(!schemaAuthority.ok){
    return {
      ok:false,
      configuration,
      runtime_authority:runtimeAuthoritySummary(authority),
      schema_authority:schemaAuthority,
      errors:[...(schemaAuthority.errors || [])],
    };
  }

  return {
    ok:true,
    configuration,
    runtime_authority:runtimeAuthoritySummary(authority),
    schema_authority:schemaAuthority,
    errors:[],
  };
}

function printResult(result){
  console.log(JSON.stringify(result,null,2));
  if(!result.ok){
    console.error('\nSTAGING TARGET PREFLIGHT: LOCKED');
    for(const error of result.errors || [])console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('\nSTAGING TARGET CONFIGURATION: READY');
  console.log('STAGING RUNTIME AUTHORITY: READY');
  console.log(`STAGING SCHEMA AUTHORITY: CURRENT (Schema ${result.schema_authority.repository_schema_version})`);
  console.log('STAGING TARGET PREFLIGHT: READY');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)printResult(await verifyStagingTargetRuntime(process.env,fetch));
