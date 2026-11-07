#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';
import { reviewLaneCRelease } from './build535-lane-c-timing-core.mjs';

const makeSample = (runId, headSha, status = 'VERIFIED_GREEN') => ({
  runId, headSha, status, runSeconds: 400,
});
const timed = (name, start, end) => ({ name, conclusion: 'success',
  started_at: `2026-11-07T02:${start}:00Z`, completed_at: `2026-11-07T02:${end}:00Z` });
const jobFor = (name) => ({
  name, conclusion: 'success', status: 'completed',
  created_at: '2026-11-07T02:00:00Z', started_at: '2026-11-07T02:01:00Z',
  completed_at: '2026-11-07T02:05:00Z',
  steps: name === 'Browser regression lane c' ? [
    timed('Run actions/checkout@v7', '01', '02'),
    timed('Run actions/setup-node@v7', '02', '03'),
    timed('Run npm ci --no-audit --no-fund', '03', '04'),
    timed('Install pinned Chromium for isolated lane', '04', '05'),
    timed('Run assigned browser regression lane', '05', '07'),
  ] : [],
});
const entry = (runId, sha, status = 'VERIFIED_GREEN') => ({
  sample: makeSample(runId, sha, status), jobs: REQUIRED_GATES.map(jobFor),
});
const current = entry(535000003, 'a'.repeat(40));
const prior = entry(535000002, 'b'.repeat(40));
prior.jobs.find((job) => job.name === 'Browser regression lane c').steps.at(-1).completed_at = '2026-11-07T02:09:00Z';
const older = entry(535000001, 'c'.repeat(40));
const history = [current, prior, older];
const report = reviewLaneCRelease(current.sample, history);
assert.equal(report.schema, 'ywi.build535.lane-c-release-sla.v1');
assert.equal(report.state, 'EXACT_MAIN_GREEN_LANE_C_OBSERVED');
assert.equal(report.comparisonState, 'OBSERVED_CROSS_RELEASE_CHANGE');
assert.equal(report.verifiedSampleCount, 3);
assert.equal(report.multiReleaseTrend, 'BOUNDED_VERIFIED_HISTORY');
assert.equal(report.current.executionSeconds, 120);
assert.equal(report.current.preparationSeconds, 240);
assert.equal(report.current.queueSeconds, 60);
assert.equal(report.observedExecutionDifferenceSeconds, -120);
assert.equal(report.sla.result, 'MEETS_OBSERVATIONAL_SLA_BUDGET');
assert.equal(report.plannedOldLaunches, 55);
assert.equal(report.plannedNewLaunches, 5);
assert.equal(report.safeguards.releaseAuthority, false);
assert.equal(report.safeguards.independentCausalSavingsProof, false);
assert.equal(report.trends.laneExecutionP95Seconds, 240);
assert.equal(report.trends.runnerPreparationMedianSeconds, 240);

for (const mutated of [
  { ...current, sample: { ...current.sample, status: 'HOLD_NOT_VERIFIED' } },
  { ...current, jobs: current.jobs.filter((job) => job.name !== 'Browser regression lane b') },
  { ...current, jobs: [...current.jobs, current.jobs[0]] },
  { ...current, jobs: current.jobs.map((job) => job.name === 'Browser regression lane a' ? { ...job, conclusion: 'failure' } : job) },
  { ...current, jobs: current.jobs.map((job) => job.name === 'Browser regression lane c' ? { ...job, steps: job.steps.slice(1) } : job) },
]) {
  assert.equal(reviewLaneCRelease(current.sample, [mutated, prior]).state, 'HOLD_UNVERIFIED_OR_INCOMPLETE_LANE_C');
}
const exception = entry(535000004, 'd'.repeat(40));
exception.jobs.find((job) => job.name === 'Browser regression lane c').steps.at(-1).completed_at = '2026-11-07T02:12:00Z';
assert.equal(reviewLaneCRelease(exception.sample, [exception, prior]).sla.result, 'OBSERVED_SLA_EXCEPTION');
assert.equal(reviewLaneCRelease(current.sample, [current]).comparisonState, 'HOLD_NO_COMPARABLE_LANE_C');
assert.throws(() => reviewLaneCRelease(current.sample, null), /history required/);

const workflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const telemetry = readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml', 'utf8');
assert.ok(workflow.includes('node scripts/build535-lane-c-timing-check.mjs'));
assert.ok(telemetry.includes('ci-runtime-audit:') && telemetry.includes('actions: read'));
assert.ok(!workflow.includes('ci-runtime-audit:'));
console.log('Build 535: exact-main Lane-C and runner-start timing, multi-release SLA evidence, and fail-closed absent/failed gates verified.');
