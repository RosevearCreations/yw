#!/usr/bin/env node
/** Build/Schema 186 source gate: staging acceptance control plane + evidence runner modernization. */
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('sql/186_staging_acceptance_control_plane.sql');
const runner=read('scripts/operations-rpc-staging-e2e.mjs');
const fixtures=read('scripts/staging-fixtures.mjs');
const endpoint=read('supabase/functions/admin-staging-acceptance/index.ts');
const config=read('supabase/config.toml');
const ui=read('js/staging-acceptance-ui.js');
const runtime=read('js/module-runtime.js');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));

const results=[];
const add=(name,ok,detail='')=>results.push({name,ok:!!ok,detail});
const hasAll=(text,needles)=>needles.every((needle)=>text.includes(needle));

add('schema186-transaction-balanced',(migration.match(/^begin;$/gmi)||[]).length===1&&(migration.match(/^commit;$/gmi)||[]).length===1);
add('schema186-reuses-canonical-staging-tables',hasAll(migration,[
  'alter table public.operations_staging_test_runs','alter table public.operations_staging_test_results',
  'references public.operations_staging_fixture_sets(id)','target_rail_key text references public.admin_scorecard_progress_rails'
])&&!migration.includes('create table public.operations_staging_test_runs'));
add('schema186-source-schema-rail-binding',hasAll(migration,[
  'source_sha text','source_workflow_run_id bigint','schema_version integer','target_rail_key text',
  "v_resolution_class<>'staging_acceptance'",'v_schema_drift_status'
]));
add('schema186-human-signoff-fail-closed',hasAll(migration,[
  'human_signoff_required','human_signoff_status','awaiting_human_signoff',
  "v_decision='approved' and v_run.run_status<>'passed'",'scorecard_auto_closed',
  'staging_human_signoff_fail_closed'
]));
add('schema186-evidence-rpcs-service-only',hasAll(migration,[
  'ywi_rpc_start_staging_acceptance_run','ywi_rpc_record_staging_acceptance_result',
  'ywi_rpc_finalize_staging_acceptance_run','ywi_rpc_signoff_staging_acceptance_run',
  'staging_acceptance_rpcs_service_only'
])&&/revoke all on function public\.ywi_rpc_start_staging_acceptance_run[\s\S]*from public,anon,authenticated;/i.test(migration));
add('schema186-fixes-fixture-rpc-browser-exposure',hasAll(migration,[
  'revoke all on function public.ywi_rpc_create_staging_fixture_set(uuid,text) from public,anon,authenticated;',
  'revoke all on function public.ywi_rpc_cleanup_staging_fixture_set(uuid,uuid,text) from public,anon,authenticated;',
  'staging_fixture_rpcs_service_only'
]));
add('schema186-private-staging-tables',hasAll(migration,[
  'revoke all on table public.operations_staging_test_runs from public,anon,authenticated;',
  'revoke all on table public.operations_staging_test_results from public,anon,authenticated;',
  'staging_control_tables_private'
]));
add('schema186-it-status-and-assertions',hasAll(migration,[
  'v_it_staging_acceptance_status','staging_acceptance_status','acceptance_complete',
  'ywi_staging_acceptance_security_assertions','staging_evidence_never_auto_closes_scorecard'
]));
add('schema186-no-business-rail-auto-close',!migration.includes('update public.admin_scorecard_progress_rails\nset rail_status=')&&!/update\s+public\.admin_scorecard_progress_rails[\s\S]{0,500}operations_cockpit_live/i.test(migration));
add('schema186-marker-and-ledger',hasAll(migration,[
  '186::int as expected_schema_version',"186,'186_staging_acceptance_control_plane'","'2026-09-02r'",
  "'schema186_staging_acceptance_control_plane'"
]));
add('schema186-no-finance-provider-production-mutation',!/\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:job_financial_events|finance_|ar_|ap_|stripe|paypal|payment_|gl_journal)/i.test(migration)&&!migration.includes('production_promotion',migration.indexOf('insert into public.app_schema_versions')));

add('runner-refuses-production-project',hasAll(runner,[
  'YWI_STAGING_PROJECT_REF','YWI_PRODUCTION_PROJECT_REF',"'jmqvkgiqlimdhcofwkxr'",
  'Refusing Build 186 staging acceptance against the YardWeasels Production project ref.'
]));
add('runner-source-and-schema-bound',hasAll(runner,[
  'YWI_STAGING_SOURCE_SHA','YWI_STAGING_WORKFLOW_RUN_ID','v_schema_drift_status',
  'ywi_rpc_start_staging_acceptance_run','p_source_sha:sourceSha','p_schema_version:expectedSchema'
]));
add('runner-records-cases-through-rpc',hasAll(runner,[
  'ywi_rpc_record_staging_acceptance_result','p_evidence_kind:kind','p_is_blocking:blocking',
  'ywi_rpc_finalize_staging_acceptance_run'
]));
add('runner-never-auto-signs-off',!runner.includes("rpc('ywi_rpc_signoff_staging_acceptance_run'")&&runner.includes('awaiting_human_signoff'));
add('runner-bounded-to-operations-cockpit',hasAll(runner,[
  "targetRail !== 'operations_cockpit_live'",'operations_cockpit_job_admin_allowed',
  'operations_cockpit_worker_denied','has_stripe_health:true'
]));
add('fixture-script-refuses-production-project',hasAll(fixtures,[
  'YWI_STAGING_PROJECT_REF','YWI_PRODUCTION_PROJECT_REF','Refusing staging fixture mutation against the YardWeasels Production project ref.'
]));

add('admin-staging-endpoint-admin-manage',hasAll(endpoint,[
  "hasModuleAccess(supabase,profile,'admin','manage')",'Admin module manage access is required',
  "action === 'status'","action === 'signoff'",'ywi_rpc_signoff_staging_acceptance_run'
]));
add('admin-staging-endpoint-status-private-view',hasAll(endpoint,[
  "from('v_it_staging_acceptance_status')",'ywi_staging_acceptance_security_assertions',
  "from('operations_staging_test_runs')"
]));
add('admin-staging-endpoint-jwt-config',/\[functions\.admin-staging-acceptance\]\s*\nverify_jwt = true/.test(config));
add('admin-staging-ui-human-explicit',hasAll(ui,[
  'Approve evidence','Reject evidence','window.confirm','does not close the scorecard rail',
  "jsonFetch?.('admin-staging-acceptance'"
]));
add('admin-staging-ui-loaded-by-admin-module',runtime.includes("'/js/staging-acceptance-ui.js'")&&runtime.includes("const BUILD = '2026-09-02l'"));

add('workflow-source-gates-build186',workflow.includes('npm run test:staging-acceptance')&&workflow.includes('npm run test:browser:staging-acceptance'));
add('workflow-live-staging-manual-only',hasAll(workflow,[
  "github.event_name == 'workflow_dispatch' && inputs.run_staging == 'true'",'environment: staging',
  'YWI_STAGING_PROJECT_REF: ${{ secrets.YWI_STAGING_PROJECT_REF }}',
  'YWI_STAGING_JOB_ADMIN_JWT: ${{ secrets.YWI_STAGING_JOB_ADMIN_JWT }}',
  'YWI_STAGING_WORKER_JWT: ${{ secrets.YWI_STAGING_WORKER_JWT }}',
  'YWI_PRODUCTION_PROJECT_REF: jmqvkgiqlimdhcofwkxr',
  'YWI_STAGING_SOURCE_SHA: ${{ github.sha }}'
]));
add('package-build186-gates',pkg.scripts?.['test:staging-acceptance']?.includes('staging-acceptance-control-plane-check.mjs')&&pkg.scripts?.['test:browser:staging-acceptance']?.includes('staging-acceptance.spec.mjs'));

const failures=results.filter((item)=>!item.ok);
for(const item of results) console.log(`${item.ok?'PASS':'FAIL'} ${item.name}${item.detail?` - ${item.detail}`:''}`);
if(failures.length){
  console.error(`\nBuild 186 staging acceptance gate failed: ${failures.length}/${results.length} checks.`);
  process.exit(1);
}
console.log(`\nBuild 186 staging acceptance gate passed: ${results.length}/${results.length} checks.`);