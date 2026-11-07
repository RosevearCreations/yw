/** Build 534 — read-only exact-main cross-release throughput and tail timing. */
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';

const TAIL_STEPS = Object.freeze([
  'Browser regression batch 21 (10 retained commands)',
  'Browser regression batch 22 (8 retained commands)',
]);
const unique = (items, name) => {
  const matches = items.filter((item) => item.name === name);
  return matches.length === 1 ? matches[0] : null;
};
const seconds = (start, end) => {
  const a = Date.parse(start ?? ''), b = Date.parse(end ?? '');
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 1000) : null;
};
const percentile = (numbers, fraction) => numbers.length ?
  [...numbers].sort((a, b) => a - b)[Math.ceil(numbers.length * fraction) - 1] : null;

function verifiedEntry(entry) {
  if (entry?.sample?.status !== 'VERIFIED_GREEN' || !Array.isArray(entry.jobs)) return null;
  if (!REQUIRED_GATES.every((name) => unique(entry.jobs, name)?.conclusion === 'success')) return null;
  const source = unique(entry.jobs, 'source-checks');
  const sourceSeconds = seconds(source?.started_at, source?.completed_at);
  const steps = Array.isArray(source?.steps) ? source.steps : [];
  const tail = TAIL_STEPS.map((name) => {
    const step = unique(steps, name);
    return step?.conclusion === 'success' ? seconds(step.started_at, step.completed_at) : null;
  });
  if (sourceSeconds === null || !Number.isSafeInteger(entry.sample.runSeconds) ||
    tail.some((value) => value === null)) return null;
  return { runId: entry.sample.runId, sha: entry.sample.headSha,
    sourceSeconds, releaseSeconds: entry.sample.runSeconds, tailSeconds: tail,
    tailTotalSeconds: tail.reduce((sum, value) => sum + value, 0) };
}

export function verifyCrossReleaseThroughput(current, detailedHistory) {
  if (!current || !Array.isArray(detailedHistory)) throw new Error('Exact current run and original detailed history are required.');
  const observations = detailedHistory.map(verifiedEntry).filter(Boolean);
  const currentObserved = current.status === 'VERIFIED_GREEN'
    ? observations.find((entry) => entry.runId === current.runId && entry.sha === current.headSha) : null;
  const prior = observations.find((entry) => entry.runId !== current.runId && entry.sha !== current.headSha) ?? null;
  const comparable = Boolean(currentObserved && prior);
  return {
    schema: 'ywi.build534.cross-release-throughput.v1',
    state: comparable ? 'VERIFIED_SOURCE_STEP_COMPARISON' : 'HOLD_NO_EXACT_COMPARABLE_TIMING',
    currentRunId: current.runId, previousVerifiedRunId: prior?.runId ?? null,
    verifiedSampleCount: observations.length,
    trendState: observations.length >= 3 ? 'BOUNDED_VERIFIED_RUN_TREND' : 'INSUFFICIENT_VERIFIED_HISTORY',
    releaseMedianSeconds: percentile(observations.map((item) => item.releaseSeconds), 0.5),
    releaseP95Seconds: percentile(observations.map((item) => item.releaseSeconds), 0.95),
    sourceMedianSeconds: percentile(observations.map((item) => item.sourceSeconds), 0.5),
    sourceP95Seconds: percentile(observations.map((item) => item.sourceSeconds), 0.95),
    retainedSpecs: 18, previousProcessLaunches: 18, currentProcessLaunches: 2,
    sourceSeconds: currentObserved?.sourceSeconds ?? null,
    priorSourceSeconds: prior?.sourceSeconds ?? null,
    sourceDifferenceSeconds: comparable ? currentObserved.sourceSeconds - prior.sourceSeconds : null,
    releaseSeconds: currentObserved?.releaseSeconds ?? null,
    priorReleaseSeconds: prior?.releaseSeconds ?? null,
    releaseDifferenceSeconds: comparable ? currentObserved.releaseSeconds - prior.releaseSeconds : null,
    tailTotalSeconds: currentObserved?.tailTotalSeconds ?? null,
    priorTailTotalSeconds: prior?.tailTotalSeconds ?? null,
    tailDifferenceSeconds: comparable ? currentObserved.tailTotalSeconds - prior.tailTotalSeconds : null,
    steps: TAIL_STEPS.map((name, index) => ({
      name, currentSeconds: currentObserved?.tailSeconds[index] ?? null,
      previousSeconds: prior?.tailSeconds[index] ?? null,
      observedDifferenceSeconds: comparable ? currentObserved.tailSeconds[index] - prior.tailSeconds[index] : null,
    })),
    independentlyProvenCausalSavings: false,
    safeguards: { releaseAuthority: false, skipRequiredChecks: false, automaticRetry: false,
      changeExternalProductionState: false, changeTestCoverage: false, requireExactCurrentMainGate: true },
    limitation: 'Same-named successful source steps and identical required gates allow observational comparisons only; runner and network variability are not controlled.',
  };
}
