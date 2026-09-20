import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const exporter=read('supabase/functions/accountant-export/index.ts');
const jobs=read('js/jobs-ui.js');
const api=read('js/api.js');
const browser=read('tests/browser/accountant-export-package-v2.spec.mjs');
const help=read('help.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');

for(const token of [
  'const BUILD = 317',
  'const SCHEMA = 159',
  'const SOURCE_SCHEMA = 208',
  'const PACKAGE_VERSION = 2',
  "const BUCKET = 'accountant-exports'",
  "action === 'download'",
  "['prepare','prepare_v2'].includes(action)",
  'Build 317 package v2 requires an accounting period close row',
  'evaluateMonthEndCloseCockpit',
  'source_query_counts',
  'source_query_truncation_possible',
  'private_storage_bucket',
  'posting_execution_authorized: false',
  'provider_mutation: false',
  'jobs_writeback: false',
  'createSignedUrl',
  "bundle_kind:'management_close_bundle'"
]) assert.ok(exporter.includes(token),`Build 317 exporter missing: ${token}`);

for(const filename of [
  'trial-balance-through-period-end.csv',
  'gl-detail-period.csv',
  'journal-batches-period.csv',
  'ar-invoice-register-through-period-end.csv',
  'ar-aging-current-for-period-documents.csv',
  'ar-aging-summary-current.csv',
  'ap-bill-register-through-period-end.csv',
  'ap-aging-current-for-period-documents.csv',
  'ap-aging-summary-current.csv',
  'payment-actions-period.csv',
  'bank-reconciliation-summary.csv',
  'unresolved-reconciliation-exceptions.csv',
  'sales-tax-schedule.csv',
  'payroll-remittance-schedule.csv',
  'account-mapping-review.csv',
  'account-mapping-exceptions.csv',
  'posting-exceptions-period.csv',
  'close-reopen-state.csv',
  'close-cockpit.json',
  'manifest.json',
  'README.txt'
]) assert.ok(exporter.includes(filename),`Build 317 ZIP missing ${filename}`);

for(const source of [
  'gl_journal_entries',
  'chart_of_accounts',
  'v_ar_invoice_aging_detail',
  'v_ap_bill_aging_detail',
  'v_bank_reconciliation_summary',
  'v_sales_tax_filing_review_directory',
  'v_payroll_remittance_review_directory',
  'v_finance_account_mapping_review_directory',
  'v_finance_job_completion_operational_lifecycle',
  'accounting_period_closes'
]) assert.ok(exporter.includes(source),`Build 317 exporter missing source ${source}`);

assert.ok(exporter.includes('Current balance/aging at generation')&&exporter.includes('not reconstructed historical aging'),'A/R-A/P aging limitation must be explicit.');
assert.ok(exporter.includes('accountant_package_export_id')&&exporter.includes('close_package_manifest'),'Generated package must link back to the period close.');
assert.ok(!/execution_enabled\s*[:=]\s*true/i.test(exporter),'Build 317 must not enable Finance posting execution.');
assert.ok(!/provider_mutation(?:_enabled)?\s*[:=]\s*true/i.test(exporter),'Build 317 must not enable provider/payment mutation.');

for(const token of [
  'job_generate_accountant_package_v2',
  'Generate Accountant Package v2',
  'generateAccountantClosePackageV2',
  "action:'prepare_v2'",
  'period_close_id:row.id',
  'api.accountantExport',
  'Build 317 accountant package v2 generated',
  'Private signed download opened'
]) assert.ok(jobs.includes(token),`Build 317 Jobs UI missing: ${token}`);

assert.ok(api.includes('async function accountantExport(payload = {})'),'Existing authenticated accountant-export API wrapper must be reused.');
assert.ok(browser.includes('Generate Accountant Package v2')&&browser.includes("action:'prepare_v2'"),'Rendered Build 317 acceptance must exercise period package generation.');
assert.equal(pkg.scripts['test:accountant-export-package-v2'],'node scripts/accountant-export-package-v2-check.mjs');
assert.equal(pkg.scripts['test:browser:accountant-export-package-v2'],'playwright test --config=playwright.config.mjs tests/browser/accountant-export-package-v2.spec.mjs');
assert.ok(workflow.includes('npm run test:accountant-export-package-v2'),'Canonical source workflow must run Build 317 source acceptance.');
assert.ok(workflow.includes('npm run test:browser:accountant-export-package-v2'),'Canonical browser workflow must run Build 317 browser acceptance.');
assert.ok(help.includes('Accountant Export Package v2')&&help.includes('Build 317'),'Help must document Build 317.');
assert.ok(!fs.readdirSync('sql').some((name)=>/^317[_-]/.test(name)),'Build 317 itself remains schema-neutral; later roadmap builds may advance the schema.');

console.log('Build 317 Accountant Export Package v2 source acceptance: PASS');
