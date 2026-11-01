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
for(const mark of ['BUILD 502','owner502ScopeRecovery','owner502HistoryFilter',
 'Retry failed owner-scope recheck','FILTERED SESSION COMPARISON HISTORY',
 'comparisonHistory.length>=5','scopeState','scopeCheckedAt',
 "eq('company_id',c.id)",'validAudit(a,c.id)','verifiedIds.has(c.id)',
 'currentIdentity(uid)','No audit rows saved'])
 assert.ok(owner.includes(mark),'Owner recovery/filter marker '+mark);
assert.ok(!/localStorage\.setItem\([^,]*(?:receipt|history|comparison)/i.test(owner),
 'Receipt history must remain session-only');
for(const mark of ['BUILD 502','platform502Readiness','platform502ReadinessStatus',
 'platform502ReadinessPacket','queueRevision','FRESH LEDGER CHECK',
 'ywi_platform_legacy_evidence_list_493','RECHECK REQUIRED','assertCurrent()',
 'legacyIds.has(x.profile_id)','UNVERIFIED_REFERENCE','No role change follows'])
 assert.ok(reviewer.includes(mark),'Reviewer fresh-read readiness marker '+mark);
assert.ok(!/\.(?:insert|update|upsert)\s*\(/.test(reviewer),
 'Queue review never edits authority');
for(const mark of ['Build 502','owner502ContrastReview','owner502ContrastEvidence',
 'getComputedStyle','SAMPLED NAVIGATION CONTRAST PASS','CONTRAST REVIEW REQUIRED',
 '4.5','focus>=3','cards.length<2','checkedAttempts','document.activeElement===section',
 'document.activeElement===input','Not formal accessibility certification'])
 assert.ok(management.includes(mark),'Management contrast marker '+mark);
for(const mark of ['yw502-readiness-state','yw502-contrast-summary',
 'data-owner502-contrast-evidence][hidden]','data-platform502-readiness-packet][hidden]',
 'data-owner502-history-filter','--yw502-focus-color'])
 assert.ok(css.includes(mark),'Build 502 style marker '+mark);
for(const path of ['build494-command.css','js/company-owner-workspace-490.js',
 'js/platform-account-audit-490.js'])
 assert.ok(index.includes(path+'?v=20261031b495&b=496&b2=497&b3=498&b4=499&b5=500&b6=501&b7=502'));
assert.ok(index.includes('admin-owner-management-command-ui.js?v=2026-10-12b386&b=496&b2=497&b3=498&b4=499&b5=500&b6=501&b7=502'));
assert.equal(spawnSync(process.execPath,['--check','tests/browser/build502.spec.mjs'],
 {encoding:'utf8'}).status,0,'Build 502 browser suite parses');
const scripts=JSON.parse(read('package.json')).scripts;
assert.ok(scripts['test:build502']&&scripts['test:browser:build502']);
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(flow.includes('npm run test:build502')&&flow.includes('npm run test:browser:build502'));
console.log('Build 502: owner scope retry/history filters, fresh reviewer readiness, sampled navigation contrast PASS');
