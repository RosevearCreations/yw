import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const start=ui.indexOf('function renderEvidenceCommand519(){');
const end=ui.indexOf('function renderWorkabilityRecovery(){',start);
assert(start>0&&end>start,'Build 519 source overview must be installed after Build 518');
const impl=ui.slice(start,end);
for(const marker of ['state.review516','visible.jobs!==true','visible.finance!==true',
 'packet.cases.filter','packet.priorAt','packet.latestAt','c.trace','c.needed',
 'source_required','permission_hidden','source_compared','No matching change',
 'not an owner-signed closure','not a signed receipt','No zero-exception conclusion']){
 assert(impl.toLowerCase().includes(marker.toLowerCase()),'Missing 519 guard: '+marker);
}
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
 'Build 519 must not store, transmit or alter owner source records');
for(const marker of ['data-build="519"','id="owner519Overview"',
 'id="owner519ReviewFilter"','renderEvidenceCommand519();',
 "$('owner519ReviewFilter').addEventListener('change',renderEvidenceCommand519)",
 'QL-269 remains <strong>UNDER REVIEW</strong>']){
 assert(ui.includes(marker),'Missing 519 UI integration: '+marker);
}
for(const marker of ['.owner519-command .yw519-grid',
 '.owner519-command :is(a,select,summary):focus-visible',
 '.yw494-command .yw494-data-table th',
 '@media(max-width:780px)','@media(prefers-reduced-motion:reduce)']){
 assert(css.includes(marker),'Missing Build 519 style: '+marker);
}
assert((html.match(/b24=519/g)||[]).length===2,'Build 519 release markers absent');
assert(pkg.scripts['test:build519']&&pkg.scripts['test:browser:build519'],'Build 519 test scripts absent');
assert(workflow.includes('npm run test:build519')&&workflow.includes('npm run test:browser:build519'),
 'Build 519 gates must run in protected CI');
console.log('Build 519 PASS: management source-status overview, permission gates, read-only safeguards and accessible visual styling.');
