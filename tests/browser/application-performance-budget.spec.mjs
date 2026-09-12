import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const itSource = fs.readFileSync(path.join(process.cwd(), 'js/it-readiness-ui.js'), 'utf8');

function migrationVersionFromFilename(name) {
  const match = String(name || '').match(/^(\d+)_.*\.sql$/i);
  return match ? Number(match[1]) : NaN;
}

const schemaVersions = [...new Set(fs.readdirSync(path.join(process.cwd(),'sql'))
  .map(migrationVersionFromFilename)
  .filter(Number.isInteger))]
  .sort((a,b)=>a-b);
const CURRENT_SCHEMA = schemaVersions.at(-1);
const PREVIOUS_SCHEMA = schemaVersions.at(-2);
if (!Number.isInteger(CURRENT_SCHEMA) || !Number.isInteger(PREVIOUS_SCHEMA) || PREVIOUS_SCHEMA >= CURRENT_SCHEMA) {
  throw new Error('Could not derive the latest two repository schemas for performance browser fixtures.');
}

function section(rows = []) {
  return { rows, error: null, summary: { status: 'passed', total: rows.length, blocking: 0, warning: 0, error: null } };
}

function payload(overrides = {}) {
  const summary = {
    overall_status: 'amber',
    schema_current: true,
    expected_schema_version: CURRENT_SCHEMA,
    latest_applied_schema_version: CURRENT_SCHEMA,
    release_authority_status: 'amber',
    source_gate_status: 'green',
    repository_enforcement_status: 'amber',
    branch_protection_reported: false,
    branch_policy_verified: false,
    source_sha: '1234567890abcdef1234567890abcdef12345678',
    workflow_run_id: 999,
    production_promotion_mode: 'manual_human_promotion_required',
    scorecard_truth_status: 'green',
    scorecard_open_count: 2,
    scorecard_unclassified_open_count: 0,
    scorecard_human_pending_count: 1,
    scorecard_external_pending_count: 1,
    open_rail_acceptance_count: 2,
    active_admin_count: 1,
    admin_access_integrity_blockers: 0,
    readiness_blockers: 0,
    assertion_blockers: 0,
    current_todo_count: 2,
    ...overrides,
  };
  return {
    ok: true,
    interactive_mode: 'bounded_runtime',
    deep_verification_deferred: true,
    source_errors: [],
    summary,
    sections: {
      schema_drift: section([{ drift_status: summary.schema_current ? 'current' : 'behind' }]),
      release_authority: section([{ release_authority_status: summary.release_authority_status }]),
      release_source_evidence: section([{ source_gate_status: summary.source_gate_status }]),
      scorecard_truth_status: section([{ scorecard_truth_status: summary.scorecard_truth_status }]),
      open_rail_acceptance_readiness: section([{ rail_title: 'Staging acceptance', technical_readiness_status: 'pending', current_action: 'Use dedicated non-Production staging.' }]),
      admin_access_integrity: section([{ role: 'admin', profile_label: 'Admin', all_modules_manage: true, safety_access: 'manage', finance_access: 'manage', jobs_access: 'manage', admin_access: 'manage' }]),
      runtime_health: section([]),
      function_readiness: section([]),
      current_admin_todo: section([]),
    },
    security_assertions: { deferred: true, errors: [] },
  };
}

async function mount(page, runtimePayload) {
  await page.setContent('<!doctype html><html><body><main class="container"><section id="admin" class="card"></section></main></body></html>');
  await page.evaluate((data) => {
    window.__itCalls = [];
    window.__itPayload = data;
    window.YWI_AUTH = { getState: () => ({ role: 'admin', isAuthenticated: true }) };
    window.YWIAPI = {
      escHtml: (value) => String(value ?? ''),
      jsonFetch: async (path) => { window.__itCalls.push(path); return window.__itPayload; },
      runSmokeCheck: async () => ({ ok: true, checks: [] }),
    };
  }, runtimePayload);
  await page.addScriptTag({ content: itSource });
  await page.evaluate(() => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.dispatchEvent(new CustomEvent('ywi:route-shown', { detail: { allowed: 'it' } }));
  });
  await expect(page.locator('#releaseDeploymentCockpit')).toBeVisible();
}

test('performance schema fixtures support variable-width and non-contiguous migration versions', async () => {
  expect(migrationVersionFromFilename('999_example.sql')).toBe(999);
  expect(migrationVersionFromFilename('1000_example.sql')).toBe(1000);
  expect(migrationVersionFromFilename('12034_example.sql')).toBe(12034);
  expect(Number.isNaN(migrationVersionFromFilename('schema_1000_example.sql'))).toBe(true);
  expect(PREVIOUS_SCHEMA).toBe(schemaVersions.at(-2));
  expect(PREVIOUS_SCHEMA).toBeLessThan(CURRENT_SCHEMA);
});

test('I.T. release cockpit renders from one bounded runtime request with no deploy action', async ({ page }) => {
  await mount(page, payload());
  await expect(page.locator('#releaseDeploymentCockpit .it-release-stage')).toHaveCount(5);
  await expect(page.locator('#releaseDeploymentCockpit')).toContainText('Release & deployment cockpit');
  await expect(page.locator('#releaseDeploymentCockpit')).toContainText('Source / CI');
  await expect(page.locator('#releaseDeploymentCockpit')).toContainText('Database');
  await expect(page.locator('#releaseDeploymentCockpit')).toContainText('Repository');
  await expect(page.locator('#releaseDeploymentCockpit')).toContainText('Acceptance');
  await expect(page.locator('#releaseDeploymentCockpit')).toContainText('Production promotion');
  await expect(page.locator('#releaseDeploymentCockpit')).toContainText('Verify GitHub repository enforcement');
  await expect(page.locator('#releaseDeploymentCockpit')).toContainText('This cockpit never deploys or promotes');
  await expect(page.locator('#releaseDeploymentCockpit button')).toHaveCount(0);
  expect(await page.evaluate(() => window.__itCalls)).toEqual(['admin-it-readiness-runtime']);
});

test('release cockpit exposes the CI performance budget contract', async ({ page }) => {
  await mount(page, payload());
  await expect(page.locator('#runtimePerformanceBudgets .it-performance-budget')).toHaveCount(6);
  await expect(page.locator('#runtimePerformanceBudgets')).toContainText('30 assets / 21 JS');
  await expect(page.locator('#runtimePerformanceBudgets')).toContainText('Safety ≤ 10');
  await expect(page.locator('#runtimePerformanceBudgets')).toContainText('Finance ≤ 3');
  await expect(page.locator('#runtimePerformanceBudgets')).toContainText('Jobs ≤ 4');
  await expect(page.locator('#runtimePerformanceBudgets')).toContainText('Admin ≤ 8');
  await expect(page.locator('#runtimePerformanceBudgets')).toContainText('I.T. bounded reads ≤ 10');
});

test('schema drift outranks later release work in the next-safe-action cue', async ({ page }) => {
  await mount(page, payload({ schema_current: false, latest_applied_schema_version: PREVIOUS_SCHEMA, repository_enforcement_status: 'green', current_todo_count: 0, open_rail_acceptance_count: 0 }));
  await expect(page.locator('#releaseDeploymentCockpit')).toContainText('Restore exact database schema parity before release work continues');
  expect(await page.evaluate(() => window.__itCalls)).toEqual(['admin-it-readiness-runtime']);
});
