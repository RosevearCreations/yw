#!/usr/bin/env node
import fs from 'node:fs';
import {buildAuthEvidenceRecordCandidate} from './auth-security-evidence-intake.mjs';
import {expectedArtifactName,runArtifactsUrl} from './auth-security-evidence-artifact-verify.mjs';
import {
  attachWorkflowCandidateContentBinding,
  expectedContentBindingArtifactName,
} from './auth-security-evidence-content-binding.mjs';
import {
  buildAuthEvidenceRecordPlan,
  recordAuthEvidenceCandidate,
  EXPECTED_CAPTURE_BRANCH,
  EXPECTED_CAPTURE_WORKFLOW_PATH,
  EXPECTED_GITHUB_REPOSITORY,
  EXPECTED_PROJECT_REF,
  RECORD_CONFIRM,
  SOURCE_CONFIRM,
  verifyWorkflowProvenanceBeforeRecord,
  workflowRunAttemptApiUrl,
} from './auth-security-evidence-record.mjs';

const migration=fs.readFileSync('sql/203_auth_evidence_authorized_recording.sql','utf8');
const lockMigration=fs.readFileSync('sql/204_auth_evidence_direct_write_lock.sql','utf8');
const packageJson=fs.readFileSync('package.json','utf8');
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const handbook=fs.readFileSync('docs/ACTIVE_PROJECT_HANDBOOK.md','utf8');
const nextSteps=fs.readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
const help=fs.readFileSync('help.html','utf8');
const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});
const all=(text,parts)=>parts.every((part)=>text.includes(part));
const NOW='2026-09-05T00:20:00.000Z';
const WORKFLOW_RUN_ID='34300000000';
const WORKFLOW_ATTEMPT='1';
const WORKFLOW_SHA='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const WORKFLOW_REFERENCE=`https://github.com/${EXPECTED_GITHUB_REPOSITORY}/actions/runs/${WORKFLOW_RUN_ID}/attempts/${WORKFLOW_ATTEMPT}`;
const MANAGEMENT_ENDPOINT=`https://api.supabase.com/v1/projects/${EXPECTED_PROJECT_REF}/config/auth`;
const GITHUB_REPOSITORY_ID=1148400822;
const ARTIFACT_ID=998877;
const ARTIFACT_DIGEST=`sha256:${'c'.repeat(64)}`;
const ARTIFACT_NAME=expectedArtifactName(WORKFLOW_RUN_ID,WORKFLOW_ATTEMPT);
const ARTIFACTS_API_URL=runArtifactsUrl(WORKFLOW_RUN_ID);
const BINDING_NONCE='11'.repeat(32);
const BINDING_ARTIFACT_ID=998878;
const BINDING_ARTIFACT_DIGEST=`sha256:${'d'.repeat(64)}`;

function workflowProvenance(overrides={}){
  return {
    repository:EXPECTED_GITHUB_REPOSITORY,
    run_id:WORKFLOW_RUN_ID,
    run_attempt:WORKFLOW_ATTEMPT,
    commit_sha:WORKFLOW_SHA,
    event:'workflow_dispatch',
    ...overrides,
  };
}

function input(overrides={}){
  return {
    evidence_capture_version:1,
    control_key:'leaked_password_protection',
    evidence_source:'supabase_management_api',
    project_ref:EXPECTED_PROJECT_REF,
    observed_state:'enabled',
    observed_at:'2026-09-05T00:10:00.000Z',
    evidence_reference:WORKFLOW_REFERENCE,
    evidence_detail:{
      capture_version:2,
      management_api_endpoint:MANAGEMENT_ENDPOINT,
      captured_field:'password_hibp_enabled',
      transport:'official_https_management_api',
      workflow_provenance:workflowProvenance(),
    },
    source_capture:{project_ref:EXPECTED_PROJECT_REF,control:'leaked_password_protection',password_hibp_enabled:true},
    ...overrides,
  };
}

function candidate(overrides={}){
  const result=buildAuthEvidenceRecordCandidate(input(overrides),{now:NOW});
  if(!result.ok)throw new Error(`Fixture intake failed: ${result.errors.join('; ')}`);
  return attachWorkflowCandidateContentBinding(structuredClone(result.candidate),{nonce:BINDING_NONCE});
}

function env(overrides={}){
  return {
    YWI_AUTH_EVIDENCE_RECORD_CONFIRM:RECORD_CONFIRM,
    YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM:SOURCE_CONFIRM,
    YWI_PRODUCTION_PROJECT_REF:EXPECTED_PROJECT_REF,
    SUPABASE_URL:`https://${EXPECTED_PROJECT_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key-never-print',
    ...overrides,
  };
}

function validWorkflowRun(overrides={}){
  return {
    id:Number(WORKFLOW_RUN_ID),
    run_attempt:Number(WORKFLOW_ATTEMPT),
    head_sha:WORKFLOW_SHA,
    head_branch:EXPECTED_CAPTURE_BRANCH,
    event:'workflow_dispatch',
    path:EXPECTED_CAPTURE_WORKFLOW_PATH,
    status:'completed',
    conclusion:'success',
    repository:{id:GITHUB_REPOSITORY_ID,full_name:EXPECTED_GITHUB_REPOSITORY},
    head_repository:{id:GITHUB_REPOSITORY_ID,full_name:EXPECTED_GITHUB_REPOSITORY},
    ...overrides,
  };
}

function workflowArtifactShape(overrides={}){
  return {
    id:Number(WORKFLOW_RUN_ID),
    repository_id:GITHUB_REPOSITORY_ID,
    head_repository_id:GITHUB_REPOSITORY_ID,
    head_branch:EXPECTED_CAPTURE_BRANCH,
    head_sha:WORKFLOW_SHA,
    ...overrides,
  };
}

function validArtifact(overrides={}){
  return {
    id:ARTIFACT_ID,
    name:ARTIFACT_NAME,
    size_in_bytes:4120,
    expired:false,
    digest:ARTIFACT_DIGEST,
    created_at:'2026-09-05T00:12:00Z',
    workflow_run:workflowArtifactShape(),
    ...overrides,
  };
}

function validBindingArtifact(boundCandidate,overrides={}){
  const commitment=boundCandidate.workflow_content_binding.commitment_sha256;
  return {
    id:BINDING_ARTIFACT_ID,
    name:expectedContentBindingArtifactName(WORKFLOW_RUN_ID,WORKFLOW_ATTEMPT,boundCandidate.control_key,commitment),
    size_in_bytes:74,
    expired:false,
    digest:BINDING_ARTIFACT_DIGEST,
    created_at:'2026-09-05T00:12:10Z',
    workflow_run:workflowArtifactShape(),
    ...overrides,
  };
}

add('schema203-traceability-columns',all(migration,[
  'source_project_ref text','source_capture_sha256 text','recording_contract_version integer',
  'it_auth_security_evidence_authoritative_traceability_chk',"source_capture_sha256 ~ '^[0-9a-f]{64}$'",'recording_contract_version=1'
]));
add('schema203-service-private-rpc',all(migration,[
  'create or replace function public.ywi_record_auth_security_evidence(',"v_source not in ('supabase_dashboard','supabase_management_api')",
  "a.environment_class='production'","p_observed_at < now()-interval '30 days'","p_observed_at > now()+interval '5 minutes'",
  'grant execute on function public.ywi_record_auth_security_evidence','to service_role;'
]));
add('schema203-derived-status',all(migration,[
  "if v_state='enabled' then v_status:='verified_secure'","elsif v_state='disabled' then v_status:='verified_followup'",
  "if v_state='configured' then v_status:='verified_secure'","elsif v_state='not_configured' then v_status:='verified_followup'",
  "v_expires_at := p_observed_at + interval '30 days'"
]));
add('schema203-idempotent-capture',all(migration,[
  'it_auth_security_evidence_capture_uidx','on conflict(control_key,evidence_source,source_project_ref,source_capture_sha256)',
  'where source_capture_sha256 is not null'
]));
add('schema203-defense-in-depth-current-view',all(migration,[
  'create or replace view public.v_it_auth_security_evidence_current',"l.source_capture_sha256 !~ '^[0-9a-f]{64}$'",
  'l.recording_contract_version<>1',"a.project_ref=l.source_project_ref and a.environment_class='production'","then 'verified_secure'"
]));
add('schema203-assertions-and-safety',all(migration,[
  'authoritative_traceability_required','authorized_recording_service_private','auth_evidence_authority_service_private',
  'open_business_acceptance_unchanged','finance_provider_execution_off',"'auth_setting_mutation',false",
  "'external_evidence_fabrication',false","'business_rail_auto_close',false","'staging_execution',false","'production_promotion',false"
]));
add('schema203-marker',migration.includes('203 as expected_schema_version') && /values\s*\(\s*203\s*,\s*'203_auth_evidence_authorized_recording'/i.test(migration));
add('schema204-direct-table-write-lock',all(lockMigration,[
  'revoke insert,update on table public.it_auth_security_evidence from service_role;',
  'grant select on table public.it_auth_security_evidence to service_role;',
  'direct_service_table_write_blocked','authorized_recording_rpc_service_only',
  "not has_table_privilege('service_role','public.it_auth_security_evidence','insert')",
  "not has_table_privilege('service_role','public.it_auth_security_evidence','update')",'ywi_auth_security_recording_access_assertions'
]));
add('schema204-safety',all(lockMigration,[
  'open_business_acceptance_unchanged','finance_provider_execution_off',"'direct_service_table_insert',false",
  "'direct_service_table_update',false","'auth_setting_mutation',false","'production_promotion',false"
]));
add('schema204-marker',lockMigration.includes('204 as expected_schema_version') && /values\s*\(\s*204\s*,\s*'204_auth_evidence_direct_write_lock'/i.test(lockMigration));

const validCandidate=candidate();
const validBindingArtifactValue=validBindingArtifact(validCandidate);
const validPlan=buildAuthEvidenceRecordPlan(validCandidate,env(),{now:NOW});
add('valid-record-plan',validPlan.ok && validPlan.errors.length===0 && validPlan.expected_current_status==='verified_secure');
add('workflow-provenance-normalized-in-plan',validPlan.workflow_provenance?.repository===EXPECTED_GITHUB_REPOSITORY && validPlan.workflow_provenance?.run_id===WORKFLOW_RUN_ID && validPlan.workflow_provenance?.run_attempt===WORKFLOW_ATTEMPT && validPlan.workflow_provenance?.commit_sha===WORKFLOW_SHA);
add('workflow-content-binding-revalidated-in-plan',validPlan.workflow_content_binding?.verified===true && validPlan.workflow_content_binding?.commitment_sha256===validCandidate.workflow_content_binding.commitment_sha256);
add('explicit-record-confirmation-required',!buildAuthEvidenceRecordPlan(validCandidate,env({YWI_AUTH_EVIDENCE_RECORD_CONFIRM:''}),{now:NOW}).ok);
add('explicit-source-confirmation-required',!buildAuthEvidenceRecordPlan(validCandidate,env({YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM:''}),{now:NOW}).ok);
add('exact-production-url-required',!buildAuthEvidenceRecordPlan(validCandidate,env({SUPABASE_URL:'https://differentproject.supabase.co'}),{now:NOW}).ok);

const unbound=structuredClone(validCandidate);
delete unbound.workflow_content_binding;
add('workflow-candidate-without-content-binding-rejected',!buildAuthEvidenceRecordPlan(unbound,env(),{now:NOW}).ok);
const tamperedBinding=structuredClone(validCandidate);
tamperedBinding.observed_state='disabled';
add('candidate-content-change-invalidates-binding',!buildAuthEvidenceRecordPlan(tamperedBinding,env(),{now:NOW}).ok);
const tampered=structuredClone(validCandidate);
tampered.database_record_candidate.verification_status='verified_followup';
add('tampered-derived-status-rejected',!buildAuthEvidenceRecordPlan(tampered,env(),{now:NOW}).ok);
const tamperedReference=structuredClone(validCandidate);
tamperedReference.evidence_reference=`https://github.com/${EXPECTED_GITHUB_REPOSITORY}/actions/runs/${WORKFLOW_RUN_ID}/attempts/2`;
tamperedReference.database_record_candidate.evidence_reference=tamperedReference.evidence_reference;
add('tampered-workflow-reference-rejected',!buildAuthEvidenceRecordPlan(tamperedReference,env(),{now:NOW}).ok);
const tamperedEndpoint=structuredClone(validCandidate);
tamperedEndpoint.database_record_candidate.evidence_detail.management_api_endpoint='https://api.supabase.com/v1/projects/not-yardweasels/config/auth';
add('tampered-management-endpoint-rejected',!buildAuthEvidenceRecordPlan(tamperedEndpoint,env(),{now:NOW}).ok);
const tamperedTransport=structuredClone(validCandidate);
tamperedTransport.database_record_candidate.evidence_detail.transport='copied_text';
add('tampered-management-transport-rejected',!buildAuthEvidenceRecordPlan(tamperedTransport,env(),{now:NOW}).ok);
const missingProvenance=structuredClone(validCandidate);
delete missingProvenance.database_record_candidate.evidence_detail.workflow_provenance;
add('github-reference-without-provenance-rejected',!buildAuthEvidenceRecordPlan(missingProvenance,env(),{now:NOW}).ok);

const manualInput=input({
  evidence_reference:`management-api://projects/${EXPECTED_PROJECT_REF}/config/auth?observed_at=${encodeURIComponent('2026-09-05T00:10:00.000Z')}`,
  evidence_detail:{capture_version:2,management_api_endpoint:MANAGEMENT_ENDPOINT,captured_field:'password_hibp_enabled',transport:'official_https_management_api'},
});
const manualResult=buildAuthEvidenceRecordCandidate(manualInput,{now:NOW});
const manualPlan=buildAuthEvidenceRecordPlan(manualResult.candidate,env(),{now:NOW});
add('non-workflow-management-api-path-remains-explicitly-confirmed',manualResult.ok && manualPlan.ok && manualPlan.workflow_provenance===null && manualPlan.workflow_content_binding?.verified===false);

const staleCandidate=structuredClone(validCandidate);
staleCandidate.observed_at='2026-07-01T00:00:00.000Z';
staleCandidate.database_record_candidate.observed_at=staleCandidate.observed_at;
add('stale-candidate-rejected-at-recording',!buildAuthEvidenceRecordPlan(staleCandidate,env(),{now:NOW}).ok);

const provenanceApiUrl=workflowRunAttemptApiUrl(workflowProvenance());
add('workflow-attempt-api-url-exact',provenanceApiUrl===`https://api.github.com/repos/${EXPECTED_GITHUB_REPOSITORY}/actions/runs/${WORKFLOW_RUN_ID}/attempts/${WORKFLOW_ATTEMPT}`);
add('artifact-api-url-exact',ARTIFACTS_API_URL===`https://api.github.com/repos/${EXPECTED_GITHUB_REPOSITORY}/actions/runs/${WORKFLOW_RUN_ID}/artifacts?per_page=100` && ARTIFACT_NAME===`ywi-auth-security-evidence-${WORKFLOW_RUN_ID}-${WORKFLOW_ATTEMPT}`);
add('content-binding-artifact-name-bound',validBindingArtifactValue.name.includes(validCandidate.workflow_content_binding.commitment_sha256) && !validBindingArtifactValue.name.includes(BINDING_NONCE));

let calls=[];
const fakeFetch=async (url,options={})=>{
  calls.push({url,options});
  if(url===provenanceApiUrl)return {ok:true,status:200,json:async()=>validWorkflowRun(),text:async()=>''};
  if(url===ARTIFACTS_API_URL)return {ok:true,status:200,json:async()=>({total_count:2,artifacts:[validArtifact(),validBindingArtifactValue]}),text:async()=>''};
  if(url.includes('/rpc/ywi_record_auth_security_evidence'))return {ok:true,status:200,json:async()=>77,text:async()=>''};
  if(url.includes('/v_it_auth_security_evidence_current?'))return {ok:true,status:200,json:async()=>[{
    evidence_id:77,control_key:'leaked_password_protection',current_status:'verified_secure',source_project_ref:EXPECTED_PROJECT_REF,
    source_capture_sha256:validCandidate.source_capture_sha256,recording_contract_version:1,
  }]};
  throw new Error(`Unexpected URL: ${url}`);
};

const verified=await verifyWorkflowProvenanceBeforeRecord(workflowProvenance(),WORKFLOW_REFERENCE,{fetchImpl:fakeFetch});
add('direct-workflow-provenance-verification',verified.verified && verified.read_performed && verified.workflow_path===EXPECTED_CAPTURE_WORKFLOW_PATH && verified.head_branch===EXPECTED_CAPTURE_BRANCH && verified.head_repository===EXPECTED_GITHUB_REPOSITORY);
calls=[];
const recorded=await recordAuthEvidenceCandidate(validCandidate,env(),{now:NOW,fetchImpl:fakeFetch});
add('mock-record-and-reread',recorded.ok && recorded.write_performed && recorded.evidence_id===77 && recorded.current_status==='verified_secure');
add('workflow-and-artifact-read-before-rpc-before-reread',calls.length===4 && calls[0].url===provenanceApiUrl && calls[1].url===ARTIFACTS_API_URL && calls[2].url.endsWith('/rest/v1/rpc/ywi_record_auth_security_evidence') && calls[3].url.includes('/rest/v1/v_it_auth_security_evidence_current?'));
add('workflow-provenance-verified-before-write',recorded.workflow_provenance_verified===true && recorded.workflow_provenance_read_performed===true);
add('artifact-verified-before-write',recorded.auth_capture_artifact_verified===true && recorded.auth_capture_artifact_metadata_reads===2 && recorded.auth_capture_artifact_id===ARTIFACT_ID && recorded.auth_capture_artifact_digest===ARTIFACT_DIGEST);
add('content-binding-marker-verified-before-write',recorded.auth_capture_content_binding_verified===true && recorded.auth_capture_content_binding_commitment===validCandidate.workflow_content_binding.commitment_sha256 && recorded.auth_capture_content_binding_marker_artifact_id===BINDING_ARTIFACT_ID);
const rpcBody=JSON.parse(calls[2].options.body);
add('rpc-body-derived-not-operator-status',rpcBody.p_observed_state==='enabled' && !Object.prototype.hasOwnProperty.call(rpcBody,'p_verification_status'));
add('rpc-body-records-live-github-verification',rpcBody.p_evidence_detail?.workflow_provenance_verification?.verified===true && rpcBody.p_evidence_detail?.workflow_provenance_verification?.verification_source==='github_actions_api' && rpcBody.p_evidence_detail?.workflow_provenance_verification?.commit_sha===WORKFLOW_SHA && rpcBody.p_evidence_detail?.workflow_provenance_verification?.head_branch===EXPECTED_CAPTURE_BRANCH && rpcBody.p_evidence_detail?.workflow_provenance_verification?.head_repository===EXPECTED_GITHUB_REPOSITORY);
add('rpc-body-records-artifact-binding',rpcBody.p_evidence_detail?.auth_capture_artifact_verification?.verified===true && rpcBody.p_evidence_detail?.auth_capture_artifact_verification?.artifact_id===ARTIFACT_ID && rpcBody.p_evidence_detail?.auth_capture_artifact_verification?.artifact_name===ARTIFACT_NAME && rpcBody.p_evidence_detail?.auth_capture_artifact_verification?.artifact_digest===ARTIFACT_DIGEST && rpcBody.p_evidence_detail?.auth_capture_artifact_verification?.artifact_expired===false && rpcBody.p_evidence_detail?.auth_capture_artifact_verification?.artifact_download_performed===false && rpcBody.p_evidence_detail?.auth_capture_artifact_verification?.artifact_decryption_performed===false);
add('rpc-body-records-content-binding-without-nonce',rpcBody.p_evidence_detail?.auth_capture_content_binding_verification?.verified===true && rpcBody.p_evidence_detail?.auth_capture_content_binding_verification?.commitment_sha256===validCandidate.workflow_content_binding.commitment_sha256 && rpcBody.p_evidence_detail?.auth_capture_content_binding_verification?.marker_artifact_id===BINDING_ARTIFACT_ID && rpcBody.p_evidence_detail?.auth_capture_content_binding_verification?.candidate_nonce_persisted===false && !JSON.stringify(rpcBody.p_evidence_detail).includes(BINDING_NONCE));

async function assertBlockedBeforeSupabase(name,runOverride,artifactFactory,errorText){
  let supabaseCalled=false;
  let rejected=false;
  try{
    await recordAuthEvidenceCandidate(validCandidate,env(),{now:NOW,fetchImpl:async (url)=>{
      if(url===provenanceApiUrl)return {ok:true,status:200,json:async()=>validWorkflowRun(runOverride),text:async()=>''};
      if(url===ARTIFACTS_API_URL)return {ok:true,status:200,json:async()=>artifactFactory(),text:async()=>''};
      if(url.includes('.supabase.co'))supabaseCalled=true;
      throw new Error('Supabase must not be called after failed Auth provenance verification.');
    }});
  }catch(error){rejected=String(error?.message || error).includes(errorText);}
  add(name,rejected && !supabaseCalled);
}

await assertBlockedBeforeSupabase('live-github-sha-mismatch-blocks-recording',{head_sha:'b'.repeat(40)},()=>({total_count:0,artifacts:[]}),'Workflow head SHA mismatch');
await assertBlockedBeforeSupabase('live-github-non-main-branch-blocks-recording',{head_branch:'build999-untrusted-auth-capture'},()=>({total_count:0,artifacts:[]}),'canonical main');
await assertBlockedBeforeSupabase('live-github-head-repository-mismatch-blocks-recording',{head_repository:{id:123,full_name:'example/fork'}},()=>({total_count:0,artifacts:[]}),'head repository mismatch');
await assertBlockedBeforeSupabase('missing-capture-artifact-blocks-recording',{},()=>({total_count:1,artifacts:[validBindingArtifactValue]}),'Expected exactly one');
await assertBlockedBeforeSupabase('missing-content-binding-marker-blocks-recording',{},()=>({total_count:1,artifacts:[validArtifact()]}),'content-binding marker artifact');
await assertBlockedBeforeSupabase('expired-capture-artifact-blocks-recording',{},()=>({total_count:2,artifacts:[validArtifact({expired:true}),validBindingArtifactValue]}),'artifact is expired');
await assertBlockedBeforeSupabase('invalid-artifact-digest-blocks-recording',{},()=>({total_count:2,artifacts:[validArtifact({digest:'md5:not-allowed'}),validBindingArtifactValue]}),'SHA-256 digest');
await assertBlockedBeforeSupabase('expired-content-binding-marker-blocks-recording',{},()=>({total_count:2,artifacts:[validArtifact(),validBindingArtifact(validCandidate,{expired:true})]}),'content-binding marker artifact is expired');
await assertBlockedBeforeSupabase('invalid-content-binding-marker-digest-blocks-recording',{},()=>({total_count:2,artifacts:[validArtifact(),validBindingArtifact(validCandidate,{digest:'md5:not-allowed'})]}),'content-binding marker artifact must expose a GitHub SHA-256 digest');

let lockedFetchCalled=false;
const locked=await recordAuthEvidenceCandidate(validCandidate,env({YWI_AUTH_EVIDENCE_RECORD_CONFIRM:''}),{now:NOW,fetchImpl:async()=>{lockedFetchCalled=true;throw new Error('must not call');}});
add('locked-plan-performs-no-network-write',!locked.ok && locked.write_performed===false && locked.auth_capture_artifact_verified===false && locked.auth_capture_content_binding_verified===false && !lockedFetchCalled);

add('package-wiring',packageJson.includes('"auth:evidence:record": "node scripts/auth-security-evidence-record.mjs"') && packageJson.includes('"test:auth-security-evidence-record": "node scripts/auth-security-evidence-record-check.mjs"'));
add('workflow-wiring',workflow.includes('npm run test:auth-security-evidence-record'));
add('durable-docs-current',[handbook,nextSteps].every((text)=>text.includes('auth:evidence:record') && text.includes('I_CONFIRM_AUTH_EVIDENCE_RECORD') && text.includes('service-role')));
add('help-current',help.includes('auth:evidence:record') && help.includes('I_CONFIRM_AUTH_EVIDENCE_RECORD') && help.includes('re-read'));
add('active-docs-no-build-ledger',![handbook,nextSteps].some((text)=>/Build\s+\d+|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} Auth evidence authorized recording checks passed.`);
if(failed.length)process.exit(1);
