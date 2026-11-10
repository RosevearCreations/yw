import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const source=fs.readFileSync('js/landscape-canonical-handoff-555.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const estimate='44444444-4444-4444-8444-444444444444';
const quote='55555555-5555-4555-8555-555555555555';
const job='66666666-6666-4666-8666-666666666666';
const dispatch='77777777-7777-4777-8777-777777777777';

async function setup(page,opts={}){
 await page.route('http://yw555.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><main id="settings"></main></body></html>'}));
 await page.setViewportSize({width:opts.width||390,height:860});
 await page.goto('http://yw555.test');
 await page.evaluate(({owner,company,request,estimate,quote,job,dispatch,opts})=>{
  let signedIn=true,handoffs=[];
  window.__handoffCalls=[];window.__originalReads=[];
  window.__signOut=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:owner}})};
  const decision={company_id:company,request_id:request,decision_state:'approved_pending_dispatch',decision_version:2,
   proposed_start:'2026-11-20T15:00:00Z',proposed_end:'2026-11-20T17:00:00Z',
   client_id:'88888888-8888-4888-8888-888888888888',client_site_id:'99999999-9999-4999-8999-999999999999'};
  const rows=[{id:request,company_id:opts.foreignTenant?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':company,
   service_area:'Tillsonburg',created_at:'2026-11-10T00:00:00Z'}];
  const entries=[
   {estimate_id:estimate,estimate_number:'E-555',quote_package_id:quote,quote_state:'accepted',accepted_at:'2026-11-11T00:00:00Z',customer_named:true,terms_recorded:true,work_order_id:null,dispatch_id:null},
   {estimate_id:estimate,estimate_number:'E-555',quote_package_id:quote,quote_state:'accepted',accepted_at:'2026-11-11T00:00:00Z',customer_named:true,terms_recorded:true,work_order_id:job,work_order_number:'WO-555',job_state:'draft',dispatch_id:null},
   {estimate_id:estimate,estimate_number:'E-555',quote_package_id:quote,quote_state:'accepted',accepted_at:'2026-11-11T00:00:00Z',customer_named:true,terms_recorded:true,work_order_id:job,work_order_number:'WO-555',job_state:'scheduled',dispatch_id:dispatch,dispatch_state:'scheduled',crew_selected:true}
  ];
  function from(table){const q={select(){return q},eq(){return q},order(){return q},limit:async()=>{
   if(table==='ywi_companies')return {data:[{id:company,name:'Rosevear Landscaping',owner_user_id:opts.badOwner?'unverified':owner}],error:null};
   if(table==='ywi_landscape_booking_requests_552')return {data:rows,error:null};
   if(table==='ywi_landscape_booking_decisions_554')return {data:[decision],error:null};
   if(table==='ywi_landscape_canonical_handoffs_555')return {data:handoffs,error:null};
   throw Error('unexpected '+table);
  }};return q;}
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from,
   rpc:async(name,args)=>{
    if(name==='ywi_rpc_landscape_handoff_candidates_555'){
     window.__originalReads.push(args);
     if(opts.noProof)return {error:{message:'Original quote acceptance is unavailable'}};
     return {error:null,data:{company_id:company,request_id:request,read_only:true,candidates:entries}};
    }
    if(name==='ywi_rpc_landscape_canonical_handoff_555'){
     window.__handoffCalls.push(args);
     if(opts.rejectHandoff)return {error:{message:'Original Jobs release is HOLD'}};
     const state={company_id:company,request_id:request,handoff_version:args.p_expected_version+1,
      estimate_id:estimate,quote_package_id:quote,work_order_id:args.p_work_order_id,
      dispatch_id:args.p_dispatch_id,state:{stage:'awaiting_original_job',link_job:'awaiting_crew_dispatch',verify_crew:'verified_crew_handoff'}[args.p_action]};
     handoffs=[state];return {error:null,data:{company_id:company,request_id:request,state,original_source_writes:false}};
    }
    throw Error('unexpected RPC '+name);
   }};
 },{owner,company,request,estimate,quote,job,dispatch,opts});
 await page.addScriptTag({content:source});
 await page.locator('#owner555 summary').click();
}

async function choose(page,index){
 await page.locator('#owner555Request').selectOption(request);
 await page.locator('#owner555Candidates').click();
 await expect(page.locator('#owner555Candidate option')).toHaveCount(4);
 await page.locator('#owner555Candidate').selectOption(String(index));
 await page.locator('#owner555Attest').check();
}

for(const width of [390,768,1440]){
 test(`owner's exact original quote/job/crew handoff at ${width}px`,async({page})=>{
  await setup(page,{width});await page.locator('#owner555Refresh').click();
  await expect(page.locator('#owner555Status')).toContainText('Owner verified');
  await choose(page,0);await expect(page.locator('#owner555Stage')).toBeEnabled();
  await expect(page.locator('#owner555Link')).toBeDisabled();
  await page.locator('#owner555Stage').click();
  await expect(page.locator('#owner555Status')).toContainText('Owner verified');
  await choose(page,1);await expect(page.locator('#owner555Link')).toBeEnabled();
  await page.locator('#owner555Link').click();
  await expect(page.locator('#owner555Status')).toContainText('Owner verified');
  await choose(page,2);await expect(page.locator('#owner555Crew')).toBeEnabled();
  await page.locator('#owner555Crew').click();
  await expect(page.locator('#owner555Status')).toContainText('Owner verified');
  const calls=await page.evaluate(()=>window.__handoffCalls);
  expect(calls.map(c=>[c.p_action,c.p_expected_version])).toEqual([['stage',0],['link_job',1],['verify_crew',2]]);
  expect(calls.every(c=>c.p_company_id===company&&c.p_request_id===request&&c.p_owner_attested===true)).toBe(true);
  expect(calls[2].p_dispatch_id).toBe(dispatch);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}

test('foreign-company quote requests and unverified owners never reach handoff RPC',async({page})=>{
 await setup(page,{foreignTenant:true});await page.locator('#owner555Refresh').click();
 await expect(page.locator('#owner555Status')).toContainText('HOLD:');
 expect(await page.evaluate(()=>window.__handoffCalls)).toEqual([]);
});

test('missing original quote proof leaves actions disabled',async({page})=>{
 await setup(page,{noProof:true});await page.locator('#owner555Refresh').click();
 await page.locator('#owner555Request').selectOption(request);
 await page.locator('#owner555Candidates').click();
 await expect(page.locator('#owner555Evidence')).toContainText('HOLD:');
 await expect(page.locator('#owner555Stage')).toBeDisabled();
});

test('source denial is not represented as a successful handoff',async({page})=>{
 await setup(page,{rejectHandoff:true});await page.locator('#owner555Refresh').click();
 await choose(page,0);await page.locator('#owner555Stage').click();
 await expect(page.locator('#owner555Status')).toContainText('HOLD / NOT VERIFIED');
 expect(await page.evaluate(()=>window.__handoffCalls)).toHaveLength(1);
});

test('sign-out clears company, proposal and candidate evidence',async({page})=>{
 await setup(page);await page.locator('#owner555Refresh').click();await choose(page,0);
 await page.evaluate(()=>window.__signOut());
 await expect(page.locator('#owner555Stage')).toBeDisabled();
 await expect(page.locator('#owner555Request option')).toHaveCount(1);
 await expect(page.locator('#owner555Candidate option')).toHaveCount(1);
});
