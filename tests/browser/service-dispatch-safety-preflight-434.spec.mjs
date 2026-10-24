import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const core=fs.readFileSync('js/six-service-owner-trial-430.js','utf8');
const ui=fs.readFileSync('js/service-dispatch-safety-preflight-434.js','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];

async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(({opts,keys})=>{
  window.__calls=[];window.__writes=[];
  const date=(offset)=>new Date(Date.now()+offset).toISOString(),exp=new Date(Date.now()+400*86400000).toISOString();
  const history={company_id:'company',client_id:'customer',legacy_unscoped_excluded:true,history_limit_per_type:80,
   properties:[{id:'site',name:'Actual property'}],estimates:[],work_orders:[{id:'job',number:'WO-1',service:'snow_plowing',property_id:'site',status:'scheduled',created_at:date(-60000)}]};
  const dispatch={id:'dispatch',work_order_id:'job',site_matches:true,status:'scheduled',
   start:date(3600000),end:date(7200000),workability_state:opts.blocked?'blocked':'workable',
   crew_id:'crew',crew_status:'active',crew_members:2,lead_recorded:true,supervisor_recorded:true,
   conflicts_checked:true,conflict_count:0,truck_id:10,trailer_id:null,equipment_ids:[],
   equipment:[{id:10,name:'Snow truck',status:'active',locked_out:opts.locked||false,
    fleet_status:'active',fleet_readiness:'ready',fleet_checked_at:date(-3600000),fleet_downtime:0,
    registration_expiry:exp,insurance_expiry:exp,inspection_due:exp}],
   observation:{id:'observation',dispatch_id:'dispatch',observed_at:date(-1800000),service_date:date(0).slice(0,10),
    weather_condition:'Clear',condition_tags:[],ground_state:'dry',ice_state:'none',storm_state:'none',linked_packet_id:'packet'},
   decision:{id:'decision',observation_id:'observation',state:'workable',decision_at:date(-600000),by_recorded:true},
   hse_packet_count:1,hse:opts.noSafety?null:{id:'packet',work_order_id:'job',status:'approved',
    briefing_required:false,inspection_required:false,weather_required:true,weather_done:true,
    heat_required:false,heat_done:false,field_signoff_required:true,field_signoff_done:true}};
  const source={company_id:opts.foreign?'foreign':'company',client_id:'customer',site_id:'site',
   work_order_id:'job',work_order_number:'WO-1',service:'snow_plowing',work_order_status:'scheduled',
   service_enabled:true,release_signed:true,dispatch_count:1,dispatches:[dispatch],
   canonical_source:'original_jobs_dispatch_workability_fleet_hse_434',retrieved_at:date(0),
   business_mutations:false,dispatch_authorized:false};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:'owner'}})};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},
   from(table){window.__calls.push(table);return {select(){return this},order(){return this},eq(){return this},
    limit(){return Promise.resolve({data:table==='ywi_companies'
     ?[{id:'company',name:'Real company',owner_user_id:opts.badOwner?'foreign':'owner'}]
     :keys.map(module_key=>({company_id:'company',module_key,enabled:true})),error:null});},
    insert(){window.__writes.push('insert');},update(){window.__writes.push('update');}};},
   rpc:async(name)=>{window.__calls.push(name);return {data:name==='ywi_rpc_company_customers_422'
    ?[{id:'customer',name:'Actual customer',is_active:true}]:
     name==='ywi_rpc_customer_history_422'?history:source,
    error:opts.denied&&name==='ywi_rpc_job_dispatch_preflight_434'?{message:'permission denied'}:null};}};
 },{opts,keys});
 await page.addScriptTag({content:core});await page.addScriptTag({content:ui});
 await page.locator('#owner434 summary').click();
 await page.locator('#owner434Refresh').click();
}
async function selectJob(page){
 await page.locator('#owner434Customer').selectOption('customer');
 await expect(page.locator('#owner434Site option[value="site"]')).toHaveCount(1);
 await page.locator('#owner434Site').selectOption('site');
 await expect(page.locator('#owner434Job option[value="job"]')).toHaveCount(1);
 await page.locator('#owner434Job').selectOption('job');
}
test('390px owner preflight shows original cross-module review without writes or dispatch approval',async({page})=>{
 await setup(page);await selectJob(page);
 await expect(page.locator('[data-owner434-state="review"]')).toHaveCount(1);
 await expect(page.locator('#owner434Status')).toContainText('Never an authorization');
 await expect(page.locator('#owner434Results')).toContainText('Snow plowing');
 await expect(page.locator('#owner434Results')).toContainText('427 distinct plowing event');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>window.__calls)).toEqual(expect.arrayContaining([
  'ywi_companies','ywi_company_service_modules','ywi_rpc_company_customers_422',
  'ywi_rpc_customer_history_422','ywi_rpc_job_dispatch_preflight_434']));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('blocked workability, locked truck or missing Safety always stays HOLD',async({page})=>{
 for(const [opts,phrase] of [[{blocked:true},'workability remains restricted'],
  [{locked:true},'locked out'],[{noSafety:true},'HSE packet missing']]){
  await setup(page,opts);await selectJob(page);
  await expect(page.locator('[data-owner434-state="hold"]')).toHaveCount(1);
  await expect(page.locator('#owner434Results')).toContainText(phrase);
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('cross-company response, denied RPC or signed-out identity never show authorized review',async({page})=>{
 for(const opts of [{foreign:true},{denied:true}]){
  await setup(page,opts);await selectJob(page);
  await expect(page.locator('#owner434Status')).toContainText('WITHHELD');
  await expect(page.locator('[data-owner434-state="review"]')).toHaveCount(0);
 }
 await setup(page,{signedOut:true});
 await expect(page.locator('#owner434Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__calls)).toEqual([]);
 await setup(page,{badOwner:true});
 await expect(page.locator('#owner434Status')).toContainText('WITHHELD');
});
