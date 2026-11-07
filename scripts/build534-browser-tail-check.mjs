#!/usr/bin/env node
/** Deterministic fail-closed retained-suite and protected-gate equivalence. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { planTailBatch, TAIL_BATCHES } from './build534-browser-tail.mjs';
import { planHotspotBatch } from './build533-browser-hotspots.mjs';

const workflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const ids = ['21', '22'];
const expectedCounts = { '21': 10, '22': 8 };
const all = [];
for (const id of ids) {
  const plan = planTailBatch(id, pkg);
  assert.equal(plan.suites.length, expectedCounts[id]);
  assert.ok(plan.argv.includes('--workers=1'));
  assert.equal(plan.argv[0], '--no-install');
  assert.equal((workflow.match(new RegExp(`run: node scripts/build534-browser-tail\\.mjs ${id}(?!\\d)`, 'g')) ?? []).length, 1);
  assert.ok(workflow.includes(`- name: Browser regression batch ${id} (${expectedCounts[id]} retained commands)`));
  for (const script of TAIL_BATCHES[id]) {
    if (script === 'direct:staging-infrastructure-readiness') {
      assert.ok(!workflow.includes('npx playwright test --config=playwright.config.mjs tests/browser/staging-infrastructure-readiness.spec.mjs'));
    } else {
      assert.ok(!workflow.includes(`npm run test:browser:${script}\n`));
    }
  }
  all.push(...plan.suites);
}
assert.equal(all.length, 18);
assert.equal(new Set(all).size, 18);
assert.equal(planTailBatch('22').suites[5], 'tests/browser/staging-infrastructure-readiness.spec.mjs');
assert.deepEqual(Object.keys(TAIL_BATCHES), ['21', '22']);
assert.throws(() => planTailBatch('not-a-batch'), /fail closed/);
assert.throws(() => planTailBatch('21', { scripts: {} }), /Missing or changed/);
assert.throws(() => planTailBatch('22', { scripts: {} }), /Missing or changed/);
const result = spawnSync(process.execPath, ['scripts/build534-browser-tail.mjs', '22', '--list'], { encoding: 'utf8' });
assert.equal(result.status, 0);
assert.deepEqual(JSON.parse(result.stdout).suites, planTailBatch('22').suites);
const invalid = spawnSync(process.execPath, ['scripts/build534-browser-tail.mjs', '23'], { encoding: 'utf8' });
assert.notEqual(invalid.status, 0);
const retained = [17, 18, 19].flatMap((n) => planHotspotBatch(String(n)).suites);
assert.equal(new Set([...all, ...retained]).size, 48);
assert.ok(workflow.includes('needs: browser-regression-lanes'));
assert.ok(workflow.includes('needs: [source-checks, repository-enforcement, release-source-evidence]'));
assert.ok(workflow.includes('node scripts/build534-throughput-check.mjs'));
assert.ok(workflow.includes('node scripts/build533-browser-hotspots-check.mjs'));
console.log('Build 534 browser tail: all 18 original spec files retained in 2 fail-closed processes; 48 bundled specs nonduplicated; protected gates unchanged.');
