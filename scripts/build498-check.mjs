import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=p=>readFileSync(p,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const reviewer=read('js/platform-account-audit-490.js');
const management=read('js/admin-owner-management-command-ui.js');
const styles=read('build494-command.css');
const index=read('index.html');
for(const source of [owner,reviewer,management])new Function(source);
for(const marker of ['BUILD 498','owner498Verification','recoveredViewPending',
 'verifyArmed','RECOVERED VIEW READY','VERIFIED RECOVERED VIEW',
 'WITHHELD: Recovered view not verified by the server','describeSelection',
 'found.data.some','validAudit(a,c.id)','validUtcDate(date)',
 'currentIdentity(uid)','verifiedIds.has(c.id)','No audit records stored'])
 assert.ok(owner.includes(marker),'Owner recovered-view verification: '+marker);
for(const marker of ['BUILD 498','platform498Followup','platform498Note','platform498Status',
 'Prepare reviewer exception follow-up','markException','REFERENCE_NOT_FOUND',
 'RECONCILIATION_GAP','RESTRICTED_LEDGER_WITHHELD',
 'LOCAL FOLLOW-UP READY','assertCurrent()','Owner decision NOT RECEIVED; no role change',
 'ywi_platform_legacy_evidence_list_493'])
 assert.ok(reviewer.includes(marker),'Independent reviewer exception follow-up: '+marker);
assert.ok(!/\.(?:update|delete|upsert)\s*\(/.test(reviewer),
 'Reviewer follow-up must not modify role authority');
assert.ok(!reviewer.includes("followUpStatus.setAttribute('role','status')"),
 'Keep Build 496 reviewer intake status as the single role=status element');
for(const marker of ['owner498Return','owner498Accept','owner498Acceptance',
 'Return to management search','Mark local navigation check complete',
 'FOCUS VERIFIED','RETURN VERIFIED','LOCAL NAVIGATION CHECK COMPLETE',
 'document.activeElement===section','document.activeElement===input',
 'session-only acknowledgment'])
 assert.ok(management.includes(marker),'Management owner navigation check: '+marker);
for(const marker of ['yw498-verify-state','yw498-nav-review',
 'data-platform498-note]:not([hidden])','data-platform498-note][hidden]{display:none!important'])
 assert.ok(styles.includes(marker),'Build 498 responsive/focus styling: '+marker);
for(const path of ['build494-command.css','js/company-owner-workspace-490.js',
 'js/platform-account-audit-490.js'])
 assert.ok(index.includes(path+'?v=20261031b495&b=496&b2=497&b3=498'),
  'Build 498 asset cache revision: '+path);
assert.ok(index.includes('admin-owner-management-command-ui.js?v=2026-10-12b386&b=496&b2=497&b3=498'));
assert.equal(spawnSync(process.execPath,['--check','tests/browser/build498.spec.mjs'],
 {encoding:'utf8'}).status,0,'Build 498 browser suite syntax');
const scripts=JSON.parse(read('package.json')).scripts;
assert.ok(scripts['test:build498']&&scripts['test:browser:build498']);
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(flow.includes('npm run test:build498')&&flow.includes('npm run test:browser:build498'));
console.log('Build 498: server-verified recovered view, reviewer exception follow-up and manual navigation acceptance PASS');
