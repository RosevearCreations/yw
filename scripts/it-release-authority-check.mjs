import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const sql=read('sql/166_it_release_authority.sql');
const dynamicSql=read('sql/167_real_cross_module_event_wiring.sql');
const completionSql=read('sql/168_job_completion_event_wiring.sql');
const currentSql=read('sql/169_finance_job_completion_consumer.sql');
const endpoint=read('supabase/functions/admin-it-control/index.ts');
const itUi=read('js/it-readiness-ui.js');
const moduleUi=read('js/module-access-ui.js');
const runtime=read('js/module-runtime.js');

const required=(source,values,label)=>{
  for(const value of values) assert.ok(source.includes(value),`${label} missing ${value}`);
};

required(sql,[
  'create table if not exists public.it_release_source_evidence',
  'alter table public.it_release_source_evidence enable row level security',
  'revoke all on table public.it_release_source_evidence from public, anon, authenticated',
  'create or replace view public.v_it_release_source_evidence_current',
  'with (security_invoker=true)',
  'create or replace view public.v_it_release_authority_status',
  'create or replace function public.ywi_it_release_authority_assertions()',
  'ywi_record_release_source_evidence',
  'manual_human_promotion_required',
  '166::int as expected_schema_version',
  "'166_it_release_authority'",
], 'Schema 166 migration');

required(sql,[
  'revoke all on function public.ywi_effective_module_access(uuid,text) from public, anon, authenticated',
  'revoke all on function public.ywi_profile_has_module_access(uuid,text,text) from public, anon, authenticated',
  'revoke all on function public.ywi_get_profile_module_permissions(uuid) from public, anon, authenticated',
  'grant execute on function public.ywi_effective_module_access(uuid,text) to service_role',
  'grant execute on function public.ywi_profile_has_module_access(uuid,text,text) to service_role',
  'grant execute on function public.ywi_get_profile_module_permissions(uuid) to service_role',
  'revoke all on function public.ywi_get_my_module_permissions() from public, anon, authenticated',
  'grant execute on function public.ywi_get_my_module_permissions() to authenticated, service_role',
], 'Schema 159 privilege convergence');

assert.ok(sql.includes("source_branch='main' and workflow_status='passed' and schema_version=166"),'Schema 166 historical exact main/CI evidence proof must remain reproducible.');
required(dynamicSql,[
  'create or replace view public.v_it_release_source_evidence_current',
  'where e.schema_version=expected.expected_schema_version',
  'ss.expected_schema_version as release_schema_version',
  'src.schema_version=ss.expected_schema_version',
  'repository enforcement is evaluated separately',
], 'Schema 167 dynamic release authority');
assert.ok(!dynamicSql.includes("e.schema_version=166 then 'green'"),'Current release authority must not pin source evidence to Schema 166.');
assert.ok(dynamicSql.includes("e.branch_protection_reported is false then 'amber'"),'Repository enforcement must remain a separate AMBER rail when main is reported unprotected.');

required(completionSql,[
  'ywi_cross_module_event_wiring_assertions()',
  'job_completion_event_wired_atomically',
  'job_completion_evidence_server_derived',
  '168::int as expected_schema_version',
  "'168_job_completion_event_wiring'",
  "'2026-09-01j'",
], 'Schema 168 job completion authority');
assert.ok(completionSql.includes("not exists(\n      select 1 from information_schema.routine_privileges"),'Schema 168 must retain private trigger/publisher authority checks.');

required(currentSql,[
  'create table if not exists public.finance_job_completion_intake',
  'ywi_finance_consume_job_completed_events',
  'ywi_finance_job_completion_consumer_assertions()',
  '169::int as expected_schema_version',
  "'169_finance_job_completion_consumer'",
  "'2026-09-02a'",
], 'Schema 169 current release authority');
assert.ok(currentSql.includes('revoke all on function public.ywi_finance_consume_job_completed_events(integer) from public, anon, authenticated;'),'Schema 169 consumer must remain unavailable to browser roles.');
assert.ok(!/update\s+public\.(?:jobs|work_orders|job_completion_reviews)\b/i.test(currentSql),'Schema 169 Finance consumer must not write back into Jobs completion state.');
assert.ok(currentSql.includes("'Admin > I.T. Readiness'"),'I.T. must remain an Admin/manage subsection.');
assert.ok(!/module_key\s*=\s*['"]it['"]|\('it'\s*,/i.test(currentSql),'I.T. must not become a fifth business module.');
assert.ok(sql.includes('drop index if exists public.module_acceptance_scenarios_sort_order_idx'),'Schema 165 unused live index cleanup must remain explicit.');
assert.ok(dynamicSql.includes('manual_human_promotion_required'),'Production promotion must remain manual.');

required(endpoint,[
  'v_schema_drift_status',
  'v_it_release_authority_status',
  'v_it_release_source_evidence_current',
  'ywi_it_release_authority_assertions',
], 'admin-it-control');
assert.ok(!endpoint.includes('expected_schema_version: 160'),'admin-it-control must not hardcode Schema 160 as current.');
assert.ok(!endpoint.includes('>= 160'),'admin-it-control must compare live schema against the live expected schema, not a stale floor.');

required(itUi,['release_authority','release_source_evidence'],'I.T. Readiness UI');
assert.ok(!itUi.includes('Schema 160 control plane'),'I.T. Readiness heading must not claim a stale Schema 160 control plane.');
assert.ok(!itUi.includes('expected_schema_version||160'),'I.T. Readiness must not fall back to Schema 160.');

for(const key of ['safety','finance','jobs','admin']) assert.ok(runtime.includes(key),`Runtime manifest must retain ${key}.`);
assert.ok(!/moduleKey\s*:\s*['"]it['"]|module_key\s*:\s*['"]it['"]/.test(runtime),'Runtime must not register I.T. as a fifth business module.');
assert.ok(moduleUi.includes("const MODULES = ['safety','finance','jobs','admin']"),'Admin permission editor must remain exactly four-module aware.');

console.log('Schema 169-aware I.T. release authority source gate: PASS');
