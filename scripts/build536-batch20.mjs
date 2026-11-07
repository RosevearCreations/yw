#!/usr/bin/env node
/** Build 536 — reduce three warm-run Playwright processes to one while keeping
 * the original three browser scripts as authenticated execution inputs.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HASH = '6c145b7038a432f9945380613171bb7ac8ca81b3964b3961644aec5ee2b14650';
const EXECUTION_MARKER = '          YWI_WARM_BATCH20_MANIFEST: |\n';
export function manifestFromWorkflow(workflow) {
  if (typeof workflow !== 'string' || workflow.split(EXECUTION_MARKER).length !== 2) {
    throw new Error('Missing or duplicate Build 536 warm batch manifest.');
  }
  const lines = [];
  for (const line of workflow.split(EXECUTION_MARKER)[1].split('\n')) {
    if (!line.startsWith('            ')) break;
    lines.push(line.slice(12));
  }
  if (lines.length !== 3) throw new Error('Build 536 original warm batch cardinality changed.');
  return lines.join('\n');
}
export function planWarmBatch20(manifest, pkg = JSON.parse(readFileSync('package.json', 'utf8'))) {
  if (typeof manifest !== 'string') throw new Error('Original batch-20 manifest is required.');
  const commands = manifest.trim().split(/\r?\n/).map((line) => line.trim());
  if (commands.length !== 3 || createHash('sha256').update(commands.join('\n')).digest('hex') !== HASH) {
    throw new Error('Original warm batch manifest changed or omitted: fail closed.');
  }
  const suites = commands.map((command) => {
    if (!/^npm run test:browser:[a-z0-9-]+$/.test(command)) throw new Error('Unsafe browser command.');
    const script = command.slice('npm run '.length);
    const actual = pkg.scripts?.[script];
    const match = /^playwright test --config=playwright\.config\.mjs (tests\/browser\/[a-z0-9-]+\.spec\.mjs)$/.exec(actual ?? '');
    if (!match || !existsSync(match[1])) throw new Error(`Browser test mapping missing or drifted: ${script}`);
    return match[1];
  });
  if (new Set(suites).size !== 3) throw new Error('Duplicate warm batch suite.');
  return { schema: 'ywi.build536.warm-batch20-plan.v1', commands, suites,
    argv: ['--no-install', 'playwright', 'test', '--config=playwright.config.mjs', '--workers=1', ...suites] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv[2];
  if (process.argv.length > 3 || (mode && mode !== '--list')) throw new Error('Invalid batch-20 invocation.');
  const plan = planWarmBatch20(process.env.YWI_WARM_BATCH20_MANIFEST);
  if (mode === '--list') console.log(JSON.stringify(plan));
  else {
    const result = spawnSync('npx', plan.argv, { stdio: 'inherit', shell: false });
    if (result.error) throw result.error;
    process.exitCode = result.status === null ? 1 : result.status;
  }
}
