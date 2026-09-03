#!/usr/bin/env node
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const migration=read('sql/189_submission_security_boundary_convergence.sql');
const fn=read('supabase/functions/resend-email/index.ts');
const config=read('supabase/config.toml');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));
const failures=[];
const add=(key,ok)=>{if(!ok)failures.push(key);};
const hasAll=(text,items)=>items.every((item)=>text.includes(item));

add('schema189-role-rank-convergence',hasAll(migration,[
  "when 'employee' then 10","when 'staff' then 15","when 'onsite_admin' then 18","when 'job_admin' then 45"
]));
add('schema189-broad-policies-removed',hasAll(migration,[
  'drop policy if exists submissions_insert_authenticated on public.submissions;',
  'drop policy if exists submissions_select_authenticated on public.submissions;'
]));
add('schema189-owned-insert-policy',hasAll(migration,[
  'submissions: insert owned per-role','submitted_by_profile_id = auth.uid()','p.is_active = true',
  "submissions.form_type = 'E'","submissions.form_type in ('B','C','D')","submissions.form_type = 'A'"
]));
add('schema189-private-security-status',hasAll(migration,[
  'v_it_submission_security_status','with (security_invoker=true)',
  'revoke all on table public.v_it_submission_security_status from public,anon,authenticated;',
  'grant select on table public.v_it_submission_security_status to service_role;'
]));
add('schema189-assertions',hasAll(migration,[
  'ywi_submission_security_assertions','submission_rls_enabled','submission_broad_authenticated_policies_removed',
  'submission_owned_insert_policy_current','submission_select_policy_scoped','submission_role_rank_current','submission_security_status_green'
]));
add('schema189-no-submission-row-rewrite',!/\b(?:update|delete\s+from|insert\s+into)\s+public\.submissions\b/i.test(migration));
add('schema189-no-business-auto-close',!/(?:update\s+public\.admin_scorecard_progress_rails[\s\S]{0,600}(?:operations_cockpit_live|quote_intake_live|payment_actions_live|bank_csv_preview_live|route_asset_approval_live|customer_portal_live|live_job_updates|customer_live_update_notifications|service_execution_proof_costing|supervisor_closeout_signoff_invoice_followup|approved_route_generation))/i.test(migration));
add('schema189-release-switches-closed',!/(execution_release_enabled|provider_mutation_enabled)\s*=\s*true/i.test(migration));
add('schema189-marker',hasAll(migration,[
  'select 189::int as expected_schema_version',"values(189,'189_submission_security_boundary_convergence'",
  "'schema189_submission_security_boundary','build_acceptance',false,false,false"
]));

add('resend-email-current-auth-contract',hasAll(fn,[
  "import { hasModuleAccess } from \"../_shared/module-permissions.ts\";",
  "supabase.auth.getUser(token)","actorProfile?.is_active",
  "hasModuleAccess(supabase, actorProfile, 'safety', 'create')",
  'submitted_by_profile_id: actorProfile.id'
]));
add('resend-email-real-date-column',fn.includes("date: payload.date || new Date().toISOString().slice(0,10)")&&!fn.includes('submission_date:'));
add('resend-email-current-role-vocabulary',hasAll(fn,['employee:10','staff:15','onsite_admin:18','job_admin:45']));
add('resend-email-jwt-config',/\[functions\.resend-email\][\s\S]*?verify_jwt\s*=\s*true/.test(config));
add('package-source-gate',pkg.scripts?.['test:submission-security']==='node scripts/submission-security-boundary-check.mjs');
add('workflow-source-gate',workflow.includes('npm run test:submission-security'));

if(failures.length){
  console.error(`Build 189 submission security gate failed (${failures.length}): ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Build 189 submission security boundary gate passed.');
