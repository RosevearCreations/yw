#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('sql/164_cross_module_event_write_boundaries.sql');
const failures = [];
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failures.push(name); };

check('schema164-transaction-balanced', (migration.match(/^begin;$/gmi) || []).length === 1 && (migration.match(/^commit;$/gmi) || []).length === 1);
check('schema164-private-event-contracts', migration.includes('app_cross_module_event_contracts') && migration.includes('revoke all on table public.app_cross_module_event_contracts from public, anon, authenticated;'));
check('schema164-private-event-outbox', migration.includes('app_cross_module_events') && migration.includes('revoke all on table public.app_cross_module_events from public, anon, authenticated;'));
check('schema164-server-only-publisher', migration.includes('ywi_publish_cross_module_event') && migration.includes('grant execute on function public.ywi_publish_cross_module_event') && !/grant execute on function public\.ywi_publish_cross_module_event[^;]+to\s+(?:anon|authenticated|public)/i.test(migration));
check('schema164-validating-trigger', migration.includes('trg_validate_cross_module_event') && migration.includes('Event % must be produced by module'));
check('schema164-domain-ownership-proof', migration.includes('v_module_domain_ownership') && migration.includes('module_domain_ownership_unique'));
check('schema164-no-core-identity-duplication', !/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:profiles|clients|client_sites|jobs|equipment_master|customer_assets|service_contract_documents)\b/i.test(migration));
check('schema164-readiness-and-drift', migration.includes('cross_module_write_boundaries') && migration.includes('164::int as expected_schema_version') && migration.includes("'2026-09-01f'"));
check('schema164-versioned-contract-events', ['jobs.job_scheduled','jobs.job_completed','safety.incident_recorded','finance.invoice_posted','admin.profile_access_changed'].every((key) => migration.includes(`'${key}'`)));

if (failures.length) {
  console.error(`\nSchema 164 module boundary gate failed: ${failures.length} checks.`);
  process.exit(1);
}
console.log('\nSchema 164 module boundary gate passed.');
