import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/landscape-master-forecast-566.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const receipt='44444444-4444-4444-8444-444444444444';
const observation='55555555-5555-4555-8555-555555555555';
const escalation='66666666-6666-4666-8666-666666666666';
async function setup(page,{width=390,recovered=true,risk=false,foreign=false,escalated=true}={}){
 await page.route('http://yw566.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:900});await page.goto('http://yw566.test');
 await page.evaluate(({owner,company,request,receipt,observation,escalation,recovered,risk,foreign,escalated})=>{
  let authenticated=true;window.__566Calls=[];
  window.__566Signout=()=>{authenticated=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
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
       updated_at:'2026-11-13T12:00:00Z'}]};
      if(table==='ywi_landscape_provider_verified_561')return {error:null,data:[{
       id:receipt,company_id:company,request_id:request,case_version:5,
       provider_reported_state:'delivered',verified_at:'2026-11-13T12:00:00Z'}]};
      throw Error('Unexpected direct table '+table);
     }};return q;
   },
   async rpc(name,args){
    window.__566Calls.push({name,args});
    if(name==='ywi_rpc_landscape_master_drift_forecast_review_566')return {error:null,data:{
     company_id:company,request_id:request,case_version:5,
     provider_verified_receipt_id:receipt,canonical_sha256:'a'.repeat(64),
     source_escalation_id:escalated?escalation:null,
     source_escalation_recorded_at:escalated?'2026-11-13T10:00:00Z':null,
     master_observation_id:observation,master_observation_verified_at:'2026-11-13T11:00:00Z',
     last_signed_risk_at:risk?'2026-11-13T11:30:00Z':null,
     signed_risk_events_24h:risk?2:0,signed_risk_events_7d:risk?3:0,
     forecast_classification:risk?'SOURCE_SIGNED_RISK_ACTIVE':'SOURCE_STABLE_OBSERVATION_WATCH',
     forecast_is_deterministic_watch_not_prediction:true,forecast_horizon_hours:24,
     next_evidence_recheck_by:'2026-11-14T11:00:00Z',
     source_resolution_sla_due_at:'2026-11-14T10:00:00Z',
     source_resolution_sla_state:'WITHIN_TARGET',
     post_escalation_signed_evidence_current:recovered,
     source_recovery_effective_after_escalation:recovered,
     source_escalation_outcome:'SOURCE_ONLY_OPEN',
     latest_owner_outcome_action:'HOLD',latest_owner_outcome_id:null,
     recipient_delivery_independently_verified:false,customer_message_sent:false,
     master_owner_acceptance:false,master_connected:false,company_scope_only:true,read_only:true
    }};
    if(name==='ywi_rpc_landscape_master_escalation_outcome_decide_566')return {error:null,data:{
     status:'SOURCE_ESCALATION_OUTCOME_RECORDED_MASTER_HOLD',outcome_id:observation,
     action:args.p_action,master_owner_acceptance:false,master_connected:false}};
    throw Error('Unexpected privileged RPC '+name);
   }};
 },{owner,company,request,receipt,observation,escalation,recovered,risk,foreign,escalated});
 await page.addScriptTag({content:source});
}
async function inspect(page){
 await page.locator('#owner566 summary').click();
 await page.locator('#owner566Refresh').click();
 await page.locator('#owner566Case').selectOption(request);
 await page.locator('#owner566Receipt').selectOption(receipt);
 await expect(page.locator('#owner566Risk')).toContainText('Original receipt SHA-256');
}
for(const width of [390,768,1440]){
 test('YW566 exact source escalation and signed recovery owner review remains Master HOLD at '+width+'px',async({page})=>{
  await setup(page,{width});await inspect(page);
  await expect(page.locator('#owner566Risk')).toContainText('not a probability');
  await expect(page.locator('#owner566Escalation')).toContainText('Master owner acceptance HOLD');
  await page.locator('#owner566Action').selectOption('reconcile_signed_source_recovery');
  await page.locator('#owner566Note').fill('Original source escalation and new independent signed Master observation were verified.');
  await page.locator('#owner566Attest').check();
  await expect(page.locator('#owner566Decide')).toBeEnabled();
  await page.locator('#owner566Decide').click();
  await expect(page.locator('#owner566Status')).toContainText('SOURCE_ESCALATION_OUTCOME_RECORDED_MASTER_HOLD');
  const all=await page.evaluate(()=>window.__566Calls);
  const writes=all.filter(x=>x.name==='ywi_rpc_landscape_master_escalation_outcome_decide_566');
  expect(writes).toHaveLength(1);
  expect(writes[0].args.p_expected_case_version).toBe(5);
  expect(writes[0].args.p_expected_source_escalation_id).toBe(escalation);
  expect(writes[0].args.p_expected_master_observation_id).toBe(observation);
  expect(all.some(x=>/master_accept|customer_send|observation_admit|replay_signal/i.test(x.name))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW566 newer signed admission risk prohibits source recovery closure',async({page})=>{
 await setup(page,{risk:true,recovered:false});await inspect(page);
 await page.locator('#owner566Note').fill('Original signed escalation is unresolved due to later admitted risk.');
 await page.locator('#owner566Attest').check();
 await page.locator('#owner566Action').selectOption('reconcile_signed_source_recovery');
 await expect(page.locator('#owner566Decide')).toBeDisabled();
 await page.locator('#owner566Action').selectOption('record_source_escalation_open');
 await expect(page.locator('#owner566Decide')).toBeEnabled();
});
test('YW566 missing original escalation cannot be reconciled, request follow-up remains possible',async({page})=>{
 await setup(page,{recovered:false,escalated:false});await inspect(page);
 await page.locator('#owner566Note').fill('Request supervision and a fresh independently signed original escalation proof.');
 await page.locator('#owner566Attest').check();
 await page.locator('#owner566Action').selectOption('record_source_escalation_open');
 await expect(page.locator('#owner566Decide')).toBeDisabled();
 await page.locator('#owner566Action').selectOption('request_supervised_source_followup');
 await expect(page.locator('#owner566Decide')).toBeEnabled();
});
test('YW566 foreign company and logout fail closed and clear source evidence',async({page})=>{
 await setup(page,{foreign:true});
 await page.locator('#owner566 summary').click();
 await page.locator('#owner566Refresh').click();
 await expect(page.locator('#owner566Status')).toContainText('HOLD');
 await expect(page.locator('#owner566Decide')).toBeDisabled();
 await setup(page);await inspect(page);
 await page.evaluate(()=>window.__566Signout());
 await expect(page.locator('#owner566Decide')).toBeDisabled();
 await expect(page.locator('#owner566Receipt option')).toHaveCount(1);
 await expect(page.locator('#owner566Status')).toContainText('session changed');
});
