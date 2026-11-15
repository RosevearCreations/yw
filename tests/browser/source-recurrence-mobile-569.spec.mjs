import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source568=fs.readFileSync('js/landscape-resolution-568.js','utf8');
const source569=fs.readFileSync('js/source-recurrence-569.js','utf8');
const id=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const user=id(1),company=id(2),request=id(3),receipt=id(4);
const reconciled=id(5),reopen=id(6),audit=id(7),observation=id(8);
async function setup(page,width=390){
 await page.setViewportSize({width,height:900});
 await page.route('http://yw569.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html data-yw-theme="futuristic">
 <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
 <body><div id="owner567"><div class="admin-panel-block">
 <select id="owner567Company"><option value="${company}">Company</option></select>
 <select id="owner567Case"><option value="${request}">Case</option></select>
 <select id="owner567Receipt"><option value="${receipt}">Original receipt</option></select>
 </div></div><div id="owner568"></div>
 <div id="yw565Command"><p id="owner568NavStatus"></p>
 <details class="yw567-drilldown"><summary aria-label="Explore Jobs module destinations">Jobs</summary>
 <ul><li><a href="#jobs" data-yw567-route="#jobs">Jobs</a></li>
 <li hidden><a href="#sysop" data-yw567-route="#sysop">Sysop</a></li></ul>
 </details></div></body></html>`}));
 await page.goto('http://yw569.test');
 await page.evaluate(({user,company,request,receipt,reconciled,reopen,audit,observation})=>{
  const id=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
  const t=ago=>new Date(Date.now()-ago*3600000).toISOString();
  let signedIn=true;
  window.__569Logout=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:user}})};
  window.YWNavigationAcceptance566={isOffered:route=>route==='#jobs'};
  window.__569Source={
   company_id:company,request_id:request,provider_verified_receipt_id:receipt,
   case_version:5,canonical_sha256:'a'.repeat(64),
   company_scope_only:true,read_only:true,source_only_not_continuous_uptime:true,
   master_owner_acceptance:false,master_connected:false,customer_message_sent:false,
   recipient_delivery_independently_verified:false,
   source_reconciliation_id:reconciled,source_reopen_id:reopen,
   latest_source_remediation_audit_id:audit,source_reopened_at:t(2),
   master_observation_id:observation,master_observation_verified_at:t(0.5),
   source_receipt_stale:false,signed_risk_after_reconciliation:false,
   source_sla_breached:false,source_sla_state:'WITHIN_TARGET',
   remediation_audit_current:true,independent_source_remediation_ready:false,
   remediation_classification:'SOURCE_REMEDIATION_AUDITED_MASTER_HOLD',
   checked_at:t(0.001)
  };
  const entry=(number,action,hoursAgo,extra={})=>({
   id:id(number),idempotency_key:id(number+100),owner_user_id:user,
   company_id:company,request_id:request,provider_verified_receipt_id:receipt,
   case_version:5,action,recorded_at:t(hoursAgo),...extra
  });
  window.__569History=[
   entry(7,'audit_signed_source_remediation',1,{anchor_master_observation_id:observation}),
   entry(6,'record_signed_source_reopen',2),
   entry(9,'request_supervised_remediation_recheck',8)
  ];
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:user}},error:null})},
   from(table){
    const q={select(){return q},eq(){return q},order(){return q},async limit(){
     if(table==='ywi_companies')return {error:null,data:[{id:company,owner_user_id:user}]};
     if(table==='ywi_landscape_master_remediation_audits_567')
      return {error:null,data:[...window.__569History]};
     throw Error('No other source ledger permitted');
    }};return q;
   },
   async rpc(name){
    if(name!=='ywi_rpc_landscape_master_remediation_review_567')
     throw Error('No mutation or independent Master acceptance permitted');
    return {error:null,data:{...window.__569Source}};
   }
  };
 },{user,company,request,receipt,reconciled,reopen,audit,observation});
 await page.addScriptTag({content:source568});
 await page.addScriptTag({content:source569});
}
for(const width of [390,768,1440]){
 test('YW569 persisted owner audit and SLA trends stay responsive at '+width+'px',async({page})=>{
  await setup(page,width);
  await page.locator('#owner569Refresh').click();
  await expect(page.locator('#owner569Status')).toContainText('SOURCE_RECOVERY_OBSERVED_MASTER_HOLD');
  await page.locator('#owner569Details summary').click();
  await expect(page.locator('#owner569Metrics')).toContainText('Reopens in 7/30/90 days: 1/1/1');
  await expect(page.locator('#owner569Events li')).toHaveCount(3);
  await page.locator('#owner569NavCheck').click();
  await expect(page.locator('#owner569MobileStatus')).toContainText('LOCAL CONTINUITY PASS');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW569 repeat reopen escalates and a newer source breach never becomes a recovery claim',async({page})=>{
 await setup(page);
 await page.evaluate(()=>window.__569History.push({
  ...window.__569History[1],id:'00000010-1111-4111-8111-111111111111',
  idempotency_key:'00000110-1111-4111-8111-111111111111',
  recorded_at:new Date(Date.now()-24*3600000).toISOString()
 }));
 await page.locator('#owner569Refresh').click();
 await expect(page.locator('#owner569Status')).toContainText('REPEAT_REOPEN_REVIEW_MASTER_HOLD');
 await page.evaluate(()=>window.__569Source.source_sla_breached=true);
 await page.locator('#owner569Refresh').click();
 await expect(page.locator('#owner569Status')).toContainText('SLA_RECOVERY_HOLD');
});
test('YW569 audit and navigation fail closed on scope changes, route revocation, Standard Blue and signout',async({page})=>{
 await setup(page);
 await page.locator('#owner569Refresh').click();
 await expect(page.locator('#owner569Status')).toContainText('SOURCE_RECOVERY_OBSERVED_MASTER_HOLD');
 await page.locator('#owner567Receipt').dispatchEvent('change');
 await expect(page.locator('#owner569Status')).toContainText('HOLD');
 await page.locator('#owner569Details summary').click();
 await expect(page.locator('#owner569Events li')).toHaveCount(0);
 await page.locator('#yw565Command li[hidden]').evaluate(el=>el.hidden=false);
 await page.locator('#owner569NavCheck').click();
 await expect(page.locator('#owner569MobileStatus')).toContainText('HOLD');
 await page.evaluate(()=>{document.documentElement.dataset.ywTheme='standard';document.dispatchEvent(new Event('yw:theme-changed'));});
 await expect(page.locator('#owner569MobileStatus')).toContainText('HOLD');
 await page.evaluate(()=>window.__569Logout());
 await expect(page.locator('#owner569Status')).toContainText('HOLD');
 await page.locator('#owner569Refresh').click();
 await expect(page.locator('#owner569Status')).toContainText('HOLD');
});
