import{test,expect}from'@playwright/test';import fs from'node:fs';
const ui=fs.readFileSync('js/company-service-registry-420.js','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];
async function setup(page, options={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="settings"></div><div id="admin"></div></body></html>');
 await page.evaluate(({keys,options})=>{
  const userId='owner-1', companyId='company-1';
  window.__writes=[];window.__reads=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:!options.noAuth,user:{id:userId}})};
  const rows=keys.map(module_key=>({module_key,company_id:companyId,enabled:false,created_at:'2026-10-20T00:00:00Z',updated_at:'2026-10-20T00:00:00Z'}));
  const qs={
   ywi_companies:[{id:companyId,name:'Test Lawn Service',owner_user_id:options.crossTenant?'other-user':userId,created_at:'2026-10-20T00:00:00Z'}],
   ywi_company_service_modules:options.incomplete?rows.slice(1):rows,
   ywi_company_service_module_audit:keys.map((module_key,id)=>({id,company_id:companyId,module_key,action:'initialized',previous_enabled:null,next_enabled:false,recorded_at:'2026-10-20T00:00:00Z'}))
  };
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:userId}}})},
   from(table){
    const record={table,kind:'select',filters:[],request:null};window.__reads.push(record);
    const query={
     select(){if(record.kind==='update'){window.__writes.push({table,payload:record.request});return Promise.resolve({data:[{...qs[table][0],enabled:record.request.enabled}],error:null});}return this},order(){return this},limit(){return Promise.resolve({data:qs[table]||[],error:null})},
     eq(k,v){record.filters.push([k,v]);return this},
     update(payload){record.kind='update';record.request=payload;return this},
     insert(payload){window.__writes.push({table,payload});return {select:async()=>({data:[{id:'new',name:payload.name}],error:null})}}
    };
    return query;
   }
  };
 },{keys,options});
 await page.addScriptTag({content:ui});
 await expect(page.locator('#settings #owner420')).toHaveCount(1);
 await expect(page.locator('#admin #owner420')).toHaveCount(0);
 await page.locator('#owner420 summary').click();
}
test('owner sees seven switches, disabled state and immutable source history, mobile safe',async({page})=>{
 await setup(page);
 await page.locator('#owner420Refresh').click();
 await expect(page.locator('[data-owner420-key]')).toHaveCount(7);
 await expect(page.locator('[data-owner420-enabled="false"]')).toHaveCount(7);
 await expect(page.locator('[data-owner420-audit] li')).toHaveCount(7);
 expect(await page.evaluate(()=>window.__writes.length)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('explicit owner confirmation saves only one enabled switch',async({page})=>{
 await setup(page);
 await page.locator('#owner420Refresh').click();
 page.once('dialog',d=>d.accept());
 await page.locator('[data-owner420-toggle="landscape"]').click();
 await expect(page.locator('#owner420Status')).toContainText('owner-owned companies loaded');
 const actions=await page.evaluate(()=>window.__writes);
 expect(actions).toHaveLength(1);
 expect(actions[0]).toEqual({table:'ywi_company_service_modules',payload:{enabled:true}});
});
test('tenant identity mismatch and partial service set withhold actions',async({page})=>{
 await setup(page,{crossTenant:true});
 await page.locator('#owner420Refresh').click();
 await expect(page.locator('#owner420Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner420-toggle]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__writes.length)).toBe(0);
});
test('missing authentication fails closed',async({page})=>{
 await setup(page,{noAuth:true});
 await page.locator('#owner420Refresh').click();
 await expect(page.locator('#owner420Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner420-toggle]')).toHaveCount(0);
});
