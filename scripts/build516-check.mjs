import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const start=ui.indexOf('function renderTraceContinuity516(){'),end=ui.indexOf('function renderWorkabilityRecovery(){');
assert(start>0&&end>start&&end-start>8500,'Build 516 must implement three bounded trace and recheck lanes');
const impl=ui.slice(start,end);
for(const marker of [
  'access.jobs!==true','access.finance!==true','advanced(now.economics.at,past.economics.at)',
  'past.economics.members','now.economics.members','dateChanged=paired','cohortChanged',
  'SOURCE DISPOSITION TRACE CONTINUITY · UNDECIDED','DATE TRACE SHIFT · NOT DISPOSITION',
  'MISSING / INVALID SOURCE PAIR','advanced(now.capacity.at,past.capacity.at)',
  'advanced(now.capacity.jobsAt,past.capacity.jobsAt)','SCENARIO IDENTITY CONFLICT',
  'PERSISTENT ORIGINAL GAP','NEWLY RECORDED GAP','SOURCE CONDITION CHANGED · CLOSURE UNSIGNED',
  'SEASONAL CLOSURE PROOF EXCEPTIONS · OPEN',
  "['workability','dispatch','production']",'ageAt=(day,asOf)=>',
  'past.reliability.sources.production','now.reliability.sources.production',
  'newAge-oldAge','n.recovery_days==null','p.workOrderId!==n.workOrderId',
  'OWNER RECEIPT AGE RECHECK · UNSIGNED','not time since a receipt request',
  "$('owner516TraceFilter')","$('owner516ClosureFilter')","$('owner516ReceiptFilter')","$('owner516AgeFilter')"
])assert(impl.includes(marker),`Missing Build 516 source guard: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 516 must not persist, mutate, send follow-ups, assign work or create receipts');
for(const marker of ['id="owner516Continuity"','id="owner516TraceFilter"','id="owner516ClosureFilter"',
  'id="owner516ReceiptFilter"','id="owner516AgeFilter"','renderTraceContinuity516();',
  'QL-269 remains <strong>UNDER REVIEW</strong>'])assert(ui.includes(marker),`Missing Build 516 review hook: ${marker}`);
for(const marker of ['.yw516-grid','.yw516-queue summary','.owner516-continuity :is(select,summary,a):focus-visible',
  '@media(max-width:850px){.yw516-grid'])assert(css.includes(marker),`Missing Build 516 responsive/high-contrast style: ${marker}`);
assert(html.match(/b21=516/g)?.length===2,'Build 516 JS/CSS cache bust required');
assert(pkg.scripts['test:build516']&&pkg.scripts['test:browser:build516'],'Source/browser package gates required');
assert(workflow.includes('npm run test:build516')&&workflow.includes('npm run test:browser:build516'),
  'Protected Build 516 source/browser CI gates required');
console.log('Build 516 PASS: economic date trace, seasonal closure exceptions and source-time receipt age recheck remain read-only.');
