import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const sql=read('sql/166_it_release_authority.sql');
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

assert.ok(sql.includes("source_branch='main' and workflow_status='passed' and schema_version=166"),'Exact main/CI evidence must be part of the release authority proof.');
assert.ok(sql.includes("not exists(select 1 from public.app_modules where module_key='it')"),'I.T. must remain outside the business module registry.');
assert.ok(sql.includes("where section_id='it' and module_key='admin' and minimum_access_level='manage'"),'I.T. must remain an Admin/manage subsection.');
assert.ok(sql.includes('drop index if exists public.module_acceptance_scenarios_sort_order_idx'),'Schema 165 unused live index cleanup must remain explicit.');
assert.ok(!/deploy|publish|promote/i.test(sql.match(/production_promotion_mode[\s\S]{0,160}/i)?.[0]||'') || sql.includes('manual_human_promotion_required'),'Production promotion must remain manual.');

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

console.log('Schema 166 I.T. release authority source gate: PASS');
