import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const impl=ui.slice(ui.indexOf('function renderHistoricalCapacityExceptions506(){'),ui.indexOf('function renderWorkabilityRecovery(){'));
assert(impl.length>4000,'Build 506 should include the three source-linked review lanes');
for(const marker of ['visibility.jobs!==true','visibility.finance===true','sourceGood(\'jobs\')',
  'freshness_state===\'current\'','coverage_state===\'within_query_limit\'',
  'row.session_count===1','cohorts.every(x=>x.length>=5)',
  'current lifetime rollups','Not period revenue recognition','No historical accounting trend inferred',
  'missing_assumptions','configured_route_capacity_headroom_minutes',
  'source_health.every','source_queries_ok===true','recovery.outcomes',
  'No automatic dispatch','QL-269 UNDER REVIEW','No customer or employee scoring'])
  assert(ui.includes(marker),`Missing Build 506 evidence boundary: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 506 may not issue new calls, persist evidence or mutate source rows');
assert(css.includes('.yw506-review-grid')&&css.includes('@media(max-width:850px)'),
  'Build 506 requires responsive review cards');
assert(html.includes('b11=506')&&html.includes('admin-owner-management-command-ui.js'),
  'Build 506 assets must be cache-busted');
assert(pkg.scripts['test:build506']&&pkg.scripts['test:browser:build506'],
  'Build 506 source and browser acceptance scripts must be defined');
assert(workflow.includes('npm run test:build506')&&workflow.includes('npm run test:browser:build506'),
  'Both Build 506 gates must run in the protected workflow');
console.log('Build 506 PASS: source-gated historical job cohorts, seasonal capacity confidence, bounded reliability exception drilldown and protected CI wiring.');
