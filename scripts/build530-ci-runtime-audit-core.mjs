/** Build 530: pure, source-verifiable CI timing and release-gate reconciliation. */

export const REQUIRED_GATES = Object.freeze([
  'Browser regression lane a',
  'Browser regression lane b',
  'Browser regression lane c',
  'source-checks',
  'repository-enforcement',
  'release-source-evidence',
  'release-truth-summary',
]);

export const LIMITS = Object.freeze({
  queueSeconds: 120,
  runSeconds: 900,
});

const timestamp = (value) => {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : null;
};

const secondsBetween = (from, until) => {
  const a = timestamp(from);
  const b = timestamp(until);
  return a === null || b === null || b < a ? null : Math.round((b - a) / 1000);
};

export function summarizeRun(run, jobs, { expectedSha = null } = {}) {
  if (!run || !Number.isSafeInteger(Number(run.id)) || !Array.isArray(jobs)) {
    throw new Error('A real workflow run and its complete job list are required.');
  }
  const normalized = jobs.map((job) => ({
    name: String(job.name ?? ''),
    status: String(job.status ?? 'unknown'),
    conclusion: job.conclusion ?? null,
    queueSeconds: secondsBetween(job.created_at, job.started_at),
    executionSeconds: secondsBetween(job.started_at, job.completed_at),
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
  }));
  const gates = REQUIRED_GATES.map((name) => {
    const matches = normalized.filter((job) => job.name === name);
    return { name, state: matches.length === 1 ? matches[0].conclusion ?? 'INCOMPLETE' : 'MISSING_OR_DUPLICATE' };
  });
  const failed = gates.filter((gate) => gate.state !== 'success').map((gate) => gate.name);
  const headSha = String(run.head_sha ?? '');
  const exactSha = /^[a-f0-9]{40}$/.test(headSha) && (!expectedSha || expectedSha === headSha);
  const mainPush = run.event === 'push' && run.head_branch === 'main';
  const trustedRepository = run.head_repository?.full_name === 'RosevearCreations/yw';
  const runSeconds = secondsBetween(run.created_at, run.updated_at);
  const queueSeconds = secondsBetween(run.created_at, run.run_started_at);
  const lanes = normalized.filter((job) => /^Browser regression lane [abc]$/.test(job.name));
  const laneStarts = lanes.map((job) => timestamp(job.startedAt));
  const laneEnds = lanes.map((job) => timestamp(job.completedAt));
  const overlapSeconds = lanes.length === 3 && laneStarts.every((ms) => ms !== null) && laneEnds.every((ms) => ms !== null)
    ? Math.max(0, Math.round((Math.min(...laneEnds) - Math.max(...laneStarts)) / 1000))
    : null;
  const complete = run.status === 'completed';
  const verified = complete && run.conclusion === 'success' && failed.length === 0 && exactSha && mainPush && trustedRepository;
  return {
    schema: 'ywi.build530.ci-runtime-audit.v1',
    runId: Number(run.id),
    attempt: Number(run.run_attempt ?? 1),
    headSha,
    status: verified ? 'VERIFIED_GREEN' : 'HOLD_NOT_VERIFIED',
    runConclusion: run.conclusion ?? null,
    runSeconds,
    queueSeconds,
    laneOverlapSeconds: overlapSeconds,
    gates,
    failedOrMissingGates: failed,
    budget: {
      ...LIMITS,
      queueExceeded: queueSeconds === null ? null : queueSeconds > LIMITS.queueSeconds,
      runExceeded: runSeconds === null ? null : runSeconds > LIMITS.runSeconds,
    },
    diagnostics: {
      complete,
      exactSha,
      mainPush,
      trustedRepository,
      lanesOverlapped: overlapSeconds !== null && overlapSeconds > 0,
    },
    jobs: normalized.map(({ name, status, conclusion, queueSeconds, executionSeconds }) => ({ name, status, conclusion, queueSeconds, executionSeconds })),
  };
}

export function summarizeTrend(samples) {
  const valid = samples.filter((sample) => sample.runSeconds !== null && sample.queueSeconds !== null);
  const sorted = (key) => valid.map((sample) => sample[key]).sort((a, b) => a - b);
  const median = (numbers) => numbers.length ? numbers[Math.floor((numbers.length - 1) / 2)] : null;
  const percentile95 = (numbers) => numbers.length ? numbers[Math.ceil(numbers.length * 0.95) - 1] : null;
  return {
    sampleCount: valid.length,
    medianRunSeconds: median(sorted('runSeconds')),
    p95RunSeconds: percentile95(sorted('runSeconds')),
    medianQueueSeconds: median(sorted('queueSeconds')),
    p95QueueSeconds: percentile95(sorted('queueSeconds')),
    observedRunIds: valid.map((sample) => sample.runId),
    // A trend never authorizes production release; every sample keeps its own gate status.
    verifiedCount: valid.filter((sample) => sample.status === 'VERIFIED_GREEN').length,
  };
}
