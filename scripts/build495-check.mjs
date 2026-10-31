import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(path,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const admin=read('js/platform-account-audit-490.js');
const review=read('js/ql268-connection-gate-494.js');
const css=read('build494-command.css');
const index=read('index.html');
const policy=read('docs/integration/ql269-review-pause.md');
for(const source of [owner,admin,review])new Function(source);
for(const marker of ['data','yw495-preset-bar','Last 7 days','Enables only','Disables only',
 'Save my current filters','Apply saved filters','savedPreset',
 'verifiedIds.has(c.id)','assertCurrent()','filter.click()'])
 assert.ok(owner.includes(marker),'Owner audit preset: '+marker);
for(const marker of ['platform495Handoff','Prepare read-only handoff','Requested review question',
 'Original source proof: NOT VERIFIED','Independent signer custody: NOT VERIFIED',
 'Owner decision: NOT RECEIVED','No privileged role changes','assertCurrent()'])
 assert.ok(admin.includes(marker),'Legacy authority handoff: '+marker);
for(const marker of ['QL-269 PAUSED','UNDER REVIEW','Aging clock','PAUSED',
 'connection_status!==\'HOLD\'','owner_approval_required',
 "method:'GET'","credentials:'omit'","redirect:'error'",'No trial authorized'])
 assert.ok(review.includes(marker),'Paused connection review: '+marker);
assert.ok(!/\b(fetch\s*\(|\.rpc\s*\(|\.update\s*\()/.test(owner.slice(owner.indexOf('const presets=node'),owner.indexOf('const events=node'))),
 'Owner presets must set filters, not call unaudited APIs directly');
assert.ok(!/\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/.test(admin),
 'Legacy decision handoff may not mutate authority');
assert.ok(!/\bmethod:\s*['"](POST|PUT|PATCH|DELETE)['"]/.test(review),
 'Connection review cannot write or authorize');
for(const marker of ['UNDER REVIEW — PAUSED','connection_status: HOLD',
 'capabilities, events and commands remain disabled','No automatic GET polling'])
 assert.ok(policy.includes(marker),'Connection review safety boundary: '+marker);
for(const path of ['build494-command.css','js/company-owner-workspace-490.js',
 'js/platform-account-audit-490.js','js/ql268-connection-gate-494.js'])
 assert.ok(index.includes(path+'?v=20261031b495'),'Cache-busted Build 495 asset: '+path);
for(const marker of ['yw495-preset-bar','textarea:focus-visible','data-gate-state="review"'])
 assert.ok(css.includes(marker),'Responsive review styling: '+marker);
const tests='tests/browser/build495.spec.mjs';
assert.equal(spawnSync(process.execPath,['--check',tests],{encoding:'utf8'}).status,0,
 'Build 495 browser tests must parse');
const pkg=JSON.parse(read('package.json'));
assert.ok(pkg.scripts['test:build495']&&pkg.scripts['test:browser:build495']);
const workflow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(workflow.includes('npm run test:build495')&&workflow.includes('npm run test:browser:build495'));
console.log('Build 495: owner review presets, reference-only authority handoff and paused QL-269 operator review PASS');
