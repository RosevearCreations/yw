#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('sql/200_current_schema_staging_runbook_authority.sql');
const migration187=read('sql/187_staging_acceptance_scenario_catalog.sql');
const ui=read('js/admin-account-security-ui.js');
const browser=read('tests/browser/admin-account-security.spec.mjs');
const help=read('help.html');
const readme=read('README.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const all=(text,values)=>values.every((value)=>text.includes(value));
const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});

const stagingRails=[
  'operations_cockpit_live','quote_intake_live','live_job_updates',
  'customer_live_update_notifications','service_execution_proof_costing',
  'supervisor_closeout_signoff_invoice_followup'
];

add('schema200-transaction-balanced',(migration.match(/^begin;$/gmi)||[]).length===1&&(migration.match(/^commit;$/gmi)||[]).length===1);
add('schema200-six-staging-runbooks',stagingRails.every((rail)=>migration.includes(`'${rail}'`))&&all(migration,[
  "'required_schema_mode','exact_current'","'runner_schema_mode','current_repository'","'historical_catalog_schema',187"
]));
add('schema200-removes-187-plus-runtime-identity',migration.includes("not ilike '%Schema 187+%'")&&migration.includes('historical Schema 187 scenario catalog'));
add('schema200-next-safe-action-double-guard',all(migration,[
  'safe_candidate_after_environment_and_schema_guard',
  're-verify both the dedicated non-production staging environment guard and exact current-schema parity',
  "s.drift_status='current'",'s.expected_schema_version=s.latest_applied_schema_version'
]));
add('schema200-exact-drift-marker',all(migration,[
  '200 as expected_schema_version',
  "=200 then 'current'",">200 then 'ahead'",'exactly matches the repo schema marker',
  'grant select on table public.v_schema_drift_status to service_role'
]));
add('schema200-assertions',all(migration,[
  'exact_schema_required_for_staging_candidate','current_schema_runbook_language','historical_catalog_preserved',
  'open_business_acceptance_unchanged','finance_provider_execution_off','service_private_authority'
]));
add('schema200-technical-rail',all(migration,[
  'schema200_current_schema_staging_runbook_authority',"200,'200_current_schema_staging_runbook_authority'",'build_acceptance'
]));
add('schema200-no-business-rail-auto-close',!migration.includes("rail_status='complete'")&&!/update\s+public\.admin_scorecard_progress_rails[\s\S]{0,300}operations_cockpit_live/i.test(migration));
add('schema200-no-finance-provider-mutation',!/\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:job_financial_events|finance_job_completion_posting_execution_controls|ar_|ap_|stripe|paypal|payment_|gl_journal)/i.test(migration));
add('schema187-catalog-preserved',all(migration187,['operations_staging_acceptance_scenarios','catalog_exact_six_business_rails','catalog_each_rail_has_human_blocking_case']));

add('ui-prefers-double-guard-with-backward-fallback',all(ui,[
  'safe_candidate_after_environment_and_schema_guard','safe_candidate_after_environment_guard',
  'candidate after environment + schema guard'
]));
add('browser-double-guard-rendered',all(browser,[
  'safe_candidate_after_environment_and_schema_guard:true','candidate after environment + schema guard',
  'exact current-schema parity'
]));
add('help-current-schema-runbook',all(help,['exact current-schema','historical Schema 187','environment + schema']));
add('durable-docs-current',[readme,handbook,nextSteps].every((text)=>text.includes('exact current-schema')));
add('active-docs-no-build-ledger',![readme,handbook,nextSteps].some((text)=>/Build\s+202|Run\s+#?\d+|[0-9a-f]{40}/i.test(text)));
add('package-gate-wired',pkg.scripts?.['test:current-schema-staging-runbook']==='node scripts/current-schema-staging-runbook-authority-check.mjs');
add('workflow-gate-wired',workflow.includes('npm run test:current-schema-staging-runbook'));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} current-schema staging runbook authority checks passed.`);
if(failed.length)process.exit(1);
