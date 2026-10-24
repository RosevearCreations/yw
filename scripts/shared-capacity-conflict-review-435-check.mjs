import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(path,'utf8');
const js=read('js/shared-capacity-conflict-review-435.js');new Function(js);
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(js,ctx);
const inspect=ctx.window.YWI435.inspect;
const now=Date.parse('2026-10-24T12:00:00Z');
const start='2026-10-24T00:00:00.000Z',end='2026-10-31T00:00:00.000Z';
const date=(day,hour)=>`2026-10-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:00:00Z`;
const asset=(id=10)=>({id,name:'Truck',status:'active',locked_out:false,
 fleet_status:'active',fleet_readiness:'ready',fleet_checked_at:date(24,11),fleet_downtime:0,
 registration_expiry:'2027-10-24',insurance_expiry:'2027-10-24',inspection_due:'2027-10-24'});
const one={id:'dispatch-1',work_order_id:'job-1',work_order_number:'WO-1',service:'landscape',
 status:'scheduled',start:date(25,9),end:date(25,12),crew_id:'crew-1',
 crew_member_ids:['person-1'],lead_id:'person-2',supervisor_id:'supervisor-1',profile_ids:[],
 truck_id:10,trailer_id:null,equipment_ids:[],assets:[asset()]};
const two={...one,id:'dispatch-2',work_order_id:'job-2',work_order_number:'WO-2',
 service:'snow_plowing',start:date(25,11),end:date(25,14),crew_id:'crew-2',
 crew_member_ids:['person-3'],lead_id:'person-4',supervisor_id:'supervisor-2',
 truck_id:20,assets:[asset(20)]};
const proof={id:'mat-1',issue_id:'issue-1',work_order_id:'job-1',site_id:'site-1',
 original_site_id:'site-1',material_id:'material-1',description:'Salt',issue_number:'ISS-1',
 issue_status:'issued',issue_date:'2026-10-25',usage_type:'job_use',quantity:2,
 source_amount:40,proof_id:'proof-1',proof_work_order_id:'job-1',proof_matches:true};
const checkout={id:55,work_order_id:'job-1',asset_id:10,out:date(25,9),
 returned:date(25,12),verification:'arrived_verified',proof_id:'proof-2',
 proof_work_order_id:'job-1',proof_matches:true};
const source={company_id:'company-1',window_start:start,window_end:end,
 canonical_source:'original_dispatch_fleet_equipment_material_423_435',retrieved_at:'2026-10-24T11:59:00Z',
 company_scope_only:true,sources_complete:true,cost_posting:false,stock_adjustment:false,
 automatic_reallocation:false,dispatch_authorized:false,dispatch_count:2,signout_count:1,
 material_count:1,dispatches:[one,two],signouts:[checkout],materials:[proof]};
const run=(change={})=>inspect({...source,...change},'company-1',start,end,now);
const state=(changes,expected,name)=>{
 const r=run(changes);assert.equal(r.state,expected,name+': '+(r.reason||''));assert.equal(r.authorized,false,name);return r;};
assert.equal(state({},'review','nonoverlapping, evidenced resources').conflicts.length,0);
const d=(change)=>({...one,...change});
const withSecond=(change)=>({dispatches:[one,{...two,...change}]});
let r=state(withSecond({crew_id:'crew-1'}),'hold','same original crew overlapping');
assert.ok(r.conflicts.some(x=>x.message.includes('CROSS-SERVICE')));
r=state(withSecond({crew_member_ids:['person-1']}),'hold','individual belongs to shared crews');
assert.ok(r.conflicts.some(x=>x.category==='person:person-1'));
r=state(withSecond({truck_id:10,assets:[asset(10)]}),'hold','truck shared across services');
assert.ok(r.conflicts.some(x=>x.category==='asset:10'));
state(withSecond({start:date(25,12),end:date(25,15),crew_id:'crew-1'}),'review','back to back does not overlap');
state(withSecond({status:'cancelled',crew_id:'crew-1'}),'review','cancelled historical excluded');
state({dispatches:[d({equipment_ids:[10],assets:[asset(10)]}),two]},'hold','duplicate asset within dispatch');
state({dispatches:[d({truck_id:null,assets:[]}),two]},'review','no truck is not invented as assignment');
state({dispatches:[d({truck_id:10,assets:[{...asset(),locked_out:true}]}),two]},'hold','original lockout');
state({dispatches:[d({truck_id:10,assets:[{...asset(),fleet_readiness:'failed'}]}),two]},'hold','fleet readiness');
state({materials:[{...proof,proof_id:null,proof_matches:null}]},'hold','missing material source receipt');
state({materials:[{...proof,proof_work_order_id:'job-2'}]},'hold','wrong job receipt');
state({materials:[{...proof,proof_matches:false}]},'hold','stale material fingerprint');
state({materials:[{...proof,site_id:'foreign-site'}]},'hold','material issue wrong site');
state({materials:[{...proof,issue_status:'draft',proof_id:null,proof_matches:null}]},'review','draft is not issued cost');
state({signouts:[{...checkout,proof_id:null,proof_matches:null}]},'hold','missing equipment receipt');
state({signouts:[{...checkout,proof_matches:false}]},'hold','stale equipment fingerprint');
state({signouts:[checkout,{...checkout,id:56,work_order_id:'job-2',out:date(25,10),returned:date(25,13)}],signout_count:2},'hold','overlapping original checkouts');
state({dispatches:[],dispatch_count:0,signouts:[],signout_count:0,materials:[],material_count:0},'hold','empty company is not cleared');
for(const [name,change] of [
 ['foreign company',{company_id:'foreign'}],['stale source',{retrieved_at:date(23,10)}],
 ['future source',{retrieved_at:date(25,12)}],['invented charges',{cost_posting:true}],
 ['invented Dispatch',{dispatch_authorized:true}],['incomplete',{sources_complete:false}],
 ['count mismatch',{dispatch_count:5}],['duplicate dispatch',{dispatches:[one,one]}],
 ['duplicate material',{materials:[proof,proof],material_count:2}],
 ['foreign material',{materials:[{...proof,work_order_id:'another-company-job'}]}],
 ['invalid schedule',{dispatches:[d({start:date(25,15),end:date(25,12)}),two]}],
 ['malformed original crew',{dispatches:[d({crew_member_ids:null}),two]}]
])state(change,'withheld',name);
const sql=read('sql/shared_capacity_conflict_review_435.sql');
for(const token of ['ywi_422_assert_owner','work_orders','dispatch_schedule_items',
 'crew_members','v_fleet_vehicle_operations','equipment_signouts','material_issue_lines',
 'material_issues','ywi_work_order_allocation_proofs_423','ywi_423_source_fingerprint',
 'security definer','set search_path','revoke all','to authenticated','14 days',
 'company_id=p_company_id','v_count>80','v_count>120'])
 assert.ok(sql.includes(token),token);
assert.ok(!/\b(insert into|update public\.|delete from|drop table|alter table|truncate)\b/i.test(sql),'RPC has no business writes');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'browser has no business writes');
for(const token of ['owner435','ywi_rpc_shared_capacity_review_435','auth.getUser','ywi:auth-changed','company_scope_only'])
 assert.ok(js.includes(token),token);
assert.ok(read('index.html').includes('js/shared-capacity-conflict-review-435.js'));
assert.ok(read('help.html').includes('id="shared-capacity-conflict-review-435"'));
for(const key of ['test:shared-capacity-conflict-review-435','test:browser:shared-capacity-conflict-review-435']){
 assert.ok(JSON.parse(read('package.json')).scripts[key]);
 assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+key));
}
console.log('Item 435 company-only shared crew/Fleet/equipment and original material/cost-source review: PASS');
