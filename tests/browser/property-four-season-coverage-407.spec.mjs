import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const ui=fs.readFileSync('js/admin-customer-property-crm-ui.js','utf8');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const site='33333333-3333-4333-8333-333333333333',foreignSite='44444444-4444-4444-8444-444444444444';
const timestamp=()=>new Date().toISOString();
const fixture=(overrides={})=>({
 ok:true,scope:'crm',crm_customers:[
  {client_id:owner,client_name:'Example Customer',legal_name:'Example Customer',is_active:true},
  {client_id:other,client_name:'Other Customer',legal_name:'Other Customer',is_active:true}
 ],crm_properties:[
  {id:site,client_id:owner,site_name:'Orchard Lot',service_address:'Example Road'},
  {id:foreignSite,client_id:other,site_name:'Foreign Lot',service_address:'Another Road'}
 ],
 crm_leads:[],crm_service_plans:[],crm_service_history:[],crm_interactions:[],crm_followups:[],crm_opportunities:[],crm_renewals:[],crm_cross_service_candidates:[],
 crm_intake_406:{state:'recorded',complete:true,retrieved_at:timestamp(),receipts:[{client_id:owner,recorded_at:'2026-10-01T10:00:00Z'},{client_id:other,recorded_at:'2026-10-02T10:00:00Z'}]},
 crm_property_coverage_407:{
  state:'recorded',complete:true,retrieved_at:timestamp(),
  properties:[{client_site_id:site,client_id:owner,seasons:{
   spring_summer:{state:'active_agreement_recorded',agreement_count:1},
   fall:{state:'review_agreement',agreement_count:1},
   winter:{state:'not_verified',agreement_count:0}
  }},{client_site_id:foreignSite,client_id:other,seasons:{
   spring_summer:{state:'not_verified',agreement_count:0},
   fall:{state:'not_verified',agreement_count:0},
   winter:{state:'active_agreement_recorded',agreement_count:1}
  }}]
 },...overrides
});
async function boot(page,source){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(data=>{
  window.__reads=0;window.__writes=0;
  window.YWIAPI={loadAdminDirectory:async()=>{window.__reads++;return structuredClone(data)},manageOperations:async()=>{window.__writes++;return {ok:false,error:'No write in coverage review'}}};
 },source);
 await page.addScriptTag({content:ui});
 await page.evaluate(()=>window.YWICustomerPropertyCRMUI.mount({api:window.YWIAPI}));
 await expect(page.locator('#crm407Evidence')).not.toBeEmpty();
}
test('407 customer-owned property maps only dated active spring, review fall and withheld winter readiness on phone',async({page})=>{
 await boot(page,fixture());
 const h=page.locator('#crm407Evidence');
 await expect(h.locator('[data-crm407-state="recorded"]')).toContainText('Orchard Lot');
 await expect(h.locator('[data-crm407-season="spring_summer"]')).toContainText('Dated active agreement recorded');
 await expect(h.locator('[data-crm407-season="fall"]')).toContainText('require review');
 await expect(h.locator('[data-crm407-season="winter"]')).toContainText('No verified active site agreement');
 await expect(h).not.toContainText('Foreign Lot');
 await page.locator('#crm407Recheck').click();
 await expect.poll(()=>page.evaluate(()=>window.__reads)).toBe(2);
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('407 withholds when canonical property / plan evidence failed, capped or expired',async({page})=>{
 const data=fixture({crm_property_coverage_407:{state:'withheld',complete:false,retrieved_at:timestamp(),properties:[],reason:'Capped source'}});
 await boot(page,data);
 await expect(page.locator('[data-crm407-state="withheld"]')).toContainText('Site/season evidence withheld');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
});
test('407 distinguishes absence of real customer-owned properties from valid coverage',async({page})=>{
 const data=fixture({crm_properties:[],crm_property_coverage_407:{state:'no_property',complete:true,retrieved_at:timestamp(),properties:[]}});
 await boot(page,data);
 await expect(page.locator('[data-crm407-state="no_property"]')).toContainText('No verified customer-owned property');
 await expect(page.locator('[data-crm407-season]')).toHaveCount(0);
});
test('407 blocks cross-customer property identity mismatch and stale evidence',async({page})=>{
 const data=fixture();
 data.crm_property_coverage_407.properties=[{client_site_id:site,client_id:other,seasons:{spring_summer:{state:'active_agreement_recorded',agreement_count:1}}}];
 await boot(page,data);
 await expect(page.locator('[data-crm407-state="withheld"]')).toContainText('Unmatched site ownership');
 const stale=fixture();stale.crm_property_coverage_407.retrieved_at='2026-10-01T00:00:00Z';
 await page.evaluate(payload=>{window.YWIAPI.loadAdminDirectory=async()=>payload},stale);
 await page.locator('#crm407Recheck').click();
 await expect(page.locator('[data-crm407-state="withheld"]')).toContainText('fresh complete');
});
