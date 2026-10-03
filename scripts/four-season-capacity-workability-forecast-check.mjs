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
  'function ontarioDateKey','America/Toronto','function addCalendarDays','function forecastSeason','function buildFourSeasonCapacityForecast',
  "v_workforce_crew_directory","addFresh(crewsRead,'crews','jobs','v_workforce_crew_directory'",
  "capacity_forecast:buildManagementMetricConfidence(sourceFreshness,['dispatch','recurring_visits','crews','equipment','workability','storms','storm_routes','seasonal_work'])",
  'four_season_capacity_forecast:fourSeasonCapacityForecast',
  "capacity_method:'Evidence-only forecast","No jobs-per-crew target or external weather forecast is assumed",
  "weather_boundary:'Uses stored YW workability observations/rules and seasonal evidence only; no external weather provider is queried.'",
  "authority_boundary:'Advisory only. Forecasting does not dispatch crews, rewrite routes, change workability decisions, unlock equipment, send messages or mutate provider state.'",
  'seven_day:summarize(7)','fourteen_day:summarize(14)','season_load:seasons',
  'recorded_demand_minutes:dispatchMinutes+recurringMinutes','unassigned_dispatch_count:unassignedDispatch.length',
  'workability_blocked_count:blocked.length','workability_review_count:review.length'
],'Build 353 forecast server');

must(ui,[
  'Build 350–364','Four-season capacity &amp; workability forecast','owner353Forecast','renderCapacityForecast',
  '7-day planned','14-day planned','No external weather provider','data-owner353-state',
  'Spring/summer ','Fall ','Winter ','Four-season ','recorded demand','equipment ready',
  'Build 364 workability-to-schedule recovery outcome evidence refreshed'
],'Build 353 forecast UI');

assert.ok(!directory.includes('api.openweathermap'));
assert.ok(!directory.includes('weatherapi.com'));
assert.ok(!directory.includes('api.weather.gov'));
assert.ok(!ui.includes('attention-auto-dispatch'));
assert.equal(pkg.scripts['test:four-season-capacity-workability-forecast'],'node scripts/four-season-capacity-workability-forecast-check.mjs');
assert.equal(pkg.scripts['test:browser:four-season-capacity-workability-forecast'],'playwright test --config=playwright.config.mjs tests/browser/four-season-capacity-workability-forecast.spec.mjs');
must(workflow,['npm run test:four-season-capacity-workability-forecast','npm run test:browser:four-season-capacity-workability-forecast'],'Build 353 CI');
must(index,['/js/admin-owner-management-command-ui.js?v=2026-10-03b364'],'Build 353 asset version');
must(help,['Build 353 — Four-Season Capacity &amp; Workability Forecast','Recorded demand, not invented capacity','Four seasons remain distinct','No new weather provider and no automatic mutation'],'Build 353 help');
must(roadmap,['#### **353 — Four-Season Capacity & Workability Forecast** is implemented','#### **354 — Route & Crew Efficiency Evidence** is implemented','#### **355 — Recurring Service Renewal & Retention Workbench** is implemented','#### **356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented','The next planned autonomous item is **365 — Route Plan-vs-Actual & Stop-Sequence Learning**.'],'Build 353 roadmap');
must(handbook,['**353 — Four-Season Capacity & Workability Forecast**','**354 — Route & Crew Efficiency Evidence** is implemented','**355 — Recurring Service Renewal & Retention Workbench** is implemented','**356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented','**357 — Labour, Equipment & Fleet Utilization Decision Support** is implemented','**358 — Materials, Consumables & Seasonal Stock Readiness** is implemented','**359 — Customer Communication Readiness & Queue Quality** is implemented','**360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** is implemented','**361 — Mobile, Offline & Read-Budget Reliability Optimization** is implemented'],'Build 353 handoff');

console.log('Build 353 Four-Season Capacity & Workability Forecast source gate GREEN');
