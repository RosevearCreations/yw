import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const wf=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const start=ui.indexOf('function renderManagementNavigation520(){');
const end=ui.indexOf('function renderWorkabilityRecovery(){',start);
assert(start>0&&end>start,'Build 520 navigation function must exist after Build 519');
const impl=ui.slice(start,end);
for(const token of ['state.review516','access.jobs!==true','access.finance!==true',
 'packet.cases.length','packet.priorAt','packet.latestAt',
 'focus===\'all\'','source_required','permission_hidden','source_compared',
 'No zero-exception claim','missing evidence is not clearance',
 'INDEPENDENT REVIEW · NOT APPROVED','source','#owner515Reconcile','#owner375Scenarios','#owner364Recovery',
 '#owner517Economic','#owner518Economic']){
  assert(impl.toLowerCase().includes(token.toLowerCase()),'Missing Build 520 source/nav contract: '+token);
}
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
 'Build 520 must not save, fetch extra data, send messages or mutate owner records');
for(const token of ['data-build="520"','id="owner520Title"','id="owner520Focus"',
 'id="owner520Navigation"','renderManagementNavigation520();',
 "$('owner520Focus').addEventListener('change',renderManagementNavigation520)",
 'QL-269 remains <strong>UNDER REVIEW</strong>'])
 assert(ui.includes(token),'Missing Build 520 UI/wiring: '+token);
for(const token of ['.owner520-navigation .yw520-grid',
 '.owner520-navigation :is(a,select):focus-visible',
 '.owner520-navigation .yw520-quick',
 '.owner520-navigation .yw520-process',
 '@media(max-width:770px)','@media(prefers-reduced-motion:reduce)'])
 assert(css.includes(token),'Missing Build 520 accessible visual rule: '+token);
assert((html.match(/b25=520/g)||[]).length===2,'Build 520 JS/CSS cache-bust markers missing');
assert(pkg.scripts['test:build520']&&pkg.scripts['test:browser:build520'],'Build 520 package tests missing');
assert(wf.includes('npm run test:build520')&&wf.includes('node scripts/build533-browser-hotspots.mjs 19'),
 'Protected staging CI must run source and browser Build 520 acceptance');
console.log('Build 520 PASS: guided Management navigation, source/permission boundaries and accessible style.');
