#!/usr/bin/env node
/** Build 534 — single-process execution of the exact retained browser tail.
 * Preserve every spec, explicit order, Playwright configuration, and failure.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TAIL_BATCHES = Object.freeze({
  '21': Object.freeze([
    'pms-owner-renewal-reviewer-followup-476',
    'pms-owner-reviewer-followup-477',
    'management-outcome-confidence-cohort-trend',
    'workability-forecast-recovery-calibration',
    'contextual-help',
    'management-decision-outcome-journal',
    'workability-schedule-recovery-outcomes',
    'profile-reference-lifecycle',
    'workspace-organization',
    'performance-budgets',
  ]),
  '22': Object.freeze([
    'finance', 'finance-mapping', 'it', 'equipment-scan',
    'staging-acceptance', 'direct:staging-infrastructure-readiness',
    'admin-account-security', 'help-seo',
  ]),
});
const SPEC_ALIASES = Object.freeze({
  'performance-budgets': 'application-performance-budget',
  finance: 'finance-release-hardening',
  'finance-mapping': 'finance-account-mapping-review',
  it: 'it-scorecard-truth',
  'equipment-scan': 'equipment-scanner',
  'help-seo': 'help-seo-layout',
});

export function planTailBatch(id, pkg = JSON.parse(readFileSync('package.json', 'utf8'))) {
  if (!Object.hasOwn(TAIL_BATCHES, id)) throw new Error('Unrecognized Build 534 tail batch: fail closed.');
  const suites = TAIL_BATCHES[id].map((script) => {
    if (script === 'direct:staging-infrastructure-readiness') {
      const path = 'tests/browser/staging-infrastructure-readiness.spec.mjs';
      if (!existsSync(path)) throw new Error('Direct staging infrastructure browser suite is missing.');
      return path;
    }
    const file = `tests/browser/${SPEC_ALIASES[script] ?? script}.spec.mjs`;
    const command = pkg.scripts?.[`test:browser:${script}`];
    if (command !== `playwright test --config=playwright.config.mjs ${file}`) {
      throw new Error(`Missing or changed Playwright source mapping for ${script}.`);
    }
    if (!existsSync(file)) {
      throw new Error(`Unsafe or missing mapped browser spec for ${script}.`);
    }
    return file;
  });
  if (new Set(suites).size !== suites.length) throw new Error('Duplicate tail browser suite; fail closed.');
  return {
    id, suites,
    argv: ['--no-install', 'playwright', 'test', '--config=playwright.config.mjs', '--workers=1', ...suites],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , batch, action] = process.argv;
  if (process.argv.length > 4 || (action && action !== '--list')) throw new Error('Invalid tail batch arguments.');
  const plan = planTailBatch(batch);
  if (action === '--list') {
    console.log(JSON.stringify(plan));
  } else {
    const result = spawnSync('npx', plan.argv, { stdio: 'inherit', shell: false });
    if (result.error) throw result.error;
    process.exitCode = result.status === null ? 1 : result.status;
  }
}
