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
  'function buildLabourCapturePayrollExceptionReduction',
  "labour_capture_payroll_exceptions:buildManagementMetricConfidence(sourceFreshness,['timekeeping_detail','production','dispatch'])",
  'labour_capture_completeness_payroll_exception_reduction:labourCapturePayrollExceptionReduction',
  "captureState='missing_time_capture'",
  "captureState='open_shift'",
  "captureState='correction_pending'",
  "captureState='attendance_review'",
  "captureState='supervisor_approval'",
  'explicit_late_exception_count',
  'exception_rate_change_percentage_points',
  'repeated_patterns:repeatedPatterns.slice(0,80)',
  "matching_boundary:'Coverage is evaluated at recorded job/service-date and crew context where available.",
  "late_boundary:'Late capture is counted only when the canonical payroll evidence explicitly carries a late, missed or untimely exception/review code.",
  "reduction_boundary:'Exception reduction compares the most recent 14 completed calendar days with the preceding 14 completed calendar days.",
  "privacy_boundary:'Returned evidence is aggregated to crew/job/service-date.",
  "safety_boundary:'Safety restrictions and fitness-for-work decisions remain under existing Safety authority",
  "authority_boundary:'Read-only management evidence."
],'Build 369 server');

must(ui,[
  'Labour capture completeness &amp; payroll exception reduction',
  'owner369LabourCapture','renderLabourCapturePayrollExceptions',
  "state.data?.labour_capture_completeness_payroll_exception_reduction",
  "metricMeta('labour_capture_payroll_exceptions')",
  'Payroll-ready coverage','Missing time capture','Open shifts','Corrections / review','Recent exception rate',
  'Recorded exception-rate movement','Repeated crew/job exception patterns','Crew/job/service-date evidence',
  'Matching, lateness, privacy &amp; authority boundaries',
  'Evidence quality, not employee scoring:',
  'renderLabourCapturePayrollExceptions();'
],'Build 369 UI');

must(review,[
  '"item": 369',
  '"title": "Labour Capture Completeness & Payroll Exception Reduction"'
],'Build 362 learning authority for 369');

assert.equal(pkg.scripts['test:labour-capture-payroll-exception-reduction'],'node scripts/labour-capture-payroll-exception-reduction-check.mjs');
assert.equal(pkg.scripts['test:browser:labour-capture-payroll-exception-reduction'],'playwright test --config=playwright.config.mjs tests/browser/labour-capture-payroll-exception-reduction.spec.mjs');
must(workflow,[
  'npm run test:labour-capture-payroll-exception-reduction',
  'npm run test:browser:labour-capture-payroll-exception-reduction'
],'Build 369 CI');

must(help,[
  'Build 369 — Labour Capture Completeness &amp; Payroll Exception Reduction',
  'Completeness is source-bounded','Late means explicitly late','Reduction is descriptive',
  'Privacy is aggregated','Authority remains separate'
],'Build 369 help');

must(roadmap,[
  '#### **369 — Labour Capture Completeness & Payroll Exception Reduction** is implemented',
  'The next planned autonomous item is **370 — Equipment Downtime Cost & Replacement Readiness**.'
],'Build 369 roadmap');

must(handbook,[
  '**369 — Labour Capture Completeness & Payroll Exception Reduction** is implemented',
  '- **370 — Equipment Downtime Cost & Replacement Readiness**',
  'After item 369, that item is 370 — Equipment Downtime Cost & Replacement Readiness.'
],'Build 369 handoff');

const start=directory.indexOf('function buildLabourCapturePayrollExceptionReduction');
const end=directory.indexOf('function buildMaterialsConsumablesSeasonalStockReadiness',start);
const b369=directory.slice(start,end);
assert.ok(b369.length>2500,'Build 369 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b369),'Build 369 helper must remain read-only');
assert.ok(!b369.includes('full_name'),'Build 369 helper must not return individual employee names');
assert.ok(!b369.includes('employee_number'),'Build 369 helper must not return employee numbers');
assert.ok(!b369.includes('employee_explanation'),'Build 369 helper must not return individual explanations');
assert.ok(!b369.includes('supervisor_approval_note'),'Build 369 helper must not return supervisor notes');
assert.ok(!b369.includes('supervisor_approved_by_name'),'Build 369 helper must not return approver names');
assert.ok(!b369.includes('performance_score'));
assert.ok(!b369.includes('rank_employee'));
assert.ok(!b369.includes('approve_payroll'));

console.log('Build 369 Labour Capture Completeness & Payroll Exception Reduction source gate GREEN');
