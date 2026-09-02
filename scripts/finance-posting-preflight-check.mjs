#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('sql/176_finance_posting_preflight_accounting_mapping.sql','utf8');
const edge=fs.readFileSync('supabase/functions/finance-job-completion-posting-approval/index.ts','utf8');

const required=[
  'v_finance_posting_account_mapping_authority',
  'ywi_finance_job_completion_posting_preflight',
  'v_finance_job_completion_posting_preflight_queue',
  'v_it_finance_posting_preflight_status',
  'ywi_finance_posting_preflight_assertions',
  'job_invoice_postings','ar_invoices','job_journal_postings','gl_journal_batches','gl_journal_entries',
  'accountant_export_mapping_rules','chart_of_accounts',
  'accounts_receivable','service_revenue','sales_tax_payable',
  'passed_execution_closed','POSTING_APPROVAL_REQUIRED','PAIR_IDENTITY_MISMATCH','PAIR_REVENUE_MISMATCH',
  'posting_execution_authorized','provider_mutation_authorized',
  "false as posting_execution_authorized","false as provider_mutation_authorized",
  'schema176_finance_posting_preflight_accounting_mapping',
  '176_finance_posting_preflight_accounting_mapping'
];
for(const text of required) assert.ok(migration.includes(text),`Schema 176 migration missing ${text}`);

assert.ok(/revoke all on function public\.ywi_finance_job_completion_posting_preflight\(uuid\) from public,anon,authenticated/i.test(migration),'Preflight RPC must not be browser executable.');
assert.ok(/grant execute on function public\.ywi_finance_job_completion_posting_preflight\(uuid\) to service_role/i.test(migration),'Preflight RPC must be service-role scoped.');
assert.ok(!/insert\s+into\s+public\.(?:job_invoice_postings|job_journal_postings|ar_invoices|ar_invoice_lines|gl_journal_batches|gl_journal_entries|payments|ar_payments|ap_payments|ar_payment_applications|ap_payment_applications)\b/i.test(migration),'Schema 176 must not create accounting/payment effects.');
assert.ok(!/update\s+public\.(?:jobs|work_orders|job_completion_reviews|job_invoice_candidates|job_journal_candidates|finance_job_completion_posting_approvals)\b/i.test(migration),'Schema 176 must not change Jobs/candidate/approval execution state.');
assert.ok(migration.includes("review_status='approved'")&&migration.includes('mapping_approved'),'Preflight must require accountant-approved active account mappings.');
assert.ok(migration.includes('round(coalesce(v_invoice.subtotal,0),2)<>round(coalesce(v_journal_revenue,0),2)'),'Invoice/journal revenue consistency must be fail-closed.');
assert.ok(migration.includes('trg_guard_schema172_invoice_posting_closed')&&migration.includes('trg_guard_schema172_journal_posting_closed'),'Schema 175 posting guards must remain release assertions.');

assert.ok(edge.includes('action === "preflight"'),'Finance posting Edge boundary must expose read-only preflight action.');
assert.ok(edge.includes('ywi_finance_job_completion_posting_preflight'),'Edge preflight must call the server-owned Schema 176 RPC.');
assert.ok(edge.includes('v_finance_job_completion_posting_preflight_queue'),'Finance list must use the Schema 176 preflight queue.');
assert.ok(edge.includes('v_it_finance_posting_preflight_status'),'Finance list must expose I.T. preflight status.');
assert.ok(edge.includes('posting_execution_authorized: false')&&edge.includes('provider_mutation: false'),'Edge response must keep execution/provider mutation closed.');
assert.ok(!/\.from\("(?:ar_invoices|gl_journal_batches|gl_journal_entries|job_invoice_postings|job_journal_postings)"\)\.(?:insert|update|upsert|delete)/i.test(edge),'Edge boundary must not write directly into accounting execution tables.');

console.log('Schema 176 Finance posting preflight source gate passed.');
