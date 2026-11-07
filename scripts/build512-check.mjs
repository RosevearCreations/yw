import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const start=ui.indexOf('function renderEvidenceDisposition512(){'),end=ui.indexOf('function renderWorkabilityRecovery(){');
const impl=ui.slice(start,end);
assert(start>0&&end>start&&impl.length>7000,'Build 512 must implement all three evidence lanes');
for(const marker of ['visibility.jobs!==true','visibility.finance!==true',
  'advanced(current.economics.at,prior.economics.at)','current.economics.members','prior.economics.members',
  'PROPOSED SOURCE DISPOSITION · NOT ADJUDICATED','Not returned now; cannot infer economic loss or deletion',
  "$('owner512DispositionFilter')",'advanced(current.capacity.at,prior.capacity.at)',
  'advanced(current.capacity.jobsAt,prior.capacity.jobsAt)','HANDOFF SOURCE RECHECK · NO CLOSURE',
  'Configured route headroom before / after',"$('owner512GapFilter')",
  "['workability','dispatch','production']",'n.service_date!==p.service_date||n.season!==p.season',
  'Boolean(n.dispatchId||n.workOrderId)','DECISION RECEIPT READINESS · NOT SIGNED',
  'owner decision receipt NOT SUPPLIED',"$('owner512ReceiptFilter')",'QL-269'])
  assert(impl.includes(marker)||ui.includes(marker),`Missing Build 512 evidence boundary: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 512 cannot persist a disposition, send handoffs or mutate canonical sources');
for(const marker of ['id="owner512Disposition"','id="owner512DispositionFilter"','id="owner512GapFilter"',
  'id="owner512ReceiptFilter"','renderEvidenceDisposition512();'])
  assert(ui.includes(marker),`Missing Build 512 accessible review hook: ${marker}`);
assert(css.includes('.yw512-grid')&&css.includes('.owner512-disposition select:focus-visible')&&
  css.includes('@media(max-width:850px){.yw512-grid'),'Responsive, keyboard-visible cards required');
assert(html.match(/b17=512/g)?.length===2,'Build 512 JS and CSS cache markers required');
assert(pkg.scripts['test:build512']&&pkg.scripts['test:browser:build512'],'Source and browser scripts required');
assert(workflow.includes('npm run test:build512')&&workflow.includes('node scripts/build533-browser-hotspots.mjs 18'),
  'Protected source/browser CI checks required');
console.log('Build 512 PASS: proposed source disposition, before/after gap recheck, unsigned owner receipt readiness and CI gates.');
