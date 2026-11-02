import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const impl=ui.slice(ui.indexOf('function renderSourceReadiness510(){'),ui.indexOf('function renderWorkabilityRecovery(){'));
assert(impl.length>4000,'Build 510 requires all three readiness lanes');
for(const marker of ['visibility.jobs!==true','visibility.finance!==true','advanced(current.economics.at,prior.economics.at)',
  'current.economics.members','prior.economics.members','FIELD-TRACEABLE SOURCE DRIFT','MIXED SOURCE CONFIDENCE',
  'p.completionDate','SOURCE EXCEPTION QUEUE · NO CLOSURE','VERIFY DISAPPEARED LISTING',
  'advanced(current.capacity.jobsAt,prior.capacity.jobsAt)',"$('owner510GapFilter')",
  "['workability','dispatch','production']",'n.service_date!==p.service_date||n.season!==p.season',
  'Boolean(n.dispatchId||n.workOrderId)',"$('owner510FollowFilter')",
  'OWNER FOLLOW-UP READINESS · NO SIGNOFF','QL-269'])
  assert(ui.includes(marker),`Missing Build 510 safeguard: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 510 cannot issue new network requests, persist or mutate canonical evidence');
for(const marker of ['id="owner510Readiness"','id="owner510GapFilter"','id="owner510FollowFilter"','renderSourceReadiness510();'])
  assert(ui.includes(marker),`Missing Build 510 UI hook: ${marker}`);
assert(css.includes('.yw510-grid')&&css.includes('.owner510-readiness select:focus-visible')&&
  css.includes('@media(max-width:850px){.yw510-grid'),'Accessible responsive review cards required');
assert(html.match(/b15=510/g)?.length===2,'Both management assets must cache-bust Build 510');
assert(pkg.scripts['test:build510']&&pkg.scripts['test:browser:build510'],'Source and browser scripts required');
assert(workflow.includes('npm run test:build510')&&workflow.includes('npm run test:browser:build510'),
  'Protected source and browser CI gates required');
console.log('Build 510 PASS: source confidence, capacity exception queue, owner follow-up readiness and protected CI gates.');
