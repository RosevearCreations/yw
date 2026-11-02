import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const start=ui.indexOf('function renderOwnerContinuity511(){'),end=ui.indexOf('function renderWorkabilityRecovery(){');
const impl=ui.slice(start,end);
assert(start>0&&end>start&&impl.length>7000,'Build 511 must implement three owner review lanes');
for(const marker of ['visibility.jobs!==true','visibility.finance!==true',
  'advanced(later.economics.at,earlier.economics.at)','earlier.economics.members','later.economics.members',
  'CONFIDENCE EXCEPTION REVIEW · SOURCE ONLY','ID absent in one returned Jobs slice',
  "$('owner511ConfidenceFilter')",'advanced(later.capacity.at,earlier.capacity.at)',
  'advanced(later.capacity.jobsAt,earlier.capacity.jobsAt)','OWNER SOURCE HANDOFF · NOT SENT',
  'SOURCE LISTING DISAPPEARED',"$('owner511HandoffFilter')",
  "['workability','dispatch','production']",'n.service_date!==p.service_date||n.season!==p.season',
  'Boolean(n.dispatchId||n.workOrderId)','DECISION EVIDENCE CONTINUITY · NO APPROVAL',
  'Decision receipt remains not supplied',"$('owner511DecisionFilter')",'QL-269'])
  assert(impl.includes(marker)||ui.includes(marker),`Missing Build 511 evidence boundary: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 511 cannot write source records, persist handoffs or issue new network requests');
for(const marker of ['id="owner511Continuity"','id="owner511ConfidenceFilter"',
  'id="owner511HandoffFilter"','id="owner511DecisionFilter"','renderOwnerContinuity511();'])
  assert(ui.includes(marker),`Missing accessible Build 511 review hook: ${marker}`);
assert(css.includes('.yw511-grid')&&css.includes('.owner511-continuity select:focus-visible')&&
  css.includes('@media(max-width:850px){.yw511-grid'),'Responsive high-contrast review cards required');
assert(html.match(/b16=511/g)?.length===2,'Build 511 assets must both cache-bust');
assert(pkg.scripts['test:build511']&&pkg.scripts['test:browser:build511'],'Source and browser scripts required');
assert(workflow.includes('npm run test:build511')&&workflow.includes('npm run test:browser:build511'),
  'Build 511 checks must be in protected CI');
console.log('Build 511 PASS: confidence exception review, owner source handoff, decision evidence continuity and protected CI gates.');
