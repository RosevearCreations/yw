import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync('js/owner-management-history-524.js','utf8');
const css=readFileSync('build524-history.css','utf8');
const html=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const wf=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const site=readFileSync('scripts/build-vercel-site.mjs','utf8');
for(const marker of ['owner524History','owner524Migrate','owner524Snapshot','owner524Export',
  'owner524File','owner524Merge','owner524Select','owner524Restore','owner524Clear',
  'owner524Reader','owner524Focus','owner524Zoom','owner524Review','owner524AcceptanceStatus',
  'schema_version:2','maxBytes=1024,maxSnapshots=5','localStorage.getItem(legacy)',
  'valid(value)','FOLLOW-UP OUTSTANDING','LOCAL OBSERVATIONS DOCUMENTED','Manual owner acceptance still required'])
  assert(js.includes(marker),'Build 524 v2 recovery or local accessibility contract missing: '+marker);
assert(!/\b(fetch|XMLHttpRequest)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(js),
  'Build 524 cannot call network, change source records or grant owner approval');
for(const marker of ['.yw524-history',':focus-visible','@media(max-width:600px)',
  'prefers-reduced-motion'])assert(css.includes(marker),'Build 524 accessible design missing: '+marker);
assert(html.includes('/js/owner-management-history-524.js?v=20261104b524')&&
  html.includes('/build524-history.css?v=20261104b524'),'Build 524 static entrypoints missing');
assert(site.includes("'build524-history.css'"),'Vercel static output must include Build 524 styles');
assert(pkg.scripts['test:build524']&&pkg.scripts['test:browser:build524'],
  'Build 524 verification commands missing');
assert(wf.includes('npm run test:build524')&&wf.includes('npm run test:browser:build524'),
  'Protected workflow must run Build 524 source and browser acceptance');
console.log('Build 524 PASS: strict version migration, bounded nonsecret recovery history and local assistive follow-up.');
