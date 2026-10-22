import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/landscape-field-production-evidence-424.js','utf8');
const ids={company:'a251a722-40a8-4a19-8166-450e56ad887d',order:'0b889dae-81e2-4b97-9a74-3e0d58cc5eb5',
 quantity:'ae26e5f8-758d-4e29-a07d-7886935bb1db',proof:'e91544e5-cc79-484a-bf3f-ff8c69738eb8',
 qc:'c5c2a88b-7a06-4572-a1cc-8f57b522b3b1',receipt:'9a065753-a54c-4ce8-896b-3ae10d72f516'};
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><main id="admin"></main></body></html>');
 await page.evaluate(({ids,opts})=>{
  const owner='owner-424';window.__calls=[];window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.noAuth,user:{id:owner}})};
  let recorded=false;
  const payload=order=>({company_id:ids.company,work_order_id:order,complete:!opts.partial,review_only:true,source_limit:80,
   state:order?(opts.hold?'hold':'review_only'):'choose_order',orders:[{id:ids.order,number:'WO-424',status:'scheduled'}],
   sources:order?[{id:ids.quantity,activity_type:'mowing',metric_label:'Mowed front turf',actual_quantity:60,unit_label:'m²',
    zone_name:'Front lawn',session_date:'2026-10-22',eligible:!opts.ineligible,already_attested:recorded,
    execution_proof_ids:[ids.proof],qc_run_ids:[ids.qc]}]:[],
   receipts:order&&recorded?[{id:ids.receipt,production_quantity_id:ids.quantity,source_session_date:'2026-10-22',
    attested_at:'2026-10-22T14:20:00Z',source_operator_profile_id:'owner-424',
    field_observation:'Measured front lawn strip with wheel; mower pass complete.',
    execution_proof_id:ids.proof,qc_run_id:ids.qc,state:opts.hold?'hold':'recorded_unreviewed'}]:[]});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:owner}}})},
   from(table){return {select(){return this},order(){return this},limit(){return Promise.resolve({data:table==='ywi_companies'?[{id:ids.company,name:'YW',owner_user_id:opts.foreign?'stranger':owner}]:[],error:null});}}},
   rpc:async(name,args)=>{window.__calls.push({name,args});
    if(name==='ywi_rpc_landscape_field_dashboard_424')return{data:payload(args.p_work_order_id),error:null};
    if(name==='ywi_rpc_record_landscape_field_evidence_424'){recorded=true;return{data:ids.receipt,error:null};}
    return{data:null,error:{message:'Unknown RPC'}};}};
 },{ids,opts});
 await page.addScriptTag({content:source});await page.locator('#owner424 summary').click();
 await page.locator('#owner424Refresh').click();
}
test('phone owner records original-zone measured source with linked execution proof and QC as review-only',async({page})=>{
 await setup(page);await page.locator('#owner424Order').selectOption(ids.order);
 await expect(page.locator('[data-owner424-source]')).toContainText('Front lawn');
 await expect(page.locator('[data-owner424-source]')).toContainText('60 m²');
 await page.locator('[data-owner424-source] textarea').fill('Measured front lawn strip with wheel; mower pass complete.');
 await page.locator('[data-owner424-source] select').nth(0).selectOption(ids.proof);
 await page.locator('[data-owner424-source] select').nth(1).selectOption(ids.qc);
 expect(await page.evaluate(()=>window.__calls.filter(x=>x.name==='ywi_rpc_record_landscape_field_evidence_424'))).toHaveLength(0);
 page.once('dialog',d=>d.accept());await page.locator('[data-owner424-save]').click();
 await expect(page.locator('#owner424Status')).toContainText('No completion, QC approval or Finance action');
 await expect(page.locator('[data-owner424-receipt="recorded_unreviewed"]')).toHaveCount(1);
 await expect(page.locator('[data-owner424-save]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__calls.filter(x=>x.name==='ywi_rpc_record_landscape_field_evidence_424'))).toEqual([{name:'ywi_rpc_record_landscape_field_evidence_424',args:{
  p_company_id:ids.company,p_work_order_id:ids.order,p_quantity_id:ids.quantity,
  p_observation:'Measured front lawn strip with wheel; mower pass complete.',p_execution_proof_id:ids.proof,p_qc_run_id:ids.qc}}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('unknown site/operator evidence cannot be attested',async({page})=>{
 await setup(page,{ineligible:true});await page.locator('#owner424Order').selectOption(ids.order);
 await expect(page.locator('#owner424Results')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner424-save]')).toHaveCount(0);
});
test('foreign company and partial server read fail closed',async({page})=>{
 await setup(page,{foreign:true});await expect(page.locator('#owner424Status')).toContainText('WITHHELD');
 await setup(page,{partial:true});await expect(page.locator('#owner424Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner424-source]')).toHaveCount(0);
});
test('changed original measured source becomes HOLD for manual QC',async({page})=>{
 await setup(page,{hold:true});await page.locator('#owner424Order').selectOption(ids.order);
 await page.locator('[data-owner424-source] textarea').fill('Measured front lawn strip with wheel; mower pass complete.');
 page.once('dialog',d=>d.accept());await page.locator('[data-owner424-save]').click();
 await expect(page.locator('[data-owner424-receipt="hold"]')).toHaveCount(1);
 await expect(page.locator('[data-owner424-hold]')).toContainText('Review Production and QC');
});
