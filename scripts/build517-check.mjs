import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const start=ui.indexOf('function renderExceptionReview517(){');
const end=ui.indexOf('function renderWorkabilityRecovery(){');
assert(start>0&&end>start,'Build 517 owner exception review must follow Build 516 source recheck');
const impl=ui.slice(start,end);
for(const marker of [
  'access.jobs!==true','access.finance===true','state.review516',
  'economic','capacity','reliability','packet.cases.filter',
  'Original evidence follow-up','Independent owner evidence needed','Source reconciliation',
  'packet.priorAt','packet.latestAt','r.ageBand',
  'No matching change','does not establish resolution',
  'No retained'
]){
  assert(impl.includes(marker)||ui.includes(marker),`Missing Build 517 review safeguard: ${marker}`);
}
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 517 review cannot store cases or mutate source records');
for(const marker of [
  'state.review516={economic:null,capacity:null,reliability:null}',
  'state.review516.economic={cases','state.review516.capacity={cases',
  'state.review516.reliability={cases',
  'renderExceptionReview517();',
  'id="owner517Review"','id="owner517EconomicFilter"',
  'id="owner517SeasonalFilter"','id="owner517ReliabilityFilter"',
  'data-style="field-command"','QL-269 remains <strong>UNDER REVIEW</strong>'
])assert(ui.includes(marker),`Missing Build 517 recheck and access hook: ${marker}`);
for(const marker of [
  '.owner517-review .yw517-masthead',
  '.owner517-review .yw517-grid',
  '.owner517-review :is(select,summary,a):focus-visible',
  '@media(max-width:780px)',
  '.owner517-review .yw517-safeguard'
])assert(css.includes(marker),`Missing Build 517 field-style/accessibility rule: ${marker}`);
assert(html.match(/b22=517/g)?.length===2,'Build 517 JS/CSS release asset marker missing');
assert(pkg.scripts['test:build517']&&pkg.scripts['test:browser:build517'],'Build 517 package test gates missing');
assert(workflow.includes('npm run test:build517')&&workflow.includes('npm run test:browser:build517'),
  'Build 517 source/browser tests must run in protected staging CI');
console.log('Build 517 PASS: source-linked owner exception packets and accessible field-operations styling remain read-only.');
