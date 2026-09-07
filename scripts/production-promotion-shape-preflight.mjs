#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const clean = (value) => String(value ?? '').trim();
const splitCsv = (value) => clean(value).split(',').map((item) => item.trim()).filter(Boolean);

export function resolvePromotionFreshnessEnv(env = process.env, deps = {}) {
  const resolved = { ...env };
  const eventName = clean(resolved.YWI_GITHUB_EVENT_NAME);
  const baseRef = clean(resolved.YWI_GITHUB_BASE_REF);
  const headRef = clean(resolved.YWI_GITHUB_HEAD_REF);
  if (eventName !== 'pull_request' || baseRef !== 'main' || headRef !== 'dev') return resolved;

  const readFile = deps.readFile || ((path) => fs.readFileSync(path, 'utf8'));
  const lsRemote = deps.lsRemote || (() => execFileSync('git', ['ls-remote', 'origin', 'refs/heads/dev', 'refs/heads/main'], { encoding: 'utf8' }));

  if (!clean(resolved.YWI_GITHUB_PR_HEAD_SHA) || !clean(resolved.YWI_GITHUB_PR_BASE_SHA)) {
    try {
      const eventPath = clean(resolved.GITHUB_EVENT_PATH);
      if (eventPath) {
        const payload = JSON.parse(readFile(eventPath));
        resolved.YWI_GITHUB_PR_HEAD_SHA ||= clean(payload?.pull_request?.head?.sha);
        resolved.YWI_GITHUB_PR_BASE_SHA ||= clean(payload?.pull_request?.base?.sha);
      }
    } catch (error) {
      resolved.YWI_PROMOTION_FRESHNESS_EVENT_ERROR = clean(error?.message || error);
    }
  }

  if (!clean(resolved.YWI_GITHUB_LIVE_DEV_SHA) || !clean(resolved.YWI_GITHUB_LIVE_MAIN_SHA)) {
    try {
      const rows = String(lsRemote() || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      for (const row of rows) {
        const [sha, ref] = row.split(/\s+/);
        if (ref === 'refs/heads/dev') resolved.YWI_GITHUB_LIVE_DEV_SHA ||= clean(sha);
        if (ref === 'refs/heads/main') resolved.YWI_GITHUB_LIVE_MAIN_SHA ||= clean(sha);
      }
    } catch (error) {
      resolved.YWI_PROMOTION_FRESHNESS_REMOTE_ERROR = clean(error?.message || error);
    }
  }

  return resolved;
}

export function resolvePromotionAncestryEnv(env = process.env, deps = {}) {
  const resolved = { ...env };
  const eventName = clean(resolved.YWI_GITHUB_EVENT_NAME);
  const baseRef = clean(resolved.YWI_GITHUB_BASE_REF);
  const headRef = clean(resolved.YWI_GITHUB_HEAD_REF);
  if (eventName !== 'pull_request' || baseRef !== 'main' || headRef !== 'dev') return resolved;
  if (clean(resolved.YWI_GITHUB_PROMOTION_MERGE_BASES) && clean(resolved.YWI_GITHUB_LIVE_MAIN_PARENTS)) return resolved;

  const git = deps.git || ((args) => execFileSync('git', args, { encoding: 'utf8' }));
  const isShallow = deps.isShallow || (() => fs.existsSync('.git/shallow'));
  try {
    const fetchArgs = ['fetch', '--no-tags', '--prune'];
    if (isShallow()) fetchArgs.push('--unshallow');
    fetchArgs.push(
      'origin',
      '+refs/heads/dev:refs/remotes/origin/dev',
      '+refs/heads/main:refs/remotes/origin/main',
    );
    git(fetchArgs);

    const mergeBases = String(git(['merge-base', '--all', 'refs/remotes/origin/main', 'refs/remotes/origin/dev']) || '')
      .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const mainLine = String(git(['rev-list', '--parents', '-n', '1', 'refs/remotes/origin/main']) || '')
      .trim().split(/\s+/).filter(Boolean);
    if (mergeBases.length) resolved.YWI_GITHUB_PROMOTION_MERGE_BASES ||= mergeBases.join(',');
    if (mainLine.length > 1) resolved.YWI_GITHUB_LIVE_MAIN_PARENTS ||= mainLine.slice(1).join(',');
  } catch (error) {
    resolved.YWI_PROMOTION_ANCESTRY_ERROR = clean(error?.message || error);
  }
  return resolved;
}

export function evaluateProductionPromotionShape(env = process.env) {
  const eventName = clean(env.YWI_GITHUB_EVENT_NAME);
  const ref = clean(env.YWI_GITHUB_REF);
  const baseRef = clean(env.YWI_GITHUB_BASE_REF);
  const headRef = clean(env.YWI_GITHUB_HEAD_REF);
  const prHeadSha = clean(env.YWI_GITHUB_PR_HEAD_SHA);
  const prBaseSha = clean(env.YWI_GITHUB_PR_BASE_SHA);
  const liveDevSha = clean(env.YWI_GITHUB_LIVE_DEV_SHA);
  const liveMainSha = clean(env.YWI_GITHUB_LIVE_MAIN_SHA);
  const mergeBases = splitCsv(env.YWI_GITHUB_PROMOTION_MERGE_BASES);
  const liveMainParents = splitCsv(env.YWI_GITHUB_LIVE_MAIN_PARENTS);
  const blockers = [];
  let mode = 'unsupported';
  let freshnessStatus = 'not_applicable';
  let ancestryStatus = 'not_applicable';
  let promotionFreshnessVerified = false;
  let promotionAncestryVerified = false;
  let nextSafeAction = 'Use the canonical Development feature or Development-to-Production promotion flow.';

  if (eventName === 'pull_request') {
    if (baseRef === 'main') {
      mode = 'production_promotion_candidate';
      freshnessStatus = 'unverified';
      ancestryStatus = 'unverified';
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
        if (liveDevSha === liveMainSha) {
          blockers.push('promotion_has_no_dev_changes');
          ancestryStatus = 'no_changes';
          nextSafeAction = 'Do not open or merge a Production promotion when current dev and main already point to the same SHA.';
        } else if (mergeBases.length === 0) {
          blockers.push('promotion_ancestry_evidence_missing');
          nextSafeAction = 'Re-run the promotion gate with fetched dev/main history so the common ancestor and current main parents can be verified.';
        } else if (mergeBases.length > 1) {
          blockers.push('promotion_ancestry_ambiguous');
          ancestryStatus = 'ambiguous';
          nextSafeAction = 'Reconcile the dev/main history to one canonical common ancestor before attempting Production promotion.';
        } else {
          const mergeBase = mergeBases[0];
          if (mergeBase === liveMainSha) {
            ancestryStatus = 'main_is_dev_ancestor';
            promotionAncestryVerified = true;
            nextSafeAction = 'Run the complete canonical source and rendered-browser promotion gate on this exact current dev SHA before merging main.';
          } else if (!liveMainParents.length) {
            blockers.push('promotion_ancestry_evidence_missing');
            nextSafeAction = 'Re-run the promotion gate with current main parent evidence so the previously promoted Development lineage can be verified.';
          } else if (liveMainParents.includes(mergeBase)) {
            ancestryStatus = 'previous_promoted_dev_preserved';
            promotionAncestryVerified = true;
            nextSafeAction = 'Run the complete canonical source and rendered-browser promotion gate on this exact current dev SHA before merging main.';
          } else {
            blockers.push('promotion_ancestry_not_canonical');
            ancestryStatus = 'noncanonical';
            nextSafeAction = 'Reconcile any main-only change or rewritten Development history back into dev, preserve the previously promoted Development lineage, then rerun the feature and promotion gates.';
          }
        }
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
    promotion_merge_bases: mergeBases,
    live_main_parents: liveMainParents,
    mode,
    freshness_status: freshnessStatus,
    ancestry_status: ancestryStatus,
    promotion_freshness_verified: promotionFreshnessVerified,
    promotion_ancestry_verified: promotionAncestryVerified,
    blocker_codes: blockers,
    next_safe_action: nextSafeAction,
    production_promotion_authorized: false,
  };
}

export function renderPromotionShapeSummary(result) {
  return [
    '### Production promotion shape, freshness and ancestry',
    '',
    result.ok ? '**VALID SHAPE**' : '**BLOCKED**',
    '',
    `- Event: \`${result.event_name || 'missing'}\``,
    `- Ref: \`${result.ref || 'n/a'}\``,
    `- Base: \`${result.base_ref || 'n/a'}\``,
    `- Head: \`${result.head_ref || 'n/a'}\``,
    `- Mode: \`${result.mode}\``,
    `- Promotion freshness: \`${result.freshness_status}\``,
    `- Promotion ancestry: \`${result.ancestry_status}\``,
    `- PR head SHA: \`${result.pr_head_sha || 'n/a'}\``,
    `- Current dev SHA: \`${result.live_dev_sha || 'n/a'}\``,
    `- PR base SHA: \`${result.pr_base_sha || 'n/a'}\``,
    `- Current main SHA: \`${result.live_main_sha || 'n/a'}\``,
    `- Merge base(s): ${result.promotion_merge_bases.length ? result.promotion_merge_bases.map((sha) => `\`${sha}\``).join(', ') : 'none'}`,
    `- Current main parent(s): ${result.live_main_parents.length ? result.live_main_parents.map((sha) => `\`${sha}\``).join(', ') : 'none'}`,
    `- Blocker codes: ${result.blocker_codes.length ? result.blocker_codes.map((code)=>`\`${code}\``).join(', ') : 'none'}`,
    '',
    '#### Next safe action',
    '',
    result.next_safe_action,
    '',
    '> This guard validates branch/event shape, current promotion-branch freshness and canonical Development/Production ancestry only. It never authorizes Production promotion, never merges a pull request, and never bypasses source, browser, repository-enforcement, staging, database, Auth, Finance, provider, or human acceptance gates.',
    '',
  ].join('\n');
}

function runCli() {
  const freshnessEnv = resolvePromotionFreshnessEnv(process.env);
  const hydratedEnv = resolvePromotionAncestryEnv(freshnessEnv);
  const result = evaluateProductionPromotionShape(hydratedEnv);
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
