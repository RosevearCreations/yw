#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('sql/192_pg_net_dependency_safety.sql');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));
const failures=[];
const add=(key,ok)=>{if(!ok)failures.push(key);};
const hasAll=(text,items)=>items.every((item)=>text.includes(item));

add('schema192-transaction',migration.trimStart().startsWith('begin;')&&migration.trimEnd().endsWith('commit;'));
add('schema192-runtime-authority',hasAll(migration,[
  'it_platform_runtime_constraints','v_it_pg_net_runtime_dependency_status',
  "'pg_net_public_schema_runtime_dependency'",'supabase_managed_extension_runtime_dependency'
]));
add('schema192-live-dependency-inventory',hasAll(migration,[
  'dispatch_due_service_execution_scheduler_runs','dispatch_due_report_delivery_scheduler_runs',
  'service_execution_scheduler_dispatch_default','report_subscription_delivery_dispatch_default',
  'net.http_post','net._http_response','cron.job'
]));
add('schema192-nonrelocatable-truth',
  hasAll(migration,['e.extrelocatable','pg_net_non_relocatable_truth'])
    && /(?:does not|do not) force relocation/i.test(migration),
);
add('schema192-todo-suppression',hasAll(migration,[
  "s.object_name<>'pg_net'","p.status='accepted'",'pg_net_false_relocation_todo_suppressed'
]));
add('schema192-private-authority',hasAll(migration,[
  'revoke all on table public.it_platform_runtime_constraints from public,anon,authenticated;',
  'grant select,insert,update on table public.it_platform_runtime_constraints to service_role;',
  'revoke all on table public.v_it_pg_net_runtime_dependency_status from public,anon,authenticated;',
  'grant select on table public.v_it_pg_net_runtime_dependency_status to service_role;'
]));
add('schema192-assertions',hasAll(migration,[
  'ywi_pg_net_runtime_constraint_assertions','pg_net_extension_present','pg_net_scheduler_functions_tracked',
  'pg_net_active_cron_dependencies_tracked','pg_net_constraint_accepted_from_live_truth',
  'business_acceptance_rails_untouched'
]));
add('schema192-no-extension-ddl',!/\b(?:alter|drop|create)\s+extension\b/i.test(migration));
add('schema192-no-cron-mutation',!/\b(?:update|delete\s+from|insert\s+into)\s+cron\.job\b/i.test(migration));
add('schema192-no-business-row-rewrite',!/(?:update|delete\s+from|insert\s+into)\s+public\.(?:jobs|quotes|customers|submissions|invoices|payments|financial_transactions|bank_transactions)\b/i.test(migration));
add('schema192-no-business-auto-close',!/(?:operations_cockpit_live|quote_intake_live|payment_actions_live|bank_csv_preview_live|route_asset_approval_live|customer_portal_live|live_job_updates|customer_live_update_notifications|service_execution_proof_costing|supervisor_closeout_signoff_invoice_followup|approved_route_generation)[\s\S]{0,250}(?:complete|100)/i.test(migration));
add('schema192-release-switches-closed',!/(execution_release_enabled|provider_mutation_enabled)\s*=\s*true/i.test(migration));
add('schema192-marker',hasAll(migration,[
  'select 192::int as expected_schema_version',"192,'192_pg_net_dependency_safety'",
  "'schema192_pg_net_dependency_safety','build_acceptance',false,false,false"
]));
add('package-source-gate',pkg.scripts?.['test:pg-net-runtime']==='node scripts/pg-net-runtime-constraint-check.mjs');
add('workflow-source-gate',workflow.includes('npm run test:pg-net-runtime'));

if(failures.length){
  console.error(`Build 192 pg_net runtime constraint gate failed (${failures.length}): ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Build 192 pg_net runtime constraint gate passed.');
