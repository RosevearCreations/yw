#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateStagingTarget, KNOWN_PRODUCTION_PROJECT_REF, STAGING_ACCEPTANCE_RAILS } from './staging-target-preflight.mjs';

const runner=fs.readFileSync('scripts/operations-rpc-staging-e2e-core.mjs','utf8');
const base={
  YWI_RUN_STAGING_RPC_TESTS:'1',
  SUPABASE_URL:'https://stagingprojectref.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'service-role-secret-value',
  YWI_STAGING_PROJECT_REF:'stagingprojectref',
  YWI_STAGING_JOB_ADMIN_PROFILE_ID:'11111111-1111-4111-8111-111111111111',
  YWI_STAGING_JOB_ADMIN_JWT:'job-admin-jwt-secret-value',
  YWI_STAGING_WORKER_JWT:'worker-jwt-secret-value',
  YWI_STAGING_LABEL:'staging',
  YWI_STAGING_CONFIRM:'I_CONFIRM_STAGING_ONLY',
  YWI_STAGING_TARGET_RAIL:'operations_cockpit_live',
  YWI_PRODUCTION_PROJECT_REF:KNOWN_PRODUCTION_PROJECT_REF,
};

const checks=[];
const check=(name,fn)=>{
  try{fn();checks.push({name,ok:true});}
  catch(error){checks.push({name,ok:false,error:error?.message || String(error)});}
};

check('valid-operations-nonproduction-target-is-ready',()=>{
  const result=evaluateStagingTarget(base);
  assert.equal(result.ok,true);
  assert.equal(result.target_rail,'operations_cockpit_live');
  assert.equal(result.target_rail_supported,true);
  assert.equal(result.actual_url_project_ref,'stagingprojectref');
  assert.equal(result.expected_staging_project_ref,'stagingprojectref');
  assert.equal(result.exact_project_ref_match,true);
  assert.equal(result.non_production_target,true);
  assert.equal(result.operations_identity_pair_required,true);
  assert.equal(result.job_admin_jwt_present,true);
  assert.equal(result.worker_jwt_present,true);
  assert.deepEqual(result.missing_secret_inputs,[]);
});

check('operations-job-admin-jwt-is-required-before-ready',()=>{
  const result=evaluateStagingTarget({...base,YWI_STAGING_JOB_ADMIN_JWT:''});
  assert.equal(result.ok,false);
  assert.equal(result.operations_identity_pair_required,true);
  assert.equal(result.job_admin_jwt_present,false);
  assert.equal(result.worker_jwt_present,true);
  assert(result.errors.some((value)=>value.includes('YWI_STAGING_JOB_ADMIN_JWT')));
  assert(result.missing_secret_inputs.includes('YWI_STAGING_JOB_ADMIN_JWT'));
});

check('operations-worker-jwt-is-required-before-ready',()=>{
  const result=evaluateStagingTarget({...base,YWI_STAGING_WORKER_JWT:''});
  assert.equal(result.ok,false);
  assert.equal(result.operations_identity_pair_required,true);
  assert.equal(result.job_admin_jwt_present,true);
  assert.equal(result.worker_jwt_present,false);
  assert(result.errors.some((value)=>value.includes('YWI_STAGING_WORKER_JWT')));
  assert(result.missing_secret_inputs.includes('YWI_STAGING_WORKER_JWT'));
});

check('operations-preflight-matches-live-runner-identity-contract',()=>{
  assert(runner.includes("const jobAdminJwt = String(process.env.YWI_STAGING_JOB_ADMIN_JWT || '').trim();"));
  assert(runner.includes("const workerJwt = String(process.env.YWI_STAGING_WORKER_JWT || '').trim();"));
  assert(runner.includes("targetRail === 'operations_cockpit_live' && (!jobAdminJwt || !workerJwt)"));
  assert(runner.includes('Operations Cockpit evidence requires both YWI_STAGING_JOB_ADMIN_JWT and YWI_STAGING_WORKER_JWT.'));
});

check('preflight-target-rails-match-current-live-runner-set',()=>{
  for(const rail of STAGING_ACCEPTANCE_RAILS)assert(runner.includes(`'${rail}'`),rail);
  assert.equal(STAGING_ACCEPTANCE_RAILS.length,6);
});

check('unsupported-target-rail-is-denied-before-runner',()=>{
  const result=evaluateStagingTarget({...base,YWI_STAGING_TARGET_RAIL:'future_unregistered_rail'});
  assert.equal(result.ok,false);
  assert.equal(result.target_rail_supported,false);
  assert(result.errors.some((value)=>value.includes('YWI_STAGING_TARGET_RAIL must be one of')));
});

check('production-url-is-denied-even-with-nonproduction-staging-ref',()=>{
  const result=evaluateStagingTarget({...base,SUPABASE_URL:`https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`});
  assert.equal(result.ok,false);
  assert(result.errors.some((value)=>value.includes('Production project')));
  assert(result.errors.some((value)=>value.includes('exactly match')));
});

check('production-staging-ref-is-denied',()=>{
  const result=evaluateStagingTarget({...base,YWI_STAGING_PROJECT_REF:KNOWN_PRODUCTION_PROJECT_REF});
  assert.equal(result.ok,false);
  assert(result.errors.some((value)=>value.includes('known or configured Production')));
});

check('known-production-ref-cannot-be-hidden-by-configured-production-override',()=>{
  const result=evaluateStagingTarget({
    ...base,
    YWI_PRODUCTION_PROJECT_REF:'some-other-production-ref',
    SUPABASE_URL:`https://${KNOWN_PRODUCTION_PROJECT_REF}.supabase.co`,
    YWI_STAGING_PROJECT_REF:KNOWN_PRODUCTION_PROJECT_REF,
  });
  assert.equal(result.ok,false);
  assert.equal(result.non_production_target,false);
  assert(result.errors.filter((value)=>value.includes('Production')).length>=2);
});

check('configured-production-ref-is-also-denied',()=>{
  const configured='secondary-production-ref';
  const result=evaluateStagingTarget({
    ...base,
    YWI_PRODUCTION_PROJECT_REF:configured,
    SUPABASE_URL:`https://${configured}.supabase.co`,
    YWI_STAGING_PROJECT_REF:configured,
  });
  assert.equal(result.ok,false);
  assert.equal(result.non_production_target,false);
});

check('crossed-url-and-ref-secret-set-is-denied',()=>{
  const result=evaluateStagingTarget({...base,SUPABASE_URL:'https://differentprojectref.supabase.co'});
  assert.equal(result.ok,false);
  assert.equal(result.exact_project_ref_match,false);
  assert(result.errors.some((value)=>value.includes('must exactly match')));
});

check('malformed-or-non-supabase-url-is-denied',()=>{
  for(const value of ['not-a-url','http://stagingprojectref.supabase.co','https://example.com']){
    const result=evaluateStagingTarget({...base,SUPABASE_URL:value});
    assert.equal(result.ok,false,value);
    assert(result.errors.some((message)=>message.includes('https://<project-ref>.supabase.co')));
  }
});

check('runner-label-confirmation-and-required-identities-are-fail-closed',()=>{
  const result=evaluateStagingTarget({
    ...base,
    YWI_RUN_STAGING_RPC_TESTS:'0',
    SUPABASE_SERVICE_ROLE_KEY:'',
    YWI_STAGING_JOB_ADMIN_PROFILE_ID:'',
    YWI_STAGING_JOB_ADMIN_JWT:'',
    YWI_STAGING_WORKER_JWT:'',
    YWI_STAGING_LABEL:'production',
    YWI_STAGING_CONFIRM:'',
  });
  assert.equal(result.ok,false);
  assert(result.errors.length>=7);
});

check('quote-intake-requires-public-key-not-operations-role-jwts',()=>{
  const result=evaluateStagingTarget({
    ...base,
    YWI_STAGING_TARGET_RAIL:'quote_intake_live',
    YWI_STAGING_JOB_ADMIN_JWT:'',
    YWI_STAGING_WORKER_JWT:'',
    YWI_STAGING_PUBLIC_KEY:'',
  });
  assert.equal(result.ok,false);
  assert.equal(result.operations_identity_pair_required,false);
  assert.equal(result.public_key_required,true);
  assert.equal(result.required_secret_inputs.includes('YWI_STAGING_JOB_ADMIN_JWT'),false);
  assert.equal(result.required_secret_inputs.includes('YWI_STAGING_WORKER_JWT'),false);
  assert(result.errors.some((value)=>value.includes('YWI_STAGING_PUBLIC_KEY')));
});

check('quote-intake-with-public-key-is-ready',()=>{
  const result=evaluateStagingTarget({
    ...base,
    YWI_STAGING_TARGET_RAIL:'quote_intake_live',
    YWI_STAGING_JOB_ADMIN_JWT:'',
    YWI_STAGING_WORKER_JWT:'',
    YWI_STAGING_PUBLIC_KEY:'anon-public-key',
  });
  assert.equal(result.ok,true);
  assert.equal(result.public_key_required,true);
  assert.equal(result.public_key_present,true);
});

check('result-never-echoes-secret-values',()=>{
  const publicSecret='public-secret-shaped-value';
  const result=evaluateStagingTarget({...base,YWI_STAGING_PUBLIC_KEY:publicSecret});
  const text=JSON.stringify(result);
  for(const secret of [base.SUPABASE_SERVICE_ROLE_KEY,base.YWI_STAGING_JOB_ADMIN_JWT,base.YWI_STAGING_WORKER_JWT,publicSecret]){
    assert.equal(text.includes(secret),false);
  }
  assert.equal(text.includes('service_role_key_present'),true);
  assert.equal(text.includes('job_admin_jwt_present'),true);
  assert.equal(text.includes('worker_jwt_present'),true);
  assert.equal(text.includes('public_key_present'),true);
});

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.error?` — ${item.error}`:''}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} staging target preflight checks passed.`);
if(failed.length)process.exit(1);