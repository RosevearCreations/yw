import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration=fs.readFileSync('sql/178_finance_operational_control_plane.sql','utf8');
const financeUi=fs.readFileSync('js/finance-ui.js','utf8');
const financeEdge=fs.readFileSync('supabase/functions/finance-job-completion-posting-approval/index.ts','utf8');
const itEdge=fs.readFileSync('supabase/functions/admin-it-control/index.ts','utf8');
const pkg=fs.readFileSync('package.json','utf8');
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');

const requiredMigration=[
  'v_finance_job_completion_operational_lifecycle',
  'v_finance_job_completion_operational_summary',
  'v_finance_job_completion_reconciliation_issues',
  'v_it_finance_completion_pipeline_status',
  'ywi_finance_operational_control_plane_assertions',
  "'FINANCE_REVIEW_REQUIRED'",
  "'POSTING_APPROVAL_REQUIRED'",
  "'EXECUTION_RELEASE_DISABLED'",
  "'POSTING_RECOVERY_REQUIRED'",
  "'COMPLETED_EXECUTION_INCOMPLETE_PAIR'",
  "'DUPLICATE_INVOICE_POSTING_REFERENCE'",
  "'DUPLICATE_JOURNAL_POSTING_REFERENCE'",
  'required_by_schema <= coalesce((select expected_schema_version from public.v_schema_drift_status limit 1),178)',
  "178,'178_finance_operational_control_plane'",
  'select 178::int as expected_schema_version',
];
for(const token of requiredMigration) assert.ok(migration.includes(token),`Schema 178 migration is missing ${token}.`);

assert.ok(/revoke all on table public\.v_finance_job_completion_operational_lifecycle from public,anon,authenticated/i.test(migration),'Lifecycle view must stay service-role private.');
assert.ok(/revoke all on table public\.v_finance_job_completion_reconciliation_issues from public,anon,authenticated/i.test(migration),'Reconciliation view must stay service-role private.');
assert.ok(/provider_mutation_authorized[\s\S]{0,120}false/i.test(migration),'Schema 178 must keep provider mutation false.');
assert.ok(!/update\s+public\.jobs\b/i.test(migration),'Schema 178 must not write back to Jobs.');
assert.ok(!/provider_mutation_enabled\s*=\s*true/i.test(migration),'Schema 178 must not enable provider mutation.');
assert.ok(!/execution_enabled\s*=\s*true/i.test(migration),'Schema 178 must not enable Finance posting execution.');
assert.ok(migration.includes("rail_key='schema177_finance_posting_execution_recovery'")&&migration.includes("'schema178_finance_operational_control_plane'"),'Schema 178 must close Schema 177 in source and seed its own release rail.');

for(const token of [
  'finance-job-completion-posting-approval',
  'postingPayload',
  'operational_lifecycle',
  'blocker_code',
  'action_hint',
  'execution_authorized',
  'reverse_posting',
]) assert.ok(financeUi.includes(token),`Finance UI is missing Build 178 lifecycle behavior: ${token}.`);
assert.ok(/execution_authorized[^\n]{0,100}===\s*true|execution_authorized[^\n]{0,100}\?/.test(financeUi),'Finance UI execution action must depend on server execution_authorized truth.');
assert.ok(!/execution_release[^\n]{0,80}(toggle|checkbox|enabled\s*=)/i.test(financeUi),'Finance UI must not expose an execution-release toggle.');
assert.ok(!/mapping_approved[^\n]{0,80}(toggle|checkbox|update)/i.test(financeUi),'Finance UI must not approve accountant mappings.');

for(const token of [
  'v_finance_job_completion_operational_lifecycle',
  'v_finance_job_completion_operational_summary',
  'v_finance_job_completion_reconciliation_issues',
]) assert.ok(financeEdge.includes(token),`Protected Finance Edge list must expose ${token}.`);
for(const token of ['execute_posting','reverse_posting','provider_mutation: false']) assert.ok(financeEdge.includes(token),`Finance Edge must retain Schema 177 protected behavior: ${token}.`);

for(const token of [
  'v_it_finance_completion_pipeline_status',
  'v_finance_job_completion_reconciliation_issues',
  'ywi_finance_operational_control_plane_assertions',
  'finance_operational',
]) assert.ok(itEdge.includes(token),`Admin I.T. readiness must include Schema 178 control-plane surface: ${token}.`);

assert.ok(pkg.includes('"test:finance-operational-control-plane"'),'package.json must expose the Schema 178 source gate.');
assert.ok(workflow.includes('npm run test:finance-operational-control-plane'),'CI must execute the Schema 178 source gate.');

console.log('PASS finance-operational-control-plane-check');
