import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {company,companyId,ownerId,fixture} from '../fixtures/live-field-trial-integrity-441.mjs';
const js=readFileSync('js/live-field-trial-integrity-441.js','utf8');
async function setup(page,options={}){
 const {directory,detail}=fixture(options.service||'landscape');
 if(options.emptyJobs){directory.orders=[];directory.scoped_order_count=0;}
 if(options.foreignSource){directory.company_id='a4410000-0000-4441-8441-000000000002';}
 if(options.zeroField)detail.coverage.specialist_receipts=0;
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(({options,directory,detail,company,ownerId})=>{
  window.__calls=[];window.__writes=[];window.__signedOut=!!options.signedOut;
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId}})};
  const read=value=>({data:value,error:null});
  window.YWI_SB={auth:{getUser:async()=>read({user:{id:options.badSession?'other-user':ownerId}})},
   from(table){window.__calls.push(table);return {
    select(){return this},order(){return this},eq(){return this},
    limit(){return Promise.resolve(read(table==='ywi_companies'?
     options.noCompanies?[]:[{...company,owner_user_id:options.foreignOwner?'another-owner':ownerId}]:[]))},
    insert(){window.__writes.push('insert')},update(){window.__writes.push('update')},
    delete(){window.__writes.push('delete')},upsert(){window.__writes.push('upsert')}};},
   rpc:async(name,args)=>{window.__calls.push(name);
    if(options.denied)return{data:null,error:{message:'denied'}};
    if(name==='ywi_rpc_live_field_trial_integrity_441')
     return read(args.p_work_order_id?detail:directory);
    return{data:null,error:{message:'unexpected RPC'}};}};
 },{options,directory,detail,company,ownerId});
 await page.addScriptTag({content:js});
 await page.locator('#owner441 summary').click();
 await page.locator('#owner441Refresh').click();
}
test('Yard Rosevear synthetic owner sees six-service original sources and honest HOLD at 390px',async({page})=>{
 await setup(page);
 await expect(page.locator('#owner441Status')).toContainText('HOLD');
 await expect(page.locator('#owner441Status')).toContainText('Lawn Care');
 await expect(page.locator('#owner441Results')).toContainText('Original execution proofs: 1');
 await expect(page.locator('#owner441Results')).toContainText('Independent owner/field acceptance');
 await expect(page.locator('#owner441Results')).not.toContainText('approved');
 await expect(page.locator('#owner441 a[href="/help.html#live-trial-integrity-441"]')).toBeVisible();
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('six distinct services remain separate and missing specialist receipt stays HOLD',async({page})=>{
 for(const service of ['landscape','construction','water_parks','snow_removal','snow_plowing','septic']){
  await setup(page,{service,zeroField:true});
  await expect(page.locator('#owner441Status')).toContainText('HOLD');
  await expect(page.locator('#owner441Results')).toContainText('specialist field receipts: 0');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('no Production owner company remains HOLD, with synthetic Yard Rosevear clearly identified',async({page})=>{
 await setup(page,{noCompanies:true});
 await expect(page.locator('#owner441Status')).toContainText('HOLD: no registered company');
 await expect(page.locator('#owner441Status')).toContainText('Synthetic Yard Rosevear');
 expect(await page.evaluate(()=>window.__calls)).not.toContain('ywi_rpc_live_field_trial_integrity_441');
});
test('identity mismatch, foreign tenant, denied RPC and signed out states are WITHHELD',async({page})=>{
 for(const options of [{foreignOwner:true},{foreignSource:true},{badSession:true},{denied:true},{signedOut:true}]){
  await setup(page,options);
  await expect(page.locator('#owner441Status')).toContainText('WITHHELD');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});
test('owner signout clears original tenant evidence and cannot re-fetch',async({page})=>{
 await setup(page);
 await expect(page.locator('#owner441Results')).toContainText('Original execution proofs');
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new CustomEvent('ywi:auth-changed'));});
 await expect(page.locator('#owner441Results')).toBeEmpty();
 await page.locator('#owner441Refresh').click();
 await expect(page.locator('#owner441Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
