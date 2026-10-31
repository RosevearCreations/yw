import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=path=>readFileSync(path,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const admin=read('js/platform-account-audit-490.js');
const management=read('js/admin-owner-management-command-ui.js');
const styles=read('build494-command.css');
const index=read('index.html');
for(const code of [owner,admin,management])new Function(code);
for(const marker of ['presetKey=(uid,companyId)',"'yw:owner-audit-filters:v496:'",
 'validPreset','localStorage.getItem(key)','localStorage.setItem(key',
 'localStorage.removeItem(key)','Clear saved filters','currentIdentity(uid)',
 'verifiedIds.has(c.id)','No audit records stored'])
 assert.ok(owner.includes(marker),'Owner filters must persist safely: '+marker);
for(const marker of ['platform496Intake','Independent reviewer response intake',
 'UNVERIFIED_REFERENCE','Reported recommendation','MORE_EVIDENCE',
 'ywi_platform_legacy_evidence_record_493','assertCurrent()',
 'Owner decision NOT RECEIVED; no role change'])
 assert.ok(admin.includes(marker),'Unverified reviewer intake: '+marker);
assert.ok(!/\.(?:update|upsert|delete)\s*\(/.test(admin),
 'Reviewer intake must never modify authority');
for(const marker of ['owner496Navigator','owner496Search','Find a management card',
 'section.admin-panel-block','scrollIntoView','focus','No matching cards'])
 assert.ok(management.includes(marker),'Dashboard card navigator: '+marker);
for(const marker of ['yw496-dashboard-nav','yw496-dashboard-results','data-platform496-intake',
 '@media (max-width:700px)'])assert.ok(styles.includes(marker),'Responsive style: '+marker);
for(const path of ['build494-command.css','js/company-owner-workspace-490.js',
 'js/platform-account-audit-490.js'])
 assert.ok(index.includes(path+'?v=20261031b495&b=496'),'New asset cache key: '+path);
assert.ok(index.includes('admin-owner-management-command-ui.js?v=2026-10-12b386&b=496'));
const file='tests/browser/build496.spec.mjs';
assert.equal(spawnSync(process.execPath,['--check',file],{encoding:'utf8'}).status,0,
 'Build 496 browser suite must parse');
const pkg=JSON.parse(read('package.json'));
assert.ok(pkg.scripts['test:build496']&&pkg.scripts['test:browser:build496']);
const workflow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(workflow.includes('npm run test:build496')&&workflow.includes('npm run test:browser:build496'));
console.log('Build 496: owner/company device-local filters, unverified independent review intake, dashboard navigation PASS');
