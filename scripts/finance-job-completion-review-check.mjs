#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('sql/172_finance_review_disposition_candidate_authority.sql');
const endpoint=read('supabase/functions/finance-job-completion-review/index.ts');
const financeUi=read('js/finance-ui.js');
const jobsBoundary=read('js/jobs-finance-boundary.js');
const runtime=read('js/module-runtime.js');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const dispositionSection=migration.split('create or replace function public.ywi_finance_dispose_job_completion_review')[1]?.split('create or replace function public.ywi_finance_generate_job_completion_candidates')[0] || '';
const generationSection=migration.split('create or replace function public.ywi_finance_generate_job_completion_candidates')[1]?.split('revoke all on function public.ywi_finance_dispose_job_completion_review')[0] || '';
const executableSection=`${dispositionSection}\n${generationSection}`;
const failures=[];
const check=(name,ok)=>{console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failures.push(name);};

check('schema172-transaction-balanced',(migration.match(/^begin;$/gmi)||[]).length===1&&(migration.match(/^commit;$/gmi)||[]).length===1);
check('schema172-private-disposition-table',migration.includes('create table if not exists public.finance_job_completion_review_dispositions')&&migration.includes('alter table public.finance_job_completion_review_dispositions enable row level security;')&&migration.includes('revoke all on table public.finance_job_completion_review_dispositions from public, anon, authenticated;'));
check('schema172-immutable-human-disposition',migration.includes("disposition_status in ('approved','rejected')")&&dispositionSection.includes("already has an immutable disposition")&&dispositionSection.includes('Finance disposition reason is required'));
check('schema172-disposition-service-role-only',migration.includes('grant execute on function public.ywi_finance_dispose_job_completion_review(uuid,text,text,uuid) to service_role;')&&migration.includes('revoke all on function public.ywi_finance_dispose_job_completion_review(uuid,text,text,uuid) from public,anon,authenticated;'));
check('schema172-generation-service-role-only',migration.includes('grant execute on function public.ywi_finance_generate_job_completion_candidates(uuid,uuid) to service_role;')&&migration.includes('revoke all on function public.ywi_finance_generate_job_completion_candidates(uuid,uuid) from public,anon,authenticated;'));
check('schema172-canonical-work-order-amounts',generationSection.includes('v_work_order.subtotal')&&generationSection.includes('v_work_order.tax_total')&&generationSection.includes('v_work_order.total_amount')&&!/p_(?:subtotal|tax_total|total_amount|amount)\b/i.test(generationSection));
check('schema172-documentary-journal-only',generationSection.includes("'basis','canonical_completion_review_documentary_totals_only'")&&!/debit_account_id|credit_account_id|gl_account_id/i.test(generationSection));
check('schema172-draft-candidates-only',generationSection.includes("'draft',v_candidate_number")&&generationSection.includes("v_review.id,v_intake.job_id,'draft'")&&migration.includes('Schema 172 does not authorize candidate posting.'));
check('schema172-idempotent-candidates',migration.includes('uq_job_invoice_candidates_schema172_finance_intake')&&migration.includes('uq_job_journal_candidates_schema172_finance_intake')&&generationSection.includes("payload->>'finance_intake_id'=v_intake.id::text"));
check('schema172-database-bypass-guards',migration.includes('trg_guard_finance_completion_invoice_candidate')&&migration.includes('trg_guard_finance_completion_journal_candidate')&&migration.includes('Finance approval is required before invoice candidate generation.')&&migration.includes('Invoice candidate amounts must come from canonical work-order totals.'));
check('schema172-no-jobs-writeback',!/update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(executableSection));
check('schema172-no-posting-payment-provider-mutation',!/insert\s+into\s+public\.(?:ar_invoices|gl_batches|gl_entries|payments)\b/i.test(generationSection)&&!/stripe|paypal|payment_intent|paypal_order/i.test(generationSection));
check('schema172-private-review-views',migration.includes('create or replace view public.v_finance_job_completion_review_queue')&&migration.includes('create or replace view public.v_finance_job_completion_review_status')&&migration.includes('revoke all on table public.v_finance_job_completion_review_queue from public,anon,authenticated;'));
check('schema172-it-health-visible',migration.includes("'finance_completion_human_disposition'")&&migration.includes("'finance_completion_candidate_generation'")&&migration.includes('create or replace view public.v_it_cross_module_consumer_health'));
check('schema172-assertions',migration.includes('ywi_finance_job_completion_review_assertions()')&&migration.includes("'schema172_canonical_amount_source'")&&migration.includes("'schema172_no_posting_or_provider_mutation'"));
check('schema172-edge-finance-view',endpoint.includes('hasModuleAccess(supabase, actorProfile, "finance", "view")')&&endpoint.includes('v_finance_job_completion_review_queue'));
check('schema172-edge-finance-approve',endpoint.includes('hasModuleAccess(supabase, actorProfile, "finance", "approve")')&&endpoint.includes('ywi_finance_dispose_job_completion_review')&&endpoint.includes('ywi_finance_generate_job_completion_candidates'));
check('schema172-edge-rejects-browser-financial-truth',endpoint.includes('forbiddenFinancialFields')&&endpoint.includes('SERVER_OWNED_FINANCIAL_FIELDS')&&endpoint.includes('"subtotal"')&&endpoint.includes('"tax_total"')&&endpoint.includes('"total_amount"')&&endpoint.includes('"stripe"')&&endpoint.includes('"paypal"'));
check('schema172-finance-ui-two-step',financeUi.includes("action:'dispose'")&&financeUi.includes("action:'generate_candidates'")&&financeUi.includes('Generate draft candidates')&&!financeUi.includes("action:'post_candidate'")&&financeUi.includes('Posting, payments, Stripe and PayPal remain unauthorized'));
check('schema172-jobs-controls-retired',jobsBoundary.includes('jobCreateInvoiceCandidate')&&jobsBoundary.includes('jobCreateJournalCandidate')&&jobsBoundary.includes('jobPostInvoiceCandidate')&&jobsBoundary.includes('jobPostJournalCandidate')&&jobsBoundary.includes('button.hidden = true'));
check('schema172-jobs-boundary-loaded-after-jobs-ui',runtime.includes("scripts: Object.freeze(['/js/jobs-ui.js','/js/jobs-finance-boundary.js'])"));
check('schema172-no-fifth-module',!/insert\s+into\s+public\.app_modules[\s\S]*?['"]it['"]/i.test(migration));
check('schema172-no-core-identity-duplication',!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:profiles|clients|client_sites|jobs|equipment_master|customer_assets|service_contract_documents)\b/i.test(migration));
check('schema172-marker',migration.includes('172::int as expected_schema_version')&&migration.includes("'172_finance_review_disposition_candidate_authority'")&&migration.includes("'2026-09-02d'"));
check('schema172-workflow-gate',workflow.includes('npm run test:finance-completion-review'));

if(failures.length){
  console.error(`Schema 172 Finance completion review gate failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Schema 172 Finance review disposition/candidate authority source gate: PASS');