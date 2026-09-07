#!/usr/bin/env node
import fs from 'node:fs';

const clean = (value) => String(value ?? '').trim();

export function evaluateProductionPromotionShape(env = process.env) {
  const eventName = clean(env.YWI_GITHUB_EVENT_NAME);
  const ref = clean(env.YWI_GITHUB_REF);
  const baseRef = clean(env.YWI_GITHUB_BASE_REF);
  const headRef = clean(env.YWI_GITHUB_HEAD_REF);
  const prHeadSha = clean(env.YWI_GITHUB_PR_HEAD_SHA);
  const prBaseSha = clean(env.YWI_GITHUB_PR_BASE_SHA);
  const liveDevSha = clean(env.YWI_GITHUB_LIVE_DEV_SHA);
  const liveMainSha = clean(env.YWI_GITHUB_LIVE_MAIN_SHA);
  const blockers = [];
  let mode = 'unsupported';
  let freshnessStatus = 'not_applicable';
  let promotionFreshnessVerified = false;
  let nextSafeAction = 'Use the canonical Development feature or Development-to-Production promotion flow.';

  if (eventName === 'pull_request') {
    if (baseRef === 'main') {
      mode = 'production_promotion_candidate';
      freshnessStatus = 'unverified';
      if (headRef !== 'dev') {
        blockers.push('production_main_requires_dev_head');
        nextSafeAction = 'Retarget Production promotion so base is main and head is the proven dev branch; do not promote a feature branch directly to main.';
      } else if (!prHeadSha || !prBaseSha || !liveDevSha || !liveMainSha) {
        blockers.push('promotion_freshness_evidence_missing');
        nextSafeAction = 'Re-run the promotion gate with fresh GitHub evidence for the PR head/base and the current dev/main branch tips.';
      } else if (prHeadSha !== liveDevSha) {
        blockers.push('promotion_head_not_current_dev');
        nextSafeAction = 'Refresh or recreate the Production promotion PR from the current dev tip, then run the complete promotion gate again.';
      } else if (prBaseSha !== liveMainSha) {
        blockers.push('promotion_base_not_current_main');
        nextSafeAction = 'Refresh the Production promotion PR against the current main tip, then run the complete promotion gate again.';
      } else {
        freshnessStatus = 'current';
        promotionFreshnessVerified = true;
        nextSafeAction = 'Run the complete canonical source and rendered-browser promotion gate on this exact current dev SHA before merging main.';
      }
    } else if (baseRef === 'dev') {
      mode = 'development_feature_candidate';
      if (!headRef || headRef === 'main' || headRef === 'dev') {
        blockers.push('development_pr_requires_feature_head');
        nextSafeAction = 'Use a dedicated feature branch as the PR head when targeting dev.';
      } else {
        nextSafeAction = 'Run the canonical feature gate on this exact feature SHA before merging dev.';
      }
    } else {
      blockers.push('unsupported_pull_request_base');
      nextSafeAction = 'Target feature work to dev or Production promotion to main from dev.';
    }
  } else if (eventName === 'push') {
    if (ref === 'refs/heads/main') {
      mode = 'exact_main_followup';
      nextSafeAction = 'Run exact-main repository enforcement and release-source evidence checks on this same main SHA.';
    } else {
      blockers.push('unsupported_push_ref');
      nextSafeAction = 'Canonical push follow-up is valid only on refs/heads/main.';
    }
  } else if (eventName === 'workflow_dispatch') {
    mode = 'manual_source_check';
    nextSafeAction = 'Treat this as source/staging verification only; it is not Production promotion authority.';
  } else {
    blockers.push('unsupported_event');
  }

  return {
    ok: blockers.length === 0,
    event_name: eventName || null,
    ref: ref || null,
    base_ref: baseRef || null,
    head_ref: headRef || null,
    pr_head_sha: prHeadSha || null,
    pr_base_sha: prBaseSha || null,
    live_dev_sha: liveDevSha || null,
    live_main_sha: liveMainSha || null,
    mode,
    freshness_status: freshnessStatus,
    promotion_freshness_verified: promotionFreshnessVerified,
    blocker_codes: blockers,
    next_safe_action: nextSafeAction,
    production_promotion_authorized: false,
  };
}

export function renderPromotionShapeSummary(result) {
  return [
    '### Production promotion shape and freshness',
    '',
    result.ok ? '**VALID SHAPE**' : '**BLOCKED**',
    '',
    `- Event: \`${result.event_name || 'missing'}\``,
    `- Ref: \`${result.ref || 'n/a'}\``,
    `- Base: \`${result.base_ref || 'n/a'}\``,
    `- Head: \`${result.head_ref || 'n/a'}\``,
    `- Mode: \`${result.mode}\``,
    `- Promotion freshness: \`${result.freshness_status}\``,
    `- PR head SHA: \`${result.pr_head_sha || 'n/a'}\``,
    `- Current dev SHA: \`${result.live_dev_sha || 'n/a'}\``,
    `- PR base SHA: \`${result.pr_base_sha || 'n/a'}\``,
    `- Current main SHA: \`${result.live_main_sha || 'n/a'}\``,
    `- Blocker codes: ${result.blocker_codes.length ? result.blocker_codes.map((code)=>`\`${code}\``).join(', ') : 'none'}`,
    '',
    '#### Next safe action',
    '',
    result.next_safe_action,
    '',
    '> This guard validates branch/event shape and current promotion-branch freshness only. It never authorizes Production promotion, never merges a pull request, and never bypasses source, browser, repository-enforcement, staging, database, Auth, Finance, provider, or human acceptance gates.',
    '',
  ].join('\n');
}

function runCli() {
  const result = evaluateProductionPromotionShape(process.env);
  const summary = renderPromotionShapeSummary(result);
  console.log(JSON.stringify(result, null, 2));
  console.error(result.ok ? 'PRODUCTION PROMOTION SHAPE: VALID' : 'PRODUCTION PROMOTION SHAPE: LOCKED');
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary); } catch (error) {
      console.error(`Unable to append promotion-shape step summary: ${error?.message || error}`);
    }
  } else {
    console.log(`\n${summary}`);
  }
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) runCli();
