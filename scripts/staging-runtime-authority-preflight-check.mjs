#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateRuntimeAuthority, projectRefFromSupabaseUrl, verifyRuntimeAuthority, KNOWN_PRODUCTION_PROJECT_REF } from './staging-runtime-authority-preflight.mjs';

const STAGING_REF='stagingproj1234';
const ALLOW_ROW={project_ref:STAGING_REF,environment_class:'staging',staging_acceptance_mutation_allowed:true};
const base={actualProjectRef:STAGING_REF,expectedStagingRef:STAGING_REF,productionRef:KNOWN_PRODUCTION_PROJECT_REF};

assert.equal(projectRefFromSupabaseUrl(`https://${STAGING_REF}.supabase.co`),STAGING_REF);
assert.equal(projectRefFromSupabaseUrl('http://stagingproj1234.supabase.co'),'');

assert.equal(evaluateRuntimeAuthority({...base,rows:[ALLOW_ROW]}).ok,true,'Explicit staging authority must pass.');
assert.equal(evaluateRuntimeAuthority({...base,rows:[]}).ok,false,'Missing runtime authority must fail closed.');
assert.equal(evaluateRuntimeAuthority({...base,rows:[ALLOW_ROW,ALLOW_ROW]}).ok,false,'Duplicate authority rows must fail closed.');
assert.equal(evaluateRuntimeAuthority({...base,rows:[{...ALLOW_ROW,environment_class:'development'}]}).ok,false,'Development classification must fail closed.');
assert.equal(evaluateRuntimeAuthority({...base,rows:[{...ALLOW_ROW,staging_acceptance_mutation_allowed:false}]}).ok,false,'Explicit staging deny must fail closed.');
assert.equal(evaluateRuntimeAuthority({...base,expectedStagingRef:'differentref1234',rows:[ALLOW_ROW]}).ok,false,'Project-ref mismatch must fail closed.');
assert.equal(evaluateRuntimeAuthority({actualProjectRef:KNOWN_PRODUCTION_PROJECT_REF,expectedStagingRef:KNOWN_PRODUCTION_PROJECT_REF,productionRef:KNOWN_PRODUCTION_PROJECT_REF,rows:[{project_ref:KNOWN_PRODUCTION_PROJECT_REF,environment_class:'production',staging_acceptance_mutation_allowed:false}]}).ok,false,'Production must remain permanently denied.');

let requestedUrl='';
let requestedOptions=null;
const fakeFetch=async(url,options)=>{
  requestedUrl=String(url);
  requestedOptions=options;
  return {ok:true,status:200,json:async()=>[ALLOW_ROW]};
};
const env={
  YWI_RUN_STAGING_RPC_TESTS:'1',
  SUPABASE_URL:`https://${STAGING_REF}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY:'test-secret-never-printed',
  YWI_STAGING_PROJECT_REF:STAGING_REF,
  YWI_PRODUCTION_PROJECT_REF:KNOWN_PRODUCTION_PROJECT_REF,
  YWI_STAGING_LABEL:'staging',
  YWI_STAGING_CONFIRM:'I_CONFIRM_STAGING_ONLY',
};
const verified=await verifyRuntimeAuthority(env,fakeFetch);
assert.equal(verified.ok,true,'Verified explicit staging authority must pass.');
assert.match(requestedUrl,/it_runtime_environment_authorities\?select=project_ref,environment_class,staging_acceptance_mutation_allowed/);
assert.match(requestedUrl,new RegExp(`project_ref=eq\.${STAGING_REF}`));
assert.equal(requestedOptions?.method,'GET','Runtime authority preflight must be read-only.');
assert.equal(requestedOptions?.headers?.apikey,'test-secret-never-printed');

let networkCalls=0;
const skip=await verifyRuntimeAuthority({},async()=>{networkCalls+=1;throw new Error('should not run');});
assert.equal(skip.ok,true);
assert.equal(skip.skipped,true);
assert.equal(networkCalls,0,'Normal source CI must not contact Supabase.');

const source=fs.readFileSync('scripts/staging-runtime-authority-preflight.mjs','utf8');
const runnerEntrypoint=fs.readFileSync('scripts/operations-rpc-staging-e2e.mjs','utf8');
const runnerCore=fs.readFileSync('scripts/operations-rpc-staging-e2e-core.mjs','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');

assert.match(source,/method:'GET'/,'Preflight must use an explicit GET.');
assert.doesNotMatch(source,/method\s*:\s*['"](?:POST|PATCH|PUT|DELETE)['"]/i,'Preflight must not contain mutating HTTP methods.');
assert.doesNotMatch(source,/\/rpc\//,'Preflight must not call database RPC mutation paths.');
assert.match(source,/Runtime environment authority is not registered for this project; explicit staging registration is required\./);
assert.match(source,/environmentClass!==['"]staging['"]/);
assert.match(source,/staging_acceptance_mutation_allowed===true/);

assert.match(runnerEntrypoint,/import \{ verifyRuntimeAuthority \} from '\.\/staging-runtime-authority-preflight\.mjs';/,'Direct staging runner entrypoint must import the runtime-authority verifier.');
assert.match(runnerEntrypoint,/const authority = await verifyRuntimeAuthority\(process\.env, fetch\);/,'Direct staging runner entrypoint must verify authority itself.');
assert.match(runnerEntrypoint,/if \(!authority\.ok\)[\s\S]*process\.exit\(1\);/,'Direct staging runner entrypoint must fail closed before loading live runner implementation.');
assert.match(runnerEntrypoint,/await import\('\.\/operations-rpc-staging-e2e-core\.mjs'\);/,'Guarded entrypoint must load the existing runner implementation only after verification.');
assert.ok(
  runnerEntrypoint.indexOf('await verifyRuntimeAuthority') < runnerEntrypoint.indexOf("await import('./operations-rpc-staging-e2e-core.mjs')"),
  'Runtime authority verification must occur before the implementation is imported.'
);
assert.match(runnerCore,/ywi_rpc_start_staging_acceptance_run/,'Internal runner implementation must preserve the staging acceptance execution path.');
assert.match(runnerCore,/Refusing current-schema staging acceptance against the YardWeasels Production project ref\./,'Internal runner implementation must preserve the Production hard deny.');

assert.match(pkg.scripts?.['test:staging'] || '',/^node scripts\/staging-runtime-authority-preflight\.mjs && node scripts\/operations-rpc-staging-e2e\.mjs$/,'Live staging npm entrypoint must keep the outer registry preflight and guarded runner entrypoint.');
assert.match(pkg.scripts?.['test:staging-acceptance'] || '',/staging-runtime-authority-preflight\.mjs\s+&&\s+node scripts\/operations-rpc-staging-e2e\.mjs/,'The staging acceptance entrypoint must also keep the outer registry preflight and guarded runner entrypoint.');
assert.match(pkg.scripts?.['test:staging-environment-guard'] || '',/staging-runtime-authority-preflight-check\.mjs/,'Canonical staging guard must execute this regression.');
assert.match(workflow,/run:\s+npm run test:staging/,'Staging workflow must continue through the guarded npm entrypoint.');
assert.match(workflow,/run:\s+npm run test:staging-environment-guard/,'Canonical source gate must execute the staging environment guard.');

console.log('Build 285 embedded staging runtime authority entrypoint gate: PASS.');
