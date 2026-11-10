import { test,expect } from '@playwright/test';
import fs from 'node:fs';

const source=fs.readFileSync('js/landscape-recovery-556.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const job='44444444-4444-4444-8444-444444444444';
const quote='55555555-5555-4555-8555-555555555555';
const originalDispatch='66666666-6666-4666-8666-666666666666';
const replacementDispatch='77777777-7777-4777-8777-777777777777';

async function setup(page,opts={}) {
 await page.route('http://yw556.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><body><main id="settings"></main></body></html>'}));
 await page.setViewportSize({width:opts.width||390,height:880});
 await page.goto('http://yw556.test');
 await page.evaluate(({owner,company,request,job,quote,originalDispatch,replacementDispatch,opts})=>{
  let signedIn=true,cases=[],receipts=[];
  window.__recoveryCalls=[];window.__originalReadCalls=[];
  window.__signOut=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.__ack=()=>{const c=cases[0];if(c)receipts.push({id:'88888888-8888-4888-8888-888888888888',
   company_id:company,request_id:request,case_version:c.case_version,decision:'accepted',
   replacement_dispatch_id:replacementDispatch,recorded_at:'2026-11-12T00:00:00Z'});};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:owner}})};
  const handoffs=[{company_id:opts.foreignTenant?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':company,
   request_id:request,work_order_id:job,quote_package_id:quote,dispatch_id:originalDispatch,
   state:'verified_crew_handoff',updated_at:'2026-11-10T00:00:00Z'}];
  function from(table){const q={select(){return q},eq(){return q},order(){return q},limit:async()=>{
   if(table==='ywi_companies')return {data:[{id:company,name:'Rosevear Landscaping',owner_user_id:opts.badOwner?'unknown':owner}],error:null};
   if(table==='ywi_landscape_canonical_handoffs_555')return {data:handoffs,error:null};
   if(table==='ywi_landscape_recovery_cases_556')return {data:cases,error:null};
   if(table==='ywi_landscape_customer_confirmations_556')return {data:receipts,error:null};
   throw Error('Unexpected table '+table);
  }};return q;}
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from,
   rpc:async(name,args)=>{
    if(name==='ywi_rpc_landscape_recovery_candidates_556'){
     window.__originalReadCalls.push(args);
     if(opts.noOriginalReceipt)return {error:{message:'Original Dispatch replacement unavailable'}};
     return {error:null,data:{company_id:company,request_id:request,read_only:true,candidates:[{
      id:replacementDispatch,work_order_id:job,supersedes_dispatch_id:originalDispatch,
      crew_id:'99999999-9999-4999-8999-999999999999',schedule_status:'scheduled',
      scheduled_start:'2026-11-15T15:00:00Z',scheduled_end:'2026-11-15T17:00:00Z'}]}};
    }
    if(name==='ywi_rpc_landscape_recovery_556'){
     window.__recoveryCalls.push(args);
     if(opts.denyOwnerAction)return {error:{message:'Original Dispatch safety HOLD'}};
     const newState={open:'exception_open',verify_replacement:'replacement_pending_customer',close:'closed_verified'}[args.p_action];
     cases=[{...cases[0],company_id:company,request_id:request,work_order_id:job,
      quote_package_id:quote,original_dispatch_id:originalDispatch,
      replacement_dispatch_id:args.p_action==='open'?null:replacementDispatch,
      state:newState,reason:args.p_action==='open'?args.p_reason:cases[0]?.reason,
      case_version:args.p_expected_version+1,updated_at:'2026-11-10T01:00:00Z'}];
     return {error:null,data:{...cases[0],authorizes_original_dispatch_mutation:false}};
    }
    throw Error('Unexpected RPC '+name);
   }};
 },{owner,company,request,job,quote,originalDispatch,replacementDispatch,opts});
 await page.addScriptTag({content:source});
 await page.locator('#owner556 summary').click();
}
async function choose(page){await page.locator('#owner556Refresh').click();await page.locator('#owner556Request').selectOption(request);}
async function attest(page){await page.locator('#owner556Attest').check();}
async function open(page){await choose(page);await page.locator('#owner556Reason').selectOption('crew_unavailable');
 await page.locator('#owner556Note').fill('Original crew became unavailable.');await attest(page);
 await page.locator('#owner556Open').click();await expect(page.locator('#owner556Case')).toContainText('exception_open');}
async function verify(page){await attest(page);await page.locator('#owner556Candidates').click();
 await page.locator('#owner556Replacement').selectOption(replacementDispatch);
 await page.locator('#owner556Verify').click();await expect(page.locator('#owner556Case')).toContainText('replacement_pending_customer');}

for(const width of [390,768,1440]){
 test(`owner 556 exception, independent replacement, customer gate at ${width}px`,async({page})=>{
  await setup(page,{width});await open(page);
  await expect(page.locator('#owner556Close')).toBeDisabled();
  await verify(page);
  await expect(page.locator('#owner556Customer')).toContainText('Awaiting');
  await expect(page.locator('#owner556Close')).toBeDisabled();
  await page.evaluate(()=>window.__ack());await choose(page);
  await expect(page.locator('#owner556Customer')).toContainText('ACCEPTED');
  await attest(page);await page.locator('#owner556Close').click();
  await expect(page.locator('#owner556Case')).toContainText('closed_verified');
  const calls=await page.evaluate(()=>window.__recoveryCalls);
  expect(calls.map(c=>[c.p_action,c.p_expected_version])).toEqual([['open',0],['verify_replacement',1],['close',2]]);
  expect(calls.every(c=>c.p_company_id===company&&c.p_owner_attested===true&&c.p_request_id===request)).toBe(true);
  expect(calls[1].p_replacement_dispatch_id).toBe(replacementDispatch);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('unverified tenant owner and foreign handoff fail closed',async({page})=>{
 await setup(page,{foreignTenant:true});await page.locator('#owner556Refresh').click();
 await expect(page.locator('#owner556Status')).toContainText('HOLD:');
 await expect(page.locator('#owner556Open')).toBeDisabled();
 expect(await page.evaluate(()=>window.__recoveryCalls)).toEqual([]);
});
test('original Dispatch replacement denial never permits verification',async({page})=>{
 await setup(page,{noOriginalReceipt:true});await open(page);await attest(page);
 await page.locator('#owner556Candidates').click();
 await expect(page.locator('#owner556Status')).toContainText('HOLD:');
 await expect(page.locator('#owner556Verify')).toBeDisabled();
});
test('server rejects owner change and does not imply a successful recovery',async({page})=>{
 await setup(page,{denyOwnerAction:true});await choose(page);
 await page.locator('#owner556Reason').selectOption('crew_unavailable');
 await page.locator('#owner556Note').fill('Original crew became unavailable.');await attest(page);
 await page.locator('#owner556Open').click();
 await expect(page.locator('#owner556Status')).toContainText('HOLD / NO CHANGE VERIFIED');
});
test('sign out removes trusted selections and disables owner actions',async({page})=>{
 await setup(page);await choose(page);
 await page.evaluate(()=>window.__signOut());
 await expect(page.locator('#owner556Request option')).toHaveCount(1);
 await expect(page.locator('#owner556Close')).toBeDisabled();
});
