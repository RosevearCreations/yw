/** Build 532: source-bound critical-path timing, historical gate triage and honest SLA comparisons. */
import { REQUIRED_GATES } from './build530-ci-runtime-audit-core.mjs';

const LANES = REQUIRED_GATES.filter((name) => name.startsWith('Browser regression lane '));
const MAIN_STAGES = ['source-checks', 'release-source-evidence', 'release-truth-summary'];
const dateMs = (date) => {
  const ms = Date.parse(date ?? '');
  return Number.isFinite(ms) ? ms : null;
};
const elapsedSeconds = (start, end) => {
  const a = dateMs(start), b = dateMs(end);
  return a === null || b === null || b < a ? null : Math.round((b - a) / 1000);
};
const one = (jobs, name) => {
  const hits = jobs.filter((job) => job.name === name);
  return hits.length === 1 ? hits[0] : null;
};

function stage(job) {
  return {
    name: job.name,
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    elapsedSeconds: elapsedSeconds(job.started_at, job.completed_at),
    conclusion: job.conclusion ?? null,
  };
}

export function analyzeCriticalPath(current, rawJobs) {
  if (!current || !Array.isArray(rawJobs)) throw new Error('Audited source run and complete raw jobs are required.');
  const gates = REQUIRED_GATES.map((name) => one(rawJobs, name));
  const complete = gates.every((job) => job && job.conclusion === 'success' && elapsedSeconds(job.started_at, job.completed_at) !== null);
  if (!complete || current.status !== 'VERIFIED_GREEN') {
    return {
      state: 'HOLD_INCOMPLETE_OR_UNVERIFIED_TIMING',
      measuredSourceRunId: current.runId,
      missingOrUnverifiedJobs: REQUIRED_GATES.filter((_, i) => !gates[i] || gates[i].conclusion !== 'success' || elapsedSeconds(gates[i].started_at, gates[i].completed_at) === null),
      criticalPathCandidate: null,
      sourceStepDetails: [],
    };
  }
  const laneJobs = LANES.map((name) => one(rawJobs, name));
  const latestLane = [...laneJobs].sort((a, b) => dateMs(b.completed_at) - dateMs(a.completed_at))[0];
  const earliestLaneStart = [...laneJobs].sort((a, b) => dateMs(a.started_at) - dateMs(b.started_at))[0];
  const sourceJob = one(rawJobs, 'source-checks');
  const evidenceJob = one(rawJobs, 'release-source-evidence');
  const truthJob = one(rawJobs, 'release-truth-summary');
  const repoJob = one(rawJobs, 'repository-enforcement');
  const handoffs = [
    { from: latestLane.name, to: sourceJob.name, seconds: elapsedSeconds(latestLane.completed_at, sourceJob.started_at) },
    { from: sourceJob.name, to: evidenceJob.name, seconds: elapsedSeconds(sourceJob.completed_at, evidenceJob.started_at) },
    { from: evidenceJob.name, to: truthJob.name, seconds: elapsedSeconds(evidenceJob.completed_at, truthJob.started_at) },
  ];
  const sourceSteps = Array.isArray(sourceJob.steps) ? sourceJob.steps : [];
  const timed = sourceSteps.map((step) => ({
    name: String(step.name ?? ''), number: Number(step.number ?? 0), conclusion: step.conclusion ?? null,
    elapsedSeconds: elapsedSeconds(step.started_at, step.completed_at),
  })).filter((step) => step.elapsedSeconds !== null && step.conclusion === 'success');
  const topSteps = timed.sort((a, b) => b.elapsedSeconds - a.elapsedSeconds || a.number - b.number).slice(0, 10);
  const completeStepTimes = sourceSteps.length > 0 && sourceSteps.every((step) =>
    step.conclusion !== 'success' || elapsedSeconds(step.started_at, step.completed_at) !== null);
  const branchCandidates = [
    { name: 'parallel-browser-window', seconds: elapsedSeconds(earliestLaneStart.started_at, latestLane.completed_at) },
    ...MAIN_STAGES.map((name) => ({ name, seconds: elapsedSeconds(one(rawJobs, name).started_at, one(rawJobs, name).completed_at) })),
  ];
  const sourceTime = branchCandidates.find((item) => item.name === 'source-checks').seconds;
  const parallelTime = branchCandidates[0].seconds;
  const sourceLast = dateMs(sourceJob.started_at) >= dateMs(latestLane.completed_at);
  const evidenceLast = dateMs(evidenceJob.started_at) >= dateMs(sourceJob.completed_at);
  const truthLast = dateMs(truthJob.started_at) >= Math.max(dateMs(evidenceJob.completed_at), dateMs(repoJob.completed_at));
  return {
    state: sourceLast && evidenceLast && truthLast && handoffs.every((item) => item.seconds !== null)
      ? 'MEASURED_DEPENDENCY_PATH' : 'REVIEW_NONMONOTONIC_JOB_TIMESTAMPS',
    measuredSourceRunId: current.runId,
    criticalPathCandidate: [latestLane.name, ...MAIN_STAGES],
    parallelWindowSeconds: parallelTime,
    sourceSuiteSeconds: sourceTime,
    controllingLane: latestLane.name,
    largestMeasuredStage: [...branchCandidates].sort((a, b) => b.seconds - a.seconds)[0],
    stages: branchCandidates,
    handoffs,
    independentRepositoryGate: stage(repoJob),
    sourceStepsTimed: timed.length,
    sourceStepsTotal: sourceSteps.length,
    sourceStepDetails: topSteps,
    sourceStepsComplete: completeStepTimes,
    caution: 'Job timestamps show observed elapsed time and dependencies; they do not alone prove a change caused a speedup.',
  };
}

function categorizeGate(state) {
  if (state === 'failure' || state === 'timed_out') return 'OBSERVED_FAILED_GATE';
  if (state === 'cancelled') return 'OBSERVED_CANCELLED_GATE';
  if (state === 'skipped') return 'SKIPPED_DEPENDENT_GATE_NOT_ROOT_CAUSE';
  return 'MISSING_DUPLICATE_OR_INCOMPLETE_GATE';
}

export function triageHistoricalRuns(history, currentRunId) {
  if (!Array.isArray(history)) throw new Error('Bounded original workflow history is required.');
  return history.filter((sample) => sample.runId !== currentRunId && sample.status !== 'VERIFIED_GREEN').map((sample) => {
    const problems = (sample.gates ?? []).filter((gate) => gate.state !== 'success').map((gate) => ({
      name: gate.name, observedState: gate.state, category: categorizeGate(gate.state),
    }));
    return {
      runId: sample.runId, headSha: sample.headSha, runConclusion: sample.runConclusion,
      evidenceState: 'HISTORICAL_HOLD_NOT_CURRENT_MAIN',
      gateProblems: problems,
      primaryObservedFailures: problems.filter((gate) => gate.category === 'OBSERVED_FAILED_GATE' || gate.category === 'OBSERVED_CANCELLED_GATE'),
      ownerAction: 'REVIEW_ORIGINAL_RUN_AND_JOB_LOGS_NO_AUTOMATIC_RETRY',
    };
  });
}

export function verifySlaComparison(current, history) {
  if (!current || !Array.isArray(history)) throw new Error('Current run and bounded history are required.');
  const comparable = history.filter((sample) => sample.runId !== current.runId && sample.status === 'VERIFIED_GREEN' &&
    Number.isSafeInteger(sample.runSeconds) && Number.isSafeInteger(sample.queueSeconds) &&
    sample.headSha !== current.headSha && REQUIRED_GATES.every((name) =>
      (sample.gates ?? []).filter((gate) => gate.name === name && gate.state === 'success').length === 1));
  const previous = comparable[0] ?? null;
  const eligible = current.status === 'VERIFIED_GREEN' && Number.isSafeInteger(current.runSeconds) && previous !== null;
  const difference = eligible ? current.runSeconds - previous.runSeconds : null;
  return {
    state: eligible ? 'DESCRIPTIVE_SAME_GATE_COMPARISON' : 'NO_COMPARABLE_VERIFIED_BASELINE',
    currentRunId: current.runId,
    previousVerifiedRunId: previous?.runId ?? null,
    currentRunSeconds: Number.isSafeInteger(current.runSeconds) ? current.runSeconds : null,
    previousRunSeconds: previous?.runSeconds ?? null,
    secondsDifference: difference,
    percentDifference: eligible && previous.runSeconds > 0 ? Math.round((difference / previous.runSeconds) * 1000) / 10 : null,
    independentlyProvenCausalSavings: false,
    limitation: 'A previous successful run with the same required gates supports observed timing comparison only; no certified pre-consolidation control baseline or causal proof.',
  };
}

export function reviewBuild532(current, rawJobs, history) {
  return {
    schema: 'ywi.build532.ci-critical-path-history-sla.v1',
    currentRunId: current?.runId ?? null,
    criticalPath: analyzeCriticalPath(current, rawJobs),
    historicalGateExceptions: triageHistoricalRuns(history, current.runId),
    slaComparison: verifySlaComparison(current, history),
    safeguards: {
      releaseAuthority: false, historicalSuccessSubstitution: false,
      automaticRetry: false, gateWaiver: false, deploymentMutation: false,
      originalRequiredGateNames: REQUIRED_GATES,
    },
  };
}
