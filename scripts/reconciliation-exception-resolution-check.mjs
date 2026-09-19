import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const ops=read('supabase/functions/operations-manage/index.ts');
const ui=read('js/operations-cockpit.js');
const browser=read('tests/browser/reconciliation-exception-resolution.spec.mjs');
const help=read('help.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');

for(const token of [
  'RECONCILIATION_EXCEPTION_BUILD = 315',
  'reconciliation_exceptions: reconciliationExceptions',
  'exception_update',
  'exception_resolve',
  'exception_severity',
  'exception_category',
  'owner_profile_id',
  'evidence_reference',
  'resolution_reason',
  'finance_readiness_blocker',
  'month_end_close_blocker',
  'posting_execution_authorized: false',
  'provider_mutation: false'
]) assert.ok(ops.includes(token),`Build 315 endpoint missing: ${token}`);

for(const token of [
  'Build 315 — Reconciliation Exception Resolution',
  'oc_recon_exception_form',
  'oc_recon_exception_queue',
  'Own / classify',
  'Finance readiness and month-end close',
  'exception_severity',
  'exception_category',
  'evidence_reference',
  'resolution_reason'
]) assert.ok(ui.includes(token),`Build 315 UI missing: ${token}`);

assert.ok(!ui.includes("action:'execute_posting'"),'Build 315 Operations UI must not expose posting execution.');
assert.ok(!ui.includes('provider_mutation:true'),'Build 315 Operations UI must not enable provider mutation.');
assert.ok(browser.includes('material unresolved exception')&&browser.includes('exception_resolve'),'Build 315 rendered acceptance must cover blockers and resolution.');
assert.equal(pkg.scripts['test:reconciliation-exception-resolution'],'node scripts/reconciliation-exception-resolution-check.mjs');
assert.equal(pkg.scripts['test:browser:reconciliation-exception-resolution'],'playwright test --config=playwright.config.mjs tests/browser/reconciliation-exception-resolution.spec.mjs');
assert.ok(workflow.includes('npm run test:reconciliation-exception-resolution'),'Canonical source workflow must run Build 315 source acceptance.');
assert.ok(workflow.includes('npm run test:browser:reconciliation-exception-resolution'),'Canonical rendered workflow must run Build 315 browser acceptance.');
assert.ok(help.includes('Reconciliation Exception Resolution')&&help.includes('Build 315'),'Help must document Build 315.');
console.log('Build 315 Reconciliation Exception Resolution source acceptance: PASS');
