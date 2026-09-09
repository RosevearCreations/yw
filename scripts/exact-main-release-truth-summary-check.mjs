#!/usr/bin/env node
/** Build 258 source enforcement for the exact-main release truth summary. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  BUILD,
  buildExactMainReleaseTruth,
  renderMarkdown,
  resultState,
} from './exact-main-release-truth-summary.mjs';

const checks = [];
const check = (name, fn) => {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: String(error?.message || error) });
  }
};

const base = {
  YWI_GITHUB_EVENT_NAME: 'push',
  YWI_GITHUB_REF: 'refs/heads/main',
  YWI_HEAD_SHA: 'a'.repeat(40),
  YWI_GITHUB_REPOSITORY: 'RosevearCreations/yw',
  YWI_GITHUB_RUN_ID: '12345',
  YWI_GITHUB_RUN_ATTEMPT: '1',
};

check('build-number', () => assert.equal(BUILD, 258));
check('result-classifier', () => {
  assert.equal(resultState('success'), 'green');
  assert.equal(resultState('failure'), 'red');
  assert.equal(resultState('cancelled'), 'red');
  assert.equal(resultState('skipped'), 'unknown');
});

check('source-green-repository-red-stays-separated', () => {
  const summary = buildExactMainReleaseTruth({
    ...base,
    YWI_SOURCE_CHECKS_RESULT: 'success',
    YWI_REPOSITORY_ENFORCEMENT_RESULT: 'failure',
    YWI_RELEASE_SOURCE_EVIDENCE_RESULT: 'failure',
  });
  assert.equal(summary.exact_main_push, true);
  assert.equal(summary.application_source.status, 'green');
  assert.equal(summary.repository_enforcement.status, 'red');
  assert.equal(summary.release_source_evidence.status, 'red');
  assert.equal(summary.posture, 'application_green_repository_enforcement_blocked');
  assert.equal(summary.blocking_control, 'repository_enforcement');
  assert.equal(summary.application_source_green, true);
  assert.equal(summary.all_observed_release_controls_green, false);
  assert.equal(summary.production_authorized, false);
});

check('source-failure-is-application-blocker', () => {
  const summary = buildExactMainReleaseTruth({
    ...base,
    YWI_SOURCE_CHECKS_RESULT: 'failure',
    YWI_REPOSITORY_ENFORCEMENT_RESULT: 'success',
    YWI_RELEASE_SOURCE_EVIDENCE_RESULT: 'success',
  });
  assert.equal(summary.application_source.status, 'red');
  assert.equal(summary.posture, 'application_source_blocked');
  assert.equal(summary.blocking_control, 'source_checks');
  assert.equal(summary.all_observed_release_controls_green, false);
});

check('all-green-is-observation-not-authorization', () => {
  const summary = buildExactMainReleaseTruth({
    ...base,
    YWI_SOURCE_CHECKS_RESULT: 'success',
    YWI_REPOSITORY_ENFORCEMENT_RESULT: 'success',
    YWI_RELEASE_SOURCE_EVIDENCE_RESULT: 'success',
  });
  assert.equal(summary.posture, 'all_observed_release_controls_green');
  assert.equal(summary.all_observed_release_controls_green, true);
  assert.equal(summary.production_authorized, false);
  assert.equal(summary.mutations_performed, false);
  assert.equal(summary.network_calls_performed, false);
});

check('non-main-context-never-reports-green-release-posture', () => {
  const summary = buildExactMainReleaseTruth({
    ...base,
    YWI_GITHUB_EVENT_NAME: 'pull_request',
    YWI_GITHUB_REF: 'refs/pull/1/merge',
    YWI_SOURCE_CHECKS_RESULT: 'success',
    YWI_REPOSITORY_ENFORCEMENT_RESULT: 'success',
    YWI_RELEASE_SOURCE_EVIDENCE_RESULT: 'success',
  });
  assert.equal(summary.exact_main_push, false);
  assert.equal(summary.posture, 'not_exact_main_push');
  assert.equal(summary.all_observed_release_controls_green, false);
  assert.equal(summary.production_authorized, false);
});

check('markdown-preserves-separate-truth', () => {
  const summary = buildExactMainReleaseTruth({
    ...base,
    YWI_SOURCE_CHECKS_RESULT: 'success',
    YWI_REPOSITORY_ENFORCEMENT_RESULT: 'failure',
    YWI_RELEASE_SOURCE_EVIDENCE_RESULT: 'failure',
  });
  const markdown = renderMarkdown(summary);
  assert.match(markdown, /Application source \/ browser gate:\*\* success \(green\)/);
  assert.match(markdown, /Repository enforcement:\*\* failure \(red\)/);
  assert.match(markdown, /does not authorize Production/);
});

check('workflow-wires-reporting-job-with-always-and-all-three-needs', () => {
  const workflow = fs.readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
  assert.match(workflow, /- run: node scripts\/exact-main-release-truth-summary-check\.mjs/);
  assert.match(workflow, /release-truth-summary:\n\s+if: always\(\) && github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /needs: \[source-checks, repository-enforcement, release-source-evidence\]/);
  assert.match(workflow, /YWI_SOURCE_CHECKS_RESULT: \$\{\{ needs\.source-checks\.result \}\}/);
  assert.match(workflow, /YWI_REPOSITORY_ENFORCEMENT_RESULT: \$\{\{ needs\.repository-enforcement\.result \}\}/);
  assert.match(workflow, /YWI_RELEASE_SOURCE_EVIDENCE_RESULT: \$\{\{ needs\.release-source-evidence\.result \}\}/);
  assert.match(workflow, /node scripts\/exact-main-release-truth-summary\.mjs/);
  assert.match(workflow, /ywi-main-release-truth-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
});

check('summary-script-has-no-provider-or-database-transport', () => {
  const source = fs.readFileSync('scripts/exact-main-release-truth-summary.mjs', 'utf8');
  for (const forbidden of ['fetch(', 'axios', 'https.request', '.from(', '.rpc(', 'createClient(', 'stripe']) {
    assert.equal(source.includes(forbidden), false, `forbidden transport/reference present: ${forbidden}`);
  }
  assert.match(source, /production_authorized: false/);
  assert.match(source, /mutations_performed: false/);
  assert.match(source, /network_calls_performed: false/);
});

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.error ? ` — ${item.error}` : ''}`);
}
if (failed.length) {
  console.error(`\nBuild 258 exact-main release truth enforcement failed: ${failed.length}/${checks.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nBuild 258 exact-main release truth enforcement passed: ${checks.length}/${checks.length} checks.`);
