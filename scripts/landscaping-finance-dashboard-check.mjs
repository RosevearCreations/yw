import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const finance=read('js/finance-ui.js');
const admin=read('supabase/functions/admin-directory/index.ts');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const next=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');

for (const token of [
  'Landscaping Finance Dashboard &amp; Cash Position',
  'Cash / bank position',
  'Receivables',
  'Vendor / A/P commitments',
  'Tax / payroll readiness',
  'Gross margin',
  'Profitability exceptions',
  'Seasonal comparison',
  'Cash-position boundary'
]) assert.ok(finance.includes(token), `Finance UI missing Build 319 token: ${token}`);

for (const source of [
  "v_bank_reconciliation_summary",
  "v_ar_invoice_aging_detail",
  "v_ap_bill_aging_detail",
  "v_accounting_payment_application_dashboard",
  "bank_accounts"
]) assert.ok(admin.includes(source), `Accounting fast path missing ${source}`);

assert.ok(finance.includes("jsonFetch?.('jobs-directory'"), 'Build 319 must consume existing Build 318 job-profitability authority when available.');
assert.ok(finance.includes("state.jobsError"), 'Jobs-profitability failure must degrade without hiding other Finance evidence.');
assert.ok(finance.includes('this dashboard is read-only'), 'Dashboard must state its non-mutating boundary.');
assert.ok(!finance.includes('posting_execution_authorized: true'), 'Build 319 must not authorize posting execution.');
assert.ok(!finance.includes('provider_mutation: true'), 'Build 319 must not authorize provider mutation.');
assert.equal(pkg.scripts['test:landscaping-finance-dashboard'],'node scripts/landscaping-finance-dashboard-check.mjs');
assert.equal(pkg.scripts['test:browser:landscaping-finance-dashboard'],'playwright test --config=playwright.config.mjs tests/browser/landscaping-finance-dashboard.spec.mjs');
assert.ok(workflow.includes('npm run test:landscaping-finance-dashboard'));
assert.ok(workflow.includes('npm run test:browser:landscaping-finance-dashboard'));
assert.ok(help.includes('Build 319') && (help.includes('Landscaping Finance Dashboard &amp; Cash Position') || help.includes('Landscaping Finance Dashboard & Cash Position')));
assert.ok(next.includes('320 — Operations Needs Attention'),'Roadmap must advance to Build 320 after 319.');
assert.ok(!fs.readdirSync('sql').some((name)=>/^209_/.test(name)),'Build 319 remains schema-neutral at Schema 208.');

console.log('Build 319 Landscaping Finance Dashboard & Cash Position source gate: PASS');
