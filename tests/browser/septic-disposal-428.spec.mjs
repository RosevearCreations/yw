import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/septic-haulage-disposal-428.js','utf8');
const ids={company:'bdde97a9-2450-4b31-8609-54bbd1096101',
 order:'d8f1c542-050f-4bac-bc27-6fe1c095b228',
 dispatch:'7ea0ecdb-31f3-483c-918e-e72554109164',
 operator:'96f0c8bf-20a5-4717-9d25-8f519b39283d',
 artifact:'4ed93209-af74-4f65-8d01-9a4232503d57',
 proof:'d81f4165-3ce1-4bec-af84-e7d44d11e332',
 receipt:'0f2020b5-9abd-416c-ab99-1eb52833b0aa',
 safety:'c9639d92-5c58-4402-a309-1c909ba32fa4',
 fleet:'cf9d02c9-1987-4616-b463-167248ce8a38'};
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><main id="admin"></main></body></html>');
 await page.evaluate(({ids,opts})=>{
  const owner='owner-428';window.__calls=[];let saved=false;
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.noAuth,user:{id:owner}})};
  const orders=[{id:ids.order,number:'SEPTIC-001',status:'draft'}];
  const d={id:ids.dispatch,schedule_status:'dispatched',dispatched_at:'2026-10-22T13:00:00Z',
   assigned_truck_equipment_item_id:17,assigned_supervisor_profile_id:ids.operator,
   lead_profile_id:null,assigned_crew_profile_ids:[ids.operator]};
  const a={id:ids.artifact,execution_proof_id:ids.proof,dispatch_id:ids.dispatch,asset_key:'Uploaded disposal ticket'};
  const dashboard=order=>({company_id:ids.company,work_order_id:order,complete:!opts.partial,
   no_auto_disposal:true,no_compliance_certification:!opts.certified,no_billing:true,
   state:order?'review_only':'choose_order',source_limit:80,orders,
   dispatch:order?[d]:[],artifacts:order?[a]:[],
   fleet:order?[{id:ids.fleet,equipment_item_id:17,readiness_status:'blocked'}]:[],
   safety:order?[{id:ids.safety,plan_number:'HAZ-SEPTIC',supervisor_review_status:'pending',stop_work_required:true}]:[],
   receipts:order&&saved?[{id:ids.receipt,dispatch_id:ids.dispatch,operator_profile_id:ids.operator,
    original_proof_media_id:ids.artifact,collected_on:'2026-10-22',disposed_on:'2026-10-22',
    waste_stream:'septic',measured_volume_l:2300,measurement_method:'meter',
    disposal_facility:'Independent disposal facility',disposal_receipt_number:'FAC-12345',
    factual_notes:'Reported source and onsite quantity; facility independent review still required.',
    evidence_state:opts.stale?'source_changed_hold':'operator_reported_unverified',review_gate:'hold'}]:[]});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:owner}}})},
   from(table){return{select(){return this},order(){return this},limit(){return Promise.resolve({error:null,
    data:table==='ywi_companies'?[{id:ids.company,name:'YW',owner_user_id:opts.foreign?'not-owner':owner}]:[]});}}},
   rpc:async(name,args)=>{window.__calls.push({name,args});
    if(name==='ywi_rpc_septic_disposal_dashboard_428')return{data:dashboard(args.p_work_order_id),error:null};
    if(name==='ywi_rpc_record_septic_disposal_428'){saved=true;return{data:ids.receipt,error:null};}
    return{data:null,error:{message:'Unexpected RPC'}};}};
 },{ids,opts});
 await page.addScriptTag({content:source});await page.locator('#owner428 summary').click();
 await page.locator('#owner428Refresh').click();
}
async function fill(page){
 await page.locator('#owner428Order').selectOption(ids.order);
 await page.locator('#owner428Dispatch').selectOption(ids.dispatch);
 await page.locator('#owner428Operator').selectOption(ids.operator);
 await page.locator('#owner428Artifact').selectOption(ids.artifact);
 await page.locator('#owner428Key').fill('haul_001');
 await page.locator('#owner428Collected').fill('2026-10-22');
 await page.locator('#owner428Disposed').fill('2026-10-22');
 await page.locator('#owner428Stream').selectOption('septic');
 await page.locator('#owner428Volume').fill('2300');
 await page.locator('#owner428Method').selectOption('meter');
 await page.locator('#owner428Fleet').selectOption(ids.fleet);
 await page.locator('#owner428Safety').selectOption(ids.safety);
 await page.locator('#owner428Measurement').fill('Tanker meter MTR-2026-428');
 await page.locator('#owner428Facility').fill('Independent disposal facility');
 await page.locator('#owner428Number').fill('FAC-12345');
 await page.locator('#owner428Notes').fill('Reported source and onsite quantity; facility independent review still required.');
}
test('dated measured litres, assigned operator and original uploaded ticket remain unverified',async({page})=>{
 await setup(page);await fill(page);
 page.once('dialog',d=>d.accept());await page.locator('#owner428Record').click();
 await expect(page.locator('[data-owner428-receipt]')).toContainText('2300 litres');
 await expect(page.locator('[data-owner428-receipt]')).toContainText('FAC-12345');
 await expect(page.locator('[data-owner428-gate="hold"]')).toContainText('NO compliance certification or billing');
 const writes=await page.evaluate(()=>window.__calls.filter(x=>x.name==='ywi_rpc_record_septic_disposal_428'));
 expect(writes).toHaveLength(1);
 expect(writes[0].args.p_operator_id).toBe(ids.operator);
 expect(writes[0].args.p_proof_media_id).toBe(ids.artifact);
 expect(writes[0].args.p_volume_l).toBe(2300);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('missing uploaded receipt or nonassigned operator blocks any write',async({page})=>{
 await setup(page);await fill(page);await page.locator('#owner428Artifact').selectOption('');
 await page.locator('#owner428Record').click();
 await expect(page.locator('#owner428Status')).toContainText('WITHHELD');
 const writes=await page.evaluate(()=>window.__calls.filter(x=>x.name==='ywi_rpc_record_septic_disposal_428'));
 expect(writes).toHaveLength(0);
});
test('foreign company, partial payload or compliance claim are withheld',async({page})=>{
 await setup(page,{foreign:true});await expect(page.locator('#owner428Status')).toContainText('WITHHELD');
 await setup(page,{partial:true});await expect(page.locator('#owner428Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner428Form')).toBeHidden();
 await setup(page,{certified:true});await expect(page.locator('#owner428Status')).toContainText('WITHHELD');
});
test('changed source always stays HOLD even with an existing facility ticket',async({page})=>{
 await setup(page,{stale:true});await fill(page);page.once('dialog',d=>d.accept());
 await page.locator('#owner428Record').click();
 await expect(page.locator('[data-owner428-receipt]')).toContainText('source_changed_hold');
 await expect(page.locator('[data-owner428-gate="hold"]')).toContainText('hold');
});
