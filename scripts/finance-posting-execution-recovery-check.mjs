#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('sql/177_finance_posting_execution_recovery.sql','utf8');
const edge=fs.readFileSync('supabase/functions/finance-job-completion-posting-approval/index.ts','utf8');
const pkg=fs.readFileSync('package.json','utf8');
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');

const required=[
  'finance_job_completion_posting_execution_controls',
  'finance_job_completion_posting_execution_runs',
  'finance_job_completion_posting_reversals',
  'ywi_finance_execute_job_completion_posting',
  'ywi_finance_reverse_job_completion_posting',
  'v_finance_job_completion_posting_execution_queue',
  'v_it_finance_posting_execution_status',
  'ywi_finance_posting_execution_assertions',
  'schema177-finance-posting:',
  'schema177_finance_posting_execution',
  'schema177_finance_posting_reversal',
  'blocked_release','blocked_preflight','recovery_required',
  'uq_job_invoice_postings_schema177_finance_approval',
  'uq_job_journal_postings_schema177_finance_approval',
  'job_invoice_postings','ar_invoices','job_journal_postings','gl_journal_batches','gl_journal_entries',
  'ywi_finance_job_completion_posting_preflight',
  'ywi_sync_source_journal_batch','ywi_sync_gl_journal_batch',
  'accounts_receivable','service_revenue','sales_tax_payable',
  '177_finance_posting_execution_recovery','schema177_finance_posting_execution_recovery',
  '177::int as expected_schema_version'
];
for(const text of required) assert.ok(migration.includes(text),`Schema 177 migration missing ${text}`);

assert.ok(/'finance_job_completion_v1',false,false,177/i.test(migration),'Schema 177 execution control must be seeded disabled with provider mutation disabled.');
assert.ok(/check \(provider_mutation_enabled=false\)/i.test(migration),'Provider mutation must be structurally fail-closed.');
assert.ok(/grant execute on function public\.ywi_finance_execute_job_completion_posting\(uuid,text,uuid\) to service_role/i.test(migration),'Execution RPC must be service-role scoped.');
assert.ok(/grant execute on function public\.ywi_finance_reverse_job_completion_posting\(uuid,text,uuid\) to service_role/i.test(migration),'Reversal RPC must be service-role scoped.');
assert.ok(!/grant\s+execute\s+on\s+function\s+public\.ywi_finance_(?:execute|reverse)_job_completion_posting\([^;]+\)\s+to\s+(?:anon|authenticated|public)/i.test(migration),'Execution/reversal RPCs must not be browser executable.');
assert.ok(migration.includes("public.ywi_profile_has_module_access(p_actor_profile_id,'finance','approve')"),'Execution must require Finance approve authority.');
assert.ok(migration.includes("public.ywi_profile_has_module_access(p_actor_profile_id,'finance','manage')"),'Reversal must require Finance manage authority.');
assert.ok(migration.includes("v_pf.preflight_status is distinct from 'passed_execution_closed'")&&migration.includes("jsonb_array_length(coalesce(v_pf.blockers,'[]'::jsonb))<>0"),'Execution must fail closed unless Schema 176 preflight passes with zero blockers.');
assert.ok(migration.includes("where mapping_key='accounts_receivable' and mapping_approved")&&migration.includes("where mapping_key='service_revenue' and mapping_approved"),'Execution must resolve only approved accountant mappings.');
assert.ok(migration.includes("where mapping_key='sales_tax_payable' and mapping_approved"),'Tax posting must use approved tax mapping when applicable.');
assert.ok(migration.includes("execution_status='failed'")&&migration.includes('paired accounting transaction rolled back safely'),'Execution must record safe atomic failure without silent partial completion.');
assert.ok(migration.includes("execution_status='recovery_required'")&&migration.includes('automatic retry is quarantined to prevent duplication'),'Pre-existing partial/orphan state must be quarantined.');
assert.ok(migration.includes("execution_status='completed'")&&migration.includes('returning the durable idempotent result'),'Completed execution must be idempotently replayable.');
assert.ok(migration.includes("'finance_job_completion_posting_reversal'")&&migration.includes('e.credit_amount,e.debit_amount'),'Reversal must create a separate GL batch with debit/credit sides reversed.');
assert.ok(migration.includes("invoice_status='void'")&&migration.includes("posting_status='reversed'"),'Reversal must void the materialized draft AR invoice and mark posting envelopes reversed rather than deleting history.');
assert.ok(!/update\s+public\.(?:jobs|work_orders|job_completion_reviews|job_invoice_candidates|job_journal_candidates|accountant_export_mapping_rules|chart_of_accounts)\b/i.test(migration),'Schema 177 must not write Jobs, candidate, or accountant mapping authorities.');
assert.ok(!/insert\s+into\s+public\.(?:ar_payments|ap_payments|payments|payment_action_requests|stripe[^\s(]*|paypal[^\s(]*)\b/i.test(migration),'Schema 177 must not create payments or provider effects.');
assert.ok(!/insert\s+into\s+public\.app_modules[\s\S]*?['"]it['"]/i.test(migration),'I.T. must remain inside Admin, not become a fifth module.');

for(const text of [
  'action === "execute_posting"',
  'action === "reverse_posting"',
  'ywi_finance_execute_job_completion_posting',
  'ywi_finance_reverse_job_completion_posting',
  'v_finance_job_completion_posting_execution_queue',
  'v_it_finance_posting_execution_status',
  'hasModuleAccess(supabase, actorProfile, "finance", "approve")',
  'hasModuleAccess(supabase, actorProfile, "finance", "manage")',
  'SERVER_OWNED_POSTING_FIELDS',
  'posting_execution_authorized: false',
  'provider_mutation: false'
]) assert.ok(edge.includes(text),`Schema 177 Edge boundary missing ${text}`);

assert.ok(!/\.from\("(?:ar_invoices|gl_journal_batches|gl_journal_entries|job_invoice_postings|job_journal_postings|accountant_export_mapping_rules|chart_of_accounts)"\)\.(?:insert|update|upsert|delete)/i.test(edge),'Finance Edge boundary must not directly mutate accounting or accountant-mapping tables.');
assert.ok(pkg.includes('"test:finance-posting-execution-recovery"'),'package.json must expose the Schema 177 source gate.');
assert.ok(workflow.includes('npm run test:finance-posting-execution-recovery'),'GitHub CI must run the Schema 177 source gate.');

assert.ok(migration.includes('r.execution_status as posting_execution_status'),'Schema 177 execution queue must alias the run status instead of colliding with Schema 175 execution_status.');

console.log('Schema 177 Finance posting execution/recovery source gate passed.');
