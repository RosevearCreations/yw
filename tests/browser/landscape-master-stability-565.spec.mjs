import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const js=fs.readFileSync('js/landscape-master-stability-565.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const receipt='44444444-4444-4444-8444-444444444444';
const observation='55555555-5555-4555-8555-555555555555';
async function setup(page,{width=390,classification='FRESH_SIGNED_SOURCE_RECOVERY_OBSERVED',
 recovery=true,foreign=false}={}){
 await page.route('http://yw565.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:900});await page.goto('http://yw565.test');
 await page.evaluate(({owner,company,request,receipt,observation,classification,recovery,foreign})=>{
  let authorized=true;window.__565Calls=[];
  window.__565Signout=()=>{authorized=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:authorized,user:{id:owner}})};
  window.YWI_SB={
   auth:{getUser:async()=>({error:null,data:{user:{id:owner}}})},
   from(table){
    const q={select(){return q},eq(){return q},order(){return q},
     async limit(){
      if(table==='ywi_companies')return {error:null,data:[{
       id:company,name:'Rosevear Landscaping',owner_user_id:foreign?'other':owner}]};
      if(table==='ywi_landscape_recovery_cases_556')return {error:null,data:[{
       company_id:company,request_id:request,case_version:5,state:'closed_verified',
       updated_at:'2026-11-13T12:00:00Z'}]};
      if(table==='ywi_landscape_provider_verified_561')return {error:null,data:[{
       id:receipt,company_id:company,request_id:request,case_version:5,
       provider_reported_state:'delivered',verified_at:'2026-11-13T12:00:00Z'}]};
      throw Error('Unexpected source table '+table);
     }};return q;
   },
   async rpc(name,args){
    window.__565Calls.push({name,args});
    if(name==='ywi_rpc_landscape_master_stability_review_565')return {error:null,data:{
     company_id:company,request_id:request,case_version:5,provider_verified_receipt_id:receipt,
     canonical_sha256:'a'.repeat(64),master_observation_id:observation,
     master_observation_verified_at:'2026-11-13T12:00:00Z',
     source_resolution_sla_state:'WITHIN_TARGET',
     source_resolution_sla_due_at:'2026-11-14T12:00:00Z',
     signed_post_renewal_receipt_current:recovery,source_recovery_evidence_effective:recovery,
     last_signed_risk_at:null,last_matched_receipt_at:'2026-11-13T12:00:00Z',
     first_matched_receipt_at:'2026-11-12T12:00:00Z',
     matched_receipts_24h:2,matched_receipts_7d:3,matched_receipts_30d:4,
     signed_admission_exceptions_24h:recovery?0:2,
     signed_admission_exceptions_7d:recovery?0:2,
     signed_admission_exceptions_30d:recovery?0:2,
     signed_discrepancies_24h:0,signed_discrepancies_7d:0,
     signed_discrepancies_30d:0,
     stability_classification:classification,continuity_is_observational_not_uptime:true,
     last_owner_stability_action:'HOLD',last_owner_stability_action_id:null,
     recipient_delivery_independently_verified:false,customer_message_sent:false,
     master_owner_acceptance:false,master_connected:false,company_scope_only:true,read_only:true
    }};
    if(name==='ywi_rpc_landscape_master_stability_decide_565')return {error:null,data:{
     status:'SOURCE_STABILITY_REVIEW_RECORDED_MASTER_HOLD',action_id:observation,
     action:args.p_action,master_owner_acceptance:false}};
    throw Error('Unexpected privileged RPC '+name);
   }};
 },{owner,company,request,receipt,observation,classification,recovery,foreign});
 await page.addScriptTag({content:js});
}
async function inspect(page){
 await page.locator('#owner565 summary').click();
 await page.locator('#owner565Refresh').click();
 await page.locator('#owner565Case').selectOption(request);
 await page.locator('#owner565Receipt').selectOption(receipt);
 await expect(page.locator('#owner565Source')).toContainText('Original provider SHA-256');
}
for(const width of [390,768,1440]){
 test('YW565 source recovery owner decision cannot accept Master at '+width+'px',async({page})=>{
  await setup(page,{width});await inspect(page);
  await expect(page.locator('#owner565Horizons .yw565-metric')).toHaveCount(3);
  await expect(page.locator('#owner565Source')).toContainText('Master acceptance HOLD');
  await page.locator('#owner565Action').selectOption('review_signed_source_recovery');
  await page.locator('#owner565Note').fill('Original signed renewal was independently rechecked for this current source receipt.');
  await page.locator('#owner565Attest').check();
  await expect(page.locator('#owner565Decide')).toBeEnabled();
  await page.locator('#owner565Decide').click();
  await expect(page.locator('#owner565Status')).toContainText('SOURCE_STABILITY_REVIEW_RECORDED_MASTER_HOLD');
  const calls=await page.evaluate(()=>window.__565Calls);
  const actions=calls.filter(x=>x.name==='ywi_rpc_landscape_master_stability_decide_565');
  expect(actions).toHaveLength(1);
  expect(actions[0].args.p_expected_observation_id).toBe(observation);
  expect(actions[0].args.p_expected_case_version).toBe(5);
  expect(calls.some(x=>/observation_admit|master_accept|replay_signal|customer_send/i.test(x.name))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW565 signed admission drift blocks recovery review and permits escalation',async({page})=>{
 await setup(page,{classification:'OPEN_SIGNED_ADMISSION_OR_DISCREPANCY',recovery:false});
 await inspect(page);
 await expect(page.locator('#owner565Horizons')).toContainText('signed admission exceptions: 2');
 await page.locator('#owner565Note').fill('A new signed admission discrepancy requires independent follow-up.');
 await page.locator('#owner565Attest').check();
 await page.locator('#owner565Action').selectOption('review_signed_source_recovery');
 await expect(page.locator('#owner565Decide')).toBeDisabled();
 await page.locator('#owner565Action').selectOption('escalate_long_horizon_drift');
 await expect(page.locator('#owner565Decide')).toBeEnabled();
});
test('YW565 foreign company denied and signout clears original evidence',async({page})=>{
 await setup(page,{foreign:true});
 await page.locator('#owner565 summary').click();
 await page.locator('#owner565Refresh').click();
 await expect(page.locator('#owner565Status')).toContainText('HOLD');
 await expect(page.locator('#owner565Decide')).toBeDisabled();
 await setup(page);
 await inspect(page);
 await page.evaluate(()=>window.__565Signout());
 await expect(page.locator('#owner565Decide')).toBeDisabled();
 await expect(page.locator('#owner565Receipt option')).toHaveCount(1);
 await expect(page.locator('#owner565Status')).toContainText('session changed');
});
