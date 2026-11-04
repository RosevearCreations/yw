import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync('js/owner-management-conflicts-523.js','utf8');
const css=readFileSync('build523-conflicts.css','utf8');
const html=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const staticBuild=readFileSync('scripts/build-vercel-site.mjs','utf8');
for(const marker of ['owner523ConflictReview','owner523Local','owner523Incoming',
  'owner523Backup','owner523Keep','owner523Replace','owner523Undo',
  'owner523FocusSeen','owner523ZoomSeen','owner523Assess','owner523AccessStatus',
  'stopImmediatePropagation','maxBytes=1024','schema','LOCAL OBSERVATIONS NOTED',
  'No owner sign-off','QL-269 remains'])
  assert(js.includes(marker),'Build 523 display-only conflict or acceptance contract missing: '+marker);
assert(!/\b(fetch|XMLHttpRequest)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(js),
  'Build 523 must not mutate network, source evidence or business records');
for(const marker of ['.yw523-conflicts',':focus-visible','@media(max-width:600px)',
  'prefers-reduced-motion'])assert(css.includes(marker),'Missing Build 523 styling: '+marker);
assert(html.includes('/js/owner-management-conflicts-523.js?v=20261104b523')&&
  html.includes('/build523-conflicts.css?v=20261104b523'),'Build 523 assets missing');
assert(staticBuild.includes("'build523-conflicts.css'"),'Static build must publish the Build 523 stylesheet');
assert(pkg.scripts['test:build523']&&pkg.scripts['test:browser:build523'],
  'Build 523 source and browser commands missing');
assert(workflow.includes('npm run test:build523')&&workflow.includes('npm run test:browser:build523'),
  'Protected GitHub staging workflow must execute both Build 523 checks');
console.log('Build 523 PASS: guarded view conflict, local recovery and non-certifying accessibility follow-up.');
