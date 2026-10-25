import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fixture,company,companyId,ownerId,companyAdminTest}
 from '../fixtures/pms-module-navigation-443.mjs';
const js=readFileSync('js/pms-module-navigation-443.js','utf8');
async function setup(page,options={}){
 const response=fixture({now:Date.now(),enabled:options.allOff?[]:undefined});
 if(options.foreignPayload)response.services[0].company_id='a4420000-0000-4442-8442-000000000002';
 await page.setViewportSize({width:options.desktop?1100:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>.pms443-desktop{display:grid;gap:5px;grid-template-columns:repeat(auto-fit,minmax(min(100%,165px),1fr))}.pms443-mobile-label{display:none}@media(max-width:600px){.pms443-desktop{display:none}.pms443-mobile-label{display:grid}}</style></head><body style="margin:8px"><div id="admin"><details id="owner424"><summary>Lawn</summary></details><details id="owner427"><summary>Snow</summary></details><details id="owner428"><summary>Septic</summary></details></div></body></html>');
 await page.evaluate(({response,options,company,ownerId,companyAdminTest})=>{
  window.__calls=[];window.__writes=[];window.__signedOut=!!options.signedOut;
  window.YWISecurity={canViewModule:(module,role)=>module==='jobs'&&role==='admin'&&!options.noJobs};
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:ownerId},role:'admin'})};
  const ok=data=>({data,error:null});
  window.YWI_SB={auth:{getUser:async()=>ok({user:{id:options.badSession?'wrong':ownerId}})},
   from(table){window.__calls.push(table);return {
    select(){return this},order(){return this},
    limit(){return Promise.resolve(ok(table==='ywi_companies'?
     options.noCompany?[]:[{...company,owner_user_id:options.foreignOwner?'other':ownerId}]:[]));},
    insert(){window.__writes.push('insert')},update(){window.__writes.push('update')},
    delete(){window.__writes.push('delete')},upsert(){window.__writes.push('upsert')}
   };},
   rpc:async(name)=>{window.__calls.push(name);return options.denied?
    {data:null,error:{message:'denied'}}:name==='ywi_rpc_pms_navigation_443'?ok(response):
    {data:null,error:{message:'wrong RPC'}};}};
  window.__syntheticCompanyAdmin=companyAdminTest;
 },{response,options,company,ownerId,companyAdminTest});
 await page.addScriptTag({content:js});
 await page.locator('#pms443 summary').first().click();
 await page.locator('#pms443Refresh').click();
}
test('Yard Rosevear six-switch owner tenant displays matching mobile options, with OFF hidden',async({page})=>{
 await setup(page);
 await expect(page.locator('#pms443Status')).toContainText('3 enabled / 3 disabled');
 await expect(page.locator('[data-pms443-service]')).toHaveCount(3);
 expect(await page.locator('[data-pms443-service]').evaluateAll(xs=>xs.map(x=>x.dataset.pms443Service)))
  .toEqual(['landscape','snow_removal','septic']);
 expect(await page.locator('#pms443Mobile option').evaluateAll(xs=>xs.slice(1).map(x=>x.value)))
  .toEqual(['landscape','snow_removal','septic']);
 await expect(page.locator('#pms443History')).toContainText('Historical access retained');
 await expect(page.locator('#pms443Planned')).toContainText('Planned service and business modules');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 await page.locator('#pms443Mobile').selectOption('snow_removal');
 expect(await page.locator('#owner427').evaluate(e=>e.open)).toBe(true);
 expect(await page.evaluate(()=>window.__syntheticCompanyAdmin.real_auth_account)).toBe(false);
});
test('desktop has exactly enabled service buttons, retaining original entry points',async({page})=>{
 await setup(page,{desktop:true});
 await expect(page.locator('[data-pms443-service="landscape"]')).toBeVisible();
 await expect(page.locator('[data-pms443-service="snow_plowing"]')).toHaveCount(0);
 await page.locator('[data-pms443-service="landscape"]').click();
 expect(await page.locator('#owner424').evaluate(e=>e.open)).toBe(true);
 await expect(page.locator('#pms443 a[href="/help.html#pms-tenant-module-navigation-443"]')).toHaveCount(1);
});
test('all services OFF yields no actionable navigation and preserves historical reads',async({page})=>{
 await setup(page,{allOff:true});
 await expect(page.locator('[data-pms443-service]')).toHaveCount(0);
 await expect(page.locator('#pms443Mobile option')).toHaveCount(1);
 await expect(page.locator('#pms443History')).toContainText('authorized Jobs and audit screens');
});
test('foreign tenant, absent owner, missing Jobs permission, denied RPC and session mismatch fail closed',async({page})=>{
 for(const options of [{foreignPayload:true},{foreignOwner:true},{badSession:true},{denied:true},{signedOut:true},{noJobs:true}]){
  await setup(page,options);
  await expect(page.locator('#pms443Status')).toContainText('WITHHELD');
  await expect(page.locator('[data-pms443-service]')).toHaveCount(0);
 }
});
test('no live company: synthetic fixture is not silently promoted to a real tenant',async({page})=>{
 await setup(page,{noCompany:true});
 await expect(page.locator('#pms443Status')).toContainText('HOLD: no real company');
 expect(await page.evaluate(()=>window.__calls)).not.toContain('ywi_rpc_pms_navigation_443');
});
test('signout invalidates rendered navigation and any later read',async({page})=>{
 await setup(page);
 await expect(page.locator('[data-pms443-service]')).toHaveCount(3);
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('[data-pms443-service]')).toHaveCount(0);
 await page.locator('#pms443Refresh').click();
 await expect(page.locator('#pms443Status')).toContainText('WITHHELD');
});
