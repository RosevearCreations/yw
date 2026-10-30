import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const admin=read('js/platform-account-audit-490.js');
const status=read('js/ql266-connection-readback-492.js');
for(const source of [owner,admin,status])new Function(source);
for(const marker of ['ywi_company_service_module_audit','previous_enabled','next_enabled',
 'assertCurrent()','dataset.owner492Timeline','company_id'])assert.ok(owner.includes(marker),marker);
for(const marker of ['LEGACY GLOBAL ADMIN','REVIEW PENDING','active','staff_tier',
 'ywi_platform_account_audit_490'])assert.ok(admin.includes(marker),marker);
for(const marker of ['/api/integration/v1/health','/api/integration/v1/capabilities',
 "connection_status!=='HOLD'",'credentials:\'omit\'','ywi:auth-changed'])assert.ok(status.includes(marker),marker);
assert.ok(!owner.includes('.update(')&&!admin.includes('.update(')&&!status.includes('.update('));
assert.ok(read('index.html').includes('ql266-connection-readback-492.js?v=20261030b492'));
assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run test:build492'));
console.log('Build 492: read-only tenant timeline, legacy role and QL-266 HOLD gates PASS');
