#!/usr/bin/env node
/** One bounded Playwright process per original source-checks hotspot batch.
 * Every prior suite is retained; failures and missing mappings stop the gate.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const HOTSPOT_BATCHES = Object.freeze({
  '17': Object.freeze(Array.from({ length: 10 }, (_, index) => 495 + index)),
  '18': Object.freeze(Array.from({ length: 10 }, (_, index) => 505 + index)),
  '19': Object.freeze(Array.from({ length: 10 }, (_, index) => 515 + index)),
});

export function planHotspotBatch(id, packageJson = JSON.parse(readFileSync('package.json', 'utf8'))) {
  if (!Object.hasOwn(HOTSPOT_BATCHES, id)) throw new Error('Unknown Build 533 browser batch; fail closed.');
  const paths = HOTSPOT_BATCHES[id].map((build) => {
    const file = `tests/browser/build${build}.spec.mjs`;
    const expected = `playwright test --config=playwright.config.mjs ${file}`;
    if (packageJson.scripts?.[`test:browser:build${build}`] !== expected || !existsSync(file)) {
      throw new Error(`Build ${build} browser contract changed or suite missing; refuse consolidation.`);
    }
    return file;
  });
  if (new Set(paths).size !== paths.length) throw new Error('Duplicate browser suite in hotspot batch.');
  return {
    id,
    suites: paths,
    argv: ['--no-install', 'playwright', 'test', '--config=playwright.config.mjs', '--workers=1', ...paths],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , batch, action] = process.argv;
  if (process.argv.length > 4 || (action && action !== '--list')) throw new Error('Unsupported browser batch arguments.');
  const plan = planHotspotBatch(batch);
  if (action === '--list') {
    console.log(JSON.stringify(plan));
  } else {
    const result = spawnSync('npx', plan.argv, { stdio: 'inherit', shell: false });
    if (result.error) throw result.error;
    process.exitCode = result.status === null ? 1 : result.status;
  }
}
