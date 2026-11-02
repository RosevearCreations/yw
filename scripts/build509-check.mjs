import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const impl=ui.slice(ui.indexOf('function renderDriftSourceTrace509(){'),ui.indexOf('function renderWorkabilityRecovery(){'));
assert(impl.length>5000,'Build 509 must implement all three evidence trace lanes');
for(const marker of ['visibility.jobs!==true','visibility.finance!==true',
  'current.economics.members','prev.economics.members','new in returned Jobs source',
  'current eligibility:', 'dated cohort reassignment (window or source date)',
  'GAP SOURCE TRACE · NOT RESOLUTION','Configured route headroom now recorded:',
  'Missing-assumption text no longer listed','ready(current.capacity.at,prev.capacity.at)',
  "['workability','dispatch','production']",'Number(n.recovery_days)>=0',
  'Boolean(n.dispatchId||n.workOrderId)','Source identity date/season changed',
  'Not returned by current bounded source; closure cannot be inferred.',
  'QL-269 UNDER REVIEW'])
  assert(ui.includes(marker),`Missing Build 509 evidence boundary: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 509 cannot issue network calls, persist evidence or mutate operations');
assert(ui.includes('id="owner509Trace"')&&ui.includes('id="owner509StateFilter"'),
  'Build 509 requires mounted review and accessible filter');
assert(css.includes('.yw509-grid')&&css.includes('.owner509-trace select:focus-visible')&&
  css.includes('@media(max-width:850px){.yw509-grid'),
  'Build 509 needs responsive and keyboard-focused cards');
assert(html.match(/b14=509/g)?.length===2,'Build 509 must cache-bust JS and CSS');
assert(pkg.scripts['test:build509']&&pkg.scripts['test:browser:build509'],
  'Build 509 source/browser scripts are required');
assert(workflow.includes('npm run test:build509')&&workflow.includes('npm run test:browser:build509'),
  'Build 509 must pass protected source/browser gates');
console.log('Build 509 PASS: evidence-classified cohort drift, scenario source trace, read-only reliability reconciliation and protected CI gates.');
