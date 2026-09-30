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
const must=(source,needles,label)=>needles.forEach(n=>assert.ok(source.includes(n),label+': missing '+n));

must(directory,[
  'function buildRouteCrewEfficiencyEvidence',
  "v_route_planning_directory","v_timekeeping_payroll_evidence",
  "route_efficiency:buildManagementMetricConfidence(sourceFreshness,['dispatch','production','routes','workability'])",
  'route_crew_efficiency_evidence:routeCrewEfficiencyEvidence',
  'planned_service_minutes','actual_service_minutes','service_duration_variance_minutes',
  'planned_travel_allowance_minutes','recorded_crew_travel_minutes','actual_crew_hours',
  'actual_route_order','route_order_deviation_count','return_visit_required','delay_minutes','workability_effect_count',
  'repeated_route_friction','clustering_opportunities','configured_capacity_headroom_minutes',
  "comparison_boundary:'Service-duration variance uses recorded planned duration versus recorded production duration.",
  "clustering_boundary:'Clustering is advisory evidence only.",
  "performance_boundary:'Crew and route evidence is operational context only. It does not score, rank or infer individual employee performance.",
  "authority_boundary:'Read-only evidence. Routing and dispatch remain the existing operator authorities"
],'Build 354 route/crew evidence server');

must(ui,[
  'Build 350–360','Route &amp; crew efficiency evidence','owner354Efficiency','renderRouteCrewEfficiency',
  'Actual service coverage','Duration overruns','Route-order differences','Repeated route friction','Cluster candidates','Capacity-headroom days',
  'Advisory, not employee scoring','Evidence boundaries',
  'Build 360 data-quality duplicate/orphan reconciliation evidence refreshed'
],'Build 354 route/crew evidence UI');

assert.ok(!directory.includes('employee_performance_score'));
assert.ok(!directory.includes('auto_route_rewrite'));
assert.ok(!ui.includes('employee performance score'));
assert.equal(pkg.scripts['test:route-crew-efficiency-evidence'],'node scripts/route-crew-efficiency-evidence-check.mjs');
assert.equal(pkg.scripts['test:browser:route-crew-efficiency-evidence'],'playwright test --config=playwright.config.mjs tests/browser/route-crew-efficiency-evidence.spec.mjs');
must(workflow,['npm run test:route-crew-efficiency-evidence','npm run test:browser:route-crew-efficiency-evidence'],'Build 354 CI');
must(index,['/js/admin-owner-management-command-ui.js?v=2026-09-30b360'],'Build 354 asset version');
must(help,['Build 354 — Route &amp; Crew Efficiency Evidence','Planned versus recorded service evidence','Travel evidence is not over-interpreted','Clustering and capacity are advisory','No employee performance inference'],'Build 354 help');
must(roadmap,['#### **354 — Route & Crew Efficiency Evidence** is implemented','#### **355 — Recurring Service Renewal & Retention Workbench** is implemented','#### **356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented','The next planned autonomous item is **361 — Mobile, Offline & Read-Budget Reliability Optimization**.'],'Build 354 roadmap');
must(handbook,['**354 — Route & Crew Efficiency Evidence** is implemented','**355 — Recurring Service Renewal & Retention Workbench** is implemented','**356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented','**357 — Labour, Equipment & Fleet Utilization Decision Support** is implemented','**358 — Materials, Consumables & Seasonal Stock Readiness** is implemented','**359 — Customer Communication Readiness & Queue Quality** is implemented','**360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** is implemented','- **361 — Mobile, Offline & Read-Budget Reliability Optimization**'],'Build 354 handoff');

console.log('Build 354 Route & Crew Efficiency Evidence source gate GREEN');
