import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(path)=>fs.readFileSync(path,'utf8');
const endpoint=read('supabase/functions/mobile-crew-context/index.ts');
const mobile=read('js/mobile-today.js');
const api=read('js/api.js');
const jobs=read('js/jobs-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const migration=read('sql/215_mobile_crew_app_v2.sql');

const must=(source, needles, label)=>needles.forEach((needle)=>assert.ok(source.includes(needle), label + ': missing ' + needle));

must(endpoint,[
  'build:326',
  'schema:215',
  'assignment_filtered:true',
  'finance_exposed:false',
  'assigned_crew_profile_ids',
  'crew_members',
  'lead_profile_id',
  'assigned_supervisor_profile_id',
  'client_sites',
  'recurring_property_instructions',
  'job_session_production_quantities',
  'material_issues',
  'equipment_signouts',
  'work_order_execution_proofs',
  'work_order_closeout_packages',
  'hasModuleAccess(supabase, profile, "jobs", "view")'
],'mobile crew context');
assert.ok(!endpoint.includes('subtotal,total_amount,total_cost'), 'Mobile crew response must not expose work-order Finance totals.');

must(api,['fetchMobileCrewContext','mobile-crew-context','ywi_rpc_mobile_crew_context','window.YWI_SB || window._sb'],'API client');
must(migration,['security definer','auth.uid()','ywi_effective_module_access','assignment-filtered','ywi_rpc_mobile_crew_context','revoke execute on function public.ywi_rpc_mobile_crew_context(integer) from public, anon','grant execute on function public.ywi_rpc_mobile_crew_context(integer) to authenticated','v_mobile_crew_app_v2_security_assertions','215 as expected_schema_version','exposes no Finance totals'],'schema 215 mobile crew RPC');
must(mobile,[
  'Mobile Crew App v2',
  'My Route',
  'My Jobs',
  'Property access',
  'Clock / Break',
  'Safety / Inspection',
  'Equipment Scan',
  'Production Qty',
  'Live Update',
  'Execution Proof',
  'Deficiency / Rework',
  'Closeout Request',
  'Offline — no crew snapshot',
  '390/430-width phones',
  "action:'landscape_production_session_save'",
  "action:'landscape_production_quantity_save'",
  "action:'work_order_live_update_create'",
  "action:'work_order_execution_proof_submit'",
  "action:'work_order_closeout_submit'"
],'mobile crew UI');
must(jobs,['Mobile Crew App v2 is available from Today','full Jobs directory remains Supervisor+'],'Jobs privilege boundary');
must(help,['Mobile Crew App v2','assignment-filtered','customer signoff'],'Build 326 help');
must(roadmap,['326 — Mobile Crew App v2','Items **318','**326 — Mobile Crew App v2** are implemented','next planned autonomous item is **327 — Safety & Compliance Command Centre**'],'roadmap closure');

console.log('Build 326 Mobile Crew App v2 source gate GREEN');
