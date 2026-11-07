#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUIRED_GATES, summarizeRun } from './build530-ci-runtime-audit-core.mjs';
import { LANE_BUDGET_SECONDS, reviewCiEvidence, TREND_MIN_SAMPLES } from './build531-ci-exceptions-core.mjs';

const sha = 'c'.repeat(40);
const baseRun = {
  id: 531000001, head_sha: sha, status: 'completed', conclusion: 'success',
  event: 'push', head_branch: 'main', head_repository: { full_name: 'RosevearCreations/yw' },
  created_at: '2026-11-06T10:00:00Z', run_started_at: '2026-11-06T10:00:05Z',
  updated_at: '2026-11-06T10:08:00Z',
};
const baseJobs = REQUIRED_GATES.map((name, index) => ({
  name, status: 'completed', conclusion: 'success', created_at: '2026-11-06T10:00:00Z',
  started_at: index < 3 ? '2026-11-06T10:01:00Z' : '2026-11-06T10:04:00Z',
  completed_at: index < 3 ? '2026-11-06T10:03:00Z' : '2026-11-06T10:07:00Z',
}));
const sample = (run = baseRun, jobs = baseJobs) => summarizeRun(run, jobs, { expectedSha: sha });
const history = Array.from({ length: TREND_MIN_SAMPLES }, (_, index) => sample({ ...baseRun, id: baseRun.id + index }));
const green = reviewCiEvidence(sample(), history, { exactCurrentMain: true });
assert.equal(green.releaseEvidenceState, 'VERIFIED_GREEN_EVIDENCE_ONLY');
assert.equal(green.recoveryDecision, 'OBSERVE_ONLY_NO_RELEASE_AUTHORITY');
assert.equal(green.trend.sampleCount, TREND_MIN_SAMPLES);
assert.equal(green.exceptions.length, 0);
assert.equal(green.laneBudgets.length, 3);
assert.ok(green.laneBudgets.every((lane) => lane.executionSeconds === 120 && lane.exceeded === false));
assert.deepEqual(Object.values(green.safeguards).slice(0, 4), [false, false, false, false]);

const delayed = sample({ ...baseRun, run_started_at: '2026-11-06T10:03:00Z', updated_at: '2026-11-06T10:20:00Z' });
const delayedReview = reviewCiEvidence(delayed, history, { exactCurrentMain: true });
assert.equal(delayedReview.releaseEvidenceState, 'VERIFIED_GREEN_EVIDENCE_ONLY', 'SLA miss cannot change protected checks');
assert.equal(delayedReview.recoveryDecision, 'REVIEW_PERFORMANCE_EXCEPTIONS_NO_GATE_WAIVER');
assert.ok(delayedReview.exceptions.some((item) => item.code === 'QUEUE_SLA_EXCEEDED'));
assert.ok(delayedReview.exceptions.some((item) => item.code === 'RUN_SLA_EXCEEDED'));

const slowJobs = baseJobs.map((job, index) => index === 1 ? { ...job, completed_at: '2026-11-06T10:12:00Z' } : job);
const slow = reviewCiEvidence(sample(baseRun, slowJobs), history, { exactCurrentMain: true });
assert.equal(slow.laneBudgets[1].exceeded, true);
assert.equal(slow.laneBudgets[1].overageSeconds, 60);
assert.ok(slow.exceptions.some((item) => item.code === 'LANE_RUNTIME_OVER_BUDGET'));
assert.equal(LANE_BUDGET_SECONDS, 600);

const missing = reviewCiEvidence(sample(baseRun, baseJobs.slice(1)), history, { exactCurrentMain: true });
assert.equal(missing.releaseEvidenceState, 'HOLD_NOT_VERIFIED');
assert.equal(missing.recoveryDecision, 'STOP_AND_INDEPENDENTLY_REVIEW_NO_AUTO_RETRY');
assert.ok(missing.exceptions.some((item) => item.code === 'REQUIRED_GATE_NOT_GREEN'));
assert.ok(missing.exceptions.some((item) => item.code === 'LANE_TIMING_UNAVAILABLE'));

const failed = reviewCiEvidence(sample(baseRun, baseJobs.map((job) => job.name === 'repository-enforcement' ? { ...job, conclusion: 'failure' } : job)), history, { exactCurrentMain: true });
assert.equal(failed.releaseEvidenceState, 'HOLD_NOT_VERIFIED');
const duplicate = reviewCiEvidence(sample(baseRun, [...baseJobs, baseJobs[0]]), history, { exactCurrentMain: true });
assert.equal(duplicate.releaseEvidenceState, 'HOLD_NOT_VERIFIED');
const superseded = reviewCiEvidence(sample(), history, { exactCurrentMain: false });
assert.equal(superseded.releaseEvidenceState, 'HOLD_NOT_VERIFIED');
const sparse = reviewCiEvidence(sample(), history.slice(0, 1), { exactCurrentMain: true });
assert.ok(sparse.exceptions.some((item) => item.code === 'TREND_HISTORY_INSUFFICIENT'));
const historicalHold = reviewCiEvidence(sample(), [...history.slice(0, 3), sample(baseRun, baseJobs.slice(1))], { exactCurrentMain: true });
assert.ok(historicalHold.exceptions.some((item) => item.code === 'HISTORICAL_REQUIRED_GATE_HOLD'));
assert.equal(historicalHold.releaseEvidenceState, 'VERIFIED_GREEN_EVIDENCE_ONLY', 'past failed run is reported but does not invalidate a newer verified main');
assert.throws(() => reviewCiEvidence(null, history), /complete audited/);

const source = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const post = readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml', 'utf8');
const audit = readFileSync('scripts/build530-ci-runtime-audit.mjs', 'utf8');
assert.ok(source.includes('node scripts/build531-ci-exceptions-check.mjs'), 'every source PR/main check must verify the recovery contract');
assert.ok(source.includes('needs: browser-regression-lanes'), 'protected browser gates remain required');
assert.ok(source.includes('needs: [source-checks, repository-enforcement, release-source-evidence]'), 'protected main truth continues to require independent gates');
assert.ok(post.includes('ci-runtime-audit:') && post.includes('workflow_run:'), 'no extra Actions workflow trigger');
assert.ok(post.includes('actions: read') && post.includes('contents: read'), 'post-promotion CI observer is read-only');
assert.ok(audit.includes('reviewCiEvidence(current, history, { exactCurrentMain })'), 'real run history drives exception review');
assert.ok(!source.includes('ci-runtime-audit:') && !source.includes('build531-ci-exceptions:'), 'no new release gate was added to change protection semantics');
console.log('Build 531 CI SLA and recovery contract: 30 assertions passed.');
