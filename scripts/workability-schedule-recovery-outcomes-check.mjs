import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
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
  'function buildWorkabilityScheduleRecoveryOutcomes',
  "lookbackDays=90",
  "workability_schedule_recovery:buildManagementMetricConfidence(sourceFreshness,['workability','dispatch','production'])",
  'workability_schedule_recovery_outcomes:workabilityScheduleRecoveryOutcomes',
  "outcomeState='blocked_unresolved'",
  "'same_day_completed'",
  "'completed_after_recovery'",
  "outcomeState='partial_or_return_visit'",
  "outcomeState='rescheduled_pending'",
  "outcomeState='proposed_reschedule_pending'",
  'completion_recovery_rate_percent',
  'average_recovery_days',
  'recorded_completed_service_minutes',
  'season_outcomes:seasonOutcomes',
  "capacity_boundary:'Completed-capacity evidence uses recorded production duration_minutes only.",
  "weather_boundary:'No external weather provider is queried.",
  "authority_boundary:'Read-only learning only."
],'Build 364 directory evidence');

must(ui,[
  'Workability-to-schedule recovery outcomes',
  'Build 364 · 90-day comparison',
  "state.data?.workability_schedule_recovery_outcomes",
  "metricMeta('workability_schedule_recovery')",
  'Full completion recovery',
  'Same-day completion',
  'Completed after recovery',
  'Partial / return visit',
  'Reschedule pending',
  'Unresolved',
  'Four-season recovery mix',
  'Recent recovery evidence',
  'Outcome learning only:',
  'renderWorkabilityRecovery();'
],'Build 364 UI');

must(review,[
  '"item": 364',
  '"title": "Workability-to-Schedule Recovery Outcomes"',
  'Compare forecast constraints with actual schedule recovery and completed capacity.'
],'Build 362 learning authority for 364');

assert.equal(pkg.scripts['test:workability-schedule-recovery-outcomes'],'node scripts/workability-schedule-recovery-outcomes-check.mjs');
assert.equal(pkg.scripts['test:browser:workability-schedule-recovery-outcomes'],'playwright test --config=playwright.config.mjs tests/browser/workability-schedule-recovery-outcomes.spec.mjs');
must(workflow,[
  'npm run test:workability-schedule-recovery-outcomes',
  'npm run test:browser:workability-schedule-recovery-outcomes'
],'Build 364 CI');

must(help,[
  'Build 364 — Workability-to-Schedule Recovery Outcomes',
  'Recorded recovery, not assumed recovery',
  'Completed capacity uses recorded production duration',
  'Four-season recovery evidence',
  'No automatic rescheduling'
],'Build 364 help');

must(roadmap,[
  '#### **364 — Workability-to-Schedule Recovery Outcomes** is implemented',
  'The next planned autonomous item is **365 — Route Plan-vs-Actual & Stop-Sequence Learning**.'
],'Build 364 roadmap');

must(handbook,[
  '**364 — Workability-to-Schedule Recovery Outcomes** is implemented',
  '- **365 — Route Plan-vs-Actual & Stop-Sequence Learning**',
  'After item 364, that item is 365 — Route Plan-vs-Actual & Stop-Sequence Learning.'
],'Build 364 handoff');

console.log('Build 364 Workability-to-Schedule Recovery Outcomes source gate GREEN');
