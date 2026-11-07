#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { manifestFromWorkflow, planWarmBatch20 } from './build536-batch20.mjs';
import { planHotspotBatch } from './build533-browser-hotspots.mjs';
import { planTailBatch } from './build534-browser-tail.mjs';

const workflow = readFileSync('.github/workflows/staging-browser-integration.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = manifestFromWorkflow(workflow);
const warm = planWarmBatch20(manifest, pkg);
const original = ['test:browser:build525', 'test:browser:build526', 'test:browser:company-owner-session-491'];
assert.deepEqual(warm.commands, original.map((name) => `npm run ${name}`));
assert.deepEqual(warm.suites, [
  'tests/browser/build525.spec.mjs', 'tests/browser/build526.spec.mjs',
  'tests/browser/company-owner-session-491.spec.mjs',
]);
assert.deepEqual(warm.argv.slice(0, 5), ['--no-install', 'playwright', 'test', '--config=playwright.config.mjs', '--workers=1']);
const source = workflow.split('  source-checks:\n')[1].split('  repository-enforcement:\n')[0];
const batch = source.split('      - name: Browser regression batch 20 (3 retained commands)\n')[1].split('      - run: npm run test:rosevear-ql245-source-evidence-477\n')[0];
assert.ok(batch.includes('run: node scripts/build536-batch20.mjs'));
assert.equal((source.match(/run: node scripts\/build536-batch20\.mjs/g) ?? []).length, 1);
for (const command of warm.commands) assert.equal(workflow.split(`            ${command}\n`).length, 2);
assert.ok(!/^ {10}npm run test:browser:/m.test(batch), 'no duplicate direct browser launches');
const retained = [17, 18, 19].flatMap((id) => planHotspotBatch(String(id)).suites)
  .concat(warm.suites, [21, 22].flatMap((id) => planTailBatch(String(id)).suites));
assert.equal(retained.length, 51);
assert.equal(new Set(retained).size, 51);
assert.throws(() => planWarmBatch20(''), /changed/);
assert.throws(() => planWarmBatch20(warm.commands.slice(1).join('\n')), /changed/);
assert.throws(() => planWarmBatch20([...warm.commands].reverse().join('\n')), /changed/);
assert.throws(() => manifestFromWorkflow(workflow.replace('YWI_WARM_BATCH20_MANIFEST', 'MISSING')), /Missing/);
const bad = { ...pkg, scripts: { ...pkg.scripts, 'test:browser:build525': 'echo no tests' } };
assert.throws(() => planWarmBatch20(manifest, bad), /missing or drifted/);
const list = spawnSync(process.execPath, ['scripts/build536-batch20.mjs', '--list'], {
  encoding: 'utf8', env: { ...process.env, YWI_WARM_BATCH20_MANIFEST: manifest },
});
assert.equal(list.status, 0, list.stderr);
assert.deepEqual(JSON.parse(list.stdout).suites, warm.suites);
const missing = spawnSync(process.execPath, ['scripts/build536-batch20.mjs', '--list'], {
  encoding: 'utf8', env: { ...process.env, YWI_WARM_BATCH20_MANIFEST: '' },
});
assert.notEqual(missing.status, 0);
assert.ok(source.includes('node scripts/build536-source-variance-check.mjs'));
assert.ok(source.includes('needs: browser-regression-lanes'));
assert.ok(workflow.includes('needs: [source-checks, repository-enforcement, release-source-evidence]'));
console.log('Build 536: original 51 source browser suites retained, batch 20 three specs in one fail-closed warm-context process, exact gate wiring verified.');
