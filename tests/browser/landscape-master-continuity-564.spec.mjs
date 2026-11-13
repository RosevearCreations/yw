import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const src=fs.readFileSync('js/landscape-master-continuity-564.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const receipt='44444444-4444-4444-8444-444444444444';
const observation='55555555-5555-4555-8555-555555555555';
async function setup(page,{width=390,classification='MATCHED_INDEPENDENT_SOURCE_CLAIM',
 sla='WITHIN_TARGET',renewed=true,foreign=false}={}){
 await page.route('http://yw564.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:850});await page.goto('http://yw564.test');
 await page.evaluate(({owner,company,request,receipt,observation,classification,sla,renewed,foreign})=>{
  let authenticated=true;window.__564Calls=[];
  window.__564Signout=()=>{authenticated=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:authenticated,user:{id:owner}})};
  window.YWI_SB={
   auth:{getUser:async()=>({error:null,data:{user:{id:owner}}})},
   from(table){
    const q={select(){return q},eq(){return q},order(){return q},
     async limit(){
      if(table==='ywi_companies')return {error:null,data:[{
       id:company,name:'Rosevear Landscaping',owner_user_id:foreign?'other':owner}]};
      if(table==='ywi_landscape_recovery_cases_556')return {error:null,data:[{
       company_id:company,request_id:request,state:'closed_verified',case_version:5,
       updated_at:'2026-11-12T08:00:00.000Z'}]};
      if(table==='ywi_landscape_provider_verified_561')return {error:null,data:[{
       id:receipt,company_id:company,request_id:request,case_version:5,
       provider_reported_state:'delivered',verified_at:'2026-11-12T08:00:00.000Z'}]};
      throw Error('Unexpected source table '+table);
     }};return q;
   },
   async rpc(name,args){
    window.__564Calls.push({name,args});
    if(name==='ywi_rpc_landscape_master_continuity_review_564')return {error:null,data:{
     company_id:company,request_id:request,case_version:5,
     provider_verified_receipt_id:receipt,canonical_sha256:'a'.repeat(64),
     master_observation_id:classification==='MISSING_INDEPENDENT_MASTER_RECEIPT'?null:observation,
     master_observation_comparison:classification==='MATCHED_INDEPENDENT_SOURCE_CLAIM'?'MATCHED_RECEIPT_CLAIM':'HASH_MISMATCH',
     latest_signed_replay_signal_at:null,signed_replay_exception_count:
      classification==='SIGNED_REPLAY_OR_ADMISSION_EXCEPTION'?2:0,
     continuity_classification:classification,resolution_sla_state:sla,
     resolution_sla_due_at:'2026-11-13T08:00:00.000Z',
     last_owner_renewal_action:'HOLD',last_owner_renewal_action_id:null,
     independent_renewal_evidence_current:renewed,
     source_followup_closure_ready:renewed,
     recipient_delivery_independently_verified:false,customer_message_sent:false,
     master_owner_acceptance:false,master_connected:false,
     company_scope_only:true,read_only:true,
    }};
    if(name==='ywi_rpc_landscape_master_renewal_decide_564')return {error:null,data:{
     status:'SOURCE_RENEWAL_ACTION_RECORDED_MASTER_HOLD',action_id:observation,
     action:args.p_action,master_owner_acceptance:false}};
    throw Error('Unexpected privileged RPC '+name);
   }};
 },{owner,company,request,receipt,observation,classification,sla,renewed,foreign});
 await page.addScriptTag({content:src});
}
async function inspect(page){
 await page.locator('#owner564 summary').click();
 await page.locator('#owner564Refresh').click();
 await page.locator('#owner564Case').selectOption(request);
 await page.locator('#owner564Receipt').selectOption(receipt);
 await expect(page.locator('#owner564Replay')).toContainText('Source SHA-256');
}
for(const width of [390,768,1440]){
 test('YW564 original source signed renewal review is never Master approval at '+width+'px',async({page})=>{
  await setup(page,{width});await inspect(page);
  await expect(page.locator('#owner564Replay')).toContainText('Master owner acceptance HOLD');
  await page.locator('#owner564Action').selectOption('review_independently_renewed_source');
  await page.locator('#owner564Note').fill('Independently signed Master renewal observed after the original source request.');
  await page.locator('#owner564Attest').check();
  await expect(page.locator('#owner564Decide')).toBeEnabled();
  await page.locator('#owner564Decide').click();
  await expect(page.locator('#owner564Status')).toContainText('SOURCE_RENEWAL_ACTION_RECORDED_MASTER_HOLD');
  const calls=await page.evaluate(()=>window.__564Calls);
  const writes=calls.filter(x=>x.name==='ywi_rpc_landscape_master_renewal_decide_564');
  expect(writes).toHaveLength(1);
  expect(writes[0].args.p_expected_case_version).toBe(5);
  expect(writes[0].args.p_expected_master_observation_id).toBe(observation);
  expect(calls.some(x=>/replay_signal|observation_admit|customer_send|master_accept/i.test(x.name))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW564 signed replay exception blocks unverified renewal review; owner may request a recheck',async({page})=>{
 await setup(page,{classification:'SIGNED_REPLAY_OR_ADMISSION_EXCEPTION',sla:'BREACHED',renewed:false});
 await inspect(page);
 await expect(page.locator('#owner564Replay')).toContainText('signed admission exceptions 2');
 await page.locator('#owner564Note').fill('Original source signed Master admission exception requires independent recovery.');
 await page.locator('#owner564Attest').check();
 await page.locator('#owner564Action').selectOption('review_independently_renewed_source');
 await expect(page.locator('#owner564Decide')).toBeDisabled();
 await page.locator('#owner564Action').selectOption('request_signed_cross_plane_renewal');
 await expect(page.locator('#owner564Decide')).toBeEnabled();
 await page.locator('#owner564Action').selectOption('acknowledge_resolution_sla_breach');
 await expect(page.locator('#owner564Decide')).toBeEnabled();
});
test('YW564 no SLA breach blocks breach acknowledgement and signout clears evidence',async({page})=>{
 await setup(page,{renewed:false,sla:'WITHIN_TARGET'});
 await inspect(page);
 await page.locator('#owner564Action').selectOption('acknowledge_resolution_sla_breach');
 await page.locator('#owner564Note').fill('The SLA is still current, no owner breach acknowledgement should be accepted.');
 await page.locator('#owner564Attest').check();
 await expect(page.locator('#owner564Decide')).toBeDisabled();
 await page.evaluate(()=>window.__564Signout());
 await expect(page.locator('#owner564Decide')).toBeDisabled();
 await expect(page.locator('#owner564Receipt option')).toHaveCount(1);
 await expect(page.locator('#owner564Status')).toContainText('session changed');
});
test('YW564 foreign company fails owner gate',async({page})=>{
 await setup(page,{foreign:true});
 await page.locator('#owner564 summary').click();
 await page.locator('#owner564Refresh').click();
 await expect(page.locator('#owner564Status')).toContainText('HOLD');
 await expect(page.locator('#owner564Decide')).toBeDisabled();
});
