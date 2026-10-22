import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/construction_phase_permit_change_control_425.sql');
const js=read('js/construction-phase-permit-control-425.js');
const ctx={window:{},document:{readyState:'loading',addEventListener(){}},console};
vm.runInNewContext(js,ctx,{filename:'construction-phase-permit-control-425.js'});
const id='635e6fcb-e02e-4cff-98dc-184c340b897e',order='f3beef21-28b2-440a-ac1e-6bdd0794d6d5',
 phase='5c7bbc03-3061-4f54-b5c6-56203513337e',permit='36d32edf-f1b0-4e44-bd85-e13bff87a5ae';
const good={company_id:id,work_order_id:order,complete:true,no_auto_approval:true,source_limit:80,state:'review_only',
 orders:[{id:order,number:'WO-425',status:'draft'}],
 phases:[{id:phase,phase_code:'foundation',phase_label:'Foundation',sequence_number:1,scope_notes:'Excavation layout and source survey.',recorded_at:'2026-10-22T09:00:00Z'}],
 permits:[{id:permit,phase_id:phase,permit_kind:'building',permit_reference:'CITY-425',reported_status:'reported_issued',
  evidence_state:'recorded_unverified',financial_gate:'hold',safety_gate:'hold',field_notes:'Document record only, no verified permit.',observed_on:'2026-10-22'}],
 safety:[],changes:[],lines:[],release:null};
const validate=ctx.window.YWI425.validate;
assert.equal(validate(good,id,order),good);
for(const c of [{company_id:'other'},{complete:false},{no_auto_approval:false},{source_limit:90},
 {phases:[good.phases[0],good.phases[0]]},
 {permits:[{...good.permits[0],financial_gate:'approved'}]},
 {permits:[{...good.permits[0],phase_id:'a3184f53-2c89-4ea3-ae94-ec5b06747547'}]}])
 assert.throws(()=>validate({...good,...c},id,order),/Incomplete|duplicate|cross-company|phase/i);
assert.throws(()=>validate(good,id,null),/Incomplete|Unexpected|cross-company/);
for(const mark of [
 'public.ywi_construction_phases_425','public.ywi_construction_permit_notes_425',
 'unique(work_order_id,phase_code)','unique(phase_id,permit_kind,permit_reference)',
 'source_work_order_line_id uuid references public.work_order_lines',
 'original_safety_plan_id uuid references public.job_hazard_site_safety_plans',
 'original_change_order_id uuid references public.change_orders',
 'reported_status in (\'unknown\',\'submitted\',\'reported_issued\')',
 'source_document_reference','observed_on date not null','recorded_by uuid','recorded_at timestamptz not null default now()',
 'enable row level security','revoke all on public.ywi_construction_phases_425',
 'revoke all on public.ywi_construction_permit_notes_425',
 'ywi_425_owner_phase_select','ywi_425_owner_permit_select',
 'ywi_425_phase_no_rewrite','ywi_425_permit_no_rewrite',
 'public.ywi_423_assert_order(p_company_id,p_work_order_id,p_write)',
 "wo.service_module_key='construction'",'public.ywi_425_original_fingerprint',
 'public.ywi_rpc_create_construction_phase_425','public.ywi_rpc_record_construction_permit_425',
 'public.ywi_rpc_construction_dashboard_425',
 'public.work_order_release_reviews','public.change_order_budget_applications',
 'public.job_hazard_site_safety_plans',"'source_changed_hold'", "'source_verified_only'", "'hold'",
 'no_auto_approval','source_limit',"'recorded_unverified'"])
 assert.ok(sql.includes(mark),`SQL boundary missing: ${mark}`);
assert.doesNotMatch(sql,/grant\s+(?:insert|update|delete|all)\s+on\s+public\.ywi_construction_(?:phases|permit_notes)_425\s+to\s+authenticated/i);
assert.doesNotMatch(sql,/\b(?:update|insert into)\s+public\.(?:change_orders|change_order_budget_applications|work_order_release_reviews|job_hazard_site_safety_plans|work_orders|invoices|journal_entries)\b/i);
for(const mark of ['owner425','owner425Refresh','owner425Order','owner425PhaseForm','owner425PermitForm',
 'owner425Results','ywi_rpc_construction_dashboard_425',
 'ywi_rpc_create_construction_phase_425','ywi_rpc_record_construction_permit_425',
 'window.confirm','WITHHELD','source_limit','no_auto_approval'])
 assert.ok(js.includes(mark),`JS boundary missing: ${mark}`);
for(const f of ['index.html','help.html','docs/NEXT_STEPS_AND_SANITY_CHECK.md','docs/ACTIVE_PROJECT_HANDBOOK.md'])
 assert.ok(read(f).includes('425'),`Missing source/wiring: ${f}`);
assert.ok(read('index.html').includes('/js/construction-phase-permit-control-425.js'));
assert.ok(read('help.html').includes('id="construction-phase-permit-425"'));
for(const t of ['test:construction-phase-permit-425','test:browser:construction-phase-permit-425']){
 assert.ok(read('package.json').includes(t));assert.ok(read('.github/workflows/staging-browser-integration.yml').includes(`npm run ${t}`));}
console.log('Item 425: original Jobs phases, operator-unverified permits, owner/Safety/Finance/change source HOLD, immutable receipts and CI wiring PASS');
