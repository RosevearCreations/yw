#!/usr/bin/env node
/**
 * Build 257 — deterministic release-gate separation authority.
 *
 * Exact-main application validation must run to completion independently of
 * GitHub branch-protection enforcement. Repository policy may remain RED, but
 * it must not short-circuit the application/browser suite. Release-source
 * evidence remains locked until branch protection is actually reported true.
 */
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:Boolean(ok),detail});
const between=(text,start,end)=>{
  const from=text.indexOf(start);
  if(from<0)return '';
  const to=end ? text.indexOf(end,from+start.length) : -1;
  return text.slice(from,to<0?text.length:to);
};

const source=between(workflow,'  source-checks:\n','\n  repository-enforcement:\n');
const repository=between(workflow,'  repository-enforcement:\n','\n  release-source-evidence:\n');
const releaseEvidence=between(workflow,'  release-source-evidence:\n','\n  staging-proof:\n');

add('source-checks-job-exists',Boolean(source),'Canonical application source/rendered job must exist.');
add('repository-enforcement-job-exists',Boolean(repository),'Exact-main repository policy must have its own job.');
add('release-source-evidence-job-exists',Boolean(releaseEvidence),'Release-source evidence job must remain present.');

add('live-repository-enforcement-not-inside-source-checks',
  !source.includes('Require GitHub repository enforcement on exact main')
  && !source.includes('YWI_GITHUB_MAIN_PROTECTED')
  && !source.includes('npm run repository:protection:require'),
  'Application validation cannot be short-circuited by the known external branch-policy state.');

add('source-checks-still-tests-repository-policy-code',
  source.includes('npm run test:repository-protection-preflight'),
  'Deterministic source tests for repository policy remain part of the application suite.');

add('build257-separation-authority-is-mandatory',
  source.includes('node scripts/release-job-separation-check.mjs'),
  'The workflow checks its own gate separation on every release PR/push.');

add('source-checks-retains-rendered-tail',
  source.includes('Install Chromium for rendered module acceptance')
  && source.includes('npm run test:browser:help-seo')
  && source.includes('tests/browser/staging-infrastructure-readiness.spec.mjs'),
  'The exact-main application job still reaches the rendered/browser tail when application checks are healthy.');

add('repository-enforcement-is-exact-main-only',
  repository.includes("if: github.event_name == 'push' && github.ref == 'refs/heads/main'")
  && repository.includes('YWI_EXPECTED_MAIN_SHA: ${{ github.sha }}'),
  'External repository enforcement is evaluated only for an exact main push.');

add('repository-enforcement-is-independent',
  !/^\s*needs:\s*source-checks\s*$/m.test(repository),
  'Repository policy truth is independent and can report even while application checks are still running.');

add('repository-enforcement-rechecks-exact-main',
  repository.includes('gh api "repos/${GITHUB_REPOSITORY}/branches/main"')
  && repository.includes("export YWI_GITHUB_MAIN_SHA=")
  && repository.includes("export YWI_GITHUB_MAIN_PROTECTED=")
  && repository.includes('npm run repository:protection:require'),
  'The external job verifies the current main SHA and GitHub-reported protection state.');

add('release-evidence-still-depends-on-source-success',
  releaseEvidence.includes('needs: source-checks')
  && releaseEvidence.includes('YWI_SOURCE_CHECKS_RESULT: ${{ needs.source-checks.result }}'),
  'Exact-main source evidence can only be attempted after the full application suite succeeds.');

add('release-evidence-remains-protection-locked',
  releaseEvidence.includes('YWI_GITHUB_MAIN_PROTECTED')
  && releaseEvidence.includes('npm run repository:protection:require')
  && releaseEvidence.includes('npm run release:evidence:write'),
  'Build 257 separates diagnostics but does not weaken release-evidence branch-policy requirements.');

add('staging-proof-remains-separate',
  workflow.includes("if: github.event_name == 'workflow_dispatch' && inputs.run_staging == 'true'")
  && workflow.includes('environment: staging'),
  'Release gate separation does not authorize or alter staging mutation.');

const failed=checks.filter((item)=>!item.ok);
for(const item of checks){
  console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.detail?` — ${item.detail}`:''}`);
}
if(failed.length){
  console.error(`\nBuild 257 release gate separation failed: ${failed.length}/${checks.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nBuild 257 release gate separation passed: ${checks.length}/${checks.length} checks.`);
