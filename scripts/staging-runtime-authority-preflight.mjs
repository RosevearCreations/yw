#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export const KNOWN_PRODUCTION_PROJECT_REF='jmqvkgiqlimdhcofwkxr';

const clean=(value)=>String(value ?? '').trim();

export function projectRefFromSupabaseUrl(value){
  try{
    const url=new URL(clean(value));
    if(url.protocol!=='https:')return '';
    const match=url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1]?.toLowerCase() || '';
  }catch{return '';}
}

export function evaluateRuntimeAuthority({actualProjectRef,expectedStagingRef,productionRef=KNOWN_PRODUCTION_PROJECT_REF,rows=[]}={}){
  const actual=clean(actualProjectRef).toLowerCase();
  const expected=clean(expectedStagingRef).toLowerCase();
  const production=clean(productionRef || KNOWN_PRODUCTION_PROJECT_REF).toLowerCase();
  const list=Array.isArray(rows)?rows:[];
  const errors=[];

  if(!actual)errors.push('The Supabase URL project ref could not be resolved.');
  if(!expected)errors.push('YWI_STAGING_PROJECT_REF is required.');
  if(actual && expected && actual!==expected)errors.push('SUPABASE_URL project ref must exactly match YWI_STAGING_PROJECT_REF.');
  if(actual && actual===KNOWN_PRODUCTION_PROJECT_REF)errors.push('The known YardWeasels Production project is permanently denied for staging acceptance.');
  if(expected && expected===KNOWN_PRODUCTION_PROJECT_REF)errors.push('YWI_STAGING_PROJECT_REF must not equal the known YardWeasels Production project.');
  if(actual && production && actual===production)errors.push('The configured Production project is denied for staging acceptance.');
  if(expected && production && expected===production)errors.push('The configured Production project cannot be used as YWI_STAGING_PROJECT_REF.');

  if(list.length!==1){
    errors.push(list.length===0
      ? 'Runtime environment authority is not registered for this project; explicit staging registration is required.'
      : 'Runtime environment authority lookup must return exactly one row for the staging project.');
  }

  const authority=list.length===1 && list[0] && typeof list[0]==='object' ? list[0] : null;
  const rowRef=clean(authority?.project_ref).toLowerCase();
  const environmentClass=clean(authority?.environment_class).toLowerCase();
  const mutationAllowed=authority?.staging_acceptance_mutation_allowed===true;

  if(authority){
    if(!rowRef || rowRef!==actual || rowRef!==expected)errors.push('Runtime authority row is not bound to the exact staging project ref.');
    if(environmentClass!=='staging')errors.push('Runtime authority must classify the target project as staging.');
    if(!mutationAllowed)errors.push('Runtime authority has not explicitly allowed staging acceptance mutation.');
  }

  return {
    ok:errors.length===0,
    authority_present:Boolean(authority),
    project_ref:actual || null,
    expected_staging_project_ref:expected || null,
    environment_class:environmentClass || null,
    staging_acceptance_mutation_allowed:mutationAllowed,
    errors,
  };
}

export async function verifyRuntimeAuthority(env=process.env,fetchImpl=fetch){
  if(clean(env.YWI_RUN_STAGING_RPC_TESTS)!=='1'){
    return {ok:true,skipped:true,reason:'Live staging RPC tests are not enabled.'};
  }

  const url=clean(env.SUPABASE_URL).replace(/\/$/,'');
  const key=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  const expectedStagingRef=clean(env.YWI_STAGING_PROJECT_REF).toLowerCase();
  const productionRef=clean(env.YWI_PRODUCTION_PROJECT_REF || KNOWN_PRODUCTION_PROJECT_REF).toLowerCase();
  const label=clean(env.YWI_STAGING_LABEL).toLowerCase();
  const confirmation=clean(env.YWI_STAGING_CONFIRM);
  const actualProjectRef=projectRefFromSupabaseUrl(url);

  const configErrors=[];
  if(!url)configErrors.push('SUPABASE_URL is required.');
  if(!key)configErrors.push('SUPABASE_SERVICE_ROLE_KEY is required.');
  if(label!=='staging')configErrors.push('YWI_STAGING_LABEL must be exactly staging.');
  if(confirmation!=='I_CONFIRM_STAGING_ONLY')configErrors.push('YWI_STAGING_CONFIRM must be exactly I_CONFIRM_STAGING_ONLY.');
  if(!expectedStagingRef)configErrors.push('YWI_STAGING_PROJECT_REF is required.');
  if(!actualProjectRef)configErrors.push('SUPABASE_URL must resolve to an https://<project-ref>.supabase.co host.');
  if(configErrors.length)return {ok:false,skipped:false,errors:configErrors};

  const preliminary=evaluateRuntimeAuthority({
    actualProjectRef,
    expectedStagingRef,
    productionRef,
    rows:[{project_ref:actualProjectRef,environment_class:'staging',staging_acceptance_mutation_allowed:true}],
  });
  if(!preliminary.ok){
    return {...preliminary,skipped:false,authority_present:false,environment_class:null,staging_acceptance_mutation_allowed:false};
  }

  const endpoint=`${url}/rest/v1/it_runtime_environment_authorities?select=project_ref,environment_class,staging_acceptance_mutation_allowed&project_ref=eq.${encodeURIComponent(actualProjectRef)}&limit=2`;
  let response;
  try{
    response=await fetchImpl(endpoint,{
      method:'GET',
      headers:{
        apikey:key,
        authorization:`Bearer ${key}`,
        Accept:'application/json',
      },
    });
  }catch(error){
    return {ok:false,skipped:false,errors:[`Runtime authority read failed before staging mutation: ${String(error?.message || error || 'network error')}`]};
  }
  if(!response?.ok){
    return {ok:false,skipped:false,errors:[`Runtime authority read returned HTTP ${Number(response?.status || 0) || 'error'} before staging mutation.`]};
  }

  let rows;
  try{rows=await response.json();}
  catch{return {ok:false,skipped:false,errors:['Runtime authority response was not valid JSON.']};}

  return {...evaluateRuntimeAuthority({actualProjectRef,expectedStagingRef,productionRef,rows}),skipped:false};
}

async function main(){
  const result=await verifyRuntimeAuthority(process.env,fetch);
  if(result.skipped){
    console.log(`SKIP staging runtime authority preflight — ${result.reason}`);
    return;
  }
  if(!result.ok){
    console.error('STAGING RUNTIME AUTHORITY: LOCKED');
    for(const error of result.errors || [])console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log(JSON.stringify({
    ok:true,
    project_ref:result.project_ref,
    environment_class:result.environment_class,
    staging_acceptance_mutation_allowed:result.staging_acceptance_mutation_allowed,
  },null,2));
  console.log('STAGING RUNTIME AUTHORITY: READY');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)await main();
