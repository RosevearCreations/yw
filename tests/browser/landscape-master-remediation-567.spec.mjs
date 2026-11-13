import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const ui=fs.readFileSync('js/landscape-master-remediation-567.js','utf8');
const user='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const receipt='44444444-4444-4444-8444-444444444444';
const observation='55555555-5555-4555-8555-555555555555';
const reconciliation='66666666-6666-4666-8666-666666666666';
const reopen='77777777-7777-4777-8777-777777777777';
async function setup(page,{width=390,foreign=false,signedRisk=false,sla=false,
 remedy=false,reconciled=true}={}){
 await page.route('http://yw567.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><section id="settings"></section></body></html>'}));
 await page.setViewportSize({width,height:900});await page.goto('http://yw567.test');
 await page.evaluate(({user,company,request,receipt,observation,reconciliation,reopen,foreign,signedRisk,sla,remedy,reconciled})=>{
  let signedIn=true;window.__567Calls=[];
  window.__567Signout=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:user}})};
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:user}},error:null})},
   from(table){
    const q={select(){return q},eq(){return q},order(){return q},
     async limit(){
      if(table==='ywi_companies')return {error:null,data:[{
       id:company,name:'Rosevear Landscaping',owner_user_id:foreign?'foreign':user}]};
      if(table==='ywi_landscape_recovery_cases_556')return {error:null,data:[{
       company_id:company,request_id:request,case_version:5,state:'closed_verified',
       updated_at:'2026-11-13T19:00:00Z'}]};
      if(table==='ywi_landscape_provider_verified_561')return {error:null,data:[{
       id:receipt,company_id:company,request_id:request,case_version:5,
       provider_reported_state:'delivered',verified_at:'2026-11-13T19:00:00Z'}]};
      throw Error('Unexpected direct query '+table);
     }};return q;
   },
   async rpc(name,args){
    window.__567Calls.push({name,args});
    if(name==='ywi_rpc_landscape_master_remediation_review_567')return {error:null,data:{
     company_id:company,request_id:request,case_version:5,
     provider_verified_receipt_id:receipt,canonical_sha256:'a'.repeat(64),
     source_reconciliation_id:reconciled?reconciliation:null,
     source_reconciled_at:reconciled?'2026-11-13T10:00:00Z':null,
     source_reopen_id:remedy?reopen:null,
     source_reopened_at:remedy?'2026-11-13T12:00:00Z':null,
     latest_source_remediation_audit_id:null,last_owner_action:'HOLD',last_owner_action_id:null,
     master_observation_id:observation,master_observation_verified_at:'2026-11-13T14:00:00Z',
     last_signed_risk_at:signedRisk?'2026-11-13T13:00:00Z':null,
     signed_risk_after_reconciliation:signedRisk,source_sla_state:sla?'BREACHED':'WITHIN_TARGET',
     source_sla_due_at:'2026-11-14T10:00:00Z',source_sla_breached:sla,
     source_receipt_stale:false,
     independent_source_remediation_ready:remedy,remediation_audit_current:false,
     remediation_classification:signedRisk?'REOPEN_NEW_INDEPENDENT_SIGNED_RISK':
       remedy?'FRESH_SIGNED_SOURCE_REMEDIATION_READY':
        sla?'SOURCE_SLA_BREACH_REMEDIATION_REQUIRED':'SOURCE_RECONCILIATION_MONITORING_HOLD',
     source_only_not_continuous_uptime:true,
     recipient_delivery_independently_verified:false,customer_message_sent:false,
     master_owner_acceptance:false,master_connected:false,company_scope_only:true,read_only:true
    }};
    if(name==='ywi_rpc_landscape_master_remediation_decide_567')return {error:null,data:{
     status:'SOURCE_REMEDIATION_ACTION_RECORDED_MASTER_HOLD',audit_id:reopen,
     action:args.p_action,master_owner_acceptance:false,master_connected:false}};
    throw Error('Unexpected RPC '+name);
   }};
 },{user,company,request,receipt,observation,reconciliation,reopen,foreign,signedRisk,sla,remedy,reconciled});
 await page.addScriptTag({content:ui});
}
async function inspect(page){
 await page.locator('#owner567 summary').click();
 await page.locator('#owner567Refresh').click();
 await page.locator('#owner567Case').selectOption(request);
 await page.locator('#owner567Receipt').selectOption(receipt);
 await expect(page.locator('#owner567Reopen')).toContainText('Original provider SHA-256');
}
for(const width of [390,768,1440]){
 test('YW567 owner records original signed risk reopening on '+width+'px, never Master acceptance',async({page})=>{
  await setup(page,{width,signedRisk:true});await inspect(page);
  await expect(page.locator('#owner567Reopen')).toContainText('signed risk after reconciliation YES');
  await page.locator('#owner567Action').selectOption('record_signed_source_reopen');
  await page.locator('#owner567Note').fill('New independent signed discrepancy after original source reconciliation requires reopening.');
  await page.locator('#owner567Attest').check();
  await expect(page.locator('#owner567Decide')).toBeEnabled();
  await page.locator('#owner567Decide').click();
  await expect(page.locator('#owner567Status')).toContainText('SOURCE_REMEDIATION_ACTION_RECORDED_MASTER_HOLD');
  const all=await page.evaluate(()=>window.__567Calls);
  const decisions=all.filter(x=>x.name==='ywi_rpc_landscape_master_remediation_decide_567');
  expect(decisions).toHaveLength(1);
  expect(decisions[0].args.p_expected_reconciliation_id).toBe(reconciliation);
  expect(decisions[0].args.p_expected_observation_id).toBe(observation);
  expect(decisions[0].args.p_expected_case_version).toBe(5);
  expect(all.some(x=>/customer_send|master_accept|observation_admit/i.test(x.name))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW567 current independently signed remediation permits an original owner audit',async({page})=>{
 await setup(page,{remedy:true});await inspect(page);
 await expect(page.locator('#owner567Remediation')).toContainText('READY FOR OWNER AUDIT');
 await page.locator('#owner567Action').selectOption('audit_signed_source_remediation');
 await page.locator('#owner567Note').fill('Verified independent signed Master observation after source reopen and original SLA remediation.');
 await page.locator('#owner567Attest').check();
 await expect(page.locator('#owner567Decide')).toBeEnabled();
});
test('YW567 missing signed post-reopen remediation blocks audit, allows supervised source recheck',async({page})=>{
 await setup(page,{remedy:false,signedRisk:true});await inspect(page);
 await page.locator('#owner567Action').selectOption('audit_signed_source_remediation');
 await page.locator('#owner567Note').fill('No independent signed source remediation has been admitted after the original reopen.');
 await page.locator('#owner567Attest').check();
 await expect(page.locator('#owner567Decide')).toBeDisabled();
 await page.locator('#owner567Action').selectOption('request_supervised_remediation_recheck');
 await expect(page.locator('#owner567Decide')).toBeEnabled();
});
test('YW567 foreign tenant and sign-out clear source evidence fail-closed',async({page})=>{
 await setup(page,{foreign:true,signedRisk:true});
 await page.locator('#owner567 summary').click();await page.locator('#owner567Refresh').click();
 await expect(page.locator('#owner567Status')).toContainText('HOLD');
 await expect(page.locator('#owner567Decide')).toBeDisabled();
 await setup(page,{signedRisk:true});await inspect(page);
 await page.evaluate(()=>window.__567Signout());
 await expect(page.locator('#owner567Decide')).toBeDisabled();
 await expect(page.locator('#owner567Receipt option')).toHaveCount(1);
 await expect(page.locator('#owner567Status')).toContainText('session changed');
});
