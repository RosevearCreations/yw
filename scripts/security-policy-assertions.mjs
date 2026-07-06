#!/usr/bin/env node
/** Source check plus optional service-role read of schema 155 policy assertions. */
import fs from 'node:fs';
import process from 'node:process';
const root = process.cwd();
const read = (file) => fs.readFileSync(`${root}/${file}`, 'utf8');
const sql153 = read('sql/153_release_fixture_policy_mapping_seo_alerts.sql');
const sql154 = read('sql/154_release_readiness_dashboard_and_evidence_snapshots.sql');
const sql155 = read('sql/155_live_job_updates_customer_timeline_and_visibility.sql');
const sql = `${sql153}\n${sql154}\n${sql155}`;
const upload = read('supabase/functions/upload-public-asset/index.ts');
const operations = read('supabase/functions/operations-manage/index.ts');
const portal = read('supabase/functions/customer-portal/index.ts');
const checks = [
  ['private-review-bucket', sql.includes("'review-assets','review-assets',false")],
  ['review-upload-handler', upload.includes("const BUCKET = 'review-assets'") && upload.includes('review_only:true')],
  ['approved-promotion-handler', operations.includes('publishApprovedAsset') && operations.includes("from('public-assets').upload")],
  ['rls-assertion-function', sql.includes('ywi_security_policy_assertions') && sql.includes('sensitive_tables_rls_enabled')],
  ['service-role-rpc-grants', sql155.includes('grant execute on function public.ywi_security_policy_assertions() to service_role')],
  ['no-direct-authenticated-live-update-views', sql155.includes('revoke all on public.v_customer_portal_live_updates, public.v_work_order_live_update_queue from anon, authenticated')],
  ['release-snapshot-private', sql154.includes('release_snapshot_rpc_not_public') && sql154.includes('revoke all on public.release_readiness_review_snapshots')],
  ['live-update-records-private', sql155.includes('work_order_live_updates enable row level security') && sql155.includes('work_order_live_update_media enable row level security') && sql155.includes('revoke all on public.work_order_live_updates')],
  ['live-update-rpcs-private', sql155.includes('live_update_rpcs_not_public') && sql155.includes('grant execute on function public.ywi_rpc_create_work_order_live_update')],
  ['portal-update-view-not-public', sql155.includes('revoke all on public.v_customer_portal_live_updates')],
  ['portal-function-uses-filtered-view', portal.includes('v_customer_portal_live_updates') && portal.includes('portalLiveUpdates')],
  ['staff-queue-service-role-only', sql155.includes('grant select on public.v_customer_portal_live_updates, public.v_work_order_live_update_queue to service_role')]
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
const url = (process.env.SUPABASE_URL || process.env.SB_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.log('\nSKIP live policy view — no staging service-role credentials supplied.');
  process.exit(0);
}
const response = await fetch(`${url}/rest/v1/v_security_policy_assertion_summary?select=*`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
const raw = await response.text();
if (!response.ok) { console.error(raw); process.exit(1); }
const row = JSON.parse(raw)?.[0] || {};
console.log(`\nLIVE  policy assertions: ${row.passed_count || 0}/${row.assertion_count || 0} passed.`);
if (row.policy_ready !== true) { console.error(JSON.stringify(row.assertions || [], null, 2)); process.exit(1); }
