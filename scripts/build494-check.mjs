import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const admin=read('js/platform-account-audit-490.js');
const gate=read('js/ql268-connection-gate-494.js');
const css=read('build494-command.css');
const sql=read('supabase/migrations/20261031003426_company_service_audit_summary_494.sql');
for(const source of [owner,admin,gate])new Function(source);
for(const marker of ['ywi_company_service_audit_summary_494','p_company_id:c.id',
 'Exact audit totals','moduleState.get(row.module_key)','assertCurrent()',
 'verifiedIds.has(c.id)','owner494Metrics'])
 assert.ok(owner.includes(marker),`Owner exact audit: ${marker}`);
for(const marker of ['platform494ReviewFilter','UNVERIFIED ONLY','NO REFERENCE',
 'ywi_platform_account_audit_490','ywi_platform_legacy_evidence_list_493',
 'Reconciled for review only'])assert.ok(admin.includes(marker),`Legacy reconciliation: ${marker}`);
for(const marker of ['/api/integration/v1/health','/api/integration/v1/capabilities',
 "method:'GET'","credentials:'omit'","redirect:'error'",'connection_status!==\'HOLD\'',
 'owner_approval_required','tenant_scope','service_module_scope','UNDER REVIEW',
 'No trial authorized'])assert.ok(gate.includes(marker),`QL-268: ${marker}`);
for(const marker of ['security invoker','owner_user_id = (select auth.uid())',
 'public.ywi_company_service_module_audit','p_company_id',
 'revoke all on function','to authenticated'])assert.ok(sql.includes(marker),`SQL: ${marker}`);
assert.ok(!/security definer/i.test(sql.replace(/--[^\n]*/g,'')));
assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(|method:\s*'POST'/.test(owner+admin+gate));
for(const marker of ['yw494-command','yw494-kpis','yw494-data-table',
 '.yw494-review-card[hidden]','@media (max-width:700px)'])assert.ok(css.includes(marker),marker);
const index=read('index.html');
for(const url of ['build494-command.css?v=20261031b495',
 'company-owner-workspace-490.js?v=20261031b495',
 'platform-account-audit-490.js?v=20261031b495',
 'ql268-connection-gate-494.js?v=20261031b495'])assert.ok(index.includes(url),url);
const pkg=JSON.parse(read('package.json'));
assert.ok(pkg.scripts['test:build494']&&pkg.scripts['test:browser:build494']);
const workflow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(workflow.includes('npm run test:build494'));
assert.ok(workflow.includes('npm run test:browser:build494'));
console.log('Build 494 foundations: owner exact audit, legacy reconciliation, deny-by-default gate and command design PASS');
