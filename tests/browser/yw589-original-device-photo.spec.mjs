import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/yw589-original-device-pilot.js','utf8');
const css=readFileSync('public/yw589-original-device.css','utf8');
const actor='58900000-0000-4589-8589-000000000003';
const job='58900000-0000-4589-8589-000000000006';
const photo='58900000-0000-4589-8589-000000000008';
async function mount(page,{signed=true,grant=true}={}){
 await page.setContent('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="jobs"></section></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(({actor,job,photo,signed,grant})=>{
  document.documentElement.dataset.ywSurface='tenant';
  window.YWI_AUTH={getState:()=>({isAuthenticated:signed,user:{id:actor},role:'employee'})};
  window.YWISecurity={canViewModule:()=>true};
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
   functions:{invoke:async (_name,{body})=>{
    const action=body instanceof FormData?body.get('action'):body.action;
    if(action==='readiness')return {data:grant?{state:'ORIGINAL_DEVICE_CAPTURE_AUTHORIZED',
     approvedJobId:job,captureAllowed:true}: {state:'HOLD',code:'TWO_PARTY_PILOT_APPROVAL_HOLD'},error:null};
    if(action==='status')return {data:{state:'AWAITING_ORIGINAL_DEVICE_PHOTO',
     approvedJobId:job,photoCount:0},error:null};
    if(action==='review')return {data:new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'}),error:null};
    if(action==='confirm')return {data:{state:'ORIGINAL_DISPATCHER_SIGNOFF_RECORDED_EXTERNAL_WITNESS_PENDING',
      dispatcherSigned:true,externalWitnessStillRequired:true},error:null};
    return {data:{state:'HOLD',code:'SIMULATED_UPLOAD_UNAVAILABLE'},error:null};
   }}
  };
 },{actor,job,photo,signed,grant});
 await page.addScriptTag({content:ui});
}
for(const width of [390,768,1440]){
 test('YW589 mobile camera field + server HOLD and responsive fit '+width,async({page})=>{
  await page.setViewportSize({width,height:860});await mount(page,{grant:false});
  await expect(page.locator('#yw589DevicePanel')).toBeVisible();
  await expect(page.locator('#yw589File')).toHaveAttribute('capture','environment');
  await expect(page.locator('#yw589File')).toHaveAttribute('accept','image/jpeg,image/png,image/webp');
  await page.locator('#yw589Job').fill(job);
  await page.locator('#yw589Readiness').click();
  await expect(page.locator('#yw589Status')).toContainText('TWO_PARTY_PILOT_APPROVAL_HOLD');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
 });
}
test('YW589 current authenticated Jobs crew can inspect original approved readiness',async({page})=>{
 await mount(page);
 await page.locator('#yw589Job').fill(job);await page.locator('#yw589Readiness').click();
 await expect(page.locator('#yw589Status')).toContainText('Original authenticated job');
 await expect(page.locator('#yw589Outcome')).toContainText('captureAllowed: true');
});
test('YW589 unauthorized or logged-out actor cannot call capture service',async({page})=>{
 await mount(page,{signed:false});
 await page.locator('#yw589Job').fill(job);await page.locator('#yw589Readiness').click();
 await expect(page.locator('#yw589Status')).toContainText('HOLD');
 await expect(page.locator('#yw589Outcome')).toBeEmpty();
});
test('YW589 dispatcher first previews original private image before own sign-off',async({page})=>{
 await mount(page);
 await page.locator('#yw589Job').fill(job);await page.locator('#yw589Receipt').fill(photo);
 await page.locator('#yw589DispatcherAttest').check();
 await page.locator('#yw589Confirm').click();
 await expect(page.locator('#yw589Status')).toContainText('first open and review');
 await page.locator('#yw589Review').click();
 await expect(page.locator('#yw589PhotoPreview')).toBeVisible();
 await page.locator('#yw589Confirm').click();
 await expect(page.locator('#yw589Status')).toContainText('independent field witness');
 await page.evaluate(()=>document.dispatchEvent(new Event('ywi:auth-changed')));
 await expect(page.locator('#yw589PhotoPreview')).toBeHidden();
});
