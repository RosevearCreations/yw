import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync('js/owner-management-retest-525.js','utf8');
const history=readFileSync('js/owner-management-history-524.js','utf8');
const css=readFileSync('build525-retest.css','utf8');
const html=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const wf=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const site=readFileSync('scripts/build-vercel-site.mjs','utf8');
for(const mark of ['owner525Retest','owner525Local','owner525Incoming','owner525Keep',
  'owner525Append','owner525Replace','owner525Undo','owner525Backup',
  'owner525Category','owner525Outcome','owner525Notes','owner525Review','owner525Export',
  'stopImmediatePropagation','maxBytes=1024','schema_version:1',
  'LOCAL RETEST OBSERVED','RETEST FOLLOW-UP REQUIRED','independent manual owner acceptance',
  'QL-269 remains'])assert(js.includes(mark),'Missing Build 525 contract: '+mark);
for(const mark of ['publicApi.getSnapshots','publicApi.replaceSnapshots','publicApi.discardPending',
  'valid(packet(items))'])assert(history.includes(mark),'Build 524 safe extension missing: '+mark);
assert(!/\b(fetch|XMLHttpRequest)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(js),
  'Build 525 must not write network, evidence or owner approval');
for(const mark of ['.yw525-retest',':focus-visible','@media(max-width:600px)',
  'prefers-reduced-motion'])assert(css.includes(mark),'Missing accessible Build 525 styles: '+mark);
assert(html.includes('/js/owner-management-retest-525.js?v=20261105b525')&&
  html.includes('/build525-retest.css?v=20261105b525'),'Build 525 entrypoints missing');
assert(site.includes("'build525-retest.css'"),'Build 525 static style not published');
assert(pkg.scripts['test:build525']&&pkg.scripts['test:browser:build525'],
  'Build 525 commands missing');
assert(wf.includes('npm run test:build525')&&wf.includes('npm run test:browser:build525'),
  'Protected workflow must run Build 525 checks');
console.log('Build 525 PASS: safe local recovery decisions, bounded draft exports and non-certifying retest workbench.');
