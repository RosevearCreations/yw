import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const directory=read('supabase/functions/jobs-directory/index.ts');
const jobs=read('js/jobs-ui.js');
const browser=read('tests/browser/job-cost-profitability-closeout.spec.mjs');
const help=read('help.html');
const next=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');

for(const token of [
  'function buildJobProfitabilityCloseout',
  'job_profitability_closeout',
  'jobProfitabilityEvents',
  'jobInvoicePostingLinks',
  'v_work_order_execution_cost_dashboard',
  'labour_entry_count',
  'financial_event_count',
  'approved_execution_proof_count',
  'posted_invoice_count',
  'payment_application_count',
  'estimated_revenue_total',
  'actual_revenue_total',
  'invoiced_total',
  'collected_total',
  'labour_cost_total',
  'material_cost_total',
  'equipment_cost_total',
  'fuel_cost_total',
  'travel_cost_total',
  'subcontract_cost_total',
  'disposal_cost_total',
  'rework_cost_total',
  'actual_profit_total',
  'actual_margin_percent',
  'revenue_variance_total',
  'cost_variance_total',
  'profit_variance_total',
  'internal_only: true',
  'posting_execution_authorized: false',
  'provider_mutation: false'
]) assert.ok(directory.includes(token),`Build 318 directory aggregation missing: ${token}`);

assert.ok(directory.includes("cost_category,cost_amount,revenue_amount"),'Build 318 must preserve job-financial-event cost-category provenance.');
assert.ok(directory.includes("String(row?.cost_category || '').toLowerCase() === category"),'Build 318 must recognize explicit rework cost category.');
assert.ok(directory.includes("eventCost(['fuel'])")&&directory.includes("eventCost(['travel'])")&&directory.includes("eventCost(['disposal'])"),'Landscaping operating cost buckets must be explicit.');
assert.ok(directory.includes("eventCost(['equipment_usage','equipment_repair','equipment_replacement'])"),'Equipment usage/repair/replacement must roll into profitability.');
assert.ok(directory.includes("job_profitability_closeout:[]"),'Finance redaction must hide Build 318 profitability from Jobs-only users.');

for(const token of [
  'Landscaping Job Cost & Profitability Closeout',
  'Build 318 joins quote/actual revenue',
  'job_profitability_closeout_table',
  'jobProfitabilityCloseout',
  'Internal Finance data only',
  'Invoiced $',
  'Collected $',
  'Equipment $',
  'Fuel $',
  'Travel $',
  'Disposal $',
  'Subcontract $',
  'Rework $',
  'Profit $',
  'Margin ',
  'Revenue Δ',
  'Cost Δ',
  'Profit Δ'
]) assert.ok(jobs.includes(token),`Build 318 Jobs UI missing: ${token}`);

assert.ok(!jobs.includes('customer_profitability_closeout_table'),'Build 318 must not create a customer-facing profitability table.');
assert.ok(browser.includes('Build 318 renders landscaping profitability closeout only from Finance-authorized directory data'),'Rendered acceptance must prove the internal closeout surface.');
assert.ok(browser.includes('No Finance-authorized Build 318 profitability closeout rows'),'Rendered acceptance must prove fail-closed redaction behavior.');

assert.equal(pkg.scripts['test:job-cost-profitability-closeout'],'node scripts/job-cost-profitability-closeout-check.mjs');
assert.equal(pkg.scripts['test:browser:job-cost-profitability-closeout'],'playwright test --config=playwright.config.mjs tests/browser/job-cost-profitability-closeout.spec.mjs');
assert.ok(workflow.includes('npm run test:job-cost-profitability-closeout'),'Canonical source workflow must run Build 318 source acceptance.');
assert.ok(workflow.includes('npm run test:browser:job-cost-profitability-closeout'),'Canonical browser workflow must run Build 318 rendered acceptance.');
assert.ok((help.includes('Job Cost &amp; Profitability Closeout')||help.includes('Job Cost & Profitability Closeout'))&&help.includes('318'),'Help must document Build 318.');
assert.ok(next.includes('319 — Landscaping Finance Dashboard & Cash Position'),'Roadmap must preserve the next landscaping build after 318.');
assert.ok(!fs.readdirSync('sql').some((name)=>/^209_/.test(name)),'Build 318 must remain schema-neutral at Schema 208.');

const customerPortal=read('js/customer-portal.js');
for(const secret of ['labour_cost_total','material_cost_total','equipment_cost_total','actual_profit_total','actual_margin_percent','profit_variance_total']){
  assert.ok(!customerPortal.includes(`row.${secret}`),`Customer portal must not render internal Build 318 field ${secret}`);
}

assert.ok(!/execution_release_enabled\s*[:=]\s*true/i.test(directory),'Build 318 must not enable Finance posting execution.');
assert.ok(!/provider_mutation(?:_enabled)?\s*[:=]\s*true/i.test(directory),'Build 318 must not enable provider/payment mutation.');

console.log('Build 318 Job Cost & Profitability Closeout source acceptance: PASS');
