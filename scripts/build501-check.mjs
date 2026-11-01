import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=p=>readFileSync(p,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const reviewer=read('js/platform-account-audit-490.js');
const nav=read('js/admin-owner-management-command-ui.js');
const styles=read('build494-command.css');
const index=read('index.html');
for(const code of [owner,reviewer,nav])new Function(code);
for(const marker of ['BUILD 501','owner501History','owner501ScopeRecheck','owner501HistoryStatus',
 'owner501HistoryList','comparisonHistory=[]','comparisonHistory.length>=5',
 'VERIFIED OWNER SCOPE RECHECK','SCOPE RECHECK','COUNT INDETERMINATE',
 "eq('company_id',c.id)",'validAudit(a,c.id)','currentIdentity(uid)',
 'verifiedIds.has(c.id)','No audit records stored'])
 assert.ok(owner.includes(marker),'Build 501 receipt history/scope marker '+marker);
assert.ok(!/localStorage\.setItem\([^,]*(?:receipt|history|comparison)/i.test(owner),
 'Never persist audit receipt history to device');
for(const marker of ['BUILD 501','platform501PriorityQueue','platform501QueueStatus',
 'platform501QueueList','priorityQueue=new Map()','priorityQueue.size>=6',
 'queueBand','HIGH RECHECK','RECHECK DUE','ROUTINE RECHECK',
 'LOCAL REVIEWER PRIORITY QUEUE','assertCurrent()','legacyIds.has(x.profile_id)',
 'QL-269 — UNDER REVIEW','Owner decision NOT RECEIVED; no role change'])
 assert.ok(reviewer.includes(marker),'Build 501 priority queue marker '+marker);
assert.ok(!/\.(?:insert|update|upsert|delete)\s*\(/.test(reviewer),
 'Reviewer priority must not modify role authority');
for(const marker of ['Build 501','owner501MultiCardReview','owner501MultiCardEvidence',
 'multiButton.disabled','checkedAttempts','new Set(checkedAttempts.map',
 'MULTI-CARD ACCESSIBILITY REVIEW','cards.length<2','document.activeElement===section',
 'document.activeElement===input','no formal owner acceptance'])
 assert.ok(nav.includes(marker),'Build 501 multi-card accessibility marker '+marker);
for(const marker of ['yw501-history-state','yw501-queue-state','yw501-multicard-summary',
 'data-owner501-history-list][hidden]','data-platform501-queue-list][hidden]',
 'data-owner501-multi-card-evidence][hidden]'])
 assert.ok(styles.includes(marker),'Build 501 responsive/hidden state '+marker);
for(const path of ['build494-command.css','js/company-owner-workspace-490.js',
 'js/platform-account-audit-490.js'])
 assert.ok(index.includes(path+'?v=20261031b495&b=496&b2=497&b3=498&b4=499&b5=500&b6=501'));
assert.ok(index.includes('admin-owner-management-command-ui.js?v=2026-10-12b386&b=496&b2=497&b3=498&b4=499&b5=500&b6=501'));
assert.equal(spawnSync(process.execPath,['--check','tests/browser/build501.spec.mjs'],
 {encoding:'utf8'}).status,0,'Build 501 browser suite must parse');
const scripts=JSON.parse(read('package.json')).scripts;
assert.ok(scripts['test:build501']&&scripts['test:browser:build501']);
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(flow.includes('npm run test:build501')&&flow.includes('npm run test:browser:build501'));
console.log('Build 501: bounded receipt history, server scope recheck, local priority queue and distinct-card navigation PASS');
