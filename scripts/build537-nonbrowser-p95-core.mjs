/** Build 537: independent read-only critical-path attribution and strict
 * multi-release P95 evidence. A historical certification HOLD must never
 * change the seven release-gate conclusions or grant release authority.
 */
import { REQUIRED_GATES, LIMITS } from './build530-ci-runtime-audit-core.mjs';
import { verifiedSourceObservation } from './build536-source-variance-core.mjs';
import { SOURCE_CONTRACT_CHECKS } from './build537-source-contract-lane.mjs';

const INSTALL = 'Install Chromium for rendered module acceptance';
const GROUP = 'Source non-browser CI contract lane (11 retained checks, 3 workers)';
export const STANDALONE_BROWSER_STEPS = Object.freeze([
  'Run npm run test:browser:company-owner-workspace-490',
  'Run npm run test:browser:platform-account-audit-490',
  'Run npm run test:browser:build493',
  'Run npm run test:browser:build494',
]);
const unique = (items, name) => {
  const matches = items.filter((item) => item.name === name);
  return matches.length === 1 ? matches[0] : null;
};
const seconds = (start, end) => {
  const a = Date.parse(start ?? ''), b = Date.parse(end ?? '');
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 1000) : null;
};
const quantile = (items, p) => items.length
  ? [...items].sort((a, b) => a - b)[Math.ceil(items.length * p) - 1] : null;

function detailedSourceObservation(entry) {
  const base = verifiedSourceObservation(entry);
  if (!base) return null;
  const source = unique(entry.jobs, 'source-checks');
  const steps = source?.steps ?? [];
  const install = unique(steps, INSTALL);
  const installSeconds = seconds(install?.started_at, install?.completed_at);
  const firstBatch = unique(steps, 'Browser regression batch 17 (10 retained commands)');
  const browser = STANDALONE_BROWSER_STEPS.map((name) => unique(steps, name));
  const durations = browser.map((step) => seconds(step?.started_at, step?.completed_at));
  if (installSeconds === null || browser.some((step, index) =>
    step?.conclusion !== 'success' || !Number.isSafeInteger(step.number) ||
    step.number <= install.number || step.number >= firstBatch.number || durations[index] === null)) return null;
  const standaloneSeconds = durations.reduce((a, b) => a + b, 0);
  const nonBrowserResidualSeconds = base.sourceSeconds - base.batchSeconds - standaloneSeconds - installSeconds;
  if (nonBrowserResidualSeconds < 0) return null;
  const groups = steps.filter((step) => step.name === GROUP);
  if (groups.length > 1 || (groups.length === 1 && (groups[0].conclusion !== 'success' ||
    seconds(groups[0].started_at, groups[0].completed_at) === null))) return null;
  return {
    ...base, installSeconds, standaloneSeconds, nonBrowserResidualSeconds,
    contractGroupSeconds: groups.length ? seconds(groups[0].started_at, groups[0].completed_at) : null,
    contractGroupObserved: groups.length === 1,
  };
}

export function reviewNonBrowserP95(current, detailedHistory, { exactCurrentMain = false } = {}) {
  if (!current || !Array.isArray(detailedHistory)) throw new Error('Original exact-main run and bounded Actions history required.');
  const observations = detailedHistory.slice(0, 6).map(detailedSourceObservation).filter(Boolean);
  const now = exactCurrentMain && current.status === 'VERIFIED_GREEN'
    ? observations.find((sample) => sample.runId === current.runId && sample.sha === current.headSha &&
        sample.contractGroupObserved) ?? null : null;
  const previous = observations.find((sample) => sample.sha !== current.headSha) ?? null;
  const trend = {
    sourceP95Seconds: quantile(observations.map((sample) => sample.sourceSeconds), 0.95),
    warmBatchP95Seconds: quantile(observations.map((sample) => sample.batchSeconds), 0.95),
    nonBrowserResidualP95Seconds: quantile(observations.map((sample) => sample.nonBrowserResidualSeconds), 0.95),
    releaseP95Seconds: quantile(observations.map((sample) => sample.releaseSeconds), 0.95),
  };
  const budgets = { sourceSeconds: 240, warmBatchSeconds: 160, nonBrowserResidualSeconds: 100,
    releaseSeconds: LIMITS.runSeconds };
  const p95Breaches = [
    ['source-checks', trend.sourceP95Seconds, budgets.sourceSeconds],
    ['browser-batches-17-22', trend.warmBatchP95Seconds, budgets.warmBatchSeconds],
    ['non-browser-residual', trend.nonBrowserResidualP95Seconds, budgets.nonBrowserResidualSeconds],
    ['whole-release', trend.releaseP95Seconds, budgets.releaseSeconds],
  ].filter(([, observed, budget]) => observed !== null && observed > budget)
    .map(([name, observed, budget]) => ({ name, observedSeconds: observed, budgetSeconds: budget,
      overBudgetSeconds: observed - budget }));
  const comparison = now && previous ? {
    priorRunId: previous.runId,
    sourceDifferenceSeconds: now.sourceSeconds - previous.sourceSeconds,
    nonBrowserResidualDifferenceSeconds: now.nonBrowserResidualSeconds - previous.nonBrowserResidualSeconds,
    warmBatchDifferenceSeconds: now.batchSeconds - previous.batchSeconds,
    standaloneBrowserDifferenceSeconds: now.standaloneSeconds - previous.standaloneSeconds,
    chromiumInstallDifferenceSeconds: now.installSeconds - previous.installSeconds,
    releaseDifferenceSeconds: now.releaseSeconds - previous.releaseSeconds,
  } : null;
  return {
    schema: 'ywi.build537.nonbrowser-critical-path-p95.v1',
    state: now ? 'EXACT_MAIN_GREEN_SOURCE_RESIDUAL_OBSERVED' : 'HOLD_UNVERIFIED_EXACT_MAIN_SOURCE',
    certification: !now ? 'HOLD_UNVERIFIED_EXACT_MAIN_SOURCE'
      : observations.length < 6 ? 'HOLD_INSUFFICIENT_VERIFIED_RELEASES'
      : p95Breaches.length ? 'HOLD_HISTORICAL_P95_EXCEPTIONS' : 'CERTIFIED_SIX_RELEASE_P95_SLA',
    currentRunId: current.runId, verifiedSamples: observations.length,
    originalSourceContractChecks: SOURCE_CONTRACT_CHECKS.length,
    boundedContractWorkers: 3,
    current: now, comparison, trend, budgets, p95Breaches,
    currentBudgetState: !now ? 'HOLD_UNVERIFIED'
      : now.sourceSeconds <= budgets.sourceSeconds && now.batchSeconds <= budgets.warmBatchSeconds &&
        now.nonBrowserResidualSeconds <= budgets.nonBrowserResidualSeconds && now.releaseSeconds <= budgets.releaseSeconds
        ? 'CURRENT_RELEASE_MEETS_BUDGET' : 'CURRENT_RELEASE_BUDGET_EXCEPTION',
    safeguards: { requiredGates: REQUIRED_GATES, exactCurrentMainRequired: true,
      independentSlaCertification: true, releaseAuthority: false, automaticRetries: false,
      waivedGates: false, causalSavingsProven: false, environmentMutation: false },
    caution: 'Non-browser residual equals source job time minus six browser batches, four standalone browser steps and Chromium installation. It includes runner setup and step gaps; P95 is descriptive exact-main history, not a causal optimization claim or release approval.',
  };
}
