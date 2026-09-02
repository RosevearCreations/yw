import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('sql/168_job_completion_event_wiring.sql');
const closeout = read('sql/158_supervisor_closeout_customer_signoff_invoice_followup.sql');
const adminManage = read('supabase/functions/admin-manage/index.ts');
const eventContract = read('sql/164_cross_module_event_write_boundaries.sql');

const failures = [];
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failures.push(name);
};

check('schema168-transaction-balanced',
  (migration.match(/^begin;$/gmi) || []).length === 1 && (migration.match(/^commit;$/gmi) || []).length === 1);
check('schema168-canonical-job-review-authority',
  migration.includes('create or replace function public.ywi_prepare_job_completion_review()') &&
  migration.includes("tgrelid='public.job_completion_reviews'::regclass") &&
  migration.includes("'jobs.id'"));
check('schema168-server-derived-evidence',
  migration.includes('Never trust client-supplied completion evidence flags') &&
  migration.includes('new.closeout_evidence_complete := v_closeout_complete') &&
  migration.includes('new.client_signoff_complete := v_client_signoff_complete') &&
  migration.includes('new.all_sessions_signed_off := v_sessions_signed'));
check('schema168-final-state-fail-closed',
  migration.includes("new.review_status in ('approved','ready_for_accounting','posted')") &&
  migration.includes('Every work order requires an approved closeout package before job completion.') &&
  migration.includes('Required customer closeout signoff is incomplete for one or more work orders.') &&
  migration.includes('All recorded job sessions require supervisor signoff before job completion.'));
check('schema168-work-order-signoff-is-evidence-only',
  closeout.includes('ywi_rpc_customer_sign_work_order_closeout') &&
  migration.includes('work_order_closeout_not_completion_publisher') &&
  !closeout.includes("'jobs.job_completed'"));
check('schema168-completion-event-contract-reused',
  eventContract.includes("'jobs.job_completed','jobs',array['finance','admin'],'job',1") &&
  migration.includes("'jobs.job_completed'") &&
  migration.includes("'jobs.job_completed:review:' || new.id::text"));
check('schema168-atomic-canonical-state-and-event',
  migration.includes("update public.jobs\n  set status='completed'") &&
  migration.includes("update public.work_orders\n  set status='completed'") &&
  migration.includes('perform public.ywi_publish_cross_module_event('));
check('schema168-dedupe-and-no-browser-publisher',
  migration.includes("'jobs.job_completed:review:' || new.id::text") &&
  migration.includes("routine_name='ywi_publish_cross_module_event'") &&
  migration.includes("grantee in ('anon','authenticated','PUBLIC')"));
check('schema168-browser-evidence-cannot-be-authoritative',
  adminManage.includes('closeout_evidence_complete: body.closeout_evidence_complete === true') &&
  migration.includes('new.closeout_evidence_complete := v_closeout_complete'));
check('schema168-four-modules-it-admin-only',
  migration.includes("'Admin > I.T. Readiness'") && !/module_key\s*=\s*['"]it['"]|\('it'\s*,/i.test(migration));
check('schema168-marker',
  migration.includes('168::int as expected_schema_version') &&
  migration.includes("'168_job_completion_event_wiring'") &&
  migration.includes("'2026-09-01j'"));

if (failures.length) {
  console.error(`Schema 168 job-completion event gate failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Schema 168 job-completion event source gate: PASS');
