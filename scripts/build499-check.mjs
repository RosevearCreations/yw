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
for(const marker of ['BUILD 499','owner499ReceiptReview','owner499ReceiptStatus',
 'owner499ReceiptDetails','verifiedReceipt','clearReceipt','VERIFIED RECEIPT READY',
 'VERIFIED RECEIPT REVIEW','SESSION RECEIPT REVIEWED','currentIdentity(uid)',
 'verifiedIds.has(c.id)','found.data.some','validAudit(a,c.id)','No audit records stored'])
 assert.ok(owner.includes(marker),'Owner receipt review invariant: '+marker);
assert.ok(!/localStorage\.setItem\([^,]*receipt/i.test(owner),
 'Never persist server audit receipts on device');
for(const marker of ['BUILD 499','platform499RefreshAge','platform499Age',
 'firstSeen=new Map()','firstSeen.size>=12','observedAt=Date.now()',
 'RECHECK PRIORITY','JUST OBSERVED','Device-clock estimate only',
 'refreshAge.addEventListener','assertCurrent()','Owner decision NOT RECEIVED; no role change'])
 assert.ok(reviewer.includes(marker),'Reviewer exception aging invariant: '+marker);
assert.ok(!/\.(?:update|upsert|delete)\s*\(/.test(reviewer),
 'Reviewer exception aging must not modify role authority');
assert.ok(!reviewer.includes("ageStatus.setAttribute('role','status')"),
 'Preserve single restricted reviewer intake status for legacy browser contract');
for(const marker of ['owner499Retest','Retest keyboard navigation',
 'ACCESSIBILITY RETEST READY','retestAttempt++','resetAcceptance()',
 'LOCAL NAVIGATION CHECK COMPLETE','document.activeElement===section',
 'document.activeElement===input','Manual session-only acknowledgment'])
 assert.ok(management.includes(marker),'Management keyboard retest invariant: '+marker);
for(const marker of ['yw499-receipt-detail','yw499-age-state',
 'data-owner499-receipt-details][hidden]{display:none!important'])
 assert.ok(css.includes(marker),'Build 499 responsive receipt/age styling: '+marker);
for(const path of ['build494-command.css','js/company-owner-workspace-490.js',
 'js/platform-account-audit-490.js'])
 assert.ok(index.includes(path+'?v=20261031b495&b=496&b2=497&b3=498&b4=499'),
  'Build 499 cache revision: '+path);
assert.ok(index.includes('admin-owner-management-command-ui.js?v=2026-10-12b386&b=496&b2=497&b3=498&b4=499'));
assert.equal(spawnSync(process.execPath,['--check','tests/browser/build499.spec.mjs'],
 {encoding:'utf8'}).status,0,'Build 499 browser tests must parse');
const scripts=JSON.parse(read('package.json')).scripts;
assert.ok(scripts['test:build499']&&scripts['test:browser:build499']);
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(flow.includes('npm run test:build499')&&flow.includes('npm run test:browser:build499'));
console.log('Build 499: recovered audit receipt review, session-only reviewer exception aging and navigation retest PASS');
