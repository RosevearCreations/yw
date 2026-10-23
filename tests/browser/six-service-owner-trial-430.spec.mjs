import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/six-service-owner-trial-430.js','utf8');
const services=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(({opts,services})=>{
  const company='company-1',uid='owner-1';window.__reads=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:uid}})};
  const history={company_id:company,client_id:'customer-1',legacy_unscoped_excluded:!opts.unscoped,
   history_limit_per_type:80,properties:[{id:'site-1',name:'Real site'}],estimates:[],
   work_orders:[{id:'job-1',property_id:'site-1',service:'landscape',created_at:new Date().toISOString()}]};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:uid}}})},
   from(table){window.__reads.push(table);return {select(){return this},order(){return this},eq(){return this},
    limit(){const data=table==='ywi_companies'?[{id:company,name:'Real company',owner_user_id:opts.foreign?'other':uid}]:
     services.map(module_key=>({company_id:company,module_key,enabled:module_key!=='septic'}));return Promise.resolve({data,error:null});}}},
   rpc:async(method,args)=>{window.__reads.push(method);return {data:method==='ywi_rpc_company_customers_422'? (opts.empty?[]:[{id:'customer-1',name:'Actual customer',is_active:true}]):
    opts.crossTenant?{...history,company_id:'other'}:history,error:null};}};
 },{opts,services});
 await page.addScriptTag({content:source});await page.locator('#owner430 summary').click();
 await page.locator('#owner430Refresh').click();
}
test('phone owner workflow uses original data, never auto-creates a first job',async({page})=>{
 await setup(page);
 await expect(page.locator('[data-owner430-service]')).toHaveCount(6);
 await expect(page.locator('[data-owner430-service="septic"]')).toContainText('DISABLED');
 await expect(page.locator('#owner430Status')).toContainText('Every service still requires');
 await page.locator('#owner430Customer').selectOption('customer-1');
 await expect(page.locator('[data-owner430-service="landscape"]')).toContainText('job-1');
 await expect(page.locator('[data-owner430-service="landscape"]')).toContainText('REVIEW PENDING');
 await expect(page.locator('[data-owner430-service="construction"]')).toContainText('NEEDS WORK ORDER');
 expect(await page.evaluate(()=>window.__reads)).toEqual(expect.arrayContaining(['ywi_companies','ywi_company_service_modules',
  'ywi_rpc_company_customers_422','ywi_rpc_customer_history_422']));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('missing real company/customer is a guided HOLD, not fabricated success',async({page})=>{
 await setup(page,{empty:true});
 await expect(page.locator('[data-owner430-state="needs_customer"]')).toHaveCount(5);
 await expect(page.locator('#owner430Customer option')).toHaveCount(1);
});
test('foreign company and bad original history withhold all six services',async({page})=>{
 await setup(page,{foreign:true});
 await expect(page.locator('#owner430Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner430-service]')).toHaveCount(0);
 await setup(page,{crossTenant:true});
 await page.locator('#owner430Customer').selectOption('customer-1');
 await expect(page.locator('[data-owner430-state="withheld"]')).toHaveCount(6);
});
test('signed-out owner cannot read any company history',async({page})=>{
 await setup(page,{signedOut:true});
 await expect(page.locator('#owner430Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__reads)).toHaveLength(0);
});
test('help gives six-source handoff and no implied acceptance',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.setContent(fs.readFileSync('help.html','utf8'));
 const help=page.locator('#six-service-owner-trial-430');
 await expect(help).toContainText('Six specialist handoffs');
 await expect(help).toContainText('not proof that it was the first ever job');
 await expect(help).toContainText('This runbook never creates a customer');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
