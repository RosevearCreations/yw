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
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const must=(source,needles,label)=>needles.forEach(n=>assert.ok(source.includes(n),label+': missing '+n));

must(directory,[
  'type SourceReadEvidence','safeListEvidence','latestAuthoritativeUpdate','buildManagementSourceFreshness','buildManagementMetricConfidence',
  "source_freshness:sourceFreshness","management_metric_confidence:metricConfidence","freshness_boundary:",
  "zero is not inferred","freshness_state:'source_error'","freshness_state:'missing'","freshness_state:'timestamp_unavailable'",
  "coverage_state:capped?'possibly_capped':'within_query_limit'","confidence:(stale||capped)?'medium':'high'",
  "addFresh(dispatchRead,'dispatch','jobs','v_crew_dispatch_schedule'","addFresh(profitabilityRead,'profitability','finance','v_job_profitability_variance_directory'",
  "addFresh(workabilityRead,'workability','jobs','v_weather_workability_queue'","crews_today:buildManagementMetricConfidence",
  "labour_utilization:buildManagementMetricConfidence","finance_readiness:buildManagementMetricConfidence"
],'Build 351 server evidence');

must(ui,[
  'Build 350–364','Management metric freshness &amp; confidence','owner351Freshness','renderFreshness','metricMeta','sourceMeta','metricValue','metricEvidence',
  'No source evidence','Evidence: ','Coverage gaps','Authoritative source details','Build 364 workability-to-schedule recovery outcome evidence refreshed'
],'Build 351 management UI');

must(index,['/js/admin-owner-management-command-ui.js?v=2026-10-03b364'],'Build 351 asset version');
must(help,['Build 351 — Management Metric Freshness &amp; Confidence','Missing is not zero','Stale and partial evidence stays visible','Authority remains read-only'],'Build 351 help');
must(roadmap,['#### **351 — Management Metric Freshness & Confidence** is implemented','#### **352 — Autonomous Exception Triage & Next-Safe-Action** is implemented','#### **353 — Four-Season Capacity & Workability Forecast** is implemented','#### **354 — Route & Crew Efficiency Evidence** is implemented','#### **355 — Recurring Service Renewal & Retention Workbench** is implemented','#### **356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented','The next planned autonomous item is **365 — Route Plan-vs-Actual & Stop-Sequence Learning**.'],'Build 351 roadmap');
must(handbook,['**351 — Management Metric Freshness & Confidence**','**352 — Autonomous Exception Triage & Next-Safe-Action**','**353 — Four-Season Capacity & Workability Forecast**','**354 — Route & Crew Efficiency Evidence** is implemented','**355 — Recurring Service Renewal & Retention Workbench** is implemented','**356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented','**357 — Labour, Equipment & Fleet Utilization Decision Support** is implemented','**358 — Materials, Consumables & Seasonal Stock Readiness** is implemented','**359 — Customer Communication Readiness & Queue Quality** is implemented','**360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** is implemented','**361 — Mobile, Offline & Read-Budget Reliability Optimization** is implemented'],'Build 351 handoff');
must(pkg,['test:management-metric-freshness-confidence','test:browser:management-metric-freshness-confidence'],'Build 351 package');
must(workflow,['npm run test:management-metric-freshness-confidence','npm run test:browser:management-metric-freshness-confidence'],'Build 351 CI');

console.log('Build 351 Management Metric Freshness & Confidence source gate GREEN');
