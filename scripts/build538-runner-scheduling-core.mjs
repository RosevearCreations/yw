/** Build 538 — original GitHub Actions scheduling and warm-browser-tail
 * attribution. Diagnostic only: no causal claim, gate waiver or retry.
 */
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';
import { reviewNonBrowserP95 } from './build537-nonbrowser-p95-core.mjs';
import { reviewSourceWarmVariance, WARM_BATCH_NAMES } from './build536-source-variance-core.mjs';

const LANES = ['Browser regression lane a', 'Browser regression lane b', 'Browser regression lane c'];
const unique = (items, name) => {
  const hits = items.filter((item) => item.name === name);
  return hits.length === 1 ? hits[0] : null;
};
const millis = (value) => {
  const result = Date.parse(value ?? '');
  return Number.isFinite(result) ? result : null;
};
const elapsed = (a, b) => {
  const x = millis(a), y = millis(b);
  return x !== null && y !== null && y >= x ? Math.round((y - x) / 1000) : null;
};

export function verifiedSchedulingObservation(entry) {
  if (entry?.sample?.status !== 'VERIFIED_GREEN' || !Array.isArray(entry?.jobs) ||
      !REQUIRED_GATES.every((name) => unique(entry.jobs, name)?.conclusion === 'success')) return null;
  const source = unique(entry.jobs, 'source-checks');
  const laneJobs = LANES.map((name) => unique(entry.jobs, name));
  const setup = unique(source?.steps ?? [], 'Run npm ci --no-audit --no-fund');
  const install = unique(source?.steps ?? [], 'Install Chromium for rendered module acceptance');
  if (!source || !setup || !install || setup.conclusion !== 'success' ||
      install.conclusion !== 'success' || laneJobs.some((job) => !job?.completed_at)) return null;
  const completedLanes = laneJobs.map((job) => millis(job.completed_at));
  const sourceStart = millis(source.started_at);
  const latestLane = Math.max(...completedLanes);
  const setupSeconds = elapsed(source.started_at, setup.completed_at);
  const chromiumSeconds = elapsed(install.started_at, install.completed_at);
  const handoffSeconds = sourceStart === null || completedLanes.some((value) => value === null) ||
      sourceStart < latestLane ? null : Math.round((sourceStart - latestLane) / 1000);
  const steps = (source.steps ?? []).filter((step) => step.conclusion === 'success'
    && millis(step.started_at) !== null && millis(step.completed_at) !== null)
    .sort((a, b) => a.number - b.number);
  if (setupSeconds === null || chromiumSeconds === null || handoffSeconds === null ||
      steps.length < 8 || steps.some((step, index) =>
        !Number.isSafeInteger(step.number) || millis(step.completed_at) < millis(step.started_at) ||
        (index > 0 && step.number <= steps[index - 1].number))) return null;
  // GitHub timestamps are second-granularity: count only strictly positive
  // between-step intervals. Never interpret them as CPU or network causation.
  let interStepGapSeconds = 0;
  for (let i = 1; i < steps.length; i++) {
    const gap = millis(steps[i].started_at) - millis(steps[i - 1].completed_at);
    if (gap > 0) interStepGapSeconds += Math.round(gap / 1000);
  }
  const warmSteps = WARM_BATCH_NAMES.map((name) => unique(steps, name));
  if (warmSteps.some((step) => !step)) return null;
  return {
    runId: entry.sample.runId, sha: entry.sample.headSha, setupSeconds,
    handoffSeconds, chromiumSeconds, interStepGapSeconds,
    sourceStepCount: steps.length, laneCompletionsVerified: LANES.length,
  };
}

export function reviewBuild538(current, detailedHistory, { exactCurrentMain = false } = {}) {
  if (!current || !Array.isArray(detailedHistory)) throw new Error('Original exact-main Actions history required.');
  const sourceReport = reviewNonBrowserP95(current, detailedHistory, { exactCurrentMain });
  const warmReport = reviewSourceWarmVariance(current, detailedHistory);
  const observations = detailedHistory.slice(0, 6).map(verifiedSchedulingObservation).filter(Boolean);
  const now = sourceReport.current && exactCurrentMain ? observations.find((entry) =>
    entry.runId === current.runId && entry.sha === current.headSha) ?? null : null;
  const prior = now ? observations.find((entry) => entry.sha !== current.headSha) ?? null : null;
  const comparable = Boolean(now && prior && sourceReport.comparison);
  const difference = (key) => comparable ? now[key] - prior[key] : null;
  const sourceDelta = sourceReport.comparison?.sourceDifferenceSeconds ?? null;
  const warmDelta = sourceReport.comparison?.warmBatchDifferenceSeconds ?? null;
  const residualDelta = sourceReport.comparison?.nonBrowserResidualDifferenceSeconds ?? null;
  const releaseDelta = sourceReport.comparison?.releaseDifferenceSeconds ?? null;
  const handoffDelta = difference('handoffSeconds');
  const setupDelta = difference('setupSeconds');
  const gapDelta = difference('interStepGapSeconds');
  const regressionLimits = { sourceSeconds: 20, releaseSeconds: 30,
    warmBatchesSeconds: 15, nonBrowserResidualSeconds: 10, sourceHandoffSeconds: 10 };
  const checks = [
    ['source-critical-path', sourceDelta, regressionLimits.sourceSeconds],
    ['whole-release', releaseDelta, regressionLimits.releaseSeconds],
    ['warm-batches', warmDelta, regressionLimits.warmBatchesSeconds],
    ['non-browser-residual', residualDelta, regressionLimits.nonBrowserResidualSeconds],
    ['source-runner-handoff', handoffDelta, regressionLimits.sourceHandoffSeconds],
  ];
  const regressions = comparable ? checks.filter(([, delta, limit]) => delta > limit)
    .map(([name, delta, limit]) => ({ name, observedRegressionSeconds: delta, budgetSeconds: limit })) : [];
  const warmBatchAttribution = warmReport.batchStats.map((item) => ({
    name: item.name, currentSeconds: item.currentSeconds, priorSeconds: item.priorSeconds,
    differenceSeconds: item.observedDifferenceSeconds, historicalP95Seconds: item.p95Seconds,
  }));
  return {
    schema: 'ywi.build538.runner-scheduling-warm-tail.v1',
    state: now ? 'EXACT_MAIN_GREEN_ORIGINAL_SCHEDULING_EVIDENCE' : 'HOLD_UNVERIFIED_SCHEDULING_EVIDENCE',
    comparisonState: comparable ? 'SAME_GATES_CROSS_SHA_OBSERVED' : 'HOLD_MISSING_COMPARABLE_RELEASE',
    guardrailState: !comparable ? 'HOLD_UNVERIFIABLE' : regressions.length ? 'OBSERVED_THROUGHPUT_REGRESSION' : 'NO_REGRESSION_OVER_THRESHOLDS',
    sourceP95Certification: sourceReport.certification,
    currentRunId: current.runId, priorRunId: prior?.runId ?? null,
    validSchedulingSamples: observations.length, current: now, prior,
    differences: { sourceSeconds: sourceDelta, releaseSeconds: releaseDelta,
      warmBatchesSeconds: warmDelta, nonBrowserResidualSeconds: residualDelta,
      setupSeconds: setupDelta, sourceHandoffSeconds: handoffDelta, interStepGapSeconds: gapDelta },
    dominantMeasuredRegression: !comparable ? 'HOLD_UNCOMPARABLE'
      : warmDelta > 0 && warmDelta >= residualDelta ? 'WARM_BROWSER_BATCHES'
      : residualDelta > 0 ? 'NON_BROWSER_RESIDUAL' : 'NO_POSITIVE_SOURCE_SEGMENT_DOMINATES',
    regressionLimits, regressions, warmBatchAttribution,
    p95: { sourceSeconds: sourceReport.trend.sourceP95Seconds,
      warmBatchesSeconds: sourceReport.trend.warmBatchP95Seconds,
      nonBrowserResidualSeconds: sourceReport.trend.nonBrowserResidualP95Seconds,
      releaseSeconds: sourceReport.trend.releaseP95Seconds },
    safeguards: { requiredGates: REQUIRED_GATES, exactCurrentMain: true,
      releaseAuthority: false, causalRootCauseProven: false, automaticRetries: false,
      gateWaivers: false, productionMutation: false },
    caution: 'Handoff, setup and between-step gaps are original Actions scheduling observations. They overlap source residual categories and do not independently establish runner or network causation; guardrails report exceptions only.',
  };
}
