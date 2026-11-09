import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const script=fs.readFileSync('js/company-booking-catalogue-551.js','utf8');
const stamp='2026-11-08T00:00:00Z';
const item=(changes={})=>({id:'item-1',company_id:'company-1',code:'lawn-mow',item_type:'service',
 name:'Lawn mowing',description:'',unit:'visit',base_price_cents:7500,
 spring_price_cents:6500,summer_price_cents:null,fall_price_cents:8500,winter_price_cents:null,
 active:true,created_at:stamp,updated_at:stamp,...changes});
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="settings"></div><div id="admin"></div></body></html>');
 await page.evaluate(({opts,stamp})=>{
  let authenticated=!opts.signedOut;
  const row={id:'item-1',company_id:opts.badItemTenant?'company-2':'company-1',code:'lawn-mow',item_type:'service',
    name:'Lawn mowing',description:'',unit:'visit',base_price_cents:7500,spring_price_cents:6500,
    summer_price_cents:null,fall_price_cents:8500,winter_price_cents:null,active:true,created_at:stamp,updated_at:stamp};
  const disposal={...row,id:'item-2',code:'dump-fee',name:'Disposal/dump fee',item_type:'disposal',unit:'load',base_price_cents:2000,spring_price_cents:null,fall_price_cents:null};
  window.__reads=[];window.__writes=[];window.__signOut=()=>{authenticated=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:authenticated,user:{id:'owner-1'}})};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner-1'}}})},from(table){
   const query={table,filters:[],mode:'read',payload:null};window.__reads.push(query);
   const api={
    select(){return this},eq(k,v){query.filters.push([k,v]);return this},order(){return this},
    update(payload){query.mode='update';query.payload=payload;window.__writes.push(query);return this},
    insert(payload){query.mode='insert';query.payload=payload;window.__writes.push(query);return this},
    limit(){return Promise.resolve(read())},then(resolve,reject){return Promise.resolve(read()).then(resolve,reject)}
   };
   function read(){
    if(table==='ywi_companies')return {data:[{id:'company-1',name:'Rosevear Landscaping',owner_user_id:opts.badOwner?'owner-2':'owner-1'}],error:null};
    if(table==='ywi_company_service_modules')return {data:[{company_id:'company-1',module_key:'landscape',enabled:!opts.landscapeDisabled}],error:null};
    if(table==='ywi_company_booking_catalogue_551'){
     if(query.mode==='insert'||query.mode==='update')return {data:[{...row,...query.payload}],error:null};
     return {data:[row,disposal],error:null};
    }
    return {data:[],error:null};
   }
   return api;
  }};
 },{opts,stamp});
 await page.addScriptTag({content:script});
 await expect(page.locator('#settings #owner551')).toHaveCount(1);
 await expect(page.locator('#admin #owner551')).toHaveCount(0);
 await page.locator('#owner551 summary').click();
 await page.locator('#owner551Refresh').click();
}
test('owner catalogue previews seasonal price and separated dump fees without writes',async({page})=>{
 await setup(page);
 await expect(page.locator('#owner551Status')).toContainText('2 owner-scoped entries');
 await page.locator('#owner551Season').selectOption('spring');
 await page.locator('[data-owner551-quantity="lawn-mow"]').fill('2');
 await page.locator('[data-owner551-quantity="dump-fee"]').fill('1');
 await expect(page.locator('#owner551Total')).toContainText('$150.00');
 await expect(page.locator('#owner551Total')).toContainText('disposal/dump fees: $20.00');
 expect(await page.evaluate(()=>window.__writes.length)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('company owner can stage a new fee but cannot silently book or charge',async({page})=>{
 await setup(page);
 await page.locator('#owner551New').click();
 await page.locator('#owner551Code').fill('leaf-bag');
 await page.locator('#owner551Name').fill('Leaf bags');
 await page.locator('#owner551Type').selectOption('disposal');
 await page.locator('#owner551Unit').selectOption('bag');
 await page.locator('#owner551Base').fill('7.50');
 await page.locator('#owner551fall').fill('8.25');
 await page.locator('#owner551Save').click();
 await expect(page.locator('#owner551Status')).toContainText('owner-scoped entries');
 const writes=await page.evaluate(()=>window.__writes.map(({table,mode,payload})=>({table,mode,payload})));
 expect(writes).toHaveLength(1);
 expect(writes[0].table).toBe('ywi_company_booking_catalogue_551');
 expect(writes[0].mode).toBe('insert');
 expect(writes[0].payload).toMatchObject({company_id:'company-1',item_type:'disposal',base_price_cents:750,fall_price_cents:825});
});
test('disabled landscaping permits owner drafts but blocks bookable preview',async({page})=>{
 await setup(page,{landscapeDisabled:true});
 await expect(page.locator('#owner551Total')).toContainText('No bookable items');
 await expect(page.locator('[data-owner551-quantity]')).toHaveCount(0);
});
test('cross-company row and unverified ownership withhold catalogue',async({page})=>{
 await setup(page,{badItemTenant:true});
 await expect(page.locator('#owner551Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner551-quantity]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__writes.length)).toBe(0);
});
test('signed-out session cannot load company pricing',async({page})=>{
 await setup(page,{signedOut:true});
 await expect(page.locator('#owner551Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes.length)).toBe(0);
});
