import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/214_landscape_production_tracking.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const ui=read('js/operations-cockpit.js');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');

const must=(text,values,label)=>values.forEach((value)=>assert.ok(text.includes(value),`${label}: missing ${value}`));

must(migration,[
  'alter table public.job_sessions',
  'add column if not exists work_order_id uuid references public.work_orders(id) on delete cascade',
  'alter table public.job_session_crew_hours',
  'create table if not exists public.job_session_production_quantities',
  'create or replace view public.v_landscape_production_session_directory',
  'create or replace view public.v_landscape_production_quantity_directory',
  'create or replace function public.ywi_rpc_landscape_production_session_save',
  'create or replace function public.ywi_rpc_landscape_production_quantity_save',
  "'canonical_execution_authorities_preserved'",
  "'media_evidence_authority_preserved'",
  "'material_equipment_authority_preserved'",
  "'finance_provider_execution_off'",
  "214,'214_landscape_production_tracking'"
],'Schema 214');

must(migration,[
  "workability_status in ('not_recorded','workable','restricted','delayed','stopped')",
  "completion_state in ('open','complete','partial','blocked','return_required')",
  'return_visit_required',
  'unfinished_work_notes',
  'customer_site_issue_notes',
  'disposal_quantity',
  'before_media_count',
  'during_media_count',
  'after_media_count',
  "production_state"
],'Field production evidence');

must(migration,[
  'create or replace function public.ywi_after_material_issue_journal_sync()',
  "nullif(to_jsonb(old)->>'issue_id','')::uuid",
  "nullif(to_jsonb(old)->>'id','')::uuid",
  "nullif(to_jsonb(new)->>'issue_id','')::uuid",
  "nullif(to_jsonb(new)->>'id','')::uuid"
],'Canonical material issue trigger repair');

assert.ok(/alter table public\.job_session_production_quantities enable row level security;/i.test(migration));
assert.ok(/revoke all on table public\.job_session_production_quantities from public,anon,authenticated;/i.test(migration));
assert.ok(!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:production_material|production_equipment|production_photo|production_closeout)/i.test(migration),'Build 325 must reuse canonical material/equipment/media/closeout authorities.');
assert.ok(!/update\s+public\.finance_job_completion_posting_execution_controls[\s\S]{0,1200}\b(?:execution_enabled|provider_mutation_enabled)\s*=\s*true/i.test(migration),'Build 325 must not enable Finance/provider execution.');

must(boundaries,[
  "landscape_production_session_save: contract('landscape_production_session_save', 'jobs', 'create', 'write'",
  "landscape_production_quantity_save: contract('landscape_production_quantity_save', 'jobs', 'create', 'write'"
],'Build 325 boundaries');

must(operations,[
  "if (action === 'landscape_production_session_save')",
  "if (action === 'landscape_production_quantity_save')",
  "from('v_landscape_production_session_directory')",
  "from('v_landscape_production_quantity_directory')",
  "landscape_production_meta: { build:325, schema:214",
  "supabase.rpc('ywi_rpc_landscape_production_session_save'",
  "supabase.rpc('ywi_rpc_landscape_production_quantity_save'",
  "p_payload:{id:clean(body.job_session_id,80),work_order_id:workOrderId,live_update_id:result.live_update_id}",
  "p_payload:{id:clean(body.job_session_id,80),work_order_id:workOrderId,execution_proof_id:result.execution_proof_id}"
],'Operations Build 325');

must(ui,[
  "const BUILD = '325-landscape-production-tracking'",
  'Landscape Production Tracking',
  'Crew-hour evidence',
  'Weather / workability context',
  'Unfinished work',
  'Return visit required',
  'Customer / site issue',
  'Production / disposal quantities',
  'Before/during/after photos',
  "action:'landscape_production_session_save'",
  "action:'landscape_production_quantity_save'",
  'data-oc-production-session'
],'Build 325 cockpit');

assert.equal(pkg.scripts['test:landscape-production-tracking'],'node scripts/landscape-production-tracking-check.mjs');
assert.ok(pkg.scripts['test:browser:landscape-production-tracking']?.includes('landscape-production-tracking.spec.mjs'));
assert.ok(workflow.includes('npm run test:landscape-production-tracking'));
assert.ok(workflow.includes('npm run test:browser:landscape-production-tracking'));
assert.ok(help.includes('Build 325') && help.includes('Landscape Production Tracking'));
assert.ok(roadmap.includes('326 — Mobile Crew App v2'));

const require=createRequire(import.meta.url);
const ts=require('typescript');
for(const path of ['supabase/functions/operations-manage/index.ts','supabase/functions/_shared/module-write-boundaries.ts']){
  const output=ts.transpileModule(read(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:path});
  const errors=(output.diagnostics||[]).filter((diag)=>diag.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,errors.map((diag)=>ts.flattenDiagnosticMessageText(diag.messageText,'\n')).join(' | '));
}
new Function(ui);

console.log('PASS build325-schema214-production-authority');
console.log('PASS build325-field-execution-evidence');
console.log('PASS build325-canonical-material-trigger-repair');
console.log('PASS build325-canonical-resource-authorities');
console.log('PASS build325-private-production-data');
console.log('PASS build325-operations-wiring');
console.log('PASS build325-cockpit');
console.log('PASS build325-release-gates');
console.log('PASS build325-roadmap-advance');
console.log('\nBuild 325 Landscape Production Tracking source gate passed: 9/9 checks.');
