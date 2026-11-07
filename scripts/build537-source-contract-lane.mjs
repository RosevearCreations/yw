#!/usr/bin/env node
/** Build 537: run the original source-owned, read-only CI contract checks in a
 * bounded parallel lane. Their exact execution manifest is part of the source
 * workflow; no check may be removed, renamed or silently skipped.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_CONTRACT_CHECKS = Object.freeze([
  'node scripts/build530-ci-runtime-audit-check.mjs',
  'node scripts/build531-ci-exceptions-check.mjs',
  'node scripts/build532-ci-critical-path-check.mjs',
  'node scripts/build533-browser-hotspots-check.mjs',
  'node scripts/build533-runner-variance-check.mjs',
  'node scripts/build534-browser-tail-check.mjs',
  'node scripts/build534-throughput-check.mjs',
  'node scripts/build535-lane-c-check.mjs',
  'node scripts/build535-lane-c-timing-check.mjs',
  'node scripts/build536-warm-batches-check.mjs',
  'node scripts/build536-source-variance-check.mjs',
]);
export const SOURCE_CONTRACT_WORKERS = 3;
const MARKER = '          YWI_SOURCE_CONTRACT_COMMAND_MANIFEST: |\n';

export function contractManifestFromWorkflow(workflow) {
  if (typeof workflow !== 'string' || workflow.split(MARKER).length !== 2) {
    throw new Error('Missing or duplicate Build 537 source contract command manifest.');
  }
  const lines = [];
  for (const line of workflow.split(MARKER)[1].split('\n')) {
    if (!line.startsWith('            ')) break;
    lines.push(line.slice(12));
  }
  if (lines.length !== SOURCE_CONTRACT_CHECKS.length) throw new Error('Source contract check cardinality changed.');
  return lines.join('\n');
}

export function planSourceContracts(manifest) {
  if (typeof manifest !== 'string') throw new Error('Original source contract manifest required.');
  const commands = manifest.trimEnd().split(/\r?\n/);
  if (commands.length !== SOURCE_CONTRACT_CHECKS.length ||
      commands.some((command, index) => command !== SOURCE_CONTRACT_CHECKS[index])) {
    throw new Error('Source contract manifest changed, missing or reordered: fail closed.');
  }
  const scripts = commands.map((command) => command.slice('node '.length));
  if (new Set(scripts).size !== SOURCE_CONTRACT_CHECKS.length ||
      scripts.some((script) => !/^scripts\/[a-z0-9-]+-check\.mjs$/.test(script) || !existsSync(script))) {
    throw new Error('Missing, duplicate or invalid source contract script mapping.');
  }
  return { schema: 'ywi.build537.source-contract-lane.v1', commands, scripts,
    retainedChecks: scripts.length, workers: SOURCE_CONTRACT_WORKERS };
}

async function execute(plan) {
  let next = 0;
  let failed = false;
  const results = new Array(plan.scripts.length);
  async function worker() {
    while (!failed && next < plan.scripts.length) {
      const index = next++;
      const script = plan.scripts[index];
      console.log(`Build 537 retained source contract ${index + 1}/${plan.scripts.length}: ${script}`);
      const status = await new Promise((resolveStatus) => {
        const child = spawn(process.execPath, [script], { stdio: 'inherit', shell: false });
        let resolved = false;
        const finish = (code) => { if (!resolved) { resolved = true; resolveStatus(code); } };
        child.once('error', () => finish(1));
        child.once('close', (code, signal) => finish(signal || code !== 0 ? 1 : 0));
      });
      results[index] = status;
      if (status !== 0) {
        failed = true;
        console.error(`Build 537 required source contract FAILED: ${script}`);
      }
    }
  }
  await Promise.all(Array.from({ length: SOURCE_CONTRACT_WORKERS }, () => worker()));
  const completed = results.filter((entry) => entry === 0).length;
  if (failed || completed !== plan.scripts.length) {
    throw new Error(`Source contract group HOLD: ${completed}/${plan.scripts.length} successful; no gate waiver.`);
  }
  console.log(`Build 537: all ${completed} retained source contract checks passed across ${SOURCE_CONTRACT_WORKERS} workers.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--list')) {
    throw new Error('Unsupported source contract lane invocation.');
  }
  const plan = planSourceContracts(process.env.YWI_SOURCE_CONTRACT_COMMAND_MANIFEST);
  if (process.argv[2] === '--list') console.log(JSON.stringify(plan));
  else await execute(plan);
}
