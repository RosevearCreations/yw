import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/landscape-recovery-closure-559.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const dispatch='55555555-5555-4555-8555-555555555555';
const signature='a'.repeat(32);
async function setup(page,{width=390,foreign=false,stale=false,unclosed=false}={}){
 await page.route('http://yw559.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:900});await page.goto('http://yw559.test');
 await page.evaluate(({owner,company,request,dispatch,signature,foreign,stale,unclosed})=>{
  let signedIn=true,events=[];window.__559Calls=[];
  window.__559SignOut=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:owner}})};
  function from(table){const chain={select(){return chain},eq(){return chain},order(){return chain},
   limit:async()=>{
    if(table==='ywi_companies')return {error:null,data:[{id:company,name:'Rosevear Landscaping',
     owner_user_id:foreign?'other':owner}]};
    if(table==='ywi_landscape_recovery_cases_556')return {error:null,data:[{
     company_id:foreign?'other':company,request_id:request,case_version:3,
     state:unclosed?'replacement_pending_customer':'closed_verified',
     reason:'crew_unavailable',updated_at:'2026-11-10T00:00:00Z'}]};
    throw Error('Unexpected table '+table);
   }};return chain;}
  window.YWI_SB={auth:{getUser:async()=>({error:null,data:{user:{id:owner}}})},from,
   rpc:async(name,args)=>{
    window.__559Calls.push({name,args});
    if(name==='ywi_rpc_landscape_closure_review_559')return {error:null,data:{
     company_id:company,request_id:request,case_state:unclosed?'replacement_pending_customer':'closed_verified',
     case_version:3,source_gate:unclosed?'HOLD_ORIGINAL_CLOSURE_SOURCE':'ORIGINAL_CLOSURE_EVIDENCE_VERIFIED_READ_ONLY',
     current_dispatch_id:dispatch,current_dispatch_signature:stale?null:signature,
     closure_ready:!unclosed,original_customer_decision:unclosed?'HOLD':'accepted',
     original_customer_receipt_id:dispatch,original_customer_recorded_at:'2026-11-10T11:00:00Z',
     original_supervisor_receipt_id:dispatch,original_close_audit_id:234,
     events,read_only:true,company_scope_only:true,customer_message_sent:false,
     dispatch_authorized:false,master_shell_connection_proven:false,
     owner_acceptance_in_master:false}};
    if(name==='ywi_rpc_landscape_closure_record_559'){
     events=[...events,{action:args.p_action,at:'2026-11-10T13:00:00Z',
      receipt_id:dispatch,case_version:3}];
     return {error:null,data:{status:args.p_action==='closure_reviewed'
      ?'CLOSURE_REVIEWED_SOURCE_LINKED'
      :args.p_action==='supervisor_outcome_reviewed'?'SUPERVISOR_OUTCOME_REVIEWED'
      :'FOLLOWUP_REVIEW_INTENT_ONLY',
      receipt_id:dispatch,customer_message_sent:false,dispatch_authorized:false,
      owner_acceptance_in_master:false}};
    }
    throw Error('Unexpected RPC '+name);
   }};
 },{owner,company,request,dispatch,signature,foreign,stale,unclosed});
 await page.addScriptTag({content:source});
}
async function choose(page){
 await page.locator('#owner559 summary').click();
 await page.locator('#owner559Refresh').click();
 await page.locator('#owner559Case').selectOption(request);
}
for(const width of [390,768,1440]){
 test(`YW559 original closure proof and responsive owner review at ${width}px`,async({page})=>{
  await setup(page,{width});await choose(page);
  await expect(page.locator('#owner559Customer')).toContainText('accepted');
  await expect(page.locator('#owner559Closure')).toContainText('SOURCE');
  await page.locator('#owner559Note').fill('Reviewed original close audit and customer acceptance with no new dispatch.');
  await page.locator('#owner559Attest').check();await page.locator('#owner559Record').click();
  await expect(page.locator('#owner559Result')).toContainText('CLOSURE_REVIEWED_SOURCE_LINKED');
  await page.locator('#owner559Case').selectOption('');
  await page.locator('#owner559Case').selectOption(request);
  await page.locator('#owner559Action').selectOption('supervisor_outcome_reviewed');
  await page.locator('#owner559Note').fill('Reviewed independently acknowledged supervisor source and original outcome.');
  await page.locator('#owner559Attest').check();await page.locator('#owner559Record').click();
  await expect(page.locator('#owner559Result')).toContainText('SUPERVISOR_OUTCOME_REVIEWED');
  await page.locator('#owner559Case').selectOption('');
  await page.locator('#owner559Case').selectOption(request);
  await page.locator('#owner559Action').selectOption('customer_followup_requested');
  await page.locator('#owner559Note').fill('Requested protected customer follow-up review; no messages were sent.');
  await page.locator('#owner559Attest').check();await page.locator('#owner559Record').click();
  await expect(page.locator('#owner559Result')).toContainText('FOLLOWUP_REVIEW_INTENT_ONLY');
  const calls=await page.evaluate(()=>window.__559Calls);
  const writes=calls.filter(x=>x.name==='ywi_rpc_landscape_closure_record_559');
  expect(writes).toHaveLength(3);
  expect(writes.every(x=>x.args.p_expected_dispatch_signature===signature)).toBe(true);
  expect(calls.some(x=>/customer_confirm|dispatch_create|send_message/.test(x.name))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW559 stale Dispatch signature, unclosed case and foreign company are HOLD',async({page})=>{
 await setup(page,{stale:true});await choose(page);
 await page.locator('#owner559Note').fill('Reviewed old Dispatch evidence and requested review.');
 await page.locator('#owner559Attest').check();
 await expect(page.locator('#owner559Record')).toBeDisabled();
 await setup(page,{unclosed:true});await choose(page);
 await expect(page.locator('#owner559Record')).toBeDisabled();
 await setup(page,{foreign:true});await page.locator('#owner559 summary').click();
 await page.locator('#owner559Refresh').click();
 await expect(page.locator('#owner559Status')).toContainText('HOLD');
});
test('YW559 clears privileged evidence immediately on signout',async({page})=>{
 await setup(page);await choose(page);
 await page.evaluate(()=>window.__559SignOut());
 await expect(page.locator('#owner559Record')).toBeDisabled();
 await expect(page.locator('#owner559Status')).toContainText('session changed');
});
