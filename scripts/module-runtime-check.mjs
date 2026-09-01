#!/usr/bin/env node
/** Schema 161-162 source gate: Shared Core + permission-driven standalone modules. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const runtime = read('js/module-runtime.js');
const migration161 = read('sql/161_shared_core_module_contract.sql');
const migration162 = read('sql/162_permission_driven_module_runtime.sql');
const security = read('js/security.js');
const index = read('index.html');
const serverWorker = read('server-worker.js');
const results = [];
const add = (name, ok, details = '') => results.push({ name, ok: !!ok, details });
const hasAll = (text, values) => values.every((value) => text.includes(value));

const moduleKeys = ['safety','finance','jobs','admin'];
const coreRelations = ['profiles','clients','client_sites','jobs','equipment_master','customer_assets','service_contract_documents'];
const moduleScripts = [
  '/js/hse-ops-ui.js','/js/logbook-ui.js','/js/reports-ui.js','/js/forms-toolbox.js','/js/forms-ppe.js','/js/forms-firstaid.js','/js/forms-incident.js','/js/forms-inspection.js','/js/forms-drill.js',
  '/js/finance-ui.js','/js/jobs-ui.js','/js/admin-actions.js','/js/admin-ui.js','/js/operations-cockpit.js','/js/module-access-ui.js','/js/it-readiness-ui.js'
];

add('schema161-transaction-balanced', (migration161.match(/^begin;$/gmi) || []).length === 1 && (migration161.match(/^commit;$/gmi) || []).length === 1, 'Schema 161 has one BEGIN and one COMMIT.');
add('schema161-core-contract-registry', hasAll(migration161, ['app_core_entity_contracts','shared_by_modules','canonical_relation','primary_key_type']), 'Canonical shared identities are explicit database contracts.');
add('schema161-module-contract-registry', hasAll(migration161, ['app_module_contracts','entry_scripts','core_dependencies','owns_domains','permission_driven']), 'Each top-level module has an independently loadable contract.');
add('schema161-no-parallel-business-identity-tables', !/(create table if not exists public\.(module_|safety_|finance_|jobs_|admin_)(customers|clients|people|profiles|jobs|assets|documents)\b)/i.test(migration161), 'Schema 161 does not create module-local duplicates of shared identities.');
add('schema161-core-relations-match-existing-canonical-data', coreRelations.every((relation) => migration161.includes(`'${relation}'`) && runtime.includes(`relation: '${relation}'`)), `Core relations: ${coreRelations.join(', ')}`);
add('schema161-four-module-contracts', moduleKeys.every((key) => migration161.includes(`('${key}'`) && runtime.includes(`${key}: Object.freeze({`)), 'Safety, Finance, Jobs and Admin have matching DB/browser manifests.');
add('schema161-module-scripts-declared', moduleScripts.every((script) => migration161.includes(script) && runtime.includes(script)), 'DB and browser manifests agree on module entry scripts.');
add('schema161-private-contract-control-plane', hasAll(migration161, [
  'alter table public.app_core_entity_contracts enable row level security;',
  'alter table public.app_module_contracts enable row level security;',
  'revoke all on table public.app_core_entity_contracts from public, anon, authenticated;',
  'revoke all on table public.app_module_contracts from public, anon, authenticated;',
  'grant select on table public.app_core_entity_contracts to service_role;',
  'grant select on table public.app_module_contracts to service_role;'
]), 'Contract registries use explicit RLS and service-role-only grants.');
add('schema161-security-assertions-private', hasAll(migration161, ['ywi_module_contract_security_assertions','security invoker','set search_path=public','grant execute on function public.ywi_module_contract_security_assertions() to service_role;']), 'Schema 161 assertion RPC is invoker-safe and private.');

add('schema162-transaction-balanced', (migration162.match(/^begin;$/gmi) || []).length === 1 && (migration162.match(/^commit;$/gmi) || []).length === 1, 'Schema 162 has one BEGIN and one COMMIT.');
add('schema162-contract-v2', hasAll(migration162, ['contract_version=2', "runtime_mode='permission_driven'", 'ywi_permission_runtime_security_assertions']), 'Schema 162 activates permission-driven v2 module contracts.');
add('schema162-no-new-shared-identity-tables', !/create table/i.test(migration162), 'Schema 162 introduces no replacement/parallel business identity tables.');
add('schema162-it-readiness-wiring', hasAll(migration162, ['permission_driven_module_runtime','schema162_permission_runtime']), 'Permission-driven runtime is a tracked I.T. readiness/release item.');
add('schema162-schema-drift-marker', hasAll(migration162, ['162::int as expected_schema_version', "'162_permission_driven_module_runtime'", "'2026-09-01d'"]), 'Schema/version marker advances to 162.');

add('runtime-v2-build', hasAll(runtime, ["const BUILD = '2026-09-01d'", 'const CONTRACT_VERSION = 2']), 'Runtime contract/build is Schema 162.');
add('runtime-requires-authentication', hasAll(runtime, ['!stateNow.isAuthenticated','stateNow.pendingAuthResolution','stateNow.needsAccountSetup']), 'Runtime refuses module loading before auth/account readiness.');
add('runtime-uses-permission-check', runtime.includes("sec.canViewModule(moduleKey, currentRole(), 'view') === true"), 'Browser module loading is permission driven.');
add('runtime-loads-only-manifest-scripts', hasAll(runtime, ['for (const script of manifest.scripts)','await loadScript(script, moduleKey)']), 'Module loader follows the bounded manifest.');
add('runtime-purges-stale-loaded-code', hasAll(runtime, ['staleRuntimeReason','permission_removed:','profile_changed','signed_out','window.location.reload()']), 'Sign-out, identity change, and permission downgrade purge loaded module code.');
add('runtime-exposes-core-contract', hasAll(runtime, ['CORE_ENTITY_CONTRACTS','getCoreContract','YWIModuleRuntime']), 'Shared Core contract is available to client modules.');
add('runtime-preserves-server-authorization', security.includes('Hidden navigation is not authorization') || security.includes('Module permissions independently control'), 'Dynamic loading is additive; server authorization remains separate.');

add('shell-loads-runtime-once', (index.match(/<script src="\/js\/module-runtime\.js\?v=/g) || []).length === 1, 'Shared shell statically loads one module runtime.');
add('shell-does-not-eager-load-business-modules', moduleScripts.every((script) => !index.includes(`<script src="${script}?v=`)), 'No Safety, Finance, Jobs, or Admin bundle is eagerly loaded by index.html.');
add('shell-keeps-shared-core-services', hasAll(index, ['/js/security.js?','/js/auth.js?','/js/api.js?','/js/reference-data.js?','/app.js?']), 'Core/auth/data/application shell stays available independently of business modules.');

add('service-worker-schema162-cache-marker', serverWorker.includes("const CACHE_NAME = 'ywi-shell-v2026-09-01d';"), 'Service worker uses the Schema 162 cache namespace.');
add('service-worker-precaches-runtime-core', serverWorker.includes("'/js/module-runtime.js'"), 'Offline Shared Core includes the permission-driven runtime.');
add('service-worker-does-not-precache-business-modules', moduleScripts.every((script) => !serverWorker.includes(`'${script}'`)), 'Service worker installation cannot pre-download Safety, Finance, Jobs, or Admin bundles.');
add('service-worker-dynamic-module-cache-is-request-driven', hasAll(serverWorker, ['url.pathname.startsWith(\'/js/\')','fetch(req)','cache.put(req, copy)']), 'Authorized module bundles may be cached only after an actual browser request.');

const failures = results.filter((item) => !item.ok);
for (const item of results) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`);
}
if (failures.length) {
  console.error(`\nSchema 161-162 module runtime gate failed: ${failures.length}/${results.length} checks.`);
  process.exit(1);
}
console.log(`\nSchema 161-162 module runtime gate passed: ${results.length}/${results.length} checks.`);
