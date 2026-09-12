#!/usr/bin/env node
/**
 * Build 214+: staging infrastructure readiness enforcement.
 *
 * Keeps "source-ready staging candidate" separate from "runnable staging
 * environment". Production, unregistered or unconfigured runtimes may read
 * status/catalog evidence, but may never record/finalize/sign off staging acceptance.
 */
import fs from 'node:fs';
import process from 'node:process';

const read = (path) => fs.readFileSync(path, 'utf8');
const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
const hasAll = (text, values) => values.every((value) => text.includes(value));

const endpoint = read('supabase/functions/admin-staging-acceptance/index.ts');
const ui = read('js/staging-acceptance-ui.js');
const browser = read('tests/browser/staging-infrastructure-readiness.spec.mjs');
const workflow = read('.github/workflows/staging-browser-integration.yml');

add('production-project-is-permanently-denied', hasAll(endpoint, [
  "const KNOWN_PRODUCTION_PROJECT_REF = 'jmqvkgiqlimdhcofwkxr'",
  'registeredAuthority?.environment_class === \'production\'',
  '&& !knownProduction && registryAllows',
  'Production project authority permanently denies staging-acceptance mutation.'
]), 'The known Production project and any registry-classified Production runtime remain fail-closed.');

add('staging-mutation-requires-explicit-runtime-boundary', hasAll(endpoint, [
  "runtimeEnvironment === 'staging'",
  'actualProjectRef === expectedStagingRef',
  "YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED",
  'explicitStaging && mutationFlag && exactRefMatch && !knownProduction && registryAllows'
]), 'Mutation requires staging runtime, exact non-Production project ref, explicit flag, and registry permission.');

add('runtime-registry-is-explicit-allow-only', hasAll(endpoint, [
  "registeredAuthority?.environment_class === 'staging'",
  'registeredAuthority?.staging_acceptance_mutation_allowed === true',
  'registered_authority_present:Boolean(registeredAuthority)',
  'Runtime environment authority is not registered for this project; explicit staging registration is required.',
  'missing or unknown registration is denied.'
]), 'Missing, unknown or non-staging runtime-authority registration cannot enable staging mutation.');

add('status-includes-runtime-registry-assertion', hasAll(endpoint, [
  "assertion_key:'runtime_project_registered_explicit_staging_allow'",
  'registryExplicitlyAllows',
  "environment_guard:environmentGuard",
  'environment_assertions:environmentRows'
]), 'Status truth visibly fails when the current target lacks explicit staging registry authority.');

add('status-remains-readable-before-mutation-assertion',
  endpoint.indexOf("if (action === 'status')") >= 0 &&
  endpoint.indexOf("if (action === 'status')") < endpoint.indexOf('assertStagingMutationAllowed(environmentGuard)'),
  'Status/catalog truth can be inspected while writes remain locked.');

add('schema-and-environment-both-required-by-ui', hasAll(ui, [
  'environmentGuard().mutation_allowed===true && schemaCurrent()',
  "const writesAllowed=mutationAllowed();",
  'const canRecord=writesAllowed',
  'const canFinalize=writesAllowed',
  'const canSign=writesAllowed'
]), 'Human evidence, finalization, and signoff controls all depend on both guards.');

add('locked-ui-explains-read-only-mode', hasAll(ui, [
  'Environment mutation guard:',
  'Status/catalog reads remain available. Pass/Fail, Finalize, and Signoff controls stay hidden while locked.',
  'exact current schema'
]), 'Operators can distinguish readable staging candidates from authorized staging execution.');

add('staging-target-readiness-checklist-is-explicit', hasAll(ui, [
  'Staging target readiness:',
  'Dedicated non-Production target',
  'Runtime labelled staging',
  'Exact staging project-ref binding',
  'Staging mutation flag',
  'Runtime registry permission',
  'Exact current schema',
  'registered_authority_present===true',
  "registered_environment_class==='staging'",
  'registered_mutation_allowed===true',
  'missing or unknown registration is denied',
  'Creating a Supabase project or development branch is a separate infrastructure decision'
]), 'The I.T. staging panel exposes each prerequisite independently and treats missing registry authority as denied.');

add('browser-current-schema-derived-from-repository',
  hasAll(browser, [
    "fs.readdirSync(path.resolve(repoRoot,'sql'))",
    'function migrationVersionFromFilename(name)',
    "match(/^(\\d+)_.*\\.sql$/i)",
    '.map(migrationVersionFromFilename).filter(Number.isFinite)',
    "migrationVersionFromFilename('999_example.sql')",
    "migrationVersionFromFilename('1000_future.sql')",
    "migrationVersionFromFilename('12034_example.sql')",
    "migrationVersionFromFilename('not-a-migration.sql')",
    'No numbered SQL migrations found for the staging infrastructure readiness browser fixture.',
    'expected_schema_version:CURRENT_SCHEMA',
    'latest_applied_schema_version:CURRENT_SCHEMA',
    'schema:CURRENT_SCHEMA',
    'schema_version:CURRENT_SCHEMA'
  ])
  && !browser.includes('slice(0,3)')
  && !browser.includes('/^\\d{3}_.+\\.sql$/i')
  && !/expected_schema_version:\s*\d+/.test(browser)
  && !/latest_applied_schema_version:\s*\d+/.test(browser)
  && !/(?<!_)schema:\s*\d+/.test(browser)
  && !/schema_version:\s*\d+/.test(browser),
  'Rendered staging-infrastructure fixtures derive current schema from variable-width repository migrations, cover Schema 1000+, and reject stale numeric current-schema literals.'
);

add('browser-covers-unconfigured-runtime', hasAll(browser, [
  "test('source-ready rail stays non-runnable when staging runtime is unconfigured'",
  "runtime_environment:'unconfigured'",
  "expected_staging_project_ref:null",
  "mutation_allowed:false",
  'Staging target readiness: NOT READY',
  "expect(actions).toEqual(['status'])"
]), 'A source-ready rail cannot expose mutation controls merely because its scenario catalog is ready.');

add('browser-covers-project-ref-mismatch', hasAll(browser, [
  "test('staging label with a mismatched project ref remains locked'",
  "runtime_environment:'staging'",
  "actual_project_ref:'staging-project-a'",
  "expected_staging_project_ref:'staging-project-b'",
  'The runtime project ref does not match YWI_STAGING_PROJECT_REF.'
]), 'A staging label alone cannot authorize writes to the wrong project.');

add('browser-covers-unregistered-runtime-authority', hasAll(browser, [
  "test('unregistered staging project stays locked even when runtime label ref and flag are ready'",
  "registered_authority_present:false",
  "registered_environment_class:null",
  "registered_mutation_allowed:null",
  'No runtime-authority registration exists for this project; missing or unknown registration is denied.',
  "expect(actions).toEqual(['status'])"
]), 'Rendered acceptance proves missing runtime registry authority fails closed.');

add('browser-covers-all-six-prerequisites-before-write-controls', hasAll(browser, [
  "test('all six staging target prerequisites must be proven before human evidence controls appear'",
  "registered_authority_present:true",
  "registered_environment_class:'staging'",
  "registered_mutation_allowed:true",
  "mutation_allowed:true",
  'Staging target readiness: READY',
  "getByRole('button',{name:'Pass evidence'})).toBeVisible()",
  "getByRole('button',{name:'Fail evidence'})).toBeVisible()"
]), 'Rendered acceptance proves that human evidence controls appear only after every staging target prerequisite is satisfied.');

add('build214-source-check-is-mandatory',
  workflow.includes('node scripts/staging-infrastructure-readiness-enforcement-check.mjs'),
  'Staging infrastructure source authority runs on each release PR.');

add('build214-browser-check-is-mandatory',
  workflow.includes('tests/browser/staging-infrastructure-readiness.spec.mjs'),
  'Rendered fail-closed staging acceptance runs on each release PR.');

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
}

if (failed.length) {
  console.error(`\nStaging infrastructure readiness enforcement failed: ${failed.length}/${checks.length} check(s) failed.`);
  process.exit(1);
}

console.log(`\nStaging infrastructure readiness enforcement passed: ${checks.length}/${checks.length} checks.`);