import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,workOrderId,agreementId,siteId,routeId,
 dispatchId} from '../tests/fixtures/seasonal-contract-continuity-440.mjs';
const read=p=>readFileSync(p,'utf8');
const js=read('js/seasonal-contract-continuity-440.js');new Function(js);
const scope={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,scope);
const {services,future,inspect,verifyRegistry}=scope.window.YWI440;
const opts=serviceKey=>({companyId,workOrderId,serviceKey});
const run=(service='snow_plowing',changes={})=>{
 const x=fixture(service);Object.assign(x.c,changes.c);Object.assign(x.field,changes.field);
 return inspect(x.c,x.field,opts(service));};
const check=(service,changes,state,reason)=>{const r=run(service,changes);assert.equal(r.state,state,reason||r.reason);
 for(const key of ['renewal_authorized','dispatch_authorized','billing_authorized',
  'field_completion_authorized','payroll_authorized'])assert.equal(r[key],false);
 return r;};
assert.equal(Object.keys(services).length,6);
assert.equal(future.length,9);
for(const service of ['landscape','snow_removal','snow_plowing']){
 const r=check(service,{},'hold');assert.equal(r.first_use.date,'2026-10-02');
 assert.equal(r.first_use.kind,'reported_only');assert.equal(r.counts.agreements,1);
 if(service!=='landscape')assert.ok(r.holds.some(h=>h.includes('NO canonical event-ID link')));
}
check('landscape',{c:{agreements:[],visit_events:[],snow_triggers:[]}},'hold','missing legacy agreement');
check('landscape',{c:{service_enabled_now:false}},'hold','disabled offering preserves history');
check('landscape',{c:{order:{...fixture('landscape').c.order,client_site_id:null},
 agreements:[],visit_events:[],snow_triggers:[],dispatch_routes:[]}},'hold','unlinked customer site is hold');
check('landscape',{c:{agreements:[...fixture('landscape').c.agreements,
 {...fixture('landscape').c.agreements[0],id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}]}},'hold','renewal is ambiguous');
check('landscape',{c:{agreements:[{...fixture('landscape').c.agreements[0],client_site_id:'other'}]}},'withheld','foreign property');
check('landscape',{c:{company_id:'foreign'}},'withheld','foreign company');
check('landscape',{c:{source_limit:81}},'withheld','overcap');
check('landscape',{c:{mutation_authorized:true}},'withheld','writes forbidden');
check('landscape',{c:{agreements:[{...fixture('landscape').c.agreements[0],id:agreementId},
 fixture('landscape').c.agreements[0]]}},'withheld','duplicate contract');
check('landscape',{c:{dispatch_routes:[{...fixture('landscape').c.dispatch_routes[0],dispatch_id:dispatchId},
 fixture('landscape').c.dispatch_routes[0]]}},'withheld','duplicate dispatch');
check('snow_plowing',{field:{receipts:[{...fixture().field.receipts[0],dispatch_id:routeId}]}},'withheld','foreign dispatch');
check('snow_removal',{field:{receipts:[{...fixture('snow_removal').field.receipts[0],service_module_key:'snow_plowing'}]}},'withheld','wrong service');
check('snow_plowing',{field:{receipts:[]}},'hold','no first-use receipt');
check('snow_plowing',{c:{snow_triggers:[]}},'hold','missing threshold trigger');
check('snow_plowing',{c:{agreements:[{...fixture().c.agreements[0],route_id:siteId}]}},'hold','unmatched contract route');
const rows=Object.keys(services).map(module_key=>({company_id:companyId,module_key,enabled:false}));
assert.equal(Object.keys(verifyRegistry(rows,companyId)).length,6);
assert.throws(()=>verifyRegistry([...rows,rows[0]],companyId));
assert.throws(()=>verifyRegistry(rows.map((r,i)=>i===0?{...r,company_id:'foreign'}:r),companyId));
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'440 browser must never write');
for(const name of ['ywi_rpc_seasonal_continuity_440','ywi_rpc_landscape_field_dashboard_424',
 'ywi_rpc_snow_service_dashboard_427','ywi_company_service_modules','auth.getUser','ywi:auth-changed'])
 assert.ok(js.includes(name),name);
for(const clause of ['ywi_422_assert_owner','ywi_423_assert_order','a.created_by_profile_id=(select auth.uid())',
 'a.client_site_id=v_order.client_site_id','revoke all on function public.ywi_rpc_seasonal_continuity_440',
 "'automatic_billing',false"])
 assert.ok(read('sql/seasonal_contract_first_use_continuity_440.sql').includes(clause),clause);
assert.ok(read('index.html').includes('js/seasonal-contract-continuity-440.js'));
assert.ok(read('help.html').includes('id="pms-seasonal-continuity-440"'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('Property Maintenance System'));
for(const key of ['test:seasonal-contract-continuity-440','test:browser:seasonal-contract-continuity-440']){
 assert.ok(JSON.parse(read('package.json')).scripts[key]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+key));
}
console.log('YW 440 original seasonal contract, storm and reported first-use continuity / PMS directory: PASS');
