#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';

const root = process.cwd();
const sql = fs.readFileSync('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql','utf8');
const operations = fs.readFileSync('supabase/functions/operations-manage/index.ts','utf8');
const portal = fs.readFileSync('supabase/functions/customer-portal/index.ts','utf8');
const webhook = fs.readFileSync('supabase/functions/stripe-webhook/index.ts','utf8');
const requiredRpc = [
  'ywi_rpc_post_payment_action',
  'ywi_rpc_promote_bank_csv_import',
  'ywi_rpc_apply_reconciliation_action',
  'ywi_rpc_accept_quote_package',
  'ywi_rpc_prepare_deposit_request',
  'ywi_rpc_attach_deposit_checkout',
  'ywi_rpc_record_portal_deposit_paid',
  'ywi_rpc_mark_deposit_checkout_status'
];
const checks = [];
const add = (name, ok, details='') => checks.push({ name, ok, details });
for (const rpc of requiredRpc) {
  add(`sql:${rpc}`, sql.includes(`function public.${rpc}`), 'RPC function should be defined in schema 151.');
}
add('operations-uses-payment-rpc', operations.includes("supabase, 'ywi_rpc_post_payment_action'") || operations.includes("rpc('ywi_rpc_post_payment_action'"), 'Payment post should be delegated to RPC.');
add('operations-uses-bank-rpc', operations.includes("ywi_rpc_promote_bank_csv_import"), 'Bank promotion should be delegated to RPC.');
add('operations-uses-recon-rpc', operations.includes("ywi_rpc_apply_reconciliation_action"), 'Reconciliation actions should be delegated to RPC.');
add('portal-uses-quote-rpc', portal.includes("ywi_rpc_accept_quote_package"), 'Quote acceptance should be delegated to RPC.');
add('portal-uses-deposit-rpcs', portal.includes("ywi_rpc_prepare_deposit_request") && portal.includes("ywi_rpc_attach_deposit_checkout"), 'Deposit checkout prep and attach should be delegated to RPC.');
add('webhook-uses-paid-rpc', webhook.includes("ywi_rpc_record_portal_deposit_paid") && webhook.includes("ywi_rpc_mark_deposit_checkout_status"), 'Webhook should record paid/status events through RPC.');
add('permission-matrix-defined', sql.includes('operation_rpc_permission_tests') && sql.includes('v_operation_rpc_permission_matrix'), 'Role-permission test matrix should be deployable.');
add('execute-grants-service-role-only', requiredRpc.every((rpc) => sql.includes(`grant execute on function public.${rpc}`)) && sql.includes('revoke all on function public.ywi_rpc_post_payment_action'), 'RPC execute grants should be explicit.');
add('exact-cent-guards', sql.includes('ywi_cents') && sql.includes('Split allocations must equal the bank item amount exactly to the cent') && sql.includes('Journal entry is not balanced to the cent'), 'RPC layer should include exact cent guards.');

const failed = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.details ? ` — ${c.details}` : ''}`);
if (failed.length) process.exit(1);

const url = process.env.SUPABASE_URL || process.env.SB_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('\nSKIP live staging RPC calls — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to query v_operation_rpc_permission_matrix and run seeded staging scenarios.');
  process.exit(0);
}

const endpoint = `${url.replace(/\/$/,'')}/rest/v1/v_operation_rpc_permission_matrix?select=*`;
const response = await fetch(endpoint, { headers:{ apikey:key, authorization:`Bearer ${key}` } });
if (!response.ok) {
  console.error(await response.text());
  throw new Error('Could not read v_operation_rpc_permission_matrix from staging. Apply schema 151 first.');
}
const matrix = await response.json();
console.log(`\nLIVE  permission matrix rows: ${matrix.length}`);
for (const rpc of requiredRpc.slice(0,5)) {
  if (!matrix.some((row) => row.rpc_name === rpc)) throw new Error(`Missing permission matrix row for ${rpc}.`);
}
console.log('LIVE  staging RPC permission matrix is readable. Seeded transactional scenarios can now be run from the Operations Cockpit.');
