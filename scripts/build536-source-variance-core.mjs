/** Build 536 — original Actions step evidence for post-Chromium warm-context
 * browser batches 17–22, source critical-path variance and end-to-end SLA.
 * Never infer a cache hit or causal speedup from consecutive warm-context steps.
 */
import { REQUIRED_GATES, LIMITS } from './build530-ci-runtime-audit-core.mjs';

export const WARM_BATCH_NAMES = Object.freeze([
  'Browser regression batch 17 (10 retained commands)',
  'Browser regression batch 18 (10 retained commands)',
  'Browser regression batch 19 (10 retained commands)',
  'Browser regression batch 20 (3 retained commands)',
  'Browser regression batch 21 (10 retained commands)',
  'Browser regression batch 22 (8 retained commands)',
]);
const INSTALL = 'Install Chromium for rendered module acceptance';
const unique = (items, name) => {
  const hits = items.filter((item) => item.name === name);
  return hits.length === 1 ? hits[0] : null;
};
const seconds = (a, b) => {
  const start = Date.parse(a ?? ''), end = Date.parse(b ?? '');
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 1000) : null;
};
const quantile = (items, fraction) => items.length
  ? [...items].sort((a, b) => a - b)[Math.ceil(items.length * fraction) - 1] : null;

function verifiedSourceObservation(entry) {
  const { sample, jobs } = entry ?? {};
  if (sample?.status !== 'VERIFIED_GREEN' || !Array.isArray(jobs) ||
    !REQUIRED_GATES.every((name) => unique(jobs, name)?.conclusion === 'success')) return null;
  const source = unique(jobs, 'source-checks');
  const steps = Array.isArray(source?.steps) ? source.steps : [];
  const install = unique(steps, INSTALL);
  if (install?.conclusion !== 'success' || !Number.isSafeInteger(install.number)) return null;
  const batches = WARM_BATCH_NAMES.map((name) => {
    const step = unique(steps, name);
    const elapsed = step?.conclusion === 'success' ? seconds(step.started_at, step.completed_at) : null;
    return { name, number: step?.number, seconds: elapsed, startedAt: step?.started_at ?? null,
      completedAt: step?.completed_at ?? null };
  });
  const numbers = batches.map((batch) => batch.number);
  if (batches.some(({ seconds: s }) => s === null) ||
    numbers.some((n) => !Number.isSafeInteger(n)) ||
    numbers[0] <= install.number ||
    numbers.some((n, i) => i > 0 && n <= numbers[i - 1]) ||
    seconds(install.completed_at, batches[0].startedAt) === null ||
    !Number.isSafeInteger(sample.runSeconds)) return null;
  const sourceSeconds = seconds(source.started_at, source.completed_at);
  const totalBatchSeconds = batches.reduce((sum, batch) => sum + batch.seconds, 0);
  if (sourceSeconds === null || totalBatchSeconds > sourceSeconds) return null;
  return {
    runId: sample.runId, sha: sample.headSha, sourceSeconds, releaseSeconds: sample.runSeconds,
    warmContext: 'SAME_RUN_PINNED_CHROMIUM_ALREADY_INSTALLED',
    batchSeconds: totalBatchSeconds, otherSourceSeconds: sourceSeconds - totalBatchSeconds,
    batches: batches.map(({ name, seconds: elapsed }) => ({ name, seconds: elapsed })),
  };
}

export function reviewSourceWarmVariance(current, history) {
  if (!current || !Array.isArray(history)) throw new Error('Exact current main and bounded original jobs required.');
  const observations = history.map(verifiedSourceObservation).filter(Boolean);
  const observed = current.status === 'VERIFIED_GREEN'
    ? observations.find((entry) => entry.runId === current.runId && entry.sha === current.headSha) : null;
  const prior = observations.find((entry) => entry.runId !== current.runId && entry.sha !== current.headSha) ?? null;
  const comparable = Boolean(observed && prior);
  const sourceDurations = observations.map((entry) => entry.sourceSeconds);
  const releaseDurations = observations.map((entry) => entry.releaseSeconds);
  const warmDurations = observations.map((entry) => entry.batchSeconds);
  const currentBatch = observed?.batches ?? [];
  const priorBatch = prior?.batches ?? [];
  const totalDelta = comparable ? observed.sourceSeconds - prior.sourceSeconds : null;
  const warmDelta = comparable ? observed.batchSeconds - prior.batchSeconds : null;
  return {
    schema: 'ywi.build536.source-warm-variance.v1',
    state: observed ? 'EXACT_MAIN_GREEN_WARM_CONTEXT_OBSERVED' : 'HOLD_MISSING_OR_UNVERIFIED_WARM_BATCH_EVIDENCE',
    comparisonState: comparable ? 'OBSERVED_CROSS_RELEASE_SAME_BATCH_NAMES' : 'HOLD_NO_COMPARABLE_SOURCE_RELEASE',
    currentRunId: current.runId, priorVerifiedRunId: prior?.runId ?? null,
    verifiedSampleCount: observations.length,
    trendState: observations.length >= 3 ? 'BOUNDED_VERIFIED_HISTORY' : 'INSUFFICIENT_VERIFIED_HISTORY',
    sourceBrowserSuiteCount: 51, batch20OriginalLaunches: 3, batch20CurrentLaunches: 1,
    warmContext: observed?.warmContext ?? 'HOLD_UNOBSERVED',
    current: observed ?? null, prior,
    sourceDifferenceSeconds: totalDelta,
    batchDifferenceSeconds: warmDelta,
    otherSourceDifferenceSeconds: comparable ? observed.otherSourceSeconds - prior.otherSourceSeconds : null,
    observedVarianceLocation: !comparable ? 'HOLD_UNCOMPARABLE'
      : Math.abs(warmDelta) >= Math.abs(totalDelta - warmDelta) ? 'WARM_BATCH_17_TO_22_TIME' : 'OTHER_SOURCE_TIME',
    batchStats: WARM_BATCH_NAMES.map((name, index) => {
      const durations = observations.map((entry) => entry.batches[index].seconds);
      return { name, currentSeconds: currentBatch[index]?.seconds ?? null,
        priorSeconds: priorBatch[index]?.seconds ?? null,
        observedDifferenceSeconds: comparable ? currentBatch[index].seconds - priorBatch[index].seconds : null,
        medianSeconds: quantile(durations, 0.5), p95Seconds: quantile(durations, 0.95) };
    }),
    trend: {
      sourceMedianSeconds: quantile(sourceDurations, 0.5), sourceP95Seconds: quantile(sourceDurations, 0.95),
      warmBatchMedianSeconds: quantile(warmDurations, 0.5), warmBatchP95Seconds: quantile(warmDurations, 0.95),
      releaseMedianSeconds: quantile(releaseDurations, 0.5), releaseP95Seconds: quantile(releaseDurations, 0.95),
    },
    sla: {
      sourceBudgetSeconds: 240, warmBatchesBudgetSeconds: 160, releaseBudgetSeconds: LIMITS.runSeconds,
      state: !observed ? 'HOLD_UNVERIFIED' : observed.sourceSeconds <= 240 &&
        observed.batchSeconds <= 160 && observed.releaseSeconds <= LIMITS.runSeconds
        ? 'MEETS_OBSERVATIONAL_SLA_BUDGET' : 'OBSERVED_SLA_EXCEPTION',
    },
    safeguards: {
      releaseAuthority: false, causalCacheHitProven: false, causalSpeedupProven: false,
      automaticRetry: false, weakenedGate: false, environmentMutation: false,
      requiredGates: REQUIRED_GATES, requireExactMain: true,
    },
    caution: 'All six batches follow a successful Chromium-install step in the same CI job; this is warm context, not a measured cold-versus-cache-hit experiment. Timing differences remain observational.',
  };
}
