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
  'function buildEquipmentDowntimeCostReplacementReadiness',
  "safeListEvidence(supabase,'v_equipment_maintenance_history'",
  "safeListEvidence(supabase,'v_equipment_service_task_directory'",
  "safeListEvidence(supabase,'fleet_downtime_events'",
  "equipment_downtime_replacement_readiness:buildManagementMetricConfidence(sourceFreshness,['equipment','maintenance','equipment_use','fleet','maintenance_history','equipment_service_tasks','fleet_downtime_events'])",
  'equipment_downtime_cost_replacement_readiness:equipmentDowntimeCostReplacementReadiness',
  'downtime_event_count_365','recorded_downtime_hours_365','repeated_downtime',
  'maintenance_history_count_365','maintenance_history_cost_365','service_task_actual_cost_365',
  'recorded_service_cost_total_all_time','recorded_lifecycle_cost_total','service_cost_to_acquisition_percent',
  'replacement_state','replacement_target_date','replacement_estimated_cost',
  "reviewState='recorded_replacement_hold'",
  "reviewState='recorded_replacement_plan'",
  "reviewState='lifecycle_burden_review'",
  "downtime_boundary:'Downtime exposure uses recorded fleet_downtime_events started_at/ended_at.",
  "maintenance_boundary:'Maintenance burden uses recorded maintenance history and service-task events.",
  "cost_boundary:'Equipment-specific recorded service/lifecycle costs remain separate from linked job-level Finance context.",
  "replacement_boundary:'Replacement readiness reports the existing replacement_state",
  "safety_boundary:'Lockout and return-to-service remain controlled Equipment/Safety authorities.",
  "authority_boundary:'Read-only lifecycle evidence."
],'Build 370 server');

must(ui,[
  'Equipment downtime cost &amp; replacement readiness',
  'owner370EquipmentLifecycle','renderEquipmentDowntimeReplacementReadiness',
  "state.data?.equipment_downtime_cost_replacement_readiness",
  "metricMeta('equipment_downtime_replacement_readiness')",
  'Lockout / downtime','Downtime, 365d','Repeated maintenance','Replacement state',
  'Recorded service cost','Recorded replacement estimate','Finance job context',
  'Lifecycle attention evidence','All loaded equipment evidence',
  'Downtime, cost, replacement &amp; authority boundaries',
  'Lifecycle review only:',
  'renderEquipmentDowntimeReplacementReadiness();'
],'Build 370 UI');

must(review,[
  '"item": 370',
  '"title": "Equipment Downtime Cost & Replacement Readiness"'
],'Build 362 learning authority for 370');

assert.equal(pkg.scripts['test:equipment-downtime-cost-replacement-readiness'],'node scripts/equipment-downtime-cost-replacement-readiness-check.mjs');
assert.equal(pkg.scripts['test:browser:equipment-downtime-cost-replacement-readiness'],'playwright test --config=playwright.config.mjs tests/browser/equipment-downtime-cost-replacement-readiness.spec.mjs');
must(workflow,[
  'npm run test:equipment-downtime-cost-replacement-readiness',
  'npm run test:browser:equipment-downtime-cost-replacement-readiness'
],'Build 370 CI');

must(help,[
  'Build 370 — Equipment Downtime Cost &amp; Replacement Readiness',
  'Downtime uses recorded events','Costs are not double-counted',
  'Replacement readiness is descriptive','Current lockout stays authoritative','No purchasing authority'
],'Build 370 help');

must(roadmap,[
  '#### **370 — Equipment Downtime Cost & Replacement Readiness** is implemented',
  'The next planned autonomous item is **371 — Material Usage Variance & Reorder Calibration**.'
],'Build 370 roadmap');

must(handbook,[
  '**370 — Equipment Downtime Cost & Replacement Readiness** is implemented',
  '- **371 — Material Usage Variance & Reorder Calibration**',
  'After item 370, that item is 371 — Material Usage Variance & Reorder Calibration.'
],'Build 370 handoff');

const start=directory.indexOf('function buildEquipmentDowntimeCostReplacementReadiness');
const end=directory.indexOf('function buildLabourCapturePayrollExceptionReduction',start);
const b370=directory.slice(start,end);
assert.ok(b370.length>3500,'Build 370 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b370),'Build 370 helper must remain read-only');
assert.ok(b370.includes('repeatedDowntime=downtime.length>=2'),'Repeated downtime must be event-evidence based.');
assert.ok(b370.includes('repeatedMaintenance=history.length>=2||tasks.length>=2'),'Repeated maintenance must be event-evidence based.');
assert.ok(!b370.includes('replacement_recommendation'));
assert.ok(!b370.includes('auto_replace'));
assert.ok(!b370.includes('create_purchase_order'));
assert.ok(!b370.includes('clear_lockout'));
assert.ok(!b370.includes('return_to_service'));

console.log('Build 370 Equipment Downtime Cost & Replacement Readiness source gate GREEN');
