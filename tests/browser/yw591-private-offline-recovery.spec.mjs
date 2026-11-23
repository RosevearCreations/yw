import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/yw591-private-recovery.js','utf8');
const css=readFileSync('public/yw591-private-recovery.css','utf8');
const C='03bcf48e-a4f5-4427-9aba-b0f91f39b16b';
const uuid=n=>'59100000-0000-4591-8591-'+String(n).padStart(12,'0');
const ACTOR=uuid(3),JOB=uuid(22),REQ=uuid(25),STAFF=uuid(4),CLIENT=uuid(20),SITE=uuid(21),REVIEWER=uuid(2);
const photo=new Uint8Array([137,80,78,71,13,10,26,10,...Array(56).fill(3)]);
async function mount(page,{signed=true,offline=false,reviewer=false}={}){
 await page.route('http://localhost:48765/**',route=>route.fulfill({
  status:200,contentType:'text/html',
  body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="jobs"></section></body></html>'}));
 await page.goto('http://localhost:48765/yw591-fixture');
 await page.addStyleTag({content:css});
 await page.evaluate(({actor,signed,offline,reviewer})=>{
  window.__yw591Calls=[];window.__networkOnline=!offline;
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>window.__networkOnline});
  window.YWI_AUTH={getState:()=>({isAuthenticated:signed,user:{id:actor},role:'employee'})};
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
   functions:{invoke:async(_slug,{body})=>{
    const action=body instanceof FormData?body.get('action'):body.action;
    const item={action,companyId:body instanceof FormData?body.get('companyId'):body.companyId,
     jobId:body instanceof FormData?body.get('jobId'):body.jobId,
     requestId:body instanceof FormData?body.get('requestId'):body.requestId,
     mime:body instanceof FormData?body.get('photo')?.type:null,
     approvedRole:body?.staffRole};
    window.__yw591Calls.push(item);
    if(action==='pilot-status')return {data:{state:'APPROVED',pilotApproved:true,role:'crew'},error:null};
    if(action==='pilot-propose')return {data:{state:'PROPOSED',reviewerActionRequired:true},error:null};
    if(action==='staff-approve')return {data:{state:'STAFF_APPROVED'},error:null};
    if(action==='capture')return {data:{state:'PRIVATE_NEW_OBJECT_VERIFIED',serverVerified:true,
      companyBound:item.companyId,requestId:item.requestId,verifiedByteCount:64},error:null};
    if(action==='resume')return {data:{state:'PRIVATE_OBJECT_MISSING_RETRY_ORIGINAL_ENCRYPTED_PHOTO',
      serverVerified:false,requestId:item.requestId},error:null};
    return {data:{state:'HOLD',code:'SOURCE_OWNER_APPROVAL_REQUIRED'},error:null};
   }}
  };
 },{actor:ACTOR,signed,offline,reviewer});
 await page.addScriptTag({content:ui});
 await page.locator('#yw591Panel').evaluate(el=>el.open=true);
 await page.locator('#yw591Company').fill(C);
 await page.locator('#yw591Job').fill(JOB);
 await page.locator('#yw591Request').fill(REQ);
}
async function chooseFile(page){
 await page.locator('#yw591File').setInputFiles({name:'original.png',mimeType:'image/png',buffer:Buffer.from(photo)});
}
for(const width of [390,768,1440]){
 test('YW591 responsive original pilot console and independent controls '+width,async({page})=>{
  await page.setViewportSize({width,height:860});await mount(page);
  await expect(page.locator('#yw591File')).toHaveAttribute('capture','environment');
  await expect(page.locator('#yw591Offline')).not.toBeChecked();
  await page.locator('#yw591StatusBtn').click();
  await expect(page.locator('#yw591Result')).toContainText('pilotApproved: true');
  const over=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
 });
}
test('YW591 explicit AES-GCM offline consent and manual authenticated reconnect delivery',async({page})=>{
 await mount(page,{offline:true});await chooseFile(page);
 await page.locator('#yw591Consent').check();await page.locator('#yw591Offline').check();
 await page.locator('#yw591Capture').click();
 await expect(page.locator('#yw591Status')).toContainText('encrypted on this device');
 const result=await page.evaluate(async()=>{
  const d=await new Promise((resolve,reject)=>{const x=indexedDB.open('yw591-private-encrypted-photo-v1',1);
   x.onsuccess=()=>resolve(x.result);x.onerror=()=>reject(new Error('IDB'));});
  const x=await new Promise((resolve,reject)=>{const r=d.transaction('secure','readonly').objectStore('secure').get('pending');
   r.onsuccess=()=>resolve(r.result.value);r.onerror=()=>reject(new Error('IDB read'));});
  return {sha:x.sha256,actor:x.actorId,mime:x.mime,request:x.requestId,
   ciphertextSize:x.ciphertext.byteLength,nonceLength:x.nonce.length,
   calls:window.__yw591Calls.length};
 });
 expect(result.actor).toBe(ACTOR);expect(result.request).toBe(REQ);
 expect(result.mime).toBe('image/png');expect(result.nonceLength).toBe(12);
 expect(result.ciphertextSize).toBeGreaterThan(photo.length);
 expect(result.calls).toBe(0);expect(result.sha).toMatch(/^[0-9a-f]{64}$/);
 await page.evaluate(()=>{window.__networkOnline=true;window.dispatchEvent(new Event('online'));});
 await page.locator('#yw591Send').click();
 await expect(page.locator('#yw591Status')).toContainText('Verified private server hash');
 const post=await page.evaluate(async()=>{
  const d=await new Promise(resolve=>{const r=indexedDB.open('yw591-private-encrypted-photo-v1');r.onsuccess=()=>resolve(r.result);});
  const pending=await new Promise(resolve=>{const r=d.transaction('secure','readonly').objectStore('secure').get('pending');r.onsuccess=()=>resolve(r.result);});
  return {pending,actions:window.__yw591Calls.map(x=>x.action),mime:window.__yw591Calls[0]?.mime};
 });
 expect(post.pending).toBeUndefined();expect(post.actions).toEqual(['capture']);expect(post.mime).toBe('image/png');
});
test('YW591 signed-out identity refuses remote owner pilot request',async({page})=>{
 await mount(page,{signed:false});
 await page.locator('#yw591Client').fill(CLIENT);await page.locator('#yw591Site').fill(SITE);
 await page.locator('#yw591Reviewer').fill(REVIEWER);
 await page.locator('#yw591Propose').click();
 await expect(page.locator('#yw591Status')).toContainText('HOLD');
 expect(await page.evaluate(()=>window.__yw591Calls.length)).toBe(0);
});
test('YW591 staff approval includes selected dispatcher role and requires existing UUID',async({page})=>{
 await mount(page);await page.locator('#yw591Staff').fill(STAFF);
 await page.locator('#yw591StaffRole').selectOption('dispatcher');
 await page.locator('#yw591StaffApprove').click();
 await expect(page.locator('#yw591Status')).toContainText('STAFF_APPROVED');
 expect(await page.evaluate(()=>window.__yw591Calls.at(-1).approvedRole)).toBe('dispatcher');
});
test('YW591 logout purges encrypted photo and encryption key, no automatic network send',async({page})=>{
 await mount(page,{offline:true});await chooseFile(page);
 await page.locator('#yw591Consent').check();await page.locator('#yw591Offline').check();
 await page.locator('#yw591Capture').click();
 await expect(page.locator('#yw591Status')).toContainText('encrypted on this device');
 await page.evaluate(()=>document.dispatchEvent(new Event('ywi:auth-changed')));
 await expect(page.locator('#yw591Status')).toContainText('Current session revoked');
 await expect(page.locator('#yw591Consent')).not.toBeChecked();
 await expect.poll(()=>page.evaluate(async()=>{
  const d=await new Promise(resolve=>{const r=indexedDB.open('yw591-private-encrypted-photo-v1');r.onsuccess=()=>resolve(r.result);});
  return new Promise(resolve=>{const tx=d.transaction('secure','readonly'),s=tx.objectStore('secure');
   const p=s.get('pending'),k=s.get('key');tx.oncomplete=()=>resolve(!p.result&&!k.result);});
 })).toBe(true);
 expect(await page.evaluate(()=>window.__yw591Calls.length)).toBe(0);
});
