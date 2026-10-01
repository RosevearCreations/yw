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
  'function buildDataQualityDuplicateOrphanReconciliation','v_crm_customer_directory','v_crm_property_directory',
  'v_jobs_directory','v_crew_dispatch_schedule','v_recurring_service_program_directory','v_workforce_crew_directory',
  'v_equipment_registry_v2','v_route_planning_directory','v_weather_workability_queue','v_landscape_material_line_directory',
  "data_quality_reconciliation:buildManagementMetricConfidence",
  'data_quality_duplicate_orphan_reconciliation:dataQualityDuplicateOrphanReconciliation',
  "signal_type:'duplicate_customer_candidate'","signal_type:'duplicate_property_candidate'",
  "signal_type:'broken_canonical_reference'","signal_type:'cross_module_link_mismatch'",
  "signal_type:'stale_assignment'","signal_type:'conflicting_season_service_tag'",
  'referenceCoverageComplete:dataQualityReferenceReads.every',
  "destructive_action_allowed:false",
  "duplicate_boundary:'Duplicate signals are candidates, not identity decisions.",
  "reference_boundary:'Broken-reference checks are emitted only when all required canonical reference sources",
  "destructive_boundary:'This workbench cannot merge or delete customers/properties",
  "audit_boundary:'Source IDs and references are retained on every reconciliation candidate"
],'Build 360 server');

const start=directory.indexOf('function buildDataQualityDuplicateOrphanReconciliation');
const end=directory.indexOf("\n\n  if (scope === 'owner_management_command')",start);
const b360=directory.slice(start,end);
assert.ok(b360.length>5000,'Build 360 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b360),'Build 360 helper must remain read-only');
assert.ok(b360.includes("same_email")&&b360.includes("same_phone")&&b360.includes("same_normalized_name_and_postal"),'Customer duplicate evidence missing');
assert.ok(b360.includes("same_normalized_service_address")&&b360.includes("same_rounded_coordinates"),'Property duplicate evidence missing');
assert.ok(b360.includes("referenceCoverageComplete"),'Reference coverage guard missing');
assert.ok(!b360.includes('billing_email:')&&!b360.includes('phone:')&&!b360.includes('public_token'),'Build 360 must not return contact values or portal tokens');
assert.ok(!b360.includes('merge_customer')&&!b360.includes('delete_customer')&&!b360.includes('delete_property'),'Build 360 must not add destructive actions');

must(ui,[
  'Build 350–360','Data quality, duplicate &amp; orphan reconciliation workbench','owner360DataQuality','renderDataQualityReconciliation',
  'No destructive auto-fix:','Signals','Duplicate customers','Duplicate properties','Broken references','Cross-module mismatches',
  'Stale assignments','Season tag conflicts','Reconciliation queue','Duplicate customer &amp; property candidates',
  'Reference &amp; assignment issues','Four-season tag conflicts','Reference-gap findings withheld:',
  'Build 360 data-quality duplicate/orphan reconciliation evidence refreshed'
],'Build 360 UI');

assert.equal(pkg.scripts['test:data-quality-duplicate-orphan-reconciliation'],'node scripts/data-quality-duplicate-orphan-reconciliation-check.mjs');
assert.equal(pkg.scripts['test:browser:data-quality-duplicate-orphan-reconciliation'],'playwright test --config=playwright.config.mjs tests/browser/data-quality-duplicate-orphan-reconciliation.spec.mjs');
must(workflow,['npm run test:data-quality-duplicate-orphan-reconciliation','npm run test:browser:data-quality-duplicate-orphan-reconciliation'],'Build 360 CI');
must(index,['/js/admin-owner-management-command-ui.js?v=2026-09-30b360'],'Build 360 asset');
must(help,['Build 360 — Data Quality, Duplicate &amp; Orphan Reconciliation Workbench','Duplicate customers and properties','Broken and cross-module references','Stale crew and equipment assignments','Four-season tag conflicts','No destructive automatic reconciliation'],'Build 360 help');
must(roadmap,['#### **360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** is implemented','The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.'],'Build 360 roadmap');
must(handbook,['**360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** is implemented','**361 — Mobile, Offline & Read-Budget Reliability Optimization** is implemented','After item 363, that item is 364 — Workability-to-Schedule Recovery Outcomes.'],'Build 360 handoff');
console.log('Build 360 Data Quality, Duplicate & Orphan Reconciliation Workbench source gate GREEN');
