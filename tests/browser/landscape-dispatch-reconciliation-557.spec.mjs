import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/landscape-dispatch-reconciliation-557.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const supervisor='44444444-4444-4444-8444-444444444444';
const dispatch='55555555-5555-4555-8555-555555555555';
const signature='a'.repeat(32);

async function setup(page,{width=390,role='owner',badTenant=false,stale=false,fail=false}={}){
 await page.route('http://yw557.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><section id="crew"></section><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:900});await page.goto('http://yw557.test');
 await page.evaluate(({owner,company,request,supervisor,dispatch,signature,role,badTenant,stale,fail})=>{
  let signedIn=true;const user=role==='supervisor'?supervisor:owner;
  window.__557Calls=[];window.__557SignOut=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:user}})};
  function from(table){const chain={select(){return chain},eq(){return chain},order(){return chain},limit:async()=>{
   if(table==='ywi_companies')return {error:null,data:[{id:company,name:'Rosevear Landscaping',owner_user_id:badTenant?'foreign':user}]};
   if(table==='ywi_landscape_recovery_cases_556')return {error:null,data:[{company_id:badTenant?'foreign':company,request_id:request,case_version:2,state:'exception_open',reason:'crew_unavailable',updated_at:'2026-11-08T00:00:00Z'}]};
   throw Error('Unexpected table '+table);
  }};return chain;}
  window.YWI_SB={auth:{getUser:async()=>({error:null,data:{user:{id:user}}})},from,
   rpc:async(name,args)=>{
    window.__557Calls.push({name,args});if(fail)return {error:{message:'Original source HOLD'}};
    if(name==='ywi_rpc_landscape_recovery_review_557')return {error:null,data:{
     company_id:company,request_id:request,read_only:true,original_source_authority:true,
     dispatch_authorized:false,customer_confirmation_authorized:false,
     current_dispatch_id:dispatch,aging_band:'overdue_48h',recovery_age_minutes:3210,
     case_version:2,case_state:'exception_open',status:'HOLD',
     capacity:{schedule_state:'company_dispatch_verified',declared_crew_minutes:480,scheduled_minutes:420,remaining_minutes_advisory:60,capacity_state:'potential_headroom'},
     acknowledgement:null,reasons:['Current supervisor acknowledgement missing']}};
    if(name==='ywi_rpc_landscape_supervisor_queue_557')return {error:null,data:{
     read_only:true,dispatch_authorized:false,cases:[{company_id:company,request_id:request,
      case_version:2,state:'exception_open',reason:'crew_unavailable',updated_at:'2026-11-08T00:00:00Z',
      dispatch_id:dispatch,dispatch_signature:stale?null:signature,schedule_status:'scheduled',
      scheduled_start:'2026-11-15T14:00:00Z',scheduled_end:'2026-11-15T18:00:00Z'}]}};
    if(name==='ywi_rpc_landscape_supervisor_ack_557')return {error:null,data:{status:'RECORDED',case_version:2,dispatch_authorized:false,receipt_id:'66666666-6666-4666-8666-666666666666'}};
    throw Error('Unexpected RPC '+name);
   }};
 },{owner,company,request,supervisor,dispatch,signature,role,badTenant,stale,fail});
 await page.addScriptTag({content:source});
}

for(const width of [390,768,1440]){
 test(`owner capacity, aging and missing supervisor remain advisory at ${width}px`,async({page})=>{
  await setup(page,{width});await page.locator('#owner557 summary').click();
  await page.locator('#owner557Refresh').click();
  await page.locator('#owner557Case').selectOption(request);
  await expect(page.locator('#owner557Aging')).toContainText('overdue_48h');
  await expect(page.locator('#owner557Capacity')).toContainText('advisory headroom 60');
  await expect(page.locator('#owner557Supervisor')).toContainText('HOLD');
  await expect(page.locator('#owner557Status')).toContainText('HOLD');
  expect(await page.evaluate(()=>window.__557Calls.every(c=>c.name==='ywi_rpc_landscape_recovery_review_557'))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}

test('supervisor-only source-bound acknowledgement, no original Dispatch mutation',async({page})=>{
 await setup(page,{role:'supervisor'});await page.locator('#supervisor557 summary').click();
 await page.locator('#supervisor557Refresh').click();
 await page.locator('#supervisor557Case').selectOption(request);
 await expect(page.locator('#supervisor557Ack')).toBeDisabled();
 await page.locator('#supervisor557Note').fill('Reviewed original Dispatch staffing and flagged current schedule.');
 await page.locator('#supervisor557Attest').check();await page.locator('#supervisor557Kind').selectOption('escalated');
 await page.locator('#supervisor557Ack').click();
 await expect(page.locator('#supervisor557Status')).toContainText('receipt recorded');
 const calls=await page.evaluate(()=>window.__557Calls);
 const ack=calls.find(x=>x.name==='ywi_rpc_landscape_supervisor_ack_557');
 expect(ack.args.p_company_id).toBe(company);expect(ack.args.p_request_id).toBe(request);
 expect(ack.args.p_expected_dispatch_signature).toBe(signature);expect(ack.args.p_expected_case_version).toBe(2);
 expect(ack.args.p_acknowledgement).toBe('escalated');expect(ack.args.p_idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
 expect(calls.some(x=>x.name.includes('create_dispatch')||x.name.includes('confirm_customer'))).toBe(false);
});

test('stale current Dispatch signature cannot be acknowledged',async({page})=>{
 await setup(page,{role:'supervisor',stale:true});await page.locator('#supervisor557 summary').click();
 await page.locator('#supervisor557Refresh').click();await page.locator('#supervisor557Case').selectOption(request);
 await page.locator('#supervisor557Note').fill('Reviewed original Dispatch exception.');await page.locator('#supervisor557Attest').check();
 await expect(page.locator('#supervisor557Ack')).toBeDisabled();
 expect((await page.evaluate(()=>window.__557Calls)).some(x=>x.name==='ywi_rpc_landscape_supervisor_ack_557')).toBe(false);
});

test('foreign company owner row fails closed',async({page})=>{
 await setup(page,{badTenant:true});await page.locator('#owner557 summary').click();
 await page.locator('#owner557Refresh').click();
 await expect(page.locator('#owner557Status')).toContainText('HOLD');
 expect(await page.locator('#owner557Case option').count()).toBe(1);
});

test('source errors and sign-out remove trusted data',async({page})=>{
 await setup(page,{role:'supervisor',fail:true});await page.locator('#supervisor557 summary').click();
 await page.locator('#supervisor557Refresh').click();
 await expect(page.locator('#supervisor557Status')).toContainText('HOLD');
 await page.evaluate(()=>window.__557SignOut());
 await expect(page.locator('#supervisor557Ack')).toBeDisabled();
 await expect(page.locator('#supervisor557Case option')).toHaveCount(1);
});
