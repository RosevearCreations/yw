#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const clean=(value)=>String(value ?? '').trim();

export const REPOSITORY_PROTECTION_REMEDIATION = Object.freeze({
  control:'GitHub exact-main repository enforcement',
  owner:'GitHub repository administrator',
  automatic_fix_supported:false,
  accepted_enforcement_paths:Object.freeze([
    'active branch ruleset targeting main',
    'classic branch protection rule targeting main'
  ]),
  manual_steps:Object.freeze([
    'Open RosevearCreations/yw in GitHub, then use Settings → Rules → Rulesets or Settings → Branches.',
    'Create or enable an active branch ruleset targeting main, or a classic branch protection rule targeting main.',
    'Require a pull request before merging and require the canonical YWI source/staging source-check status before merge.',
    'Keep force pushes and branch deletion disabled for main.',
    'Complete the next normal main promotion and require the exact-main workflow to observe protected=true on that same main SHA.'
  ])
});

function nextSafeAction(blockers){
  if(blockers.includes('main_unprotected')){
    return 'Enable an active GitHub branch ruleset or branch protection rule for main using the documented manual policy, then verify a fresh exact-main workflow observes protected=true on the same main SHA.';
  }
  if(blockers.includes('main_sha_mismatch')){
    return 'Do not record release evidence. Confirm whether main moved after this workflow started, then use a fresh exact-main run for the current main SHA.';
  }
  if(blockers.includes('missing_github_main_evidence')){
    return 'Restore a fresh GitHub branches/main evidence read before treating repository enforcement as current.';
  }
  if(blockers.includes('not_exact_main_push')){
    return 'Repository enforcement may authorize release only from a push workflow on refs/heads/main.';
  }
  return 'Repository enforcement is verified for this exact main SHA. Continue with the remaining release authority checks.';
}

export function evaluateRepositoryProtection(env={}){
  const eventName=clean(env.YWI_GITHUB_EVENT_NAME);
  const ref=clean(env.YWI_GITHUB_REF);
  const expectedMainSha=clean(env.YWI_EXPECTED_MAIN_SHA).toLowerCase();
  const reportedMainSha=clean(env.YWI_GITHUB_MAIN_SHA).toLowerCase();
  const protectedRaw=clean(env.YWI_GITHUB_MAIN_PROTECTED);
  const errors=[];
  const blockerCodes=[];

  if(eventName!=='push'){
    errors.push('Repository enforcement release preflight is valid only for a push event.');
    blockerCodes.push('not_exact_main_push');
  }
  if(ref!=='refs/heads/main'){
    errors.push('Repository enforcement release preflight is valid only for refs/heads/main.');
    if(!blockerCodes.includes('not_exact_main_push'))blockerCodes.push('not_exact_main_push');
  }
  if(!expectedMainSha){
    errors.push('YWI_EXPECTED_MAIN_SHA is required.');
    blockerCodes.push('missing_expected_main_sha');
  }
  if(!reportedMainSha){
    errors.push('YWI_GITHUB_MAIN_SHA is required.');
    blockerCodes.push('missing_github_main_evidence');
  }
  if(expectedMainSha && reportedMainSha && expectedMainSha!==reportedMainSha){
    errors.push('GitHub main branch SHA must exactly match the workflow release SHA.');
    blockerCodes.push('main_sha_mismatch');
  }
  if(protectedRaw!=='true'){
    errors.push('GitHub must report main protected=true before exact-main release authority can be green.');
    blockerCodes.push(protectedRaw ? 'main_unprotected' : 'missing_github_main_evidence');
  }

  const uniqueBlockers=[...new Set(blockerCodes)];
  const ok=errors.length===0;
  return {
    ok,
    event_name:eventName || null,
    ref:ref || null,
    expected_main_sha:expectedMainSha || null,
    reported_main_sha:reportedMainSha || null,
    exact_main_sha_match:Boolean(expectedMainSha && reportedMainSha && expectedMainSha===reportedMainSha),
    main_protected:protectedRaw==='true',
    evidence_source:'GitHub REST branches/main protected field (branch protection or ruleset)',
    blocker_codes:uniqueBlockers,
    next_safe_action:nextSafeAction(uniqueBlockers),
    remediation:ok ? null : REPOSITORY_PROTECTION_REMEDIATION,
    errors,
  };
}

export function renderRepositoryProtectionSummary(result){
  const lines=[
    '### Exact-main repository enforcement',
    '',
    `**${result.ok?'READY':'BLOCKED'}**`,
    '',
    `- Workflow main SHA: \`${result.expected_main_sha || 'missing'}\``,
    `- GitHub main SHA: \`${result.reported_main_sha || 'missing'}\``,
    `- Exact SHA match: **${result.exact_main_sha_match?'yes':'no'}**`,
    `- GitHub reports main protected: **${result.main_protected?'true':'false'}**`,
  ];
  if(result.blocker_codes?.length)lines.push(`- Blocker codes: \`${result.blocker_codes.join('`, `')}\``);
  lines.push('', '#### Next safe action', '', result.next_safe_action || 'Review repository enforcement evidence.');
  if(result.remediation){
    lines.push('', '#### Manual remediation', '');
    result.remediation.manual_steps.forEach((step,index)=>lines.push(`${index+1}. ${step}`));
    lines.push('', '> Manual GitHub administrator action is required. This automation cannot enable branch protection or rulesets, cannot mark the gate green by itself, and does not weaken the exact-main enforcement check.');
  }
  return `${lines.join('\n')}\n`;
}

function appendGithubSummary(result,env=process.env){
  const target=clean(env.GITHUB_STEP_SUMMARY);
  if(!target)return;
  try{fs.appendFileSync(target,renderRepositoryProtectionSummary(result),'utf8');}
  catch(error){console.error(`Unable to append repository-enforcement step summary: ${error?.message || error}`);}
}

function printResult(result){
  console.log(JSON.stringify(result,null,2));
  console.log(`\n${renderRepositoryProtectionSummary(result)}`);
  appendGithubSummary(result);
  if(!result.ok){
    console.error('REPOSITORY PROTECTION RELEASE PREFLIGHT: LOCKED');
    for(const error of result.errors)console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('REPOSITORY PROTECTION RELEASE PREFLIGHT: READY');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)printResult(evaluateRepositoryProtection(process.env));
