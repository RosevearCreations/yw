import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=f=>fs.readFileSync(f,'utf8');
const sql=read('sql/shared_equipment_material_allocation_proof_423.sql');
const source=read('js/shared-equipment-material-allocation-proof-423.js');
new Function(source);
const window={};vm.runInNewContext(source,{window,document:{readyState:'loading',addEventListener(){}}});
const uuid='6d77d51c-18a2-476e-b4a4-935c0bafc42b';
const order='94713b50-93c8-4885-877b-787967345b2e';
const material='a2dd1e40-1e24-4b2f-8cb8-80b82e030f11';
const seed={company_id:uuid,work_order_id:order,complete:true,no_stock_or_cost_posting:true,
 source_limit:80,state:'recorded',orders:[{id:order,number:'WO-423',service:'landscape',status:'in_progress'}],
 sources:[{source_kind:'material',source_id:material,source_name:'Mulch',source_number:'ISS-23',quantity:4,source_amount:20,eligible:true,already_proven:true}],
 proofs:[{id:'93d448de-c89c-4328-bc63-d2fd31cd6271',source_kind:'material',source_id:material,state:'verified'}]};
assert.equal(window.YWI423.validate(seed,uuid,order),seed);
assert.throws(()=>window.YWI423.validate({...seed,company_id:'foreign'},uuid,order),/Incomplete|cross-company/);
assert.throws(()=>window.YWI423.validate({...seed,complete:false},uuid,order),/Incomplete/);
assert.throws(()=>window.YWI423.validate({...seed,no_stock_or_cost_posting:false},uuid,order),/Incomplete/);
assert.throws(()=>window.YWI423.validate({...seed,sources:[...seed.sources,seed.sources[0]]},uuid,order),/Incomplete|duplicate/);
assert.throws(()=>window.YWI423.validate({...seed,proofs:[{...seed.proofs[0],source_id:'other'}]},uuid,order),/Allocation proof/);
assert.throws(()=>window.YWI423.validate({...seed,sources:[{...seed.sources[0],eligible:'yes'}]},uuid,order),/Incomplete/);
assert.throws(()=>window.YWI423.validate(seed,uuid,null),/Incomplete|Unexpected/);
for(const marker of [
 'public.ywi_work_order_allocation_proofs_423','unique references public.material_issue_lines(id)',
 'unique references public.equipment_signouts(id)','ywi_423_exact_one_source',
 'enable row level security','revoke all on public.ywi_work_order_allocation_proofs_423',
 'ywi_423_proof_no_rewrite','ywi_423_reject_receipt_mutation',
 'grant select on public.ywi_work_order_allocation_proofs_423',
 'public.ywi_422_assert_owner','public.ywi_422_assert_link','public.ywi_422_assert_jobs_create',
 'public.ywi_423_assert_order','public.ywi_423_source_fingerprint',
 'public.ywi_rpc_record_allocation_proof_423','public.ywi_rpc_allocation_dashboard_423',
 'extensions.digest','source_fingerprint=v_fingerprint','source_fingerprint',
 'enabled is true','mi.issue_status','ml.usage_type','job_use',
 'checkout_safety_test_status','is_locked_out','overlapping asset checkouts',
 'for share of ml,mi','for share of es,ei','v_count>80','company_id=p_company_id',
 "then 'verified' else 'hold'",'no_stock_or_cost_posting',
 'material_issued_source_amount','legacy_job_id'
])assert.ok(sql.includes(marker),'Missing safeguard: '+marker);
assert.doesNotMatch(sql,/\b(update|delete|truncate)\s+(?:from\s+)?public\.(?:material_issues|material_issue_lines|equipment_signouts|equipment_items|work_orders|material_stock_adjustments|gl_journal_entries)\b/i);
assert.doesNotMatch(sql,/grant\s+(?:insert|update|delete|all)\s+on\s+public\.ywi_work_order_allocation_proofs_423\s+to\s+authenticated/i);
for(const marker of ['owner423','owner423Refresh','owner423Order','owner423Results',
 'ywi_rpc_allocation_dashboard_423','ywi_rpc_record_allocation_proof_423',
 'window.confirm','ywi:auth-changed','data','WITHHELD'])assert.ok(source.includes(marker),marker);
for(const f of ['index.html','help.html','docs/NEXT_STEPS_AND_SANITY_CHECK.md','docs/ACTIVE_PROJECT_HANDBOOK.md'])
 assert.ok(read(f).includes('423'),f);
assert.ok(read('index.html').includes('/js/shared-equipment-material-allocation-proof-423.js'));
assert.ok(read('help.html').includes('id="shared-allocation-proof-423"'));
const pkg=JSON.parse(read('package.json')).scripts;
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const key of ['test:shared-allocation-proof-423','test:browser:shared-allocation-proof-423']){
 assert.ok(pkg[key]);assert.ok(ci.includes('npm run '+key));
}
console.log('Item 423: canonical source uniqueness, owner/safety/Jobs gates, idempotency, evidence drift, mobile and release checks PASS');
