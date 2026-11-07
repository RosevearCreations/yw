/** Build 533: source-timestamped runner variance and apples-to-apples batch timing. */
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';

const LANES = ['Browser regression lane a', 'Browser regression lane b', 'Browser regression lane c'];
const BATCH_NAMES = [17, 18, 19].map((n) => `Browser regression batch ${n} (10 retained commands)`);
const secs = (a, b) => {
  const start = Date.parse(a ?? ''), end = Date.parse(b ?? '');
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 1000) : null;
};
const unique = (items, name) => {
  const matches = items.filter((item) => item.name === name);
  return matches.length === 1 ? matches[0] : null;
};
const quantile = (numbers, fraction) => numbers.length
  ? [...numbers].sort((a, b) => a - b)[Math.ceil(numbers.length * fraction) - 1] : null;

function verifiedJobs(entry) {
  const { sample, jobs } = entry ?? {};
  if (sample?.status !== 'VERIFIED_GREEN' || !Array.isArray(jobs)) return null;
  if (!REQUIRED_GATES.every((name) => unique(jobs, name)?.conclusion === 'success')) return null;
  if (!LANES.every((name) => secs(unique(jobs, name)?.started_at, unique(jobs, name)?.completed_at) !== null)) return null;
  return jobs;
}

export function analyzeRunnerVariance(history) {
  if (!Array.isArray(history)) throw new Error('Original bounded run history is required.');
  const verified = history.filter((entry) => verifiedJobs(entry));
  const laneStats = LANES.map((name) => {
    const observations = verified.map(({ sample, jobs }) => ({
      runId: sample.runId, seconds: secs(unique(jobs, name).started_at, unique(jobs, name).completed_at),
    }));
    const durations = observations.map(({ seconds }) => seconds);
    const median = quantile(durations, 0.5), p95 = quantile(durations, 0.95);
    return {
      name, observations, sampleCount: observations.length,
      medianSeconds: median, p95Seconds: p95,
      rangeSeconds: durations.length ? Math.max(...durations) - Math.min(...durations) : null,
      possibleRunnerVariance: durations.length >= 3 && p95 - median > 90,
    };
  });
  return {
    state: verified.length >= 3 ? 'OBSERVED_RUNNER_VARIANCE' : 'INSUFFICIENT_VERIFIED_RUNNER_SAMPLES',
    verifiedSampleCount: verified.length,
    laneStats,
    warning: 'Runner timing spreads are descriptive; queue contention, host variance and test work are not isolated causes.',
  };
}

function observedBatchTimes(entry) {
  const jobs = verifiedJobs(entry);
  if (!jobs) return null;
  const source = unique(jobs, 'source-checks');
  const steps = Array.isArray(source?.steps) ? source.steps : [];
  const batches = BATCH_NAMES.map((name) => {
    const step = unique(steps, name);
    return {
      name, seconds: step?.conclusion === 'success' ? secs(step.started_at, step.completed_at) : null,
    };
  });
  return batches.every(({ seconds }) => seconds !== null) ? batches : null;
}

export function analyzeHotspotReduction(current, history) {
  if (!current || !Array.isArray(history)) throw new Error('Current exact run and original history are required.');
  const currentEntry = history.find(({ sample }) => sample.runId === current.runId && sample.headSha === current.headSha);
  const observed = currentEntry && current.status === 'VERIFIED_GREEN' ? observedBatchTimes(currentEntry) : null;
  const previousEntry = history.find((entry) => entry.sample.runId !== current.runId &&
    entry.sample.headSha !== current.headSha && observedBatchTimes(entry));
  const previous = previousEntry ? observedBatchTimes(previousEntry) : null;
  return {
    state: observed && previous ? 'OBSERVED_SAME_SUITE_BATCH_TIMING' : 'HOLD_NO_COMPARABLE_COMPLETE_BATCH_TIMING',
    currentRunId: current.runId,
    priorRunId: previousEntry?.sample.runId ?? null,
    plannedPriorInvocations: 30,
    plannedCurrentInvocations: 3,
    retainedSuiteCount: 30,
    batches: BATCH_NAMES.map((name, index) => ({
      name,
      currentSeconds: observed?.[index].seconds ?? null,
      priorSeconds: previous?.[index].seconds ?? null,
      observedDifferenceSeconds: observed && previous ? observed[index].seconds - previous[index].seconds : null,
    })),
    independentlyProvenCausalSavings: false,
    caution: 'Identical source step names and 30 retained specs support descriptive timing only; runner effects and causal speedups are not proven.',
  };
}

export function reviewBuild533(current, history) {
  return {
    schema: 'ywi.build533.runner-variance-hotspots.v1',
    runnerVariance: analyzeRunnerVariance(history),
    hotspotTiming: analyzeHotspotReduction(current, history),
    safeguards: {
      releaseAuthority: false, retries: false, gateWaiver: false, changedRequiredGates: false,
      changedBrowserCoverage: false, environmentMutation: false, requiredGates: REQUIRED_GATES,
    },
  };
}
