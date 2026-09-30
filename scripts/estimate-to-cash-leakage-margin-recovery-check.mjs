#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const directory=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-owner-management-command-ui.js');
const index=read('index.html');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(directory,[
  'function buildEstimateToCashLeakageWorkbench','v_estimate_job_invoice_workflow','v_change_order_extras_directory','v_ar_payment_application_directory',
  "estimate_to_cash:buildManagementMetricConfidence",'estimate_to_cash_leakage_workbench:estimateToCashLeakageWorkbench',
  'accepted_not_scheduled','completed_not_invoiced','approved_extra_not_billed','invoiced_not_collected','material_margin_leakage','source_queries_ok:input.sourceQueriesOk',
  "margin_boundary:'Material margin leakage is flagged only from strong recorded evidence",
  "collection_boundary:'Invoiced-not-collected uses the recorded A/R balance due",
  "authority_boundary:'Estimate, Jobs/dispatch/production, change-order and Finance records remain their existing authorities"
],'Build 356 server');

must(ui,[
  'Build 350–359','Estimate-to-cash leakage &amp; margin recovery','owner356EstimateCash','renderEstimateToCash',
  'Accepted lifecycles','Accepted not scheduled','Completed not invoiced','Approved extras not billed','Invoiced not collected','Margin leakage',
  'Analytical only:','Leakage &amp; recovery queue','Accepted estimate lifecycle traces',
  'Build 359 customer communication readiness and queue-quality evidence refreshed'
],'Build 356 UI');

const b356=directory.slice(directory.indexOf('function buildEstimateToCashLeakageWorkbench'),directory.indexOf('function buildLabourEquipmentFleetUtilizationDecisionSupport'));
assert.ok(b356.length>1000,'Build 356 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b356),'Build 356 helper must remain read-only');
assert.equal(pkg.scripts['test:estimate-to-cash-leakage-margin-recovery'],'node scripts/estimate-to-cash-leakage-margin-recovery-check.mjs');
assert.equal(pkg.scripts['test:browser:estimate-to-cash-leakage-margin-recovery'],'playwright test --config=playwright.config.mjs tests/browser/estimate-to-cash-leakage-margin-recovery.spec.mjs');
must(workflow,['npm run test:estimate-to-cash-leakage-margin-recovery','npm run test:browser:estimate-to-cash-leakage-margin-recovery'],'Build 356 CI');
must(index,['/js/admin-owner-management-command-ui.js?v=2026-09-30b359'],'Build 356 asset');
must(help,['Build 356 — Estimate-to-Cash Leakage &amp; Margin Recovery','Accepted not scheduled','Completed not invoiced','Approved extras not billed','Invoiced not collected','Margin leakage','Analytical only'],'Build 356 help');
must(roadmap,['#### **356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented','The next planned autonomous item is **360 — Data Quality, Duplicate & Orphan Reconciliation Workbench**.'],'Build 356 roadmap');
must(handbook,['**356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented','**357 — Labour, Equipment & Fleet Utilization Decision Support** is implemented','**358 — Materials, Consumables & Seasonal Stock Readiness** is implemented','**359 — Customer Communication Readiness & Queue Quality** is implemented','- **360 — Data Quality, Duplicate & Orphan Reconciliation Workbench**'],'Build 356 handoff');
console.log('Build 356 Estimate-to-Cash Leakage & Margin Recovery source gate GREEN');
