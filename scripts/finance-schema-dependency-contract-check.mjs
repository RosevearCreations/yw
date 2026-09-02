#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const schema169=read('sql/169_finance_job_completion_consumer.sql');
const schema172=read('sql/172_finance_review_disposition_candidate_authority.sql');
const schema173=read('sql/173_finance_schema_dependency_contract_guard.sql');
const schema174=read('sql/174_finance_dependency_type_convergence.sql');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const failures=[];
const check=(name,ok)=>{console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failures.push(name);};

const intakeDecl=schema169.split('create table if not exists public.finance_job_completion_intake')[1]?.split(');')[0]||'';
const requiredIntakeColumns=['id','source_event_id','job_id','completion_review_id','finance_queue_event_id','intake_status','source_occurred_at','source_payload','first_seen_at','updated_at'];

check('schema173-schema169-intake-contract-source',requiredIntakeColumns.every((c)=>new RegExp(`\\b${c}\\b`).test(intakeDecl)));
check('schema173-schema169-first-seen-canonical',/first_seen_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(intakeDecl)&&!/\bcreated_at\b/i.test(intakeDecl));
check('schema173-schema172-no-nonexistent-intake-created-at',!schema172.includes('i.created_at')&&!schema172.includes('order by created_at desc'));
check('schema173-schema172-first-seen-guards',(schema172.match(/order by first_seen_at desc/g)||[]).length===2);
check('schema173-schema172-first-seen-review-views',schema172.includes('i.first_seen_at as queued_at')&&schema172.includes('order by i.first_seen_at asc')&&schema172.includes('min(i.first_seen_at)'));
check('schema173-schema172-transaction-balanced',(schema172.match(/^begin;$/gmi)||[]).length===1&&(schema172.match(/^commit;$/gmi)||[]).length===1);
check('schema173-transaction-balanced',(schema173.match(/^begin;$/gmi)||[]).length===1&&(schema173.match(/^commit;$/gmi)||[]).length===1);
check('schema173-private-dependency-registry',schema173.includes('create table if not exists public.app_schema_dependency_contracts')&&schema173.includes('alter table public.app_schema_dependency_contracts enable row level security;')&&schema173.includes('revoke all on table public.app_schema_dependency_contracts from public,anon,authenticated;'));
check('schema173-live-dependency-view',schema173.includes('create or replace view public.v_it_schema_dependency_status')&&schema173.includes('with (security_invoker=true)')&&schema173.includes('information_schema.columns'));
check('schema173-finance-intake-exact-contract',requiredIntakeColumns.every((c)=>schema173.includes(`'${c}'`))&&schema173.includes("'timestamp with time zone','finance',169,172,true,'Canonical Finance queue/first-seen timestamp"));
check('schema173-runtime-first-seen-assertion',schema173.includes("'schema173_schema172_first_seen_runtime'")&&schema173.includes("order by first_seen_at desc")&&schema173.includes("pg_get_viewdef('public.v_finance_job_completion_review_queue'"));
check('schema173-it-preflight-wiring',schema173.includes('create or replace view public.v_admin_schema_preflight_checks')&&schema173.includes("'schema173_finance_dependency_contract'")&&schema173.includes("'Admin > I.T. Readiness'"));
check('schema173-assertions-private',schema173.includes('ywi_schema_dependency_assertions()')&&schema173.includes('revoke all on function public.ywi_schema_dependency_assertions() from public,anon,authenticated;')&&schema173.includes('grant execute on function public.ywi_schema_dependency_assertions() to service_role;'));
check('schema173-no-business-mutation',!/insert\s+into\s+public\.(?:job_invoice_candidates|job_journal_candidates|job_completion_accounting_events|payments|ar_invoices|gl_batches|gl_entries)\b/i.test(schema173));
check('schema173-no-jobs-writeback',!/update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(schema173));
check('schema173-no-provider-truth',!/stripe|paypal|payment_intent|paypal_order/i.test(schema173));
check('schema173-no-fifth-module',!/insert\s+into\s+public\.app_modules[\s\S]*?['"]it['"]/i.test(schema173));
check('schema173-historical-marker',schema173.includes('173::int as expected_schema_version')&&schema173.includes("'173_finance_schema_dependency_contract_guard'")&&schema173.includes("'2026-09-02e'"));

check('schema174-transaction-balanced',(schema174.match(/^begin;$/gmi)||[]).length===1&&(schema174.match(/^commit;$/gmi)||[]).length===1);
check('schema174-live-uuid-prerequisite',schema174.includes("table_name='job_completion_reviews'")&&schema174.includes("column_name='work_order_id'")&&schema174.includes("data_type='uuid'"));
check('schema174-targeted-contract-correction',schema174.includes("contract_key='completion_review_work_order'")&&schema174.includes("set expected_data_type='uuid'")&&schema174.includes("relation_name='job_completion_reviews'")&&schema174.includes("column_name='work_order_id'"));
check('schema174-fails-closed-on-missing-contract',schema174.includes("raise exception 'Schema 173 completion_review_work_order dependency contract is missing.'"));
check('schema174-it-readiness-wiring',schema174.includes("'finance_dependency_type_convergence','Architecture'")&&schema174.includes("'Admin > I.T. Readiness'"));
check('schema174-metadata-only',!/insert\s+into\s+public\.(?:job_invoice_candidates|job_journal_candidates|job_completion_accounting_events|payments|ar_invoices|gl_batches|gl_entries)\b/i.test(schema174)&&!/update\s+public\.(?:jobs|work_orders|job_completion_reviews|finance_job_completion_intake)\b/i.test(schema174));
check('schema174-no-provider-truth',!/stripe|paypal|payment_intent|paypal_order/i.test(schema174));
check('schema174-no-fifth-module',!/insert\s+into\s+public\.app_modules[\s\S]*?['"]it['"]/i.test(schema174));
check('schema174-marker',schema174.includes('174::int as expected_schema_version')&&schema174.includes("'174_finance_dependency_type_convergence'")&&schema174.includes("'2026-09-02f'"));
check('schema174-workflow-gate',workflow.includes('npm run test:finance-schema-dependencies'));

if(failures.length){
  console.error(`Schema 174 Finance dependency type-convergence gate failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Schema 174 Finance schema dependency/type convergence source gate: PASS');
