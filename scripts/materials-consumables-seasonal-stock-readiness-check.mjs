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
  'function buildMaterialsConsumablesSeasonalStockReadiness','v_material_stock_control','v_landscape_material_line_directory',
  "stock_readiness:buildManagementMetricConfidence",'materials_consumables_seasonal_stock_readiness:materialsConsumablesSeasonalStockReadiness',
  'shortage_within_7_days','shortage_within_14_days','unit_comparison_required','recurring_visits_without_quantified_material_plan',
  "demand_boundary:'Quantified demand comes only from planned Landscape Material Estimator lines",
  "recurring_boundary:'Upcoming recurring visits are checked for a linked dispatch/work order with a quantified material plan",
  "unit_boundary:'Projected on-hand and shortage timing are calculated only when the planned material unit exactly matches",
  "purchasing_boundary:'Reorder signals reuse current stock, planned demand and recorded reorder/target settings",
  "authority_boundary:'Read-only management evidence. Materials catalog"
],'Build 358 server');

const b358=directory.slice(directory.indexOf('function buildMaterialsConsumablesSeasonalStockReadiness'),directory.indexOf('function buildCustomerCommunicationReadinessQueue'));
assert.ok(b358.length>2000,'Build 358 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b358),'Build 358 helper must remain read-only');
must(b358,[
  "No hidden unit conversion is performed.",
  "no per-visit material amount is invented",
  "do not create purchase orders, contact suppliers, reserve stock, or create vendor commitments",
  "salt|de_?icer|de-?icer|ice_?melt|traction|winter|road_?sand",
  "leaf|yard_?waste|bag|fall|disposal",
  "mulch|soil|sod|seed|fertiliz|grass|lawn|landscap|plant|stone|gravel|compost"
],'Build 358 boundaries');

must(ui,[
  'Build 350–360','Materials, consumables &amp; seasonal stock readiness','owner358Stock','renderStockReadiness',
  'Tracked materials','Quantified 14-day demand','Shortage ≤7 days','Shortage ≤14 days','Reorder review',
  'Unit comparison needed','Recurring demand unquantified','Four-season stock context','Recurring demand coverage gaps',
  'No automatic purchasing:','Build 360 data-quality duplicate/orphan reconciliation evidence refreshed'
],'Build 358 UI');

assert.equal(pkg.scripts['test:materials-consumables-seasonal-stock-readiness'],'node scripts/materials-consumables-seasonal-stock-readiness-check.mjs');
assert.equal(pkg.scripts['test:browser:materials-consumables-seasonal-stock-readiness'],'playwright test --config=playwright.config.mjs tests/browser/materials-consumables-seasonal-stock-readiness.spec.mjs');
must(workflow,['npm run test:materials-consumables-seasonal-stock-readiness','npm run test:browser:materials-consumables-seasonal-stock-readiness'],'Build 358 CI');
must(index,['/js/admin-owner-management-command-ui.js?v=2026-09-30b360'],'Build 358 asset');
must(help,['Build 358 — Materials, Consumables &amp; Seasonal Stock Readiness','Scheduled material demand','Recurring demand coverage','Units are not guessed','Seasonal stock context','No automatic purchasing'],'Build 358 help');
must(roadmap,['#### **358 — Materials, Consumables & Seasonal Stock Readiness** is implemented','The next planned autonomous item is **363 — Management Decision Outcome Journal & Learning Loop**.'],'Build 358 roadmap');
must(handbook,['**358 — Materials, Consumables & Seasonal Stock Readiness** is implemented','**359 — Customer Communication Readiness & Queue Quality** is implemented','**360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** is implemented','**361 — Mobile, Offline & Read-Budget Reliability Optimization** is implemented','After item 362, that item is 363 — Management Decision Outcome Journal & Learning Loop.'],'Build 358 handoff');
console.log('Build 358 Materials, Consumables & Seasonal Stock Readiness source gate GREEN');
