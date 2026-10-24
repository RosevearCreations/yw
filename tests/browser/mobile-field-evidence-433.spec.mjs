import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/mobile-field-evidence-433.js','utf8');
const owner='11111111-1111-4111-8111-111111111111';
const another='22222222-2222-4222-8222-222222222222';
const job='33333333-3333-4333-8333-333333333333';
const dispatch='44444444-4444-4444-8444-444444444444';
const server=(profile=owner)=>({ok:true,profile:{id:profile},meta:{assignment_filtered:true},my_route:[
  {dispatch:{id:dispatch,schedule_status:'scheduled'},work_order:{id:job,work_order_number:'WO-433'}}]});
async function boot(page,profile=owner){
  await page.setViewportSize({width:390,height:860});
  await page.route('https://yw-433.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<html><body><section id="today"></section></body></html>'}));
  await page.goto('https://yw-433.test/');
  await page.evaluate(({owner,server})=>{
    window.__profile=owner;window.__fetches=0;
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,profile:{id:window.__profile}})};
    window.YWIAPI={fetchMobileCrewContext:async()=>{window.__fetches++;return server;}};
  },{owner:profile,server:server(profile)});
  await page.addScriptTag({content:source});
  await page.locator('#field433').evaluate(panel=>{panel.open=true;});
}
test('phone capture stays local, deduplicates, persists across a page refresh, and never calls upload',async({page})=>{
  await boot(page);
  await page.locator('#field433Refresh').click();
  await page.locator('#field433Order').selectOption(dispatch);
  await page.locator('#field433File').setInputFiles({name:'site.jpg',mimeType:'image/jpeg',buffer:Buffer.from('field photo proof')});
  await page.locator('#field433Save').click();
  await expect(page.locator('#field433Items article')).toHaveCount(1);
  await expect(page.locator('#field433Items')).toContainText('LOCAL ONLY');
  await expect(page.locator('#field433Items button').first()).toBeDisabled();
  await page.locator('#field433File').setInputFiles({name:'same-photo.jpg',mimeType:'image/jpeg',buffer:Buffer.from('field photo proof')});
  await page.locator('#field433Save').click();
  await expect(page.locator('#field433Items article')).toHaveCount(1);
  await expect(page.locator('#field433Status')).toContainText('Existing intent retained');
  await page.reload();
  await page.evaluate(({owner,server})=>{window.__profile=owner;window.YWI_AUTH={getState:()=>({isAuthenticated:true,profile:{id:owner}})};
    window.YWIAPI={fetchMobileCrewContext:async()=>server};},{owner,server:server()});
  await page.addScriptTag({content:source});
  await page.locator('#field433').evaluate(panel=>{panel.open=true;});
  await expect(page.locator('#field433Items article')).toHaveCount(1);
  await expect(page.locator('#field433Items')).toContainText('LOCAL ONLY');
});
test('foreign profile cannot view captured files and missing canonical upload adapter forbids replay',async({page})=>{
  await boot(page);
  await page.locator('#field433Refresh').click();await page.locator('#field433Order').selectOption(dispatch);
  await page.locator('#field433File').setInputFiles({name:'gate.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF mock')});
  await page.locator('#field433Save').click();
  const result=await page.evaluate(async()=>{
    const id=(await window.YWI433.owned())[0].id;
    try{await window.YWI433.replay(id);return 'UNSAFE';}catch(e){return e.message;}
  });
  expect(result).toContain('idempotent canonical proof-media upload endpoint');
  await page.evaluate(other=>{window.__profile=other;document.dispatchEvent(new Event('ywi:auth-changed'));},another);
  await expect(page.locator('#field433Items article')).toHaveCount(0);
  expect(await page.evaluate(()=>window.YWI433.owned())).toEqual([]);
});
test('only matching original canonical receipt can confirm, never an uncertain network response',async({page})=>{
  await boot(page);await page.locator('#field433Refresh').click();await page.locator('#field433Order').selectOption(dispatch);
  await page.locator('#field433File').setInputFiles({name:'site.png',mimeType:'image/png',buffer:Buffer.from('photo 433')});
  await page.locator('#field433Save').click();
  const result=await page.evaluate(async()=>{
    const row=(await window.YWI433.owned())[0];
    const receipt={ok:true,canonical_source:'work_order_execution_proof_media',
      receipt_id:'55555555-5555-4555-8555-555555555555',execution_proof_id:'66666666-6666-4666-8666-666666666666',
      visual_asset_id:'77777777-7777-4777-8777-777777777777',owner_profile_id:row.owner_id,
      work_order_id:row.work_order_id,intent_key:row.id,content_sha256:row.sha256,verified:true};
    let rejected=false;try{await window.YWI433.acceptServerReceipt(row.id,{...receipt,owner_profile_id:'foreign'});}catch{rejected=true;}
    const before=(await window.YWI433.owned())[0].state;
    await window.YWI433.acceptServerReceipt(row.id,receipt);
    const after=(await window.YWI433.owned())[0];
    return {rejected,before,after:after.state,blob:after.file,receipt_id:after.receipt_id};
  });
  expect(result.rejected).toBe(true);expect(result.before).toBe('local_only');
  expect(result.after).toBe('confirmed');expect(result.blob).toBe(null);
});
test('uncertain delivery reconciles by original intent before retrying the binary',async({page})=>{
  await boot(page);await page.locator('#field433Refresh').click();await page.locator('#field433Order').selectOption(dispatch);
  await page.locator('#field433File').setInputFiles({name:'crew.webp',mimeType:'image/webp',buffer:Buffer.from('field safety photo')});
  await page.locator('#field433Save').click();
  const result=await page.evaluate(async()=>{
    const row=(await window.YWI433.owned())[0],calls=[];
    const receipt={ok:true,canonical_source:'work_order_execution_proof_media',
      receipt_id:'55555555-5555-4555-8555-555555555555',execution_proof_id:'66666666-6666-4666-8666-666666666666',
      visual_asset_id:'77777777-7777-4777-8777-777777777777',owner_profile_id:row.owner_id,
      work_order_id:row.work_order_id,intent_key:row.id,content_sha256:row.sha256,verified:true};
    let known=false;
    const adapter={
      lookupFieldEvidenceIntent433:async args=>{calls.push({type:'lookup',key:args.intent_key});return known?{...receipt,found:true}:
        {found:false,verified_not_found:true,owner_profile_id:row.owner_id,work_order_id:row.work_order_id,intent_key:row.id};},
      uploadFieldEvidenceIdempotent433:async args=>{calls.push({type:'upload',key:args.intent_key});known=true;throw Error('response dropped after server write');}
    };
    let uncertain=false;try{await window.YWI433.replay(row.id,adapter);}catch{uncertain=true;}
    const local=(await window.YWI433.owned())[0];
    const again=await window.YWI433.replay(row.id,adapter);
    return {uncertain,state:local.state,attempts:local.attempts,again,calls};
  });
  expect(result.uncertain).toBe(true);expect(result.state).toBe('uncertain');expect(result.attempts).toBe(1);
  expect(result.again.reconciled).toBe(true);
  expect(result.calls.map(x=>x.type)).toEqual(['lookup','upload','lookup']);
  expect(new Set(result.calls.map(x=>x.key)).size).toBe(1);
});
