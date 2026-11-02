import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const start=ui.indexOf('function renderSourceFollowup513(){'),end=ui.indexOf('function renderWorkabilityRecovery(){');
const impl=ui.slice(start,end);
assert(start>0&&end>start&&impl.length>7000,'Build 513 requires three owner evidence follow-up lanes');
for(const marker of ['visibility.jobs!==true','visibility.finance!==true',
  'advanced(current.economics.at,prior.economics.at)','current.economics.members','prior.economics.members',
  'SOURCE RECHECK OUTCOMES · NOT DISPOSITION','No longer returned ID; deletion or economic loss cannot be inferred',
  "$('owner513OutcomeFilter')",'advanced(current.capacity.at,prior.capacity.at)',
  'advanced(current.capacity.jobsAt,prior.capacity.jobsAt)','GAP CLOSURE EVIDENCE CONDITIONS · OPEN',
  'independent owner-accepted closure evidence NOT SUPPLIED',"$('owner513ClosureFilter')",
  "['workability','dispatch','production']",'n.service_date!==p.service_date||n.season!==p.season',
  'Boolean(n.dispatchId||n.workOrderId)','OWNER RECEIPT EXCEPTION FOLLOW-UP · UNSIGNED',
  'independent signed owner receipt not supplied',"$('owner513ReceiptFilter')",'QL-269'])
  assert(impl.includes(marker)||ui.includes(marker),`Missing Build 513 safeguard: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 513 cannot persist or mutate source, create receipts or send handoffs');
for(const marker of ['id="owner513Followup"','id="owner513OutcomeFilter"','id="owner513ClosureFilter"',
  'id="owner513ReceiptFilter"','renderSourceFollowup513();'])
  assert(ui.includes(marker),`Missing accessible Build 513 review hook: ${marker}`);
assert(css.includes('.yw513-grid')&&css.includes('.owner513-followup select:focus-visible')&&
  css.includes('@media(max-width:850px){.yw513-grid'),'Responsive high-contrast cards required');
assert(html.match(/b18=513/g)?.length===2,'Build 513 JS and CSS cache markers required');
assert(pkg.scripts['test:build513']&&pkg.scripts['test:browser:build513'],'Source/browser scripts required');
assert(workflow.includes('npm run test:build513')&&workflow.includes('npm run test:browser:build513'),
  'Protected source/browser CI checks required');
console.log('Build 513 PASS: source outcome recheck, closure conditions, unsigned owner receipt follow-up and CI gates.');
