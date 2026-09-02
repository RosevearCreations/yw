#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('sql/167_real_cross_module_event_wiring.sql');
const boundaries = read('supabase/functions/_shared/module-write-boundaries.ts');
const failures = [];
const check = (name, ok, detail='') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

check('schema167-transaction-balanced', (migration.match(/^begin;$/gmi) || []).length === 1 && (migration.match(/^commit;$/gmi) || []).length === 1);
check('schema167-admin-real-mutation-trigger', migration.includes('trg_emit_profile_access_changed') && migration.includes('after insert on public.app_module_permission_audit') && migration.includes("'admin.profile_access_changed:audit:' || new.id::text"));
check('schema167-admin-publishes-formal-event', migration.includes("'admin.profile_access_changed'") && migration.includes("'profile',\n    new.target_profile_id::text"));
check('schema167-dispatch-contract-converged', migration.includes("'dispatch_schedule','jobs','approve','write','dispatch','jobs.job_scheduled',true,true") && boundaries.includes("dispatch_schedule: contract('dispatch_schedule', 'jobs', 'approve', 'write', 'dispatch', 'jobs.job_scheduled', true)"));
check('schema167-dispatch-canonical-job-required', migration.includes('must resolve to canonical jobs.id before scheduling') && migration.includes('new.job_id := v_job_id'));
check('schema167-dispatch-atomic-triggers', migration.includes('trg_prepare_dispatch_job_schedule') && migration.includes('trg_emit_job_scheduled') && migration.includes('update public.work_orders') && migration.includes("'jobs.job_scheduled:dispatch:' || new.id::text"));
check('schema167-private-trigger-functions', ['ywi_emit_profile_access_changed','ywi_prepare_dispatch_job_schedule','ywi_emit_job_scheduled'].every((name) => migration.includes(`revoke all on function public.${name}() from public, anon, authenticated;`)));
check('schema167-private-status-and-assertions', migration.includes('v_cross_module_event_wiring_status') && migration.includes('ywi_cross_module_event_wiring_assertions') && migration.includes('revoke all on table public.v_cross_module_event_wiring_status from public, anon, authenticated;'));
check('schema167-publisher-remains-server-only', migration.includes("routine_name='ywi_publish_cross_module_event'") && migration.includes("grantee in ('anon','authenticated','PUBLIC')"));
check('schema167-no-core-identity-duplication', !/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:profiles|clients|client_sites|jobs|equipment_master|customer_assets|service_contract_documents)\b/i.test(migration));
check('schema167-four-modules-only', !/insert\s+into\s+public\.app_modules[\s\S]*?['"]it['"]/i.test(migration));
check('schema167-release-evidence-dynamic', migration.includes("e.schema_version=expected.expected_schema_version") && migration.includes('ss.expected_schema_version as release_schema_version') && !migration.includes("e.schema_version=166 then 'green'"));
check('schema167-repository-policy-separate', migration.includes("e.branch_protection_reported is false then 'amber'") && migration.includes('repository enforcement is evaluated separately'));
check('schema167-schema-marker', migration.includes("167::int as expected_schema_version") && migration.includes("'167_real_cross_module_event_wiring'") && migration.includes("'2026-09-01i'"));

if (failures.length) {
  console.error(`\nSchema 167 cross-module event wiring gate failed: ${failures.length} checks.`);
  process.exit(1);
}
console.log('\nSchema 167 cross-module event wiring gate passed.');
