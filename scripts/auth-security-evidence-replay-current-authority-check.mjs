#!/usr/bin/env node
import fs from 'node:fs';
import {
  EXPECTED_PROJECT_REF,
  authEvidenceCurrentAuthorityUrl,
  recordAuthEvidenceCandidateWithCurrentAuthority,
  verifyExactReplayCurrentAuthority,
} from './auth-security-evidence-record.mjs';

const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});
const CAPTURE_SHA='a'.repeat(64);
const URL=`https://${EXPECTED_PROJECT_REF}.supabase.co`;
const CONTROL='leaked_password_protection';
const currentUrl=authEvidenceCurrentAuthorityUrl(URL,CONTROL);
const env={SUPABASE_URL:URL,SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key-never-print'};

const replayResult={
  ok:true,
  write_performed:false,
  replay_precheck_performed:true,
  replay_disposition:'exact_replay_noop',
  replay_existing_evidence_id:77,
  evidence_id:77,
  control_key:CONTROL,
  current_status:'verified_secure',
  source_project_ref:EXPECTED_PROJECT_REF,
  source_capture_sha256:CAPTURE_SHA,
  recording_contract_version:1,
};
const currentRow={
  evidence_id:77,
  control_key:CONTROL,
  current_status:'verified_secure',
  source_project_ref:EXPECTED_PROJECT_REF,
  source_capture_sha256:CAPTURE_SHA,
  recording_contract_version:1,
};

add('current-authority-url-targets-service-private-current-view',
  currentUrl.startsWith(`${URL}/rest/v1/v_it_auth_security_evidence_current?`) &&
  currentUrl.includes('control_key=eq.leaked_password_protection') &&
  !currentUrl.includes('/rpc/'));

let calls=[];
const verified=await verifyExactReplayCurrentAuthority(replayResult,env,{fetchImpl:async (url,options={})=>{
  calls.push({url,options});
  return {ok:true,status:200,json:async()=>[currentRow],text:async()=>''};
}});
add('exact-replay-current-row-is-attested',verified.verified && verified.read_performed && verified.evidence_id===77 && verified.current_status==='verified_secure' && calls.length===1 && calls[0].url===currentUrl && calls[0].options.method==='GET');
add('current-authority-attestation-uses-no-write-method',calls.every((call)=>call.options.method==='GET'));

let wrappedCalls=[];
const wrapped=await recordAuthEvidenceCandidateWithCurrentAuthority({},env,{
  recordImpl:async()=>({...replayResult}),
  fetchImpl:async (url,options={})=>{
    wrappedCalls.push({url,options});
    return {ok:true,status:200,json:async()=>[currentRow],text:async()=>''};
  },
});
add('operational-wrapper-requires-current-authority-on-replay',wrapped.ok && wrapped.write_performed===false && wrapped.replay_current_authority_verified===true && wrapped.replay_current_authority_read_performed===true && wrapped.replay_current_authority_evidence_id===77 && wrappedCalls.length===1);

let historicalRejected=false;
let historicalRpcCalled=false;
try{
  await recordAuthEvidenceCandidateWithCurrentAuthority({},env,{
    recordImpl:async()=>({...replayResult}),
    fetchImpl:async (url,options={})=>{
      if(String(url).includes('/rpc/'))historicalRpcCalled=true;
      return {ok:true,status:200,json:async()=>[{...currentRow,evidence_id:88,source_capture_sha256:'b'.repeat(64)}],text:async()=>''};
    },
  });
}catch(error){historicalRejected=String(error?.message || error).includes('historical or superseded');}
add('historical-or-superseded-replay-fails-closed',historicalRejected && !historicalRpcCalled);

let statusMismatchRejected=false;
try{
  await verifyExactReplayCurrentAuthority(replayResult,env,{fetchImpl:async()=>({
    ok:true,status:200,json:async()=>[{...currentRow,current_status:'verified_followup'}],text:async()=>''
  })});
}catch(error){statusMismatchRejected=String(error?.message || error).includes('status mismatch');}
add('current-authority-status-mismatch-fails-closed',statusMismatchRejected);

let digestMismatchRejected=false;
try{
  await verifyExactReplayCurrentAuthority(replayResult,env,{fetchImpl:async()=>({
    ok:true,status:200,json:async()=>[{...currentRow,source_capture_sha256:'c'.repeat(64)}],text:async()=>''
  })});
}catch(error){digestMismatchRejected=String(error?.message || error).includes('capture digest mismatch');}
add('current-authority-digest-mismatch-fails-closed',digestMismatchRejected);

let readFailureRejected=false;
try{
  await verifyExactReplayCurrentAuthority(replayResult,env,{fetchImpl:async()=>({
    ok:false,status:503,json:async()=>({}),text:async()=>'synthetic current-authority outage'
  })});
}catch(error){readFailureRejected=String(error?.message || error).includes('current-authority verification failed (503)');}
add('current-authority-read-failure-fails-closed',readFailureRejected);

let invalidShapeRejected=false;
try{
  await verifyExactReplayCurrentAuthority(replayResult,env,{fetchImpl:async()=>({
    ok:true,status:200,json:async()=>[],text:async()=>''
  })});
}catch(error){invalidShapeRejected=String(error?.message || error).includes('exactly one control authority row');}
add('missing-current-authority-row-fails-closed',invalidShapeRejected);

let nonReplayFetchCalled=false;
const nonReplay=await recordAuthEvidenceCandidateWithCurrentAuthority({},env,{
  recordImpl:async()=>({ok:true,write_performed:true,replay_disposition:'new_capture',evidence_id:90}),
  fetchImpl:async()=>{nonReplayFetchCalled=true;throw new Error('wrapper must not add a second read to new-capture path');},
});
add('new-capture-path-keeps-core-post-write-authority-check-only',nonReplay.ok && nonReplay.write_performed===true && nonReplay.replay_current_authority_verified===false && nonReplay.replay_current_authority_read_performed===false && !nonReplayFetchCalled);

let lockedFetchCalled=false;
const locked=await recordAuthEvidenceCandidateWithCurrentAuthority({},env,{
  recordImpl:async()=>({ok:false,errors:['synthetic lock'],write_performed:false,replay_disposition:'not_checked'}),
  fetchImpl:async()=>{lockedFetchCalled=true;throw new Error('locked path must not read current authority');},
});
add('locked-path-adds-no-network-read',locked.ok===false && locked.write_performed===false && locked.replay_current_authority_verified===false && !lockedFetchCalled);

let wrongProjectRejected=false;
try{
  await verifyExactReplayCurrentAuthority(replayResult,{...env,SUPABASE_URL:'https://differentproject.supabase.co'},{fetchImpl:async()=>{throw new Error('must fail before fetch');}});
}catch(error){wrongProjectRejected=String(error?.message || error).includes('registered YardWeasels Production Supabase URL');}
add('production-project-binding-rechecked-before-current-read',wrongProjectRejected);

const wrapperSource=fs.readFileSync('scripts/auth-security-evidence-record.mjs','utf8');
const coreSource=fs.readFileSync('scripts/auth-security-evidence-record-core.mjs','utf8');
add('direct-cli-uses-current-authority-wrapper',wrapperSource.includes('recordAuthEvidenceCandidateWithCurrentAuthority(candidate)') && wrapperSource.includes('VERIFIED CURRENT REPLAY NO-OP'));
add('build270-core-preserved-behind-wrapper',coreSource.includes("disposition:'exact_replay_noop'") && coreSource.includes('Authorized Auth evidence RPC failed'));
add('wrapper-adds-no-rpc-or-post-mutation-path',!wrapperSource.includes('/rpc/ywi_record_auth_security_evidence') && !wrapperSource.includes("method:'POST'") && !wrapperSource.includes('method:"POST"'));
add('wrapper-does-not-print-service-key',!wrapperSource.includes('console.log(serviceKey)') && !wrapperSource.includes('console.error(serviceKey)'));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} Build 271 Auth replay current-authority checks passed.`);
if(failed.length)process.exit(1);
