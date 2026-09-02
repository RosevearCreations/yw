import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const sql=read('sql/166_it_release_authority.sql');
const dynamicSql=read('sql/167_real_cross_module_event_wiring.sql');
const completionSql=read('sql/168_job_completion_event_wiring.sql');
const financeSql=read('sql/169_finance_job_completion_consumer.sql');
const observabilitySql=read('sql/170_it_cross_module_consumer_observability.sql');
const executionSql=read('sql/171_finance_consumer_execution_retry.sql');
const reviewSql=read('sql/172_finance_review_disposition_candidate_authority.sql');
const dependencySql=read('sql/173_finance_schema_dependency_contract_guard.sql');
const currentSql=read('sql/174_finance_dependency_type_convergence.sql');
const endpoint=read('supabase/functions/admin-it-control/index.ts');
const financeReviewEndpoint=read('supabase/functions/finance-job-completion-review/index.ts');
const financeUi=read('js/finance-ui.js');
const jobsBoundary=read('js/jobs-finance-boundary.js');
const itUi=read('js/it-readiness-ui.js');
const moduleUi=read('js/module-access-ui.js');
const runtime=read('js/module-runtime.js');

const required=(source,values,label)=>{
  for(const value of values) assert.ok(source.includes(value),`${label} missing ${value}`);
};

required(sql,[
  'create table if not exists public.it_release_source_evidence',
  'alter table public.it_release_source_evidence enable row level security',
  'revoke all on table public.it_release_source_evidence from public, anon, authenticated',
  'create or replace view public.v_it_release_source_evidence_current',
  'with (security_invoker=true)',
  'create or replace view public.v_it_release_authority_status',
  'create or replace function public.ywi_it_release_authority_assertions()',
  'ywi_record_release_source_evidence',
  'manual_human_promotion_required',
  '166::int as expected_schema_version',
  "'166_it_release_authority'",
], 'Schema 166 migration');

required(sql,[
  'revoke all on function public.ywi_effective_module_access(uuid,text) from public, anon, authenticated',
  'revoke all on function public.ywi_profile_has_module_access(uuid,text,text) from public, anon, authenticated',
  'revoke all on function public.ywi_get_profile_module_permissions(uuid) from public, anon, authenticated',
  'grant execute on function public.ywi_effective_module_access(uuid,text) to service_role',
  'grant execute on function public.ywi_profile_has_module_access(uuid,text,text) to service_role',
  'grant execute on function public.ywi_get_profile_module_permissions(uuid) to service_role',
  'revoke all on function public.ywi_get_my_module_permissions() from public, anon, authenticated',
  'grant execute on function public.ywi_get_my_module_permissions() to authenticated, service_role',
], 'Schema 159 privilege convergence');

assert.ok(sql.includes("source_branch='main' and workflow_status='passed' and schema_version=166"),'Schema 166 historical exact main/CI evidence proof must remain reproducible.');
required(dynamicSql,[
  'create or replace view public.v_it_release_source_evidence_current',
  'where e.schema_version=expected.expected_schema_version',
  'ss.expected_schema_version as release_schema_version',
  'src.schema_version=ss.expected_schema_version',
  'repository enforcement is evaluated separately',
], 'Schema 167 dynamic release authority');
assert.ok(!dynamicSql.includes("e.schema_version=166 then 'green'"),'Current release authority must not pin source evidence to Schema 166.');
assert.ok(dynamicSql.includes("e.branch_protection_reported is false then 'amber'"),'Repository enforcement must remain a separate AMBER rail when main is reported unprotected.');

required(completionSql,[
  'ywi_cross_module_event_wiring_assertions()',
  'job_completion_event_wired_atomically',
  'job_completion_evidence_server_derived',
  '168::int as expected_schema_version',
  "'168_job_completion_event_wiring'",
  "'2026-09-01j'",
], 'Schema 168 job completion authority');

required(financeSql,[
  'create table if not exists public.finance_job_completion_intake',
  'first_seen_at timestamptz not null default now()',
  'ywi_finance_consume_job_completed_events',
  'ywi_finance_job_completion_consumer_assertions()',
  '169::int as expected_schema_version',
  "'169_finance_job_completion_consumer'",
  "'2026-09-02a'",
], 'Schema 169 Finance completion authority');
assert.ok(!/update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(financeSql),'Schema 169 Finance consumer must not write back into Jobs completion state.');

required(observabilitySql,[
  'create or replace view public.v_it_cross_module_consumer_health',
  'ywi_it_cross_module_consumer_observability_assertions()',
  '170::int as expected_schema_version',
  "'170_it_cross_module_consumer_observability'",
  "'2026-09-02b'",
], 'Schema 170 observability authority');

required(executionSql,[
  'create table if not exists public.finance_job_completion_consumer_runs',
  'create table if not exists public.finance_job_completion_consumer_failures',
  'ywi_finance_run_job_completion_consumer',
  'ywi_finance_job_completion_execution_assertions()',
  'v_finance_job_completion_execution_status',
  "'finance_completion_execution_readiness'",
  "'finance_completion_retry_state'",
  '171::int as expected_schema_version',
  "'171_finance_consumer_execution_retry'",
  "'2026-09-02c'",
], 'Schema 171 execution authority');
assert.ok(executionSql.includes('grant execute on function public.ywi_finance_run_job_completion_consumer(integer,text) to service_role;'),'Schema 171 controlled runner must remain service-role executable.');
assert.ok(executionSql.includes('attempt_count between 1 and 3'),'Schema 171 retries must retain the database-enforced ceiling.');
assert.ok(!/update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(executionSql),'Schema 171 execution must not write back into Jobs completion state.');

required(reviewSql,[
  'create table if not exists public.finance_job_completion_review_dispositions',
  'ywi_finance_dispose_job_completion_review',
  'ywi_finance_generate_job_completion_candidates',
  'ywi_finance_job_completion_review_assertions()',
  'v_finance_job_completion_review_queue',
  'v_finance_job_completion_review_status',
  "'finance_completion_human_disposition'",
  "'finance_completion_candidate_generation'",
  'i.first_seen_at as queued_at',
  'order by i.first_seen_at asc',
  'min(i.first_seen_at)',
  '172::int as expected_schema_version',
  "'172_finance_review_disposition_candidate_authority'",
  "'2026-09-02d'",
], 'Schema 172 Finance review authority');
assert.ok(!reviewSql.includes('i.created_at'),'Schema 172 must not reference nonexistent finance intake created_at.');
assert.ok(!reviewSql.includes('order by created_at desc'),'Schema 172 guards must use the canonical first_seen_at intake timestamp.');
assert.ok((reviewSql.match(/order by first_seen_at desc/g)||[]).length===2,'Both Schema 172 candidate guards must select intake rows by first_seen_at.');
assert.ok(reviewSql.includes('grant execute on function public.ywi_finance_dispose_job_completion_review(uuid,text,text,uuid) to service_role;'),'Schema 172 disposition RPC must remain service-role-only below the Edge authorization layer.');
assert.ok(reviewSql.includes('grant execute on function public.ywi_finance_generate_job_completion_candidates(uuid,uuid) to service_role;'),'Schema 172 generation RPC must remain service-role-only below the Edge authorization layer.');
assert.ok(reviewSql.includes('Invoice candidate amounts must come from canonical work-order totals.'),'Schema 172 must database-enforce canonical candidate amounts.');
assert.ok(reviewSql.includes('Schema 172 does not authorize candidate posting.'),'Schema 172 must fail closed on posting.');
const reviewExecutable=reviewSql.split('create or replace function public.ywi_finance_dispose_job_completion_review')[1]?.split('create or replace view public.v_finance_job_completion_review_queue')[0] || '';
assert.ok(!/update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(reviewExecutable),'Schema 172 Finance authority must not write back into Jobs completion state.');
assert.ok(!/insert\s+into\s+public\.(?:ar_invoices|gl_batches|gl_entries|payments)\b/i.test(reviewExecutable),'Schema 172 must not post invoices, journals or payments.');
assert.ok(!/stripe|paypal|payment_intent|paypal_order/i.test(reviewExecutable),'Schema 172 SQL must not mutate provider/payment truth.');

required(dependencySql,[
  'create table if not exists public.app_schema_dependency_contracts',
  'create or replace view public.v_it_schema_dependency_status',
  'create or replace function public.ywi_schema_dependency_assertions()',
  "'schema173_finance_intake_contract_complete'",
  "'schema173_schema172_first_seen_runtime'",
  "'schema173_finance_dependency_contract'",
  "'finance_schema_dependency_contracts'",
  '173::int as expected_schema_version',
  "'173_finance_schema_dependency_contract_guard'",
  "'2026-09-02e'",
], 'Schema 173 dependency authority');
assert.ok(dependencySql.includes('alter table public.app_schema_dependency_contracts enable row level security;'),'Schema 173 dependency registry must use RLS.');
assert.ok(dependencySql.includes('revoke all on table public.app_schema_dependency_contracts from public,anon,authenticated;'),'Schema 173 dependency registry must remain private.');
assert.ok(!/insert\s+into\s+public\.(?:job_invoice_candidates|job_journal_candidates|job_completion_accounting_events|payments|ar_invoices|gl_batches|gl_entries)\b/i.test(dependencySql),'Schema 173 must not mutate business accounting state.');
assert.ok(!/update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(dependencySql),'Schema 173 must not write back into Jobs state.');
assert.ok(!/stripe|paypal|payment_intent|paypal_order/i.test(dependencySql),'Schema 173 must not mutate provider/payment truth.');

required(currentSql,[
  "data_type='uuid'",
  "contract_key='completion_review_work_order'",
  "set expected_data_type='uuid'",
  "'finance_dependency_type_convergence','Architecture'",
  '174::int as expected_schema_version',
  "'174_finance_dependency_type_convergence'",
  "'2026-09-02f'",
], 'Schema 174 current release authority');
assert.ok(currentSql.includes("raise exception 'Schema 174 requires public.job_completion_reviews.work_order_id to be uuid.'"),'Schema 174 must fail closed unless live work_order_id is UUID.');
assert.ok(currentSql.includes("raise exception 'Schema 173 completion_review_work_order dependency contract is missing.'"),'Schema 174 must fail closed if the dependency row is missing.');
assert.ok(!/insert\s+into\s+public\.(?:job_invoice_candidates|job_journal_candidates|job_completion_accounting_events|payments|ar_invoices|gl_batches|gl_entries)\b/i.test(currentSql),'Schema 174 must not mutate business accounting state.');
assert.ok(!/update\s+public\.(?:jobs|work_orders|job_completion_reviews|finance_job_completion_intake)\b/i.test(currentSql),'Schema 174 must not write business/Jobs state.');
assert.ok(!/stripe|paypal|payment_intent|paypal_order/i.test(currentSql),'Schema 174 must not mutate provider/payment truth.');
assert.ok(!/insert\s+into\s+public\.app_modules[\s\S]*?['"]it['"]/i.test(currentSql),'I.T. must not become a fifth business module.');
assert.ok(currentSql.includes("'Admin > I.T. Readiness'"),'Schema 174 proof must remain inside Admin I.T. Readiness.');
assert.ok(sql.includes('drop index if exists public.module_acceptance_scenarios_sort_order_idx'),'Schema 165 unused live index cleanup must remain explicit.');
assert.ok(dynamicSql.includes('manual_human_promotion_required'),'Production promotion must remain manual.');

required(endpoint,[
  'v_schema_drift_status',
  'v_it_release_authority_status',
  'v_it_release_source_evidence_current',
  'v_it_cross_module_consumer_health',
  'v_admin_schema_preflight_checks',
  'ywi_it_release_authority_assertions',
  'ywi_it_cross_module_consumer_observability_assertions',
], 'admin-it-control');
assert.ok(!endpoint.includes('ywi_finance_run_job_completion_consumer'),'Admin browser endpoint must not expose Schema 171 execution authority.');
assert.ok(!endpoint.includes('ywi_finance_generate_job_completion_candidates'),'Admin I.T. endpoint must not become a Finance mutation proxy.');
assert.ok(!endpoint.includes('expected_schema_version: 160'),'admin-it-control must not hardcode Schema 160 as current.');

required(financeReviewEndpoint,[
  'hasModuleAccess(supabase, actorProfile, "finance", "view")',
  'hasModuleAccess(supabase, actorProfile, "finance", "approve")',
  'ywi_finance_dispose_job_completion_review',
  'ywi_finance_generate_job_completion_candidates',
  'SERVER_OWNED_FINANCIAL_FIELDS',
], 'Finance completion-review Edge boundary');
assert.ok(financeReviewEndpoint.includes('"subtotal"')&&financeReviewEndpoint.includes('"tax_total"')&&financeReviewEndpoint.includes('"total_amount"'),'Browser-supplied candidate amounts must be rejected.');
assert.ok(financeReviewEndpoint.includes('"stripe"')&&financeReviewEndpoint.includes('"paypal"'),'Provider truth must be rejected at the Finance browser boundary.');

required(financeUi,['Completed jobs — Finance review','Generate draft candidates',"action:'dispose'", "action:'generate_candidates'"],'Finance UI');
assert.ok(!financeUi.includes("action:'post_candidate'"),'Finance Schema 172 UI must not expose posting.');
required(jobsBoundary,['jobCreateInvoiceCandidate','jobCreateJournalCandidate','jobPostInvoiceCandidate','jobPostJournalCandidate','button.hidden = true'],'Jobs Finance boundary');
assert.ok(runtime.includes("scripts: Object.freeze(['/js/jobs-ui.js','/js/jobs-finance-boundary.js'])"),'Jobs boundary shim must load immediately after the Jobs UI.');

required(itUi,['release_authority','release_source_evidence','cross_module_consumer_health','schema_preflight','consumer_observability'],'I.T. Readiness UI');
assert.ok(!itUi.includes('ywi_finance_run_job_completion_consumer'),'I.T. browser UI must remain read-only for consumer execution.');
assert.ok(!itUi.includes('retry_failed'),'I.T. browser UI must not expose a retry execution control.');

for(const key of ['safety','finance','jobs','admin']) assert.ok(runtime.includes(key),`Runtime manifest must retain ${key}.`);
assert.ok(!/moduleKey\s*:\s*['"]it['"]|module_key\s*:\s*['"]it['"]/.test(runtime),'Runtime must not register I.T. as a fifth business module.');
assert.ok(moduleUi.includes("const MODULES = ['safety','finance','jobs','admin']"),'Admin permission editor must remain exactly four-module aware.');

console.log('Schema 174-aware I.T. release authority source gate: PASS');
