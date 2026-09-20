import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const helper=read('supabase/functions/_shared/month-end-close-cockpit.ts');
const admin=read('supabase/functions/admin-manage/index.ts');
const operations=read('supabase/functions/operations-manage/index.ts');
const jobs=read('js/jobs-ui.js');
const finance=read('js/admin-finance-workspace.js');
const browser=read('tests/browser/month-end-close-cockpit.spec.mjs');
const help=read('help.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');

for(const token of [
  'MONTH_END_CLOSE_BUILD = 316',
  'evaluateMonthEndCloseCockpit',
  'ready_for_hard_lock',
  'payment_exceptions',
  'account_mappings',
  'journal_review',
  'material_reconciliation_exceptions',
  'provider_settlement_exceptions',
  'accountant_export',
  'Open A/R balance context',
  'Open A/P balance context',
  'posting_execution_authorized: false',
  'provider_mutation: false'
]) assert.ok(helper.includes(token),`Build 316 gate helper missing: ${token}`);

for(const token of [
  'evaluateMonthEndCloseCockpit',
  "action === 'preview_close'",
  "action === 'lock' || action === 'close'",
  'MONTH_END_CLOSE_BLOCKED',
  'currentCockpit.ready_for_hard_lock !== true',
  'MONTH_END_REOPEN_REASON_REQUIRED',
  'explicit reason of at least 8 characters',
  'month_end_close_cockpit',
  'posting_execution_authorized:false',
  'provider_mutation:false'
]) assert.ok(admin.includes(token),`Build 316 admin authority missing: ${token}`);

assert.ok(admin.includes("const isDecision = /(approve|review|finalize|finalise|close|lock|reopen|verify|resolve|signoff|release|post)/"),'Close/lock/reopen must require Finance decision authority.');
assert.ok(!admin.includes("body.reopen_reason || body.notes || 'Reopened from Admin.'"),'Legacy generic reopen reason fallback must be removed.');

for(const token of [
  "action:'preview_close'",
  'cockpit.ready_for_hard_lock !== true',
  'Hard lock blocked by',
  'Reopen reason (required, at least 8 characters)',
  'Build 316 close authority'
]) assert.ok(jobs.includes(token),`Build 316 Jobs close UX missing: ${token}`);

for(const token of [
  'MONTH_END_CLOSE_BUILD = 316',
  'Month-End Close Cockpit',
  'HARD LOCK BLOCKED',
  'READY FOR SERVER PREVIEW',
  'Provider settlement exceptions',
  'Posting into locked periods remains rejected',
  'Reopening requires Finance approval plus a recorded reason'
]) assert.ok(finance.includes(token),`Build 316 Finance cockpit missing: ${token}`);

assert.ok(!/(YWIAPI|supabase|jsonFetch|manageAdminEntity|fetch\s*\()/i.test(finance),'Build 316 Finance presentation must remain presentation-only.');

for(const token of [
  'async function assertPeriodOpen',
  "in('close_status', ['in_review', 'closed'])",
  'is locked for',
]) assert.ok(operations.includes(token),`Locked-period posting enforcement missing: ${token}`);

assert.ok(browser.includes('Month-End Close Cockpit')&&browser.includes('HARD LOCK BLOCKED'),'Build 316 rendered acceptance must cover ready and blocked close states.');
assert.equal(pkg.scripts['test:month-end-close-cockpit'],'node scripts/month-end-close-cockpit-check.mjs');
assert.equal(pkg.scripts['test:browser:month-end-close-cockpit'],'playwright test --config=playwright.config.mjs tests/browser/month-end-close-cockpit.spec.mjs');
assert.ok(workflow.includes('npm run test:month-end-close-cockpit'),'Canonical source workflow must run Build 316 source acceptance.');
assert.ok(workflow.includes('npm run test:browser:month-end-close-cockpit'),'Canonical rendered workflow must run Build 316 browser acceptance.');
assert.ok(help.includes('Month-End Close Cockpit')&&help.includes('Build 316'),'Help must document Build 316.');
assert.ok(!fs.readdirSync('sql').some((name)=>/^316[_-]/.test(name)),'Build 316 itself remains schema-neutral; later roadmap builds may advance the schema.');

console.log('Build 316 Month-End Close Cockpit source acceptance: PASS');
