import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(path,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const reviewer=read('js/platform-account-audit-490.js');
const nav=read('js/admin-owner-management-command-ui.js');
const css=read('build494-command.css');
const index=read('index.html');
for(const code of [owner,reviewer,nav])new Function(code);
for(const marker of ['BUILD 500','owner500ReceiptCompare','owner500CompareStatus',
 'owner500CompareDetails','lastReviewedReceipt','comparisonBaseline','receiptSequence',
 'TWO REVIEWED RECEIPTS READY','RECEIPT COUNT CHANGE REVIEW','COUNT INDETERMINATE',
 'NOT COMPARABLE: Reviewed receipt filters differ','currentIdentity(uid)',
 'verifiedIds.has(c.id)','prior.ownerId!==uid','current.ownerId!==uid',
 'No audit records stored'])assert.ok(owner.includes(marker),'Owner comparison marker '+marker);
assert.ok(!/localStorage\.setItem\([^,]*receipt/i.test(owner),'Do not persist receipt comparison');
for(const marker of ['BUILD 500','platform500Priority','platform500PriorityNote',
 'platform500PriorityStatus','priorityBand','HIGH RECHECK','RECHECK DUE',
 'ROUTINE RECHECK','QL-269 — UNDER REVIEW','COPY-ONLY','assertCurrent()',
 'priorityNote.readOnly=true','No signer trust, approval, role change',
 'ywi_platform_legacy_evidence_list_493'])
 assert.ok(reviewer.includes(marker),'Reviewer priority marker '+marker);
assert.ok(!/\.(?:insert|update|upsert|delete)\s*\(/.test(reviewer),
 'Reviewer priority must not modify roles or authority');
for(const marker of ['Build 500','owner500RetestSummary','owner500RetestEvidence',
 'checkedAttempts=[]','retestAttempt>=2','NAVIGATION RETEST EVIDENCE SUMMARY',
 'document.activeElement===section','document.activeElement===input',
 'No formal owner acceptance'])assert.ok(nav.includes(marker),'Navigation summary marker '+marker);
for(const marker of ['yw500-compare-state','yw500-compare-detail','yw500-priority-state',
 'yw500-nav-summary','data-owner500-compare-details][hidden]',
 'data-platform500-priority-note][hidden]','data-owner500-retest-evidence][hidden]'])
 assert.ok(css.includes(marker),'Build 500 responsive/accessibility style '+marker);
for(const path of ['build494-command.css','js/company-owner-workspace-490.js',
 'js/platform-account-audit-490.js'])
 assert.ok(index.includes(path+'?v=20261031b495&b=496&b2=497&b3=498&b4=499&b5=500'));
assert.ok(index.includes('admin-owner-management-command-ui.js?v=2026-10-12b386&b=496&b2=497&b3=498&b4=499&b5=500'));
assert.equal(spawnSync(process.execPath,['--check','tests/browser/build500.spec.mjs'],
 {encoding:'utf8'}).status,0,'Build 500 browser suite syntax');
const scripts=JSON.parse(read('package.json')).scripts;
assert.ok(scripts['test:build500']&&scripts['test:browser:build500']);
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(flow.includes('npm run test:build500')&&flow.includes('npm run test:browser:build500'));
console.log('Build 500: owner receipt count change, copy-only priority follow-up, manual navigation retest summary PASS');
