import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const source=readFileSync('js/yw590-original-field-certification.js','utf8');
const css=readFileSync('public/yw590-field-certification.css','utf8');
const actor='59000000-0000-4590-8590-000000000003';
const job='59000000-0000-4590-8590-000000000006';
const photo='59000000-0000-4590-8590-000000000007';
const challenge='59000000-0000-4590-8590-000000000020';
async function mount(page,{signed=true,sysop=false}={}){
 // localhost is a browser trustworthy context, so the REAL WebCrypto API
 // is present when the reviewer hashes the private photo. No fake digest.
 await page.route('http://localhost:48765/**',route=>route.fulfill({
  status:200,contentType:'text/html',
  body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="jobs"></section><section id="yw584Sysop"></section></body></html>'
 }));
 await page.goto('http://localhost:48765/yw590-test');
 await page.addStyleTag({content:css});
 await page.evaluate(({actor,job,photo,challenge,signed,sysop})=>{
  document.documentElement.dataset.ywSurface=sysop?'platform':'tenant';
  if(sysop)location.hash='#sysop';
  window.YWI_AUTH={getState:()=>({isAuthenticated:signed,user:{id:actor},role:'employee'})};
  window.YWIDualWorkspace={isSysopVerified:()=>sysop};
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
   functions:{invoke:async(name,{body})=>{
    if(name!=='yw589-original-device-photo')return {error:new Error('unknown endpoint')};
    if(body.action==='590:readiness')return {data:{state:'AWAITING_INDEPENDENT_ORIGINAL_DEVICE_WITNESS',
     originalPhotoCount:1,dispatcherSigned:true,originalPhotoId:photo,zeroInvoicesAtReadback:true},error:null};
    if(body.action==='590:crew-challenge')return {data:{state:'CREW_ORIGINAL_DEVICE_CHALLENGE_ISSUED',
     challengeId:challenge,challengeCode:'f'.repeat(32)},error:null};
    if(body.action==='590:witness-preview')return {data:new Blob([
      new Uint8Array([137,80,78,71,13,10,26,10,...Array(56).fill(9)])],{type:'image/png'}),error:null};
    if(body.action==='590:witness')return {data:{state:'HUMAN_DEVICE_WITNESS_RECORDED_AWAITING_SYSOP',
     humanAttestationRecorded:true,caseOpened:true},error:null};
    if(body.action==='590:shell-summary')return {data:{state:'REDACTED_TECHNICAL_COUNTS_ONLY',
     open:1,closed:0,total:1,masterDurableAckVerified:false},error:null};
    if(body.action==='590:close')return {data:{state:'ORIGINAL_CASE_CLOSED',
     pointInTimeFinanceIsolation:true,masterDurableAckVerified:false},error:null};
    return {data:{state:'HOLD',code:'NO_ORIGINAL_RECEIPT'},error:null};
   }}
  };
 },{actor,job,photo,challenge,signed,sysop});
 await page.addScriptTag({content:source});
}
for(const width of [390,768,1440]){
 test('YW590 responsive tenant ceremony without publicly disclosing bytes '+width,async({page})=>{
  await page.setViewportSize({width,height:900});await mount(page);
  await page.locator('#yw590Panel').evaluate(el=>el.open=true);
  await expect(page.locator('#yw590Panel')).toBeVisible();
  await expect(page.locator('#yw590TenantStatus')).toContainText('HOLD');
  await page.locator('#yw590Job').fill(job);await page.locator('#yw590Check').click();
  await expect(page.locator('#yw590Photo')).toHaveValue(photo);
  await page.locator('#yw590Issue').click();
  await expect(page.locator('#yw590ChallengeCode')).toContainText('ffffffff');
  const over=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
 });
}
test('YW590 witness requires preview and explicit original-device physical claim',async({page})=>{
 await mount(page);await page.locator('#yw590Panel').evaluate(el=>el.open=true);
 await page.locator('#yw590Job').fill(job);await page.locator('#yw590Photo').fill(photo);
 await page.locator('#yw590ChallengeInput').fill(challenge);
 await page.locator('#yw590CodeInput').fill('f'.repeat(32));
 await page.locator('#yw590Witness').click();
 await expect(page.locator('#yw590TenantStatus')).toContainText('must preview');
 await page.locator('#yw590Preview').click();
 await expect(page.locator('#yw590PrivatePreview')).toBeVisible();
 await page.locator('#yw590SawDevice').check();
 await page.locator('#yw590Examined').check();
 await page.locator('#yw590Witness').click();
 await expect(page.locator('#yw590TenantStatus')).toContainText('Human observation statement registered');
 await page.evaluate(()=>document.dispatchEvent(new Event('ywi:auth-changed')));
 await expect(page.locator('#yw590PrivatePreview')).toBeHidden();
 await expect(page.locator('#yw590ChallengeCode')).toHaveText('');
});
test('YW590 signed-out tenant cannot run original recovery lookup',async({page})=>{
 await mount(page,{signed:false});await page.locator('#yw590Panel').evaluate(el=>el.open=true);
 await page.locator('#yw590Job').fill(job);await page.locator('#yw590Check').click();
 await expect(page.locator('#yw590TenantStatus')).toContainText('HOLD');
 await expect(page.locator('#yw590TenantOutput')).toBeEmpty();
});
test('YW590 Sysop redacted case requires explicit independent final approval',async({page})=>{
 await mount(page,{sysop:true});
 await page.locator('#yw590ShellPanel').evaluate(el=>el.open=true);
 await page.locator('#yw590ShellSummary').click();
 await expect(page.locator('#yw590ShellOutput')).toContainText('open: 1');
 await page.locator('#yw590ShellJob').fill(job);
 await page.locator('#yw590ShellPhoto').fill(photo);
 await page.locator('#yw590Close').click();
 await expect(page.locator('#yw590ShellStatus')).toContainText('explicitly verify');
 await page.locator('#yw590SysopConfirm').check();
 await page.locator('#yw590NoNotice').check();
 await page.locator('#yw590Close').click();
 await expect(page.locator('#yw590ShellStatus')).toContainText('CLOSED');
 await expect(page.locator('#yw590ShellOutput')).not.toContainText('customer');
});
