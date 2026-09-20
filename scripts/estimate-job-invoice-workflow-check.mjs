import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/213_estimate_job_invoice_workflow.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const ui=read('js/operations-cockpit.js');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');

const must=(text,values,label)=>values.forEach((value)=>assert.ok(text.includes(value),`${label}: missing ${value}`));

must(migration,[
  'alter table public.estimates',
  'create table if not exists public.estimate_workflow_assumptions',
  'create table if not exists public.work_order_assumption_baselines',
  'create or replace view public.v_estimate_job_invoice_workflow',
  'create or replace view public.v_estimate_assumption_variance',
  'create or replace function public.ywi_rpc_estimate_workflow_save',
  'create or replace function public.ywi_rpc_estimate_approval_decision',
  'create or replace function public.ywi_rpc_estimate_convert_work_order',
  'create or replace function public.ywi_rpc_change_order_save',
  "'portal_acceptance_authority_preserved'",
  'Customer acceptance status is controlled by the existing quote/portal authority.',
  "'finance_candidate_authority_preserved'",
  "'finance_provider_execution_off'",
  "213,'213_estimate_job_invoice_workflow'"
],'Schema 213');

must(migration,[
  "assumption_type in ('labour','crew','material','equipment','subcontract','disposal','travel','other')",
  'deposit_required_amount',
  'deposit_required_percent',
  'customer_approval_reference',
  'work_order_conversion_ready',
  'finance_handoff_ready',
  'estimate_assumption_snapshot_version'
],'Landscaping commercial traceability');

assert.ok(/alter table public\.estimate_workflow_assumptions enable row level security;/i.test(migration));
assert.ok(/revoke all on table public\.estimate_workflow_assumptions from public,anon,authenticated;/i.test(migration));
assert.ok(/alter table public\.work_order_assumption_baselines enable row level security;/i.test(migration));
assert.ok(/revoke all on table public\.work_order_assumption_baselines from public,anon,authenticated;/i.test(migration));
assert.ok(!/insert\s+into\s+public\.(?:ar_invoices|ar_invoice_lines|gl_journal_batches|gl_journal_entries|ar_payments|payments)\b/i.test(migration),'Build 324 migration must not post invoices, journals or payments.');
assert.ok(!/execution_enabled\s*=\s*true|provider_mutation_enabled\s*=\s*true/i.test(migration),'Build 324 must not enable Finance/provider execution.');

must(operations,[
  "if (action === 'estimate_workflow_save')",
  "if (action === 'estimate_approval_decision')",
  "if (action === 'estimate_convert_work_order')",
  "if (action === 'change_order_save')",
  "from('v_estimate_job_invoice_workflow')",
  "from('v_estimate_workflow_assumption_directory')",
  "from('v_estimate_assumption_variance')",
  "estimate_invoice_meta: { build:324, schema:213",
  "supabase.rpc('ywi_rpc_estimate_workflow_save'",
  "supabase.rpc('ywi_rpc_estimate_convert_work_order'"
],'Operations Build 324');

must(boundaries,[
  "estimate_workflow_save: contract('estimate_workflow_save', 'jobs', 'approve', 'write'",
  "estimate_approval_decision: contract('estimate_approval_decision', 'jobs', 'approve', 'write'",
  "estimate_convert_work_order: contract('estimate_convert_work_order', 'jobs', 'approve', 'write'",
  "change_order_save: contract('change_order_save', 'jobs', 'approve', 'write'"
],'Build 324 boundaries');

must(ui,[
  "const BUILD = '324-estimate-job-invoice-workflow'",
  'Estimate → Job → Invoice Workflow',
  'Labour hours',
  'Crew size',
  'Subcontract / vendor',
  'Disposal',
  'Travel',
  'Optional work',
  'Customer approval reference',
  'Baseline → actual variance',
  "action:'estimate_workflow_save'",
  "action:'estimate_convert_work_order'",
  "action:'change_order_save'"
],'Build 324 operator workbench');

assert.equal(pkg.scripts['test:estimate-job-invoice-workflow'],'node scripts/estimate-job-invoice-workflow-check.mjs');
assert.ok(pkg.scripts['test:browser:estimate-job-invoice-workflow']?.includes('estimate-job-invoice-workflow.spec.mjs'));
assert.ok(workflow.includes('npm run test:estimate-job-invoice-workflow'));
assert.ok(workflow.includes('npm run test:browser:estimate-job-invoice-workflow'));
assert.ok(help.includes('Build 324') && help.includes('Estimate → Job → Invoice Workflow'));
assert.ok(roadmap.includes('325 — Landscape Production Tracking'));

const require=createRequire(import.meta.url);
const ts=require('typescript');
for(const path of ['supabase/functions/operations-manage/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
  const output=ts.transpileModule(read(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:path});
  const errors=(output.diagnostics||[]).filter((diag)=>diag.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,errors.map((diag)=>ts.flattenDiagnosticMessageText(diag.messageText,'\n')).join(' | '));
}
new Function(ui);

console.log('PASS build324-schema213-commercial-authority');
console.log('PASS build324-landscaping-assumption-traceability');
console.log('PASS build324-approval-deposit-conversion-gates');
console.log('PASS build324-change-order-customer-evidence');
console.log('PASS build324-finance-provider-boundary');
console.log('PASS build324-operations-workbench');
console.log('PASS build324-release-gates');
console.log('PASS build324-roadmap-advance');
console.log('\nBuild 324 Estimate → Job → Invoice Workflow source gate passed: 8/8 checks.');
