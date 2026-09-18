import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const edge=read('supabase/functions/finance-account-mapping-review/index.ts');
const ui=read('js/finance-account-mapping-ui.js');
const fixture=read('tests/fixtures/finance-account-mapping-review-fixtures.mjs');
const browser=read('tests/browser/account-mapping-posting-preview.spec.mjs');
const help=read('help.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');

for(const token of [
  'v_finance_job_completion_posting_preflight_queue',
  'finance_account_mapping_review_audit',
  'posting_previews: postingPreviewResult.data || []',
  'decision_audit: auditResult.data || []',
  'posting_preview_read_only: true',
  'preview_decision_audit_visible: true',
  'posting_execution_authorized: false',
  'provider_mutation: false'
]) assert.ok(edge.includes(token),`Build 314 endpoint missing: ${token}`);

for(const token of [
  'Account Mapping &amp; Posting Preview',
  'Preview-to-decision audit trail',
  'Reclassify for review',
  'Tax treatment',
  'Proposed only',
  'Posting execution and provider/payment mutation remain OFF',
  'data-posting-preview'
]) assert.ok(ui.includes(token),`Build 314 UI missing: ${token}`);

assert.ok(!ui.includes("action:'execute_posting'"),'Build 314 mapping UI must not expose posting execution.');
assert.ok(!ui.includes('data-finance-execution-release'),'Build 314 mapping UI must not expose release controls.');
assert.ok(fixture.includes('posting_previews:[')&&fixture.includes('decision_audit:['),'Build 314 deterministic fixtures are required.');
assert.ok(browser.includes('read-only posting preview')&&browser.includes('data-mapping-review="review"'),'Build 314 rendered acceptance must cover preview and human reclassification.');
assert.equal(pkg.scripts['test:account-mapping-posting-preview'],'node scripts/account-mapping-posting-preview-check.mjs');
assert.equal(pkg.scripts['test:browser:account-mapping-posting-preview'],'playwright test --config=playwright.config.mjs tests/browser/account-mapping-posting-preview.spec.mjs');
assert.ok(workflow.includes('npm run test:account-mapping-posting-preview'),'Canonical source workflow must run Build 314 source acceptance.');
assert.ok(workflow.includes('npm run test:browser:account-mapping-posting-preview'),'Canonical rendered workflow must run Build 314 browser acceptance.');
assert.ok(help.includes('Account Mapping &amp; Posting Preview')&&help.includes('Build 314'),'Help must document Build 314.');
console.log('Build 314 Account Mapping & Posting Preview source acceptance: PASS');
