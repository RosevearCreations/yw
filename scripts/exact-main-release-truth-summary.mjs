#!/usr/bin/env node
/**
 * Build 258: exact-main release truth summary.
 *
 * Reporting only. This script does not call GitHub, Supabase, Stripe, or any
 * provider; it classifies completed workflow job results supplied by the
 * canonical exact-main workflow and writes a sanitized JSON/Markdown summary.
 * It never authorizes Production, changes repository protection, closes a rail,
 * records release authority, or converts a failed control into success.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const BUILD = 258;
export const EXPECTED_EVENT = 'push';
export const EXPECTED_REF = 'refs/heads/main';
export const DEFAULT_OUTPUT = 'exact-main-release-truth-summary.json';

const FAILURE_RESULTS = new Set(['failure','cancelled','timed_out','action_required','startup_failure','stale']);
const NON_PROOF_RESULTS = new Set(['skipped','neutral','unknown','pending','queued','in_progress','']);

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeResult(value) {
  return clean(value).toLowerCase().replaceAll(' ', '_');
}

function isSha(value) {
  return /^[0-9a-f]{40}$/i.test(clean(value));
}

export function resultState(value) {
  const result = normalizeResult(value);
  if (result === 'success') return 'green';
  if (FAILURE_RESULTS.has(result)) return 'red';
  if (NON_PROOF_RESULTS.has(result)) return 'unknown';
  return 'unknown';
}

export function buildExactMainReleaseTruth(env = {}) {
  const eventName = clean(env.YWI_GITHUB_EVENT_NAME || env.GITHUB_EVENT_NAME);
  const ref = clean(env.YWI_GITHUB_REF || env.GITHUB_REF);
  const headSha = clean(env.YWI_HEAD_SHA || env.GITHUB_SHA).toLowerCase();
  const sourceResult = normalizeResult(env.YWI_SOURCE_CHECKS_RESULT);
  const repositoryResult = normalizeResult(env.YWI_REPOSITORY_ENFORCEMENT_RESULT);
  const releaseEvidenceResult = normalizeResult(env.YWI_RELEASE_SOURCE_EVIDENCE_RESULT);
  const exactMainPush = eventName === EXPECTED_EVENT && ref === EXPECTED_REF && isSha(headSha);

  const sourceStatus = resultState(sourceResult);
  const repositoryStatus = resultState(repositoryResult);
  const releaseEvidenceStatus = resultState(releaseEvidenceResult);

  let posture = 'not_exact_main_push';
  let blockingControl = 'event_or_ref';
  if (exactMainPush) {
    if (sourceStatus !== 'green') {
      posture = sourceStatus === 'red' ? 'application_source_blocked' : 'application_source_unknown';
      blockingControl = 'source_checks';
    } else if (repositoryStatus !== 'green') {
      posture = repositoryStatus === 'red'
        ? 'application_green_repository_enforcement_blocked'
        : 'application_green_repository_enforcement_unknown';
      blockingControl = 'repository_enforcement';
    } else if (releaseEvidenceStatus !== 'green') {
      posture = releaseEvidenceStatus === 'red'
        ? 'application_green_release_evidence_blocked'
        : 'application_green_release_evidence_unknown';
      blockingControl = 'release_source_evidence';
    } else {
      posture = 'all_observed_release_controls_green';
      blockingControl = null;
    }
  }

  return {
    build: BUILD,
    generated_at: new Date().toISOString(),
    scope: 'exact_main_release_truth_summary',
    reporting_only: true,
    exact_main_push: exactMainPush,
    repository: clean(env.GITHUB_REPOSITORY || env.YWI_GITHUB_REPOSITORY || 'RosevearCreations/yw'),
    head_sha: isSha(headSha) ? headSha : null,
    workflow_run_id: clean(env.GITHUB_RUN_ID || env.YWI_GITHUB_RUN_ID) || null,
    workflow_run_attempt: clean(env.GITHUB_RUN_ATTEMPT || env.YWI_GITHUB_RUN_ATTEMPT) || null,
    application_source: {
      job: 'source-checks',
      result: sourceResult || 'unknown',
      status: sourceStatus,
    },
    repository_enforcement: {
      job: 'repository-enforcement',
      result: repositoryResult || 'unknown',
      status: repositoryStatus,
    },
    release_source_evidence: {
      job: 'release-source-evidence',
      result: releaseEvidenceResult || 'unknown',
      status: releaseEvidenceStatus,
    },
    posture,
    blocking_control: blockingControl,
    application_source_green: sourceStatus === 'green',
    all_observed_release_controls_green:
      exactMainPush && sourceStatus === 'green' && repositoryStatus === 'green' && releaseEvidenceStatus === 'green',
    production_authorized: false,
    mutations_performed: false,
    network_calls_performed: false,
    notes: [
      'Application source truth is independent from repository enforcement truth.',
      'A GREEN application source result does not override a failed repository or release-evidence control.',
      'This summary is reporting evidence only and is not release authority or Production deployment proof.',
    ],
  };
}

export function renderMarkdown(summary) {
  const source = summary.application_source;
  const repository = summary.repository_enforcement;
  const evidence = summary.release_source_evidence;
  const icon = (status) => status === 'green' ? '✅' : status === 'red' ? '🔴' : '⚪';
  return [
    `## YW Build ${BUILD} exact-main release truth`,
    '',
    `- ${icon(source.status)} **Application source / browser gate:** ${source.result} (${source.status})`,
    `- ${icon(repository.status)} **Repository enforcement:** ${repository.result} (${repository.status})`,
    `- ${icon(evidence.status)} **Release-source evidence:** ${evidence.result} (${evidence.status})`,
    `- **Posture:** \`${summary.posture}\``,
    `- **Exact main SHA:** \`${summary.head_sha || 'unavailable'}\``,
    '',
    '> Reporting only. This summary does not authorize Production, change GitHub protection, record release authority, or close any business/staging/provider rail.',
    '',
  ].join('\n');
}

export function writeSummary(env = process.env, options = {}) {
  const summary = buildExactMainReleaseTruth(env);
  if (!summary.exact_main_push) {
    throw new Error('Build 258 summary requires an exact push to refs/heads/main with a 40-character SHA.');
  }
  const outputPath = path.resolve(options.outputPath || env.YWI_EXACT_MAIN_RELEASE_TRUTH_PATH || DEFAULT_OUTPUT);
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  const markdown = renderMarkdown(summary);
  const githubSummary = clean(env.GITHUB_STEP_SUMMARY);
  if (githubSummary) fs.appendFileSync(githubSummary, markdown, 'utf8');
  return { summary, outputPath, markdown };
}

function isMainModule() {
  const target = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
  return import.meta.url === target;
}

if (isMainModule()) {
  try {
    const result = writeSummary(process.env);
    console.log(JSON.stringify(result.summary));
  } catch (error) {
    console.error(`Build 258 exact-main release truth summary failed: ${String(error?.message || error)}`);
    process.exit(1);
  }
}
