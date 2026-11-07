#!/usr/bin/env node
/** Read-only post-promotion CI audit. Never merges, approves, retries or changes a gate. */
import { writeFile, appendFile } from 'node:fs/promises';
import { summarizeRun, summarizeTrend } from './build530-ci-runtime-audit-core.mjs';
import { reviewCiEvidence } from './build531-ci-exceptions-core.mjs';
import { reviewBuild532 } from './build532-ci-critical-path-core.mjs';
import { reviewBuild533 } from './build533-runner-variance-core.mjs';
import { verifyCrossReleaseThroughput } from './build534-throughput-core.mjs';

const repository = 'RosevearCreations/yw';
const sourceRunId = String(process.env.YWI_SOURCE_RUN_ID ?? '');
const sourceSha = String(process.env.YWI_SOURCE_RUN_SHA ?? '');
const token = process.env.GH_TOKEN;
const reportPath = process.env.YWI_CI_AUDIT_REPORT_PATH || 'ci-runtime-audit.json';

if (!/^\d{6,15}$/.test(sourceRunId) || !/^[a-f0-9]{40}$/.test(sourceSha) || !token) {
  throw new Error('Exact workflow run ID, SHA and scoped Actions read token are required.');
}

async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ywi-build530-read-only-ci-audit',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub read-only API ${response.status} for ${path.split('?')[0]}`);
  return response.json();
}

async function jobsFor(runId) {
  const items = [];
  for (let page = 1; page <= 4; page++) {
    const response = await github(`actions/runs/${runId}/jobs?per_page=100&page=${page}`);
    items.push(...(response.jobs ?? []));
    if ((response.jobs ?? []).length < 100) return items;
  }
  throw new Error('CI jobs pagination exceeded bounded four-page audit limit.');
}

const run = await github(`actions/runs/${sourceRunId}`);
const main = await github('branches/main');
const currentMainSha = main.commit?.sha ?? null;
const exactCurrentMain = currentMainSha === sourceSha;
const currentRawJobs = await jobsFor(sourceRunId);
const current = summarizeRun(run, currentRawJobs, { expectedSha: sourceSha });
const recent = await github('actions/workflows/staging-browser-integration.yml/runs?branch=main&event=push&status=completed&per_page=6');
const history = [];
const detailedHistory = [];
for (const entry of (recent.workflow_runs ?? []).slice(0, 6)) {
  const jobs = Number(entry.id) === Number(sourceRunId) ? currentRawJobs : await jobsFor(entry.id);
  const sample = summarizeRun(entry, jobs);
  history.push(sample);
  detailedHistory.push({ sample, jobs });
}
const report = {
  schema: 'ywi.build530.ci-runtime-report.v1',
  observedAt: new Date().toISOString(),
  sourceRunId: Number(sourceRunId),
  currentMainSha,
  exactCurrentMain,
  current,
  trend: summarizeTrend(history),
  build531: reviewCiEvidence(current, history, { exactCurrentMain }),
  build532: reviewBuild532(current, currentRawJobs, history),
  build533: reviewBuild533(current, detailedHistory),
  build534: verifyCrossReleaseThroughput(current, detailedHistory),
  history: history.map(({ runId, headSha, status, runConclusion, runSeconds, queueSeconds, laneOverlapSeconds, budget, failedOrMissingGates }) =>
    ({ runId, headSha, status, runConclusion, runSeconds, queueSeconds, laneOverlapSeconds, budget, failedOrMissingGates })),
  ownerAction: exactCurrentMain && current.status === 'VERIFIED_GREEN'
    ? 'OBSERVE_ONLY_NO_RELEASE_AUTHORITY'
    : 'REVIEW_FAILED_OR_SUPERSEDED_SOURCE_NO_AUTOMATIC_RETRY',
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const summary = [
  '### Build 530 — Read-only CI runtime audit',
  `- Source run: ${report.sourceRunId}`,
  `- Exact current main: ${exactCurrentMain ? 'yes' : 'no (superseded)'}`,
  `- Gate state: ${current.status}`,
  `- Run / queue seconds: ${current.runSeconds ?? 'unknown'} / ${current.queueSeconds ?? 'unknown'}`,
  `- Three-lane overlap seconds: ${current.laneOverlapSeconds ?? 'unknown'}`,
  `- Trend samples: ${report.trend.sampleCount}; median runtime: ${report.trend.medianRunSeconds ?? 'unknown'}s; p95: ${report.trend.p95RunSeconds ?? 'unknown'}s`,
  `- Missing/failed required gates: ${current.failedOrMissingGates.join(', ') || 'none'}`,
  '- Budget exceedances are diagnostics, not permission to skip a release check.',
  '### Build 531 — Queue SLA exceptions and recovery evidence',
  `- Release evidence: ${report.build531.releaseEvidenceState}`,
  `- Recovery decision: ${report.build531.recoveryDecision}`,
  `- Queue / runtime SLA breaches in history: ${report.build531.trend.queueSlaBreaches} / ${report.build531.trend.runSlaBreaches}`,
  `- Parallel regression lane budgets: ${report.build531.laneBudgets.map((lane) => `${lane.name} ${lane.executionSeconds ?? 'unknown'}s/${lane.budgetSeconds}s`).join('; ')}`,
  `- Exceptions: ${report.build531.exceptions.map((item) => item.code).join(', ') || 'none'}`,
  '- Recovery is evidence review only: no retries, waived gates or production changes.',
  '### Build 532 — Critical path, historical gate triage and measured SLA comparison',
  `- Dependency timing state: ${report.build532.criticalPath.state}`,
  `- Controlling browser lane: ${report.build532.criticalPath.controllingLane ?? 'unknown'}`,
  `- Parallel browser window / source suite: ${report.build532.criticalPath.parallelWindowSeconds ?? 'unknown'}s / ${report.build532.criticalPath.sourceSuiteSeconds ?? 'unknown'}s`,
  `- Largest measured stage: ${report.build532.criticalPath.largestMeasuredStage?.name ?? 'unknown'}`,
  `- Slowest source steps: ${report.build532.criticalPath.sourceStepDetails.slice(0, 5).map((step) => `${step.name}: ${step.elapsedSeconds}s`).join('; ') || 'unavailable'}`,
  `- Historical held runs: ${report.build532.historicalGateExceptions.length} (review original run/job evidence)`,
  `- Comparable verified run: ${report.build532.slaComparison.previousVerifiedRunId ?? 'none'}; measured runtime difference: ${report.build532.slaComparison.secondsDifference ?? 'unknown'}s`,
  '- A measured comparison is not independent proof of causal savings. No gate waiver, retry or deployment changes.',
  '### Build 533 — Source browser hotspots and runner variance',
  `- Verified runner samples: ${report.build533.runnerVariance.verifiedSampleCount}; state: ${report.build533.runnerVariance.state}`,
  `- Lane medians / p95s: ${report.build533.runnerVariance.laneStats.map((lane) => `${lane.name}: ${lane.medianSeconds ?? 'unknown'}s / ${lane.p95Seconds ?? 'unknown'}s`).join('; ')}`,
  `- Batch timing state: ${report.build533.hotspotTiming.state}; comparable run: ${report.build533.hotspotTiming.priorRunId ?? 'none'}`,
  `- Retained Playwright specs: ${report.build533.hotspotTiming.retainedSuiteCount}; processes previously/current: ${report.build533.hotspotTiming.plannedPriorInvocations}/${report.build533.hotspotTiming.plannedCurrentInvocations}`,
  `- Batch 17/18/19 observed differences: ${report.build533.hotspotTiming.batches.map((batch) => `${batch.name}: ${batch.observedDifferenceSeconds ?? 'unknown'}s`).join('; ')}`,
  '- Runtime reductions are observations only, not independently proven causal savings or any authority to waive gates.',
  '### Build 534 — Source tail consolidation and cross-release throughput',
  `- Verified comparison: ${report.build534.state}; previous original run: ${report.build534.previousVerifiedRunId ?? 'none'}`,
  `- Cross-release samples: ${report.build534.verifiedSampleCount}; trend: ${report.build534.trendState}`,
  `- Retained browser specs: ${report.build534.retainedSpecs}; prior/current Playwright launches: ${report.build534.previousProcessLaunches}/${report.build534.currentProcessLaunches}`,
  `- Source-checks current/prior/difference: ${report.build534.sourceSeconds ?? 'unknown'}s / ${report.build534.priorSourceSeconds ?? 'unknown'}s / ${report.build534.sourceDifferenceSeconds ?? 'unknown'}s`,
  `- Tail 21+22 current/prior/difference: ${report.build534.tailTotalSeconds ?? 'unknown'}s / ${report.build534.priorTailTotalSeconds ?? 'unknown'}s / ${report.build534.tailDifferenceSeconds ?? 'unknown'}s`,
  `- Whole release current/prior/difference: ${report.build534.releaseSeconds ?? 'unknown'}s / ${report.build534.priorReleaseSeconds ?? 'unknown'}s / ${report.build534.releaseDifferenceSeconds ?? 'unknown'}s`,
  `- Median/p95 verified release runtime: ${report.build534.releaseMedianSeconds ?? 'unknown'}s / ${report.build534.releaseP95Seconds ?? 'unknown'}s`,
  '- Cross-release timing is observational only; no cause, waiver, retry, release approval or production mutation inferred.',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
console.log(summary);
if (!exactCurrentMain || current.status !== 'VERIFIED_GREEN') {
  console.error('CI audit is HOLD; never infer production GREEN from incomplete, failed or superseded evidence.');
  process.exitCode = 1;
}
