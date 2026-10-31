import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(path,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const reviewer=read('js/platform-account-audit-490.js');
const management=read('js/admin-owner-management-command-ui.js');
const styles=read('build494-command.css');
const index=read('index.html');
for(const source of [owner,reviewer,management])new Function(source);
for(const marker of ['recoveryKey=(uid,companyId)',"'yw:audit-filter-recovery:v497:'",
 'validUtcDate','parsePreset','localStorage.getItem(backupKey)',
 'localStorage.setItem(backupKey','localStorage.removeItem(backupKey)',
 'Recover saved filters','RECOVERY AVAILABLE','currentIdentity(uid)','verifiedIds.has(c.id)'])
 assert.ok(owner.includes(marker),'Owner recovery invariant missing: '+marker);
for(const marker of ['platform497Reconcile','Reconcile ticket against restricted ledger',
 'ywi_platform_legacy_evidence_list_493','expectedEntryId','NOT FOUND:',
 'RECONCILIATION GAP:','MATCHED 1 UNVERIFIED_REFERENCE',
 'Restricted ledger incomplete, foreign or inconsistent','assertCurrent()',
 'Owner decision NOT RECEIVED; no role change'])
 assert.ok(reviewer.includes(marker),'Reviewer reconciliation invariant missing: '+marker);
assert.ok(!/\.(?:update|delete|upsert)\s*\(/.test(reviewer),
 'Reviewer reconciliation must never change role authority');
for(const marker of ['owner497NavStatus','owner497NavResults','aria-live',
 'aria-controls','aria-describedby',"event.key==='Escape'", "event.key==='Enter'",
 'prefers-reduced-motion','scrollIntoView','section.focus'])
 assert.ok(management.includes(marker),'Accessible navigator invariant missing: '+marker);
for(const marker of ['yw496-dashboard-results button:focus-visible',
 'yw496-dashboard-nav button:disabled','prefers-reduced-motion:reduce'])
 assert.ok(styles.includes(marker),'Accessible CSS missing: '+marker);
for(const path of ['build494-command.css','js/company-owner-workspace-490.js',
 'js/platform-account-audit-490.js'])
 assert.ok(index.includes(path+'?v=20261031b495&b=496&b2=497'),
  'Asset cache revision missing: '+path);
assert.ok(index.includes('admin-owner-management-command-ui.js?v=2026-10-12b386&b=496&b2=497'));
assert.equal(spawnSync(process.execPath,['--check','tests/browser/build497.spec.mjs'],
 {encoding:'utf8'}).status,0,'Build 497 browser tests must parse');
const scripts=JSON.parse(read('package.json')).scripts;
assert.ok(scripts['test:build497']&&scripts['test:browser:build497']);
const workflow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(workflow.includes('npm run test:build497')&&workflow.includes('npm run test:browser:build497'));
console.log('Build 497: audit filter recovery, restricted reviewer reconciliation and management keyboard access PASS');
