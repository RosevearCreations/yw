#!/usr/bin/env node
/** Build 535: preserve all 55 original lane-C browser suites in five bounded
 * Playwright launches. The canonical workflow's command manifest is an
 * execution input, hashed and checked against exact package mappings.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ORIGINAL_SUITE_COUNT = 55;
export const MAX_SUITES_PER_LAUNCH = 11;
export const ORIGINAL_MANIFEST_SHA256 = '5cb593f90a6609205efb5d7eb4e76549b1459543a256b1c878bd51d896a3c9c9';

export function manifestFromWorkflow(workflow) {
  const marker = '          YWI_LANE_C_COMMAND_MANIFEST: |\n';
  if (typeof workflow !== 'string' || workflow.split(marker).length !== 2) {
    throw new Error('Missing or duplicate canonical lane-C execution manifest.');
  }
  const lines = workflow.split(marker)[1].split('\n');
  const entries = [];
  for (const line of lines) {
    if (!line.startsWith('            ')) break;
    entries.push(line.slice(12));
  }
  if (entries.length !== ORIGINAL_SUITE_COUNT) {
    throw new Error('Unexpected number of executable lane-C manifest inputs.');
  }
  return entries.join('\n');
}

export function planLaneC(manifest, pkg = JSON.parse(readFileSync('package.json', 'utf8'))) {
  if (typeof manifest !== 'string') throw new Error('Lane-C command manifest missing: fail closed.');
  const commands = manifest.trim().split(/\r?\n/).map((line) => line.trim());
  const digest = createHash('sha256').update(commands.join('\n')).digest('hex');
  if (commands.length !== ORIGINAL_SUITE_COUNT || digest !== ORIGINAL_MANIFEST_SHA256) {
    throw new Error('Lane-C original command list changed, omitted, reordered or duplicated: fail closed.');
  }
  const suites = commands.map((command) => {
    if (!/^npm run test:browser:[a-z0-9-]+$/.test(command)) {
      throw new Error('Unsafe lane-C manifest command.');
    }
    const npmScript = command.slice('npm run '.length);
    const mapped = pkg.scripts?.[npmScript];
    const match = /^playwright test --config=playwright\.config\.mjs (tests\/browser\/[a-z0-9-]+\.spec\.mjs)$/.exec(mapped ?? '');
    if (!match || !existsSync(match[1])) {
      throw new Error(`Missing, drifted or unsafe original browser mapping: ${npmScript}`);
    }
    return match[1];
  });
  if (new Set(suites).size !== ORIGINAL_SUITE_COUNT) {
    throw new Error('Lane-C duplicated browser suite: fail closed.');
  }
  const batches = Array.from({ length: Math.ceil(suites.length / MAX_SUITES_PER_LAUNCH) }, (_, i) => {
    const specs = suites.slice(i * MAX_SUITES_PER_LAUNCH, (i + 1) * MAX_SUITES_PER_LAUNCH);
    return {
      batch: i + 1, specs,
      argv: ['--no-install', 'playwright', 'test', '--config=playwright.config.mjs', '--workers=1', ...specs],
    };
  });
  if (batches.length !== 5 || batches.some(({ specs }) => specs.length !== 11)) {
    throw new Error('Lane-C batch capacity drift: fail closed.');
  }
  return { schema: 'ywi.build535.lane-c-plan.v1', commands, suites, batches, digest };
}

function summarize(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`, 'utf8');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv[2];
  if (process.argv.length > 3 || (mode && mode !== '--list')) throw new Error('Invalid lane-C invocation.');
  const plan = planLaneC(process.env.YWI_LANE_C_COMMAND_MANIFEST);
  if (mode === '--list') {
    console.log(JSON.stringify(plan));
  } else {
    summarize(`Build 535 lane C: validating ${plan.suites.length} original suites in ${plan.batches.length} isolated single-worker batches.`);
    for (const batch of plan.batches) {
      const started = Date.now();
      const result = spawnSync('npx', batch.argv, { stdio: 'inherit', shell: false });
      const elapsed = Math.round((Date.now() - started) / 1000);
      summarize(`Build 535 lane-C batch ${batch.batch}/${plan.batches.length}: ${batch.specs.length} suites, ${elapsed}s, ${result.status === 0 ? 'PASS' : 'FAIL'}.`);
      if (result.error) throw result.error;
      if (result.status !== 0) {
        process.exitCode = result.status || 1;
        break; // Never skip a failed batch or run a later batch after failure.
      }
    }
  }
}
