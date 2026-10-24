import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {companyId,foreignCompanyId,workOrderId,company,services,fixture}
 from '../tests/fixtures/live-field-trial-integrity-441.mjs';
const read=p=>readFileSync(p,'utf8');
const js=read('js/live-field-trial-integrity-441.js');new Function(js);
const scope={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,scope);
const {inspect,keys,labels}=scope.window.YWI441;
const today=Date.now();
const opts={companyId,workOrderId,now:today};
const lockdown=r=>{
 for(const k of ['trial_accepted','release_green_verified','payroll_authorized',
  'finance_authorized','dispatch_authorized','customer_contact_authorized','mutation_authorized'])
  assert.equal(r[k],false,k);
 return r;
};
assert.equal(keys.length,6);
assert.deepEqual([...keys].sort(),[...services].sort());
assert.equal(company.name,'Yard Rosevear');
for(const service of services){
 const f=fixture(service);
 const dir=lockdown(inspect(f.directory,{companyId,now:today}));
 assert.equal(dir.state,'choose_order');assert.equal(dir.orders.length,1);
 const d=lockdown(inspect(f.detail,opts));
 assert.equal(d.state,'hold');assert.equal(d.service,service);
 assert.equal(d.coverage.specialist_receipts,1);
 assert.ok(d.gaps.some(g=>g.includes('Independent owner/field acceptance')));
 assert.ok(labels[service]);
}
function verify(state,change={},expected='withheld'){
 const {detail}=fixture();Object.assign(detail,change);
 const result=lockdown(inspect(detail,opts));
 assert.equal(result.state,expected,`${state}: ${result.reason||result.gaps}`);
 return result;
}
verify('foreign company',{company_id:foreignCompanyId});
verify('foreign order',{work_order_id:'b4410000-0000-4441-8441-000000000099'});
verify('privacy flag',{privacy_minimized:false});
verify('release must be false',{release_green_verified:true});
verify('mutation denied',{mutation_authorized:true});
verify('missing module',{modules:fixture().detail.modules.slice(1)});
verify('duplicate entitlement',{modules:[...fixture().detail.modules.slice(0,5),fixture().detail.modules[0]]});
verify('foreign selected job',{order:{...fixture().detail.order,id:'b4410000-0000-4441-8441-000000000099'}});
verify('unmatched job directory',{orders:[]});
verify('missing count',{coverage:{...fixture().detail.coverage,original_proofs:-1}});
verify('oversize evidence',{coverage:{...fixture().detail.coverage,original_proofs:81}});
verify('future capture',{captured_at:new Date(today+180000).toISOString()});
verify('stale capture',{captured_at:new Date(today-10*60000).toISOString()});
verify('source after capture',{source_last_at:new Date(today+180000).toISOString()});
verify('no owner property links',{order:{...fixture().detail.order,verified_company_customer_property:false}},'hold');
verify('service switched off',{order:{...fixture().detail.order,service_enabled_now:false},
 modules:fixture().detail.modules.map(m=>m.module_key==='landscape'?{...m,enabled:false}:m)},'hold');
verify('no on-site records',{coverage:{original_proofs:0,dispatch_records:0,qc_runs:0,specialist_receipts:0},source_last_at:null},'hold');
verify('old source activity',{source_last_at:new Date(today-40*86400000).toISOString()},'hold');
verify('no customer',{order:{...fixture().detail.order,customer_present:false}},'hold');
verify('no original QC',{coverage:{...fixture().detail.coverage,qc_runs:0}},'hold');
for(const clause of ['ywi_422_assert_owner','ywi_423_assert_order',
 'join public.ywi_company_site_links_422','from public.ywi_company_client_links_422',
 'ywi_landscape_field_receipts_424','ywi_construction_permit_notes_425',
 'ywi_aquatic_inspections_426','ywi_snow_service_receipts_427',
 'ywi_septic_disposal_receipts_428','revoke all on function public.ywi_rpc_live_field_trial_integrity_441',
 "'trial_accepted',false","'release_green_verified',false","'mutation_authorized',false"])
 assert.ok(read('sql/live_field_trial_integrity_441.sql').includes(clause),clause);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'browser is strictly read only');
for(const word of ['auth.getUser','ywi:auth-changed','ywi_rpc_live_field_trial_integrity_441',
 'role','status','help.html#live-trial-integrity-441','https://yw-alpha.vercel.app'])
 assert.ok(js.includes(word),word);
assert.ok(read('index.html').includes('js/live-field-trial-integrity-441.js'));
assert.ok(read('help.html').includes('id="live-trial-integrity-441"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('Yard Rosevear'));
for(const key of ['test:live-field-trial-integrity-441','test:browser:live-field-trial-integrity-441']){
 assert.ok(JSON.parse(read('package.json')).scripts[key]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+key));
}
console.log('YW 441 six-service synthetic Yard Rosevear identity/privacy/mobile source/readiness gates: PASS');
