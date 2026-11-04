import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync('js/owner-management-portability-522.js','utf8');
const css=readFileSync('build522-portability.css','utf8');
const html=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const wf=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
for(const token of ['owner522Portability','owner522Export','owner522Import','owner522Apply',
 'owner522Discard','owner522Recover','owner522Start','owner522Review',
 'maxBytes=1024','schema_version:1','validPacket','File','file.text()',
 'Apply inspected view','LOCAL NAVIGATION OBSERVED','Manual device/assistive-technology acceptance'])
 assert(js.includes(token),'Build 522 portability or navigation contract missing: '+token);
assert(!/\b(fetch|XMLHttpRequest)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(js),
  'Build 522 must not perform network, source or business mutations');
for(const token of ['.yw522-portability',':focus-visible','@media(max-width:600px)',
  'prefers-reduced-motion'])assert(css.includes(token),'Missing Build 522 accessible styling: '+token);
assert(html.includes('/js/owner-management-portability-522.js?v=20261104b522')&&
  html.includes('/build522-portability.css?v=20261104b522'),'Build 522 assets not loaded');
assert(pkg.scripts['test:build522']&&pkg.scripts['test:browser:build522'],'Build 522 test scripts missing');
assert(wf.includes('npm run test:build522')&&wf.includes('npm run test:browser:build522'),
  'Protected staging workflow must run Build 522 source and browser checks');
console.log('Build 522 PASS: validated portable display views, local recovery and manual navigation acceptance.');
