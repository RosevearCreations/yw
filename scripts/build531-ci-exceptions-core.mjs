/** Build 531: read-only SLA exceptions and fail-closed recovery evidence. */
import { LIMITS, REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';

export const LANE_BUDGET_SECONDS = 600;
export const TREND_MIN_SAMPLES = 4;
const LANES = REQUIRED_GATES.filter((name) => name.startsWith('Browser regression lane '));

function exception(code, severity, details, sourceRunId) {
  return { code, severity, sourceRunId, details };
}

/**
 * Budget overruns demand review, never approval or a relaxed release check.
 * Missing, failed or conflicting evidence always makes the recovery decision HOLD.
 */
export function reviewCiEvidence(current, history, { exactCurrentMain = false } = {}) {
  if (!current || !Array.isArray(current.gates) || !Array.isArray(current.jobs) || !Array.isArray(history)) {
    throw new Error('A complete audited current run and bounded history are required.');
  }
  const exceptions = [];
  const id = current.runId;
  const gateProblems = REQUIRED_GATES.filter((name) => {
    const matches = current.gates.filter((gate) => gate.name === name);
    return matches.length !== 1 || matches[0].state !== 'success';
  });
  for (const name of gateProblems) exceptions.push(exception('REQUIRED_GATE_NOT_GREEN', 'HOLD', name, id));
  if (!exactCurrentMain || current.status !== 'VERIFIED_GREEN') {
    exceptions.push(exception('SOURCE_NOT_EXACT_GREEN_MAIN', 'HOLD', 'Missing, failed, stale or superseded exact-main evidence', id));
  }

  const lanes = LANES.map((name) => {
    const matches = current.jobs.filter((job) => job.name === name);
    const executionSeconds = matches.length === 1 ? matches[0].executionSeconds : null;
    const validTiming = Number.isSafeInteger(executionSeconds) && executionSeconds >= 0;
    const exceeded = validTiming ? executionSeconds > LANE_BUDGET_SECONDS : null;
    if (!validTiming) exceptions.push(exception('LANE_TIMING_UNAVAILABLE', 'HOLD', name, id));
    else if (exceeded) exceptions.push(exception('LANE_RUNTIME_OVER_BUDGET', 'REVIEW', `${name}: ${executionSeconds}s / ${LANE_BUDGET_SECONDS}s`, id));
    return {
      name, executionSeconds: validTiming ? executionSeconds : null,
      budgetSeconds: LANE_BUDGET_SECONDS,
      exceeded,
      overageSeconds: exceeded ? executionSeconds - LANE_BUDGET_SECONDS : 0,
    };
  });

  for (const [code, measured, budget] of [
    ['QUEUE_SLA_EXCEEDED', current.queueSeconds, LIMITS.queueSeconds],
    ['RUN_SLA_EXCEEDED', current.runSeconds, LIMITS.runSeconds],
  ]) {
    if (!Number.isSafeInteger(measured) || measured < 0) {
      exceptions.push(exception('SLA_TIMING_UNAVAILABLE', 'REVIEW', code, id));
    } else if (measured > budget) {
      exceptions.push(exception(code, 'REVIEW', `${measured}s / ${budget}s`, id));
    }
  }

  const sampleRuns = history.slice(0, 6).map((sample) => ({
    runId: sample.runId,
    headSha: sample.headSha,
    gateState: sample.status,
    queueSeconds: sample.queueSeconds,
    runSeconds: sample.runSeconds,
    queueExceeded: Number.isSafeInteger(sample.queueSeconds) && sample.queueSeconds > LIMITS.queueSeconds,
    runExceeded: Number.isSafeInteger(sample.runSeconds) && sample.runSeconds > LIMITS.runSeconds,
    requiredGateFailures: sample.failedOrMissingGates ?? [],
  }));
  const trustedSamples = sampleRuns.filter((sample) =>
    Number.isSafeInteger(sample.runId) && /^[0-9a-f]{40}$/.test(sample.headSha ?? '') &&
    Number.isSafeInteger(sample.queueSeconds) && Number.isSafeInteger(sample.runSeconds));
  const trend = {
    sampleCount: trustedSamples.length,
    minimumSamples: TREND_MIN_SAMPLES,
    sufficientHistory: trustedSamples.length >= TREND_MIN_SAMPLES,
    queueSlaBreaches: trustedSamples.filter((sample) => sample.queueExceeded).length,
    runSlaBreaches: trustedSamples.filter((sample) => sample.runExceeded).length,
    gateHolds: trustedSamples.filter((sample) => sample.gateState !== 'VERIFIED_GREEN').length,
    samples: sampleRuns,
  };
  if (!trend.sufficientHistory) exceptions.push(exception('TREND_HISTORY_INSUFFICIENT', 'REVIEW', `${trustedSamples.length}/${TREND_MIN_SAMPLES} timed samples`, id));
  for (const sample of trustedSamples) {
    if (sample.gateState !== 'VERIFIED_GREEN') {
      exceptions.push(exception('HISTORICAL_REQUIRED_GATE_HOLD', 'REVIEW', `Investigate failed run ${sample.runId}`, sample.runId));
    }
  }

  const hold = exceptions.some((item) => item.severity === 'HOLD');
  return {
    schema: 'ywi.build531.ci-sla-recovery-review.v1',
    currentRunId: id,
    exactCurrentMain,
    releaseEvidenceState: hold ? 'HOLD_NOT_VERIFIED' : 'VERIFIED_GREEN_EVIDENCE_ONLY',
    recoveryDecision: hold ? 'STOP_AND_INDEPENDENTLY_REVIEW_NO_AUTO_RETRY' :
      exceptions.length ? 'REVIEW_PERFORMANCE_EXCEPTIONS_NO_GATE_WAIVER' : 'OBSERVE_ONLY_NO_RELEASE_AUTHORITY',
    laneBudgets: lanes,
    trend,
    exceptions,
    safeguards: {
      automatedRetry: false,
      gateWaiver: false,
      workflowDispatch: false,
      productionMutation: false,
      requiredGatesUnchanged: REQUIRED_GATES,
    },
  };
}
