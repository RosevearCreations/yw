import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=f=>fs.readFileSync(f,'utf8');
const script=read('js/service-dispatch-safety-preflight-434.js');new Function(script);
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(read('js/six-service-owner-trial-430.js'),sandbox);
vm.runInNewContext(script,sandbox);
const {inspect,services}=sandbox.window.YWI434;
const now=Date.parse('2026-10-23T20:00:00Z');
const at='2026-10-23T19:59:00Z';
const company={id:'company',name:'Original company',owner_user_id:'owner'};
const entitlements=Object.keys(services).map(module_key=>({company_id:'company',module_key,enabled:true}));
const customers=[{id:'customer',name:'Original customer',is_active:true}];
const job={id:'job',number:'WO-1',service:'landscape',property_id:'site',status:'scheduled',created_at:at};
const history={company_id:'company',client_id:'customer',legacy_unscoped_excluded:true,history_limit_per_type:80,
 properties:[{id:'site',name:'Original site'}],estimates:[],work_orders:[job]};
const truck={id:10,name:'Truck',status:'active',locked_out:false,fleet_status:'active',
 fleet_readiness:'ready',fleet_checked_at:'2026-10-23T19:30:00Z',fleet_downtime:0,
 registration_expiry:'2027-10-23',insurance_expiry:'2027-10-23',inspection_due:'2027-10-23'};
const dispatch={id:'dispatch',work_order_id:'job',site_matches:true,status:'scheduled',
 start:'2026-10-23T21:00:00Z',end:'2026-10-23T22:00:00Z',workability_state:'workable',
 crew_id:'crew',crew_status:'active',crew_members:2,lead_recorded:true,supervisor_recorded:true,
 conflicts_checked:true,conflict_count:0,truck_id:10,trailer_id:null,equipment_ids:[],equipment:[truck],
 observation:{id:'observation',dispatch_id:'dispatch',observed_at:'2026-10-23T19:10:00Z',
  service_date:'2026-10-23',weather_condition:'Dry, mild',condition_tags:[],ground_state:'dry',
  ice_state:'none',storm_state:'none',linked_packet_id:'packet'},
 decision:{id:'decision',observation_id:'observation',state:'workable',
  decision_at:'2026-10-23T19:20:00Z',by_recorded:true},
 hse_packet_count:1,hse:{id:'packet',work_order_id:'job',status:'approved',briefing_required:false,
  inspection_required:false,weather_required:true,weather_done:true,heat_required:false,
  heat_done:false,field_signoff_required:true,field_signoff_done:true}};
const source={company_id:'company',client_id:'customer',site_id:'site',work_order_id:'job',
 work_order_number:'WO-1',service:'landscape',work_order_status:'scheduled',service_enabled:true,
 release_signed:true,dispatch_count:1,dispatches:[dispatch],
 canonical_source:'original_jobs_dispatch_workability_fleet_hse_434',retrieved_at:at,
 business_mutations:false,dispatch_authorized:false};
const input={company,uid:'owner',entitlements,customers,history,customerId:'customer',
 siteId:'site',workOrderId:'job',source};
const run=delta=>inspect({...input,...delta},now);
assert.equal(run({}).state,'review','complete evidence still requires human operational review');
assert.equal(run({}).authorized,false);
assert.equal(run({}).dispatches[0].state,'review');
const jobSource=change=>({...input,source:{...source,...change}});
const dispatchSource=change=>jobSource({dispatches:[{...dispatch,...change}]});
const hold=(name,item,needle)=>{
 const result=inspect(item,now);assert.equal(result.state,'hold',name);
 assert.ok(result.dispatches.some(d=>d.holds.some(h=>h.includes(needle)))||
  result.overview?.some(h=>h.includes(needle)),name+' reason '+needle);
 assert.equal(result.authorized,false,name);
};
hold('unsigned Jobs',jobSource({release_signed:false}),'release');
hold('completed Jobs',jobSource({work_order_status:'completed'}),'closed or completed');
hold('disabled',jobSource({service_enabled:false}),'disabled');
hold('no schedule',jobSource({dispatch_count:0,dispatches:[]}), 'No original Dispatch');
hold('crew',dispatchSource({crew_members:0}),'Active assigned crew');
hold('overlap',dispatchSource({conflict_count:1}),'overlap');
hold('workability',dispatchSource({workability_state:'blocked'}),'workability');
hold('supervisor blocked',dispatchSource({decision:{...dispatch.decision,state:'postpone'}}),'postpone');
hold('outdated weather',dispatchSource({observation:{...dispatch.observation,observed_at:'2026-10-20T18:00:00Z'}}),'weather');
hold('empty observation',dispatchSource({observation:{...dispatch.observation,weather_condition:'',condition_tags:[]}}),'Substantive');
hold('missing HSE',dispatchSource({hse:null}),'HSE');
hold('HSE monitoring',dispatchSource({hse:{...dispatch.hse,weather_done:false}}),'weather monitoring');
hold('fleet lockout',dispatchSource({equipment:[{...truck,locked_out:true}]}),'locked out');
hold('missing fleet receipt',dispatchSource({equipment:[{...truck,fleet_checked_at:null}]}),'Fleet readiness');
hold('registration expired',dispatchSource({equipment:[{...truck,registration_expiry:'2026-01-01'}]}),'registration');
for(const service of Object.keys(services)){
 const r=run({history:{...history,work_orders:[{...job,service}]},
  source:{...source,service}});
 assert.equal(r.state,'review',service);assert.equal(r.authorized,false,service);
 assert.ok(r.dispatches[0].reviews.some(s=>s.includes('original source module')),service);
}
for(const [name,item] of [
 ['foreign company',jobSource({company_id:'foreign'})],
 ['foreign job',jobSource({work_order_id:'foreign'})],
 ['different job site',runNotYet()],
 ['wrong owner',{...input,uid:'foreign'}],
 ['unknown job',{...input,history:{...history,work_orders:[]}}],
 ['stale source',jobSource({retrieved_at:'2026-10-23T16:00:00Z'})],
 ['too many dispatches',jobSource({dispatch_count:21})],
 ['duplicated dispatch',jobSource({dispatch_count:2,dispatches:[dispatch,dispatch]})],
 ['unscoped dispatch',dispatchSource({work_order_id:'other'})],
 ['untrusted mutation',jobSource({business_mutations:true})]
]){
 const result=inspect(item,now);assert.equal(result.state,'withheld',name);assert.equal(result.authorized,false,name);
}
function runNotYet(){return {...input,siteId:'other'};}
const sql=read('sql/service_dispatch_safety_preflight_434.sql');
for(const token of ['ywi_422_assert_link','work_orders','ywi_company_service_modules',
 'work_order_release_reviews','dispatch_schedule_items','v_crew_dispatch_schedule',
 'crews','crew_members','v_fleet_vehicle_operations','equipment_items',
 'workability_observations','workability_decisions','linked_hse_packets',
 '20-record limit','ywi_434_dispatch_work_order_idx','p.is_active is true',
 'o.client_site_id is null','p.client_site_id is null',
 'security definer','revoke all','to authenticated'])
 assert.ok(sql.includes(token),token);
assert.ok(!/\b(insert into|update public\.|delete from|drop table|alter table)\b/i.test(sql),'read-only SQL');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(script),'no client writes');
for(const token of ['owner434','ywi_rpc_job_dispatch_preflight_434','auth.getUser','ywi:auth-changed'])
 assert.ok(script.includes(token),token);
assert.ok(read('index.html').includes('js/service-dispatch-safety-preflight-434.js'));
assert.ok(read('help.html').includes('id="service-dispatch-safety-preflight-434"'));
for(const key of ['test:service-dispatch-safety-preflight-434','test:browser:service-dispatch-safety-preflight-434']){
 assert.ok(JSON.parse(read('package.json')).scripts[key]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+key));
}
console.log('Item 434 original Jobs/Dispatch/crew/Fleet/workability/HSE fail-closed preflight: PASS');
