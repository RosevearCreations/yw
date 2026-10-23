import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const core=fs.readFileSync('js/six-service-owner-trial-430.js','utf8');
const siteJs=fs.readFileSync('js/service-site-intake-431.js','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(({opts,keys})=>{
  window.__reads=[];const uid='owner1',company='company1',client='client1',site='site1';
  window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.signedOut,user:{id:uid}})};
  const history={company_id:opts.foreignHistory?'foreign':company,client_id:client,legacy_unscoped_excluded:true,
   history_limit_per_type:80,properties:[{id:site,name:'Original property',address:'Ontario'}],estimates:[],work_orders:[]};
  const original={company_id:opts.foreignSite?'foreign':company,client_id:client,site_id:site,
   canonical_source:'client_sites_212',is_active:true,updated_at:new Date().toISOString(),
   property_reviewed_at:null,access_last_verified_at:null,approximate_serviceable_area:500,area_unit:'sq_m',
   gate_fence_summary:'Locked north gate',access_notes:'Ring site contact',parking_trailer_limits:'Small truck only',
   hazard_notes:null,utility_locate_notes:null,zones:[],safety_evidence_source:'NOT_QUERIED',safety_approval:'UNVERIFIED'};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:uid}}})},
   from(table){window.__reads.push(table);return {select(){return this},order(){return this},eq(){return this},
    limit(){return Promise.resolve({data:table==='ywi_companies'
     ?[{id:company,name:'Real company',owner_user_id:opts.foreignOwner?'other':uid}]
     :keys.map(module_key=>({company_id:company,module_key,enabled:module_key!=='septic'})),error:null});}}},
   rpc:async(name)=>{window.__reads.push(name);return {data:name==='ywi_rpc_company_customers_422'?[{id:client,name:'Real customer',is_active:true}]:
    name==='ywi_rpc_customer_history_422'?history:original,error:opts.rpcError&&name==='ywi_rpc_site_intake_431'?{message:'Denied'}:null};}};
 },{opts,keys});
 await page.addScriptTag({content:core});await page.addScriptTag({content:siteJs});
 await page.locator('#owner431 summary').click();await page.locator('#owner431Refresh').click();
}
test('phone site intake reads original linked CRM and displays six distinct requirement sets',async({page})=>{
 await setup(page);
 await page.locator('#owner431Customer').selectOption('client1');
 await page.locator('#owner431Property').selectOption('site1');
 await expect(page.locator('[data-owner431-service]')).toHaveCount(6);
 await expect(page.locator('[data-owner431-service="landscape"]')).toContainText('500 sq_m');
 await expect(page.locator('[data-owner431-service="snow_plowing"]')).toContainText('Small truck only');
 await expect(page.locator('[data-owner431-service="septic"]')).toContainText('OFFERING DISABLED');
 await expect(page.locator('#owner431Status')).toContainText('Safety/permit/field approvals: UNVERIFIED');
 expect(await page.evaluate(()=>window.__reads)).toEqual(expect.arrayContaining([
  'ywi_companies','ywi_company_service_modules','ywi_rpc_company_customers_422',
  'ywi_rpc_customer_history_422','ywi_rpc_site_intake_431']));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('foreign company or site, and source RPC failure, never presents an approved site',async({page})=>{
 await setup(page,{foreignOwner:true});await expect(page.locator('#owner431Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__reads)).not.toContain('ywi_rpc_site_intake_431');
 await setup(page,{foreignSite:true});await page.locator('#owner431Customer').selectOption('client1');
 await page.locator('#owner431Property').selectOption('site1');
 await expect(page.locator('#owner431Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner431-service]')).toHaveCount(0);
 await setup(page,{rpcError:true});await page.locator('#owner431Customer').selectOption('client1');
 await page.locator('#owner431Property').selectOption('site1');
 await expect(page.locator('#owner431Status')).toContainText('WITHHELD');
});
test('signed-out operator and cross-tenant 422 history fail before site fetch',async({page})=>{
 await setup(page,{signedOut:true});await expect(page.locator('#owner431Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__reads)).toHaveLength(0);
 await setup(page,{foreignHistory:true});await page.locator('#owner431Customer').selectOption('client1');
 await expect(page.locator('#owner431Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__reads)).not.toContain('ywi_rpc_site_intake_431');
});
test('help explicitly preserves independent site and Safety authorities',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.setContent(fs.readFileSync('help.html','utf8'));
 const help=page.locator('#service-site-intake-431');
 await expect(help).toContainText('original client_sites');
 await expect(help).toContainText('not Safety sign-off');
 await expect(help).toContainText('Never enter invented measurements');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
