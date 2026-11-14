import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const script=fs.readFileSync('js/landscape-resolution-568.js','utf8');
const user='11111111-1111-4111-8111-111111111111';
const company='22222222-2222-4222-8222-222222222222';
const request='33333333-3333-4333-8333-333333333333';
const receipt='44444444-4444-4444-8444-444444444444';
const reconciliation='55555555-5555-4555-8555-555555555555';
const reopen='66666666-6666-4666-8666-666666666666';
const audit='77777777-7777-4777-8777-777777777777';
const observation='88888888-8888-4888-8888-888888888888';
async function setup(page,width=390){
 await page.setViewportSize({width,height:900});
 await page.route('http://yw568.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:`<!doctype html>
 <html data-yw-theme="futuristic"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
 <div id="owner567"><div class="admin-panel-block">
 <select id="owner567Company"><option value="${company}">Rosevear Landscaping</option></select>
 <select id="owner567Case"><option value="${request}">case</option></select>
 <select id="owner567Receipt"><option value="${receipt}">signed receipt</option></select>
 </div></div>
 <div id="yw565Command"><div class="yw565-command-card"><details class="yw567-drilldown" open>
 <summary aria-label="Explore Jobs module destinations">Jobs</summary>
 <ul><li><a href="#jobs" data-yw567-route="#jobs">Jobs</a></li>
 <li hidden><a href="#sysop" data-yw567-route="#sysop">Sysop</a></li></ul>
 </details></div></div></body></html>`}));
 await page.goto('http://yw568.test');
 await page.evaluate((ids)=>{
  let signedIn=true;
  window.__568Signout=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.__568Proof={
   company_id:ids.company,request_id:ids.request,provider_verified_receipt_id:ids.receipt,
   case_version:5,canonical_sha256:'a'.repeat(64),
   company_scope_only:true,read_only:true,source_only_not_continuous_uptime:true,
   master_owner_acceptance:false,master_connected:false,customer_message_sent:false,
   recipient_delivery_independently_verified:false,
   source_reconciliation_id:ids.reconciliation,source_reopen_id:ids.reopen,
   latest_source_remediation_audit_id:ids.audit,
   source_reopened_at:'2026-11-14T09:00:00Z',
   master_observation_id:ids.observation,master_observation_verified_at:'2026-11-14T10:00:00Z',
   source_receipt_stale:false,signed_risk_after_reconciliation:false,
   source_sla_breached:false,source_sla_state:'WITHIN_TARGET',
   remediation_audit_current:true,independent_source_remediation_ready:false,
   remediation_classification:'SOURCE_REMEDIATION_AUDITED_MASTER_HOLD'
  };
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:ids.user}})};
  window.YWNavigationAcceptance566={isOffered:route=>route==='#jobs'};
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:ids.user}},error:null})},
   from(table){
    if(table!=='ywi_companies')throw Error('No other data surface allowed');
    const q={select(){return q},eq(){return q},async limit(){
     return {error:null,data:[{id:ids.company,owner_user_id:ids.user}]}};
    }};return q;
   },
   async rpc(name){
    if(name!=='ywi_rpc_landscape_master_remediation_review_567')
     throw Error('No source writes or Master calls allowed');
    return {error:null,data:{...window.__568Proof}};
   }
  };
 },{user,company,request,receipt,reconciliation,reopen,audit,observation});
 await page.addScriptTag({content:script});
}
for(const width of [390,768,1440]){
 test('YW568 read-only verified owner audit, SLA, and accepted accessible route at '+width+'px',async({page})=>{
  await setup(page,width);
  await page.locator('#owner568Refresh').click();
  await expect(page.locator('#owner568Status')).toContainText('SOURCE_RESOLUTION_VERIFIED_MASTER_HOLD');
  await expect(page.locator('#owner568Status')).toContainText('Master CONNECTED');
  await page.locator('#owner568NavCheck').click();
  await expect(page.locator('#owner568NavStatus')).toContainText('LOCAL NAVIGATION CHECK PASS');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW568 new signed risk, stale evidence and SLA regression never count as resolution',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{window.__568Proof.signed_risk_after_reconciliation=true;});
 await page.locator('#owner568Refresh').click();
 await expect(page.locator('#owner568Status')).toContainText('REOPEN_REQUIRED');
 await page.evaluate(()=>{window.__568Proof.signed_risk_after_reconciliation=false;window.__568Proof.source_sla_breached=true;});
 await page.locator('#owner568Refresh').click();
 await expect(page.locator('#owner568Status')).toContainText('SLA_RECOVERY_HOLD');
 await page.evaluate(()=>{window.__568Proof.source_sla_breached=false;window.__568Proof.source_receipt_stale=true;});
 await page.locator('#owner568Refresh').click();
 await expect(page.locator('#owner568Status')).toContainText('HOLD_UNVERIFIED_SOURCE');
});
test('YW568 revoked route, changed theme, signout and selection invalidate prior monitoring',async({page})=>{
 await setup(page);
 await page.locator('#owner568Refresh').click();
 await expect(page.locator('#owner568Status')).toContainText('SOURCE_RESOLUTION_VERIFIED_MASTER_HOLD');
 await page.locator('#owner568Receipt').dispatchEvent('change');
 await expect(page.locator('#owner568Status')).toContainText('HOLD');
 await page.locator('#yw565Command li[hidden]').evaluate(el=>el.hidden=false);
 await page.locator('#owner568NavCheck').click();
 await expect(page.locator('#owner568NavStatus')).toContainText('ACCESSIBILITY REGRESSION HOLD');
 await page.evaluate(()=>{document.documentElement.dataset.ywTheme='standard';document.dispatchEvent(new Event('yw:theme-changed'));});
 await expect(page.locator('#owner568NavStatus')).toContainText('HOLD');
 await page.evaluate(()=>window.__568Signout());
 await expect(page.locator('#owner568Status')).toContainText('HOLD');
 await page.locator('#owner568Refresh').click();
 await expect(page.locator('#owner568Status')).toContainText('HOLD');
});
