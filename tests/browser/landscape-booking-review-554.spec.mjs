import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const source=fs.readFileSync('js/landscape-booking-review-554.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const client='55555555-5555-4555-8555-555555555555';
const site='66666666-6666-4666-8666-666666666666';

async function setup(page,opts={}){
 await page.route('http://yw554.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><main id="settings"></main></body></html>'}));
 await page.setViewportSize({width:opts.width||390,height:870});
 await page.goto('http://yw554.test');
 await page.evaluate(({owner,company,request,client,site,opts})=>{
  let signedIn=true,decisions=[],audits=[];
  window.__decisions=[];window.__availability=[];
  window.__signOut=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:owner}})};
  const rows=[{id:request,company_id:opts.badTenant?'44444444-4444-4444-8444-444444444444':company,
   full_name:'Sample Customer',contact_value:'sample@example.test',preferred_contact_method:'email',
   service_area:'Tillsonburg',requested_date:'2026-11-20',customer_message:'Front garden',
   estimated_subtotal_cents:12500,created_at:'2026-11-09T15:00:00Z'}];
  function from(table){const q={select(){return q},eq(){return q},order(){return q},limit:async()=>{
   if(table==='ywi_companies')return {error:null,data:[{id:company,name:'Rosevear Landscaping',
    owner_user_id:opts.badOwner?'unknown owner':owner}]};
   if(table==='ywi_landscape_booking_requests_552')return {error:null,data:rows};
   if(table==='ywi_landscape_booking_decisions_554')return {error:null,data:decisions};
   if(table==='ywi_landscape_booking_decision_audit_554')return {error:null,data:audits};
   throw Error('Unexpected table '+table);
  }};return q;}
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from,
   rpc:async(name,args)=>{
    if(name==='ywi_rpc_company_customers_422')return {error:null,data:[{id:client,name:'Sample Customer',is_active:true}]};
    if(name==='ywi_rpc_customer_history_422')return {error:null,data:{company_id:company,client_id:client,
     properties:[{id:site,name:'Property One',address:'Known sample street'}]}};
    if(name==='ywi_rpc_landscape_availability_553'){
     window.__availability.push(args);
     if(opts.noAvailability)return {error:{message:'Original Dispatch evidence unavailable'}};
     return {error:null,data:{company_id:company,request_id:request,availability_state:'review',
      coverage_state:'included',capacity_state:'potential_headroom',schedule_state:'company_dispatch_verified',
      weather_state:'unverified',remaining_minutes_advisory:480,
      availability_confirmed:false,dispatch_authorized:false}};
    }
    if(name==='ywi_rpc_landscape_decide_554'){
     window.__decisions.push(args);
     if(opts.failDecision)return {error:{message:'Owner authorization denied'}};
     const next={company_id:company,request_id:request,decision_version:args.p_expected_version+1,
      decision_state:{hold:'review_hold',requote:'requote_draft',decline:'declined',
       approve:'approved_pending_dispatch'}[args.p_action],owner_note:args.p_owner_note,
      owner_quote_cents:args.p_quote_cents,proposed_start:args.p_start,updated_at:new Date().toISOString()};
     decisions=[next];audits.unshift({company_id:company,request_id:request,action:args.p_action,
      decision_version:next.decision_version,recorded_at:new Date().toISOString(),state_after:next});
     return {error:null,data:{company_id:company,request_id:request,state:next,
      idempotent_replay:false,no_dispatch_write:true,no_customer_message:true}};
    }
    throw Error('Unexpected RPC '+name);
   }};
 },{owner,company,request,client,site,opts});
 await page.addScriptTag({content:source});
 await page.locator('#owner554 summary').click();
}

for(const width of [390,768,1440]){
 test(`owner review/hold/requote and versioned audit at ${width}px`,async({page})=>{
  await setup(page,{width});
  await page.locator('#owner554Refresh').click();
  await expect(page.locator('#owner554Status')).toContainText('Verified owner: 1 recent requests');
  await page.locator('#owner554Request').selectOption(request);
  await expect(page.locator('#owner554RequestSummary')).toContainText('Original request: Front garden');
  await page.locator('#owner554Note').fill('Need on-site measurements');
  await page.locator('#owner554Hold').click();
  await expect(page.locator('#owner554Status')).toContainText('Verified owner');
  await page.locator('#owner554Request').selectOption(request);
  await expect(page.locator('#owner554RequestSummary')).toContainText('Decision: review_hold · version 1');
  await page.locator('#owner554Note').fill('Price needs accurate quantities');
  await page.locator('#owner554Requote').fill('175.50');
  await page.locator('#owner554Quote').click();
  await expect(page.locator('#owner554Status')).toContainText('Verified owner');
  await page.locator('#owner554Request').selectOption(request);
  await expect(page.locator('#owner554RequestSummary')).toContainText('Owner requote draft:');
  await expect(page.locator('#owner554Approve')).toBeDisabled();
  const actions=await page.evaluate(()=>window.__decisions);
  expect(actions.map(a=>[a.p_action,a.p_expected_version])).toEqual([['hold',0],['requote',1]]);
  expect(actions[1].p_quote_cents).toBe(17550);
  expect(actions.every(a=>a.p_company_id===company&&a.p_request_id===request)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}

test('approved owner proposal requires original CRM pair, attestation and RPC review',async({page})=>{
 await setup(page);await page.locator('#owner554Refresh').click();
 await page.locator('#owner554Request').selectOption(request);
 await page.locator('#owner554Start').fill('2026-11-20T10:00');
 await page.locator('#owner554End').fill('2026-11-20T12:00');
 await page.locator('#owner554Client').selectOption(client);
 await expect(page.locator('#owner554Site option')).toHaveCount(2);
 await page.locator('#owner554Site').selectOption(site);
 await page.locator('#owner554Check').click();
 await expect(page.locator('#owner554Availability')).toContainText('YW553 review');
 await page.locator('#owner554Attest').check();
 await page.locator('#owner554Approve').click();
 await expect(page.locator('#owner554Status')).toContainText('Verified owner');
 const actions=await page.evaluate(()=>window.__decisions);
 expect(actions).toHaveLength(1);
 expect(actions[0].p_action).toBe('approve');
 expect(actions[0].p_client_id).toBe(client);
 expect(actions[0].p_site_id).toBe(site);
 expect(actions[0].p_owner_checked).toBe(true);
 expect(actions[0].p_start.endsWith('Z')).toBe(true);
});

test('cross-company reads cannot populate the owner review interface',async({page})=>{
 await setup(page,{badTenant:true});await page.locator('#owner554Refresh').click();
 await expect(page.locator('#owner554Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner554Request option')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__decisions)).toEqual([]);
});
test('unverified company owner and unauthenticated sign-out withhold private details',async({page})=>{
 await setup(page,{badOwner:true});await page.locator('#owner554Refresh').click();
 await expect(page.locator('#owner554Status')).toContainText('WITHHELD');
 await page.evaluate(()=>window.__signOut());
 await expect(page.locator('#owner554Request option')).toHaveCount(1);
 await expect(page.locator('#owner554Company option')).toHaveCount(1);
});
test('failed owner decision does not claim a saved booking',async({page})=>{
 await setup(page,{failDecision:true});await page.locator('#owner554Refresh').click();
 await page.locator('#owner554Request').selectOption(request);
 await page.locator('#owner554Note').fill('Need more information first');
 await page.locator('#owner554Hold').click();
 await expect(page.locator('#owner554Status')).toContainText('NOT SAVED');
 await expect(page.locator('#owner554RequestSummary')).toContainText('awaiting company review');
});
test('missing original availability is withheld rather than presented as confirmation',async({page})=>{
 await setup(page,{noAvailability:true});await page.locator('#owner554Refresh').click();
 await page.locator('#owner554Request').selectOption(request);
 await page.locator('#owner554Start').fill('2026-11-20T10:00');
 await page.locator('#owner554Check').click();
 await expect(page.locator('#owner554Availability')).toContainText('WITHHELD');
});
