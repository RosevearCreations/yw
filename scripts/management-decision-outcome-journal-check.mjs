import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/236_management_decision_outcome_journal.sql');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const operations=read('supabase/functions/operations-manage/index.ts');
const ui=read('js/operations-cockpit.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const must=(s,a,l)=>a.forEach((x)=>assert.ok(s.includes(x),l+': missing '+x));

must(migration,[
  'Schema 236 — Build 363 Management Decision Outcome Journal & Learning Loop',
  'create table if not exists public.management_decision_outcome_journal',
  'source_key text not null',
  'recommendation_key text not null',
  'chosen_safe_action text not null',
  'source_status_at_review text',
  'outcome_status text not null default \'pending\'',
  'recurrence_signal boolean not null default false',
  'followup_evidence text',
  'alter table public.management_decision_outcome_journal enable row level security',
  'revoke all on table public.management_decision_outcome_journal from public,anon,authenticated',
  'grant select,insert,update on table public.management_decision_outcome_journal to service_role',
  'create or replace view public.v_management_decision_outcome_journal',
  'with (security_invoker=true)',
  "('management_decision_record','admin','manage','write'",
  "('management_outcome_update','admin','manage','write'",
  'Exactly 92 explicitly handled operations-manage actions',
  'create or replace function public.ywi_management_decision_outcome_security_assertions()',
  'source_records_not_duplicated',
  'finance_provider_execution_off',
  '236 as expected_schema_version'
],'Schema 236');

assert.ok(!/source_payload\s+(?:json|jsonb|text)/i.test(migration),'Journal must not duplicate source business payloads.');
assert.ok(!/request_payload\s+(?:json|jsonb|text)/i.test(migration),'Journal must not store request payloads.');
assert.ok(!/response_payload\s+(?:json|jsonb|text)/i.test(migration),'Journal must not store response payloads.');

must(boundaries,[
  "management_decision_record: contract('management_decision_record', 'admin', 'manage', 'write', 'management_learning'",
  "management_outcome_update: contract('management_outcome_update', 'admin', 'manage', 'write', 'management_learning'"
],'Build 363 boundary registry');

must(operations,[
  'const MANAGEMENT_OUTCOME_BUILD = 363;',
  'const MANAGEMENT_OUTCOME_SCHEMA = 236;',
  "if (action === 'management_decision_record')",
  "if (action === 'management_outcome_update')",
  "supabase.from('management_decision_outcome_journal')",
  "supabase.from('v_management_decision_outcome_journal')",
  'management_decision_outcomes: managementDecisionOutcomes',
  'management_decision_learning_meta: managementLearningMeta',
  "hasModuleAccess(supabase, profile, 'admin', 'manage')",
  "mutation_boundary:'journal-only; no automatic source mutation'",
  'management_learning_recorded:!learningError'
],'Build 363 operations API');

const decisionHandler=operations.slice(operations.indexOf("if (action === 'management_decision_record')"),operations.indexOf("if (action === 'management_outcome_update')"));
for(const forbidden of ["from('work_orders').update","from('jobs').update","from('equipment_items').update","from('ar_invoices').update","customer_notification"]){
  assert.equal(decisionHandler.includes(forbidden),false,'Decision journal handler must not mutate source/provider authority: '+forbidden);
}

must(ui,[
  "'management-decision':'management_decision_record'",
  "'management-outcome':'management_outcome_update'",
  "button('Record decision','management-decision'",
  'function managementLearningCardHtml',
  'Management decision outcome journal',
  'source business record unchanged',
  'Update outcome',
  'recurrence_signal:outcome===\'recurring\''
],'Build 363 UI');

must(help,[
  'Build 363 — Management Decision Outcome Journal &amp; Learning Loop',
  'Decision evidence:',
  'Outcome learning:',
  'Authority boundary:',
  'Schema 236'
],'Build 363 help');

must(roadmap,[
  '#### **363 — Management Decision Outcome Journal & Learning Loop** is implemented',
  'The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.'
],'Build 363 roadmap');

must(handbook,[
  '**363 — Management Decision Outcome Journal & Learning Loop** is implemented',
  '- **364 — Workability-to-Schedule Recovery Outcomes**',
  'After item 363, that item is 364 — Workability-to-Schedule Recovery Outcomes.'
],'Build 363 handoff');

assert.equal(pkg.scripts?.['test:management-decision-outcome-journal'],'node scripts/management-decision-outcome-journal-check.mjs');
assert.equal(pkg.scripts?.['test:browser:management-decision-outcome-journal'],'playwright test --config=playwright.config.mjs tests/browser/management-decision-outcome-journal.spec.mjs');
must(workflow,['npm run test:management-decision-outcome-journal','npm run test:browser:management-decision-outcome-journal'],'Build 363 CI');

const require=createRequire(import.meta.url);
const ts=require('typescript');
for(const file of ['supabase/functions/operations-manage/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
  const out=ts.transpileModule(read(file),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  const errors=(out.diagnostics||[]).filter((d)=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,file+' syntax: '+errors.map((d)=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join(' | '));
}
new Function(ui);

console.log('Build 363 Management Decision Outcome Journal & Learning Loop source gate GREEN');
