#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUIRED_GATES, summarizeRun } from './build530-ci-runtime-audit-core.mjs';
import { analyzeCriticalPath, triageHistoricalRuns, verifySlaComparison, reviewBuild532 } from './build532-ci-critical-path-core.mjs';

const sha = 'd'.repeat(40);
const rawRun = {
  id: 532000001, head_sha: sha, run_attempt: 1, status: 'completed', conclusion: 'success',
  head_repository: { full_name: 'RosevearCreations/yw' }, event: 'push', head_branch: 'main',
  created_at: '2026-11-06T10:00:00Z', run_started_at: '2026-11-06T10:00:00Z',
  updated_at: '2026-11-06T10:08:10Z',
};
const intervals = {
  'Browser regression lane a': ['10:01:00', '10:02:00'],
  'Browser regression lane b': ['10:01:00', '10:02:30'],
  'Browser regression lane c': ['10:01:00', '10:04:00'],
  'source-checks': ['10:04:05', '10:07:00'],
  'repository-enforcement': ['10:01:00', '10:01:45'],
  'release-source-evidence': ['10:07:05', '10:07:20'],
  'release-truth-summary': ['10:07:25', '10:07:55'],
};
const iso = (time) => `2026-11-06T${time}Z`;
const rawJobs = REQUIRED_GATES.map((name) => ({
  name, status: 'completed', conclusion: 'success', created_at: iso('10:00:00'),
  started_at: iso(intervals[name][0]), completed_at: iso(intervals[name][1]),
  steps: name === 'source-checks' ? [
    { name: 'setup node', number: 1, conclusion: 'success', started_at: iso('10:04:05'), completed_at: iso('10:04:20') },
    { name: 'browser batch', number: 2, conclusion: 'success', started_at: iso('10:04:20'), completed_at: iso('10:06:40') },
    { name: 'release verifier', number: 3, conclusion: 'success', started_at: iso('10:06:40'), completed_at: iso('10:07:00') },
  ] : [],
}));
const current = summarizeRun(rawRun, rawJobs, { expectedSha: sha });
const analysis = analyzeCriticalPath(current, rawJobs);
assert.equal(current.status, 'VERIFIED_GREEN');
assert.equal(analysis.state, 'MEASURED_DEPENDENCY_PATH');
assert.equal(analysis.controllingLane, 'Browser regression lane c');
assert.deepEqual(analysis.criticalPathCandidate, ['Browser regression lane c', 'source-checks', 'release-source-evidence', 'release-truth-summary']);
assert.equal(analysis.parallelWindowSeconds, 180);
assert.equal(analysis.sourceSuiteSeconds, 175);
assert.equal(analysis.largestMeasuredStage.name, 'parallel-browser-window');
assert.equal(analysis.handoffs[0].seconds, 5);
assert.equal(analysis.handoffs[1].seconds, 5);
assert.equal(analysis.handoffs[2].seconds, 5);
assert.equal(analysis.sourceStepsTotal, 3);
assert.equal(analysis.sourceStepsTimed, 3);
assert.equal(analysis.sourceStepDetails[0].name, 'browser batch');
assert.equal(analysis.sourceStepDetails[0].elapsedSeconds, 140);
assert.equal(analysis.independentRepositoryGate.elapsedSeconds, 45);
assert.equal(analyzeCriticalPath({ ...current, status: 'HOLD_NOT_VERIFIED' }, rawJobs).state, 'HOLD_INCOMPLETE_OR_UNVERIFIED_TIMING');
assert.equal(analyzeCriticalPath(current, rawJobs.filter((job) => job.name !== 'source-checks')).state, 'HOLD_INCOMPLETE_OR_UNVERIFIED_TIMING');
assert.equal(analyzeCriticalPath(current, [...rawJobs, rawJobs[0]]).state, 'HOLD_INCOMPLETE_OR_UNVERIFIED_TIMING');
const outOfOrder = rawJobs.map((job) => job.name === 'source-checks' ? { ...job, started_at: iso('10:03:59') } : job);
assert.equal(analyzeCriticalPath(current, outOfOrder).state, 'REVIEW_NONMONOTONIC_JOB_TIMESTAMPS');
const noSteps = rawJobs.map((job) => job.name === 'source-checks' ? { ...job, steps: undefined } : job);
assert.equal(analyzeCriticalPath(current, noSteps).sourceStepsComplete, false);

const failedHistorical = {
  ...current, runId: 532000000, headSha: 'e'.repeat(40), status: 'HOLD_NOT_VERIFIED',
  runConclusion: 'failure',
  gates: current.gates.map((gate) => gate.name === 'source-checks' ? { ...gate, state: 'failure' }
    : gate.name === 'release-source-evidence' ? { ...gate, state: 'skipped' } : gate),
};
const historical = triageHistoricalRuns([current, failedHistorical], current.runId);
assert.equal(historical.length, 1);
assert.equal(historical[0].evidenceState, 'HISTORICAL_HOLD_NOT_CURRENT_MAIN');
assert.deepEqual(historical[0].primaryObservedFailures.map((gate) => gate.name), ['source-checks']);
assert.equal(historical[0].gateProblems.find((gate) => gate.name === 'release-source-evidence').category, 'SKIPPED_DEPENDENT_GATE_NOT_ROOT_CAUSE');
assert.equal(historical[0].ownerAction, 'REVIEW_ORIGINAL_RUN_AND_JOB_LOGS_NO_AUTOMATIC_RETRY');

const priorGreen = { ...current, runId: 532000002, headSha: 'f'.repeat(40), runSeconds: 620 };
const comparison = verifySlaComparison(current, [current, failedHistorical, priorGreen]);
assert.equal(comparison.state, 'DESCRIPTIVE_SAME_GATE_COMPARISON');
assert.equal(comparison.previousVerifiedRunId, priorGreen.runId);
assert.equal(comparison.secondsDifference, -130);
assert.equal(comparison.percentDifference, -21);
assert.equal(comparison.independentlyProvenCausalSavings, false);
assert.equal(verifySlaComparison(current, [current, failedHistorical]).state, 'NO_COMPARABLE_VERIFIED_BASELINE');
assert.equal(verifySlaComparison({ ...current, status: 'HOLD_NOT_VERIFIED' }, [priorGreen]).state, 'NO_COMPARABLE_VERIFIED_BASELINE');
const report = reviewBuild532(current, rawJobs, [current, failedHistorical, priorGreen]);
assert.equal(report.schema, 'ywi.build532.ci-critical-path-history-sla.v1');
assert.equal(report.historicalGateExceptions.length, 1);
assert.deepEqual(Object.values(report.safeguards).slice(0, 5), [false, false, false, false, false]);
assert.throws(() => analyzeCriticalPath(null, rawJobs), /Audited source/);

const source = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const post = readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml', 'utf8');
const audit = readFileSync('scripts/build530-ci-runtime-audit.mjs', 'utf8');
assert.ok(source.includes('node scripts/build532-ci-critical-path-check.mjs'));
assert.ok(source.includes('needs: browser-regression-lanes') && source.includes('needs: [source-checks, repository-enforcement, release-source-evidence]'));
assert.ok(post.includes('workflow_run:') && post.includes('ci-runtime-audit:') && post.includes('actions: read') && post.includes('contents: read'));
assert.ok(audit.includes('reviewBuild532(current, currentRawJobs, history)'));
assert.ok(!source.includes('build532-ci-critical-path:') && !source.includes('ci-runtime-audit:'), 'no extra protected gate or duplicate workflow trigger');
console.log('Build 532 critical-path, historical exception and SLA comparison contracts passed.');
