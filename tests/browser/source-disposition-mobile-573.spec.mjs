import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source568=fs.readFileSync('js/landscape-resolution-568.js','utf8');
const source569=fs.readFileSync('js/source-recurrence-569.js','utf8');
const source570=fs.readFileSync('js/source-assurance-570.js','utf8');
const source571=fs.readFileSync('js/source-disposition-571.js','utf8');
const source572=fs.readFileSync('js/source-security-572.js','utf8');
const source573=fs.readFileSync('js/source-witness-573.js','utf8');
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
   latest_source_remediation_audit_id:audit,source_reopened_at:t(20),
   master_observation_id:observation,master_observation_verified_at:t(17),
   source_receipt_stale:false,signed_risk_after_reconciliation:false,
   source_sla_breached:false,source_sla_state:'WITHIN_TARGET',
   source_sla_due_at:t(-6),
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
   entry(7,'audit_signed_source_remediation',16,{anchor_master_observation_id:observation}),
   entry(6,'record_signed_source_reopen',20),
   entry(10,'record_signed_source_reopen',72),
   entry(9,'request_supervised_remediation_recheck',80)
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
 await page.addScriptTag({content:source570});
 await page.addScriptTag({content:source571});
 await page.addScriptTag({content:source572});
 await page.addScriptTag({content:source573});
}



for(const width of [360,390,768,1024,1440]){
 test('YW573 seven-app original signed closure witness and SLA outcome HOLD remains accessible at '+width+'px',async({page})=>{
  await setup(page,width);
  await page.locator('#owner573Refresh').click();
  await expect(page.locator('#owner573Status')).toContainText('SOURCE_READBACK_VERIFIED_WITNESS_QUORUM_PENDING_MASTER_HOLD');
  await page.locator('#owner573Details summary').click();
  await expect(page.locator('#owner573Result')).toContainText('Durable original disposition: NOT AUTHORIZED');
  await expect(page.locator('#owner573Result')).toContainText('Signed SLA recovery outcome: NOT ESTABLISHED');
  await expect(page.locator('#owner573Result')).toContainText('All three Master ACKs: HOLD');
  await expect(page.locator('#owner573Apps li')).toHaveCount(7);
  await expect(page.locator('#owner573Apps li').first()).toContainText('ai-data-platform');
  await expect(page.locator('#owner573Apps li').last()).toContainText('rosiedazzlers');
  await page.locator('#owner573NavCheck').click();
  await expect(page.locator('#owner573NavStatus')).toContainText('LOCAL NAVIGATION PASS');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW573 never treats stale SLA, forged witness claim or foreign owner as closure quorum',async({page})=>{
 await setup(page);
 await page.locator('#owner573Refresh').click();
 await expect(page.locator('#owner573Status')).toContainText('WITNESS_QUORUM_PENDING_MASTER_HOLD');
 await page.evaluate(()=>window.__569Source.source_sla_breached=true);
 await page.locator('#owner573Refresh').click();
 await expect(page.locator('#owner573Status')).toContainText('HOLD_ORIGINAL_SOURCE');
 await page.evaluate(()=>{window.__569Source.source_sla_breached=false;window.__569Source.company_id='00000019-1111-4111-8111-111111111111';});
 await page.locator('#owner573Refresh').click();
 await expect(page.locator('#owner573Status')).toContainText('HOLD_ORIGINAL_SOURCE');
});
test('YW573 revokes original source/disposition on scope, role, theme and signout',async({page})=>{
 await setup(page);
 await page.locator('#owner573Refresh').click();
 await expect(page.locator('#owner573Status')).toContainText('WITNESS_QUORUM_PENDING_MASTER_HOLD');
 await page.locator('#owner567Receipt').dispatchEvent('change');
 await expect(page.locator('#owner573Status')).toContainText('HOLD');
 await page.locator('#owner573Details summary').click();
 await expect(page.locator('#owner573Apps li')).toHaveCount(0);
 await page.locator('#yw565Command li[hidden]').evaluate(el=>el.hidden=false);
 await page.locator('#owner573NavCheck').click();
 await expect(page.locator('#owner573NavStatus')).toContainText('HOLD');
 await page.evaluate(()=>{document.documentElement.dataset.ywTheme='standard';document.dispatchEvent(new Event('yw:theme-changed'));});
 await expect(page.locator('#owner573NavStatus')).toContainText('HOLD');
 await page.evaluate(()=>window.__569Logout());
 await expect(page.locator('#owner573Status')).toContainText('HOLD');
 await page.locator('#owner573Refresh').click();
 await expect(page.locator('#owner573Status')).toContainText('HOLD');
});

test('YW573 static real product shell classification remains visible and separate from Master themes',async({page})=>{
 await setup(page);
 const html=fs.readFileSync('index.html','utf8');
 expect(html).toContain('SLAVE APPLICATION SHELL');
 expect(html).toContain('Yard Workers themes remain independent');
 await expect(page.locator('#owner573Apps li')).toHaveCount(0);
 await page.locator('#owner573Refresh').click();
 await page.locator('#owner573Details summary').click();
 await expect(page.locator('#owner573Apps li')).toHaveCount(7);
 await expect(page.locator('#owner573Apps')).toContainText('devilndove');
 await expect(page.locator('#owner573Apps')).toContainText('rosiedazzlers');
});
