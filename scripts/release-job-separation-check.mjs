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
import { planHotspotBatch } from './build533-browser-hotspots.mjs';
import { planTailBatch } from './build534-browser-tail.mjs';
import { manifestFromWorkflow, planLaneC } from './build535-lane-c.mjs';
import { manifestFromWorkflow as warmBatch20Manifest, planWarmBatch20 } from './build536-batch20.mjs';
import { contractManifestFromWorkflow, planSourceContracts } from './build537-source-contract-lane.mjs';

const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:Boolean(ok),detail});
const between=(text,start,end)=>{
  const from=text.indexOf(start);
  if(from<0)return '';
  const to=end ? text.indexOf(end,from+start.length) : -1;
  return text.slice(from,to<0?text.length:to);
};

const lanes=between(workflow,'  browser-regression-lanes:\n','\n  source-checks:\n');
const laneC=between(lanes,'            c)\n','              ;;\n');
const source=between(workflow,'  source-checks:\n','\n  repository-enforcement:\n');
const repository=between(workflow,'  repository-enforcement:\n','\n  release-source-evidence:\n');
const releaseEvidence=between(workflow,'  release-source-evidence:\n','\n  release-truth-summary:\n');
const releaseSummary=between(workflow,'  release-truth-summary:\n','\n  staging-proof:\n');

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
  && source.includes('node scripts/build534-browser-tail.mjs 22')
  && planTailBatch('22').suites.includes('tests/browser/staging-infrastructure-readiness.spec.mjs'),
  'The exact-main application job still reaches the rendered/browser tail when application checks are healthy.');

add('build529-three-isolated-browser-lanes',
  lanes.includes('matrix:') && lanes.includes('lane: [a, b, c]')
  && lanes.includes('fail-fast: false')
  && lanes.includes('Install pinned Chromium for isolated lane')
  && lanes.includes('set -euo pipefail'),
  'Three isolated CI runners must exercise the parallel browser groups without skipping failures.');

add('build529-required-source-gate-waits-and-fails-closed',
  source.includes('needs: browser-regression-lanes')
  && source.includes('if: always()')
  && source.includes("run: test '\u0024{{ needs.browser-regression-lanes.result }}' = success"),
  'The existing required source-checks status must fail if any browser lane fails.');

let retainedHotspotSuites = 0;
try {
  for (const batch of ['17', '18', '19']) {
    if ((source.match(new RegExp(`node scripts/build533-browser-hotspots\\.mjs ${batch}(?!\\d)`, 'g')) ?? []).length !== 1) {
      throw new Error(`Missing or duplicate consolidated batch ${batch}`);
    }
    retainedHotspotSuites += planHotspotBatch(batch).suites.length;
  }
} catch (error) {
  console.error(`Consolidated browser coverage cannot be authenticated: ${error.message}`);
  retainedHotspotSuites = -1;
}
let retainedTailSuites = 0;
try {
  for (const batch of ['21', '22']) {
    if ((source.match(new RegExp(`node scripts/build534-browser-tail\\.mjs ${batch}(?!\\d)`, 'g')) ?? []).length !== 1) {
      throw new Error(`Missing or duplicate Build 534 browser tail batch ${batch}`);
    }
    retainedTailSuites += planTailBatch(batch).suites.length;
  }
} catch (error) {
  console.error(`Tail batch coverage cannot be authenticated: ${error.message}`);
  retainedTailSuites = -1;
}
let warmBatch20Suites = -1;
try {
  const manifest = warmBatch20Manifest(workflow);
  const plan = planWarmBatch20(manifest);
  const batch20 = between(source, '      - name: Browser regression batch 20 (3 retained commands)\n',
    '      - run: npm run test:rosevear-ql245-source-evidence-477\n');
  if ((source.match(/run: node scripts\/build536-batch20\.mjs/g) ?? []).length !== 1
    || !batch20.includes('run: node scripts/build536-batch20.mjs')) {
    throw new Error('Canonical batch-20 step is not actually wired to the verified runner.');
  }
  warmBatch20Suites = plan.suites.length;
} catch (error) {
  console.error(`Warm batch-20 coverage cannot be authenticated: ${error.message}`);
}
let laneCSuiteCount = -1;
try {
  const plan = planLaneC(manifestFromWorkflow(workflow));
  laneCSuiteCount = plan.suites.length;
} catch (error) {
  console.error(`Lane-C consolidated coverage cannot be authenticated: ${error.message}`);
}
add('build535-lane-c-original-execution-contract',
  laneCSuiteCount === 55
  && (lanes.match(/node scripts\/build535-lane-c\.mjs/g) || []).length === 1
  && laneC.includes('node scripts/build535-lane-c.mjs')
  && !laneC.includes('npm run test:browser:'),
  'One runner must consume the exact 55-command manifest; no missing or duplicate source commands.');
add('build529-535-browser-suite-equivalence',
  (lanes.match(/(?:npm run test:browser|npx playwright test)/g) || []).length === 163
  && (source.match(/(?:npm run test:browser|npx playwright test)/g) || []).length + retainedHotspotSuites + retainedTailSuites === 55
  && 108 + laneCSuiteCount + 7 + retainedHotspotSuites + retainedTailSuites === 218
  && lanes.includes('npm run test:browser:company-booking-catalogue-551')
  && lanes.includes('npm run test:browser:landscape-booking-552')
  && lanes.includes('npm run test:browser:landscape-availability-553')
  && lanes.includes('npm run test:browser:landscape-booking-review-554')
  && lanes.includes('npm run test:browser:landscape-canonical-handoff-555')
  && retainedHotspotSuites === 30 && retainedTailSuites === 18,
  'All 218 browser suites remain accounted for: 108 direct lane calls (including YW 551–555), 55 verified lane-C specs, 7 source calls, 48 verified bundled source specs.');
add('build536-warm-source-browser-batch-equivalence',
  warmBatch20Suites === 3 && retainedHotspotSuites === 30 && retainedTailSuites === 18
  && 4 + warmBatch20Suites + retainedHotspotSuites + retainedTailSuites === 55,
  'Source browser coverage remains exactly 55 suites: four isolated calls, three exact mapped batch-20 specs, and 48 source bundles.');

let retainedSourceContracts = -1;
try {
  const plan = planSourceContracts(contractManifestFromWorkflow(workflow));
  if ((source.match(/run: node scripts\/build537-source-contract-lane\.mjs/g) ?? []).length !== 1 ||
    !source.includes('Source non-browser CI contract lane (11 retained checks, 3 workers)')) {
    throw new Error('Required CI contract lane runner is absent or duplicated.');
  }
  retainedSourceContracts = plan.retainedChecks;
} catch (error) {
  console.error(`Build 537 non-browser source contract verification failed: ${error.message}`);
}
add('build537-nonbrowser-source-contract-execution-equivalence',
  retainedSourceContracts === 11 && source.includes('node scripts/build537-source-contract-lane-check.mjs')
  && source.includes('node scripts/build537-nonbrowser-p95-check.mjs')
  && source.includes('node scripts/exact-main-release-truth-summary-check.mjs'),
  'Eleven original CI contract verifiers run through the bounded fail-closed lane, with exact-main truth still independent.');
add('build538-scheduling-guardrails-remain-read-only',
  source.includes('node scripts/build538-runner-scheduling-check.mjs')
  && (source.match(/run: node scripts\/build538-runner-scheduling-check\.mjs/g) ?? []).length === 1
  && !lanes.includes('build538-runner-scheduling-check.mjs')
  && releaseEvidence.includes('needs: source-checks'),
  'Build 538 diagnoses original scheduling evidence inside source-checks and does not create, weaken or bypass a protected job.');
add('build539-slo-trend-alerting-is-read-only',
  (source.match(/run: node scripts\/build539-runner-slo-check\.mjs/g) ?? []).length === 1
  && !lanes.includes('build539-runner-slo-check.mjs')
  && !repository.includes('build539-runner-slo-check.mjs')
  && !releaseEvidence.includes('build539-runner-slo-check.mjs')
  && releaseEvidence.includes('needs: source-checks'),
  'Build 539 only reads original Actions SLO evidence and cannot weaken or replace any of the seven protected release gates.');
add('build540-owner-dashboard-retention-is-read-only',
  (source.match(/run: node scripts\/build540-ci-slo-check\.mjs/g) ?? []).length === 1
  && !lanes.includes('build540-ci-slo-check.mjs')
  && !repository.includes('build540-ci-slo-check.mjs')
  && !releaseEvidence.includes('build540-ci-slo-check.mjs')
  && releaseEvidence.includes('needs: source-checks'),
  'Build 540 checks owner-imported CI evidence and archive retention without changing the protected release gate topology.');
add('build541-independent-owner-custody-review-is-read-only',
  (source.match(/run: node scripts\/build541-ci-custody-check\.mjs/g) ?? []).length === 1
  && !lanes.includes('build541-ci-custody-check.mjs')
  && !repository.includes('build541-ci-custody-check.mjs')
  && !releaseEvidence.includes('build541-ci-custody-check.mjs')
  && releaseEvidence.includes('needs: source-checks'),
  'Build 541 readback and owner alert review are diagnostic only; the seven required release jobs remain independent.');

add('build529-isolated-release-jobs-have-no-lane-guard',
  !repository.includes('Require all parallel browser lanes to pass')
  && !releaseEvidence.includes('Require all parallel browser lanes to pass')
  && !releaseSummary.includes('Require all parallel browser lanes to pass')
  && source.includes('Require all parallel browser lanes to pass'),
  'Only source-checks may consume the browser-lanes dependency; independent main evidence jobs must not inherit it.');

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
