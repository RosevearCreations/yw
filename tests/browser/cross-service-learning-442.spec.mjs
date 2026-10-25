import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,company,ownerId} from '../fixtures/cross-service-learning-442.mjs';
const js=readFileSync('js/cross-service-learning-442.js','utf8');
async function setup(page,options={}){
 const data=fixture({count:options.zero?0:12,now:Date.now()});
 if(options.foreignPayload)data.company_id='a4420000-0000-4442-8442-000000000002';
 if(options.disabled)data.services[0].enabled=false;
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(({data,options,company,ownerId})=>{
  window.__calls=[];window.__writes=[];window.__signedOut=!!options.signedOut;
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId}})};
  const ok=value=>({data:value,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badSession?'other-user':ownerId}})},
   from(table){window.__calls.push(table);return {
    select(){return this},order(){return this},eq(){return this},
    limit(){return Promise.resolve(ok(table==='ywi_companies'?
     options.noCompany?[]:[{...company,owner_user_id:options.foreignOwner?'other-owner':ownerId}]:[]))},
    insert(){window.__writes.push('insert')},update(){window.__writes.push('update')},
    delete(){window.__writes.push('delete')},upsert(){window.__writes.push('upsert')}
   };},
   rpc:async(name,args)=>{window.__calls.push(name);
    if(options.denied)return {data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_cross_service_learning_442')return ok(data);
    return{data:null,error:{message:'unexpected RPC'}};}};
 },{data,options,company,ownerId});
 await page.addScriptTag({content:js});
 await page.locator('#owner442 summary').click();
 await page.locator('#owner442Refresh').click();
}
test('synthetic Yard Rosevear company admin reads six original services at 390px, not trial acceptance',async({page})=>{
 await setup(page);
 await expect(page.locator('#owner442Status')).toContainText('SOURCE COVERAGE ONLY');
 await expect(page.locator('[data-owner442-service]')).toHaveCount(6);
 await expect(page.locator('[data-owner442-service="landscape"]')).toContainText('Previous first Jobs: 12 · Current first Jobs: 12');
 await expect(page.locator('[data-owner442-service="snow_plowing"]')).toContainText('DESCRIPTIVE SOURCE ONLY');
 await expect(page.locator('#owner442 a[href="/help.html#cross-service-learning-442"]')).toBeVisible();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('zero real-like cohorts and disabled services remain HOLD',async({page})=>{
 await setup(page,{zero:true});
 await expect(page.locator('#owner442Status')).toContainText('HOLD');
 await expect(page.locator('[data-owner442-service="landscape"]')).toContainText('Fewer than ten');
 await setup(page,{disabled:true});
 await expect(page.locator('[data-owner442-service="landscape"]')).toContainText('Offering is currently OFF');
 await expect(page.locator('[data-owner442-service="septic"]')).toContainText('DESCRIPTIVE SOURCE ONLY');
});
test('no registered owner company shows genuine HOLD, not a simulated Production login',async({page})=>{
 await setup(page,{noCompany:true});
 await expect(page.locator('#owner442Status')).toContainText('HOLD: no real owner companies');
 await expect(page.locator('#owner442Status')).toContainText('synthetic test fixture');
 expect(await page.evaluate(()=>window.__calls)).not.toContain('ywi_rpc_cross_service_learning_442');
});
test('cross-tenant source, denied RPC, mismatched owner, signed-out fail closed',async({page})=>{
 for(const options of [{foreignPayload:true},{foreignOwner:true},{badSession:true},{denied:true},{signedOut:true}]){
  await setup(page,options);
  await expect(page.locator('#owner442Status')).toContainText('WITHHELD');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('signout clears company-level admin evidence and prevents fresh read',async({page})=>{
 await setup(page);
 await expect(page.locator('[data-owner442-service]')).toHaveCount(6);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new CustomEvent('ywi:auth-changed'));});
 await expect(page.locator('#owner442Results')).toBeEmpty();
 await page.locator('#owner442Refresh').click();
 await expect(page.locator('#owner442Status')).toContainText('WITHHELD');
});
