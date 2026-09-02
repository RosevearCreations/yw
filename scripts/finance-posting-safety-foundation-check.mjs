import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('sql/175_finance_posting_safety_foundation.sql');
const endpoint=read('supabase/functions/finance-job-completion-posting-approval/index.ts');
const config=read('supabase/config.toml');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

const required=(source,values,label)=>{
  for(const value of values) assert.ok(source.includes(value),`${label} missing ${value}`);
};

required(migration,[
  'create table if not exists public.finance_job_completion_posting_approvals',
  'intake_id uuid not null unique',
  'disposition_id uuid not null unique',
  'invoice_candidate_id uuid not null unique',
  'journal_candidate_id uuid not null unique',
  'idempotency_key text not null unique',
  "check (idempotency_key = 'finance-job-completion:' || intake_id::text)",
  "check (execution_status='not_released')",
  'alter table public.finance_job_completion_posting_approvals enable row level security',
  'revoke all on table public.finance_job_completion_posting_approvals from public,anon,authenticated,service_role',
  'create or replace function public.ywi_finance_approve_job_completion_posting',
  "public.ywi_profile_has_module_access(p_actor_profile_id,'finance','approve')",
  'posting_approval_authority',
  'schema175_finance_posting_approval',
  'posting_execution_authorized',
  'provider_mutation',
  'trg_guard_finance_posting_approval_immutable',
  'uq_job_invoice_postings_schema175_finance_approval',
  'uq_job_journal_postings_schema175_finance_approval',
  'trg_guard_schema172_invoice_posting_closed',
  'trg_guard_schema172_journal_posting_closed',
  'Schema 175 records posting approval only; invoice posting execution remains closed',
  'Schema 175 records posting approval only; journal posting execution remains closed',
  'create or replace view public.v_finance_job_completion_posting_approval_queue',
  'create or replace view public.v_it_finance_posting_safety_status',
  'create or replace function public.ywi_finance_posting_safety_assertions()',
  "'finance_posting_safety_foundation'",
  '175::int as expected_schema_version',
  "'175_finance_posting_safety_foundation'",
  "'2026-09-02g'",
], 'Schema 175 migration');

assert.ok(migration.includes('grant execute on function public.ywi_finance_approve_job_completion_posting(uuid,text,uuid) to service_role;'),'Posting approval RPC must be service-role-only below Edge authorization.');
assert.ok(!/grant\s+execute\s+on\s+function\s+public\.ywi_finance_approve_job_completion_posting\([^;]+\)\s+to\s+(?:anon|authenticated|public)/i.test(migration),'Posting approval RPC must not be browser-executable.');
assert.ok(!/insert\s+into\s+public\.(?:ar_invoices|gl_journal_batches|gl_journal_entries|payments|ap_payments|ar_payment_applications)\b/i.test(migration),'Schema 175 must not create accounting/payment effects.');
assert.ok(!/update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(migration),'Schema 175 must not write back into Jobs state.');
assert.ok(!/stripe_payment_intent_id\s*=|paypal_order_id\s*=|insert\s+into\s+public\.(?:stripe|paypal)/i.test(migration),'Schema 175 must not mutate provider truth.');
assert.ok(!/insert\s+into\s+public\.app_modules[\s\S]*?['"]it['"]/i.test(migration),'I.T. must not become a fifth module.');

required(endpoint,[
  'hasModuleAccess(supabase, actorProfile, "finance", "view")',
  'hasModuleAccess(supabase, actorProfile, "finance", "approve")',
  'v_finance_job_completion_posting_approval_queue',
  'v_it_finance_posting_safety_status',
  'ywi_finance_approve_job_completion_posting',
  'SERVER_OWNED_POSTING_FIELDS',
  'posting_execution_authorized: false',
  'provider_mutation: false',
  'action === "approve_posting"',
], 'Schema 175 Edge boundary');
for(const key of ['subtotal','tax_total','total_amount','debit','credit','ar_invoice_id','gl_batch_id','stripe','paypal']) {
  assert.ok(endpoint.includes(`"${key}"`),`Edge boundary must reject browser-supplied ${key}.`);
}
assert.ok(!endpoint.includes('.from("ar_invoices").insert')&&!endpoint.includes('.from("gl_journal_batches").insert'),'Schema 175 Edge function must not execute accounting posting.');

assert.ok(/\[functions\.finance-job-completion-posting-approval\]\s+verify_jwt = true/s.test(config),'Schema 175 Edge function must require JWT verification.');
assert.ok(pkg.includes('"test:finance-posting-safety"'),'package.json must expose the Schema 175 source gate.');
assert.ok(workflow.includes('npm run test:finance-posting-safety'),'GitHub CI must run the Schema 175 source gate.');

console.log('Schema 175 Finance posting safety foundation source gate: PASS');
