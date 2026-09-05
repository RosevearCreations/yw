#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const schema198=read('sql/198_auth_security_evidence_authority.sql');
const schema202=read('sql/202_auth_evidence_provenance_hardening.sql');
const endpoint=read('supabase/functions/admin-account-security/index.ts');
const ui=read('js/admin-account-security-ui.js');
const browser=read('tests/browser/admin-account-security.spec.mjs');
const packageJson=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const helpLower=help.toLowerCase();
const readme=read('README.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const all=(text,values)=>values.every((value)=>text.includes(value));
const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});

add('schema198-evidence-foundation',all(schema198,[
  'it_auth_security_evidence',
  "control_key in ('leaked_password_protection','mfa_options')",
  "evidence_source in ('supabase_dashboard','supabase_management_api','supabase_advisor','manual_external')",
  'observed_at timestamptz not null',
  'is_authoritative boolean not null default false',
  'v_it_auth_security_evidence_current',
  "now()-interval '30 days'"
]));
add('schema202-official-authoritative-source-only',all(schema202,[
  'it_auth_security_evidence_authoritative_source_chk',
  "evidence_source in ('supabase_dashboard','supabase_management_api')",
  "evidence_source not in ('supabase_dashboard','supabase_management_api')",
  'is_authoritative=false'
]));
add('schema202-authoritative-reference-required',all(schema202,[
  'it_auth_security_evidence_authoritative_reference_chk',
  "nullif(btrim(coalesce(evidence_reference,'')),'') is not null",
  'authoritative_reference_required'
]));
add('schema202-exact-secure-state',all(schema202,[
  'it_auth_security_evidence_secure_provenance_chk',
  "control_key='leaked_password_protection' and observed_state='enabled'",
  "control_key='mfa_options' and observed_state='configured'",
  'verified_secure_requires_exact_control_state'
]));
add('schema202-manual-advisor-never-authoritative',all(schema202,[
  "manual_external_authoritative',false",
  "advisor_authoritative',false",
  'Supporting/manual/advisor evidence cannot prove the external Auth setting.',
  'Only Supabase Dashboard or Management API evidence may be authoritative.'
]));
add('schema202-defense-in-depth-current-view',all(schema202,[
  'create or replace view public.v_it_auth_security_evidence_current',
  "when l.evidence_source not in ('supabase_dashboard','supabase_management_api') then 'pending_external_verification'",
  "when nullif(btrim(coalesce(l.evidence_reference,'')),'') is null then 'pending_external_verification'",
  "then 'verified_secure'"
]));
add('schema202-current-todo-remains-external',
  schema198.includes("coalesce(a.current_status,'pending_external_verification')<>'verified_secure'") &&
  all(schema202,[
    'The leaked-password and MFA external-verification follow-ups remain open until actual current Supabase Dashboard or Management API evidence exists.',
    "'auth_setting_mutation',false",
    "'business_rail_auto_close',false"
  ])
);
add('schema202-assertions',all(schema202,[
  'ywi_auth_security_evidence_assertions',
  'authoritative_provenance_official_only',
  'authoritative_reference_required',
  'verified_secure_requires_exact_control_state',
  'current_auth_followups_truthful',
  'auth_evidence_authority_service_private',
  'open_business_acceptance_unchanged',
  'finance_provider_execution_off'
]));
add('schema202-business-safety',all(schema202,[
  "'auth_setting_mutation',false",
  "'business_rail_auto_close',false",
  "'finance_mutation',false",
  "'payment_provider_mutation',false",
  "'staging_execution',false",
  "'production_promotion',false"
]));
add('schema202-marker',
  schema202.includes('202 as expected_schema_version') &&
  /values\s*\(\s*202\s*,\s*'202_auth_evidence_provenance_hardening'/i.test(schema202)
);
add('account-security-overview-current-todo',all(endpoint,[
  'v_it_current_admin_todo',
  'v_it_current_admin_todo_status',
  'current_todo: todo || []'
]));
add('account-security-ui-shows-evidence-requirement',all(ui,[
  'Current Admin To-Do',
  '<b>Current action:</b>',
  '<b>Evidence:</b>',
  'external evidence'
]));
add('browser-current-todo-rendered',all(browser,[
  'adminCurrentTodoPanel',
  'Only unresolved current requirements',
  'current_todo_status'
]));
add('package-gate-wired',packageJson.includes('"test:auth-security-evidence": "node scripts/auth-security-evidence-authority-check.mjs"'));
add('workflow-gate-wired',workflow.includes('npm run test:auth-security-evidence'));
add('help-current',
  helpLower.includes('leaked-password') &&
  helpLower.includes('mfa') &&
  helpLower.includes('supabase dashboard') &&
  helpLower.includes('management api') &&
  helpLower.includes('manual') &&
  helpLower.includes('advisor')
);
add('durable-docs-current',[readme,handbook,nextSteps].every((text)=>
  text.includes('Auth security evidence') &&
  text.includes('Supabase Dashboard') &&
  text.includes('Management API') &&
  text.toLowerCase().includes('manual') &&
  text.includes('advisor')
));
add('active-docs-no-build-ledger',![readme,handbook,nextSteps].some((text)=>/Build\s+\d+|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} Auth security evidence authority checks passed.`);
if(failed.length)process.exit(1);
