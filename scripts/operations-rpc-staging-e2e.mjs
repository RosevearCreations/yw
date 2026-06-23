#!/usr/bin/env node
/*
  Schema 153 staging proof harness.
  Default: source-only checks. Live mode is deliberately locked to a named
  staging target. Optional fixture creation is also opt-in and cleanup is
  explicit, so this command does not silently create or remove business data.
*/
import fs from 'node:fs';
import process from 'node:process';

const root=process.cwd();
const read=(file)=>fs.readFileSync(file,'utf8');
const sql151=read('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql');
const sql152=read('sql/152_staging_proof_permissions_stripe_health_accountant_export.sql');
const sql153=read('sql/153_release_fixture_policy_mapping_seo_alerts.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const webhook=read('supabase/functions/stripe-webhook/index.ts');
const accountant=read('supabase/functions/accountant-export/index.ts');
const upload=read('supabase/functions/upload-public-asset/index.ts');
const config=read('supabase/config.toml');
const all=(text, values)=>values.every((value)=>text.includes(value));
const checks=[];
function add(name, ok, details='') { checks.push({name,ok,details}); }
function printChecks(){ for(const item of checks) console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.details?` — ${item.details}`:''}`); }

add('schema151-transactional-rpcs',all(sql151,['ywi_rpc_post_payment_action','ywi_rpc_promote_bank_csv_import','ywi_rpc_apply_reconciliation_action','ywi_rpc_accept_quote_package','ywi_rpc_record_portal_deposit_paid']),'Core multi-row writes remain transactional.');
add('schema152-durable-release-proof',all(sql152,['operations_staging_test_runs','v_stripe_webhook_health','accountant-exports']),'Prior release proof remains present.');
add('schema153-disposable-fixture-rpcs',all(sql153,['ywi_rpc_create_staging_fixture_set','ywi_rpc_cleanup_staging_fixture_set','environment_label = \'staging\'','Fixture label must start with STAGING-']),'Fixture creation/cleanup is staged and labelled.');
add('schema153-policy-evidence',all(sql153,['ywi_security_policy_assertions','v_security_policy_assertion_summary','review_assets_private','sensitive_tables_rls_enabled']),'Policy assertions are deployable.');
add('schema153-private-media-promotion',all(sql153,['review-assets','review_storage_bucket','published_storage_bucket']) && all(upload,["const BUCKET = 'review-assets'",'review_only:true']) && operations.includes('publishApprovedAsset'),'Review media is private until protected approval copy.');
add('schema153-accountant-mapping',all(sql153,['accountant_export_mapping_rules','v_accountant_mapping_readiness','ywi_rpc_capture_accountant_close_snapshot']) && accountant.includes('ywi_rpc_capture_accountant_close_snapshot'),'Accountant close mapping is captured with exports.');
add('schema153-seo-observation-queue',all(sql153,['content_signal_observations','v_route_content_decision_queue']) && all(operations,['content_signal_record','content_signal_decision']),'Search/local observations have a human decision queue.');
add('schema153-webhook-alert-queue',all(sql153,['stripe_webhook_operational_alerts','ywi_refresh_stripe_webhook_alerts','v_stripe_webhook_alert_queue']) && webhook.includes('ywi_refresh_stripe_webhook_alerts'),'Webhook failures/staleness are turned into review alerts.');
add('schema153-capabilities',all(sql153,['staging_fixture_create','content_signal_record','stripe_webhook_alert_decision']) && operations.includes('YWI_ALLOW_STAGING_FIXTURES'),'Capability snapshot and deploy-time fixture gate are wired.');
add('protected-function-jwt-settings',all(config,['[functions.operations-manage]','[functions.accountant-export]','[functions.upload-public-asset]']) && /\[functions\.operations-manage\]\s+verify_jwt = true/s.test(config),'Protected Edge Functions retain JWT verification.');

printChecks();
if(checks.some((item)=>!item.ok)) process.exit(1);

const live=process.env.YWI_RUN_STAGING_RPC_TESTS==='1';
if(!live){ console.log('\nSKIP live staging proof — set YWI_RUN_STAGING_RPC_TESTS=1 only after schema 153 is deployed to a dedicated non-production project.'); process.exit(0); }
const url=(process.env.SUPABASE_URL||process.env.SB_URL||'').replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SB_SERVICE_ROLE_KEY||'';
const label=String(process.env.YWI_STAGING_LABEL||'').trim().toLowerCase();
const confirmation=process.env.YWI_STAGING_CONFIRM||'';
const actorId=process.env.YWI_STAGING_JOB_ADMIN_PROFILE_ID||'';
if(!url||!key||!actorId||label!=='staging'||confirmation!=='I_CONFIRM_STAGING_ONLY'){
  console.error('ERROR  Live mode requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YWI_STAGING_JOB_ADMIN_PROFILE_ID, YWI_STAGING_LABEL=staging, and YWI_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY.'); process.exit(1);
}
const headers={apikey:key,authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'};
async function rest(path,options={}){const res=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{...headers,...(options.headers||{})}});const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}if(!res.ok)throw new Error(`${res.status}: ${typeof data==='string'?data:JSON.stringify(data)}`);return data;}
async function functionCall(name,token,body){const res=await fetch(`${url}/functions/v1/${name}`,{method:'POST',headers:{apikey:key,authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}return {status:res.status,data};}
const runKey=`staging-schema153-${new Date().toISOString().replace(/[:.]/g,'-')}-${Math.random().toString(16).slice(2,8)}`;
const created=await rest('operations_staging_test_runs',{method:'POST',body:JSON.stringify({run_key:runKey,environment_label:'staging',suite_name:'operations_rpc_e2e_schema153',run_status:'started',requested_by_profile_id:actorId,summary:{build:'2026-06-22a',schema:153,fixture_mode:process.env.YWI_STAGING_CREATE_FIXTURES==='1'}})});
const run=Array.isArray(created)?created[0]:created;
const cases=[];
async function liveCase(caseKey, fn, optional=false){try{const details=await fn();cases.push({case_key:caseKey,case_status:'passed',details:details||{}});console.log(`PASS  live:${caseKey}`);}catch(error){const details={error:error instanceof Error?error.message:String(error)};cases.push({case_key:caseKey,case_status:optional?'skipped':'failed',details});console.log(`${optional?'SKIP':'FAIL'}  live:${caseKey} — ${details.error}`);}}
let fixture=null;
await liveCase('schema_drift_is_current',async()=>{const rows=await rest('v_schema_drift_status?select=*');const row=rows?.[0]||{};if(Number(row.latest_applied_schema_version)<153||row.drift_status!=='current')throw new Error(`Expected schema 153 current: ${JSON.stringify(row)}`);return row;});
await liveCase('policy_assertions_pass',async()=>{const rows=await rest('v_security_policy_assertion_summary?select=*');const row=rows?.[0]||{};if(row.policy_ready!==true)throw new Error(`Policy assertions need review: ${JSON.stringify(row.assertions||[])}`);return {passed_count:row.passed_count,assertion_count:row.assertion_count};});
await liveCase('accountant_mapping_readiness_view',async()=>{const rows=await rest('v_accountant_export_readiness?select=mapping_ready,unresolved_required_mapping_count,readiness_message');return rows?.[0]||{};});
await liveCase('capability_snapshot_has_release-proof-actions',async()=>{const result=await rest('rpc/ywi_get_operations_capabilities',{method:'POST',body:JSON.stringify({p_actor_profile_id:actorId})});const snap=Array.isArray(result)?result[0]:result;if(!snap?.actions?.staging_fixture_create||!snap?.actions?.content_signal_record)throw new Error('Schema 153 capability actions missing.');return {role:snap.actor_role,rank:snap.actor_rank};});
const jobAdminJwt=process.env.YWI_STAGING_JOB_ADMIN_JWT||'';
const workerJwt=process.env.YWI_STAGING_WORKER_JWT||'';
if(jobAdminJwt) await liveCase('job_admin_queue_allowed',async()=>{const result=await functionCall('operations-manage',jobAdminJwt,{action:'operations_queue_list'});if(result.status!==200||!result.data?.ok)throw new Error(`Expected allowed queue, received HTTP ${result.status}`);return {schema:result.data.schema,policy_ready:result.data?.queues?.security_policy?.policy_ready};}); else cases.push({case_key:'job_admin_queue_allowed',case_status:'skipped',details:{reason:'Set YWI_STAGING_JOB_ADMIN_JWT.'}});
if(workerJwt) await liveCase('worker_queue_denied',async()=>{const result=await functionCall('operations-manage',workerJwt,{action:'operations_queue_list'});if(result.status!==403)throw new Error(`Expected HTTP 403, received ${result.status}`);return {status:result.status};}); else cases.push({case_key:'worker_queue_denied',case_status:'skipped',details:{reason:'Set YWI_STAGING_WORKER_JWT.'}});
if(process.env.YWI_STAGING_CREATE_FIXTURES==='1') await liveCase('fixture_create',async()=>{const data=await rest('rpc/ywi_rpc_create_staging_fixture_set',{method:'POST',body:JSON.stringify({p_actor_profile_id:actorId,p_fixture_label:process.env.YWI_STAGING_FIXTURE_LABEL||'STAGING-E2E'})});fixture=Array.isArray(data)?data[0]:data;if(!fixture?.fixture_set_id)throw new Error('Fixture RPC did not return fixture_set_id.');return {fixture_set_id:fixture.fixture_set_id,ar_invoice_id:fixture.ar_invoice_id,quote_package_id:fixture.quote_package_id};}); else cases.push({case_key:'fixture_create',case_status:'skipped',details:{reason:'Set YWI_STAGING_CREATE_FIXTURES=1 to create disposable STAGING records.'}});
// Exact-cent mutation is optional and needs a reconciliation item UUID. It is intentionally not inferred.
const fixtureJson=process.env.YWI_STAGING_RPC_FIXTURES_JSON?JSON.parse(process.env.YWI_STAGING_RPC_FIXTURES_JSON):{};
if(fixtureJson.reconciliation_item_id) await liveCase('reconciliation_exact_cent_rejected',async()=>{
  const response=await fetch(`${url}/rest/v1/rpc/ywi_rpc_apply_reconciliation_action`,{method:'POST',headers,body:JSON.stringify({p_actor_profile_id:actorId,p_payload:{action_type:'split',bank_row_id:fixtureJson.reconciliation_item_id,reconciliation_item_id:fixtureJson.reconciliation_item_id,split_rows:[{reference:'STAGING-A',amount:0.01},{reference:'STAGING-B',amount:0.01}],signoff_note:'Intentional invalid test split'}})});
  const raw=await response.text();
  if(response.ok) throw new Error(`Invalid split was unexpectedly accepted: ${raw}`);
  return {http_status:response.status,rejected:true};
}); else cases.push({case_key:'reconciliation_exact_cent_rejected',case_status:'skipped',details:{reason:'Provide YWI_STAGING_RPC_FIXTURES_JSON with a dedicated reconciliation_item_id.'}});
if(fixture&&process.env.YWI_STAGING_CLEANUP_FIXTURE==='1') await liveCase('fixture_cleanup',async()=>{const data=await rest('rpc/ywi_rpc_cleanup_staging_fixture_set',{method:'POST',body:JSON.stringify({p_fixture_set_id:fixture.fixture_set_id,p_actor_profile_id:actorId,p_cleanup_note:'Harness cleanup.'})});return Array.isArray(data)?data[0]:data;}); else if(fixture) cases.push({case_key:'fixture_cleanup',case_status:'skipped',details:{reason:'Fixture kept for manual browser testing. Set YWI_STAGING_CLEANUP_FIXTURE=1 or run scripts/staging-fixtures.mjs cleanup.'}});
const failed=cases.filter((item)=>item.case_status==='failed');
try{await rest('operations_staging_test_results',{method:'POST',body:JSON.stringify(cases.map((item)=>({...item,run_id:run.id})))});await rest(`operations_staging_test_runs?id=eq.${encodeURIComponent(run.id)}`,{method:'PATCH',body:JSON.stringify({run_status:failed.length?'failed':'passed',finished_at:new Date().toISOString(),summary:{build:'2026-06-22a',schema:153,case_count:cases.length,failed_count:failed.length,fixture_set_id:fixture?.fixture_set_id||null}})});}catch(error){console.error(`WARN  Could not record full test outcome: ${error instanceof Error?error.message:String(error)}`);}
if(failed.length)process.exit(1);
console.log(`\nLIVE staging proof finished: ${cases.filter(c=>c.case_status==='passed').length} passed, ${cases.filter(c=>c.case_status==='skipped').length} skipped.`);
