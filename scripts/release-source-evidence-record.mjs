#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {EXPECTED_REPOSITORY,EXPECTED_WORKFLOW,discoverLatestSchema} from './release-source-evidence-bundle.mjs';
import {EXPECTED_WORKFLOW_PATH} from './release-source-evidence-verify.mjs';

export const EXPECTED_PROJECT_REF='jmqvkgiqlimdhcofwkxr';
export const RECORD_CONFIRM='I_CONFIRM_RELEASE_EVIDENCE_RECORD';
export const VERIFICATION_CONTRACT_VERSION=1;
const SHA_RE=/^[0-9a-f]{40}$/;
const DIGEST_RE=/^[0-9a-f]{64}$/;
const MAX_VERIFICATION_AGE_MS=24*60*60*1000;
const FUTURE_SKEW_MS=5*60*1000;
const clean=(value)=>String(value ?? '').trim();
const positiveInteger=(value)=>{
  const parsed=Number.parseInt(clean(value),10);
  return Number.isInteger(parsed)&&parsed>0 ? parsed : null;
};
const fullSha=(value)=>{
  const sha=clean(value).toLowerCase();
  return SHA_RE.test(sha) ? sha : null;
};
const isObject=(value)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));

function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(isObject(value)){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=stableValue(value[key]);
    return out;
  }
  return value;
}

function payloadDigest(value){
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value)),'utf8').digest('hex');
}

function projectRefFromUrl(value){
  try{
    const url=new URL(clean(value));
    if(url.protocol!=='https:' || url.username || url.password || url.port)return null;
    const match=/^([a-z0-9-]+)\.supabase\.co$/i.exec(url.hostname);
    if(!match || (url.pathname!=='/'&&url.pathname!==''))return null;
    return match[1].toLowerCase();
  }catch{return null;}
}

function verifiedShapeErrors(verified={},options={}){
  const errors=[];
  const nowMs=Date.parse(options.now || new Date().toISOString());
  const latestSchema=Number.isInteger(options.latestSchema) ? options.latestSchema : discoverLatestSchema(options.root);
  const sourceSha=fullSha(verified.source_sha);
  const mainSha=fullSha(verified.github_reported_main_sha);
  const runId=positiveInteger(verified.workflow_run_id);
  const runAttempt=positiveInteger(verified.workflow_run_attempt);
  const schema=Number.parseInt(verified.schema_version,10);
  const verifiedAtMs=Date.parse(clean(verified.verified_at));

  if(!Number.isFinite(nowMs))errors.push('Current time must be a valid ISO timestamp.');
  if(verified.evidence_format_version!==1)errors.push('Verified evidence format version must equal 1.');
  if(verified.evidence_kind!=='ywi_exact_main_release_source_verified')errors.push('Input must be final verified exact-main release-source evidence.');
  if(verified.verification_result!=='passed')errors.push('Final verification result must be passed.');
  if(verified.repository!==EXPECTED_REPOSITORY)errors.push(`Repository must exactly equal ${EXPECTED_REPOSITORY}.`);
  if(verified.source_branch!=='main')errors.push('Source branch must be main.');
  if(!sourceSha)errors.push('Source SHA must be a full lowercase 40-character SHA.');
  if(!mainSha || (sourceSha&&mainSha!==sourceSha))errors.push('Verified GitHub main SHA must exactly match the source SHA.');
  if(verified.exact_main_sha_verified!==true)errors.push('exact_main_sha_verified must remain true.');
  if(!runId || !runAttempt)errors.push('Positive workflow run id and run attempt are required.');
  if(verified.workflow_name!==EXPECTED_WORKFLOW)errors.push(`Workflow name must exactly equal ${EXPECTED_WORKFLOW}.`);
  if(verified.workflow_event!=='push')errors.push('Verified workflow event must be push.');
  if(verified.workflow_status!=='completed')errors.push('Verified workflow status must be completed.');
  if(verified.workflow_conclusion!=='success')errors.push('Verified workflow conclusion must be success.');
  if(!Number.isInteger(schema)||schema<201)errors.push('Verified schema must be Schema 201 or newer.');
  if(!Number.isInteger(latestSchema)||schema!==latestSchema)errors.push('Verified schema must exactly equal the current source schema.');
  if(verified.branch_protection_reported!==true)errors.push('Verified evidence must report current main protected=true.');
  if(verified.branch_policy_verified!==false)errors.push('Detailed branch_policy_verified must remain false until separately proven.');
  if(!Number.isFinite(verifiedAtMs))errors.push('verified_at must be a valid timestamp.');
  if(Number.isFinite(nowMs)&&Number.isFinite(verifiedAtMs)){
    if(verifiedAtMs>nowMs+FUTURE_SKEW_MS)errors.push('verified_at must not be materially future-dated.');
    if(nowMs-verifiedAtMs>MAX_VERIFICATION_AGE_MS)errors.push('Final release verification is older than the 24-hour recording window; rerun final verification.');
  }

  const db=verified.database_record_candidate;
  if(!isObject(db))errors.push('Verified evidence must contain a database_record_candidate.');
  else{
    if(db.source_branch!=='main')errors.push('Database-record source branch must be main.');
    if(sourceSha&&fullSha(db.source_sha)!==sourceSha)errors.push('Database-record source SHA must match verified source SHA.');
    if(positiveInteger(db.workflow_run_id)!==runId)errors.push('Database-record workflow run id must match verified evidence.');
    if(db.workflow_name!==EXPECTED_WORKFLOW)errors.push('Database-record workflow name must be canonical.');
    if(db.workflow_status!=='passed')errors.push('Database-record workflow status must be passed only after final verification.');
    if(Number.parseInt(db.schema_version,10)!==schema)errors.push('Database-record schema must match verified schema.');
    if(db.branch_protection_reported!==true)errors.push('Database-record branch protection must be true.');
    if(db.branch_policy_verified!==false)errors.push('Database-record detailed branch policy must remain false.');
  }

  const boundaries=verified.boundaries;
  if(!isObject(boundaries))errors.push('Verified evidence safety boundaries are required.');
  else{
    if(boundaries.verification_only!==true)errors.push('Verified evidence must remain verification_only.');
    for(const key of ['database_evidence_recorded','production_promotion_performed','production_mutation_performed','provider_mutation_performed']){
      if(boundaries[key]!==false)errors.push(`Verified boundary ${key} must remain false before recording.`);
    }
  }

  return {errors,sourceSha,runId,runAttempt,schema,latestSchema,verifiedAt: Number.isFinite(verifiedAtMs)?new Date(verifiedAtMs).toISOString():null};
}

function environmentErrors(env={}){
  const errors=[];
  const configuredRef=clean(env.YWI_PRODUCTION_PROJECT_REF);
  const urlRef=projectRefFromUrl(env.SUPABASE_URL);
  if(env.YWI_RELEASE_EVIDENCE_RECORD_CONFIRM!==RECORD_CONFIRM)errors.push(`YWI_RELEASE_EVIDENCE_RECORD_CONFIRM must exactly equal ${RECORD_CONFIRM}.`);
  if(configuredRef!==EXPECTED_PROJECT_REF)errors.push(`YWI_PRODUCTION_PROJECT_REF must exactly equal ${EXPECTED_PROJECT_REF}.`);
  if(urlRef!==EXPECTED_PROJECT_REF)errors.push('SUPABASE_URL must be the exact registered YardWeasels Production project URL.');
  if(!clean(env.SUPABASE_SERVICE_ROLE_KEY))errors.push('SUPABASE_SERVICE_ROLE_KEY must be present for the authorized server-only record.');
  if(!clean(env.GH_TOKEN || env.GITHUB_TOKEN))errors.push('GH_TOKEN or GITHUB_TOKEN must be present for fresh GitHub re-verification.');
  return errors;
}

export function buildReleaseEvidenceRecordPlan(verified={},workflowRun={},mainBranch={},env={},options={}){
  const shape=verifiedShapeErrors(verified,options);
  const errors=[...shape.errors,...environmentErrors(env)];
  const runHead=fullSha(workflowRun.head_sha);
  const currentMain=fullSha(mainBranch?.commit?.sha);

  if(positiveInteger(workflowRun.id)!==shape.runId)errors.push('Fresh workflow run id must exactly match verified evidence.');
  if(positiveInteger(workflowRun.run_attempt)!==shape.runAttempt)errors.push('Fresh workflow run attempt must exactly match verified evidence.');
  if(workflowRun.name!==EXPECTED_WORKFLOW)errors.push('Fresh workflow name must be canonical.');
  if(workflowRun.path!==EXPECTED_WORKFLOW_PATH)errors.push('Fresh workflow path must be canonical.');
  if(workflowRun.event!=='push')errors.push('Fresh workflow event must remain push.');
  if(workflowRun.head_branch!=='main')errors.push('Fresh workflow head branch must remain main.');
  if(!runHead || (shape.sourceSha&&runHead!==shape.sourceSha))errors.push('Fresh workflow head SHA must exactly match verified source SHA.');
  if(workflowRun.status!=='completed' || workflowRun.conclusion!=='success')errors.push('Fresh workflow run must still be completed/success.');
  if(workflowRun.repository?.full_name!==EXPECTED_REPOSITORY)errors.push('Fresh workflow repository must remain canonical.');
  if(mainBranch.name!=='main')errors.push('Fresh branch evidence must be for main.');
  if(!currentMain || (shape.sourceSha&&currentMain!==shape.sourceSha))errors.push('Current main SHA moved after final verification; rerun verification against the new main state.');
  if(mainBranch.protected!==true)errors.push('GitHub must still report current main protected=true immediately before recording.');

  const digest=payloadDigest(verified);
  if(!DIGEST_RE.test(digest))errors.push('Verified payload digest could not be produced.');
  const params={
    p_project_ref:EXPECTED_PROJECT_REF,
    p_repository:EXPECTED_REPOSITORY,
    p_source_sha:shape.sourceSha,
    p_workflow_run_id:shape.runId,
    p_workflow_run_attempt:shape.runAttempt,
    p_workflow_name:EXPECTED_WORKFLOW,
    p_workflow_path:EXPECTED_WORKFLOW_PATH,
    p_schema_version:shape.schema,
    p_branch_protection_reported:true,
    p_verification_contract_version:VERIFICATION_CONTRACT_VERSION,
    p_verified_payload_sha256:digest,
    p_verified_at:shape.verifiedAt,
    p_evidence_note:'Recorded from freshly re-verified exact-main release-source evidence. Detailed branch-policy verification remains false.',
    p_recorded_by_profile_id:null,
  };
  return {ok:errors.length===0,errors,params,verified_payload_sha256:digest,source_sha:shape.sourceSha,workflow_run_id:shape.runId,workflow_run_attempt:shape.runAttempt,schema_version:shape.schema};
}

async function jsonResponse(response,label){
  if(!response.ok){
    let detail='';
    try{detail=clean(await response.text());}catch{}
    throw new Error(`${label} failed with HTTP ${response.status}${detail?': '+detail.slice(0,300):''}`);
  }
  return response.json();
}

export async function recordVerifiedReleaseSourceEvidence(verified={},env={},options={}){
  const shape=verifiedShapeErrors(verified,options);
  const preErrors=[...shape.errors,...environmentErrors(env)];
  if(preErrors.length)return {ok:false,errors:preErrors,write_performed:false};

  const fetchImpl=options.fetchImpl || globalThis.fetch;
  if(typeof fetchImpl!=='function')return {ok:false,errors:['A fetch implementation is required.'],write_performed:false};
  const ghToken=clean(env.GH_TOKEN || env.GITHUB_TOKEN);
  const ghHeaders={Accept:'application/vnd.github+json',Authorization:`Bearer ${ghToken}`,'X-GitHub-Api-Version':'2022-11-28'};
  let workflowRun;
  let mainBranch;
  try{
    workflowRun=await jsonResponse(await fetchImpl(`https://api.github.com/repos/${EXPECTED_REPOSITORY}/actions/runs/${shape.runId}`,{headers:ghHeaders}),'Fresh GitHub workflow lookup');
    mainBranch=await jsonResponse(await fetchImpl(`https://api.github.com/repos/${EXPECTED_REPOSITORY}/branches/main`,{headers:ghHeaders}),'Fresh GitHub main lookup');
  }catch(error){
    return {ok:false,errors:[error instanceof Error?error.message:String(error)],write_performed:false};
  }

  const plan=buildReleaseEvidenceRecordPlan(verified,workflowRun,mainBranch,env,options);
  if(!plan.ok)return {...plan,write_performed:false};

  const supabaseUrl=clean(env.SUPABASE_URL).replace(/\/$/,'');
  const serviceKey=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  const dbHeaders={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};
  let evidenceId;
  try{
    const rpc=await jsonResponse(await fetchImpl(`${supabaseUrl}/rest/v1/rpc/ywi_record_verified_release_source_evidence`,{
      method:'POST',headers:dbHeaders,body:JSON.stringify(plan.params),
    }),'Verified release evidence RPC');
    evidenceId=Number.parseInt(String(rpc),10);
    if(!Number.isInteger(evidenceId)||evidenceId<=0)throw new Error('Verified release evidence RPC returned an invalid evidence id.');

    const select='id,repository,source_branch,source_sha,workflow_run_id,workflow_run_attempt,workflow_name,workflow_path,workflow_status,schema_version,branch_protection_reported,branch_policy_verified,verification_contract_version,verified_payload_sha256,verified_at,source_gate_status,repository_enforcement_status';
    const rows=await jsonResponse(await fetchImpl(`${supabaseUrl}/rest/v1/v_it_release_source_evidence_current?select=${encodeURIComponent(select)}&limit=1`,{headers:dbHeaders}),'Current release evidence re-read');
    const row=Array.isArray(rows)?rows[0]:null;
    if(!row)throw new Error('Current release evidence re-read returned no row.');
    if(Number(row.id)!==evidenceId)throw new Error('Current release evidence id does not match the recorded row.');
    if(row.repository!==EXPECTED_REPOSITORY || row.source_branch!=='main' || fullSha(row.source_sha)!==plan.source_sha)throw new Error('Current release evidence identity does not match the verified payload.');
    if(Number(row.workflow_run_id)!==plan.workflow_run_id || Number(row.workflow_run_attempt)!==plan.workflow_run_attempt)throw new Error('Current release evidence run identity does not match.');
    if(row.workflow_name!==EXPECTED_WORKFLOW || row.workflow_path!==EXPECTED_WORKFLOW_PATH)throw new Error('Current release evidence workflow identity does not match.');
    if(row.workflow_status!=='passed' || Number(row.schema_version)!==plan.schema_version)throw new Error('Current release evidence status/schema does not match.');
    if(row.branch_protection_reported!==true || row.branch_policy_verified!==false)throw new Error('Current release evidence repository boundary does not match.');
    if(Number(row.verification_contract_version)!==VERIFICATION_CONTRACT_VERSION || row.verified_payload_sha256!==plan.verified_payload_sha256)throw new Error('Current release evidence traceability digest does not match.');
    if(row.source_gate_status!=='green')throw new Error('Current release evidence did not become source-gate GREEN after recording.');

    return {...plan,ok:true,errors:[],write_performed:true,evidence_id:evidenceId,current_source_gate_status:row.source_gate_status,current_repository_enforcement_status:row.repository_enforcement_status};
  }catch(error){
    return {...plan,ok:false,errors:[error instanceof Error?error.message:String(error)],write_performed:Number.isInteger(evidenceId)&&evidenceId>0,evidence_id:evidenceId||null};
  }
}

function readVerified(filePath){
  const parsed=JSON.parse(fs.readFileSync(filePath,'utf8'));
  if(!isObject(parsed))throw new Error('Verified release evidence JSON root must be an object.');
  return parsed;
}

function printResult(result,inputPath){
  console.log(JSON.stringify({
    ok:result.ok,
    input_path:inputPath,
    source_sha:result.source_sha || null,
    workflow_run_id:result.workflow_run_id || null,
    workflow_run_attempt:result.workflow_run_attempt || null,
    schema_version:result.schema_version || null,
    verified_payload_sha256:result.verified_payload_sha256 || null,
    write_performed:result.write_performed===true,
    evidence_id:result.evidence_id || null,
    current_source_gate_status:result.current_source_gate_status || null,
    current_repository_enforcement_status:result.current_repository_enforcement_status || null,
    errors:result.errors || [],
  },null,2));
  if(!result.ok){
    console.error('\nVERIFIED RELEASE EVIDENCE RECORDING: LOCKED');
    for(const error of result.errors || [])console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('\nVERIFIED RELEASE EVIDENCE RECORDING: RECORDED AND RE-READ');
  console.log('This records exact-main source evidence only. It does not verify detailed branch policy, deploy, mutate Finance/providers, or promote Production.');
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){
  try{
    const inputPath=path.resolve(process.argv[2] || process.env.YWI_RELEASE_VERIFIED_PATH || 'release-source-evidence-verified.json');
    const verified=readVerified(inputPath);
    printResult(await recordVerifiedReleaseSourceEvidence(verified,process.env),inputPath);
  }catch(error){
    console.error(`VERIFIED RELEASE EVIDENCE RECORDING: LOCKED\n- ${error instanceof Error?error.message:String(error)}`);
    process.exitCode=1;
  }
}
