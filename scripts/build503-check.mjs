import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(path,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const reviewer=read('js/platform-account-audit-490.js');
const management=read('js/admin-owner-management-command-ui.js');
const css=read('build494-command.css');
const index=read('index.html');
for(const code of [owner,reviewer,management])new Function(code);
for(const mark of ['BUILD 503','owner503Drilldown','owner503DrillDetail',
 'previousSelection','currentSelection','SCOPE RECHECK PENDING','selectedHistoryToken',
 'showDrill(h)','currentIdentity(uid)','verifiedIds.has(c.id)','comparisonHistory.length>=5'])
 assert.ok(owner.includes(mark),'Owner comparison drill-down missing '+mark);
assert.ok(!/localStorage\.setItem\([^,]*(?:receipt|history|comparison)/i.test(owner),
 'Comparison summaries remain session-only');
for(const mark of ['BUILD 503','platform503ResolutionSelect','platform503Resolution',
 'platform503ResolutionStatus','platform503ResolutionNote','refreshResolution()',
 'queueRevision!==revision','ywi_platform_legacy_evidence_list_493',
 'RESOLUTION NOT READY','QL-269 UNDER REVIEW','No resolution or authority inferred'])
 assert.ok(reviewer.includes(mark),'Reviewer resolution guard missing '+mark);
assert.ok(!/\.(?:insert|update|upsert)\s*\(/.test(reviewer),
 'Reviewer resolution check cannot modify account authority');
for(const mark of ['Build 503','owner503HighContrast','owner503KeyboardCheck',
 'owner503KeyboardEvidence','yw503-high-contrast','aria-pressed',
 'HIGH-CONTRAST KEYBOARD FOLLOW-UP PASS','focusReturned','c.value>=7','focus>=3',
 'No formal certification or owner approval'])
 assert.ok(management.includes(mark),'Management high-contrast guard missing '+mark);
for(const mark of ['yw503-drill-detail','yw503-resolution-state','yw503-keyboard-summary',
 'data-platform503-resolution-note][hidden]','data-owner503-drill-detail][hidden]',
 '.yw503-high-contrast','--yw502-focus-color:#ffff00'])
 assert.ok(css.includes(mark),'Build 503 style missing '+mark);
for(const file of ['build494-command.css','js/company-owner-workspace-490.js',
 'js/platform-account-audit-490.js'])
 assert.ok(index.includes(file+'?v=20261031b495&b=496&b2=497&b3=498&b4=499&b5=500&b6=501&b7=502&b8=503'));
assert.ok(index.includes('admin-owner-management-command-ui.js?v=2026-10-12b386&b=496&b2=497&b3=498&b4=499&b5=500&b6=501&b7=502&b8=503'));
assert.equal(spawnSync(process.execPath,['--check','tests/browser/build503.spec.mjs'],
 {encoding:'utf8'}).status,0,'Build 503 browser suite syntax');
const scripts=JSON.parse(read('package.json')).scripts;
assert.ok(scripts['test:build503']&&scripts['test:browser:build503']);
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(flow.includes('npm run test:build503')&&flow.includes('npm run test:browser:build503'));
console.log('Build 503: comparison drill-down, selected exception resolution, high-contrast keyboard follow-up PASS');
