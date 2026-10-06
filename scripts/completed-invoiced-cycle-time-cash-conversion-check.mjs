#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const directory=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-owner-management-command-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const review=read('docs/production_learning_review_362.json');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(directory,[
  'function buildCompletedToInvoicedCashConversion',
  "safeListEvidence(supabase,'job_invoice_candidates','*','created_at'",
  "completed_invoiced_cash_conversion:buildManagementMetricConfidence(sourceFreshness,['production','closeouts','invoice_candidates','receivables','payment_applications'])",
  'completed_to_invoiced_cycle_time_cash_conversion:completedToInvoicedCashConversion',
  'completion_to_invoice_ready_hours','invoice_ready_to_invoice_hours','completion_to_invoice_hours',
  'invoice_to_first_payment_days','invoice_to_collection_days','completion_to_collection_days',
  'fully_collected_with_payment_evidence','aging_cohorts','current_stage_age_bucket',
  "currentStage='completed_not_invoice_ready'",
  "currentStage='invoice_ready_not_invoiced'",
  "currentStage='invoiced_open'",
  "currentStage='collected'",
  "completion_boundary:'Completion time uses the latest recorded Production session explicitly carrying completed evidence.",
  "closeout_boundary:'Approved closeout time uses recorded closeout approved_at only.",
  "invoice_readiness_boundary:'Invoice readiness time uses the recorded job_invoice_candidates created_at event.",
  "invoice_boundary:'Invoice creation time uses recorded A/R invoice created_at",
  "payment_boundary:'Payment timing uses recorded payment-application evidence.",
  "aging_boundary:'Aging buckets are descriptive elapsed-time cohorts",
  "authority_boundary:'Read-only cash-conversion evidence only."
],'Build 368 server');

must(ui,[
  'Completed-to-invoiced cycle-time &amp; cash conversion',
  'owner368CashCycle','renderCompletedCashConversion',
  "state.data?.completed_to_invoiced_cycle_time_cash_conversion",
  "metricMeta('completed_invoiced_cash_conversion')",
  'Completed / approved','Invoice ready','Invoiced','Collected',
  'Completion → invoice','Invoice → collection',
  'Aging cohorts','Recorded cycle traces','Timing and authority boundaries',
  'Timing evidence only:','renderCompletedCashConversion();'
],'Build 368 UI');

must(review,[
  '"item": 368',
  '"title": "Completed-to-Invoiced Cycle-Time & Cash Conversion"'
],'Build 362 learning authority for 368');

assert.equal(pkg.scripts['test:completed-invoiced-cycle-time-cash-conversion'],'node scripts/completed-invoiced-cycle-time-cash-conversion-check.mjs');
assert.equal(pkg.scripts['test:browser:completed-invoiced-cycle-time-cash-conversion'],'playwright test --config=playwright.config.mjs tests/browser/completed-invoiced-cycle-time-cash-conversion.spec.mjs');
must(workflow,[
  'npm run test:completed-invoiced-cycle-time-cash-conversion',
  'npm run test:browser:completed-invoiced-cycle-time-cash-conversion'
],'Build 368 CI');

must(help,[
  'Build 368 — Completed-to-Invoiced Cycle-Time &amp; Cash Conversion',
  'Recorded milestones only','Cash conversion needs payment evidence',
  'Aging cohorts are descriptive','Missing evidence stays missing','Read-only authority'
],'Build 368 help');

must(roadmap,[
  '#### **368 — Completed-to-Invoiced Cycle-Time & Cash Conversion** is implemented',
  'The next planned autonomous item is **369 — Labour Capture Completeness & Payroll Exception Reduction**.'
],'Build 368 roadmap');

must(handbook,[
  '**368 — Completed-to-Invoiced Cycle-Time & Cash Conversion** is implemented',
  '- **369 — Labour Capture Completeness & Payroll Exception Reduction**',
  'After item 368, that item is 369 — Labour Capture Completeness & Payroll Exception Reduction.'
],'Build 368 handoff');

const start=directory.indexOf('function buildCompletedToInvoicedCashConversion');
const end=directory.indexOf('function buildLabourEquipmentFleetUtilizationDecisionSupport',start);
const b368=directory.slice(start,end);
assert.ok(b368.length>2500,'Build 368 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b368),'Build 368 helper must remain read-only');
assert.ok(!b368.includes('send_collection_message'));
assert.ok(!b368.includes('auto_create_invoice'));
assert.ok(!b368.includes('apply_payment'));
assert.ok(!b368.includes('post_journal'));

console.log('Build 368 Completed-to-Invoiced Cycle-Time & Cash Conversion source gate GREEN');
