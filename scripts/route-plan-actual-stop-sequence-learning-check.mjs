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
  'function buildRoutePlanActualStopSequenceLearning',
  "route_sequence_learning:buildManagementMetricConfidence(sourceFreshness,['dispatch','production','timekeeping_detail','routes','workability'])",
  'route_plan_actual_stop_sequence_learning:routePlanActualStopSequenceLearning',
  'planned_sequence','recorded_start_sequence','order_deviation_count',
  'stable_friction_patterns','candidate_sequence_reviews','repeat_service_date_count',
  "source_scope_boundary:'Learning is derived only from the bounded Build 354 route evidence",
  "travel_boundary:'Planned travel allowance and recorded crew travel minutes are shown side by side only.",
  "learning_boundary:'A stable pattern means the same recorded friction type occurred on at least two service dates for a route.",
  "performance_boundary:'Plan-versus-actual learning is route-day operational evidence only. It does not score, rank or infer individual employee performance.",
  "authority_boundary:'Read-only learning only. Routing and Dispatch remain operator authorities;"
],'Build 365 route sequence server');

must(ui,[
  'Route plan-vs-actual &amp; stop-sequence learning','owner365Sequence','renderRouteSequenceLearning',
  "state.data?.route_plan_actual_stop_sequence_learning","metricMeta('route_sequence_learning')",
  'Comparable stop evidence','Route days with order difference','Exact route-day sequence',
  'Stable friction routes','Sequencing review candidates','Recent route-day comparisons',
  'Stable route-day friction patterns','Candidate sequencing review','Learning only:',
  'renderRouteSequenceLearning();'
],'Build 365 UI');

must(review,[
  '"item": 365',
  '"title": "Route Plan-vs-Actual & Stop-Sequence Learning"',
  'Extend route evidence from static efficiency comparison into repeated plan-versus-actual learning.'
],'Build 362 learning authority for 365');

assert.equal(pkg.scripts['test:route-plan-actual-stop-sequence-learning'],'node scripts/route-plan-actual-stop-sequence-learning-check.mjs');
assert.equal(pkg.scripts['test:browser:route-plan-actual-stop-sequence-learning'],'playwright test --config=playwright.config.mjs tests/browser/route-plan-actual-stop-sequence-learning.spec.mjs');
must(workflow,['npm run test:route-plan-actual-stop-sequence-learning','npm run test:browser:route-plan-actual-stop-sequence-learning'],'Build 365 CI');

must(help,[
  'Build 365 — Route Plan-vs-Actual &amp; Stop-Sequence Learning',
  'Repeated evidence, not automatic optimization','Travel facts stay bounded','No employee scoring or dispatch mutation'
],'Build 365 help');

must(roadmap,[
  '#### **365 — Route Plan-vs-Actual & Stop-Sequence Learning** is implemented',
  'The next planned autonomous item is **366 — Recurring Renewal Conversion & Churn Outcomes**.'
],'Build 365 roadmap');

must(handbook,[
  '**365 — Route Plan-vs-Actual & Stop-Sequence Learning** is implemented',
  '- **366 — Recurring Renewal Conversion & Churn Outcomes**',
  'After item 365, that item is 366 — Recurring Renewal Conversion & Churn Outcomes.'
],'Build 365 handoff');

assert.ok(!directory.includes('employee_performance_score'));
assert.ok(!directory.includes('auto_route_rewrite'));
console.log('Build 365 Route Plan-vs-Actual & Stop-Sequence Learning source gate GREEN');
