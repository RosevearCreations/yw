import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/snow-removal-plowing-427.js','utf8');
const ids={company:'bdde97a9-2450-4b31-8609-54bbd1096101',removal:'d8f1c542-050f-4bac-bc27-6fe1c095b228',
 plowing:'7f8bc95d-f54e-4614-afbe-6a70e09711a3',storm:'b11c6598-e715-47a4-aea4-87abe5a11221',
 dispatch1:'7ea0ecdb-31f3-483c-918e-e72554109164',dispatch2:'08b92d96-8aac-46e5-a15d-97e009810292',
 activation:'842acf6d-72a6-4445-91d2-707ae9d7f228',receipt1:'71e0cfe4-5e24-47b1-9a1b-7bb996308cf3',
 receipt2:'ae294091-9fd7-49a0-abcf-a97048db96a1',weather:'05d27c1c-cdc5-4378-9dce-67cf29d507c1',
 safety:'c9639d92-5c58-4402-a309-1c909ba32fa4',fleet:'cf9d02c9-1987-4616-b463-167248ce8a38'};
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><main id="admin"></main></body></html>');
 await page.evaluate(({ids,opts})=>{
  const owner='owner-427';window.__calls=[];window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.noAuth,user:{id:owner}})};
  const recorded={};const workOrders=[{id:ids.removal,number:'SNOW-R',service:'snow_removal',status:'draft'},
   {id:ids.plowing,number:'SNOW-P',service:'snow_plowing',status:'draft'}];
  const src=(order)=>({dispatch_id:order===ids.removal?ids.dispatch1:ids.dispatch2,
   storm_event_id:ids.storm,activation_id:ids.activation,storm_code:'STORM-SHARED',storm_name:'Shared overnight storm',
   storm_status:'active',activation_status:'active',schedule_status:'dispatched',dispatched_at:'2026-10-22T05:00:00Z',
   workability_state:'caution',assigned_truck_equipment_item_id:order===ids.plowing?42:null,receipt_count:recorded[order]?1:0});
  const payload=order=>({company_id:ids.company,work_order_id:order,complete:!opts.partial,
   no_automatic_dispatch:true,no_double_billing:!opts.doubleBill,source_limit:80,
   state:order?'review_only':'choose_order',orders:workOrders,
   sources:order?[src(order)]:[],
   workability:order?[{id:ids.weather,observation_code:'WX-WINTER',service_date:'2026-10-22'}]:[],
   safety:order?[{id:ids.safety,plan_number:'HSE-SNOW',supervisor_review_status:'pending',stop_work_required:true}]:[],
   fleet:order===ids.plowing?[{id:ids.fleet,equipment_item_id:42,readiness_status:'needs_review'}]:[],
   receipts:order&&recorded[order]?[{id:order===ids.removal?ids.receipt1:ids.receipt2,dispatch_id:src(order).dispatch_id,
    storm_event_id:ids.storm,service_module_key:order===ids.removal?'snow_removal':'snow_plowing',
    receipt_key:order===ids.removal?'sidewalk_pass':'lot_plow',surface_kind:order===ids.removal?'sidewalk':'parking_area',
    observed_on:'2026-10-22',reported_passes:2,source_reference:'Dispatch field log SN-427',
    factual_notes:'Operator-reported conditions without independent completion.',
    evidence_state:opts.stale?'source_changed_hold':'reported_unverified',source_gate:'hold'}]:[]});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:owner}}})},
   from(table){return {select(){return this},order(){return this},limit(){return Promise.resolve({error:null,
    data:table==='ywi_companies'?[{id:ids.company,name:'YW',owner_user_id:opts.foreign?'another-owner':owner}]:[]});}}},
   rpc:async(name,args)=>{window.__calls.push({name,args});
    if(name==='ywi_rpc_snow_service_dashboard_427')return {data:payload(args.p_work_order_id),error:null};
    if(name==='ywi_rpc_record_snow_service_427'){recorded[args.p_work_order_id]=true;
     return {data:args.p_work_order_id===ids.removal?ids.receipt1:ids.receipt2,error:null};}
    return {data:null,error:{message:'Unexpected RPC'}};}};
 },{ids,opts});
 await page.addScriptTag({content:source});await page.locator('#owner427 summary').click();await page.locator('#owner427Refresh').click();
}
async function populate(page,order,kind){await page.locator('#owner427Order').selectOption(order);
 await page.locator('#owner427Source').selectOption(ids.storm+'|'+(order===ids.removal?ids.dispatch1:ids.dispatch2));
 await page.locator('#owner427Surface').selectOption(kind);
 await page.locator('#owner427Key').fill(order===ids.removal?'sidewalk_pass':'lot_plow');
 await page.locator('#owner427Date').fill('2026-10-22');await page.locator('#owner427Passes').fill('2');
 await page.locator('#owner427Workability').selectOption(ids.weather);await page.locator('#owner427Safety').selectOption(ids.safety);
 if(order===ids.plowing)await page.locator('#owner427Fleet').selectOption(ids.fleet);
 await page.locator('#owner427Reference').fill('Dispatch field log SN-427');
 await page.locator('#owner427Notes').fill('Operator-reported conditions without independent completion.');
}
test('one storm supports separate removal and plowing services without a billing or dispatch action',async({page})=>{
 await setup(page);await populate(page,ids.removal,'sidewalk');
 await expect(page.locator('#owner427Fleet')).toBeDisabled();
 page.once('dialog',d=>d.accept());await page.locator('#owner427Record').click();
 await expect(page.locator('[data-owner427-receipt]')).toContainText('snow_removal');
 await expect(page.locator('[data-owner427-gate="hold"]')).toContainText('NO automatic dispatch / double billing');
 await populate(page,ids.plowing,'parking_area');
 await expect(page.locator('#owner427Fleet')).toBeEnabled();
 await expect(page.locator('#owner427Surface option[value="sidewalk"]')).toHaveCount(0);
 page.once('dialog',d=>d.accept());await page.locator('#owner427Record').click();
 await expect(page.locator('[data-owner427-receipt]')).toContainText('snow_plowing');
 const calls=await page.evaluate(()=>window.__calls.filter(x=>x.name==='ywi_rpc_record_snow_service_427'));
 expect(calls).toHaveLength(2);expect(calls.map(x=>x.args.p_storm_id)).toEqual([ids.storm,ids.storm]);
 expect(calls.map(x=>x.args.p_dispatch_id)).toEqual([ids.dispatch1,ids.dispatch2]);
 expect(calls.map(x=>x.args.p_surface)).toEqual(['sidewalk','parking_area']);
 expect(calls[0].args.p_fleet_id).toBeNull();expect(calls[1].args.p_fleet_id).toBe(ids.fleet);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('stale source retains HOLD and unverified status, never claims cleared or billed',async({page})=>{
 await setup(page,{stale:true});await populate(page,ids.removal,'sidewalk');
 page.once('dialog',d=>d.accept());await page.locator('#owner427Record').click();
 await expect(page.locator('[data-owner427-receipt]')).toContainText('source_changed_hold');
 await expect(page.locator('[data-owner427-gate="hold"]')).toContainText('hold');
});
test('foreign ownership or truncated service payload blocks all writes',async({page})=>{
 await setup(page,{foreign:true});await expect(page.locator('#owner427Status')).toContainText('WITHHELD');
 await setup(page,{partial:true});await expect(page.locator('#owner427Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner427Form')).toBeHidden();
 await setup(page,{doubleBill:true});await expect(page.locator('#owner427Status')).toContainText('WITHHELD');
});
