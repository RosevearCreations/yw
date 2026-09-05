#!/usr/bin/env node
/**
 * Build 215 staging-target identity preflight.
 *
 * This is intentionally source/runtime configuration validation only. It does
 * not connect to Supabase, mutate data, create fixtures, or print secrets.
 */
import { pathToFileURL } from 'node:url';

export const KNOWN_PRODUCTION_PROJECT_REF='jmqvkgiqlimdhcofwkxr';

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

export function evaluateStagingTarget(env={}){
  const configuredProductionRef=clean(env.YWI_PRODUCTION_PROJECT_REF || KNOWN_PRODUCTION_PROJECT_REF).toLowerCase();
  const productionRefs=new Set([KNOWN_PRODUCTION_PROJECT_REF,configuredProductionRef].filter(Boolean));
  const expectedRef=clean(env.YWI_STAGING_PROJECT_REF).toLowerCase();
  const actualRef=projectRefFromSupabaseUrl(env.SUPABASE_URL);
  const targetRail=clean(env.YWI_STAGING_TARGET_RAIL || env.TARGET_RAIL || 'operations_cockpit_live').toLowerCase();
  const errors=[];

  if(!truth(env.YWI_RUN_STAGING_RPC_TESTS))errors.push('YWI_RUN_STAGING_RPC_TESTS must be exactly 1.');
  if(!clean(env.SUPABASE_URL))errors.push('SUPABASE_URL is required.');
  else if(!actualRef)errors.push('SUPABASE_URL must be an https://<project-ref>.supabase.co URL.');
  if(!clean(env.SUPABASE_SERVICE_ROLE_KEY))errors.push('SUPABASE_SERVICE_ROLE_KEY is required.');
  if(!expectedRef)errors.push('YWI_STAGING_PROJECT_REF is required.');
  if(!clean(env.YWI_STAGING_JOB_ADMIN_PROFILE_ID))errors.push('YWI_STAGING_JOB_ADMIN_PROFILE_ID is required.');
  if(clean(env.YWI_STAGING_LABEL).toLowerCase()!=='staging')errors.push('YWI_STAGING_LABEL must be exactly staging.');
  if(clean(env.YWI_STAGING_CONFIRM)!=='I_CONFIRM_STAGING_ONLY')errors.push('YWI_STAGING_CONFIRM must be exactly I_CONFIRM_STAGING_ONLY.');

  if(expectedRef && productionRefs.has(expectedRef))errors.push('YWI_STAGING_PROJECT_REF must not equal any known or configured Production project ref.');
  if(actualRef && productionRefs.has(actualRef))errors.push('SUPABASE_URL resolves to a known or configured Production project and is forbidden for staging proof.');
  if(actualRef && expectedRef && actualRef!==expectedRef)errors.push('SUPABASE_URL project ref must exactly match YWI_STAGING_PROJECT_REF.');

  if(targetRail==='quote_intake_live'&&!clean(env.YWI_STAGING_PUBLIC_KEY))errors.push('YWI_STAGING_PUBLIC_KEY is required for quote_intake_live staging proof.');

  const nonProductionTarget=Boolean(actualRef && expectedRef && !productionRefs.has(actualRef) && !productionRefs.has(expectedRef));
  return {
    ok:errors.length===0,
    target_rail:targetRail,
    known_production_project_ref:KNOWN_PRODUCTION_PROJECT_REF,
    configured_production_project_ref:configuredProductionRef || KNOWN_PRODUCTION_PROJECT_REF,
    expected_staging_project_ref:expectedRef || null,
    actual_url_project_ref:actualRef || null,
    exact_project_ref_match:Boolean(actualRef && expectedRef && actualRef===expectedRef),
    non_production_target:nonProductionTarget,
    runner_enabled:truth(env.YWI_RUN_STAGING_RPC_TESTS),
    service_role_key_present:Boolean(clean(env.SUPABASE_SERVICE_ROLE_KEY)),
    admin_profile_present:Boolean(clean(env.YWI_STAGING_JOB_ADMIN_PROFILE_ID)),
    public_key_required:targetRail==='quote_intake_live',
    public_key_present:Boolean(clean(env.YWI_STAGING_PUBLIC_KEY)),
    staging_label_confirmed:clean(env.YWI_STAGING_LABEL).toLowerCase()==='staging',
    staging_phrase_confirmed:clean(env.YWI_STAGING_CONFIRM)==='I_CONFIRM_STAGING_ONLY',
    errors
  };
}

function printResult(result){
  console.log(JSON.stringify(result,null,2));
  if(!result.ok){
    console.error('\nSTAGING TARGET PREFLIGHT: LOCKED');
    for(const error of result.errors)console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('\nSTAGING TARGET PREFLIGHT: READY');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)printResult(evaluateStagingTarget(process.env));
