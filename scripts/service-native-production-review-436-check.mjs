import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const js=read('js/service-native-production-review-436.js');
new Function(js);
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(js,sandbox);
const {inspect,inspectDirectory,services}=sandbox.window.YWI436;
const companyId='company-1',workOrderId='order-1';
const order=(service)=>({id:workOrderId,number:'WO-1',status:'in_progress',...(service.startsWith('snow_')?{service}:{})});
const payload=(service,additional={})=>({company_id:companyId,work_order_id:workOrderId,
 complete:true,source_limit:80,state:'review_only',orders:[order(service)],...additional});
const run=(service,additional,enabled=true)=>inspect(payload(service,additional),{companyId,workOrderId,serviceKey:service,enabled});
const expect=(result,state,label)=>{assert.equal(result.state,state,label+': '+(result.reason||''));assert.equal(result.authorized,false,label);return result;};

assert.deepEqual(Object.keys(services),['landscape','construction','water_parks','snow_removal','snow_plowing','septic']);
const source={id:'quantity-1',eligible:true,actual_quantity:2,unit_label:'m2',metric_label:'Mowing area'};
const attestation={id:'receipt-1',production_quantity_id:'quantity-1',state:'recorded_unreviewed'};
const landscape={sources:[source],receipts:[attestation]};
expect(run('landscape',landscape),'review','genuine measured original with attestation stays manual review');
expect(run('landscape',{...landscape,receipts:[]}), 'hold','missing field receipt');
expect(run('landscape',{...landscape,sources:[]}), 'withheld','orphaned field receipt withheld');
expect(run('landscape',{...landscape,sources:[{...source,actual_quantity:0}]}),'hold','zero is not completed measured grounds work');
expect(run('landscape',{...landscape,receipts:[attestation,attestation]}),'withheld','duplicate receipt');
expect(run('landscape',landscape,false),'hold','disabled offering never authorizes new work');

const construction={phases:[{id:'phase-1'}],permits:[{id:'permit-1',phase_id:'phase-1',
 evidence_state:'recorded_unverified',financial_gate:'source_verified_only',safety_gate:'source_reviewed_only'}],
 safety:[{id:'safety-1'}],changes:[],lines:[{id:'line-1'}],
 release:{signoff_present:true,release_status:'released',threshold_status:'pass'}};
expect(run('construction',construction),'review','recorded phase permit and release is still just review');
expect(run('construction',{...construction,permits:[]}), 'hold','phase without original permit/document note');
expect(run('construction',{...construction,permits:[{...construction.permits[0],phase_id:'other-phase'}]}),
 'withheld','permit referring to nonselected phase');
expect(run('construction',{...construction,release:{...construction.release,signoff_present:false}}),
 'hold','unapproved original release');

const aquatic={inspections:[{id:'inspection-1',evidence_state:'recorded_unverified',
 closure_gate:'independent_safety_review_still_required',observed_issue:'none_reported'}],
 followups:[{id:'followup-1',inspection_id:'inspection-1',evidence_state:'recorded_unverified'}],
 safety:[{id:'safety-1'}]};
expect(run('water_parks',aquatic),'review','aquatic observations never independently reopen a park');
expect(run('water_parks',{...aquatic,inspections:[{...aquatic.inspections[0],observed_issue:'chemical_concern'}]}),
 'hold','reported aquatic concern');
expect(run('water_parks',{...aquatic,followups:[{...aquatic.followups[0],inspection_id:'foreign'}]}),
 'withheld','foreign inspection followup');
expect(run('water_parks',{...aquatic,safety:[]}), 'hold','missing original aquatic Safety');

const snow={sources:[{dispatch_id:'dispatch-1',activation_id:'activation-1'}],
 receipts:[{id:'storm-receipt-1',dispatch_id:'dispatch-1',service_module_key:'snow_plowing',
  evidence_state:'reported_unverified',source_gate:'independent_dispatch_safety_review_required'}],
 workability:[{id:'weather-1'}],safety:[{id:'safety-1'}],fleet:[{id:'fleet-1'}]};
expect(run('snow_plowing',snow),'review','plowing ticket with distinct Fleet and Dispatch originals');
expect(run('snow_plowing',{...snow,fleet:[]}), 'hold','plowing without Fleet proof');
expect(run('snow_plowing',{...snow,receipts:[]}), 'hold','original storm activation without service receipt');
expect(run('snow_plowing',{...snow,receipts:[{...snow.receipts[0],service_module_key:'snow_removal'}]}),
 'withheld','snow removal receipt cannot stand in for plowing');
expect(run('snow_removal',{...snow,receipts:[{...snow.receipts[0],service_module_key:'snow_removal'}],fleet:[]}),
 'review','sidewalk removal is separate and does not automatically need plow Fleet');
expect(run('snow_removal',{...snow,receipts:[{...snow.receipts[0],service_module_key:'snow_removal',source_gate:'hold'}],fleet:[]}),
 'hold','source safety storm hold remains hold');

const septic={dispatch:[{id:'dispatch-1'}],artifacts:[{id:'media-1'}],fleet:[{id:'fleet-1'}],
 safety:[{id:'safety-1'}],receipts:[{id:'disposal-1',dispatch_id:'dispatch-1',original_proof_media_id:'media-1',
 disposal_facility:'Original depot',disposal_receipt_number:'TICKET-1234',measured_volume_l:2300,
 evidence_state:'operator_reported_unverified',review_gate:'independent_disposal_safety_review_required'}]};
expect(run('septic',septic),'review','genuine ticket sources still not legal disposal certification');
expect(run('septic',{...septic,receipts:[]}), 'hold','septic missing genuine ticket');
expect(run('septic',{...septic,artifacts:[]}), 'withheld','orphaned disposal source media');
expect(run('septic',{...septic,receipts:[{...septic.receipts[0],measured_volume_l:0}]}),
 'hold','zero or invented volume cannot be accepted');
expect(run('septic',{...septic,receipts:[{...septic.receipts[0],review_gate:'hold'}]}),
 'hold','safety hold never inferred released');

for(const [reason,field] of [
 ['foreign company',{company_id:'foreign'}],['foreign work order',{work_order_id:'foreign'}],
 ['incomplete source',{complete:false}],['source cap',{source_limit:999}],
 ['bad state',{state:'completed'}],['wrong order',{orders:[{id:'other',number:'WO-X',status:'new'}]}],
 ['too many rows',{sources:Array.from({length:81},(_,i)=>({...source,id:'quantity-'+i}))}]
])expect(inspect(payload('landscape',{...landscape,...field}),{companyId,workOrderId,serviceKey:'landscape'}),
 'withheld',reason);
const directory=(service,extra={})=>inspectDirectory({company_id:companyId,work_order_id:null,
 complete:true,source_limit:80,state:'choose_order',orders:[order(service)],...extra},companyId,service);
expect(directory('landscape'),'review','owner-only Jobs directory');
expect(directory('snow_plowing',{orders:[order('snow_plowing'),{id:'sidewalk',number:'WO-2',status:'open',service:'snow_removal'}]}),
 'review','distinct snow service directories');
assert.equal(directory('snow_plowing',{orders:[order('snow_plowing'),{...order('snow_plowing')}]}).state,'withheld');
assert.equal(directory('snow_plowing',{company_id:'foreign'}).state,'withheld');

assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'Operator panel has no database writes');
for(const key of ['owner436','YWI_AUTH','auth.getUser','ywi_company_service_modules',
 'ywi_rpc_landscape_field_dashboard_424','ywi_rpc_construction_dashboard_425',
 'ywi_rpc_aquatic_dashboard_426','ywi_rpc_snow_service_dashboard_427',
 'ywi_rpc_septic_disposal_dashboard_428','ywi:auth-changed'])assert.ok(js.includes(key),key);
assert.ok(read('index.html').includes('js/service-native-production-review-436.js'));
assert.ok(read('help.html').includes('id="service-native-production-review-436"'));
const pkg=JSON.parse(read('package.json'));
for(const name of ['test:service-native-production-review-436','test:browser:service-native-production-review-436']){
 assert.ok(pkg.scripts[name]);assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+name));
}
console.log('YW Build 436 six-service original Production/evidence review and safety boundary: PASS');
