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
  'function buildLabourEquipmentFleetUtilizationDecisionSupport','v_timekeeping_payroll_evidence','v_landscape_production_session_directory',
  'v_equipment_signout_history','v_equipment_registry_v2','v_preventive_maintenance_workbench','v_fleet_vehicle_operations',
  "utilization_support:buildManagementMetricConfidence",'labour_equipment_fleet_utilization_support:labourEquipmentFleetUtilizationSupport',
  'paid_hours_without_job_link','crew_assignment_coverage_percent','equipment_no_recent_recorded_use','fleet_downtime_assets',
  "labour_boundary:'Labour utilization is crew/business-level recording context only",
  "equipment_boundary:'Equipment utilization is based on existing signout evidence",
  "safety_boundary:'Equipment lockout, fleet downtime and readiness restrictions are operating constraints",
  "privacy_boundary:'Returned utilization evidence is aggregated by crew and asset",
  "authority_boundary:'Read-only management evidence"
],'Build 357 server');

must(ui,[
  'Build 350–357','Labour, equipment &amp; fleet utilization decision support','owner357Utilization','renderUtilizationSupport',
  'Paid time, 30d','Job-linked paid time','Paid time without job link','Production labour','Equipment with recorded use',
  'Fleet known available','Fleet downtime','Maintenance attention','Crew-level recording context',
  'Utilization, downtime &amp; maintenance signals','Decision support only:',
  'Build 357 labour, equipment and fleet utilization decision-support evidence refreshed'
],'Build 357 UI');

const b357=directory.slice(directory.indexOf('function buildLabourEquipmentFleetUtilizationDecisionSupport'),directory.indexOf("\n\n  if (scope === 'owner_management_command')"));
assert.ok(b357.length>1500,'Build 357 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b357),'Build 357 helper must remain read-only');
assert.ok(!b357.includes('full_name')&&!b357.includes('employee_number'),'Build 357 decision-support output must not expose individual employee identity fields.');
assert.ok(!b357.includes('performance_score')&&!b357.includes('employee_performance'),'Build 357 must not create employee performance scoring.');
assert.ok(b357.includes("no_recent_recorded_use:'")||b357.includes("no_recent_recorded_use:"),'Build 357 must preserve no-recorded-use as an evidence state.');
must(b357,[
  "is not treated as proof that an asset was idle or unnecessary",
  "never converted into employee performance judgments",
  "does not score, rank or infer individual employee performance"
],'Build 357 boundaries');

assert.equal(pkg.scripts['test:labour-equipment-fleet-utilization-decision-support'],'node scripts/labour-equipment-fleet-utilization-decision-support-check.mjs');
assert.equal(pkg.scripts['test:browser:labour-equipment-fleet-utilization-decision-support'],'playwright test --config=playwright.config.mjs tests/browser/labour-equipment-fleet-utilization-decision-support.spec.mjs');
must(workflow,['npm run test:labour-equipment-fleet-utilization-decision-support','npm run test:browser:labour-equipment-fleet-utilization-decision-support'],'Build 357 CI');
must(index,['/js/admin-owner-management-command-ui.js?v=2026-09-28b357'],'Build 357 asset');
must(help,['Build 357 — Labour, Equipment &amp; Fleet Utilization Decision Support','Crew-level labour context','Equipment use is evidence, not an idle verdict','Fleet downtime and maintenance','No employee performance scoring'],'Build 357 help');
must(roadmap,['#### **357 — Labour, Equipment & Fleet Utilization Decision Support** is implemented','The next planned autonomous item is **358 — Materials, Consumables & Seasonal Stock Readiness**.'],'Build 357 roadmap');
must(handbook,['**357 — Labour, Equipment & Fleet Utilization Decision Support** is implemented','- **358 — Materials, Consumables & Seasonal Stock Readiness**','After item 357, that item is 358 — Materials, Consumables & Seasonal Stock Readiness.'],'Build 357 handoff');
console.log('Build 357 Labour, Equipment & Fleet Utilization Decision Support source gate GREEN');
