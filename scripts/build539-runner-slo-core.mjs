/** Build 539 — bounded original-main Actions runner-handoff SLOs and
 * source-step drift alerts. Diagnostic only; never grants release authority.
 */
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';
import { verifiedSourceObservation } from './build536-source-variance-core.mjs';
import { verifiedSchedulingObservation } from './build538-runner-scheduling-core.mjs';

const p95 = (numbers) => numbers.length
  ? [...numbers].sort((a, b) => a - b)[Math.ceil(numbers.length * 0.95) - 1] : null;
const SLO = Object.freeze({
  runnerHandoffCurrentSeconds: 15,
  runnerHandoffP95Seconds: 20,
  runnerSetupP95Seconds: 30,
  stepGapCurrentSeconds: 12,
  stepGapP95Seconds: 15,
  stepGapIncreaseSeconds: 5,
  sourceP95Seconds: 240,
  releaseP95Seconds: 900,
  sourceCohortDriftSeconds: 30,
  warmCohortDriftSeconds: 20,
  releaseCohortDriftSeconds: 60,
});

function observe(entry) {
  const scheduling = verifiedSchedulingObservation(entry);
  const source = verifiedSourceObservation(entry);
  if (!scheduling || !source || scheduling.runId !== source.runId ||
      scheduling.sha !== source.sha) return null;
  return { ...scheduling, sourceSeconds: source.sourceSeconds,
    warmSeconds: source.batchSeconds, releaseSeconds: source.releaseSeconds };
}

export function reviewBuild539(current, detailedHistory, { exactCurrentMain = false } = {}) {
  if (!current || !Array.isArray(detailedHistory)) {
    throw new Error('Original exact-main Actions run and bounded detailed history required.');
  }
  const seen = new Set();
  const samples = detailedHistory.slice(0, 6).map(observe).filter((item) => {
    if (!item || seen.has(item.sha) || seen.has(`run:${item.runId}`)) return false;
    seen.add(item.sha);
    seen.add(`run:${item.runId}`);
    return true;
  });
  const now = exactCurrentMain && current.status === 'VERIFIED_GREEN'
    ? samples.find((item) => item.runId === current.runId && item.sha === current.headSha) ?? null : null;
  const previous = now ? samples.find((item) => item.sha !== now.sha) ?? null : null;
  const complete = Boolean(now && previous && samples.length === 6);
  const metrics = [
    ['runnerHandoffSeconds', 'handoffSeconds'], ['runnerSetupSeconds', 'setupSeconds'],
    ['sourceStepGapSeconds', 'interStepGapSeconds'], ['sourceSeconds', 'sourceSeconds'],
    ['warmSeconds', 'warmSeconds'], ['releaseSeconds', 'releaseSeconds'],
  ];
  const historicalP95 = Object.fromEntries(metrics.map(([name, field]) =>
    [name, p95(samples.map((item) => item[field]))]));
  // Newest three compared with the preceding three, all distinct verified
  // original-main SHAs. This is observed drift, not a causal attribution.
  const cohorts = complete ? {
    newestRunIds: samples.slice(0, 3).map((item) => item.runId),
    olderRunIds: samples.slice(3, 6).map((item) => item.runId),
    metrics: Object.fromEntries(['sourceSeconds', 'warmSeconds', 'releaseSeconds'].map((field) => {
      const newestP95Seconds = p95(samples.slice(0, 3).map((item) => item[field]));
      const olderP95Seconds = p95(samples.slice(3, 6).map((item) => item[field]));
      return [field, { newestP95Seconds, olderP95Seconds,
        increaseSeconds: newestP95Seconds - olderP95Seconds }];
    })),
  } : null;
  const alerts = [];
  const add = (code, observedSeconds, limitSeconds) => {
    if (Number.isFinite(observedSeconds) && observedSeconds > limitSeconds) {
      alerts.push({ code, observedSeconds, limitSeconds, overSeconds: observedSeconds - limitSeconds });
    }
  };
  if (complete) {
    add('SOURCE_RUNNER_HANDOFF_SLO', now.handoffSeconds, SLO.runnerHandoffCurrentSeconds);
    add('SOURCE_RUNNER_HANDOFF_P95', historicalP95.runnerHandoffSeconds, SLO.runnerHandoffP95Seconds);
    add('SOURCE_RUNNER_SETUP_P95', historicalP95.runnerSetupSeconds, SLO.runnerSetupP95Seconds);
    add('SOURCE_STEP_GAP_SLO', now.interStepGapSeconds, SLO.stepGapCurrentSeconds);
    add('SOURCE_STEP_GAP_P95', historicalP95.sourceStepGapSeconds, SLO.stepGapP95Seconds);
    add('SOURCE_STEP_GAP_DRIFT', now.interStepGapSeconds - previous.interStepGapSeconds,
      SLO.stepGapIncreaseSeconds);
    add('SOURCE_CHECKS_P95', historicalP95.sourceSeconds, SLO.sourceP95Seconds);
    add('PROTECTED_RELEASE_P95', historicalP95.releaseSeconds, SLO.releaseP95Seconds);
    add('SOURCE_COHORT_P95_DRIFT', cohorts.metrics.sourceSeconds.increaseSeconds,
      SLO.sourceCohortDriftSeconds);
    add('WARM_COHORT_P95_DRIFT', cohorts.metrics.warmSeconds.increaseSeconds,
      SLO.warmCohortDriftSeconds);
    add('RELEASE_COHORT_P95_DRIFT', cohorts.metrics.releaseSeconds.increaseSeconds,
      SLO.releaseCohortDriftSeconds);
  }
  return {
    schema: 'ywi.build539.runner-handoff-slo-step-gap-drift.v1',
    state: now ? 'EXACT_MAIN_VERIFIED_ORIGINAL_ACTIONS_SCHEDULING' : 'HOLD_UNVERIFIED_EXACT_MAIN',
    trendState: !now ? 'HOLD_UNVERIFIED_EXACT_MAIN'
      : !complete ? 'HOLD_INSUFFICIENT_DISTINCT_VERIFIED_RELEASES' : 'SIX_RELEASE_VERIFIED_TREND',
    sloState: !complete ? 'HOLD_UNVERIFIABLE_SLO'
      : alerts.length ? 'REVIEW_OBSERVED_SLO_DRIFT' : 'MEETS_OBSERVATIONAL_SLO_BUDGET',
    currentRunId: current.runId, comparedRunId: previous?.runId ?? null,
    verifiedDistinctSamples: samples.length, originalMainRunIds: samples.map((item) => item.runId),
    current: now, previous, historicalP95, cohorts, sloLimits: SLO, alerts,
    safeguards: { requiredGates: REQUIRED_GATES, requireExactCurrentMain: true,
      changesProtectedJobs: false, removesBrowserSuites: false, releaseAuthority: false,
      automaticRetry: false, gateWaiver: false, productionMutation: false,
      causalRootCauseProven: false },
    caution: 'Actions second-granularity setup, handoff and between-step gaps overlap other source timings. SLO and three-versus-three cohort drift are observational warnings only; no automatic retry, withheld gate or release approval is implied.',
  };
}
