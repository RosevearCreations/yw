#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/179_finance_permissions_acceptance_release_hardening.sql');
const reviewEdge=read('supabase/functions/finance-job-completion-review/index.ts');
const postingEdge=read('supabase/functions/finance-job-completion-posting-approval/index.ts');
const adminIt=read('supabase/functions/admin-it-control/index.ts');
const financeUi=read('js/finance-ui.js');
const itUi=read('js/it-readiness-ui.js');
const config=read('supabase/config.toml');
const fixture=read('tests/fixtures/finance-release-hardening-fixtures.mjs');
const browser=read('tests/browser/finance-release-hardening.spec.mjs');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

for(const token of [
  'finance_release_acceptance_scenarios','ywi_finance_release_hardening_assertions',
  'v_it_finance_release_hardening_status','finance_permission_rank_order',
  'finance_admin_break_glass_manage','finance_protected_rpcs_service_only',
  'finance_execution_release_private_and_off','finance_provider_mutation_closed',
  'finance_account_mapping_human_control','finance_schema_dependencies_current',
  'finance_reconciliation_no_critical_divergence','finance_no_jobs_writeback_in_finance_rpcs',
  "179,'179_finance_permissions_acceptance_release_hardening'",'select 179::int as expected_schema_version'
]) assert.ok(migration.includes(token),`Schema 179 migration missing ${token}`);

for(const level of ['hidden','view','create','approve','manage','admin_break_glass','server_control']) assert.ok(migration.includes(`'${level}'`),`Schema 179 acceptance registry missing ${level}`);
for(const scenario of ['hidden_list_denied','view_list_allowed','create_disposition_denied','approve_disposition_allowed','approve_execution_server_gated','manage_reversal_allowed','direct_financial_truth_rejected','browser_release_toggle_rejected','provider_mutation_closed']) assert.ok(migration.includes(`'${scenario}'`),`Schema 179 scenario missing ${scenario}`);
assert.ok(/revoke all on table public\.finance_release_acceptance_scenarios from public,anon,authenticated/i.test(migration),'Acceptance contracts must remain private.');
assert.ok(!/execution_enabled\s*=\s*true/i.test(migration),'Schema 179 must not enable Finance posting execution.');
assert.ok(!/provider_mutation_enabled\s*=\s*true/i.test(migration),'Schema 179 must not enable provider mutation.');
assert.ok(!/update\s+public\.(?:jobs|work_orders)\b/i.test(migration),'Schema 179 migration must not write Jobs/work-order state.');

for(const edge of [reviewEdge,postingEdge]){
  assert.ok(edge.includes('effectiveModuleAccess'),'Protected Finance endpoint must expose server-resolved access level.');
  assert.ok(edge.includes('hasModuleAccess(supabase, actorProfile, "finance", "view")'),'Protected Finance endpoint must require Finance view access.');
  assert.ok(edge.includes('access_level: await effectiveModuleAccess'),'Protected Finance endpoint must return exact server access level.');
  assert.ok(edge.includes('can_create: await hasModuleAccess'),'Protected Finance endpoint must report create authority.');
  assert.ok(edge.includes('can_approve: await hasModuleAccess'),'Protected Finance endpoint must report approve authority.');
  assert.ok(edge.includes('can_manage: await hasModuleAccess'),'Protected Finance endpoint must report manage authority.');
}
assert.ok(reviewEdge.includes('SERVER_OWNED_FINANCIAL_FIELDS'),'Completion review must reject browser financial truth fields.');
assert.ok(postingEdge.includes('SERVER_OWNED_POSTING_FIELDS'),'Posting endpoint must reject browser posting/provider truth fields.');
assert.ok(postingEdge.includes('action === "execute_posting"')&&postingEdge.includes('"finance", "approve"'),'Execution route requires Finance approve before database release gate.');
assert.ok(postingEdge.includes('action === "reverse_posting"')&&postingEdge.includes('"finance", "manage"'),'Reversal route requires Finance manage.');
assert.ok(postingEdge.includes('provider_mutation: false'),'Posting endpoint must keep provider mutation false.');

assert.ok(/\[functions\.finance-job-completion-review\]\s+verify_jwt = true/s.test(config),'Completion-review Edge JWT verification must be explicit.');
assert.ok(/\[functions\.finance-job-completion-posting-approval\]\s+verify_jwt = true/s.test(config),'Posting Edge JWT verification must remain explicit.');

for(const token of ['finance_release_hardening','ywi_finance_release_hardening_assertions','financeReleaseHardeningAssertions']) assert.ok(adminIt.includes(token),`Admin I.T. endpoint missing ${token}`);
for(const token of ["panel('finance_operational'","panel('finance_reconciliation'","panel('finance_release_hardening'",'groups.finance_operational','groups.finance_release_hardening']) assert.ok(itUi.includes(token),`I.T. UI missing ${token}`);
assert.ok(financeUi.includes('Schema 179 Finance module home.')&&financeUi.includes('<strong>Schema 179 boundary:</strong>'),'Finance UI must display current Schema 179 boundary.');
assert.ok(financeUi.includes('execution_authorized === true')&&financeUi.includes('execution_release_enabled === true'),'Browser execution button must require both server authorization and server release truth.');
assert.ok(financeUi.includes("payload?.action === 'reverse_posting' && !canManage()"),'Browser reversal must remain manage-only.');

for(const token of ['ACCESS_RANK','OPERATIONAL_LIFECYCLE','awaiting_review','awaiting_posting_approval','preflight_blocked','recovery_required','posted','reversed','execution_release_enabled:false','provider_mutation_authorized:false']) assert.ok(fixture.includes(token),`Synthetic fixture missing ${token}`);
assert.ok(!/fetch\(|supabase|stripe|paypal_order|payment_intent/i.test(fixture),'Synthetic fixtures must remain deterministic/in-memory and free of network/provider effects.');
for(const level of ['hidden','view','create','approve','manage']) assert.ok(browser.includes(`'${level}'`),`Rendered Finance acceptance missing ${level}`);
for(const token of ['execute_posting','reverse_posting','AR_ACCOUNT_MAPPING_NOT_APPROVED','POSTING_RECOVERY_REQUIRED','Finance release hardening','non-admin cannot render I.T. readiness']) assert.ok(browser.includes(token),`Rendered Build 179 acceptance missing ${token}`);

assert.ok(pkg.includes('"test:finance-release-hardening"'),'package.json must expose the Schema 179 source gate.');
assert.ok(pkg.includes('"test:browser:finance"'),'package.json must expose rendered Finance acceptance.');
assert.ok(workflow.includes('npm run test:finance-release-hardening'),'CI must execute the Schema 179 source gate.');
assert.ok(workflow.includes('npm run test:browser:finance'),'CI must execute rendered Build 179 Finance acceptance.');

console.log('Schema 179 Finance permissions/acceptance/release hardening source gate: PASS');
