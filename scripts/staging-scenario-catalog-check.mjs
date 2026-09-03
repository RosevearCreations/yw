#!/usr/bin/env node
/** Build/Schema 187 source gate: six-rail staging scenario catalog + prerequisite truth. */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('sql/187_staging_acceptance_scenario_catalog.sql');
const endpoint=read('supabase/functions/admin-staging-acceptance/index.ts');
const ui=read('js/staging-acceptance-ui.js');
const runner=read('scripts/operations-rpc-staging-e2e.mjs');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));
const results=[];
const add=(name,ok)=>results.push({name,ok:!!ok});
const hasAll=(text,values)=>values.every((value)=>text.includes(value));
const rails=[
  'operations_cockpit_live','quote_intake_live','live_job_updates',
  'customer_live_update_notifications','service_execution_proof_costing',
  'supervisor_closeout_signoff_invoice_followup'
];

add('schema187-transaction-balanced',(migration.match(/^begin;$/gmi)||[]).length===1&&(migration.match(/^commit;$/gmi)||[]).length===1);
add('schema187-private-catalog',hasAll(migration,[
  'create table if not exists public.operations_staging_acceptance_scenarios',
  'enable row level security','revoke all on table public.operations_staging_acceptance_scenarios from public,anon,authenticated;',
  'grant select on table public.operations_staging_acceptance_scenarios to service_role;'
]));
add('schema187-covers-six-staging-rails',rails.every((rail)=>migration.includes(`('${rail}'`))&&migration.includes('catalog_exact_six_business_rails'));
add('schema187-every-rail-has-human-proof',hasAll(migration,['verification_mode text not null',"verification_mode='human' and s.is_blocking",'catalog_each_rail_has_human_blocking_case']));
add('schema187-plan-view',hasAll(migration,['v_it_staging_acceptance_scenario_plan','prerequisite_truth','human_action_required','pending_evidence']));
add('schema187-start-seeds-all-pending',hasAll(migration,["s.case_key,'pending'",'catalog_case_count','catalog_schema',"from public.operations_staging_acceptance_scenarios s where s.rail_key=v_rail and s.is_enabled"]));
add('schema187-record-cannot-weaken',hasAll(migration,['v_catalog.evidence_kind','v_catalog.is_blocking','v_catalog.expected_outcome','catalog_record_cannot_weaken_case']));
add('schema187-finalize-blocks-pending-and-skipped',hasAll(migration,["case_status='pending'","case_status in ('failed','skipped')",'catalog_finalize_blocks_pending_or_skipped_blocking']));
add('schema187-never-auto-closes-business-rails',hasAll(migration,['catalog_never_auto_closes_scorecard','business_rail_auto_close',false])&&!/update\s+public\.admin_scorecard_progress_rails\s+set\s+rail_status\s*=\s*['\"]complete/i.test(migration));
add('schema187-marker-ledger',hasAll(migration,['187::int as expected_schema_version',"187,'187_staging_acceptance_scenario_catalog'","'2026-09-03a'","'schema187_staging_scenario_catalog'"]));
add('schema187-no-finance-provider-mutation',!/\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:job_financial_events|finance_|ar_|ap_|stripe|paypal|payment_|gl_journal)/i.test(migration));

add('endpoint-schema187-status-catalog',hasAll(endpoint,["const BUILD = '2026-09-03a'",'const SCHEMA = 187',"from('v_it_staging_acceptance_scenario_plan')",'ywi_staging_acceptance_catalog_assertions','scenario_plan:scenarios']));
add('endpoint-human-case-only',hasAll(endpoint,["action === 'record_case'", "scenario.verification_mode !== 'human'",'Human evidence can only be recorded on a started staging run.','ywi_rpc_record_staging_acceptance_result']));
add('endpoint-explicit-finalize-and-signoff',hasAll(endpoint,["action === 'finalize'",'ywi_rpc_finalize_staging_acceptance_run',"action === 'signoff'",'ywi_rpc_signoff_staging_acceptance_run']));
add('endpoint-admin-manage',endpoint.includes("hasModuleAccess(supabase,profile,'admin','manage')"));

add('runner-schema187-catalog-aware',hasAll(runner,['Schema 187 catalog-aware staging acceptance runner','operations_staging_acceptance_scenarios','allowedRails','catalog_case_count','pending_human_case_count']));
add('runner-six-rail-allowlist',rails.every((rail)=>runner.includes(`'${rail}'`)));
add('runner-production-refusal',hasAll(runner,['YWI_PRODUCTION_PROJECT_REF',"'jmqvkgiqlimdhcofwkxr'",'Refusing Schema 187 staging acceptance against the YardWeasels Production project ref.']));
add('runner-leaves-human-evidence-pending',hasAll(runner,['Runner cannot mark human-controlled case','record every pending human catalog case','finalize the run'])&&!runner.includes("rpc('ywi_rpc_finalize_staging_acceptance_run'"));

add('ui-renders-scenario-catalog',hasAll(ui,['scenario_plan','staging-scenario-row','Prerequisite truth','pending evidence','human action(s)']));
add('ui-human-case-actions-explicit',hasAll(ui,['data-staging-case="passed"','data-staging-case="failed"',"action:'record_case'",'observed-evidence note is required']));
add('ui-finalize-and-signoff-explicit',hasAll(ui,['data-staging-finalize',"action:'finalize'",'Approve evidence','Reject evidence',"action:'signoff'"]));
add('ui-repeats-no-auto-close-boundary',ui.includes('Scorecard completion remains a separate deliberate release action'));

add('workflow-six-rail-manual-dispatch',rails.every((rail)=>workflow.includes(`- ${rail}`))&&hasAll(workflow,['workflow_dispatch','environment: staging','Run Schema 187 staging catalog evidence']));
add('workflow-runs-schema187-source-gate',workflow.includes('npm run test:staging-scenarios'));
add('package-schema187-source-gate',pkg.scripts?.['test:staging-scenarios']==='node scripts/staging-scenario-catalog-check.mjs');

const failures=results.filter((item)=>!item.ok);
for(const item of results)console.log(`${item.ok?'PASS':'FAIL'} ${item.name}`);
if(failures.length){console.error(`\nBuild 187 staging scenario gate failed: ${failures.length}/${results.length} checks.`);process.exit(1);}
console.log(`\nBuild 187 staging scenario gate passed: ${results.length}/${results.length} checks.`);
