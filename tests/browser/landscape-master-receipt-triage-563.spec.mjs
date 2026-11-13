import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/landscape-master-receipt-triage-563.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const receipt='44444444-4444-4444-8444-444444444444';
const observation='55555555-5555-4555-8555-555555555555';
async function setup(page,{width=390,comparison='MATCHED_RECEIPT_CLAIM',fresh=true,foreign=false}={}){
 await page.route('http://yw563.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:850});await page.goto('http://yw563.test');
 await page.evaluate(({owner,company,request,receipt,observation,comparison,fresh,foreign})=>{
  let authenticated=true;window.__563Calls=[];
  window.__563Signout=()=>{authenticated=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:authenticated,user:{id:owner}})};
  window.YWI_SB={
   auth:{getUser:async()=>({error:null,data:{user:{id:owner}}})},
   from(table){
    const q={select(){return q},eq(){return q},order(){return q},
     async limit(){
      if(table==='ywi_companies')return {error:null,data:[{
       id:company,name:'Rosevear Landscaping',owner_user_id:foreign?'other':owner}]};
      if(table==='ywi_landscape_recovery_cases_556')return {error:null,data:[{
       company_id:company,request_id:request,case_version:5,state:'closed_verified',
       updated_at:'2026-11-12T08:00:00Z'}]};
      if(table==='ywi_landscape_provider_verified_561')return {error:null,data:[{
       id:receipt,company_id:company,request_id:request,case_version:5,
       provider_reported_state:'delivered',verified_at:'2026-11-12T08:00:00Z'}]};
      throw Error('Unexpected direct source table '+table);
     }};return q;
   },
   async rpc(name,args){
    window.__563Calls.push({name,args});
    if(name==='ywi_rpc_landscape_master_receipt_review_563')return {error:null,data:{
     company_id:company,request_id:request,case_version:5,
     provider_verified_receipt_id:receipt,canonical_sha256:'a'.repeat(64),
     source_pilot_approved:true,source_pilot_current:fresh,
     master_observation_id:comparison==='HOLD_NO_INDEPENDENT_MASTER_RECEIPT'?null:observation,
     master_comparison:comparison,master_claimed_sha256:'a'.repeat(64),
     controller_revision:'c'.repeat(40),source_followup_closure_ready:
      fresh&&comparison==='MATCHED_RECEIPT_CLAIM',
     latest_owner_action:'HOLD',source_followup_gate:'READY_FOR_SOURCE_OWNER_FOLLOWUP_CLOSURE',
     recipient_delivery_independently_verified:false,customer_message_sent:false,
     master_owner_acceptance:false,master_connected:false,company_scope_only:true,read_only:true,
    }};
    if(name==='ywi_rpc_landscape_followup_decide_563')return {error:null,data:{
     status:'SOURCE_FOLLOWUP_DECISION_RECORDED_MASTER_HOLD',
     decision_id:observation,action:args.p_action,master_owner_acceptance:false}};
    throw Error('Unexpected protected operation '+name);
   }};
 },{owner,company,request,receipt,observation,comparison,fresh,foreign});
 await page.addScriptTag({content:source});
}
async function inspect(page){
 await page.locator('#owner563 summary').click();
 await page.locator('#owner563Refresh').click();
 await page.locator('#owner563Case').selectOption(request);
 await page.locator('#owner563Receipt').selectOption(receipt);
 await expect(page.locator('#owner563Comparison')).toContainText('source receipt hash');
}
for(const width of [390,768,1440]){
 test('YW563 independently matched source follow-up closure stays Master HOLD at '+width+'px',async({page})=>{
  await setup(page,{width});await inspect(page);
  await expect(page.locator('#owner563Comparison')).toContainText('Master owner acceptance HOLD');
  await page.locator('#owner563Action').selectOption('approve_source_followup_closure');
  await page.locator('#owner563Note').fill('Source receipt and independent Master observation match the original case.');
  await page.locator('#owner563Attest').check();
  await expect(page.locator('#owner563Decide')).toBeEnabled();
  await page.locator('#owner563Decide').click();
  await expect(page.locator('#owner563Status')).toContainText('SOURCE_FOLLOWUP_DECISION_RECORDED_MASTER_HOLD');
  const calls=await page.evaluate(()=>window.__563Calls);
  const writes=calls.filter(x=>x.name==='ywi_rpc_landscape_followup_decide_563');
  expect(writes).toHaveLength(1);
  expect(writes[0].args.p_expected_case_version).toBe(5);
  expect(writes[0].args.p_provider_verified_receipt_id).toBe(receipt);
  expect(writes[0].args.p_master_observation_id).toBe(observation);
  expect(calls.some(x=>/observation_admit|customer_send|master_accept/i.test(x.name))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW563 independently signed Master hash discrepancy blocks closure and permits escalation',async({page})=>{
 await setup(page,{comparison:'HASH_MISMATCH'});await inspect(page);
 await page.locator('#owner563Action').selectOption('approve_source_followup_closure');
 await page.locator('#owner563Note').fill('Master signed hash does not match original protected provider source.');
 await page.locator('#owner563Attest').check();
 await expect(page.locator('#owner563Decide')).toBeDisabled();
 await page.locator('#owner563Action').selectOption('escalate_receipt_discrepancy');
 await expect(page.locator('#owner563Decide')).toBeEnabled();
});
test('YW563 absent Master observation allows recheck but not discrepancy escalation or closure',async({page})=>{
 await setup(page,{comparison:'HOLD_NO_INDEPENDENT_MASTER_RECEIPT'});await inspect(page);
 await page.locator('#owner563Note').fill('Need independent Master receipt before original owner closure.');
 await page.locator('#owner563Attest').check();
 await page.locator('#owner563Action').selectOption('escalate_receipt_discrepancy');
 await expect(page.locator('#owner563Decide')).toBeDisabled();
 await page.locator('#owner563Action').selectOption('request_master_recheck');
 await expect(page.locator('#owner563Decide')).toBeEnabled();
});
test('YW563 stale source, foreign company and signout remain fail-closed',async({page})=>{
 await setup(page,{fresh:false});await inspect(page);
 await page.locator('#owner563Action').selectOption('approve_source_followup_closure');
 await page.locator('#owner563Note').fill('Master observation is stale and original source needs fresh evidence.');
 await page.locator('#owner563Attest').check();
 await expect(page.locator('#owner563Decide')).toBeDisabled();
 await setup(page,{foreign:true});
 await page.locator('#owner563 summary').click();
 await page.locator('#owner563Refresh').click();
 await expect(page.locator('#owner563Status')).toContainText('HOLD');
 await setup(page);await inspect(page);
 await page.evaluate(()=>window.__563Signout());
 await expect(page.locator('#owner563Decide')).toBeDisabled();
 await expect(page.locator('#owner563Receipt option')).toHaveCount(1);
 await expect(page.locator('#owner563Status')).toContainText('session changed');
});
