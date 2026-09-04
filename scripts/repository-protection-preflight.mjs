#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const clean=(value)=>String(value ?? '').trim();

export function evaluateRepositoryProtection(env={}){
  const eventName=clean(env.YWI_GITHUB_EVENT_NAME);
  const ref=clean(env.YWI_GITHUB_REF);
  const expectedMainSha=clean(env.YWI_EXPECTED_MAIN_SHA).toLowerCase();
  const reportedMainSha=clean(env.YWI_GITHUB_MAIN_SHA).toLowerCase();
  const protectedRaw=clean(env.YWI_GITHUB_MAIN_PROTECTED);
  const errors=[];

  if(eventName!=='push')errors.push('Repository enforcement release preflight is valid only for a push event.');
  if(ref!=='refs/heads/main')errors.push('Repository enforcement release preflight is valid only for refs/heads/main.');
  if(!expectedMainSha)errors.push('YWI_EXPECTED_MAIN_SHA is required.');
  if(!reportedMainSha)errors.push('YWI_GITHUB_MAIN_SHA is required.');
  if(expectedMainSha && reportedMainSha && expectedMainSha!==reportedMainSha){
    errors.push('GitHub main branch SHA must exactly match the workflow release SHA.');
  }
  if(protectedRaw!=='true')errors.push('GitHub must report main protected=true before exact-main release authority can be green.');

  return {
    ok:errors.length===0,
    event_name:eventName || null,
    ref:ref || null,
    expected_main_sha:expectedMainSha || null,
    reported_main_sha:reportedMainSha || null,
    exact_main_sha_match:Boolean(expectedMainSha && reportedMainSha && expectedMainSha===reportedMainSha),
    main_protected:protectedRaw==='true',
    evidence_source:'GitHub REST branches/main protected field',
    errors,
  };
}

function printResult(result){
  console.log(JSON.stringify(result,null,2));
  if(!result.ok){
    console.error('\nREPOSITORY PROTECTION RELEASE PREFLIGHT: LOCKED');
    for(const error of result.errors)console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('\nREPOSITORY PROTECTION RELEASE PREFLIGHT: READY');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)printResult(evaluateRepositoryProtection(process.env));
