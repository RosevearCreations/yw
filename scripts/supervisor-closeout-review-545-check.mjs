import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/operations-cockpit.js', 'utf8');
const runtime = { addEventListener() {} };
vm.runInNewContext(source, {
  window:runtime, document:{ addEventListener() {} },
  MutationObserver:class { observe() {} }, console
}, { filename:'operations-cockpit.js' });
const { reviewLane, reviewChecks } = runtime.YWICloseoutReview545;

assert.equal(reviewLane({ closeout_status:'submitted' }), 'needs_review');
assert.equal(reviewLane({ closeout_status:'rework_required' }), 'rework');
assert.equal(reviewLane({ closeout_status:'rejected' }), 'rework');
assert.equal(reviewLane({ closeout_status:'approved', customer_signoff_required:true, customer_signoff_status:'requested' }), 'waiting_customer');
assert.equal(reviewLane({ closeout_status:'invoice_ready' }), 'complete');
const noProof = reviewChecks({ approved_proof_count:0, before_count:0, after_count:0, customer_summary:'Completed visit.' });
assert.equal(noProof[0].kind, 'block', 'Known zero approved proof must block client approval');
assert.equal(noProof.find((item) => item.note.includes('optional')).kind, 'advisory', 'Gallery must remain optional');
const unknown = reviewChecks({ approved_proof_count:null });
assert.equal(unknown[0].kind, 'review', 'Missing proof counts cannot become a fabricated zero or approval');
assert.equal(reviewChecks({approved_proof_count:1, customer_summary:'Done.', before_count:1, after_count:1, submitted_proof_count:2 }).at(-1).kind, 'review');

for (const expected of [
  'data-oc-closeout-rework-form', 'data-oc-permission="work_order_closeout_decision"',
  "capability?.permitted !== true", "row.closeout_status !== 'submitted'",
  "if (!window.confirm(`Record rework", "decision:'rework'", "decision_note:note",
  "closeoutReworkOpenId = ''", "data-oc-closeout-lane", "closeoutReviewQuery",
  "esc(row.rejection_reason || row.customer_change_request_note)",
  "No approved execution proof", "Gallery images are optional",
  'Customer signoff is pending'
]) {
  assert.ok(source.includes(expected), 'Missing supervised closeout contract: ' + expected);
}
const sql = fs.readFileSync('sql/158_supervisor_closeout_customer_signoff_invoice_followup.sql', 'utf8');
assert.ok(sql.includes("if v_rank < 30 then"), 'Server supervisor decision rank must remain enforced');
assert.ok(sql.includes("if v_decision in ('reject','rework') and v_note is null then"), 'Server must require a rework reason');
assert.ok(sql.includes("if v_decision in ('approve','invoice_ready') and v_approved_proof_count = 0 then"), 'Proof requirement remains server authoritative');
assert.ok(sql.includes("if v_package.customer_signoff_required and v_package.customer_signoff_status <> 'signed' then"), 'Invoice readiness retains customer signoff gate');
console.log('YW 545 supervisor closeout triage, rework reasons and server authority contract GREEN');
