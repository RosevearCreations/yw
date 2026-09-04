import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assertIncludes(text, value, label) {
  if (!text.includes(value)) throw new Error(`Missing ${label}: ${value}`);
}

const migration = read('sql/199_next_safe_action_authority.sql');
const pkg = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/staging-browser-integration.yml');
const api = read('supabase/functions/admin-account-security/index.ts');
const ui = read('js/admin-account-security-ui.js');
const browser = read('tests/browser/admin-account-security.spec.mjs');
const readme = read('README.md');
const handbook = read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps = read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const help = read('help.html');

for (const required of [
  'v_it_next_safe_action_queue',
  'v_it_next_safe_action_status',
  'ywi_next_safe_action_authority_assertions',
  'staging_ready_candidate',
  'external_verification',
  'blocked_accounting_acceptance',
  'safe_candidate_after_environment_guard',
  'open_business_acceptance_unchanged',
  'finance_provider_execution_off',
  'schema199_next_safe_action_authority',
  "199,'199_next_safe_action_authority'",
  'create or replace view public.v_schema_drift_status',
  '199 as expected_schema_version',
  ">= 199 then 'current'",
  'grant select on table public.v_schema_drift_status to service_role'
]) assertIncludes(migration, required, 'Schema 199 authority');

for (const forbidden of [
  'execution_enabled=true;',
  'provider_mutation_enabled=true;',
  "rail_status='complete'",
  'auth.config',
  'IndexNow'
]) {
  if (migration.includes(forbidden)) throw new Error(`Unsafe Schema 199 mutation/publish token present: ${forbidden}`);
}

if (pkg.scripts['test:next-safe-action'] !== 'node scripts/next-safe-action-authority-check.mjs') {
  throw new Error('package.json must expose test:next-safe-action');
}
assertIncludes(workflow, 'npm run test:next-safe-action', 'CI next-safe-action gate');
for (const required of ['v_it_next_safe_action_status','v_it_next_safe_action_queue','next_safe_action_status','next_safe_action_queue']) {
  assertIncludes(api, required, 'Admin account-security next-safe-action API');
}
for (const required of ['adminNextSafeActionPanel','Next safe action','candidate after environment guard','does not authorize staging mutation']) {
  assertIncludes(ui, required, 'Admin next-safe-action UI');
}
for (const required of ['adminNextSafeActionPanel','6 staging-ready','2 accounting blocked','does not authorize staging mutation']) {
  assertIncludes(browser, required, 'rendered next-safe-action browser acceptance');
}
assertIncludes(readme, 'next safe action', 'README next-safe-action guidance');
assertIncludes(handbook, 'Next safe action authority', 'handbook next-safe-action guidance');
assertIncludes(nextSteps, 'next safe action', 'next-steps guidance');
assertIncludes(help, 'Next safe action', 'operator Help guidance');

console.log('Build 199 next-safe-action authority source gate: PASS');
