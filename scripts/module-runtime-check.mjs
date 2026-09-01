#!/usr/bin/env node
/** Schema 161 source gate: Shared Core + standalone module contract. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const runtime = read('js/module-runtime.js');
const migration = read('sql/161_shared_core_module_contract.sql');
const security = read('js/security.js');
const results = [];
const add = (name, ok, details = '') => results.push({ name, ok: !!ok, details });
const hasAll = (text, values) => values.every((value) => text.includes(value));

const moduleKeys = ['safety','finance','jobs','admin'];
const coreRelations = ['profiles','clients','client_sites','jobs','equipment_master','customer_assets','service_contract_documents'];
const moduleScripts = [
  '/js/hse-ops-ui.js','/js/logbook-ui.js','/js/reports-ui.js','/js/forms-toolbox.js','/js/forms-ppe.js','/js/forms-firstaid.js','/js/forms-incident.js','/js/forms-inspection.js','/js/forms-drill.js',
  '/js/finance-ui.js','/js/jobs-ui.js','/js/admin-actions.js','/js/admin-ui.js','/js/operations-cockpit.js','/js/module-access-ui.js','/js/it-readiness-ui.js'
];

add('schema161-transaction-balanced', (migration.match(/^begin;$/gmi) || []).length === 1 && (migration.match(/^commit;$/gmi) || []).length === 1, 'Migration has one BEGIN and one COMMIT.');
add('schema161-core-contract-registry', hasAll(migration, ['app_core_entity_contracts','shared_by_modules','canonical_relation','primary_key_type']), 'Canonical shared identities are explicit database contracts.');
add('schema161-module-contract-registry', hasAll(migration, ['app_module_contracts','entry_scripts','core_dependencies','owns_domains','permission_driven']), 'Each top-level module has an independently loadable contract.');
add('schema161-no-parallel-business-identity-tables', !/(create table if not exists public\.(module_|safety_|finance_|jobs_|admin_)(customers|clients|people|profiles|jobs|assets|documents)\b)/i.test(migration), 'Migration does not create module-local duplicates of shared business identities.');
add('schema161-core-relations-match-existing-canonical-data', coreRelations.every((relation) => migration.includes(`'${relation}'`) && runtime.includes(`relation: '${relation}'`)), `Core relations: ${coreRelations.join(', ')}`);
add('schema161-four-module-contracts', moduleKeys.every((key) => migration.includes(`('${key}'`) && runtime.includes(`${key}: Object.freeze({`)), 'Safety, Finance, Jobs and Admin have matching DB/browser manifests.');
add('schema161-module-scripts-declared', moduleScripts.every((script) => migration.includes(script) && runtime.includes(script)), 'DB and browser manifests agree on module entry scripts.');
add('schema161-private-contract-control-plane', hasAll(migration, [
  'alter table public.app_core_entity_contracts enable row level security;',
  'alter table public.app_module_contracts enable row level security;',
  'revoke all on table public.app_core_entity_contracts from public, anon, authenticated;',
  'revoke all on table public.app_module_contracts from public, anon, authenticated;',
  'grant select on table public.app_core_entity_contracts to service_role;',
  'grant select on table public.app_module_contracts to service_role;'
]), 'Contract registries use explicit RLS and service-role-only grants.');
add('schema161-security-assertions-private', hasAll(migration, ['ywi_module_contract_security_assertions','security invoker','set search_path=public','grant execute on function public.ywi_module_contract_security_assertions() to service_role;']), 'Contract assertion RPC is invoker-safe and private.');
add('schema161-it-readiness-wiring', hasAll(migration, ['shared_core_contract','standalone_module_contract','schema161_shared_core_contract']), 'Architecture readiness is represented in I.T. controls.');
add('schema161-schema-drift-marker', hasAll(migration, ['161::int as expected_schema_version', "'161_shared_core_module_contract'", "'2026-09-01c'"]), 'Schema/version marker advances to 161.');

add('runtime-requires-authentication', hasAll(runtime, ['!stateNow.isAuthenticated','stateNow.pendingAuthResolution','stateNow.needsAccountSetup']), 'Runtime refuses module loading before auth/account readiness.');
add('runtime-uses-permission-check', runtime.includes("sec.canViewModule(moduleKey, currentRole(), 'view') === true"), 'Browser module loading is permission driven.');
add('runtime-loads-only-manifest-scripts', hasAll(runtime, ['for (const script of manifest.scripts)','await loadScript(script, moduleKey)']), 'Module loader follows the bounded manifest.');
add('runtime-exposes-core-contract', hasAll(runtime, ['CORE_ENTITY_CONTRACTS','getCoreContract','YWIModuleRuntime']), 'Shared Core contract is available to client modules.');
add('runtime-preserves-server-authorization', security.includes('Hidden navigation is not authorization') || security.includes('Module permissions independently control'), 'Runtime is additive to existing security; it is not the server authorization boundary.');

const failures = results.filter((item) => !item.ok);
for (const item of results) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`);
}
if (failures.length) {
  console.error(`\nSchema 161 module runtime gate failed: ${failures.length}/${results.length} checks.`);
  process.exit(1);
}
console.log(`\nSchema 161 module runtime gate passed: ${results.length}/${results.length} checks.`);
