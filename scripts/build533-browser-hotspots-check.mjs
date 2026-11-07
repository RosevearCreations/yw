#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { HOTSPOT_BATCHES, planHotspotBatch } from './build533-browser-hotspots.mjs';

const source = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const all = [];
for (const id of ['17', '18', '19']) {
  const plan = planHotspotBatch(id, packageJson);
  assert.equal(plan.suites.length, 10);
  assert.ok(plan.argv.includes('--workers=1'), 'preserve nonconcurrent batch execution');
  assert.equal(plan.argv[0], '--no-install', 'never fetch unpinned dependencies dynamically');
  const occurrence = source.match(new RegExp(`run: node scripts/build533-browser-hotspots\\.mjs ${id}(?!\\d)`, 'g')) ?? [];
  assert.equal(occurrence.length, 1, `hotspot ${id} must remain in the protected source-checks job exactly once`);
  all.push(...plan.suites);
}
assert.equal(all.length, 30);
assert.equal(new Set(all).size, 30);
for (let number = 495; number <= 524; number++) {
  assert.ok(all.includes(`tests/browser/build${number}.spec.mjs`));
  assert.ok(!source.includes(`npm run test:browser:build${number}\n`), 'legacy nested Playwright process must be consolidated exactly once');
}
assert.deepEqual(Object.keys(HOTSPOT_BATCHES), ['17', '18', '19']);
assert.throws(() => planHotspotBatch('INVALID'), /fail closed/);
assert.throws(() => planHotspotBatch('17', { scripts: {} }), /contract changed/);
const listed = spawnSync(process.execPath, ['scripts/build533-browser-hotspots.mjs', '18', '--list'], { encoding: 'utf8' });
assert.equal(listed.status, 0);
assert.deepEqual(JSON.parse(listed.stdout).suites, planHotspotBatch('18').suites);
const invalid = spawnSync(process.execPath, ['scripts/build533-browser-hotspots.mjs', 'not-allowed'], { encoding: 'utf8' });
assert.notEqual(invalid.status, 0);
assert.ok(source.includes('needs: browser-regression-lanes'));
assert.ok(source.includes('needs: [source-checks, repository-enforcement, release-source-evidence]'));
assert.ok(source.includes('node scripts/build533-runner-variance-check.mjs'));
console.log('Build 533: 30 original Playwright specs retained in 3 fail-closed single-process batches; protected gates unchanged.');
