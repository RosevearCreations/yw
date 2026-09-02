#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('sql/171_finance_consumer_execution_retry.sql');
const endpoint=read('supabase/functions/admin-it-control/index.ts');
const ui=read('js/it-readiness-ui.js');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const failures=[];
const check=(name,ok)=>{console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failures.push(name);};

check('schema171-transaction-balanced',(migration.match(/^begin;$/gmi)||[]).length===1&&(migration.match(/^commit;$/gmi)||[]).length===1);
check('schema171-run-ledger-private',migration.includes('create table if not exists public.finance_job_completion_consumer_runs')&&migration.includes('alter table public.finance_job_completion_consumer_runs enable row level security;')&&migration.includes('revoke all on table public.finance_job_completion_consumer_runs from public, anon, authenticated;'));
check('schema171-failure-ledger-private',migration.includes('create table if not exists public.finance_job_completion_consumer_failures')&&migration.includes('alter table public.finance_job_completion_consumer_failures enable row level security;')&&migration.includes('revoke all on table public.finance_job_completion_consumer_failures from public, anon, authenticated;'));
check('schema171-retry-ceiling',migration.includes('attempt_count between 1 and 3')&&migration.includes("'exhausted'")&&migration.includes("interval '15 minutes'")&&migration.includes("interval '1 hour'"));
check('schema171-controlled-runner',migration.includes('ywi_finance_run_job_completion_consumer')&&migration.includes("p_mode text default 'standard'")&&migration.includes("'retry_failed'"));
check('schema171-service-role-only-runner',migration.includes('revoke all on function public.ywi_finance_run_job_completion_consumer(integer,text) from public, anon, authenticated;')&&migration.includes('grant execute on function public.ywi_finance_run_job_completion_consumer(integer,text) to service_role;'));
check('schema171-helper-not-service-callable',migration.includes('revoke all on function public.ywi_finance_process_job_completed_event(bigint) from public, anon, authenticated, service_role;'));
check('schema171-legacy-entrypoint-retired',migration.includes('revoke all on function public.ywi_finance_consume_job_completed_events(integer) from service_role;'));
check('schema171-event-contract-gate',migration.includes("event_key='jobs.job_completed'")&&migration.includes("'finance'=any(c.consumer_modules)")&&migration.includes('contract_version=1'));
check('schema171-schema-current-gate',migration.includes('s.expected_schema_version >= 171')&&migration.includes('s.latest_applied_schema_version >= 171')&&migration.includes("s.drift_status='current'"));
check('schema171-per-event-failure-isolation',migration.includes('get stacked diagnostics')&&migration.includes('on conflict(source_event_id) do update')&&migration.includes('v_failed := v_failed + 1'));
check('schema171-run-status-proof',migration.includes("'completed_with_failures'")&&migration.includes("run_status='failed'"));
check('schema171-review-only',migration.includes("'queue_review'")&&!migration.includes("'create_invoice_candidate'")&&!migration.includes("'create_journal_candidate'"));
check('schema171-no-jobs-state-writeback',!/update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(migration));
check('schema171-no-scheduler',!/cron\.|pg_cron|schedule\s+/i.test(migration));
check('schema171-private-execution-status',migration.includes('create or replace view public.v_finance_job_completion_execution_status')&&migration.includes('with (security_invoker=true)')&&migration.includes('revoke all on table public.v_finance_job_completion_execution_status from public, anon, authenticated;'));
check('schema171-it-health-extended',migration.includes("'finance_completion_execution_readiness'")&&migration.includes("'finance_completion_retry_state'")&&migration.includes('create or replace view public.v_it_cross_module_consumer_health'));
check('schema171-execution-assertions',migration.includes('ywi_finance_job_completion_execution_assertions()')&&migration.includes("'finance_consumer_controlled_entrypoint_server_only'")&&migration.includes("'finance_consumer_legacy_entrypoint_retired'"));
check('schema171-it-readiness-registered',migration.includes("'finance_consumer_execution_control','Architecture'")&&migration.includes("'Admin > I.T. Readiness'"));
check('schema171-browser-remains-read-only',endpoint.includes('v_it_cross_module_consumer_health')&&!endpoint.includes('ywi_finance_run_job_completion_consumer')&&!ui.includes('ywi_finance_run_job_completion_consumer')&&!ui.includes('retry_failed'));
check('schema171-existing-it-panel-reuses-health-feed',ui.includes("panel('cross_module_consumer_health'"));
check('schema171-no-fifth-module',!/insert\s+into\s+public\.app_modules[\s\S]*?['"]it['"]/i.test(migration));
check('schema171-no-core-identity-duplication',!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:profiles|clients|client_sites|jobs|equipment_master|customer_assets|service_contract_documents)\b/i.test(migration));
check('schema171-marker',migration.includes('171::int as expected_schema_version')&&migration.includes("'171_finance_consumer_execution_retry'")&&migration.includes("'2026-09-02c'"));
check('schema171-workflow-gate',workflow.includes('npm run test:finance-consumer-execution'));

if(failures.length){
  console.error(`Schema 171 Finance consumer execution gate failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Schema 171 Finance completion consumer execution/retry source gate: PASS');