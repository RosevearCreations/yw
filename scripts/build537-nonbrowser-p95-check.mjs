#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';
import { WARM_BATCH_NAMES } from './build536-source-variance-core.mjs';
import { STANDALONE_BROWSER_STEPS, reviewNonBrowserP95 } from './build537-nonbrowser-p95-core.mjs';

const stamp = (seconds) => new Date(Date.parse('2026-11-07T03:00:00Z') + seconds * 1000).toISOString();
const step = (name, number, start, end) => ({ name, number, conclusion: 'success',
  started_at: stamp(start), completed_at: stamp(end) });
const entry = (index, sourceSeconds = 176, withGroup = false) => {
  const jobs = REQUIRED_GATES.map((name) => ({ name, status: 'completed', conclusion: 'success',
    started_at: stamp(0), completed_at: stamp(name === 'source-checks' ? sourceSeconds : 200),
    steps: name === 'source-checks' ? [
      ...(withGroup ? [step('Source non-browser CI contract lane (11 retained checks, 3 workers)', 12, 15, 19)] : []),
      step('Install Chromium for rendered module acceptance', 255, 45, 53),
      ...STANDALONE_BROWSER_STEPS.map((label, i) => step(label, 270 + i, 56 + i * 3, 58 + i * 3)),
      ...WARM_BATCH_NAMES.map((label, i) => step(label, 310 + i, 80 + i * 16, 92 + i * 16)),
    ] : [],
  }));
  const sample = { runId: 537000100 - index, headSha: String(index + 1).repeat(40),
    status: 'VERIFIED_GREEN', runSeconds: 360 + index };
  return { jobs, sample };
};
const history = [entry(0, 176, true), entry(1, 179), entry(2, 180), entry(3, 182),
  entry(4, 184), entry(5, 185)];
const current = history[0].sample;
const options = { exactCurrentMain: true };
const report = reviewNonBrowserP95(current, history, options);
assert.equal(report.state, 'EXACT_MAIN_GREEN_SOURCE_RESIDUAL_OBSERVED');
assert.equal(report.certification, 'CERTIFIED_SIX_RELEASE_P95_SLA');
assert.equal(report.currentBudgetState, 'CURRENT_RELEASE_MEETS_BUDGET');
assert.equal(report.verifiedSamples, 6);
assert.equal(report.current.sourceSeconds, 176);
assert.equal(report.current.batchSeconds, 72);
assert.equal(report.current.standaloneSeconds, 8);
assert.equal(report.current.installSeconds, 8);
assert.equal(report.current.nonBrowserResidualSeconds, 88);
assert.equal(report.current.contractGroupObserved, true);
assert.equal(report.originalSourceContractChecks, 11);
assert.equal(report.boundedContractWorkers, 3);
assert.equal(report.trend.sourceP95Seconds, 185);
assert.equal(report.trend.nonBrowserResidualP95Seconds, 97);
assert.equal(report.comparison.nonBrowserResidualDifferenceSeconds, -3);
assert.equal(report.p95Breaches.length, 0);
assert.equal(report.safeguards.releaseAuthority, false);
assert.equal(report.safeguards.waivedGates, false);

const high = structuredClone(history);
high[5].jobs.find((job) => job.name === 'source-checks').completed_at = stamp(270);
const exception = reviewNonBrowserP95(current, high, options);
assert.equal(exception.certification, 'HOLD_HISTORICAL_P95_EXCEPTIONS');
assert.ok(exception.p95Breaches.find((item) => item.name === 'source-checks'));
assert.ok(exception.p95Breaches.find((item) => item.name === 'non-browser-residual'));
assert.equal(reviewNonBrowserP95(current, history.slice(0, 3), options).certification,
  'HOLD_INSUFFICIENT_VERIFIED_RELEASES');
assert.equal(reviewNonBrowserP95(current, history, { exactCurrentMain: false }).state,
  'HOLD_UNVERIFIED_EXACT_MAIN_SOURCE');
const mutation = (fn) => { const cloned = structuredClone(history); fn(cloned[0]);
  return reviewNonBrowserP95(current, cloned, options); };
assert.equal(mutation((item) => { item.jobs[0].conclusion = 'failure'; }).state,
  'HOLD_UNVERIFIED_EXACT_MAIN_SOURCE');
assert.equal(mutation((item) => { item.jobs.find((job) => job.name === 'source-checks').steps.splice(0, 1); }).state,
  'HOLD_UNVERIFIED_EXACT_MAIN_SOURCE');
assert.equal(mutation((item) => { item.jobs.find((job) => job.name === 'source-checks').steps[3].conclusion = 'failure'; }).state,
  'HOLD_UNVERIFIED_EXACT_MAIN_SOURCE');
assert.throws(() => reviewNonBrowserP95(current, null, options), /required/);
const workflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const audit = readFileSync('scripts/build530-ci-runtime-audit.mjs', 'utf8');
const post = readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml', 'utf8');
assert.ok(workflow.includes('node scripts/build537-nonbrowser-p95-check.mjs'));
assert.ok(audit.includes('reviewNonBrowserP95(current, detailedHistory, { exactCurrentMain })'));
assert.ok(post.includes('Build 530–538 read-only CI throughput and recovery evidence'));
assert.ok(!workflow.includes('  build537:'));
console.log('Build 537: exact-main non-browser residual, bounded six-release P95 certification, historical HOLD and immutable protected gates verified.');
