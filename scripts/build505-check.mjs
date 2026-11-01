import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const shell=readFileSync('index.html','utf8');
const css=readFileSync('build494-command.css','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const section=source.slice(source.indexOf('function renderServiceCapacityReliability505(){'),source.indexOf('function renderWorkabilityRecovery(){'));
assert(section.length>3000,'Build 505 review implementation must exist');
for(const v of ['source_visibility','permission?.jobs!==true','permission.finance===true',
  'source_queries_ok!==true','coverage_complete!==true','!fresh','metricMeta',
  'recorded_job_profitability_group_count','workability_constraint_episodes',
  'sufficient_sample===true','Number(row.matched_completed_pairs)>=5','TREND WITHHELD',
  'QL-269 remains UNDER REVIEW','recorded demand','No longitudinal service profit trend'])
  assert(source.includes(v),`Build 505 missing safety/source marker ${v}`);
assert(!/\b(?:localStorage|sessionStorage|\.rpc\(|\.insert\(|\.update\(|\.delete\(|fetch\()/.test(section),
  'The trend view must only use the already authorized management response');
assert(shell.includes('admin-owner-management-command-ui.js?v=2026-10-12b386')&&shell.includes('b10=505'),
  'Build 505 script asset must have a new cache key');
assert(css.includes('.yw505-evidence-grid')&&css.includes('max-width:850px'),
  'Responsive management evidence cards required');
assert(pkg.scripts['test:build505']&&pkg.scripts['test:browser:build505'],
  'Source and browser checks must be scripted');
assert(workflow.includes('npm run test:build505')&&workflow.includes('npm run test:browser:build505'),
  'Build 505 checks must be protected CI steps');
console.log('Build 505 PASS: evidence-gated seasonal economics, capacity, reliability trend, source links and CI wiring.');
