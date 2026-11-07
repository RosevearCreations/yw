#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';
import { WARM_BATCH_NAMES, reviewSourceWarmVariance } from './build536-source-variance-core.mjs';

const stamp = (seconds) => new Date(Date.parse('2026-11-07T02:00:00Z') + seconds * 1000).toISOString();
const step = (name, number, start, end) => ({ name, number, conclusion: 'success',
  started_at: stamp(start), completed_at: stamp(end) });
const sample = (id, sha) => ({ runId: id, headSha: sha, status: 'VERIFIED_GREEN', runSeconds: 400 });
const jobs = (extra = 0) => REQUIRED_GATES.map((name) => ({
  name, conclusion: 'success', status: 'completed',
  started_at: stamp(0), completed_at: stamp(210 + extra),
  steps: name === 'source-checks' ? [
    step('Install Chromium for rendered module acceptance', 260, 50, 60),
    ...WARM_BATCH_NAMES.map((label, index) => step(label, 310 + index, 70 + index * 16, 82 + index * 16 + extra)),
  ] : [],
}));
const entry = (id, sha, extra = 0) => ({ sample: sample(id, sha), jobs: jobs(extra) });
const current = entry(536000002, 'a'.repeat(40));
const prior = entry(536000001, 'b'.repeat(40), 2);
const older = entry(536000000, 'c'.repeat(40), 1);
const history = [current, prior, older];
const report = reviewSourceWarmVariance(current.sample, history);
assert.equal(report.state, 'EXACT_MAIN_GREEN_WARM_CONTEXT_OBSERVED');
assert.equal(report.comparisonState, 'OBSERVED_CROSS_RELEASE_SAME_BATCH_NAMES');
assert.equal(report.warmContext, 'SAME_RUN_PINNED_CHROMIUM_ALREADY_INSTALLED');
assert.equal(report.verifiedSampleCount, 3);
assert.equal(report.trendState, 'BOUNDED_VERIFIED_HISTORY');
assert.equal(report.sourceBrowserSuiteCount, 51);
assert.equal(report.batch20OriginalLaunches, 3);
assert.equal(report.batch20CurrentLaunches, 1);
assert.equal(report.current.sourceSeconds, 210);
assert.equal(report.current.batchSeconds, 72);
assert.equal(report.current.otherSourceSeconds, 138);
assert.equal(report.batchDifferenceSeconds, -12);
assert.equal(report.sla.state, 'MEETS_OBSERVATIONAL_SLA_BUDGET');
assert.equal(report.batchStats.length, 6);
assert.equal(report.batchStats[0].medianSeconds, 13);
assert.equal(report.safeguards.causalCacheHitProven, false);
assert.equal(report.safeguards.weakenedGate, false);

const mutated = (fn) => {
  const copy = structuredClone(current);
  fn(copy);
  return reviewSourceWarmVariance(current.sample, [copy, prior]);
};
assert.equal(mutated((entry) => { entry.sample.status = 'HOLD_NOT_VERIFIED'; }).state, 'HOLD_MISSING_OR_UNVERIFIED_WARM_BATCH_EVIDENCE');
assert.equal(mutated((entry) => { entry.jobs.splice(0, 1); }).state, 'HOLD_MISSING_OR_UNVERIFIED_WARM_BATCH_EVIDENCE');
assert.equal(mutated((entry) => { entry.jobs[0].conclusion = 'failure'; }).state, 'HOLD_MISSING_OR_UNVERIFIED_WARM_BATCH_EVIDENCE');
assert.equal(mutated((entry) => { entry.jobs.find((j) => j.name === 'source-checks').steps.splice(0, 1); }).state, 'HOLD_MISSING_OR_UNVERIFIED_WARM_BATCH_EVIDENCE');
assert.equal(mutated((entry) => { entry.jobs.find((j) => j.name === 'source-checks').steps[2].number = 309; }).state, 'HOLD_MISSING_OR_UNVERIFIED_WARM_BATCH_EVIDENCE');
assert.equal(mutated((entry) => { entry.jobs.find((j) => j.name === 'source-checks').steps[3].conclusion = 'failure'; }).state, 'HOLD_MISSING_OR_UNVERIFIED_WARM_BATCH_EVIDENCE');
const exception = entry(536000003, 'd'.repeat(40));
exception.jobs.find((j) => j.name === 'source-checks').completed_at = stamp(280);
assert.equal(reviewSourceWarmVariance(exception.sample, [exception]).sla.state, 'OBSERVED_SLA_EXCEPTION');
assert.equal(reviewSourceWarmVariance(current.sample, [current]).comparisonState, 'HOLD_NO_COMPARABLE_SOURCE_RELEASE');
assert.throws(() => reviewSourceWarmVariance(current.sample, null), /required/);
const workflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const post = readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml', 'utf8');
assert.ok(workflow.includes('node scripts/build536-source-variance-check.mjs'));
assert.ok(post.includes('ci-runtime-audit:') && post.includes('actions: read'));
assert.ok(!workflow.includes('ci-runtime-audit:'));
console.log('Build 536: bounded exact-main warm-context, batch variance, fail-closed evidence and SLA exception diagnostics verified.');
