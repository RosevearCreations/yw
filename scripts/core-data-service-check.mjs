#!/usr/bin/env node
/** Schema 163 source gate: Shared Core Data service remains canonical, read-only, and permission scoped. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const results = [];
const add = (name, ok, details = '') => results.push({ name, ok: !!ok, details });
const hasAll = (text, values) => values.every((value) => text.includes(value));

const migration = read('sql/163_shared_core_data_service_read_models.sql');
const helperPath = 'supabase/functions/_shared/core-data-read-models.ts';
const endpointPath = 'supabase/functions/core-data-read/index.ts';
const helper = read(helperPath);
const endpoint = read(endpointPath);
const browser = read('js/core-data-service.js');
const index = read('index.html');
const worker = read('server-worker.js');
const config = read('supabase/config.toml');

const entities = ['profile','customer','customer_site','job','equipment','customer_asset','service_document'];
const relations = ['profiles','clients','client_sites','jobs','equipment_master','customer_assets','service_contract_documents'];

add('schema163-transaction-balanced', (migration.match(/^begin;$/gmi) || []).length === 1 && (migration.match(/^commit;$/gmi) || []).length === 1, 'Schema 163 has one BEGIN and one COMMIT.');
add('schema163-no-business-identity-tables', !/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:profiles|clients|client_sites|jobs|equipment_master|customer_assets|service_contract_documents)\b/i.test(migration), 'Schema 163 does not recreate canonical business identity tables.');
add('schema163-seven-read-contracts', entities.every((key) => migration.includes(`'${key}'`)) && relations.every((relation) => migration.includes(`'${relation}'`)), 'All seven Shared Core identities remain mapped to canonical relations.');
add('schema163-one-protected-endpoint', hasAll(migration, ["read_endpoint='core-data-read'", "read_model_mode='protected_edge_directory'", 'read_contract_version=1']), 'Core contracts resolve to one protected Edge directory.');
add('schema163-private-control-plane', hasAll(migration, ['v_core_read_model_contract_status', 'revoke all on table public.v_core_read_model_contract_status from public, anon, authenticated;', 'grant select on table public.v_core_read_model_contract_status to service_role;', 'ywi_core_read_model_security_assertions']), 'Read-model contract metadata and assertions remain service-role control plane.');
add('schema163-readiness-and-drift', hasAll(migration, ['shared_core_data_service', 'schema163_core_data_service', '163::int as expected_schema_version', "'2026-09-01e'"]), 'I.T. readiness, scorecard and schema marker advance together.');

add('server-helper-seven-canonical-relations', entities.every((key) => helper.includes(`${key}: {`)) && relations.every((relation) => helper.includes(`relation: '${relation}'`)), 'Server helper owns one bounded projection per canonical entity.');
add('server-helper-bounded-columns', !/\.select\(\s*['"]\*['"]\s*\)/.test(helper) && helper.includes('.select(contract.columns)'), 'Shared Core service does not use select(*).');
add('server-helper-read-only', !/\.(insert|update|upsert|delete)\s*\(/.test(helper), 'Shared Core helper contains no write method.');
add('server-helper-fails-closed', helper.includes('throw new Error(`Shared Core read failed for ${entityKey}') && !helper.includes('if (error) return []'), 'Schema/query drift is surfaced rather than silently replaced with an empty list.');

add('endpoint-auth-required', hasAll(endpoint, ['supabase.auth.getUser(token)', "select('id,role,is_active')", "actorProfile.is_active !== true"]), 'Endpoint requires a valid active signed-in profile.');
add('endpoint-module-view-required', hasAll(endpoint, ['MODULE_KEYS', 'module_key', "hasModuleAccess(supabase, actorProfile", "'view'"]), 'Every request is bound to one valid module and requires view access.');
add('endpoint-read-only-response', hasAll(endpoint, ['read_only: true', 'readCoreDataModels', 'CORE_DATA_CONTRACT_VERSION']) && !/\.(insert|update|upsert|delete)\s*\(/.test(endpoint), 'Endpoint is explicitly read-only and has no write operation.');
add('endpoint-build-schema-current', hasAll(endpoint, ["const BUILD = '2026-09-01e'", 'const SCHEMA = 163']), 'Endpoint release markers match Schema 163.');
add('endpoint-jwt-config', /\[functions\.core-data-read\]\s+verify_jwt\s*=\s*true/s.test(config), 'Supabase config requires JWT verification for core-data-read.');

add('browser-permission-before-transport', browser.indexOf('if (!moduleAllowed(moduleKey, state))') > -1 && browser.indexOf('if (!moduleAllowed(moduleKey, state))') < browser.indexOf("api.jsonFetch('core-data-read'"), 'Browser refuses denied module reads before transport.');
add('browser-cache-profile-module-scoped', hasAll(browser, ["`${profileId(state) || 'anonymous'}|${moduleKey}|${limit}|${entities.join(',')}`", 'cache = new Map()', 'inflight = new Map()']), 'Cache/inflight keys include profile identity, module, limit and entities.');
add('browser-cache-invalidates-on-identity-access-change', hasAll(browser, ['profile-changed', 'module-permissions-changed', 'auth-ended', 'invalidate(']), 'Auth identity and module-permission changes invalidate cached Core data.');
const exportStart = browser.indexOf('window.YWICoreData = Object.freeze({');
const exportEnd = exportStart >= 0 ? browser.indexOf('});', exportStart) : -1;
const exportedSurface = exportStart >= 0 && exportEnd > exportStart ? browser.slice(exportStart, exportEnd) : '';
const exportedWriteMethods = /\b(create|save|update|delete|remove|upsert)\s*,/i.test(exportedSurface);
const writeTransport = /jsonFetch\(['"][^'"]*(?:write|create|update|delete|save|upsert)[^'"]*['"]/i.test(browser)
  || /method:\s*['"](?:PUT|PATCH|DELETE)['"]/i.test(browser);
add('browser-no-write-api', !!exportedSurface && !exportedWriteMethods && !writeTransport && hasAll(exportedSurface, ['read,', 'readEntity,', 'invalidate,', 'getState']), 'Exported browser surface exposes reads/cache invalidation only; Map.delete cleanup is not a business-data write.');
add('browser-contract-current', hasAll(browser, ["const BUILD = '2026-09-01e'", 'const CONTRACT_VERSION = 1', ...entities.map((key) => `'${key}'`)]), 'Browser service declares all seven Schema 163 entities.');

const coreScriptMatch = index.match(/<script src="(\/js\/core-data-service\.js\?v=[^"]+)"><\/script>/);
const runtimeScriptMatch = index.match(/<script src="(\/js\/module-runtime\.js\?v=[^"]+)"><\/script>/);
add('shell-loads-core-data-before-module-runtime', !!coreScriptMatch && !!runtimeScriptMatch && index.indexOf(coreScriptMatch[0]) < index.indexOf(runtimeScriptMatch[0]), 'Shared Core data service loads before business-module runtime regardless of cache-busting release stamp.');
add('worker-precaches-core-data-service', worker.includes("'/js/core-data-service.js'") && /const CACHE_NAME = 'ywi-shell-v[^']+';/.test(worker), 'Core data browser service is part of a versioned Core shell cache generation.');
add('worker-does-not-prefetch-business-modules', !['/js/finance-ui.js','/js/jobs-ui.js','/js/admin-ui.js','/js/hse-ops-ui.js'].some((script) => worker.includes(`'${script}'`) || worker.includes(`"${script}"`)), 'Schema 162 business-module lazy loading remains intact.');

try {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  for (const file of [helperPath, endpointPath]) {
    const output = ts.transpileModule(read(file), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      reportDiagnostics: true,
      fileName: file
    });
    const errors = (output.diagnostics || []).filter((diag) => diag.category === ts.DiagnosticCategory.Error);
    add(`typescript-syntax:${file}`, errors.length === 0, errors.length ? errors.map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, '\n')).join(' | ') : 'TypeScript syntax OK.');
  }
} catch (error) {
  add('typescript-compiler-available-for-core-data', false, String(error));
}

const failures = results.filter((item) => !item.ok);
for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`);
if (failures.length) {
  console.error(`\nSchema 163 Core data gate failed: ${failures.length}/${results.length} checks.`);
  process.exit(1);
}
console.log(`\nSchema 163 Core data gate passed: ${results.length}/${results.length} checks.`);
