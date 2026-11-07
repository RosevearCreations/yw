#!/usr/bin/env node
/** Verifies all 55 legacy commands still select exactly the original browser specs. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { manifestFromWorkflow, planLaneC, ORIGINAL_SUITE_COUNT } from './build535-lane-c.mjs';

const workflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = manifestFromWorkflow(workflow);
const plan = planLaneC(manifest, pkg);
assert.equal(ORIGINAL_SUITE_COUNT, 55);
assert.equal(plan.commands.length, 55);
assert.equal(plan.suites.length, 55);
assert.equal(new Set(plan.suites).size, 55);
assert.deepEqual(plan.batches.map(({ specs }) => specs.length), [11, 11, 11, 11, 11]);
assert.deepEqual(plan.batches.flatMap(({ specs }) => specs), plan.suites);
for (const batch of plan.batches) {
  assert.deepEqual(batch.argv.slice(0, 6), ['--no-install', 'playwright', 'test', '--config=playwright.config.mjs', '--workers=1', batch.specs[0]]);
}
const laneC = workflow.split('            c)\n')[1].split('              ;;\n')[0];
assert.ok(laneC.includes('node scripts/build535-lane-c.mjs'));
assert.ok(!laneC.includes('npm run test:browser:'), 'lane-C scripts may not execute twice');
assert.equal((workflow.match(/node scripts\/build535-lane-c\.mjs/g) ?? []).length, 1);
for (const command of plan.commands) assert.equal(workflow.split(`            ${command}\n`).length, 2);
assert.throws(() => planLaneC(''), /changed|missing/);
assert.throws(() => planLaneC(manifest.split('\n').slice(1).join('\n')), /changed/);
assert.throws(() => planLaneC([...manifest.split('\n')].reverse().join('\n')), /changed/);
assert.throws(() => planLaneC(`${manifest}\nnpm run test:browser:fake`), /changed/);
assert.throws(() => manifestFromWorkflow(workflow.replace('YWI_LANE_C_COMMAND_MANIFEST', 'INVALID_MANIFEST')), /Missing/);
const missingMapping = { ...pkg, scripts: { ...pkg.scripts } };
delete missingMapping.scripts['test:browser:new-work-company-gate-421'];
assert.throws(() => planLaneC(manifest, missingMapping), /Missing, drifted/);
missingMapping.scripts['test:browser:new-work-company-gate-421'] = 'echo bypassed';
assert.throws(() => planLaneC(manifest, missingMapping), /Missing, drifted/);
const list = spawnSync(process.execPath, ['scripts/build535-lane-c.mjs', '--list'], {
  encoding: 'utf8', env: { ...process.env, YWI_LANE_C_COMMAND_MANIFEST: manifest },
});
assert.equal(list.status, 0, list.stderr);
assert.deepEqual(JSON.parse(list.stdout).suites, plan.suites);
const noManifest = spawnSync(process.execPath, ['scripts/build535-lane-c.mjs', '--list'], {
  encoding: 'utf8', env: { ...process.env, YWI_LANE_C_COMMAND_MANIFEST: '' },
});
assert.notEqual(noManifest.status, 0);
assert.ok(workflow.includes('lane: [a, b, c]') && workflow.includes('fail-fast: false'));
assert.ok(workflow.includes('needs: browser-regression-lanes'));
assert.ok(workflow.includes('needs: [source-checks, repository-enforcement, release-source-evidence]'));
assert.ok(workflow.includes('node scripts/build535-lane-c-timing-check.mjs'));
console.log('Build 535: 55 original Lane-C suites are exactly retained in five 11-spec, single-worker, fail-closed Playwright launches.');
