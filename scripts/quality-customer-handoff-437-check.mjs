import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const source=read('js/quality-customer-handoff-437.js');
new Function(source);
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(source,sandbox);
const {inspect,inspectDirectory,labels}=sandbox.window.YWI437;
const keys=Object.keys(labels);
const companyId='owner-company',workOrderId='original-order',serviceKey='landscape';
const approvedAt='2026-10-24T09:00:00.000Z';
const signedAt='2026-10-24T09:02:00.000Z';
const order=service=>({id:workOrderId,number:'WO-437',status:'qc_pending',service});
const qc={id:'qc-1',work_order_id:workOrderId,run_status:'approved',review_status:'approved',
 reviewed_by_profile_id:'supervisor-1',reviewed_at:approvedAt};
const item={id:'item-1',qc_run_id:'qc-1',is_required:true,result_status:'pass',completed_at:approvedAt,evidence_requirement:'after'};
const evidence={id:'link-1',qc_run_id:'qc-1',qc_item_id:'item-1',execution_proof_id:'proof-1',
 evidence_role:'after',proof_work_order_id:workOrderId,proof_status:'approved',customer_safe:true,customer_visible:true};
const closeout={id:'closeout-1',work_order_id:workOrderId,closeout_status:'approved',
 approved_by_profile_id:'supervisor-1',approved_at:approvedAt,customer_signoff_required:true,
 customer_signoff_status:'signed',signed_off_at:signedAt,customer_change_requested:false};
const signoff={id:'customer-portal-sign-1',closeout_package_id:'closeout-1',signoff_status:'signed',created_at:signedAt};
const base=(service='landscape')=>({company_id:companyId,work_order_id:workOrderId,
 complete:true,source_limit:80,state:'review_only',approval_or_signature_write:false,
 customer_message_sent:false,site_reopened:false,orders:[order(service)],
 qc,items:[item],deficiencies:[],rework:[],evidence:[evidence],closeout,signoffs:[signoff]});
const check=(overrides,state,name,service=serviceKey)=>{
 const result=inspect({...base(service),...overrides},{companyId,workOrderId,serviceKey:service});
 assert.equal(result.state,state,`${name}: ${result.reason||JSON.stringify(result.holds)}`);
 assert.equal(result.authorized,false,`${name}: never approves`);
 assert.equal(result.completed,false,`${name}: never completes Jobs`);
 assert.equal(result.customer_signed,false,`${name}: never claims to sign`);
 return result;
};

assert.deepEqual(keys,['landscape','construction','water_parks','snow_removal','snow_plowing','septic']);
for(const service of keys){
 const result=check({},'review',`authentic QC and customer record for ${service}`,service);
 assert.equal(result.service,service);
 assert.equal(result.counts.portal_signoffs,1);
 assert.match(result.review,/Not a new QC sign-off/);
}
check({qc:null,items:[],evidence:[]},'hold','absent genuine QC is not approval');
check({qc:{...qc,review_status:'rework_required'}},'hold','supervisor QC rework hold');
check({qc:{...qc,reviewed_at:null}},'hold','undated QC approval');
check({items:[{...item,result_status:'fail'}]},'hold','failed mandatory checklist');
check({items:[{...item,result_status:'pending',completed_at:null}]},'hold','pending mandatory checklist');
check({items:[{...item,evidence_requirement:'before_after'}]},'hold','incomplete before-and-after photo proof');
check({evidence:[]},'hold','missing customer-visible execution proof');
check({evidence:[{...evidence,proof_status:'submitted'}]},'hold','submitted but not approved proof');
check({evidence:[{...evidence,customer_safe:false}]},'hold','not customer safe');
const deficiency={id:'def-1',qc_run_id:'qc-1',qc_item_id:'item-1',deficiency_status:'open',resolved_at:null};
check({deficiencies:[deficiency]},'hold','unresolved original customer QC objection');
check({deficiencies:[{...deficiency,deficiency_status:'accepted_exception'}]},'hold','accepted exception does not silently clear');
check({deficiencies:[{...deficiency,deficiency_status:'resolved',resolved_at:approvedAt}],
 rework:[{id:'rework-1',deficiency_id:'def-1',event_type:'progress',recorded_at:approvedAt,
  resolution_execution_proof_id:null,resolution_proof_work_order_id:null,resolution_proof_status:null}]},
 'hold','uncompleted original rework is not closure');
check({closeout:null,signoffs:[]},'hold','missing original supervisor closeout');
check({closeout:{...closeout,closeout_status:'submitted'}},'hold','submitted closeout not approved');
check({closeout:{...closeout,customer_change_requested:true}},'hold','customer objection not suppressed');
check({closeout:{...closeout,customer_signoff_status:'requested',signed_off_at:null},signoffs:[]},
 'hold','authentic customer signature absent');
check({signoffs:[{...signoff,signoff_status:'declined'}]},'hold','latest portal rejection blocks acceptance');
check({signoffs:[signoff,{...signoff,id:'declined-2',signoff_status:'declined',created_at:'2026-10-24T09:03:00Z'}]},
 'hold','later declined portal signoff prevails');
check({closeout:{...closeout,customer_signoff_required:false,customer_signoff_status:'not_requested',signed_off_at:null},signoffs:[]},
 'review','canonical optional signoff does not invent customer signature');

for(const [name,overrides] of [
 ['foreign company',{company_id:'other'}],['foreign order',{work_order_id:'other'}],
 ['incomplete source',{complete:false}],['uncapped source',{source_limit:500}],
 ['writable response',{approval_or_signature_write:true}],['message sent',{customer_message_sent:true}],
 ['reopened flag',{site_reopened:true}],['duplicate items',{items:[item,item]}],
 ['foreign QC',{qc:{...qc,work_order_id:'other'}}],
 ['foreign QC item',{items:[{...item,qc_run_id:'other'}]}],
 ['foreign proof',{evidence:[{...evidence,proof_work_order_id:'other'}]}],
 ['missing proof',{evidence:[{...evidence,proof_work_order_id:null}]}],
 ['foreign portal signoff',{signoffs:[{...signoff,closeout_package_id:'other'}]}],
 ['foreign closeout',{closeout:{...closeout,work_order_id:'other'}}],
 ['foreign rework proof',{deficiencies:[{...deficiency,deficiency_status:'resolved',resolved_at:approvedAt}],
  rework:[{id:'rework-1',deficiency_id:'def-1',event_type:'completed',recorded_at:approvedAt,
   resolution_execution_proof_id:'proof-2',resolution_proof_work_order_id:'other',resolution_proof_status:'approved'}]}],
 ['over source cap',{items:Array.from({length:81},(_,i)=>({...item,id:`item-${i}`}))}],
 ['missing selected service',{orders:[order('septic')]}],
])check(overrides,'withheld',name);

const dir=extra=>inspectDirectory({company_id:companyId,work_order_id:null,
 complete:true,source_limit:80,state:'choose_order',approval_or_signature_write:false,
 orders:[order('snow_removal'),{...order('snow_plowing'),id:'plow'}],...extra},companyId);
assert.equal(dir().state,'review');
assert.equal(dir({orders:[order('landscape'),order('landscape')]}).state,'withheld');
assert.equal(dir({company_id:'foreign'}).state,'withheld');
assert.equal(dir({orders:[{...order('landscape'),service:'unapproved'}]}).state,'withheld');

const sql=read('sql/quality_control_exception_customer_handoff_437.sql');
for(const marker of ['security definer','set search_path','ywi_422_assert_owner',
 'ywi_423_assert_order','work_order_quality_control_runs','work_order_quality_control_items',
 'work_order_quality_control_deficiencies','work_order_quality_control_rework_events',
 'work_order_quality_control_evidence_links','work_order_execution_proofs',
 'work_order_closeout_packages','work_order_customer_closeout_signoffs',
 'revoke all','grant execute','to authenticated'])assert.ok(sql.includes(marker),marker);
assert.ok(!/\b(insert|update|delete|truncate)\s+(?:from\s+|into\s+)?public\./i.test(sql),
 'owner-guarded SQL does not write original tables');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(source),'panel never writes');
for(const marker of ['owner437','YWI_AUTH','auth.getUser','ywi_companies',
 'ywi_rpc_quality_customer_handoff_437','ywi:auth-changed'])assert.ok(source.includes(marker),marker);
assert.ok(read('index.html').includes('js/quality-customer-handoff-437.js'));
assert.ok(read('help.html').includes('id="quality-customer-handoff-437"'));
const pkg=JSON.parse(read('package.json'));
for(const name of ['test:quality-customer-handoff-437','test:browser:quality-customer-handoff-437']){
 assert.ok(pkg.scripts[name]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+name));
}
console.log('YW 437 owner-guarded original QC, rework, closeout and authentic portal review: PASS');
