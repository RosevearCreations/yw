import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(path,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const reviewer=read('js/platform-account-audit-490.js');
const management=read('js/admin-owner-management-command-ui.js');
const css=read('build494-command.css');
const index=read('index.html');
for(const src of [owner,reviewer,management])new Function(src);
for(const mark of ['BUILD 504','owner504Handoff','owner504HandoffNote',
 'COPY-ONLY OWNER AUDIT COMPARISON REVIEW','selectedHistoryToken',
 'comparisonHistory.find','currentIdentity(uid)','verifiedIds.has(c.id)',
 'Owner-scope read: PENDING','Not saved, sent, approved or written to the server'])
 assert.ok(owner.includes(mark),'Owner handoff marker missing '+mark);
assert.ok(!/localStorage\.setItem\([^,]*(?:receipt|history|comparison)/i.test(owner),
 'Only filters may be saved on device, never audit comparisons');
for(const mark of ['BUILD 504','platform504ResolutionMatrix','resolutionMatrix.hidden=true',
 'resolutionMatrix.replaceChildren()','PENDING INDEPENDENT VERIFICATION',
 'PENDING RECONCILIATION','NOT RECEIVED','QL-269 UNDER REVIEW',
 'ywi_platform_legacy_evidence_list_493','queueRevision!==revision'])
 assert.ok(reviewer.includes(mark),'Reviewer decision matrix marker missing '+mark);
assert.ok(!/\.(?:insert|update|upsert)\s*\(/.test(reviewer),
 'Reviewer decision matrix must remain read-only');
for(const mark of ['Build 504','owner504ContrastPreference',
 'yw:management-high-contrast:v504','localStorage.getItem',
 'localStorage.setItem','HIGH CONTRAST RESTORED','aria-pressed',
 'event.altKey&&event.shiftKey','highContrastButton.click()'])
 assert.ok(management.includes(mark),'Management preference marker missing '+mark);
for(const mark of ['yw504-resolution-matrix','yw504-contrast-preference',
 'data-owner504-handoff-note][hidden]','data-platform504-resolution-matrix][hidden]'])
 assert.ok(css.includes(mark),'Build 504 style missing '+mark);
for(const path of ['build494-command.css','js/company-owner-workspace-490.js',
 'js/platform-account-audit-490.js'])
 assert.ok(index.includes(path+'?v=20261031b495&b=496&b2=497&b3=498&b4=499&b5=500&b6=501&b7=502&b8=503&b9=504'));
assert.ok(index.includes('admin-owner-management-command-ui.js?v=2026-10-12b386&b=496&b2=497&b3=498&b4=499&b5=500&b6=501&b7=502&b8=503&b9=504'));
const scripts=JSON.parse(read('package.json')).scripts;
assert.ok(scripts['test:build504']&&scripts['test:browser:build504']);
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(flow.includes('npm run test:build504')&&flow.includes('npm run test:browser:build504'));
assert.equal(spawnSync(process.execPath,['--check','tests/browser/build504.spec.mjs'],
 {encoding:'utf8'}).status,0,'Build 504 browser suite syntax');
console.log('Build 504: copy-only owner packet, reviewer gate matrix, device contrast recovery PASS');
