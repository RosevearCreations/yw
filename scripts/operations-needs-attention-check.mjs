import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/209_operations_needs_attention.sql');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const operations=read('supabase/functions/operations-manage/index.ts');
const ui=read('js/operations-cockpit.js');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');

for (const token of [
  'operations_attention_states',
  'enable row level security',
  "revoke all on table public.operations_attention_states from public,anon,authenticated",
  "operations_attention_defer",
  "operations_attention_resolve",
  "209,'209_operations_needs_attention'",
  '209 as expected_schema_version',
  'ywi_operations_attention_security_assertions'
]) assert.ok(migration.includes(token), `Schema 209 missing ${token}`);

for (const token of [
  "operations_attention_defer: contract('operations_attention_defer', 'admin', 'manage', 'write'",
  "operations_attention_resolve: contract('operations_attention_resolve', 'admin', 'manage', 'write'"
]) assert.ok(boundaries.includes(token), `Boundary contract missing ${token}`);

for (const token of [
  'function buildOperationsAttentionQueue',
  "v_jobs_directory",
  "v_quote_contact_followup_queue",
  "v_equipment_scan_resolution_queue",
  "v_equipment_service_task_directory",
  "v_supervisor_safety_queue",
  "v_employee_time_review_queue",
  "v_ar_invoice_aging_detail",
  "v_accounting_reconciliation_manual_review_queue",
  "operations_attention_states",
  "hasModuleAccess(supabase, profile, 'jobs', 'view')",
  "hasModuleAccess(supabase, profile, 'safety', 'view')",
  "hasModuleAccess(supabase, profile, 'finance', 'view')",
  "action === 'operations_attention_defer'",
  "action === 'operations_attention_resolve'"
]) assert.ok(operations.includes(token), `Operations endpoint missing ${token}`);

for (const token of [
  'Operations Needs Attention',
  'oc_attention_queue',
  'oc_attention_resolved',
  'priority',
  'Owner',
  'Due',
  'attention-defer',
  'attention-resolve',
  'attention-open',
  'canViewModule?.(row.source_module',
  'Recently resolved'
]) assert.ok(ui.includes(token), `Operations UI missing ${token}`);

assert.ok(!migration.includes('execution_enabled=true') || migration.includes("finance_provider_execution_off"),'Build 320 must not enable Finance/provider execution.');
assert.equal(pkg.scripts['test:operations-needs-attention'],'node scripts/operations-needs-attention-check.mjs');
assert.equal(pkg.scripts['test:browser:operations-needs-attention'],'playwright test --config=playwright.config.mjs tests/browser/operations-needs-attention.spec.mjs');
assert.ok(workflow.includes('npm run test:operations-needs-attention'));
assert.ok(workflow.includes('npm run test:browser:operations-needs-attention'));
assert.ok(help.includes('Build 320') && help.includes('Operations Needs Attention'));
assert.ok(roadmap.includes('321 — Crew Scheduling & Dispatch'));
assert.ok(roadmap.includes('320 — Operations Needs Attention'));

console.log('Build 320 Operations Needs Attention source gate: PASS');
