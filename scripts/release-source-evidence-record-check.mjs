#!/usr/bin/env node
import fs from 'node:fs';
import {buildReleaseEvidenceRecordPlan,recordVerifiedReleaseSourceEvidence,EXPECTED_PROJECT_REF,RECORD_CONFIRM,VERIFICATION_CONTRACT_VERSION} from './release-source-evidence-record.mjs';
import {EXPECTED_REPOSITORY,EXPECTED_WORKFLOW} from './release-source-evidence-bundle.mjs';
import {EXPECTED_WORKFLOW_PATH} from './release-source-evidence-verify.mjs';

const migration=fs.readFileSync('sql/205_release_evidence_authorized_recording.sql','utf8');
const packageJson=fs.readFileSync('package.json','utf8');
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const handbook=fs.readFileSync('docs/ACTIVE_PROJECT_HANDBOOK.md','utf8');
const nextSteps=fs.readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
const help=fs.readFileSync('help.html','utf8');
const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});
const all=(text,parts)=>parts.every((part)=>text.includes(part));
const NOW='2026-09-05T00:40:00.000Z';
const SHA='2052052052052052052052052052052052052052';
const RUN_ID=33939990001;
const RUN_ATTEMPT=2;

function verified(overrides={}){
  const base={
    evidence_format_version:1,
    evidence_kind:'ywi_exact_main_release_source_verified',
    verification_result:'passed',
    repository:EXPECTED_REPOSITORY,
    source_branch:'main',
    source_sha:SHA,
    github_reported_main_sha:SHA,
    exact_main_sha_verified:true,
    workflow_run_id:RUN_ID,
    workflow_run_attempt:RUN_ATTEMPT,
    workflow_name:EXPECTED_WORKFLOW,
    workflow_event:'push',
    workflow_status:'completed',
    workflow_conclusion:'success',
    schema_version:205,
    branch_protection_reported:true,
    branch_policy_verified:false,
    candidate_generated_at:'2026-09-05T00:20:00.000Z',
    database_record_candidate:{
      source_branch:'main',source_sha:SHA,workflow_run_id:RUN_ID,workflow_name:EXPECTED_WORKFLOW,
      workflow_status:'passed',schema_version:205,branch_protection_reported:true,branch_policy_verified:false,
    },
    boundaries:{
      verification_only:true,database_evidence_recorded:false,production_promotion_performed:false,
      production_mutation_performed:false,provider_mutation_performed:false,
    },
    verified_at:'2026-09-05T00:30:00.000Z',
  };
  return {...base,...overrides};
}
function run(overrides={}){
  return {
    id:RUN_ID,run_attempt:RUN_ATTEMPT,name:EXPECTED_WORKFLOW,path:EXPECTED_WORKFLOW_PATH,event:'push',
    head_branch:'main',head_sha:SHA,status:'completed',conclusion:'success',repository:{full_name:EXPECTED_REPOSITORY},...overrides,
  };
}
function main(overrides={}){return {name:'main',commit:{sha:SHA},protected:true,...overrides};}
function env(overrides={}){
  return {
    YWI_RELEASE_EVIDENCE_RECORD_CONFIRM:RECORD_CONFIRM,
    YWI_PRODUCTION_PROJECT_REF:EXPECTED_PROJECT_REF,
    SUPABASE_URL:`https://${EXPECTED_PROJECT_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-role-never-print',
    GH_TOKEN:'synthetic-github-token-never-print',
    ...overrides,
  };
}

add('schema205-traceability-columns',all(migration,[
  'repository text','workflow_run_attempt integer','workflow_path text','verification_contract_version integer',
  'verified_payload_sha256 text','verified_at timestamptz','it_release_source_evidence_verified_passed_traceability_chk'
]));
add('schema205-legacy-passed-demotion',all(migration,["workflow_status='unknown'","where workflow_status='passed'",'demoted legacy passed evidence']));
add('schema205-direct-and-legacy-write-lock',all(migration,[
  'revoke insert,update,delete on table public.it_release_source_evidence from service_role;',
  'revoke execute on function public.ywi_record_release_source_evidence(text,text,bigint,text,text,integer,boolean,boolean,text,uuid) from service_role;'
]));
add('schema205-narrow-service-recorder',all(migration,[
  'create or replace function public.ywi_record_verified_release_source_evidence(',
  "'RosevearCreations/yw'","'YWI source and staging checks'","'.github/workflows/staging-browser-integration.yml'",
  "workflow_status='passed'",'p_verified_at < now()-interval \'24 hours\'',
  'grant execute on function public.ywi_record_verified_release_source_evidence'
]));
add('schema205-exact-live-schema-before-record',all(migration,[
  'v_drift is distinct from \'current\'','v_expected is distinct from p_schema_version','v_latest is distinct from p_schema_version'
]));
add('schema205-attempt-aware-idempotency',all(migration,[
  'it_release_source_evidence_run_attempt_uidx','source_sha,workflow_run_id,workflow_run_attempt',
  'on conflict(source_sha,workflow_run_id,workflow_run_attempt)'
]));
add('schema205-current-view-defensive',all(migration,[
  'create or replace view public.v_it_release_source_evidence_current',
  "e.repository='RosevearCreations/yw'","e.workflow_path='.github/workflows/staging-browser-integration.yml'",
  'e.verification_contract_version=1',"e.verified_payload_sha256 ~ '^[0-9a-f]{64}$'","then 'green'"
]));
const view=migration.slice(migration.indexOf('create or replace view public.v_it_release_source_evidence_current'));
add('schema205-view-preserves-dependent-prefix',
  view.indexOf('e.id,')<view.indexOf('e.source_branch,') &&
  view.indexOf('e.source_branch,')<view.indexOf('e.source_sha,') &&
  view.indexOf('e.source_sha,')<view.indexOf('e.workflow_run_id,') &&
  view.indexOf('e.workflow_run_id,')<view.indexOf('e.workflow_name,') &&
  view.indexOf('e.recorded_at,')<view.indexOf('e.repository,'));
add('schema205-authority-assertions',all(migration,[
  'release_evidence_direct_service_write_blocked','legacy_release_recorder_disabled','verified_release_recorder_service_only',
  'passed_release_traceability_required','open_business_acceptance_unchanged','finance_provider_execution_off'
]));
add('schema205-safety-metadata',all(migration,[
  "'database_evidence_recorded_by_migration',false","'business_rail_auto_close',false",
  "'payment_provider_mutation',false","'staging_execution',false","'production_promotion',false"
]));
add('schema205-marker',migration.includes('205 as expected_schema_version') && migration.includes("205,'205_release_evidence_authorized_recording'"));

const validPlan=buildReleaseEvidenceRecordPlan(verified(),run(),main(),env(),{now:NOW,latestSchema:205});
add('valid-record-plan',validPlan.ok && validPlan.schema_version===205 && /^[0-9a-f]{64}$/.test(validPlan.verified_payload_sha256));
add('record-confirmation-required',!buildReleaseEvidenceRecordPlan(verified(),run(),main(),env({YWI_RELEASE_EVIDENCE_RECORD_CONFIRM:''}),{now:NOW,latestSchema:205}).ok);
add('exact-production-url-required',!buildReleaseEvidenceRecordPlan(verified(),run(),main(),env({SUPABASE_URL:'https://otherproject.supabase.co'}),{now:NOW,latestSchema:205}).ok);
add('fresh-main-move-rejected',!buildReleaseEvidenceRecordPlan(verified(),run(),main({commit:{sha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}}),env(),{now:NOW,latestSchema:205}).ok);
add('fresh-unprotected-main-rejected',!buildReleaseEvidenceRecordPlan(verified(),run(),main({protected:false}),env(),{now:NOW,latestSchema:205}).ok);
add('fresh-failed-run-rejected',!buildReleaseEvidenceRecordPlan(verified(),run({conclusion:'failure'}),main(),env(),{now:NOW,latestSchema:205}).ok);
add('crossed-run-attempt-rejected',!buildReleaseEvidenceRecordPlan(verified(),run({run_attempt:3}),main(),env(),{now:NOW,latestSchema:205}).ok);
add('branch-policy-true-rejected',!buildReleaseEvidenceRecordPlan(verified({branch_policy_verified:true}),run(),main(),env(),{now:NOW,latestSchema:205}).ok);
add('schema-mismatch-rejected',!buildReleaseEvidenceRecordPlan(verified({schema_version:204}),run(),main(),env(),{now:NOW,latestSchema:205}).ok);
add('stale-final-verification-rejected',!buildReleaseEvidenceRecordPlan(verified({verified_at:'2026-09-01T00:00:00.000Z'}),run(),main(),env(),{now:NOW,latestSchema:205}).ok);

let calls=[];
const fakeFetch=async (url,options={})=>{
  calls.push({url,options});
  if(url.includes('/actions/runs/'))return {ok:true,status:200,json:async()=>run(),text:async()=>''};
  if(url.endsWith('/branches/main'))return {ok:true,status:200,json:async()=>main(),text:async()=>''};
  if(url.includes('/rpc/ywi_record_verified_release_source_evidence'))return {ok:true,status:200,json:async()=>88,text:async()=>''};
  if(url.includes('/v_it_release_source_evidence_current?'))return {ok:true,status:200,json:async()=>[{
    id:88,repository:EXPECTED_REPOSITORY,source_branch:'main',source_sha:SHA,workflow_run_id:RUN_ID,
    workflow_run_attempt:RUN_ATTEMPT,workflow_name:EXPECTED_WORKFLOW,workflow_path:EXPECTED_WORKFLOW_PATH,
    workflow_status:'passed',schema_version:205,branch_protection_reported:true,branch_policy_verified:false,
    verification_contract_version:VERIFICATION_CONTRACT_VERSION,verified_payload_sha256:validPlan.verified_payload_sha256,
    verified_at:'2026-09-05T00:30:00.000Z',source_gate_status:'green',repository_enforcement_status:'amber',
  }],text:async()=>''};
  throw new Error(`Unexpected URL ${url}`);
};
const recorded=await recordVerifiedReleaseSourceEvidence(verified(),env(),{now:NOW,latestSchema:205,fetchImpl:fakeFetch});
add('mock-fresh-github-rpc-reread',recorded.ok && recorded.write_performed && recorded.evidence_id===88 && recorded.current_source_gate_status==='green');
add('fresh-github-before-database-write',calls.length===4 && calls[0].url.includes('/actions/runs/') && calls[1].url.endsWith('/branches/main') && calls[2].url.includes('/rpc/'));
const rpcBody=JSON.parse(calls[2].options.body);
add('rpc-cannot-supply-status-or-policy',!Object.hasOwn(rpcBody,'p_workflow_status') && !Object.hasOwn(rpcBody,'p_branch_policy_verified') && rpcBody.p_verification_contract_version===1);

let lockedNetwork=false;
const locked=await recordVerifiedReleaseSourceEvidence(verified(),env({YWI_RELEASE_EVIDENCE_RECORD_CONFIRM:''}),{now:NOW,latestSchema:205,fetchImpl:async()=>{lockedNetwork=true;throw new Error('network must remain locked');}});
add('locked-plan-performs-no-network',!locked.ok && locked.write_performed===false && !lockedNetwork);

add('package-wiring',packageJson.includes('"release:evidence:record": "node scripts/release-source-evidence-record.mjs"') && packageJson.includes('"test:release-source-evidence-record": "node scripts/release-source-evidence-record-check.mjs"'));
add('workflow-wiring',workflow.includes('npm run test:release-source-evidence-record'));
add('durable-docs-current',[handbook,nextSteps].every((text)=>text.includes('release:evidence:record') && text.includes('I_CONFIRM_RELEASE_EVIDENCE_RECORD') && text.includes('fresh')));
add('help-current',help.includes('release:evidence:record') && help.includes('I_CONFIRM_RELEASE_EVIDENCE_RECORD') && help.includes('fresh'));
add('active-docs-no-build-ledger',![handbook,nextSteps].some((text)=>/Build\s+\d+|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} verified release evidence recording checks passed.`);
if(failed.length)process.exit(1);
