#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('sql/190_security_advisor_truth_reconciliation.sql');
const repair=read('sql/190b_security_advisor_stale_assertion_control.sql');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));
const failures=[];
const add=(key,ok)=>{if(!ok)failures.push(key);};
const hasAll=(text,items)=>items.every((item)=>text.includes(item));

add('schema190-transaction',migration.trimStart().startsWith('begin;')&&migration.trimEnd().endsWith('commit;'));
add('schema190b-transaction',repair.trimStart().startsWith('begin;')&&repair.trimEnd().endsWith('commit;'));
add('schema190-bounded-search-path-fix',hasAll(migration,[
  'alter function public.set_updated_at() set search_path=public,pg_temp;',
  "('function_search_path_mutable','warn','set_updated_at')",
  "('function_search_path_mutable','warn','handle_new_user')"
]));
add('schema190-advisor-rules-captured',hasAll(migration,[
  'rls_disabled_in_public','security_definer_view','materialized_view_in_api','sensitive_columns_exposed',
  'rls_policy_always_true','function_search_path_mutable','extension_in_public',
  'auth_leaked_password_protection','auth_insufficient_mfa_options'
]));
add('schema190-known-stale-targets',hasAll(migration,[
  "'monitoring_events'","'mv_precomputed_metrics'","'mv_user_permissions'","'cleanup_old_traffic_events'"
]));
add('schema190-private-truth-views',hasAll(migration,[
  'v_it_security_advisor_truth','v_it_security_advisor_truth_status','with (security_invoker=true)',
  'revoke all on table public.v_it_security_advisor_truth from public,anon,authenticated;',
  'grant select on table public.v_it_security_advisor_truth to service_role;',
  'revoke all on table public.v_it_security_advisor_truth_status from public,anon,authenticated;',
  'grant select on table public.v_it_security_advisor_truth_status to service_role;'
]));
add('schema190-explicit-states',hasAll(migration,[
  "'stale_object'","'verified_safe'","'confirmed_followup'","'external_verification'",
  'reconciliation_status','security_followup_status'
]));
add('schema190-assertions',hasAll(migration,[
  'ywi_security_advisor_truth_assertions','advisor_snapshot_fully_classified','advisor_deleted_object_staleness_detected',
  'advisor_search_path_truth_current','advisor_extension_truth_classified','advisor_external_auth_followups_separated',
  'advisor_truth_views_service_private','submission_security_control_still_safe'
]));
add('schema190b-historical-stale-direct-catalog',hasAll(repair,[
  'ywi_security_advisor_truth_assertions',"c.relname='v_sms_configuration'",'cleanup_old_traffic_events','monitoring_events',
  'Build 190b keeps the fresh advisor snapshot pure'
]));
add('schema190-pgnet-deferred',hasAll(migration,[
  "object_name='pg_net' and reconciliation_state='confirmed_followup'",'pg_net_relocation_deferred',
  'pg_net relocation and Supabase Auth configuration remain separate follow-ups'
]));
add('schema190-auth-deferred',hasAll(migration,[
  "'leaked_password_protection'","'mfa_options'","'external_verification'",'auth_configuration_deferred'
]));
add('schema190-no-extension-relocation',!/\balter\s+extension\b/i.test(migration+repair));
add('schema190-no-auth-mutation',!/\b(?:update|insert\s+into|delete\s+from)\s+auth\./i.test(migration+repair));
add('schema190-no-business-row-rewrite',!/(?:update|delete\s+from|insert\s+into)\s+public\.(?:jobs|quotes|customers|submissions|invoices|payments|financial_transactions|bank_transactions)\b/i.test(migration+repair));
add('schema190-no-business-auto-close',!/(?:operations_cockpit_live|quote_intake_live|payment_actions_live|bank_csv_preview_live|route_asset_approval_live|customer_portal_live|live_job_updates|customer_live_update_notifications|service_execution_proof_costing|supervisor_closeout_signoff_invoice_followup|approved_route_generation)[\s\S]{0,250}(?:complete|100)/i.test(migration+repair));
add('schema190-release-switches-closed',!/(execution_release_enabled|provider_mutation_enabled)\s*=\s*true/i.test(migration+repair));
add('schema190-marker',hasAll(migration,[
  'select 190::int as expected_schema_version',"values(190,'190_security_advisor_truth_reconciliation'",
  "'schema190_security_advisor_truth_reconciliation','build_acceptance',false,false,false"
]));
add('package-source-gate',pkg.scripts?.['test:security-advisor-truth']==='node scripts/security-advisor-truth-reconciliation-check.mjs');
add('workflow-source-gate',workflow.includes('npm run test:security-advisor-truth'));

if(failures.length){
  console.error(`Build 190 security advisor truth gate failed (${failures.length}): ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Build 190 security advisor truth reconciliation gate passed.');
