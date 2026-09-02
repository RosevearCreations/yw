import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('sql/169_finance_job_completion_consumer.sql');
const completion = read('sql/168_job_completion_event_wiring.sql');
const eventContracts = read('sql/164_cross_module_event_write_boundaries.sql');
const failures = [];
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failures.push(name);
};

check('schema169-transaction-balanced',
  (migration.match(/^begin;$/gmi) || []).length === 1 && (migration.match(/^commit;$/gmi) || []).length === 1);
check('schema169-finance-intake-table',
  migration.includes('create table if not exists public.finance_job_completion_intake') &&
  migration.includes('source_event_id bigint not null references public.app_cross_module_events(event_id)') &&
  migration.includes('job_id bigint not null references public.jobs(id)') &&
  migration.includes('completion_review_id uuid not null references public.job_completion_reviews(id)'));
check('schema169-source-event-idempotent',
  migration.includes('constraint finance_job_completion_intake_source_uidx unique(source_event_id)'));
check('schema169-consumer-contract-reused',
  eventContracts.includes("'jobs.job_completed','jobs',array['finance','admin'],'job',1") &&
  completion.includes("'jobs.job_completed:review:' || new.id::text") &&
  migration.includes("where e.event_key='jobs.job_completed'"));
check('schema169-contract-payload-validation',
  migration.includes("r.aggregate_type is distinct from 'job'") &&
  migration.includes("r.payload->>'job_id'") &&
  migration.includes("r.payload->>'contract_version'") &&
  migration.includes("r.payload->>'completion_review_id'"));
check('schema169-service-role-only-consumer',
  migration.includes('revoke all on function public.ywi_finance_consume_job_completed_events(integer) from public, anon, authenticated;') &&
  migration.includes('grant execute on function public.ywi_finance_consume_job_completed_events(integer) to service_role;'));
check('schema169-private-intake-control-plane',
  migration.includes('alter table public.finance_job_completion_intake enable row level security;') &&
  migration.includes('revoke all on table public.finance_job_completion_intake from public, anon, authenticated;') &&
  migration.includes('revoke all on table public.v_finance_job_completion_consumer_status from public, anon, authenticated;'));
check('schema169-finance-review-queue',
  migration.includes('insert into public.job_completion_accounting_events') &&
  migration.includes("'queue_review'") &&
  migration.includes("'consumer','finance_job_completion_consumer'"));
check('schema169-no-jobs-state-writeback',
  !/update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(migration));
check('schema169-no-core-identity-duplication',
  !/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:profiles|clients|client_sites|jobs|equipment_master|customer_assets|service_contract_documents)\b/i.test(migration));
check('schema169-four-modules-it-admin-only',
  migration.includes("'Admin > I.T. Readiness'") &&
  !/module_key\s*=\s*['"]it['"]|\('it'\s*,/i.test(migration));
check('schema169-it-readiness-assertions',
  migration.includes('ywi_finance_job_completion_consumer_assertions()') &&
  migration.includes("'finance_job_completion_consumer','Architecture'"));
check('schema169-marker',
  migration.includes('169::int as expected_schema_version') &&
  migration.includes("'169_finance_job_completion_consumer'") &&
  migration.includes("'2026-09-02a'"));

if (failures.length) {
  console.error(`Schema 169 Finance job-completion consumer gate failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Schema 169 Finance job-completion consumer source gate: PASS');
