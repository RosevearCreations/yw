import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/landscape-supervisor-resolution-558.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const dispatch='55555555-5555-4555-8555-555555555555';
const signature='a'.repeat(32);
async function setup(page,{width=390,kind='escalated',foreign=false,stale=false,error=false}={}){
 await page.route('http://yw558.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:900});await page.goto('http://yw558.test');
 await page.evaluate(({owner,company,request,dispatch,signature,kind,foreign,stale,error})=>{
  let signedIn=true;window.__558Calls=[];
  window.__558SignOut=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:owner}})};
  function from(table){const chain={select(){return chain},eq(){return chain},order(){return chain},limit:async()=>{
   if(table==='ywi_companies')return {error:null,data:[{id:company,name:'Rosevear Landscaping',owner_user_id:foreign?'other':owner}]};
   if(table==='ywi_landscape_recovery_cases_556')return {error:null,data:[{
    company_id:foreign?'other':company,request_id:request,case_version:2,
    state:'replacement_pending_customer',reason:'crew_unavailable',updated_at:'2026-11-08T00:00:00Z'}]};
   throw Error('Unexpected table: '+table);
  }};return chain;}
  window.YWI_SB={auth:{getUser:async()=>({error:null,data:{user:{id:owner}}})},from,
   rpc:async(name,args)=>{
    window.__558Calls.push({name,args});if(error)return {error:{message:'original DB unavailable'}};
    if(name==='ywi_rpc_landscape_audit_timeline_558')return {error:null,data:{
     company_id:company,request_id:request,case_version:2,case_state:'replacement_pending_customer',
     current_dispatch_id:dispatch,current_dispatch_signature:stale?null:signature,
     original_review_status:kind==='reviewed'?'ACKNOWLEDGED_REVIEW_ONLY':'HOLD',
     supervisor_kind:kind,customer_reconfirmation:{decision:'PENDING_ORIGINAL_PORTAL'},
     events:[{type:'supervisor',action:kind,version:2,at:'2026-11-09T15:00:00Z',receipt_id:dispatch}],
     read_only:true,company_scope_only:true,dispatch_authorized:false,
     customer_confirmation_authorized:false,master_shell_connection_proven:false}};
    if(name==='ywi_rpc_landscape_resolution_558')return {error:null,data:{
     status:args.p_action==='escalation_reviewed'?'ESCALATION_REVIEWED_HOLD':'RECONFIRMATION_GATE_READY_ONLY',
     receipt_id:dispatch,case_version:2,customer_confirmed:false,dispatch_authorized:false}};
    throw Error('Unexpected RPC '+name);
   }};
 },{owner,company,request,dispatch,signature,kind,foreign,stale,error});
 await page.addScriptTag({content:source});
}
for(const width of [390,768,1440]){
 test(`immutable source history, owner acknowledgement, mobile layout ${width}px`,async({page})=>{
  await setup(page,{width});await page.locator('#owner558 summary').click();
  await page.locator('#owner558Refresh').click();await page.locator('#owner558Case').selectOption(request);
  await expect(page.locator('#owner558Timeline')).toContainText('supervisor');
  await expect(page.locator('#owner558Customer')).toContainText('PENDING_ORIGINAL_PORTAL');
  await expect(page.locator('#owner558Record')).toBeDisabled();
  await page.locator('#owner558Note').fill('Reviewed current supervisor escalation and required corrective dispatch action.');
  await page.locator('#owner558Attest').check();await page.locator('#owner558Record').click();
  await expect(page.locator('#owner558Result')).toContainText('ESCALATION_REVIEWED_HOLD');
  const calls=await page.evaluate(()=>window.__558Calls);
  expect(calls.find(x=>x.name==='ywi_rpc_landscape_resolution_558').args.p_expected_dispatch_signature).toBe(signature);
  expect(calls.some(x=>/customer_confirm|dispatch_create|work_order_create/.test(x.name))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('reconfirmation is gated and never forges original customer acceptance',async({page})=>{
 await setup(page,{kind:'reviewed'});await page.locator('#owner558 summary').click();
 await page.locator('#owner558Refresh').click();await page.locator('#owner558Case').selectOption(request);
 await page.locator('#owner558Action').selectOption('reconfirmation_requested');
 await page.locator('#owner558Note').fill('Replacement preflight verified; customer must independently reconfirm the original offer.');
 await page.locator('#owner558Attest').check();await page.locator('#owner558Record').click();
 await expect(page.locator('#owner558Result')).toContainText('RECONFIRMATION_GATE_READY_ONLY');
 expect((await page.evaluate(()=>window.__558Calls)).filter(x=>x.name==='ywi_rpc_landscape_resolution_558')).toHaveLength(1);
});
test('stale original Dispatch signature cannot receive owner receipt',async({page})=>{
 await setup(page,{stale:true});await page.locator('#owner558 summary').click();
 await page.locator('#owner558Refresh').click();await page.locator('#owner558Case').selectOption(request);
 await page.locator('#owner558Note').fill('Original Dispatch source must be fresh before any owner receipt.');
 await page.locator('#owner558Attest').check();await expect(page.locator('#owner558Record')).toBeDisabled();
});
test('foreign company, failed source and logout remain HOLD',async({page})=>{
 await setup(page,{foreign:true});await page.locator('#owner558 summary').click();
 await page.locator('#owner558Refresh').click();await expect(page.locator('#owner558Status')).toContainText('HOLD');
 expect(await page.locator('#owner558Case option').count()).toBe(1);
 await page.evaluate(()=>window.__558SignOut());await expect(page.locator('#owner558Record')).toBeDisabled();
 await expect(page.locator('#owner558Evidence')).toContainText('HOLD');
});
