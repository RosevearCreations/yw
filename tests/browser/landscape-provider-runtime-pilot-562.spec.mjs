import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/landscape-provider-runtime-pilot-562.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const receipt='44444444-4444-4444-8444-444444444444';
async function setup(page,{width=390,ready=true,foreign=false}={}){
 await page.route('http://yw562.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:850});await page.goto('http://yw562.test');
 await page.evaluate(({owner,company,request,receipt,ready,foreign})=>{
  let authenticated=true;window.__562Calls=[];
  window.__562Signout=()=>{authenticated=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:authenticated,user:{id:owner}})};
  window.YWI_SB={
   auth:{getUser:async()=>({error:null,data:{user:{id:owner}}})},
   from(table){
    const q={
     select(){return q},eq(){return q},order(){return q},
     async limit(){
      if(table==='ywi_companies')return {error:null,data:[{
       id:company,name:'Rosevear Landscaping',owner_user_id:foreign?'other':owner}]};
      if(table==='ywi_landscape_recovery_cases_556')return {error:null,data:[{
       company_id:company,request_id:request,state:'closed_verified',case_version:5,
       updated_at:'2026-11-11T15:00:00Z'}]};
      if(table==='ywi_landscape_provider_verified_561')return {error:null,data:[{
       id:receipt,company_id:company,request_id:request,case_version:5,
       provider_reported_state:'delivered',verified_at:'2026-11-11T18:00:00Z'}]};
      throw Error('Unexpected original source table: '+table);
     }};return q;
   },
   async rpc(name,args){
    window.__562Calls.push({name,args});
    if(name==='ywi_rpc_landscape_provider_pilot_review_562')return {error:null,data:{
     company_id:company,request_id:request,case_version:5,verified_receipt_id:receipt,
     canonical_sha256:'a'.repeat(64),signature_sha256:'b'.repeat(64),
     provider_state:'delivered',original_supervisor_verified:ready,
     original_closure_verified:ready,provider_signature_verified:true,
     source_pilot_ready:ready,source_owner_decision:'HOLD',
     pilot_gate:ready?'READY_FOR_SOURCE_OWNER_PILOT_DECISION':'HOLD_ORIGINAL_SIGNED_RECEIPT_OR_FRESH_CLOSURE',
     recipient_delivery_independently_verified:false,master_owner_acceptance:false,
     master_connected:false,company_scope_only:true,read_only:true}};
    if(name==='ywi_rpc_landscape_provider_pilot_decide_562')return {error:null,data:{
     status:'SOURCE_OWNER_PILOT_RECORDED_MASTER_HOLD',decision_id:receipt,
     source_decision:args.p_source_decision,master_owner_acceptance:false}};
    throw Error('Unexpected privileged operation: '+name);
   }};
 },{owner,company,request,receipt,ready,foreign});
 await page.addScriptTag({content:source});
}
async function inspect(page){
 await page.locator('#owner562 summary').click();
 await page.locator('#owner562Refresh').click();
 await page.locator('#owner562Case').selectOption(request);
 await page.locator('#owner562Receipt').selectOption(receipt);
 await expect(page.locator('#owner562Source')).toContainText('canonical SHA-256');
}
for(const width of [390,768,1440]){
 test('YW562 exact signed source pilot cannot accept Master at '+width+'px',async({page})=>{
  await setup(page,{width});await inspect(page);
  await expect(page.locator('#owner562Master')).toContainText('HOLD');
  await page.locator('#owner562Decision').selectOption('approve_for_master_review');
  await page.locator('#owner562Note').fill('Original signed provider evidence and customer closure independently reviewed.');
  await page.locator('#owner562Attest').check();
  await expect(page.locator('#owner562Decide')).toBeEnabled();
  await page.locator('#owner562Decide').click();
  await expect(page.locator('#owner562Status')).toContainText('SOURCE_OWNER_PILOT_RECORDED_MASTER_HOLD');
  const calls=await page.evaluate(()=>window.__562Calls);
  const writes=calls.filter(x=>x.name==='ywi_rpc_landscape_provider_pilot_decide_562');
  expect(writes).toHaveLength(1);
  expect(writes[0].args.p_expected_case_version).toBe(5);
  expect(writes[0].args.p_verified_receipt_id).toBe(receipt);
  expect(calls.some(x=>/provider_verify_561|customer_send|master_accept/i.test(x.name))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW562 missing original closure blocks source approval but permits rejection',async({page})=>{
 await setup(page,{ready:false});await inspect(page);
 await page.locator('#owner562Decision').selectOption('approve_for_master_review');
 await page.locator('#owner562Note').fill('Current supervisor proof and original customer closure are missing.');
 await page.locator('#owner562Attest').check();
 await expect(page.locator('#owner562Decide')).toBeDisabled();
 await page.locator('#owner562Decision').selectOption('reject_source_pilot');
 await expect(page.locator('#owner562Decide')).toBeEnabled();
});
test('YW562 original foreign company is rejected and sign-out clears source evidence',async({page})=>{
 await setup(page,{foreign:true});
 await page.locator('#owner562 summary').click();
 await page.locator('#owner562Refresh').click();
 await expect(page.locator('#owner562Status')).toContainText('HOLD');
 await setup(page);await inspect(page);
 await page.evaluate(()=>window.__562Signout());
 await expect(page.locator('#owner562Decide')).toBeDisabled();
 await expect(page.locator('#owner562Receipt option')).toHaveCount(1);
 await expect(page.locator('#owner562Status')).toContainText('session changed');
});
