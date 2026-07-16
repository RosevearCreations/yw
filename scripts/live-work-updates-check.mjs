#!/usr/bin/env node
/**
 * Schema 155 live-work-update contract within release schema 157.
 * Safe without credentials. Optional live read verifies the schema marker and
 * portal-safe view only when staging service-role credentials are supplied.
 */
import fs from 'node:fs';
import process from 'node:process';

const read = (file) => fs.readFileSync(file, 'utf8');
const sql = read('sql/155_live_job_updates_customer_timeline_and_visibility.sql');
const operations = read('supabase/functions/operations-manage/index.ts');
const portal = read('supabase/functions/customer-portal/index.ts');
const cockpit = read('js/operations-cockpit.js');
const customerUi = read('js/customer-portal.js');
const css = read('style.css');
const checks = [];
const add = (name, ok, details = '') => checks.push({ name, ok, details });
const hasAll = (text, values) => values.every((value) => text.includes(value));

add('schema155-transaction-balanced', (sql.match(/^begin;$/gmi) || []).length === 1 && (sql.match(/^commit;$/gmi) || []).length === 1, 'Schema 155 has one BEGIN and one COMMIT marker.');
add('schema155-live-update-tables', hasAll(sql, ['work_order_live_updates','work_order_live_update_media','visibility in (\'customer\',\'staff\')','update_status in (\'published\',\'retracted\')']), 'Live updates have visibility and retraction controls.');
add('schema155-customer-media-gate', hasAll(sql, ['Customer-visible updates may attach only approved assets with a public delivery URL.','v_customer_portal_live_updates','asset_status = \'approved\'']), 'Customer timeline only accepts approved public media.');
add('schema155-role-rpcs', hasAll(sql, ['ywi_rpc_create_work_order_live_update','ywi_rpc_retract_work_order_live_update','Only a site leader or higher may record a live work update.','Customer-visible updates require supervisor or higher.','Only a supervisor or higher may retract a live work update.']), 'Role safeguards are enforced inside RPCs.');
add('schema155-security-policy', hasAll(sql, ['live_update_rpcs_not_public','work_order_live_updates enable row level security','work_order_live_update_media enable row level security','revoke all on public.work_order_live_updates']), 'RLS and non-public RPC assertions cover live update records.');
add('operations-schema155-wiring', hasAll(operations, ["const SCHEMA = 157","v_work_order_live_update_queue","work_order_live_update_create","work_order_live_update_retract","ywi_rpc_create_work_order_live_update","ywi_rpc_retract_work_order_live_update"]), 'Operations Edge Function fetches and writes live updates through RPCs.');
add('portal-schema155-private-filter', hasAll(portal, ["const SCHEMA = 157","portalLiveUpdates","v_customer_portal_live_updates","live_updates: liveUpdates"]), 'Token portal returns only portal-safe update view data.');
add('cockpit-live-update-ui', hasAll(cockpit, ['Schema 157 field proof and customer update controls','oc_live_update_form','data-oc-work-order-select','data-oc-live-update-assets','renderLiveUpdateQueue','job-update-retract']), 'Cockpit supports explicit staff/customer update entry and retraction.');
add('portal-live-update-ui', hasAll(customerUi, ['liveUpdateTimeline','Live service updates','Staff-only notes, private review images, and internal costing are never shown here.']), 'Customer portal labels the trust boundary and renders a timeline.');
add('live-update-responsive-css', hasAll(css, ['.customer-portal-updates','.customer-portal-update-media-grid','.operations-cockpit .oc-live-update-card','@media(max-width:620px)']), 'Phone and desktop live-update styles are present.');

for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}${check.details ? ` — ${check.details}` : ''}`);
if (checks.some((check) => !check.ok)) process.exit(1);

const url = (process.env.SUPABASE_URL || process.env.SB_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.log('\nSKIP live schema 157 read — no staging service-role credentials supplied.');
  process.exit(0);
}
const headers = { apikey:key, authorization:`Bearer ${key}` };
async function get(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${raw}`);
  return raw ? JSON.parse(raw) : null;
}
try {
  const [schema, policy] = await Promise.all([
    get('v_schema_drift_status?select=expected_schema_version,latest_applied_schema_version,drift_status'),
    get('v_security_policy_assertion_summary?select=policy_ready,assertion_count,passed_count,assertions')
  ]);
  const schemaRow = schema?.[0] || {};
  if (Number(schemaRow.latest_applied_schema_version) < 155 || schemaRow.drift_status !== 'current') throw new Error(`Schema 157 is not current: ${JSON.stringify(schemaRow)}`);
  if (policy?.[0]?.policy_ready !== true) throw new Error(`Security policy assertions failed: ${JSON.stringify(policy?.[0] || {})}`);
  console.log(`\nLIVE  schema ${schemaRow.latest_applied_schema_version} is current; policy assertions are ready.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
