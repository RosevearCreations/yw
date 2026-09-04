#!/usr/bin/env node
/** Build 209: make the existing transactional Operations contract a mandatory release authority. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const root = process.cwd();
const read = (path) => fs.readFileSync(path, 'utf8');
const hasAll = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok, detail });

// Run the previously dormant contract without allowing an ambient Production credential
// to turn a source gate into a live database check.
const childEnv = { ...process.env };
for (const key of ['SUPABASE_URL','SB_URL','SUPABASE_SERVICE_ROLE_KEY','SB_SERVICE_ROLE_KEY']) delete childEnv[key];
execFileSync(process.execPath, ['scripts/operations-rpc-integration-test.mjs'], {
  cwd: root,
  env: childEnv,
  stdio: 'inherit'
});

const workflow = read('.github/workflows/staging-browser-integration.yml');
const integration = read('scripts/operations-rpc-integration-test.mjs');
const operations = read('supabase/functions/operations-manage/index.ts');
const cockpit = read('js/operations-cockpit.js');
const portal = read('supabase/functions/customer-portal/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const sql151 = read('sql/151_transactional_rpc_accounting_reconciliation_quote_tests.sql');

const versions = fs.readdirSync('sql')
  .map((name) => Number(name.match(/^(\d+)_/)?.[1] || 0))
  .filter(Boolean);
const latestRepositorySchema = Math.max(...versions);

add('workflow-runs-build209-authority', workflow.includes('node scripts/transactional-operations-safety-enforcement-check.mjs'), 'The transactional safety authority is mandatory in source-checks.');
add('historical-contract-is-exercised', integration.includes('ywi_rpc_post_payment_action') && integration.includes('ywi_rpc_accept_quote_package') && integration.includes('STRIPE_WEBHOOK_SECRET'), 'The historical transactional integration contract remains the underlying audit test.');
add('high-risk-operations-delegate-to-rpcs', hasAll(operations, ['ywi_rpc_post_payment_action','ywi_rpc_promote_bank_csv_import','ywi_rpc_apply_reconciliation_action']), 'Payment, bank promotion and reconciliation remain server-RPC backed.');
add('portal-conversion-and-deposit-delegate-to-rpcs', hasAll(portal, ['ywi_rpc_accept_quote_package','ywi_rpc_prepare_deposit_request','ywi_rpc_attach_deposit_checkout']), 'Customer acceptance/deposit conversion remains RPC-backed.');
add('verified-provider-posting-boundary', hasAll(webhook, ['STRIPE_WEBHOOK_SECRET','crypto.subtle','ywi_rpc_record_portal_deposit_paid']), 'Provider payment state is accepted only through the verified webhook path.');
add('exact-cent-and-balanced-journal-guards', hasAll(sql151, ['Split allocations must equal the bank item amount exactly to the cent','Journal entry is not balanced to the cent']), 'Exact-cent reconciliation and balanced journals remain database-enforced.');
add('cockpit-permission-denial-is-visible', hasAll(cockpit, ["cap?.permitted === false",'aria-disabled','disabled','restricted']), 'Denied protected actions remain visibly disabled in the computer Operations workbench.');
add('cockpit-failure-preserves-retry-copy', hasAll(cockpit, ['saveRetry(payload, label)','A retry copy was saved on this device.']), 'Failed operator writes preserve a local retry copy instead of silently disappearing.');
add('release-snapshot-remains-review-only', hasAll(cockpit, ['REVIEW ONLY','No deployment was performed.']), 'Release evidence capture cannot masquerade as deployment.');
add('current-schema-authority-is-separate-from-feature-history', latestRepositorySchema >= 201, `Repository schema history reaches ${latestRepositorySchema}; old feature schema labels are not current release authority.`);
add('three-surface-regression-still-mandatory', hasAll(workflow, ['npm run test:three-surface','npm run test:browser:three-surface']), 'Phone, computer and public-web regression remains mandatory alongside Build 209.');

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
if (failed.length) process.exit(1);
console.log(`Build 209 transactional Operations safety authority passed (${checks.length}/${checks.length}).`);
