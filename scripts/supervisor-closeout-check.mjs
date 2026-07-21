#!/usr/bin/env node
/** Static contract checks for schema 158 supervisor closeout/signoff/invoice follow-up. */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const hasAll = (text, values) => values.every((value) => text.includes(value));
const results = [];
const add = (name, ok, details = '') => results.push({ name, ok, details });

const migration = read('sql/158_supervisor_closeout_customer_signoff_invoice_followup.sql');
const schema = read('sql/000_full_schema_reference.sql');
const ops = read('supabase/functions/operations-manage/index.ts');
const portal = read('supabase/functions/customer-portal/index.ts');
const cockpit = read('js/operations-cockpit.js');
const customerPortal = read('js/customer-portal.js');
const css = read('style.css');
const docs = read('docs/NEXT_STEPS_AND_SANITY_CHECK.md') + '\n' + read('docs/ACTIVE_PROJECT_HANDBOOK.md');

add('schema158-migration-file-present', migration.startsWith('begin;') && migration.trim().endsWith('commit;'), 'Migration has transaction markers.');
add('schema158-closeout-tables', hasAll(migration, [
  'work_order_closeout_packages',
  'work_order_closeout_gallery_items',
  'work_order_customer_closeout_signoffs',
  'work_order_review_requests',
  'work_order_maintenance_followups'
]), 'Closeout, gallery, signoff, review, and follow-up tables exist.');
const portalView = migration.slice(migration.indexOf('create view public.v_customer_portal_closeout_packages'), migration.indexOf('revoke all on public.v_work_order_closeout_queue'));
add('schema158-portal-safe-view', hasAll(portalView, [
  'v_customer_portal_closeout_packages',
  'cp.customer_summary',
  'jsonb_agg',
  "va.asset_status='approved'",
  "coalesce(va.public_url,'') <> ''"
]) && !/(total_actual_cost|margin_amount|staff_closeout_notes|labour_cost_total|material_cost_total)/.test(portalView), 'Portal view exposes approved summary/gallery only, not cost or staff fields.');
add('schema158-internal-queue', hasAll(migration, [
  'v_work_order_closeout_queue',
  'total_actual_cost',
  'margin_amount',
  'margin_percent',
  'closeout_message'
]), 'Internal queue includes closeout readiness and cost comparison for staff review.');
add('schema158-rpcs', hasAll(migration, [
  'ywi_rpc_submit_work_order_closeout_package',
  'ywi_rpc_decide_work_order_closeout_package',
  'ywi_rpc_customer_sign_work_order_closeout',
  'Supervisor or higher is required',
  'Customer signoff is required before invoice readiness.'
]), 'Submit, decide, and customer signoff RPCs enforce workflow boundaries.');
add('schema158-private-grants', hasAll(migration, [
  'revoke all on public.work_order_closeout_packages',
  'revoke all on function public.ywi_rpc_submit_work_order_closeout_package',
  'grant execute on function public.ywi_rpc_customer_sign_work_order_closeout',
  'closeout_tables_not_public',
  'closeout_rpcs_not_public'
]), 'Closeout tables/functions are not directly available to browser roles.');
add('schema158-reference-includes-migration', schema.includes('-- BEGIN MIGRATION: 158_supervisor_closeout_customer_signoff_invoice_followup') && schema.includes(migration.trim()), 'Full schema reference includes schema 158 verbatim.');

add('operations-closeout-actions', hasAll(ops, [
  "const BUILD = '2026-07-17a'",
  'const SCHEMA = 158',
  "closeouts: 'v_work_order_closeout_queue'",
  "action === 'work_order_closeout_submit'",
  'ywi_rpc_submit_work_order_closeout_package',
  "action === 'work_order_closeout_decision'",
  'ywi_rpc_decide_work_order_closeout_package'
]), 'Operations function exposes role-checked closeout submit/decision actions.');
add('portal-closeout-action', hasAll(portal, [
  "const BUILD = '2026-07-17a'",
  'const SCHEMA = 158',
  'portalCloseoutPackages',
  'v_customer_portal_closeout_packages',
  "action === 'sign_closeout'",
  'ywi_rpc_customer_sign_work_order_closeout',
  'closeouts,'
]), 'Customer portal loads closeout packages and routes customer signoff through RPC.');
add('cockpit-closeout-ui', hasAll(cockpit, [
  'renderCloseoutQueue',
  'oc_closeout_form',
  'data-oc-closeout-before-assets',
  'data-oc-closeout-after-assets',
  'closeout-approve',
  'closeout-invoice',
  'Customer-safe summary'
]), 'Cockpit includes closeout form, before/after selector, and decision buttons.');
add('customer-portal-closeout-ui', hasAll(customerPortal, [
  'closeoutPackagePanel',
  'Approve completed work',
  'Request follow-up',
  'Internal labour, material, equipment, margin, staff notes, and private review images are never shown in this customer portal.',
  "action:'sign_closeout'"
]), 'Customer portal supports final approval/follow-up request without showing internal costs.');
add('closeout-responsive-css', hasAll(css, [
  '.operations-cockpit .oc-closeout-card',
  '.customer-portal-closeout',
  '.customer-portal-closeout-gallery',
  '.customer-portal-closeout-form',
  '@media(max-width:620px)'
]), 'Closeout surfaces have responsive CSS.');
add('docs-test-guide-closeout', hasAll(docs, ['schema 158', 'Supervisor closeout', 'customer signoff', 'invoice readiness', 'maintenance follow-up']), 'Active docs explain schema 158 and testing.');

const passed = results.filter((item) => item.ok).length;
console.log(`\nSupervisor closeout contract: ${passed}/${results.length} passed\n`);
for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
process.exit(results.some((item) => !item.ok) ? 1 : 0);
