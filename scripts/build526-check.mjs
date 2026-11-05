import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync('js/owner-management-triage-526.js','utf8');
const retest=readFileSync('js/owner-management-retest-525.js','utf8');
const css=readFileSync('build526-triage.css','utf8');
const html=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const wf=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const site=readFileSync('scripts/build-vercel-site.mjs','utf8');
for(const mark of ['owner526Triage','owner526Compare','owner526Comparisons','owner526Device',
  'owner526Disposition','owner526Add','owner526Filter','owner526Findings','owner526Selected',
  'owner526Update','owner526Export','owner526Reset','owner526Status',
  'maxBytes=4096','maxFindings=6,maxComparisons=4','new Set(ids).size',
  'No owner approval was recorded','manual owner-review handoff','QL-269 stays'])
  assert(js.includes(mark),'Missing Build 526 contract: '+mark);
for(const mark of ['getComparison','getReviewedFinding','inspected:pending?','observations:{...draft.observations}'])
  assert(retest.includes(mark),'Build 525 safe readback missing: '+mark);
assert(!/\b(fetch|XMLHttpRequest)\s*\(|\.rpc\(|\.insert\(|\.delete\(/.test(js),
  'Build 526 must remain local-only without business or network writes');
for(const mark of ['.yw526-triage',':focus-visible','@media(max-width:760px)',
  'prefers-reduced-motion'])assert(css.includes(mark),'Missing Build 526 accessible style: '+mark);
assert(html.includes('/js/owner-management-triage-526.js?v=20261105b526')&&
  html.includes('/build526-triage.css?v=20261105b526'),'Build 526 assets not mounted');
assert(site.includes("'build526-triage.css'"),'Build 526 CSS not published');
assert(pkg.scripts['test:build526']&&pkg.scripts['test:browser:build526'],
  'Build 526 scripts missing');
assert(wf.includes('npm run test:build526')&&wf.includes('npm run test:browser:build526'),
  'Build 526 CI checks not protected');
console.log('Build 526 PASS: bounded provisional triage, local comparison history, device retest and accessible readback.');
