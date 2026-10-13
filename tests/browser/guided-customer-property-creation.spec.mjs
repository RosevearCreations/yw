import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/admin-customer-property-crm-ui.js','utf8');
const customer='11111111-1111-4111-8111-111111111111',site='22222222-2222-4222-8222-222222222222';
function payload(){
 return {ok:true,crm_customers:[{client_id:customer,client_name:'Seasonal Example',legal_name:'Seasonal Example',billing_email:'existing@example.ca',phone:'555-0102',city:'London',is_active:true,crm_lifecycle_stage:'customer'}],
 crm_properties:[{id:site,client_id:customer,site_name:'Existing Yard',service_address:'10 Old Road',city:'London',postal_code:'N0N 1A0'}],
 crm_leads:[],crm_service_plans:[],crm_service_history:[],crm_interactions:[],crm_followups:[],crm_opportunities:[],crm_renewals:[],crm_cross_service_candidates:[]};
}
async function boot(page,custom={}){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(opts=>{
  window.__calls=[];window.__payload=opts.data;window.__manage=opts.manage||'ok';window.__hold=null;
  window.YWIAPI={loadAdminDirectory:async(req)=>{window.__calls.push({type:'load'});return structuredClone(window.__payload)},
    manageOperations:async(req)=>{window.__calls.push({type:'manage',req:structuredClone(req)});
      if(window.__manage==='deny')return {ok:false,error:'jobs module approve access is required'};
      if(window.__manage==='hold')await new Promise(resolve=>window.__hold=resolve);
      if(window.__manage==='missing_id')return {ok:true,record:{}};
      const id=req.action==='crm_client_save'?(req.id||'33333333-3333-4333-8333-333333333333'):(req.id||'44444444-4444-4444-8444-444444444444');
      if(req.action==='crm_client_save'){
       let row={client_id:id,client_name:req.legal_name,legal_name:req.legal_name,billing_email:req.billing_email,phone:req.phone,city:req.city,is_active:true};
       window.__payload.crm_customers=window.__payload.crm_customers.filter(c=>c.client_id!==id).concat(row);
      } else {
       let row={id,client_id:req.client_id,site_name:req.site_name,service_address:req.service_address,city:req.city,postal_code:req.postal_code};
       window.__payload.crm_properties=window.__payload.crm_properties.filter(c=>c.id!==id).concat(row);
      }
      return {ok:true,record:{id,client_id:req.action==='crm_client_save'?id:req.client_id}};
    }};}, {data:custom.data||payload(),manage:custom.manage||'ok'});
 await page.addScriptTag({content:source});await page.evaluate(()=>window.YWICustomerPropertyCRMUI.mount({api:window.YWIAPI}));
 await expect(page.locator('#crm392Guided')).toBeVisible();
}
test('392 guided phone customer create + property create each uses the canonical action exactly once',async({page})=>{
 await boot(page);
 await page.fill('#crm392LegalName','Maple Street Holdings');
 await page.fill('#crm392Email','maple@example.ca');
 await page.click('#crm392SaveCustomer');
 await expect(page.locator('#crm392CustomerStatus')).toContainText('Saved and CRM records reloaded');
 await page.selectOption('#crm392PropertyCustomer','33333333-3333-4333-8333-333333333333');
 await page.fill('#crm392SiteName','Maple Driveway');
 await page.fill('#crm392Address','20 Maple Street');
 await page.click('#crm392SaveProperty');
 await expect(page.locator('#crm392PropertyStatus')).toContainText('Saved and CRM records reloaded');
 const calls=await page.evaluate(()=>window.__calls.filter(c=>c.type==='manage').map(c=>c.req));
 expect(calls.map(x=>x.action)).toEqual(['crm_client_save','property_site_save']);
 expect(calls[1].client_id).toBe('33333333-3333-4333-8333-333333333333');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('392 find/edit customer and property uses their canonical identifiers without creating duplicates',async({page})=>{
 await boot(page);
 await page.fill('#crm392CustomerSearch','seasonal');await page.selectOption('#crm392CustomerSelect',customer);
 await expect(page.locator('#crm392LegalName')).toHaveValue('Seasonal Example');
 await page.fill('#crm392Phone','555-1212');await page.click('#crm392SaveCustomer');
 await expect(page.locator('#crm392CustomerStatus')).toContainText('Saved and CRM records reloaded');
 await page.fill('#crm392PropertySearch','old road');await page.selectOption('#crm392PropertySelect',site);
 await expect(page.locator('#crm392SiteName')).toHaveValue('Existing Yard');
 await page.fill('#crm392SiteName','Existing Yard Updated');await page.click('#crm392SaveProperty');
 await expect(page.locator('#crm392PropertyStatus')).toContainText('Saved and CRM records reloaded');
 const calls=await page.evaluate(()=>window.__calls.filter(c=>c.type==='manage').map(c=>c.req));
 expect(calls[0].id).toBe(customer);expect(calls[1].id).toBe(site);
});
test('392 same customer/email and property name/address duplicates block writes',async({page})=>{
 await boot(page);
 await page.fill('#crm392LegalName','Seasonal Example');await page.click('#crm392SaveCustomer');
 await expect(page.locator('#crm392CustomerStatus')).toContainText('Possible duplicate customer');
 await page.fill('#crm392SiteName','Existing Yard');await page.click('#crm392SaveProperty');
 await expect(page.locator('#crm392PropertyStatus')).toContainText('Possible duplicate property');
 expect(await page.evaluate(()=>window.__calls.filter(c=>c.type==='manage').length)).toBe(0);
});
test('392 backend permission denial prevents fake save confirmation',async({page})=>{
 await boot(page,{manage:'deny'});
 await page.fill('#crm392LegalName','Unauthorized Client');await page.click('#crm392SaveCustomer');
 await expect(page.locator('#crm392CustomerStatus')).toContainText('jobs module approve access is required');
 await expect(page.locator('#crm392CustomerStatus')).not.toContainText('Saved and CRM records reloaded');
});
test('392 save button reports Saving and blocks duplicate clicks until acknowledged',async({page})=>{
 await boot(page,{manage:'hold'});
 await page.fill('#crm392LegalName','Hold Example');await page.click('#crm392SaveCustomer',{noWaitAfter:true});
 await expect(page.locator('#crm392SaveCustomer')).toBeDisabled();
 await expect(page.locator('#crm392SaveCustomer')).toHaveText('Saving…');
 await page.evaluate(()=>window.__hold());await expect(page.locator('#crm392SaveCustomer')).toBeEnabled();
 expect(await page.evaluate(()=>window.__calls.filter(c=>c.type==='manage').length)).toBe(1);
});
test('392 missing canonical identifier withholds success, no implicit retry',async({page})=>{
 await boot(page,{manage:'missing_id'});
 await page.fill('#crm392LegalName','No Id Returned');await page.click('#crm392SaveCustomer');
 await expect(page.locator('#crm392CustomerStatus')).toContainText('did not contain the canonical record identifier');
 expect(await page.evaluate(()=>window.__calls.filter(c=>c.type==='manage').length)).toBe(1);
});
