#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUIRED_GATES, summarizeRun, summarizeTrend } from './build530-ci-runtime-audit-core.mjs';

const sha = 'a'.repeat(40);
const run = {
  id: 530000001,
  run_attempt: 1,
  head_sha: sha,
  status: 'completed',
  conclusion: 'success',
  event: 'push',
  head_branch: 'main',
  head_repository: { full_name: 'RosevearCreations/yw' },
  created_at: '2026-11-06T01:00:00Z',
  run_started_at: '2026-11-06T01:00:30Z',
  updated_at: '2026-11-06T01:08:00Z',
};
const jobs = REQUIRED_GATES.map((name, index) => ({
  name,
  status: 'completed',
  conclusion: 'success',
  created_at: '2026-11-06T01:00:00Z',
  started_at: index < 3 ? '2026-11-06T01:01:00Z' : '2026-11-06T01:04:00Z',
  completed_at: index < 3 ? '2026-11-06T01:03:00Z' : '2026-11-06T01:07:00Z',
}));
const verified = summarizeRun(run, jobs, { expectedSha: sha });
assert.equal(verified.status, 'VERIFIED_GREEN');
assert.equal(verified.runSeconds, 480);
assert.equal(verified.queueSeconds, 30);
assert.equal(verified.laneOverlapSeconds, 120);
assert.equal(verified.failedOrMissingGates.length, 0);

function hold(message, mutatedRun = run, mutatedJobs = jobs, expectedSha = sha) {
  const result = summarizeRun(mutatedRun, mutatedJobs, { expectedSha });
  assert.equal(result.status, 'HOLD_NOT_VERIFIED', message);
  return result;
}
assert.deepEqual(hold('missing lane', run, jobs.filter((job) => job.name !== 'Browser regression lane c')).failedOrMissingGates, ['Browser regression lane c']);
assert.ok(hold('failed lane', run, jobs.map((job) => job.name === 'Browser regression lane b' ? { ...job, conclusion: 'failure' } : job)).failedOrMissingGates.includes('Browser regression lane b'));
assert.ok(hold('skipped independent repository gate', run, jobs.map((job) => job.name === 'repository-enforcement' ? { ...job, conclusion: 'skipped' } : job)).failedOrMissingGates.includes('repository-enforcement'));
assert.ok(hold('duplicate evidence job', run, [...jobs, jobs.find((job) => job.name === 'release-source-evidence')]).failedOrMissingGates.includes('release-source-evidence'));
hold('incorrect expected main SHA', run, jobs, 'b'.repeat(40));
hold('PR cannot become production', { ...run, event: 'pull_request' });
hold('foreign repository cannot attest', { ...run, head_repository: { full_name: 'someone/else' } });
hold('incomplete run', { ...run, status: 'in_progress', conclusion: null });
hold('failed whole run', { ...run, conclusion: 'failure' });
const delayed = summarizeRun({ ...run, run_started_at: '2026-11-06T01:03:00Z', updated_at: '2026-11-06T01:20:00Z' }, jobs, { expectedSha: sha });
assert.equal(delayed.status, 'VERIFIED_GREEN', 'time budgets are diagnostic and must not silently change release authorization');
assert.equal(delayed.budget.queueExceeded, true);
assert.equal(delayed.budget.runExceeded, true);
const trend = summarizeTrend([verified, delayed]);
assert.equal(trend.sampleCount, 2);
assert.equal(trend.medianRunSeconds, 480);
assert.equal(trend.p95RunSeconds, 1200);
assert.equal(trend.verifiedCount, 2);

const source = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const telemetry = readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml', 'utf8');
assert.ok(source.includes('node scripts/build530-ci-runtime-audit-check.mjs'), 'the source contract must test the audit core on every PR/main run');
assert.ok(source.includes('needs: browser-regression-lanes') && source.includes('needs: source-checks'), 'release dependencies must remain fail-closed');
assert.ok(telemetry.includes('workflow_run:') && telemetry.includes('ci-runtime-audit:'), 'telemetry must reuse an existing workflow_run rather than create another trigger');
assert.ok(telemetry.includes('actions: read') && telemetry.includes('contents: read'), 'the telemetry job must be read-only');
assert.ok(!source.includes('ci-runtime-audit:'), 'runtime measurement is not a new bypassable source gate');
console.log('Build 530 CI runtime audit: 18 deterministic contract assertions passed.');
