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
  'function buildMaterialUsageVarianceReorderCalibration',
  "safeListEvidence(supabase,'v_landscape_material_actual_use_directory'",
  "material_usage_variance_reorder_calibration:buildManagementMetricConfidence(sourceFreshness,['material_stock','material_plans','material_actual_use'])",
  'material_usage_variance_reorder_calibration:materialUsageVarianceReorderCalibration',
  'planned_lines_with_actual_evidence','comparable_lines','unit_mismatch_lines',
  'over_use_lines','under_use_lines','repeated_over_use_patterns','repeated_under_use_patterns',
  'stockout_materials','reorder_review_materials','issue_linked_actual_events','production_actual_events',
  "group.repeated_over_use=group.over_use_line_count>=2",
  "group.repeated_under_use=group.under_use_line_count>=2",
  "comparison_boundary:'Planned quantity comes from canonical Landscape Material Estimator lines.",
  "repeat_boundary:'Repeated over-use or under-use means at least two comparable estimator lines",
  "stock_boundary:'Stockout and reorder evidence reuses current canonical Materials Control",
  "source_boundary:'Issue-linked actual-use events are counted separately",
  "authority_boundary:'Read-only calibration evidence."
],'Build 371 server');

const start=directory.indexOf('function buildMaterialUsageVarianceReorderCalibration');
const end=directory.indexOf('function buildCustomerCommunicationReadinessQueue',start);
const b371=directory.slice(start,end);
assert.ok(b371.length>5000,'Build 371 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b371),'Build 371 helper must remain read-only');
assert.ok(b371.includes("plannedUnit!==actualUnit&&factor!==null&&factor>0&&Math.abs(factor-1)>0.000000001"),'Differing units require explicit non-default conversion evidence.');
assert.ok(b371.includes("events.length>0&&mismatched.length===0&&compatible.length===events.length"),'Any unresolved unit mismatch must withhold the line comparison.');
for(const forbidden of ['recommended_reorder_point','auto_reorder','create_purchase_order','supplier_contact_send'])assert.ok(!b371.includes(forbidden),'Build 371 must not introduce '+forbidden);

must(ui,[
  'Material usage variance &amp; reorder calibration','owner371MaterialVariance','renderMaterialUsageVarianceCalibration',
  "state.data?.material_usage_variance_reorder_calibration","metricMeta('material_usage_variance_reorder_calibration')",
  'Comparable planned/actual','Unit mismatch lines','Over-use lines','Under-use lines','Stockout evidence','Reorder review',
  'Calibration attention by material, service &amp; season','Service / season variance coverage',
  'Line-level planned vs recorded actual evidence','Comparison, repeat, stock &amp; authority boundaries',
  'Calibration evidence only:','renderMaterialUsageVarianceCalibration();'
],'Build 371 UI');

must(review,['"item": 371','"title": "Material Usage Variance & Reorder Calibration"'],'Build 362 learning authority for 371');
assert.equal(pkg.scripts['test:material-usage-variance-reorder-calibration'],'node scripts/material-usage-variance-reorder-calibration-check.mjs');
assert.equal(pkg.scripts['test:browser:material-usage-variance-reorder-calibration'],'playwright test --config=playwright.config.mjs tests/browser/material-usage-variance-reorder-calibration.spec.mjs');
must(workflow,['npm run test:material-usage-variance-reorder-calibration','npm run test:browser:material-usage-variance-reorder-calibration'],'Build 371 CI');

must(help,[
  'Build 371 — Material Usage Variance &amp; Reorder Calibration','Units stay explicit',
  'Repeated means recorded repetition','Issue and production evidence remain distinguishable',
  'Reorder calibration is review-only','No purchasing authority'
],'Build 371 help');

must(roadmap,[
  '#### **371 — Material Usage Variance & Reorder Calibration** is implemented',
  'The next planned autonomous item is **372 — Customer Communication Outcome & Follow-Up Effectiveness**.'
],'Build 371 roadmap');

must(handbook,[
  '**371 — Material Usage Variance & Reorder Calibration** is implemented',
  '- **372 — Customer Communication Outcome & Follow-Up Effectiveness**',
  'After item 371, that item is 372 — Customer Communication Outcome & Follow-Up Effectiveness.'
],'Build 371 handoff');

console.log('Build 371 Material Usage Variance & Reorder Calibration source gate GREEN');
