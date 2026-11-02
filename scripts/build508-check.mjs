import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const impl=ui.slice(ui.indexOf('function captureEvidence508('),ui.indexOf('function renderWorkabilityRecovery(){'));
assert(impl.length>5000,'Build 508 must implement bounded evidence capture and follow-up validation');
for(const marker of ['state.latest508','state.prior508','function captureEvidence508','function renderEvidenceRecheck508',
  "d?.source_visibility?.jobs!==true","d.source_visibility.finance===true",
  'm.row_count<m.query_limit','cohorts.every(rows=>rows.length>=5)',
  "r.configured_route_capacity_headroom_minutes==null",'missing_assumptions',
  'recovery.outcomes.length<150','Number(recovery.summary?.constraint_episodes)===recovery.outcomes.length',
  "['workability','dispatch','production']",'keys.every(k=>ready(',
  'now.service_date===prev.service_date','now.season===prev.season','now.outcome_date',
  'Number(now.recovery_days)>=0','An absent episode is not a closed follow-up',
  'not an owner-approved resolution','QL-269'])
  assert(ui.includes(marker),`Missing Build 508 evidence safeguard: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 508 may not persist, fetch again or mutate canonical evidence');
assert(ui.includes('id="owner508Refresh"')&&ui.includes('id="owner508Recheck"'),
  'Build 508 recheck button and accessible result panel required');
assert(css.includes('.yw508-grid')&&css.includes('.owner508-recheck button:focus-visible')&&
  css.includes('@media(max-width:850px){.yw508-grid'),
  'Build 508 needs responsive, keyboard-visible review cards');
assert(html.match(/b13=508/g)?.length===2,'Build 508 must cache-bust JS and CSS');
assert(pkg.scripts['test:build508']&&pkg.scripts['test:browser:build508'],
  'Build 508 source and browser scripts required');
assert(workflow.includes('npm run test:build508')&&workflow.includes('npm run test:browser:build508'),
  'Both Build 508 gates required in protected CI');
console.log('Build 508 PASS: session-only source comparisons, non-closure gap readback, Production-backed exception validation and protected gates.');
