#!/usr/bin/env node
/** Build/Schema 188 source gate: unified open-rail acceptance readiness. */
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('sql/188_open_rail_acceptance_readiness.sql');
const endpoint=read('supabase/functions/admin-it-control/index.ts');
const ui=read('js/it-readiness-ui.js');
const browser=read('tests/browser/it-scorecard-truth.spec.mjs');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));
const failures=[];
const add=(key,ok)=>{if(!ok)failures.push(key);};
const hasAll=(text,items)=>items.every((item)=>text.includes(item));

add('schema188-runbook-private',hasAll(migration,[
  'it_open_rail_acceptance_runbook','enable row level security',
  'revoke all on table public.it_open_rail_acceptance_runbook from public,anon,authenticated;',
  'grant select on table public.it_open_rail_acceptance_runbook to service_role;'
]));
add('schema188-unified-readiness-view',hasAll(migration,[
  'v_it_open_rail_acceptance_readiness','technical_readiness_status','technical_readiness_code',
  'current_action','evidence_requirement','historical_next_action_hint','historical_hint_stale'
]));
add('schema188-all-resolution-classes',hasAll(migration,[
  "'staging_acceptance'","'accounting_acceptance'","'provider_acceptance'","'content_approval'"
]));
add('schema188-stale-hint-overrides',hasAll(migration,[
  "rail_key='quote_intake_live'","%deploy quote-contact-submit%",
  "rail_key='live_job_updates'","%deploy schema 155%",'open_rail_stale_hints_overridden'
]));
add('schema188-no-business-auto-close',hasAll(migration,[
  'open_rail_runbook_preserves_human_gates','auto_close_allowed is not false',
  'No business rail is closed.'
]) && !/update\s+public\.admin_scorecard_progress_rails[\s\S]{0,500}where\s+rail_key\s+in\s*\([^)]*(?:operations_cockpit_live|quote_intake_live|payment_actions_live|bank_csv_preview_live|route_asset_approval_live|customer_portal_live|live_job_updates|customer_live_update_notifications|service_execution_proof_costing|supervisor_closeout_signoff_invoice_followup|approved_route_generation)/i.test(migration));
add('schema188-finance-provider-closed',hasAll(migration,[
  'open_rail_finance_provider_mutation_closed','execution_release_enabled','provider_mutation_enabled',
  '"must_remain_off"'
]));
add('schema188-readonly-assertion',hasAll(migration,[
  'open_rail_readiness_is_read_only','ywi_open_rail_acceptance_readiness_assertions'
]));
add('schema188-build-rail-bounded',hasAll(migration,[
  'schema188_open_rail_acceptance_readiness',"'build_acceptance',false,false,false",'introduced_by_schema',
  "select 188::int as expected_schema_version", "values(188,'188_open_rail_acceptance_readiness'"
]));
add('schema188-admin-it-source',hasAll(endpoint,[
  'open_rail_acceptance_readiness','v_it_open_rail_acceptance_readiness',
  'ywi_open_rail_acceptance_readiness_assertions'
]));
add('schema188-admin-it-assertions',hasAll(endpoint,[
  'open_rail_acceptance_readiness: openRailReadinessAssertions.rows',
  'openRailReadinessAssertions.error'
]));
add('schema188-ui-board',hasAll(ui,[
  'Acceptance Readiness','renderAcceptanceReadiness','current_action','evidence_requirement',
  'technical_readiness_status','historical_hint_stale'
]));
add('schema188-browser-proof',hasAll(browser,[
  'Acceptance Readiness','quote-contact-submit is present in the dedicated staging project',
  'Schema 188 already includes the historical live-update schema work','historical deploy hint is stale'
]));
add('schema188-package-gate',pkg.scripts?.['test:open-rail-readiness']==='node scripts/open-rail-acceptance-readiness-check.mjs');
add('schema188-workflow-gate',workflow.includes('npm run test:open-rail-readiness'));

if(failures.length){
  console.error(`Build 188 open-rail readiness gate failed (${failures.length}): ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Build 188 open-rail acceptance readiness gate passed.');
