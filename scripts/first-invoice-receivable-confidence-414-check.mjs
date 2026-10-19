import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const backend=read('supabase/functions/admin-directory/index.ts');
const start=backend.indexOf("if (scope === 'first_invoice_receivable_confidence')");
const end=backend.indexOf("if (scope === 'activity_timeline')",start);
assert.ok(start>0 && end>start,'Build 414 dedicated backend scope missing');
const s=backend.slice(start,end),before=backend.slice(0,start);
for(const phrase of [
 "roleRank(actorRole)<roleRank('supervisor')",
 "hasModuleAccess(supabase,actorProfile,'jobs','view')",
 "safeListEvidence(supabase,'v_estimate_job_invoice_workflow'",
 "safeListEvidence(supabase,'work_order_closeout_packages'",
 "safeListEvidence(supabase,'job_invoice_candidates'",
 "safeListEvidence(supabase,'ar_invoices'",
 "safeListEvidence(supabase,'ar_payments'",
 "safeListEvidence(supabase,'v_ar_payment_application_directory'",
 'r.row_count>=r.limit','invoiceState','invoice_not_issued','paid_with_application_verified',
 'receivable_discrepancy_hold','invoice_candidate_missing','issued_invoice_missing',
 'String(p.client_id)!==String(invoice.client_id)','String(i.client_id)!==String(o.client_id)',
 'Math.abs(total-applied-balance)>1','balance===0&&applied>0&&total>0',
 "state:'withheld'","complete:false"
]) assert.ok(s.includes(phrase),'Build 414 evidence guard missing: '+phrase);
assert.ok(before.includes("'first_invoice_receivable_confidence'"),'Finance module permission missing');
assert.doesNotMatch(s,/\.(insert|upsert|update|delete)\s*\(/);
const ui=read('js/first-invoice-receivable-confidence-414.js');
new Function(ui);
for(const phrase of ['receivable414','first_invoice_receivable_confidence',
 'data-receivable414-state','Date.now()-at<=300000','esc(r.invoice_number',
 'No invoice or payment claim available','amount(r.balance_due_cents)'])
 assert.ok(ui.includes(phrase),'Build 414 read-only UI contract missing: '+phrase);
assert.ok(read('index.html').includes('js/first-invoice-receivable-confidence-414.js'));
assert.ok(read('help.html').includes('id="first-invoice-receivable-414"'));
const p=JSON.parse(read('package.json'));
assert.equal(p.scripts['test:first-invoice-receivable-confidence-414'],
 'node scripts/first-invoice-receivable-confidence-414-check.mjs');
assert.ok(p.scripts['test:browser:first-invoice-receivable-confidence-414'].includes(
 'tests/browser/first-invoice-receivable-confidence-414.spec.mjs'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const phrase of ['npm run test:first-invoice-receivable-confidence-414',
 'npm run test:browser:first-invoice-receivable-confidence-414'])
 assert.ok(ci.includes(phrase),'Build 414 CI missing: '+phrase);
console.log('Build 414 source, authority, UI and CI invariants PASS');
