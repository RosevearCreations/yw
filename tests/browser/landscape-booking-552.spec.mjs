import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const script=fs.readFileSync('js/landscape-booking-552.js','utf8');
const company='11111111-1111-4111-8111-111111111111';
async function setup(page,opts={}){
 await page.route('http://yw552.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="landscaping-quote-552" hidden></section><div id="settings"></div></body></html>'}));
 await page.setViewportSize({width:opts.width||390,height:844});
 await page.goto('http://yw552.test/'+(opts.link===false?'':'?booking_company='+company));
 await page.evaluate(({company,opts})=>{
  window.__calls=[];let signedIn=true;
  window.__signOut=()=>{signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));};
  window.YWI_AUTH={getState:()=>({isAuthenticated:signedIn,user:{id:'owner-1'}})};
  window.YWIAPI={landscapeBooking552:async payload=>{
    window.__calls.push(payload);
    if(opts.unavailable)throw Error('Backend not installed');
    if(payload.action==='catalogue')return {ok:true,company_id:opts.badCompany?'22222222-2222-4222-8222-222222222222':company,
      company_name:'Rosevear Landscaping',season:'fall',items:[
      {code:'mow',name:'Lawn mowing',item_type:'service',unit:'visit',price_cents:7500},
      {code:'dump',name:'Estimated dump fee',item_type:'disposal',unit:'load',price_cents:2000}]};
    if(payload.action==='preview')return {ok:true,quote_digest:'a'.repeat(64),quote:{subtotal_cents:15000,
      disposal_estimate_cents:0,availability_confirmed:false,lines:[{code:'mow',name:'Lawn mowing',quantity:2,unit_price_cents:7500,line_total_cents:15000}]}};
    if(payload.action==='submit')return {ok:true,status:'owner_review',message:'Request received for owner review; no booking or payment.'};
  }};
  let publishing=false,publishingRowExists=false;
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner-1'}}})},from(table){
    if(table==='ywi_company_booking_public_settings_552')return {
      select(){return {eq(){return {limit:async()=>({data:publishingRowExists?[{company_id:company,public_enabled:publishing}]:[],error:null})}}}},
      insert(payload){if(publishingRowExists)throw Error('Owner publishing insert unexpectedly repeated');
        publishingRowExists=true;publishing=payload.public_enabled;return {select:async()=>({data:[{company_id:company,public_enabled:publishing}],error:null})}},
      update(payload){if(!publishingRowExists)throw Error('Owner publishing update occurred before first insert');
        publishing=payload.public_enabled;return {eq(){return {select:async()=>({data:[{company_id:company,public_enabled:publishing}],error:null})}}}}
    };
    const query={table,company:null};const q={select(){return q},eq(k,v){if(k==='company_id')query.company=v;return q},order(){return q},
      limit:async()=>table==='ywi_companies'?{data:[{id:company,name:'Rosevear Landscaping',owner_user_id:'owner-1'}],error:null}:
      {data:opts.badTenant?[{id:'request-1',company_id:'other'}]:[{id:'request-1',company_id:company,request_status:'owner_review',
       full_name:'Sample Customer',contact_value:'contact@example.invalid',preferred_contact_method:'email',service_area:'Tillsonburg',
       requested_date:null,estimated_subtotal_cents:7500,estimated_disposal_cents:0,
       quotation_snapshot:{lines:[{name:'Lawn mowing',quantity:1,unit_price_cents:7500}]} }],error:null}};return q;
  }};
 },{company,opts});
 await page.addScriptTag({content:script});
}

test('without explicit company link the public catalogue remains private and no public call occurs',async({page})=>{
 await setup(page,{link:false});
 await expect(page.locator('#landscaping-quote-552')).toBeHidden();
 expect(await page.evaluate(()=>window.__calls)).toEqual([]);
});

for(const width of [390,768,1440]){
 test(`linked company wizard safely previews and submits at ${width}px`,async({page})=>{
  await setup(page,{width});
  await expect(page.locator('#booking552Company')).toContainText('Rosevear Landscaping');
  await page.locator('[data-booking552-code="mow"]').fill('2');
  await page.locator('#booking552Preview').click();
  await expect(page.locator('#booking552Estimate')).toContainText('$150.00');
  await expect(page.locator('#booking552Submit')).toBeEnabled();
  await page.locator('[name="full_name"]').fill('Sample Customer');
  await page.locator('[name="contact_value"]').fill('sample@example.invalid');
  await page.locator('[name="service_area"]').fill('Tillsonburg');
  await page.locator('[name="privacy_consent"]').check();
  await page.locator('#booking552Submit').click();
  await expect(page.locator('#booking552Status')).toContainText('no booking or payment');
  const calls=await page.evaluate(()=>window.__calls);
  expect(calls.map(c=>c.action)).toEqual(['catalogue','preview','submit']);
  expect(calls[2]).toMatchObject({company_id:company,privacy_consent:true,quote_digest:'a'.repeat(64),
    selections:[{code:'mow',quantity:2}]});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}

test('changing a selected quantity invalidates review and disables submission',async({page})=>{
 await setup(page);
 await page.locator('[data-booking552-code="mow"]').fill('1');
 await page.locator('#booking552Preview').click();
 await expect(page.locator('#booking552Submit')).toBeEnabled();
 await page.locator('[data-booking552-code="mow"]').fill('2');
 await expect(page.locator('#booking552Submit')).toBeDisabled();
 expect((await page.evaluate(()=>window.__calls)).some(c=>c.action==='submit')).toBe(false);
});

test('backend outage and wrong company projection fail closed without pretending to book',async({page})=>{
 await setup(page,{badCompany:true});
 await expect(page.locator('#booking552Status')).toContainText('UNAVAILABLE');
 await expect(page.locator('#booking552Submit')).toBeDisabled();
});

test('only verified company owner can read requests and display share link',async({page})=>{
 await setup(page);
 await page.locator('#owner552 summary').click();
 await page.locator('#owner552Refresh').click();
 await expect(page.locator('#owner552Status')).toContainText('1 company-scoped requests');
 await expect(page.locator('#owner552Requests')).toContainText('Sample Customer');
 await expect(page.locator('#owner552Status')).toContainText('Public intake: OFF');
 await page.on('dialog',dialog=>dialog.accept());
 await page.locator('#owner552Access').click();
 await expect(page.locator('#owner552Status')).toContainText('ENABLED');
 await page.locator('#owner552Access').click();
 await expect(page.locator('#owner552Status')).toContainText('DISABLED');
 await page.locator('#owner552Access').click();
 await expect(page.locator('#owner552Status')).toContainText('ENABLED');
 await page.locator('#owner552Link').click();
 await expect(page.locator('#owner552LinkText')).toContainText('booking_company='+company);
 await page.evaluate(()=>window.__signOut());
 await expect(page.locator('#owner552Requests')).toBeEmpty();
 await expect(page.locator('#owner552Status')).toContainText('Session changed');
});

test('cross-company request read is withheld',async({page})=>{
 await setup(page,{badTenant:true});
 await page.locator('#owner552 summary').click();
 await page.locator('#owner552Refresh').click();
 await expect(page.locator('#owner552Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner552Requests')).toBeEmpty();
});
