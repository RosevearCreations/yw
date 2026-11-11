import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/landscape-provider-validation-561.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const receipt='44444444-4444-4444-8444-444444444444';
async function setup(page,{width=390,foreign=false,stale=false,missingSigner=false,open=false}={}){
 await page.route('http://yw561.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:850});await page.goto('http://yw561.test');
 await page.evaluate(({owner,company,request,receipt,foreign,stale,missingSigner,open})=>{
  let signedIn=true;window.__561Calls=[];
  window.__561Logout=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:owner}})};
  function from(table){const q={select(){return q},eq(){return q},order(){return q},
   limit:async()=>{
    if(table==='ywi_companies')return {error:null,data:[{id:company,name:'Rosevear Landscaping',
     owner_user_id:foreign?'other':owner}]};
    if(table==='ywi_landscape_recovery_cases_556')return {error:null,data:[{
     company_id:foreign?'other':company,request_id:request,case_version:5,
     state:open?'exception_open':'closed_verified',updated_at:'2026-11-11T15:00:00Z'}]};
    throw Error('Unexpected original table '+table);
   }};return q;}
  window.YWI_SB={auth:{getUser:async()=>({error:null,data:{user:{id:owner}}})},from,
   rpc:async(name,args)=>{
    window.__561Calls.push({name,args});
    if(name==='ywi_rpc_landscape_reopen_review_561')return {error:null,data:{
     company_id:company,request_id:request,case_state:open?'exception_open':'closed_verified',case_version:5,
     reopened_version:4,original_reopen_audit_id:20,
     original_supervisor_ack_id:missingSigner?null:receipt,
     fresh_original_supervisor_verified:!missingSigner,
     closure_source_verified:!stale&&!open&&!missingSigner,
     owner_decision:'HOLD',supervision_gate:stale||missingSigner||open
      ?'HOLD_ORIGINAL_SUPERVISOR_OR_CUSTOMER_RECONFIRMATION':'READY_OWNER_REVIEW',
     provider_signed_receipts:[{receipt_id:receipt,provider_state:'delivered',
      key_id:'comms-verify-561',replay_committed:true,signature_verified:true,
      customer_delivery_independently_verified:false}],
     company_scope_only:!foreign,read_only:true,
     customer_delivery_independently_verified:false,customer_message_sent:false,
     master_delivery_accepted:false,master_connection_proven:false }};
    if(name==='ywi_rpc_landscape_supervision_decide_561')return {error:null,data:{
     status:'ORIGINAL_REOPEN_SUPERVISION_RECORDED_MASTER_HOLD',receipt_id:receipt,
     decision:args.p_decision,master_delivery_accepted:false}};
    throw Error('Unexpected RPC '+name);
   }};
 },{owner,company,request,receipt,foreign,stale,missingSigner,open});
 await page.addScriptTag({content:source});
}
async function selectCase(page){
 await page.locator('#owner561 summary').click();
 await page.locator('#owner561Refresh').click();
 await page.locator('#owner561Case').selectOption(request);
}
for(const width of [390,768,1440]){
 test(`YW561 independently signed provider claim does not bypass Master; owner source review at ${width}px`,async({page})=>{
  await setup(page,{width});await selectCase(page);
  await expect(page.locator('#owner561ProviderHistory')).toContainText('recipient delivery HOLD');
  await expect(page.locator('#owner561Master')).toContainText('HOLD');
  await expect(page.locator('#owner561Supervisor')).toContainText('VERIFIED');
  await page.locator('#owner561Decision').selectOption('continuity_reviewed');
  await page.locator('#owner561Note').fill('Original independent supervisor signoff and customer reconfirmation checked.');
  await page.locator('#owner561Attest').check();
  await expect(page.locator('#owner561Decide')).toBeEnabled();
  await page.locator('#owner561Decide').click();
  await expect(page.locator('#owner561Result')).toContainText('ORIGINAL_REOPEN_SUPERVISION_RECORDED_MASTER_HOLD');
  const calls=await page.evaluate(()=>window.__561Calls);
  expect(calls.filter(x=>x.name==='ywi_rpc_landscape_supervision_decide_561')).toHaveLength(1);
  expect(calls.find(x=>x.name==='ywi_rpc_landscape_supervision_decide_561').args.p_expected_case_version).toBe(5);
  expect(calls.some(x=>/provider_verify|customer_send|dispatch_mutate|source_sign/.test(x.name))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW561 stale, missing independently signed supervisor, and foreign company remain fail-closed',async({page})=>{
 await setup(page,{stale:true});await selectCase(page);
 await page.locator('#owner561Decision').selectOption('continuity_reviewed');
 await page.locator('#owner561Note').fill('We cannot independently confirm the original customer closure.');
 await page.locator('#owner561Attest').check();
 await expect(page.locator('#owner561Decide')).toBeDisabled();
 await setup(page,{missingSigner:true});await selectCase(page);
 await expect(page.locator('#owner561Supervisor')).toContainText('HOLD');
 await setup(page,{foreign:true});await page.locator('#owner561 summary').click();
 await page.locator('#owner561Refresh').click();
 await expect(page.locator('#owner561Status')).toContainText('HOLD');
});
test('YW561 explicit escalation is available only on original open case and signout clears evidence',async({page})=>{
 await setup(page,{open:true});await selectCase(page);
 await page.locator('#owner561Decision').selectOption('exception_escalated');
 await page.locator('#owner561Note').fill('New open case requires independent supervisor attention.');
 await page.locator('#owner561Attest').check();
 await expect(page.locator('#owner561Decide')).toBeEnabled();
 await page.evaluate(()=>window.__561Logout());
 await expect(page.locator('#owner561Decide')).toBeDisabled();
 await expect(page.locator('#owner561ProviderHistory')).toBeEmpty();
 await expect(page.locator('#owner561Status')).toContainText('session changed');
});
