import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(path)=>fs.readFileSync(path,'utf8');
const migration=read('sql/216_job_hazard_site_safety_plans.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const selector=read('supabase/functions/admin-selectors/index.ts');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const hse=read('js/hse-ops-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

const must=(source,needles,label)=>needles.forEach((needle)=>assert.ok(source.includes(needle),label+': missing '+needle));

must(migration,[
  'Schema 216 — Build 328 Job Hazard & Site Safety Plans',
  'create table if not exists public.job_hazard_plan_templates',
  'create table if not exists public.job_hazard_site_safety_plans',
  'hse_packet_id uuid not null references public.linked_hse_packets',
  'actual_conditions jsonb',
  'identified_hazards jsonb',
  'active_controls jsonb',
  'stop_work_required boolean',
  'utility_locate_reference text',
  'utility_locate_confirmed boolean',
  'supervisor_review_status text',
  'alter table public.job_hazard_plan_templates enable row level security',
  'alter table public.job_hazard_site_safety_plans enable row level security',
  'revoke all on table public.job_hazard_plan_templates from public,anon,authenticated',
  'revoke all on table public.job_hazard_site_safety_plans from public,anon,authenticated',
  'with (security_invoker=true)',
  'v_job_hazard_plan_template_directory',
  'v_job_hazard_site_safety_plan_directory',
  'ywi_rpc_job_hazard_template_save',
  'ywi_rpc_job_hazard_plan_save',
  'ywi_rpc_job_hazard_plan_review',
  "('job_hazard_template_save','safety','approve','write'",
  "('job_hazard_plan_save','safety','create','write'",
  "('job_hazard_plan_review','safety','approve','write'",
  'ywi_job_hazard_site_safety_plan_security_assertions',
  '216 as expected_schema_version',
  "'schema216'"
],'Schema 216');

for(const code of [
  'mowing','trimming_edging','blowers','chainsaw_brush','hedge_work','loading_unloading',
  'trailers_towing','roadside_work','excavation_digging','underground_utility','fertilizer_application',
  'heat','cold','storms_lightning','slips_trips','slopes','public_pedestrian','general_site'
]) assert.ok(migration.includes("('"+code+"'"),'Missing reusable template '+code);

assert.ok(!migration.includes('field_signoff_completed=true'),'Build 328 must not auto-complete HSE field signoff.');
assert.ok(!migration.includes('field_signoff_completed = true'),'Build 328 must not auto-complete HSE field signoff.');

must(boundaries,[
  "job_hazard_template_save: contract('job_hazard_template_save', 'safety', 'approve', 'write'",
  "job_hazard_plan_save: contract('job_hazard_plan_save', 'safety', 'create', 'write'",
  "job_hazard_plan_review: contract('job_hazard_plan_review', 'safety', 'approve', 'write'"
],'Safety write boundaries');

must(operations,[
  "action === 'job_hazard_template_save'",
  "action === 'job_hazard_plan_save'",
  "action === 'job_hazard_plan_review'",
  "requireRank(profile,30,action)",
  "requireRank(profile,20,action)",
  "supabase.rpc('ywi_rpc_job_hazard_template_save'",
  "supabase.rpc('ywi_rpc_job_hazard_plan_save'",
  "supabase.rpc('ywi_rpc_job_hazard_plan_review'",
  'build:328,schema:216'
],'Build 328 operations endpoint');

must(selector,[
  "'v_job_hazard_plan_template_directory'",
  "'v_job_hazard_site_safety_plan_directory'",
  'job_hazard_plan_templates: jobHazardPlanTemplates',
  'job_hazard_site_safety_plans: jobHazardSiteSafetyPlans'
],'Build 328 bounded selector');

must(hse,[
  'data-build="328"',
  'Job Hazard &amp; Site Safety Plans',
  'deriveJobHazardPlanning',
  "action:'job_hazard_plan_save'",
  "action:'job_hazard_plan_review'",
  'Templates are prompts, not proof that a site is safe',
  'Utility locate open',
  'Stop-work flags',
  'Supervisor review is explicit and separate from HSE field signoff/closeout'
],'Build 328 Safety UI');

must(help,['Build 328 — Job Hazard &amp; Site Safety Plans','actual field date and conditions','does <strong>not</strong> automatically complete HSE field signoff'],'Build 328 Help');
must(roadmap,['328 — Job Hazard & Site Safety Plans','329 — Incident & Near-Miss Investigation'],'Build 328 roadmap history');
must(pkg,['test:job-hazard-site-safety-plans','test:browser:job-hazard-site-safety-plans'],'Build 328 package scripts');
must(workflow,['npm run test:job-hazard-site-safety-plans','npm run test:browser:job-hazard-site-safety-plans'],'Build 328 CI wiring');

const require=createRequire(import.meta.url);
const ts=require('typescript');
for(const path of ['supabase/functions/operations-manage/index.ts','supabase/functions/admin-selectors/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
  const output=ts.transpileModule(read(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:path});
  const errors=(output.diagnostics||[]).filter((item)=>item.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,path+' must transpile without TypeScript syntax errors');
}

console.log('Build 328 Job Hazard & Site Safety Plans source gate GREEN');
