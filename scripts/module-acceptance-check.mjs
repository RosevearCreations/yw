#!/usr/bin/env node
/** Schema 165 source gate: rendered standalone/mixed module acceptance remains release-authoritative. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sql = fs.readFileSync(path.join(root, 'sql/165_standalone_module_acceptance_matrix.sql'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'tests/browser/module-runtime-access.spec.mjs'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'js/module-runtime.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'server-worker.js'), 'utf8');

function includesAll(source, values, label) {
  for (const value of values) assert.ok(source.includes(value), `${label} missing ${value}`);
}

assert.ok(/create table if not exists public\.app_module_acceptance_scenarios/i.test(sql), 'Acceptance scenario registry must be additive.');
assert.ok(/alter table public\.app_module_acceptance_scenarios enable row level security/i.test(sql), 'Acceptance registry must have RLS enabled.');
assert.ok(/revoke all on table public\.app_module_acceptance_scenarios from public, anon, authenticated/i.test(sql), 'Acceptance registry must remain private.');
assert.ok(/security_invoker=true/i.test(sql), 'Acceptance status view must be security_invoker.');
assert.ok(/ywi_module_acceptance_security_assertions\(\)/i.test(sql), 'Acceptance security assertion function must exist.');
assert.ok(/165_standalone_module_acceptance_matrix/i.test(sql), 'Schema 165 marker must be present.');

const scenarios = ['anonymous','safety_only','finance_only','jobs_only','admin_only','safety_jobs','finance_admin','full_admin'];
includesAll(sql, scenarios.map((key) => `'${key}'`), 'SQL acceptance matrix');
includesAll(spec, scenarios.map((key) => `key: '${key}'`), 'Rendered browser matrix');
includesAll(spec, ["name: 'phone'", "name: 'desktop'"], 'Rendered browser viewports');

includesAll(runtime, [
  "safety: Object.freeze({",
  "finance: Object.freeze({",
  "jobs: Object.freeze({",
  "admin: Object.freeze({",
  "'/js/it-readiness-ui.js'"
], 'Module runtime manifest');
assert.ok(!/\bit\s*:\s*Object\.freeze\(/.test(runtime), 'I.T. must not become a fifth runtime module.');
assert.ok(spec.includes("expect(manifestKeys).not.toContain('it')"), 'Browser gate must prove I.T. is not a fifth module.');
assert.ok(spec.includes("expect(requested).toContain('/js/it-readiness-ui.js')"), 'Browser gate must prove I.T. loads only through Admin.');

includesAll(spec, [
  "profile: 'profiles'",
  "customer: 'clients'",
  "customer_site: 'client_sites'",
  "job: 'jobs'",
  "equipment: 'equipment_master'",
  "customer_asset: 'customer_assets'",
  "service_document: 'service_contract_documents'"
], 'Canonical Shared Core browser contract');

assert.ok(spec.includes("permission_removed:finance"), 'Rendered gate must prove permission downgrade purge.');
assert.ok(spec.includes("toBe('signed_out')"), 'Rendered gate must prove sign-out purge.');

for (const businessScript of [
  '/js/hse-ops-ui.js','/js/finance-ui.js','/js/jobs-ui.js','/js/admin-ui.js','/js/it-readiness-ui.js'
]) {
  assert.ok(!serviceWorker.includes(`'${businessScript}'`) && !serviceWorker.includes(`\"${businessScript}\"`), `Service worker must not pre-cache ${businessScript}.`);
}

console.log('PASS acceptance-eight-scenario-registry');
console.log('PASS acceptance-phone-desktop-browser-matrix');
console.log('PASS acceptance-denied-bundles-not-requested-contract');
console.log('PASS acceptance-it-remains-admin-subsection');
console.log('PASS acceptance-canonical-shared-core-contract');
console.log('PASS acceptance-downgrade-signout-purge-contract');
console.log('PASS acceptance-service-worker-no-business-precache');
console.log('\nSchema 165 standalone/mixed module acceptance source gate passed: 7/7 checks.');
