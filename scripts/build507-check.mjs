import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const impl=ui.slice(ui.indexOf('function renderEconomicCapacityFollowup507(){'),ui.indexOf('function renderWorkabilityRecovery(){'));
assert(impl.length>5000,'Build 507 review lanes must have bounded evidence handling');
for(const marker of ['visibility',"visible.jobs!==true","visible.finance===true", "checked('jobs')",
  "m.row_count===jobs.length",'frequency.get(id)!==1','r.session_count!==1',
  'cohorts.every(rows=>rows.length>=5)','current lifetime rollups',
  'missing_assumptions','configured_route_capacity_headroom_minutes','crew.source_health.every',
  "['workability','dispatch','production'].every(checked)",
  'recovery.outcomes.length>=150','No private decision reasons','QL-269 UNDER REVIEW'])
  assert(ui.includes(marker),`Missing Build 507 boundary: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 507 may not fetch or mutate any source, authority or queue state');
assert(ui.includes('id="owner507Followup"')&&ui.includes('id="owner507QueueFilter"'),
  'Build 507 panel and accessible queue filter must be mounted');
assert(css.includes('.yw507-grid')&&css.includes('.owner507-followup select:focus-visible')&&
  css.includes('@media(max-width:850px){.yw507-grid'),
  'Build 507 needs responsive high-contrast and focus styles');
assert(html.match(/b12=507/g)?.length===2,'Build 507 JS and CSS cache-bust keys required');
assert(pkg.scripts['test:build507']&&pkg.scripts['test:browser:build507'],
  'Build 507 source and browser scripts must be defined');
assert(workflow.includes('npm run test:build507')&&workflow.includes('npm run test:browser:build507'),
  'Both Build 507 gates must run in the protected CI workflow');
console.log('Build 507 PASS: source-lineage audit, gap priorities, non-mutating follow-up queue and protected gates.');
