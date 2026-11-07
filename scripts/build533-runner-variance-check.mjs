#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeRun, REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';
import { analyzeRunnerVariance, analyzeHotspotReduction, reviewBuild533 } from './build533-runner-variance-core.mjs';

const sha = (character) => character.repeat(40);
const clock = (second) => new Date(Date.parse('2026-11-06T10:00:00Z') + second * 1000).toISOString();
const names = [17, 18, 19].map((n) => `Browser regression batch ${n} (10 retained commands)`);
function fixture(runId, headSha, laneSeconds, batchSeconds = [33, 27, 30]) {
  const run = {
    id: runId, head_sha: headSha, status: 'completed', conclusion: 'success', event: 'push', head_branch: 'main',
    head_repository: { full_name: 'RosevearCreations/yw' }, created_at: clock(0), run_started_at: clock(0), updated_at: clock(490),
  };
  const jobs = REQUIRED_GATES.map((name, index) => ({
    name, conclusion: 'success', status: 'completed', created_at: clock(0),
    started_at: clock(index < 3 ? 30 : 300), completed_at: clock(index < 3 ? 30 + laneSeconds[index] : 470),
    steps: name === 'source-checks' ? names.map((step, i) => ({
      name: step, conclusion: 'success', started_at: clock(320 + i * 40), completed_at: clock(320 + i * 40 + batchSeconds[i]),
    })) : [],
  }));
  return { sample: summarizeRun(run, jobs, { expectedSha: headSha }), jobs };
}
const current = fixture(533001, sha('a'), [200, 210, 240], [22, 20, 21]);
const previous = fixture(533000, sha('b'), [195, 240, 250]);
const older = fixture(532999, sha('c'), [220, 215, 235]);
const history = [current, previous, older];
const variance = analyzeRunnerVariance(history);
assert.equal(variance.state, 'OBSERVED_RUNNER_VARIANCE');
assert.equal(variance.verifiedSampleCount, 3);
assert.equal(variance.laneStats.length, 3);
assert.equal(variance.laneStats[0].medianSeconds, 200);
assert.equal(variance.laneStats[0].p95Seconds, 220);
assert.equal(variance.laneStats[0].rangeSeconds, 25);
assert.equal(variance.laneStats[0].possibleRunnerVariance, false);
assert.equal(analyzeRunnerVariance([current, previous]).state, 'INSUFFICIENT_VERIFIED_RUNNER_SAMPLES');
assert.equal(analyzeRunnerVariance([]).verifiedSampleCount, 0);
const outlier = fixture(532998, sha('d'), [530, 210, 200]);
assert.equal(analyzeRunnerVariance([current, previous, outlier]).laneStats[0].possibleRunnerVariance, true);
const timing = analyzeHotspotReduction(current.sample, history);
assert.equal(timing.state, 'OBSERVED_SAME_SUITE_BATCH_TIMING');
assert.equal(timing.priorRunId, previous.sample.runId);
assert.equal(timing.retainedSuiteCount, 30);
assert.equal(timing.plannedPriorInvocations, 30);
assert.equal(timing.plannedCurrentInvocations, 3);
assert.deepEqual(timing.batches.map(({ observedDifferenceSeconds }) => observedDifferenceSeconds), [-11, -7, -9]);
assert.equal(timing.independentlyProvenCausalSavings, false);
const missingStep = { ...previous, jobs: previous.jobs.map((job) => job.name === 'source-checks'
  ? { ...job, steps: job.steps.slice(1) } : job) };
assert.equal(analyzeHotspotReduction(current.sample, [current, missingStep]).state, 'HOLD_NO_COMPARABLE_COMPLETE_BATCH_TIMING');
const badSourceGate = { ...previous, jobs: previous.jobs.map((job) => job.name === 'source-checks'
  ? { ...job, conclusion: 'failure' } : job) };
assert.equal(analyzeRunnerVariance([current, badSourceGate, older]).verifiedSampleCount, 2);
const duplicate = { ...previous, jobs: [...previous.jobs, previous.jobs[0]] };
assert.equal(analyzeRunnerVariance([duplicate]).verifiedSampleCount, 0);
const badClock = { ...previous, jobs: previous.jobs.map((job) => job.name === 'Browser regression lane a'
  ? { ...job, completed_at: clock(2) } : job) };
assert.equal(analyzeRunnerVariance([badClock]).verifiedSampleCount, 0);
assert.equal(analyzeHotspotReduction({ ...current.sample, status: 'HOLD_NOT_VERIFIED' }, history).state, 'HOLD_NO_COMPARABLE_COMPLETE_BATCH_TIMING');
assert.throws(() => analyzeRunnerVariance(null), /history is required/);
assert.throws(() => analyzeHotspotReduction(null, history), /Current exact/);
const result = reviewBuild533(current.sample, history);
assert.equal(result.schema, 'ywi.build533.runner-variance-hotspots.v1');
assert.deepEqual(Object.values(result.safeguards).slice(0, 6), [false, false, false, false, false, false]);
const workflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const audit = readFileSync('scripts/build530-ci-runtime-audit.mjs', 'utf8');
const post = readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml', 'utf8');
assert.ok(workflow.includes('node scripts/build533-runner-variance-check.mjs'));
assert.ok(audit.includes('reviewBuild533(current, detailedHistory)'));
assert.ok(post.includes('actions: read') && post.includes('contents: read'));
assert.ok(!workflow.includes('build533-runner-variance:') && !workflow.includes('ci-runtime-audit:'));
console.log('Build 533 runner variance, exact step comparison, fail-closed missing proof and gate preservation checks passed.');
