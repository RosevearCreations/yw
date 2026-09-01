#!/usr/bin/env node
/** Schema 164 source gate: every shared operations action has one fail-closed module write/event contract. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const results = [];
const add = (name, ok, details = '') => results.push({ name, ok: !!ok, details });
const equalSets = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

const operationsPath = 'supabase/functions/operations-manage/index.ts';
const helperPath = 'supabase/functions/_shared/module-write-boundaries.ts';
const migrationPath = 'sql/164_cross_module_event_write_boundaries.sql';
const operations = read(operationsPath);
const helper = read(helperPath);
const migration = read(migrationPath);
const coreData = read('supabase/functions/core-data-read/index.ts');

const handledActions = [...new Set([...operations.matchAll(/action\s*===\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))].sort();
const helperActions = [...new Set([...helper.matchAll(/^\s{2}([a-z0-9_]+):\s*contract\('([^']+)'/gmi)].map((m) => m[2]))].sort();
const sqlActions = [...new Set([...migration.matchAll(/^\s*\('([a-z0-9_]+)','(?:safety|finance|jobs|admin)'/gmi)].map((m) => m[1]))].sort();

add('schema164-exact-handler-count', handledActions.length === 35, `Handled operations actions: ${handledActions.length}.`);
add('schema164-helper-exact-handler-set', equalSets(handledActions, helperActions), `Helper contracts: ${helperActions.length}; handlers: ${handledActions.length}.`);
add('schema164-db-exact-handler-set', equalSets(handledActions, sqlActions), `DB contracts: ${sqlActions.length}; handlers: ${handledActions.length}.`);

add('schema164-no-permissive-module-fallback', !operations.includes('moduleRequirementForAction') && !operations.includes("return { moduleKey:'admin', minimum:'manage' };"), 'Legacy unknown-action -> Admin/manage fallback is removed.');
add('schema164-boundary-resolved-before-authorization', operations.indexOf('const boundary = resolveModuleWriteBoundary(action);') > -1 && operations.indexOf('const boundary = resolveModuleWriteBoundary(action);') < operations.indexOf('hasModuleAccess(supabase, profile, boundary.ownerModule, boundary.minimum)'), 'Action contract resolves before permission evaluation.');
add('schema164-unknown-action-fails-before-first-handler', operations.indexOf("boundary: 'unregistered_action'") > -1 && operations.indexOf("boundary: 'unregistered_action'") < operations.indexOf("if (action === 'operations_queue_list')"), 'Unknown actions fail closed before any business handler.');
add('schema164-disabled-action-fails-before-permission-and-handler', operations.indexOf("boundary.mode === 'disabled'") > -1 && operations.indexOf("boundary.mode === 'disabled'") < operations.indexOf('hasModuleAccess(supabase, profile, boundary.ownerModule, boundary.minimum)') && operations.indexOf("boundary.mode === 'disabled'") < operations.indexOf("if (action === 'deposit_status_update')"), 'Disabled contracts are blocked at the boundary before handler execution.');
add('schema164-server-permission-from-contract', operations.includes('hasModuleAccess(supabase, profile, boundary.ownerModule, boundary.minimum)'), 'Server authorization uses the same owner/minimum contract registered for the action.');
add('schema164-defense-in-depth-role-checks-remain', operations.includes('requireRank(profile,'), 'Existing role-rank checks remain as defense in depth.');

add('schema164-audit-stamped-from-contract', operations.includes('const boundaryFields = boundaryAuditFields(boundary);') && operations.includes('...boundaryFields'), 'Write audit records receive owner/access/mode/event metadata from the action contract.');
add('schema164-cross-module-events-private-server-emission', operations.includes("supabase.from('module_boundary_events').insert") && operations.includes('boundary?.crossModule && boundary.eventKey') && migration.includes('alter table public.module_boundary_events enable row level security;') && migration.includes('revoke all on table public.module_boundary_events from public, anon, authenticated;'), 'Declared cross-module effects emit into a private server-only event stream.');
add('schema164-events-do-not-carry-request-body', !/module_boundary_events[\s\S]{0,900}request_payload/.test(operations) && operations.includes('event_payload: {'), 'Boundary events contain contract/status metadata rather than copied request bodies.');

add('schema164-deposit-manual-write-disabled', helper.includes("deposit_status_update: contract('deposit_status_update', 'finance', 'manage', 'disabled'") && migration.includes("('deposit_status_update','finance','manage','disabled'"), 'Manual deposit status mutation remains explicitly disabled in source and DB contracts.');
add('schema164-job-cost-cross-boundary-explicit', helper.includes("job_cost_refresh: contract('job_cost_refresh', 'finance', 'view', 'write', 'job_costing', 'finance.job_cost.refreshed', true)"), 'Finance job-cost refresh is explicitly marked as a Jobs-facing cross-module effect.');
add('schema164-equipment-cost-recovery-cross-boundary-explicit', helper.includes("equipment_cost_recovery_decision: contract('equipment_cost_recovery_decision', 'jobs', 'approve', 'write', 'equipment_cost_recovery', 'jobs.equipment.cost_recovery_decided', true)"), 'Jobs equipment cost recovery exposes a named Finance-facing boundary event.');
add('schema164-read-actions-not-misclassified-as-write', helper.includes("operations_queue_list: contract('operations_queue_list', 'admin', 'view', 'read'") && helper.includes("reconciliation_suggest: contract('reconciliation_suggest', 'finance', 'view', 'read'"), 'Known read actions are explicitly read-mode contracts.');

add('schema164-private-contract-registry', migration.includes('alter table public.app_module_write_contracts enable row level security;') && migration.includes('revoke all on table public.app_module_write_contracts from public, anon, authenticated;') && migration.includes('grant select on table public.app_module_write_contracts to service_role;'), 'Write-contract registry is a private service-role control plane.');
add('schema164-db-security-assertions', migration.includes('ywi_module_write_boundary_security_assertions') && migration.includes("'operations_action_contract_count'") && migration.includes("'manual_deposit_mutation_disabled'") && migration.includes("'boundary_control_plane_private'"), 'Database assertions verify contract count, disabled payment mutation, and private control plane.');
add('schema164-readiness-drift-marker', migration.includes("'cross_module_write_boundaries'") && migration.includes("'schema164_cross_module_write_boundaries'") && migration.includes('164::int as expected_schema_version') && migration.includes("'2026-09-01f'"), 'I.T. readiness, scorecard and schema marker advance to 164.');
add('schema164-no-shared-core-replacement-tables', !/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(profiles|clients|client_sites|jobs|equipment_master|customer_assets|service_contract_documents)\b/i.test(migration), 'Schema 164 does not create replacement Shared Core business identities.');
add('schema164-shared-core-read-service-stays-read-only', !/\.(insert|update|upsert|delete)\s*\(/.test(coreData) && coreData.includes('read_only: true'), 'Schema 163 Shared Core service remains read-only while Schema 164 governs writes elsewhere.');

add('schema164-source-release-markers', operations.includes("const WRITE_BOUNDARY_BUILD = '2026-09-01f';") && operations.includes('const WRITE_BOUNDARY_SCHEMA = 164;'), 'Shared operations endpoint exposes Schema 164 boundary markers without disturbing legacy domain build markers.');

try {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  for (const file of [helperPath, operationsPath]) {
    const output = ts.transpileModule(read(file), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      reportDiagnostics: true,
      fileName: file
    });
    const errors = (output.diagnostics || []).filter((diag) => diag.category === ts.DiagnosticCategory.Error);
    add(`typescript-syntax:${file}`, errors.length === 0, errors.length ? errors.map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, '\n')).join(' | ') : 'TypeScript syntax OK.');
  }
} catch (error) {
  add('typescript-compiler-available-for-write-boundaries', false, String(error));
}

const failures = results.filter((item) => !item.ok);
for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.details ? ` - ${item.details}` : ''}`);
if (failures.length) {
  console.error(`\nSchema 164 module write-boundary gate failed: ${failures.length}/${results.length} checks.`);
  if (!equalSets(handledActions, helperActions)) {
    console.error(`Handlers not in helper: ${handledActions.filter((x) => !helperActions.includes(x)).join(', ') || '(none)'}`);
    console.error(`Helper not in handlers: ${helperActions.filter((x) => !handledActions.includes(x)).join(', ') || '(none)'}`);
  }
  if (!equalSets(handledActions, sqlActions)) {
    console.error(`Handlers not in DB: ${handledActions.filter((x) => !sqlActions.includes(x)).join(', ') || '(none)'}`);
    console.error(`DB not in handlers: ${sqlActions.filter((x) => !handledActions.includes(x)).join(', ') || '(none)'}`);
  }
  process.exit(1);
}
console.log(`\nSchema 164 module write-boundary gate passed: ${results.length}/${results.length} checks.`);
