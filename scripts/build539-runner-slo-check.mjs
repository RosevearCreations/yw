#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';
import { WARM_BATCH_NAMES } from './build536-source-variance-core.mjs';
import { STANDALONE_BROWSER_STEPS } from './build537-nonbrowser-p95-core.mjs';
import { reviewBuild539 } from './build539-runner-slo-core.mjs';

const stamp = (seconds) => new Date(Date.parse('2026-11-07T04:00:00Z') + seconds * 1000).toISOString();
const step = (name, number, a, b) => ({ name, number, conclusion: 'success',
  started_at: stamp(a), completed_at: stamp(b) });

function make(index, { handoff = 2, gap = 1, sourceSeconds = 180, releaseSeconds = 460,
  warmDuration = 12 } = {}) {
  const sourceStart = 10 + handoff;
  const steps = [step('Run npm ci --no-audit --no-fund', 5, sourceStart, sourceStart + 5),
    step('Source non-browser CI contract lane (11 retained checks, 3 workers)', 12,
      sourceStart + 5 + gap, sourceStart + 9 + gap),
    step('Install Chromium for rendered module acceptance', 255,
      sourceStart + 9 + gap, sourceStart + 16 + gap)];
  let cursor = sourceStart + 16 + gap;
  STANDALONE_BROWSER_STEPS.forEach((name, i) => {
    steps.push(step(name, 270 + i, cursor, cursor + 2));
    cursor += 2;
  });
  WARM_BATCH_NAMES.forEach((name, i) => {
    steps.push(step(name, 310 + i, cursor, cursor + warmDuration));
    cursor += warmDuration;
  });
  assert.ok(cursor < sourceStart + sourceSeconds, 'Fixture steps must fit source job.');
  const sample = { runId: 539000100 - index, headSha: (index + 1).toString(16).repeat(40),
    status: 'VERIFIED_GREEN', runSeconds: releaseSeconds };
  const jobs = REQUIRED_GATES.map((name) => ({ name, status: 'completed',
    conclusion: 'success', started_at: stamp(name === 'source-checks' ? sourceStart : 0),
    completed_at: stamp(name === 'source-checks' ? sourceStart + sourceSeconds : 10),
    steps: name === 'source-checks' ? steps : [] }));
  return { sample, jobs };
}

const baseline = [make(0), make(1, { sourceSeconds: 182, releaseSeconds: 464 }),
  make(2, { sourceSeconds: 184, releaseSeconds: 468 }),
  make(3, { sourceSeconds: 181, releaseSeconds: 461 }),
  make(4, { sourceSeconds: 183, releaseSeconds: 465 }),
  make(5, { sourceSeconds: 185, releaseSeconds: 469 })];
const options = { exactCurrentMain: true };
const evaluate = (entries = baseline, opts = options) => reviewBuild539(entries[0].sample, entries, opts);
const healthy = evaluate();
assert.equal(healthy.state, 'EXACT_MAIN_VERIFIED_ORIGINAL_ACTIONS_SCHEDULING');
assert.equal(healthy.trendState, 'SIX_RELEASE_VERIFIED_TREND');
assert.equal(healthy.sloState, 'MEETS_OBSERVATIONAL_SLO_BUDGET');
assert.equal(healthy.verifiedDistinctSamples, 6);
assert.equal(healthy.current.handoffSeconds, 2);
assert.equal(healthy.current.setupSeconds, 5);
assert.equal(healthy.current.interStepGapSeconds, 1);
assert.equal(healthy.historicalP95.sourceStepGapSeconds, 1);
assert.equal(healthy.cohorts.metrics.releaseSeconds.increaseSeconds, -1);
assert.equal(healthy.alerts.length, 0);
assert.equal(healthy.safeguards.releaseAuthority, false);
assert.equal(healthy.safeguards.gateWaiver, false);

const handoff = structuredClone(baseline);
handoff[0] = make(0, { handoff: 22 });
assert.deepEqual(evaluate(handoff).alerts.filter((item) => item.code === 'SOURCE_RUNNER_HANDOFF_SLO')
  .map((item) => item.observedSeconds), [22]);
assert.ok(evaluate(handoff).alerts.some((item) => item.code === 'SOURCE_RUNNER_HANDOFF_P95'));
const gaps = structuredClone(baseline);
gaps[0] = make(0, { gap: 19 });
assert.ok(evaluate(gaps).alerts.some((item) => item.code === 'SOURCE_STEP_GAP_SLO'));
assert.ok(evaluate(gaps).alerts.some((item) => item.code === 'SOURCE_STEP_GAP_P95'));
assert.ok(evaluate(gaps).alerts.some((item) => item.code === 'SOURCE_STEP_GAP_DRIFT'));
const drifting = structuredClone(baseline);
for (let i = 0; i < 3; i++) drifting[i] = make(i, { sourceSeconds: 230,
  releaseSeconds: 560, warmDuration: 18 });
assert.ok(evaluate(drifting).alerts.some((item) => item.code === 'SOURCE_COHORT_P95_DRIFT'));
assert.ok(evaluate(drifting).alerts.some((item) => item.code === 'WARM_COHORT_P95_DRIFT'));
assert.ok(evaluate(drifting).alerts.some((item) => item.code === 'RELEASE_COHORT_P95_DRIFT'));
assert.equal(evaluate(drifting).sloState, 'REVIEW_OBSERVED_SLO_DRIFT');

assert.equal(evaluate(baseline, { exactCurrentMain: false }).sloState, 'HOLD_UNVERIFIABLE_SLO');
assert.equal(evaluate(baseline.slice(0, 5)).trendState, 'HOLD_INSUFFICIENT_DISTINCT_VERIFIED_RELEASES');
const duplicate = structuredClone(baseline);
duplicate[4].sample.headSha = duplicate[3].sample.headSha;
assert.equal(evaluate(duplicate).sloState, 'HOLD_UNVERIFIABLE_SLO');
const failed = structuredClone(baseline);
failed[0].jobs.find((job) => job.name === 'release-source-evidence').conclusion = 'failure';
assert.equal(evaluate(failed).state, 'HOLD_UNVERIFIED_EXACT_MAIN');
const missing = structuredClone(baseline);
missing[0].jobs.find((job) => job.name === 'source-checks').steps = [];
assert.equal(evaluate(missing).state, 'HOLD_UNVERIFIED_EXACT_MAIN');
const timestamp = structuredClone(baseline);
timestamp[0].jobs.find((job) => job.name === 'source-checks').started_at = stamp(99);
assert.equal(evaluate(timestamp).state, 'HOLD_UNVERIFIED_EXACT_MAIN');
assert.throws(() => reviewBuild539(baseline[0].sample, null, options), /required/);

const sourceWorkflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const audit = readFileSync('scripts/build530-ci-runtime-audit.mjs', 'utf8');
const post = readFileSync('.github/workflows/post-promotion-dev-reconciliation.yml', 'utf8');
assert.equal((sourceWorkflow.match(/run: node scripts\/build539-runner-slo-check\.mjs/g) ?? []).length, 1);
assert.ok(audit.includes('reviewBuild539(current, detailedHistory, { exactCurrentMain })'));
assert.ok(post.includes('Build 530–539 read-only CI throughput and recovery evidence'));
assert.ok(!sourceWorkflow.includes('  build539:'));
console.log('Build 539: exact-main runner handoff SLO, step-gap drift, distinct-six-release throughput trend and non-blocking alerts verified.');
