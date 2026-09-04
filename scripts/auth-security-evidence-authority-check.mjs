#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('sql/198_auth_security_evidence_authority.sql');
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

add('schema198-evidence-table',all(migration,[
  'it_auth_security_evidence',
  "control_key in ('leaked_password_protection','mfa_options')",
  "evidence_source in ('supabase_dashboard','supabase_management_api','supabase_advisor','manual_external')",
  'observed_at timestamptz not null',
  'is_authoritative boolean not null default false'
]));
add('schema198-advisor-not-proof',all(migration,[
  "evidence_source='supabase_advisor' and is_authoritative=true",
  'advisor_not_authoritative_for_auth_settings',
  'absence of an advisor warning',
  'Advisor rows and missing warnings are not sufficient proof.'
]));
add('schema198-freshness-authority',all(migration,[
  'v_it_auth_security_evidence_current',
  "now()-interval '30 days'",
  'stale_external_evidence',
  'pending_external_verification',
  'verified_secure'
]));
add('schema198-secure-proof-constraint',all(migration,[
  "verification_status <> 'verified_secure'",
  "evidence_source in ('supabase_dashboard','supabase_management_api','manual_external')",
  "observed_state in ('enabled','configured')"
]));
add('schema198-current-todo-derived',all(migration,[
  'create or replace view public.v_it_current_admin_todo',
  'v_it_auth_security_evidence_current',
  "coalesce(a.current_status,'pending_external_verification')<>'verified_secure'",
  'security:leaked_password_protection',
  'security:mfa_options'
]));
add('schema198-assertions',all(migration,[
  'ywi_auth_security_evidence_assertions',
  'auth_controls_catalogued',
  'current_auth_followups_truthful',
  'auth_evidence_authority_service_private',
  'open_business_acceptance_unchanged',
  'finance_provider_execution_off'
]));
add('schema198-business-safety',all(migration,[
  "'auth_setting_mutation',false",
  "'advisor_auto_verification',false",
  "'business_rail_auto_close',false",
  "'finance_mutation',false",
  "'payment_provider_mutation',false",
  "'production_promotion',false"
]));
add('schema198-marker',
  migration.includes('198::int as expected_schema_version') &&
  /values\s*\(\s*198\s*,\s*'198_auth_security_evidence_authority'/i.test(migration)
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
  helpLower.includes('authoritative external evidence') &&
  helpLower.includes('advisor')
);
add('durable-docs-current',[readme,handbook,nextSteps].every((text)=>
  text.includes('Auth security evidence') && text.includes('advisor')
));
add('active-docs-no-build-ledger',![readme,handbook,nextSteps].some((text)=>/Build\s+198|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} Auth security evidence authority checks passed.`);
if(failed.length)process.exit(1);
