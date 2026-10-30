import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const admin=read('js/platform-account-audit-490.js');
const gate=read('js/ql267-connection-exceptions-493.js');
const sql=read('supabase/migrations/20261030161707_legacy_role_evidence_493.sql');
for(const source of [owner,admin,gate])new Function(source);
for(const marker of ['previous_enabled===null','validAudit','query=query.eq',
 'query=query.gte','eq(\'company_id\',c.id)','Filter audit','assertCurrent()'])
 assert.ok(owner.includes(marker),`Owner audit: ${marker}`);
for(const marker of ['ywi_platform_legacy_evidence_list_493',
 'ywi_platform_legacy_evidence_record_493','UNVERIFIED_REFERENCE',
 'REVIEW PENDING','assertCurrent()'])assert.ok(admin.includes(marker),marker);
for(const marker of ['/api/integration/v1/health','/api/integration/v1/capabilities',
 "method:'GET'","credentials:'omit'",'owner_approval_required',
 "connection_status!=='HOLD'",'ywi:auth-changed'])assert.ok(gate.includes(marker),marker);
for(const marker of ['enable row level security','security definer set search_path = \'\'',
 'ywi_is_platform_administrator_489','revoke all on public.ywi_platform_legacy_evidence_493',
 "evidence_state = 'UNVERIFIED_REFERENCE'",'on conflict (profile_id,evidence_reference) do nothing'])
 assert.ok(sql.includes(marker),`SQL: ${marker}`);
assert.ok(!/grant\s+(?:select|insert|update|delete)\s+on\s+public\.ywi_platform_legacy_evidence_493/i.test(sql));
assert.ok(!/\.update\(|\.delete\(|\.upsert\(/.test(owner+admin+gate));
assert.ok(read('index.html').includes('ql267-connection-exceptions-493.js?v=20261030b493'));
assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run test:browser:build493'));
console.log('Build 493: tenant audit filters, restricted append-only evidence, QL-267 HOLD PASS');
