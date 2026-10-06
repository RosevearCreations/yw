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
  'function buildEstimateAccuracyChangeOrderCalibration',
  "v_estimate_workflow_assumption_directory",
  "v_estimate_assumption_variance",
  "v_job_cost_depth_directory",
  "estimate_accuracy_calibration:buildManagementMetricConfidence(sourceFreshness,['estimate_workflow','estimate_assumptions','estimate_assumption_variance','production','change_orders','job_cost_depth','jobs'])",
  'estimate_accuracy_change_order_margin_calibration:estimateAccuracyChangeOrderMarginCalibration',
  "baseline_source:variance?'accepted_work_order_assumption_snapshot'",
  'approved_applied_estimated_cost_delta',
  'component_cost_variance',
  'labour_hours_variance',
  'margin_variance_percentage_points',
  'recurring_calibration_patterns',
  "pattern_type:'component_cost_variance'",
  "pattern_type:'recorded_margin_variance'",
  "pattern_type:'adjusted_total_cost_variance'",
  "baseline_boundary:'Accepted work-order assumption snapshots are preferred",
  "unit_boundary:'Recorded assumption unit labels are preserved exactly.",
  "change_order_boundary:'Adjusted baseline cost includes only recorded customer-approved and applied change-order estimated cost deltas.",
  "margin_boundary:'Margin calibration compares recorded estimate margin percent with recorded actual job margin percent only.",
  "actuals_boundary:'Actual labour, material and equipment comparisons use recorded job/Production cost evidence.",
  "authority_boundary:'Read-only calibration only."
],'Build 367 server');

must(ui,[
  'Estimate accuracy &amp; change-order margin calibration',
  'owner367Calibration',
  'renderEstimateCalibration',
  "state.data?.estimate_accuracy_change_order_margin_calibration",
  "metricMeta('estimate_accuracy_calibration')",
  'Accepted estimates','Comparable closeouts','Applied approved changes',
  'Labour cost comparisons','Material / equipment','Recurring patterns',
  'Component cost calibration','Recurring calibration patterns','Estimate-to-actual calibration records',
  'Evidence, units and authority boundaries',
  'Calibration evidence only:',
  'renderEstimateCalibration();'
],'Build 367 UI');

must(review,[
  '"item": 367',
  '"title": "Estimate Accuracy & Change-Order Margin Calibration"'
],'Build 362 learning authority for 367');

assert.equal(pkg.scripts['test:estimate-accuracy-change-order-margin-calibration'],'node scripts/estimate-accuracy-change-order-margin-calibration-check.mjs');
assert.equal(pkg.scripts['test:browser:estimate-accuracy-change-order-margin-calibration'],'playwright test --config=playwright.config.mjs tests/browser/estimate-accuracy-change-order-margin-calibration.spec.mjs');
must(workflow,[
  'npm run test:estimate-accuracy-change-order-margin-calibration',
  'npm run test:browser:estimate-accuracy-change-order-margin-calibration'
],'Build 367 CI');

must(help,[
  'Build 367 — Estimate Accuracy &amp; Change-Order Margin Calibration',
  'Source units are preserved',
  'Approved change orders adjust context, not history',
  'Margin calibration is descriptive',
  'Repeated patterns are review signals only',
  'Read-only authority'
],'Build 367 help');

must(roadmap,[
  '#### **367 — Estimate Accuracy & Change-Order Margin Calibration** is implemented',
  'The next planned autonomous item is **368 — Completed-to-Invoiced Cycle-Time & Cash Conversion**.'
],'Build 367 roadmap');

must(handbook,[
  '**367 — Estimate Accuracy & Change-Order Margin Calibration** is implemented',
  '- **368 — Completed-to-Invoiced Cycle-Time & Cash Conversion**',
  'After item 367, that item is 368 — Completed-to-Invoiced Cycle-Time & Cash Conversion.'
],'Build 367 handoff');

const start=directory.indexOf('function buildEstimateAccuracyChangeOrderCalibration');
const end=directory.indexOf('function buildLabourEquipmentFleetUtilizationDecisionSupport',start);
const b367=directory.slice(start,end);
assert.ok(b367.length>2000,'Build 367 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b367),'Build 367 helper must remain read-only');
assert.ok(!b367.includes('target_margin_recommendation'));
assert.ok(!b367.includes('auto_adjust_estimate'));
assert.ok(!b367.includes('auto_approve_change_order'));

console.log('Build 367 Estimate Accuracy & Change-Order Margin Calibration source gate GREEN');
