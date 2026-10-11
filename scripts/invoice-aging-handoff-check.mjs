import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const s=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
const a=s.indexOf('    function buildInvoiceAgingHandoffReview('),b=s.indexOf('    function renderInvoiceAgingHandoffReview(',a);
assert.ok(a>=0&&b>a);
const fn=vm.runInNewContext(s.slice(a,b)+';buildInvoiceAgingHandoffReview;');
const rows=[
 {work_order_id:'a',current_stage:'invoice_ready_not_invoiced'},
 {work_order_id:'b',current_stage:'invoiced_open',invoice_balance_due:200,current_stage_age_days:9},
 {work_order_id:'c',current_stage:'invoiced_open',invoice_balance_due:100,current_stage_age_days:3},
 {work_order_id:'d',current_stage:'invoiced_open',invoice_balance_due:null,current_stage_age_days:12},
 {work_order_id:'b',current_stage:'invoiced_open',invoice_balance_due:200,current_stage_age_days:9}
];
const r=fn({cycle_records:rows});assert.equal(r.loaded,4);assert.equal(r.ready,1);
assert.equal(r.open,2);assert.equal(r.aged,1);assert.equal(r.unknown_balance,1);
assert.equal(r.recorded_open_balance,300);assert.equal(r.cases.length,2);
assert.ok(s.includes('renderInvoiceAgingHandoffReview(c,meta)'));
assert.ok(fs.readFileSync('help.html','utf8').includes('id="invoice-aging-handoff-receivables-leakage"'));
assert.ok(fs.readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8').includes('383 — Labour Capture Exception Closure & Shift Readiness'));
assert.ok(!/\.(insert|upsert|delete|update)\s*\(/.test(s.slice(a,s.indexOf('    function renderCompletedCashConversion(',b))));
console.log('Build 382 deterministic aging review PASS');
