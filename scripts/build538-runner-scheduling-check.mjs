#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';
import { WARM_BATCH_NAMES } from './build536-source-variance-core.mjs';
import { STANDALONE_BROWSER_STEPS } from './build537-nonbrowser-p95-core.mjs';
import { reviewBuild538 } from './build538-runner-scheduling-core.mjs';

const stamp = (seconds) => new Date(Date.parse('2026-11-07T04:00:00Z') + seconds * 1000).toISOString();
const step = (name, number, a, b) => ({ name, number, conclusion: 'success', started_at: stamp(a), completed_at: stamp(b) });
const make = (index, sourceSeconds = 205, releaseSeconds = 450, current = false) => {
  const sourceSteps = [
    step('Run npm ci --no-audit --no-fund', 5, 14, 18),
    ...(current ? [step('Source non-browser CI contract lane (11 retained checks, 3 workers)', 12, 20, 22)] : []),
    step('Install Chromium for rendered module acceptance', 255, 40, 48),
    ...STANDALONE_BROWSER_STEPS.map((name, i) => step(name, 270 + i, 54 + i * 3, 56 + i * 3)),
    ...WARM_BATCH_NAMES.map((name, i) => step(name, 310 + i, 80 + 16 * i, 92 + 16 * i)),
  ];
  const sample = { runId: 538000001 - index, headSha: String(index + 1).repeat(40),
    status: 'VERIFIED_GREEN', runSeconds: releaseSeconds };
  const jobs = REQUIRED_GATES.map((name) => ({ name, status: 'completed', conclusion: 'success',
    started_at: stamp(name === 'source-checks' ? 12 : 0),
    completed_at: stamp(name === 'source-checks' ? 12 + sourceSeconds : 10),
    steps: name === 'source-checks' ? sourceSteps : [],
  }));
  return { sample, jobs };
};
const history = [make(0, 205, 450, true), make(1, 175, 400), make(2, 185, 420),
  make(3, 195, 430), make(4, 200, 440), make(5, 205, 455)];
const current = history[0].sample;
const options = { exactCurrentMain: true };
const report = reviewBuild538(current, history, options);
assert.equal(report.state, 'EXACT_MAIN_GREEN_ORIGINAL_SCHEDULING_EVIDENCE');
assert.equal(report.comparisonState, 'SAME_GATES_CROSS_SHA_OBSERVED');
assert.equal(report.guardrailState, 'OBSERVED_THROUGHPUT_REGRESSION');
assert.equal(report.validSchedulingSamples, 6);
assert.equal(report.current.setupSeconds, 6);
assert.equal(report.current.handoffSeconds, 2);
assert.equal(report.current.chromiumSeconds, 8);
assert.equal(report.current.laneCompletionsVerified, 3);
assert.equal(report.differences.sourceSeconds, 30);
assert.equal(report.differences.releaseSeconds, 50);
assert.equal(report.dominantMeasuredRegression, 'NON_BROWSER_RESIDUAL');
assert.ok(report.regressions.some((item) => item.name === 'source-critical-path'));
assert.ok(report.regressions.some((item) => item.name === 'non-browser-residual'));
assert.equal(report.warmBatchAttribution.length, 6);
assert.equal(report.safeguards.releaseAuthority, false);
assert.equal(report.safeguards.causalRootCauseProven, false);
const stable = structuredClone(history);
stable[0].jobs.find((job) => job.name === 'source-checks').completed_at = stamp(12 + 177);
stable[0].sample.runSeconds = 403;
assert.equal(reviewBuild538(stable[0].sample, stable, options).guardrailState, 'NO_REGRESSION_OVER_THRESHOLDS');
assert.equal(reviewBuild538(current, history, { exactCurrentMain: false }).state, 'HOLD_UNVERIFIED_SCHEDULING_EVIDENCE');
const mutate = (fn) => { const copy = structuredClone(history); fn(copy[0]); return reviewBuild538(current, copy, options); };
assert.equal(mutate((entry) => { entry.jobs.find((job) => job.name === 'Browser regression lane a').conclusion = 'failure'; }).state, 'HOLD_UNVERIFIED_SCHEDULING_EVIDENCE');
assert.equal(mutate((entry) => { entry.jobs.find((job) => job.name === 'source-checks').steps.splice(0, 1); }).state, 'HOLD_UNVERIFIED_SCHEDULING_EVIDENCE');
assert.equal(mutate((entry) => { entry.jobs.find((job) => job.name === 'source-checks').started_at = stamp(8); }).state, 'HOLD_UNVERIFIED_SCHEDULING_EVIDENCE');
assert.throws(() => reviewBuild538(current, null, options), /required/);
const workflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const audit = readFileSync('scripts/build530-ci-runtime-audit.mjs', 'utf8');
const post = readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml', 'utf8');
assert.ok(workflow.includes('node scripts/build538-runner-scheduling-check.mjs'));
assert.ok(audit.includes('reviewBuild538(current, detailedHistory, { exactCurrentMain })'));
assert.ok(post.includes('Build 530–539 read-only CI throughput and recovery evidence'));
assert.ok(!workflow.includes('  build538:'));
console.log('Build 538: exact-main runner handoff, setup, step-gap attribution, tail P95 and fail-closed cross-release guardrails verified.');
