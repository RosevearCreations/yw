import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/shared-equipment-material-allocation-proof-423.js','utf8');
const ids={company:'6d77d51c-18a2-476e-b4a4-935c0bafc42b',order:'94713b50-93c8-4885-877b-787967345b2e',
 material:'a2dd1e40-1e24-4b2f-8cb8-80b82e030f11',proof:'93d448de-c89c-4328-bc63-d2fd31cd6271'};
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><main><div id="admin"></div></main></body></html>');
 await page.evaluate(({ids,opts})=>{
  const owner='owner-1';window.__calls=[];window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.noAuth,user:{id:owner}})};
  let recorded=false;const payload=order=>({company_id:ids.company,work_order_id:order,complete:!opts.incomplete,
   no_stock_or_cost_posting:true,source_limit:80,state:order?(opts.hold?'hold':recorded?'recorded':'no_record'):'choose_order',
   orders:[{id:ids.order,number:'WO-423',service:'landscape',status:'scheduled'}],
   sources:order?[{source_kind:'material',source_id:ids.material,source_name:'Mulch',source_number:'ISS-23',quantity:4,
    source_amount:20,eligible:!opts.locked,already_proven:recorded},
    {source_kind:'equipment',source_id:'17',source_name:'Riding mower',source_number:'EQ-17',quantity:1,
     source_amount:null,eligible:!opts.locked,already_proven:false}]:[],
   proofs:order&&recorded?[{id:ids.proof,source_kind:'material',source_id:ids.material,state:opts.hold?'hold':'verified'}]:[],
   material_issued_source_amount:recorded?20:0});
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:owner}}})},
   from(table){return {select(){return this},order(){return this},limit(){return Promise.resolve({error:null,
    data:table==='ywi_companies'?[{id:ids.company,name:'Yard Workers',owner_user_id:opts.foreign?'someone-else':owner}]:[]});}}},
   rpc:async(name,args)=>{window.__calls.push({name,args});
    if(name==='ywi_rpc_allocation_dashboard_423')return{data:payload(args.p_work_order_id),error:null};
    if(name==='ywi_rpc_record_allocation_proof_423'){recorded=true;return{data:ids.proof,error:null};}
    return{data:null,error:{message:'Unknown RPC'}};}};
 },{ids,opts});
 await page.addScriptTag({content:source});await page.locator('#owner423 summary').click();
 await page.locator('#owner423Refresh').click();
}
test('owner reads canonical work order and explicitly records one material source on phone',async({page})=>{
 await setup(page);
 await page.locator('#owner423Order').selectOption(ids.order);
 await expect(page.locator('[data-owner423-kind="material"]')).toContainText('Mulch');
 await expect(page.locator('[data-owner423-kind="equipment"]')).toContainText('Riding mower');
 expect(await page.evaluate(()=>window.__calls.filter(x=>x.name.includes('record_')))).toHaveLength(0);
 page.once('dialog',d=>d.accept());
 await page.locator('[data-owner423-kind="material"] button').click();
 await expect(page.locator('#owner423Status')).toContainText('recorded once; no inventory or financial change');
 await expect(page.locator('[data-owner423-proof="verified"]')).toHaveCount(1);
 await expect(page.locator('[data-owner423-kind="material"] button')).toHaveCount(0);
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls.filter(x=>x.name==='ywi_rpc_record_allocation_proof_423')).toEqual([{name:'ywi_rpc_record_allocation_proof_423',args:{
  p_company_id:ids.company,p_work_order_id:ids.order,p_kind:'material',p_source_id:ids.material}}]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('ineligible locked source stays blocked without recording',async({page})=>{
 await setup(page,{locked:true});await page.locator('#owner423Order').selectOption(ids.order);
 await expect(page.locator('#owner423Results')).toContainText('HOLD: original source');
 await expect(page.locator('#owner423Results button')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__calls.filter(x=>x.name==='ywi_rpc_record_allocation_proof_423'))).toHaveLength(0);
});
test('foreign company and partial dashboard are withheld',async({page})=>{
 await setup(page,{foreign:true});await expect(page.locator('#owner423Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner423Order option')).toHaveCount(0);
 await setup(page,{incomplete:true});await expect(page.locator('#owner423Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner423-kind]')).toHaveCount(0);
});
test('changed original source emits HOLD instead of silent cost attribution',async({page})=>{
 await setup(page,{hold:true});await page.locator('#owner423Order').selectOption(ids.order);
 page.once('dialog',d=>d.accept());await page.locator('[data-owner423-kind="material"] button').click();
 await expect(page.locator('[data-owner423-proof="hold"]')).toHaveCount(1);
 await expect(page.locator('[data-owner423-hold]')).toContainText('Review original ledger');
});
