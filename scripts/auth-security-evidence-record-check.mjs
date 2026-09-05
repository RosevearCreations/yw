#!/usr/bin/env node
import fs from 'node:fs';
import {buildAuthEvidenceRecordCandidate} from './auth-security-evidence-intake.mjs';
import {buildAuthEvidenceRecordPlan,recordAuthEvidenceCandidate,EXPECTED_PROJECT_REF,RECORD_CONFIRM,SOURCE_CONFIRM} from './auth-security-evidence-record.mjs';

const migration=fs.readFileSync('sql/203_auth_evidence_authorized_recording.sql','utf8');
const packageJson=fs.readFileSync('package.json','utf8');
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const handbook=fs.readFileSync('docs/ACTIVE_PROJECT_HANDBOOK.md','utf8');
const nextSteps=fs.readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
const help=fs.readFileSync('help.html','utf8');
const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});
const all=(text,parts)=>parts.every((part)=>text.includes(part));
const NOW='2026-09-05T00:20:00.000Z';

function input(overrides={}){
  return {
    evidence_capture_version:1,
    control_key:'leaked_password_protection',
    evidence_source:'supabase_management_api',
    project_ref:EXPECTED_PROJECT_REF,
    observed_state:'enabled',
    observed_at:'2026-09-05T00:10:00.000Z',
    evidence_reference:'management-api://projects/current/auth/settings#password-security',
    evidence_detail:{observation_scope:'password-security'},
    source_capture:{project_ref:EXPECTED_PROJECT_REF,leaked_password_protection:true},
    ...overrides,
  };
}

function candidate(overrides={}){
  const result=buildAuthEvidenceRecordCandidate(input(overrides),{now:NOW});
  if(!result.ok)throw new Error(`Fixture intake failed: ${result.errors.join('; ')}`);
  return structuredClone(result.candidate);
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

add('schema203-traceability-columns',all(migration,[
  'source_project_ref text',
  'source_capture_sha256 text',
  'recording_contract_version integer',
  'it_auth_security_evidence_authoritative_traceability_chk',
  "source_capture_sha256 ~ '^[0-9a-f]{64}$'",
  'recording_contract_version=1'
]));
add('schema203-service-private-rpc',all(migration,[
  'create or replace function public.ywi_record_auth_security_evidence(',
  "v_source not in ('supabase_dashboard','supabase_management_api')",
  "a.environment_class='production'",
  "p_observed_at < now()-interval '30 days'",
  "p_observed_at > now()+interval '5 minutes'",
  'grant execute on function public.ywi_record_auth_security_evidence',
  'to service_role;'
]));
add('schema203-derived-status',all(migration,[
  "if v_state='enabled' then v_status:='verified_secure'",
  "elsif v_state='disabled' then v_status:='verified_followup'",
  "if v_state='configured' then v_status:='verified_secure'",
  "elsif v_state='not_configured' then v_status:='verified_followup'",
  "v_expires_at := p_observed_at + interval '30 days'"
]));
add('schema203-idempotent-capture',all(migration,[
  'it_auth_security_evidence_capture_uidx',
  'on conflict(control_key,evidence_source,source_project_ref,source_capture_sha256)',
  'where source_capture_sha256 is not null'
]));
add('schema203-defense-in-depth-current-view',all(migration,[
  'create or replace view public.v_it_auth_security_evidence_current',
  "l.source_capture_sha256 !~ '^[0-9a-f]{64}$'",
  'l.recording_contract_version<>1',
  "a.project_ref=l.source_project_ref and a.environment_class='production'",
  "then 'verified_secure'"
]));
add('schema203-assertions-and-safety',all(migration,[
  'authoritative_traceability_required',
  'authorized_recording_service_private',
  'auth_evidence_authority_service_private',
  'open_business_acceptance_unchanged',
  'finance_provider_execution_off',
  "'auth_setting_mutation',false",
  "'external_evidence_fabrication',false",
  "'business_rail_auto_close',false",
  "'staging_execution',false",
  "'production_promotion',false"
]));
add('schema203-marker',migration.includes('203 as expected_schema_version') && /values\s*\(\s*203\s*,\s*'203_auth_evidence_authorized_recording'/i.test(migration));

const validCandidate=candidate();
const validPlan=buildAuthEvidenceRecordPlan(validCandidate,env(),{now:NOW});
add('valid-record-plan',validPlan.ok && validPlan.errors.length===0 && validPlan.expected_current_status==='verified_secure');
add('explicit-record-confirmation-required',!buildAuthEvidenceRecordPlan(validCandidate,env({YWI_AUTH_EVIDENCE_RECORD_CONFIRM:''}),{now:NOW}).ok);
add('explicit-source-confirmation-required',!buildAuthEvidenceRecordPlan(validCandidate,env({YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM:''}),{now:NOW}).ok);
add('exact-production-url-required',!buildAuthEvidenceRecordPlan(validCandidate,env({SUPABASE_URL:'https://differentproject.supabase.co'}),{now:NOW}).ok);

const tampered=structuredClone(validCandidate);
tampered.database_record_candidate.verification_status='verified_followup';
add('tampered-derived-status-rejected',!buildAuthEvidenceRecordPlan(tampered,env(),{now:NOW}).ok);

const staleCandidate=structuredClone(validCandidate);
staleCandidate.observed_at='2026-07-01T00:00:00.000Z';
staleCandidate.database_record_candidate.observed_at=staleCandidate.observed_at;
add('stale-candidate-rejected-at-recording',!buildAuthEvidenceRecordPlan(staleCandidate,env(),{now:NOW}).ok);

let calls=[];
const fakeFetch=async (url,options={})=>{
  calls.push({url,options});
  if(url.includes('/rpc/ywi_record_auth_security_evidence')){
    return {ok:true,status:200,json:async()=>77,text:async()=>''};
  }
  if(url.includes('/v_it_auth_security_evidence_current?')){
    return {ok:true,status:200,json:async()=>[{
      evidence_id:77,
      control_key:'leaked_password_protection',
      current_status:'verified_secure',
      source_project_ref:EXPECTED_PROJECT_REF,
      source_capture_sha256:validCandidate.source_capture_sha256,
      recording_contract_version:1,
    }]};
  }
  throw new Error(`Unexpected URL: ${url}`);
};
const recorded=await recordAuthEvidenceCandidate(validCandidate,env(),{now:NOW,fetchImpl:fakeFetch});
add('mock-record-and-reread',recorded.ok && recorded.write_performed && recorded.evidence_id===77 && recorded.current_status==='verified_secure');
add('rpc-before-reread',calls.length===2 && calls[0].url.endsWith('/rest/v1/rpc/ywi_record_auth_security_evidence') && calls[1].url.includes('/rest/v1/v_it_auth_security_evidence_current?'));
add('rpc-body-derived-not-operator-status',JSON.parse(calls[0].options.body).p_observed_state==='enabled' && !Object.prototype.hasOwnProperty.call(JSON.parse(calls[0].options.body),'p_verification_status'));

let lockedFetchCalled=false;
const locked=await recordAuthEvidenceCandidate(validCandidate,env({YWI_AUTH_EVIDENCE_RECORD_CONFIRM:''}),{now:NOW,fetchImpl:async()=>{lockedFetchCalled=true;throw new Error('must not call');}});
add('locked-plan-performs-no-network-write',!locked.ok && locked.write_performed===false && !lockedFetchCalled);

add('package-wiring',packageJson.includes('"auth:evidence:record": "node scripts/auth-security-evidence-record.mjs"') && packageJson.includes('"test:auth-security-evidence-record": "node scripts/auth-security-evidence-record-check.mjs"'));
add('workflow-wiring',workflow.includes('npm run test:auth-security-evidence-record'));
add('durable-docs-current',[handbook,nextSteps].every((text)=>text.includes('auth:evidence:record') && text.includes('I_CONFIRM_AUTH_EVIDENCE_RECORD') && text.includes('service-role')));
add('help-current',help.includes('auth:evidence:record') && help.includes('I_CONFIRM_AUTH_EVIDENCE_RECORD') && help.includes('re-read'));
add('active-docs-no-build-ledger',![handbook,nextSteps].some((text)=>/Build\s+\d+|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} Auth evidence authorized recording checks passed.`);
if(failed.length)process.exit(1);
