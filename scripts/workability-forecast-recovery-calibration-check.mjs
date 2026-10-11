import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>fs.readFileSync(p,'utf8');
const server=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-owner-management-command-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const hand=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const html=read('index.html');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));
const must=(data,fragments,label)=>fragments.forEach(fragment=>assert.ok(data.includes(fragment),label+' missing '+fragment));
const start=server.indexOf('function buildWorkabilityForecastRecoveryCalibration(');
const end=server.indexOf('function buildWorkabilityScheduleRecoveryOutcomes(',start);
assert.ok(start>=0&&end>start,'calibration function must exist');
const block=server.slice(start,end);
assert.ok(!/\.(insert|upsert|delete|update)\s*\(/.test(block),'calibration must never mutate business records');
must(server,['workability_forecast_recovery_calibration:buildManagementMetricConfidence',
  'coverageComplete:[workabilityRead,dispatchRead,productionRead].every',
  'workability_forecast_recovery_calibration:workabilityForecastRecoveryCalibration',
  'confidence:metricConfidence.workability_forecast_recovery_calibration'],'server wiring');
must(ui,['id="owner378Calibration"','function renderWorkabilityForecastRecoveryCalibration()',
  'renderWorkabilityForecastRecoveryCalibration();','data-owner378-state','data-owner378-season',
  '/help.html#workability-forecast-recovery-calibration'],'UI');
must(help,['id="workability-forecast-recovery-calibration"','immutable historical forecast snapshots','five completed','read only'],'Help');
must(roadmap,['#### **378 — Workability Forecast-vs-Recovery Calibration** is implemented',
  'The next planned autonomous item is **379 — Route Stop-Sequence Friction Hotspots by Season**'],'roadmap');
must(hand,['**378 — Workability Forecast-vs-Recovery Calibration** (implemented)','After item 378, the next is 379'],'handoff');
must(html,['admin-owner-management-command-ui.js?v=2026-10-11b380'],'asset');
assert.equal(pkg.scripts['test:workability-forecast-recovery-calibration'],'node scripts/workability-forecast-recovery-calibration-check.mjs');
assert.equal(pkg.scripts['test:browser:workability-forecast-recovery-calibration'],'playwright test --config=playwright.config.mjs tests/browser/workability-forecast-recovery-calibration.spec.mjs');
must(workflow,['npm run test:workability-forecast-recovery-calibration',
  'npm run test:browser:workability-forecast-recovery-calibration'],'CI');

const js=ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const calibrate=vm.runInNewContext(js+';buildWorkabilityForecastRecoveryCalibration;');
const episodes=[
  ['2026-09-01','2026-09-02','2026-09-02','same_day_completed','spring_summer'],
  ['2026-09-03','2026-09-04','2026-09-04','completed_after_recovery','spring_summer'],
  ['2026-09-05','2026-09-06','2026-09-07','completed_after_recovery','spring_summer'],
  ['2026-09-08','2026-09-09','2026-09-10','completed_after_recovery','spring_summer'],
  ['2026-09-11','2026-09-12','2026-09-11','same_day_completed','spring_summer'],
  ['2026-09-15','2026-09-16',null,'rescheduled_pending','fall']
].map(([service_date,proposed_reschedule_date,outcome_date,outcome_state,season_context])=>({
  service_date,proposed_reschedule_date,outcome_date,outcome_state,season_context
}));
const run=(override={})=>calibrate({
  recovery:{source_queries_ok:true,outcomes:episodes},forwardForecast:{windows:{seven_day:{planned_items:3,blocked_days:1},fourteen_day:{planned_items:6}}},
  jobsVisible:true,sourceQueriesOk:true,coverageComplete:true,confidence:{state:'current'},...override
});
const good=run();
assert.equal(good.state,'current');
assert.equal(good.summary.constraint_episodes,6);
assert.equal(good.summary.with_dated_proposal,6);
assert.equal(good.summary.completed_with_proposal,5);
assert.equal(good.summary.proposals_without_full_completion,1);
assert.equal(good.summary.on_proposed_day_count,2);
assert.equal(good.summary.completed_later_count,2);
assert.equal(good.summary.completed_earlier_count,1);
assert.equal(good.summary.on_proposed_day_percent,40);
assert.equal(good.summary.mean_absolute_gap_days,0.6);
assert.equal(good.seasons.find(s=>s.season_context==='fall').on_proposed_day_percent,null);
assert.equal(good.current_forecast_context.seven_day_planned_items,3);
assert.ok(good.forecast_boundary.includes('NOT forecast accuracy'));
assert.equal(run({jobsVisible:false}).state,'permission_hidden');
assert.equal(run({sourceQueriesOk:false}).state,'source_unavailable');
assert.equal(run({coverageComplete:false}).state,'partial_coverage');
assert.equal(run({confidence:{state:'stale'}}).state,'evidence_unreliable');
const insufficient=run({recovery:{source_queries_ok:true,outcomes:episodes.slice(0,4)}});
assert.equal(insufficient.state,'insufficient_sample');
assert.equal(insufficient.summary.mean_absolute_gap_days,null);
assert.equal(insufficient.summary.on_proposed_day_percent,null);
const invalid=run({recovery:{source_queries_ok:true,outcomes:episodes.map((row,i)=>i===0?{...row,proposed_reschedule_date:'2026-02-31'}:row)}});
assert.equal(invalid.state,'insufficient_sample');
assert.equal(invalid.summary.missing_or_invalid_proposal,1);
console.log('Build 378 source, fail-closed provenance and deterministic calibration: PASS');
