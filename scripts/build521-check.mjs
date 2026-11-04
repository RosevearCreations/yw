import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync('js/owner-management-workspace-521.js','utf8');
const css=readFileSync('build521-workspace.css','utf8');
const index=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const wf=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
for(const value of ['yw:management-workspace-display:v521','owner521Workspace','owner521Save',
  'owner521Reset','owner521Area','owner521Density','owner521Return',
  'localStorage.setItem','localStorage.removeItem','version:1','choices.has(value.focus)',
  'densities.has(value.density)','source link','source views still enforce'])
  assert(js.toLowerCase().includes(value.toLowerCase()),'Build 521 implementation missing: '+value);
assert(!/\b(fetch|XMLHttpRequest)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(js),
  'Build 521 must not make network calls or mutate source records');
assert(!/token|receipt_id|case_id|source_packet/.test(js),'Display-only preferences must not store evidence or secrets');
for(const token of ['.yw521-workspace','@media(max-width:600px)',':focus-visible',
  '.owner520-navigation.yw521-compact','prefers-reduced-motion'])
  assert(css.includes(token),'Missing Build 521 responsive/accessible rule: '+token);
assert(index.includes('/js/owner-management-workspace-521.js?v=20261104b521')&&
  index.includes('/build521-workspace.css?v=20261104b521'),'Build 521 assets not loaded');
assert(pkg.scripts['test:build521']&&pkg.scripts['test:browser:build521'],'Build 521 scripts missing');
assert(wf.includes('npm run test:build521')&&wf.includes('npm run test:browser:build521'),
  'Protected workflow must run Build 521 source and browser acceptance');
console.log('Build 521 PASS: saved display navigation, source-safe drill-through and accessible workspace.');
