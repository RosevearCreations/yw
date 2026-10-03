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
  'function buildWorkabilityScheduleRecoveryOutcomes','v_weather_workability_queue','v_crew_dispatch_schedule','v_landscape_production_session_directory',
  "workability_recovery_outcomes:buildManagementMetricConfidence(sourceFreshness,['workability','dispatch','production'])",
  'workability_schedule_recovery_outcomes:workabilityScheduleRecoveryOutcomes',
  "outcome='completed_after_constraint'","outcome='production_started_after_constraint'",
  "outcome=norm(explicitWorkableDispatch?.workability_state)==='caution'?'caution_schedule_recorded':'workable_schedule_recorded'",
  "outcome='rescheduled_without_explicit_workability'",
  'decision_to_replan_hours','decision_to_workable_schedule_hours','decision_to_production_start_hours','decision_to_completion_hours',
  "workability_boundary:'Only recorded human/source workability decisions",
  "recovery_boundary:'A replacement dispatch is not called workable unless its recorded workability_state is explicitly workable or caution.",
  "seasonal_boundary:'Outcome cohorts retain spring/summer landscaping/lawn, fall cleanup/leaf, winter snow/ice and four-season context",
  "automation_boundary:'Read-only outcome learning."
],'Build 364 server');

const start=directory.indexOf('function buildWorkabilityScheduleRecoveryOutcomes');
const end=directory.indexOf("\n\n  if (scope === 'owner_management_command')",start);
const b364=directory.slice(start,end);
assert.ok(b364.length>3500,'Build 364 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(b364),'Build 364 helper must remain read-only');
assert.ok(b364.includes("['postpone','reschedule','blocked']"),'Build 364 must use recorded affected decision states');
assert.ok(b364.includes("['workable','caution']"),'Build 364 explicit recovery must require recorded workable/caution state');
assert.ok(!b364.includes('fetch(')&&!b364.includes('weatherapi')&&!b364.includes('openweathermap'),'Build 364 must not introduce an external weather provider');

must(ui,[
  'Build 350–364','Workability-to-schedule recovery outcomes','owner364WorkabilityRecovery','renderWorkabilityRecoveryOutcomes',
  'Outcome learning only:','Affected decisions','Replacement dispatch','Explicit workable / caution','Production started','Completed',
  'Unresolved / unverified','Recovery outcome timeline','Four-season recovery cohorts','Unresolved / unverified recovery',
  'Build 364 workability-to-schedule recovery outcome evidence refreshed'
],'Build 364 UI');

assert.equal(pkg.scripts['test:workability-schedule-recovery-outcomes'],'node scripts/workability-schedule-recovery-outcomes-check.mjs');
assert.equal(pkg.scripts['test:browser:workability-schedule-recovery-outcomes'],'playwright test --config=playwright.config.mjs tests/browser/workability-schedule-recovery-outcomes.spec.mjs');
must(workflow,['npm run test:workability-schedule-recovery-outcomes','npm run test:browser:workability-schedule-recovery-outcomes'],'Build 364 CI');
must(index,['/js/admin-owner-management-command-ui.js?v=2026-10-03b364'],'Build 364 asset');
must(help,['Build 364 — Workability-to-Schedule Recovery Outcomes','Recorded constraints only','Reschedule is not automatically workable','Recovery timing milestones','Four-season cohorts','No external weather or auto-rescheduling'],'Build 364 help');
must(roadmap,['#### **364 — Workability-to-Schedule Recovery Outcomes** is implemented','The next planned autonomous item is **365 — Route Plan-vs-Actual & Stop-Sequence Learning**.'],'Build 364 roadmap');
must(handbook,['**364 — Workability-to-Schedule Recovery Outcomes** is implemented','- **365 — Route Plan-vs-Actual & Stop-Sequence Learning**','After item 364, that item is 365 — Route Plan-vs-Actual & Stop-Sequence Learning.'],'Build 364 handoff');
console.log('Build 364 Workability-to-Schedule Recovery Outcomes source gate GREEN');
