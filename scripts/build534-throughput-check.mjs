#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUIRED_GATES, summarizeRun } from './build530-ci-runtime-audit-core.mjs';
import { verifyCrossReleaseThroughput } from './build534-throughput-core.mjs';

const iso = (second) => new Date(Date.parse('2026-11-06T10:00:00Z') + 1000 * second).toISOString();
function fixture(runId, character, sourceSeconds, tailSeconds, releaseSeconds) {
  const headSha = character.repeat(40);
  const run = {
    id: runId, head_sha: headSha, event: 'push', head_branch: 'main',
    head_repository: { full_name: 'RosevearCreations/yw' },
    created_at: iso(0), run_started_at: iso(0), updated_at: iso(releaseSeconds),
    status: 'completed', conclusion: 'success',
  };
  const jobs = REQUIRED_GATES.map((name, index) => ({
    name, status: 'completed', conclusion: 'success', created_at: iso(0),
    started_at: iso(index < 3 ? 30 : 180),
    completed_at: iso(index < 3 ? 30 + index * 10 : name === 'source-checks' ? 180 + sourceSeconds : 360),
    steps: name === 'source-checks' ? [
      { name: 'Browser regression batch 21 (10 retained commands)', conclusion: 'success', started_at: iso(200), completed_at: iso(200 + tailSeconds[0]) },
      { name: 'Browser regression batch 22 (8 retained commands)', conclusion: 'success', started_at: iso(230), completed_at: iso(230 + tailSeconds[1]) },
    ] : [],
  }));
  return { sample: summarizeRun(run, jobs, { expectedSha: headSha }), jobs };
}
const current = fixture(534003, 'a', 74, [12, 10], 425);
const before = fixture(534002, 'b', 100, [27, 25], 470);
const older = fixture(534001, 'c', 110, [29, 27], 495);
const comparison = verifyCrossReleaseThroughput(current.sample, [current, before, older]);
assert.equal(comparison.schema, 'ywi.build534.cross-release-throughput.v1');
assert.equal(comparison.state, 'VERIFIED_SOURCE_STEP_COMPARISON');
assert.equal(comparison.trendState, 'BOUNDED_VERIFIED_RUN_TREND');
assert.equal(comparison.verifiedSampleCount, 3);
assert.equal(comparison.previousVerifiedRunId, before.sample.runId);
assert.equal(comparison.sourceSeconds, 74);
assert.equal(comparison.priorSourceSeconds, 100);
assert.equal(comparison.sourceDifferenceSeconds, -26);
assert.equal(comparison.releaseDifferenceSeconds, -45);
assert.equal(comparison.tailDifferenceSeconds, -30);
assert.deepEqual(comparison.steps.map((step) => step.observedDifferenceSeconds), [-15, -15]);
assert.equal(comparison.sourceMedianSeconds, 100);
assert.equal(comparison.releaseP95Seconds, 495);
assert.deepEqual([comparison.retainedSpecs, comparison.previousProcessLaunches, comparison.currentProcessLaunches], [18, 18, 2]);
assert.equal(comparison.independentlyProvenCausalSavings, false);
assert.deepEqual(Object.values(comparison.safeguards), [false, false, false, false, false, true]);
assert.equal(verifyCrossReleaseThroughput(current.sample, [current, before]).trendState, 'INSUFFICIENT_VERIFIED_HISTORY');
assert.equal(verifyCrossReleaseThroughput(current.sample, [current]).state, 'HOLD_NO_EXACT_COMPARABLE_TIMING');
assert.equal(verifyCrossReleaseThroughput({ ...current.sample, status: 'HOLD_NOT_VERIFIED' }, [current, before]).state, 'HOLD_NO_EXACT_COMPARABLE_TIMING');
const missingStep = { ...before, jobs: before.jobs.map((job) => job.name === 'source-checks' ? { ...job, steps: job.steps.slice(1) } : job) };
assert.equal(verifyCrossReleaseThroughput(current.sample, [current, missingStep]).state, 'HOLD_NO_EXACT_COMPARABLE_TIMING');
const failedSource = { ...before, jobs: before.jobs.map((job) => job.name === 'source-checks' ? { ...job, conclusion: 'failure' } : job) };
assert.equal(verifyCrossReleaseThroughput(current.sample, [current, failedSource]).state, 'HOLD_NO_EXACT_COMPARABLE_TIMING');
const duplicate = { ...before, jobs: [...before.jobs, before.jobs[0]] };
assert.equal(verifyCrossReleaseThroughput(current.sample, [current, duplicate]).state, 'HOLD_NO_EXACT_COMPARABLE_TIMING');
const reversed = { ...before, jobs: before.jobs.map((job) => job.name === 'source-checks'
  ? { ...job, steps: job.steps.map((step, index) => index === 1 ? { ...step, completed_at: iso(120) } : step) } : job) };
assert.equal(verifyCrossReleaseThroughput(current.sample, [current, reversed]).state, 'HOLD_NO_EXACT_COMPARABLE_TIMING');
assert.throws(() => verifyCrossReleaseThroughput(null, []), /Exact current run/);
const workflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const audit = readFileSync('scripts/build530-ci-runtime-audit.mjs', 'utf8');
const post = readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml', 'utf8');
assert.ok(workflow.includes('node scripts/build534-throughput-check.mjs'));
assert.ok(audit.includes('verifyCrossReleaseThroughput(current, detailedHistory)'));
assert.ok(post.includes('actions: read') && post.includes('contents: read') && post.includes('workflow_run:'));
assert.ok(!workflow.includes('ci-runtime-audit:') && !workflow.includes('build534-throughput:'));
console.log('Build 534 exact-main source-step throughput, bounded history and fail-closed missing gate evidence checks passed.');
