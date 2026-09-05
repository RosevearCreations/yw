#!/usr/bin/env node
/**
 * Build 214: staging infrastructure readiness enforcement.
 *
 * Keeps "source-ready staging candidate" separate from "runnable staging
 * environment". Production or unconfigured runtimes may read status/catalog
 * evidence, but may never record/finalize/sign off staging acceptance.
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

add('browser-covers-unconfigured-runtime', hasAll(browser, [
  "test('source-ready rail stays non-runnable when staging runtime is unconfigured'",
  "runtime_environment:'unconfigured'",
  "expected_staging_project_ref:null",
  "mutation_allowed:false",
  "expect(actions).toEqual(['status'])"
]), 'A source-ready rail cannot expose mutation controls merely because its scenario catalog is ready.');

add('browser-covers-project-ref-mismatch', hasAll(browser, [
  "test('staging label with a mismatched project ref remains locked'",
  "runtime_environment:'staging'",
  "actual_project_ref:'staging-project-a'",
  "expected_staging_project_ref:'staging-project-b'",
  'The runtime project ref does not match YWI_STAGING_PROJECT_REF.'
]), 'A staging label alone cannot authorize writes to the wrong project.');

add('build214-source-check-is-mandatory',
  workflow.includes('node scripts/staging-infrastructure-readiness-enforcement-check.mjs'),
  'Build 214 source authority runs on each release PR.');

add('build214-browser-check-is-mandatory',
  workflow.includes('tests/browser/staging-infrastructure-readiness.spec.mjs'),
  'Build 214 rendered fail-closed acceptance runs on each release PR.');

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
}

if (failed.length) {
  console.error(`\nBuild 214 staging infrastructure readiness enforcement failed: ${failed.length}/${checks.length} check(s) failed.`);
  process.exit(1);
}

console.log(`\nBuild 214 staging infrastructure readiness enforcement passed: ${checks.length}/${checks.length} checks.`);
