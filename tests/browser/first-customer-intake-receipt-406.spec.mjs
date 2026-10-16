import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/admin-customer-property-crm-ui.js','utf8');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const now=()=>new Date().toISOString();
const example=(intake)=>{
 const retrieved_at=now();
 return {
  ok:true,scope:'crm',
  crm_customers:[
    {client_id:a,client_name:'Ontario Orchard',legal_name:'Ontario Orchard',billing_email:'orchard@example.ca',is_active:true},
    {client_id:b,client_name:'Ontario Orchard',legal_name:'Ontario Orchard',billing_email:'other@example.ca',is_active:true}
  ],
  crm_properties:[],crm_leads:[],crm_service_plans:[],crm_service_history:[],crm_interactions:[],crm_followups:[],crm_opportunities:[],crm_renewals:[],crm_cross_service_candidates:[],
  crm_intake_406:intake||{state:'recorded',complete:true,retrieved_at,receipts:[{client_id:a,recorded_at:'2026-10-10T10:00:00Z'},{client_id:b,recorded_at:'2026-10-12T10:00:00Z'}]}
 };
};
async function boot(page,data){
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(payload=>{
  window.__loads=0;window.__writes=0;
  window.YWIAPI={loadAdminDirectory:async()=>{window.__loads++;return structuredClone(payload)},
    manageOperations:async()=>{window.__writes++;return {ok:false,error:'No writes allowed in test'}}};
 },data);
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWICustomerPropertyCRMUI.mount({api:window.YWIAPI}));
 await expect(page.locator('#crm406Receipt')).not.toBeEmpty();
}
test('Item 406 renders dated first-customer receipt and advisory duplicates without writes on a phone',async({page})=>{
 await boot(page,example());
 const receipt=page.locator('#crm406Receipt');
 await expect(receipt.locator('[data-crm406-state="recorded"]')).toContainText('Ontario Orchard');
 await expect(receipt.locator('[data-crm406-duplicates="review"]')).toContainText('Possible duplicate customers');
 await receipt.getByText('Ontario Orchard').first().isVisible();
 await page.locator('#crm406Recheck').click();
 await expect.poll(()=>page.evaluate(()=>window.__loads)).toBe(2);
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('Item 406 withholds missing or capped canonical source and blocks new customer creation',async({page})=>{
 const data=example({state:'withheld',complete:false,retrieved_at:now(),receipts:[],reason:'Source capped'});
 await boot(page,data);
 await expect(page.locator('[data-crm406-state="withheld"]')).toContainText('Intake receipt withheld');
 await page.fill('#crm392LegalName','A New Real Customer');
 await page.click('#crm392SaveCustomer');
 await expect(page.locator('#crm392CustomerStatus')).toContainText('Current complete canonical CRM intake verification is unavailable');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
});
test('Item 406 shows no first-customer receipt when complete canonical CRM read is empty',async({page})=>{
 const data=example({state:'no_record',complete:true,retrieved_at:now(),receipts:[]});
 data.crm_customers=[];
 await boot(page,data);
 await expect(page.locator('[data-crm406-state="no_record"]')).toContainText('No dated first-customer intake receipt');
 await expect(page.locator('[data-crm406-state="recorded"]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
});
test('Item 406 withholds expired receipt and requires a fresh canonical recheck',async({page})=>{
 const data=example({state:'recorded',complete:true,retrieved_at:'2026-10-01T12:00:00Z',receipts:[{client_id:a,recorded_at:'2026-10-01T11:00:00Z'}]});
 await boot(page,data);
 await expect(page.locator('[data-crm406-state="withheld"]')).toContainText('Intake receipt withheld');
 await page.fill('#crm392LegalName','Fresh Person');
 await page.click('#crm392SaveCustomer');
 await expect(page.locator('#crm392CustomerStatus')).toContainText('Recheck before creating a customer');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
});
