import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=(file)=>fs.readFileSync(file,'utf8');
const mobile=read('js/mobile-today.js');
const endpoint=read('supabase/functions/mobile-crew-context/index.ts');
const manage=read('supabase/functions/operations-manage/index.ts');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const fallback=read('sql/215_mobile_crew_app_v2.sql');

const browser={};
vm.runInNewContext(mobile,{window:browser,document:{addEventListener(){}},navigator:{onLine:true},console},{filename:'mobile-today.js'});
const ui=browser.YWIMobileToday;
const rejected='2026-11-08T11:00:00Z';
const row={closeout:{closeout_status:'rework_required',rejected_at:rejected,rejection_reason:'Finish the east fence <script>alert(1)</script>'},evidence:{proofs:[]}};
assert.equal(ui.crewReworkRequired(row),true);
assert.equal(ui.crewReworkRequired({...row,closeout:{closeout_status:'approved'}}),false);
assert.equal(ui.crewCorrectionProof(row,'crew'),null);
assert.equal(ui.crewCorrectionProof({...row,evidence:{proofs:[{id:'old',title:'Crew rework correction',created_at:'2026-11-08T10:00:00Z',captured_by_profile_id:'crew',proof_status:'submitted'}]}},'crew'),null,'Old proof cannot resubmit new rejection');
assert.equal(ui.crewCorrectionProof({...row,evidence:{proofs:[{id:'other',title:'Crew rework correction',created_at:'2026-11-08T12:00:00Z',captured_by_profile_id:'someone-else',proof_status:'submitted'}]}},'crew'),null,'Other crew member proof is not a self-resubmission');
assert.equal(ui.crewCorrectionProof({...row,evidence:{proofs:[{id:'new',title:'Crew rework correction',created_at:'2026-11-08T12:00:00Z',captured_by_profile_id:'crew',proof_status:'submitted'}]}},'crew')?.id,'new');
const markup=ui.crewReworkMarkup(row,0);
assert.ok(markup.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),'Crew instructions must escape staff input');
assert.ok(!markup.includes('<script>'));
assert.ok(markup.includes('disabled'),'No authenticated capability means no action');
assert.equal(ui.crewReworkMarkup({...row,closeout:{closeout_status:'approved'}},0),'');

for(const pattern of [
  'workOrderIds', 'assignedDispatch', 'candidateDispatch.filter', 'rejection_reason:closeout.rejection_reason',
  'captured_by_profile_id', 'proof.created_at', 'proof.proof_status', 'rejected_at'
]) assert.ok(endpoint.includes(pattern),'Missing assignment-safe Edge projection '+pattern);
assert.ok(fallback.includes('then rejection_reason else null end'),'Fallback RPC must not show non-rework rejection notes');
assert.ok(fallback.includes('assigned as ('),'Fallback RPC must remain assignment-filtered');
for(const action of ['work_order_rework_proof_submit','work_order_rework_resubmit']){
  assert.ok(boundaries.includes(`${action}: contract('${action}', 'jobs', 'create'`),'Missing Jobs/create guard '+action);
  assert.ok(manage.includes(`action === '${action}'`),'Missing server action '+action);
  assert.ok(mobile.includes(`action:'${action}'`),'Missing mobile action '+action);
}
for(const guard of [
  'requireRank(profile, 20, action)', "from('crew_members')", "from('dispatch_schedule_items')", "from('work_order_closeout_packages')",
  "from('work_order_execution_proofs')", "eq('captured_by_profile_id',profile.id)",
  'p_customer_visible:false','p_customer_notification_requested:false',"p_visibility:'staff'",'Date.parse(proof.created_at)>Date.parse(closeout.rejected_at)',
  "['cancelled','superseded']", "throw new HttpError(403,'Only crew assigned",'return Response.json({ok:true,replayed:true'
]) assert.ok(manage.includes(guard),'Missing fail-closed resubmission guard '+guard);
assert.ok(!manage.slice(manage.indexOf("if (action === 'work_order_rework_proof_submit'"),manage.indexOf("if (action === 'work_order_execution_proof_submit'")).includes('ywi_rpc_decide_work_order_closeout_package'),'Crew rework must not decide supervisor closeout');
console.log('YW 546 assigned-only mobile rework, staff-only correction and review-resubmission contracts GREEN');
