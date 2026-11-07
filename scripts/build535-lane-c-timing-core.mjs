/** Build 535: evidence-only runner preparation, lane C execution and release SLA review.
 * All observations must come from completed exact-main GREEN workflow history.
 */
import { REQUIRED_GATES, LIMITS } from './build530-ci-runtime-audit-core.mjs';

const NAME = 'Browser regression lane c';
const PREP_STEPS = Object.freeze([
  'Run actions/checkout@v7',
  'Run actions/setup-node@v7',
  'Run npm ci --no-audit --no-fund',
  'Install pinned Chromium for isolated lane',
]);
const EXECUTION_STEP = 'Run assigned browser regression lane';
const unique = (list, name) => {
  const matches = list.filter((item) => item.name === name);
  return matches.length === 1 ? matches[0] : null;
};
const duration = (from, to) => {
  const a = Date.parse(from ?? ''), b = Date.parse(to ?? '');
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 1000) : null;
};
const quantile = (values, fraction) => values.length
  ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : null;

function originalObservation(entry) {
  const { sample, jobs } = entry ?? {};
  if (sample?.status !== 'VERIFIED_GREEN' || !Array.isArray(jobs)
    || !REQUIRED_GATES.every((name) => unique(jobs, name)?.conclusion === 'success')) return null;
  const job = unique(jobs, NAME);
  const steps = Array.isArray(job?.steps) ? job.steps : [];
  const prep = PREP_STEPS.map((name) => {
    const step = unique(steps, name);
    return step?.conclusion === 'success' ? duration(step.started_at, step.completed_at) : null;
  });
  const runStep = unique(steps, EXECUTION_STEP);
  const executionSeconds = runStep?.conclusion === 'success'
    ? duration(runStep.started_at, runStep.completed_at) : null;
  const queueSeconds = duration(job?.created_at, job?.started_at);
  if (prep.some((value) => value === null) || executionSeconds === null
    || queueSeconds === null || !Number.isSafeInteger(sample.runSeconds)) return null;
  return {
    runId: sample.runId, sha: sample.headSha, releaseSeconds: sample.runSeconds,
    queueSeconds, executionSeconds, preparationSeconds: prep.reduce((sum, value) => sum + value, 0),
    preparationSteps: PREP_STEPS.map((name, index) => ({ name, seconds: prep[index] })),
  };
}

export function reviewLaneCRelease(current, history) {
  if (!current || !Array.isArray(history)) throw new Error('Exact main release and original bounded history required.');
  const observations = history.map(originalObservation).filter(Boolean);
  const observed = current.status === 'VERIFIED_GREEN'
    ? observations.find((entry) => entry.runId === current.runId && entry.sha === current.headSha) : null;
  const previous = observations.find((entry) => entry.runId !== current.runId && entry.sha !== current.headSha) ?? null;
  const comparable = Boolean(observed && previous);
  const laneExecutionSeconds = observations.map((entry) => entry.executionSeconds);
  const runnerPreparationSeconds = observations.map((entry) => entry.preparationSeconds);
  const laneQueueSeconds = observations.map((entry) => entry.queueSeconds);
  const p95 = quantile(laneExecutionSeconds, 0.95), median = quantile(laneExecutionSeconds, 0.5);
  return {
    schema: 'ywi.build535.lane-c-release-sla.v1',
    state: observed ? 'EXACT_MAIN_GREEN_LANE_C_OBSERVED' : 'HOLD_UNVERIFIED_OR_INCOMPLETE_LANE_C',
    comparisonState: comparable ? 'OBSERVED_CROSS_RELEASE_CHANGE' : 'HOLD_NO_COMPARABLE_LANE_C',
    currentRunId: current.runId, priorVerifiedRunId: previous?.runId ?? null,
    verifiedSampleCount: observations.length,
    multiReleaseTrend: observations.length >= 3 ? 'BOUNDED_VERIFIED_HISTORY' : 'INSUFFICIENT_VERIFIED_HISTORY',
    suiteCount: 55, plannedOldLaunches: 55, plannedNewLaunches: 5,
    current: observed ?? null, prior: previous ?? null,
    observedExecutionDifferenceSeconds: comparable ? observed.executionSeconds - previous.executionSeconds : null,
    observedPreparationDifferenceSeconds: comparable ? observed.preparationSeconds - previous.preparationSeconds : null,
    observedReleaseDifferenceSeconds: comparable ? observed.releaseSeconds - previous.releaseSeconds : null,
    sla: {
      laneExecutionBudgetSeconds: 360,
      laneQueueBudgetSeconds: LIMITS.queueSeconds,
      releaseBudgetSeconds: LIMITS.runSeconds,
      result: !observed ? 'HOLD_UNVERIFIED'
        : observed.executionSeconds <= 360 && observed.queueSeconds <= LIMITS.queueSeconds
          && observed.releaseSeconds <= LIMITS.runSeconds ? 'MEETS_OBSERVATIONAL_SLA_BUDGET' : 'OBSERVED_SLA_EXCEPTION',
    },
    trends: {
      laneExecutionMedianSeconds: median, laneExecutionP95Seconds: p95,
      runnerPreparationMedianSeconds: quantile(runnerPreparationSeconds, 0.5),
      runnerPreparationP95Seconds: quantile(runnerPreparationSeconds, 0.95),
      queueMedianSeconds: quantile(laneQueueSeconds, 0.5),
      queueP95Seconds: quantile(laneQueueSeconds, 0.95),
      observedLaneSpreadSeconds: median === null || p95 === null ? null : p95 - median,
    },
    safeguards: { independentCausalSavingsProof: false, releaseAuthority: false,
      overrideFailedGate: false, automaticRetry: false, modifyEnvironment: false,
      originalSuiteCoverageRequired: true, requireExactMain: true, requiredGates: REQUIRED_GATES },
    caution: 'Runner-start, Playwright launch, and suite workload variances are observational. An SLA exception never waives a protected gate.',
  };
}
