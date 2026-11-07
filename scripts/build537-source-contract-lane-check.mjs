#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { contractManifestFromWorkflow, planSourceContracts, SOURCE_CONTRACT_CHECKS,
  SOURCE_CONTRACT_WORKERS } from './build537-source-contract-lane.mjs';

const workflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const section = workflow.split('  source-checks:\n')[1]?.split('  repository-enforcement:\n')[0];
assert.ok(section, 'Original independent source gate must exist.');
const lane = section.split('      - name: Source non-browser CI contract lane (11 retained checks, 3 workers)\n')[1]
  ?.split('      - run: node scripts/build537-source-contract-lane-check.mjs')[0];
assert.ok(lane?.includes('run: node scripts/build537-source-contract-lane.mjs'), 'Runner must execute exact group.');
const manifest = contractManifestFromWorkflow(workflow);
const plan = planSourceContracts(manifest);
assert.equal(plan.retainedChecks, 11);
assert.equal(plan.workers, 3);
assert.deepEqual(plan.commands, SOURCE_CONTRACT_CHECKS);
assert.equal(new Set(plan.scripts).size, 11);
for (const command of SOURCE_CONTRACT_CHECKS) {
  assert.equal((section.match(new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1,
    `Source contract command must be retained exactly once: ${command}`);
  assert.ok(!section.includes(`- run: ${command}`), 'No hidden duplicate sequential source contract launch.');
}
const listed = spawnSync(process.execPath, ['scripts/build537-source-contract-lane.mjs', '--list'], {
  encoding: 'utf8', env: { ...process.env, YWI_SOURCE_CONTRACT_COMMAND_MANIFEST: manifest },
});
assert.equal(listed.status, 0, listed.stderr);
assert.deepEqual(JSON.parse(listed.stdout).scripts, plan.scripts);
const denied = spawnSync(process.execPath, ['scripts/build537-source-contract-lane.mjs', '--list'], {
  encoding: 'utf8', env: { ...process.env, YWI_SOURCE_CONTRACT_COMMAND_MANIFEST: '' },
});
assert.notEqual(denied.status, 0, 'A missing execution manifest may not pass.');
assert.throws(() => planSourceContracts(manifest.replace(SOURCE_CONTRACT_CHECKS[4], SOURCE_CONTRACT_CHECKS[3])), /changed/);
assert.throws(() => planSourceContracts(`${manifest}\nnode scripts/not-allowed-check.mjs`), /changed/);
assert.throws(() => contractManifestFromWorkflow(workflow.replace('YWI_SOURCE_CONTRACT_COMMAND_MANIFEST', 'REMOVED_MANIFEST')), /Missing/);
assert.match(section, /needs: browser-regression-lanes/);
assert.match(section, /if: always\(\)/);
assert.match(section, /- run: node scripts\/build537-nonbrowser-p95-check\.mjs/);
assert.match(section, /- run: node scripts\/exact-main-release-truth-summary-check\.mjs/);
assert.match(section, /- run: npm run test:release-source-evidence/);
console.log('Build 537: 11 original non-browser checks retained, bounded three-worker execution and fail-closed manifest verified.');
