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
const readme = read('README.md');
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
  "199,'199_next_safe_action_authority'"
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
assertIncludes(readme, 'next safe action', 'README next-safe-action guidance');
assertIncludes(nextSteps, 'next safe action', 'next-steps guidance');
assertIncludes(help, 'Next safe action', 'operator Help guidance');

console.log('Build 199 next-safe-action authority source gate: PASS');
