import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/landscape-followup-continuity-560.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const dispatch='55555555-5555-4555-8555-555555555555';
const intent='66666666-6666-4666-8666-666666666666';
const signature='a'.repeat(32);
async function setup(page,{width=390,foreign=false,stale=false,missingIntent=false,wrongBoundary=false}={}){
 await page.route('http://yw560.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:850});await page.goto('http://yw560.test');
 await page.evaluate(({owner,company,request,dispatch,intent,signature,foreign,stale,missingIntent,wrongBoundary})=>{
  let signedIn=true;window.__560Calls=[];
  window.__560Logout=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:owner}})};
  function from(table){const q={select(){return q},eq(){return q},order(){return q},
   limit:async()=>{
    if(table==='ywi_companies')return {error:null,data:[{id:company,name:'Rosevear Landscaping',
     owner_user_id:foreign?'other':owner}]};
    if(table==='ywi_landscape_recovery_cases_556')return {error:null,data:[{
     company_id:foreign?'other':company,request_id:request,case_version:3,
     state:'closed_verified',reason:'crew_unavailable',updated_at:'2026-11-11T12:00:00Z'}]};
    throw Error('Unexpected table '+table);
   }};return q;}
  window.YWI_SB={auth:{getUser:async()=>({error:null,data:{user:{id:owner}}})},from,
   rpc:async(name,args)=>{
    window.__560Calls.push({name,args});
    if(name==='ywi_rpc_landscape_continuity_review_560')return {error:null,data:{
     company_id:company,request_id:request,case_version:3,case_state:'closed_verified',
     current_dispatch_id:dispatch,current_dispatch_signature:stale?null:signature,
     reopen_eligible:!stale&&!missingIntent,
     followup_intent_id:missingIntent?null:intent,
     fresh_supervisor_acknowledged:false,supervisor_continuity:'HOLD_FRESH_ORIGINAL_SUPERVISOR_ACK',
     provider_reports:[{receipt_id:dispatch,provider:'rosevear-comms-hub',provider_reported_state:'delivered',
      provider_message_ref:'opaque-transport-43',received_at:'2026-11-11T12:01:00Z',
      provider_reported_at:'2026-11-11T12:01:00Z',delivery_independently_verified:false}],
     reopen_events:[],delivery_independently_verified:false,customer_message_sent_verified:false,
     customer_contact_authorized:false,dispatch_authorized:false,
     master_shell_connection_proven:false,owner_acceptance_in_master:false,
     company_scope_only:!wrongBoundary,read_only:true}};
    if(name==='ywi_rpc_landscape_reopen_560')return {error:null,data:{
     status:'ORIGINAL_556_EXCEPTION_REOPENED_SUPERVISOR_HOLD',
     receipt_id:dispatch,reopened_version:4,
     dispatch_authorized:false,customer_message_sent_verified:false,
     owner_acceptance_in_master:false}};
    throw Error('Unexpected RPC '+name);
   }};
 },{owner,company,request,dispatch,intent,signature,foreign,stale,missingIntent,wrongBoundary});
 await page.addScriptTag({content:source});
}
async function selectCase(page){
 await page.locator('#owner560 summary').click();
 await page.locator('#owner560Refresh').click();
 await page.locator('#owner560Case').selectOption(request);
}
for(const width of [390,768,1440]){
 test(`YW560 provider claim remains unverified; original owner can reopen safely at ${width}px`,async({page})=>{
  await setup(page,{width});await selectCase(page);
  await expect(page.locator('#owner560Transport')).toContainText('MASTER_UNVERIFIED');
  await expect(page.locator('#owner560ProviderHistory')).toContainText('NOT independently delivered');
  await expect(page.locator('#owner560Supervisor')).toContainText('HOLD_FRESH_ORIGINAL_SUPERVISOR_ACK');
  await page.locator('#owner560Reason').selectOption('schedule_conflict');
  await page.locator('#owner560Note').fill('Customer follow-up revealed an original scheduling conflict; reopen for a new recovery cycle.');
  await page.locator('#owner560Attest').check();
  await expect(page.locator('#owner560Reopen')).toBeEnabled();
  await page.locator('#owner560Reopen').click();
  await expect(page.locator('#owner560Result')).toContainText('ORIGINAL_556_EXCEPTION_REOPENED_SUPERVISOR_HOLD');
  const calls=await page.evaluate(()=>window.__560Calls);
  expect(calls.filter(c=>c.name==='ywi_rpc_landscape_reopen_560')).toHaveLength(1);
  expect(calls.find(c=>c.name==='ywi_rpc_landscape_reopen_560').args.p_expected_dispatch_signature).toBe(signature);
  expect(calls.some(c=>/provider_report|send_message|create_dispatch|customer_confirm/.test(c.name))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW560 stale signature, absent original follow-up and foreign owner withhold reopening',async({page})=>{
 await setup(page,{stale:true});await selectCase(page);
 await page.locator('#owner560Reason').selectOption('weather');
 await page.locator('#owner560Note').fill('Weather changed after original closure and must be reviewed.');
 await page.locator('#owner560Attest').check();
 await expect(page.locator('#owner560Reopen')).toBeDisabled();
 await setup(page,{missingIntent:true});await selectCase(page);
 await expect(page.locator('#owner560Reopen')).toBeDisabled();
 await setup(page,{foreign:true});await page.locator('#owner560 summary').click();
 await page.locator('#owner560Refresh').click();
 await expect(page.locator('#owner560Status')).toContainText('HOLD');
 await setup(page,{wrongBoundary:true});await selectCase(page);
 await expect(page.locator('#owner560Reopen')).toBeDisabled();
 await expect(page.locator('#owner560Status')).toContainText('HOLD');
});
test('YW560 sign-out clears protected source and disables original recovery reopen',async({page})=>{
 await setup(page);await selectCase(page);
 await page.evaluate(()=>window.__560Logout());
 await expect(page.locator('#owner560Reopen')).toBeDisabled();
 await expect(page.locator('#owner560Status')).toContainText('session changed');
 await expect(page.locator('#owner560ProviderHistory')).toBeEmpty();
});
