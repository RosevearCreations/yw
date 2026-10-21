import{test,expect}from'@playwright/test';import fs from'node:fs';
const src=fs.readFileSync('js/new-work-company-gate-421.js','utf8'),keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.evaluate(({keys,opts})=>{
   window.__actions=[];const uid='owner';
   window.YWI_AUTH={getState:()=>({isAuthenticated:!opts.noAuth,user:{id:uid}})};
   const values={
   ywi_companies:[{id:'company-1',name:'Yard Workers Company',owner_user_id:opts.foreign?'outsider':uid}],
   ywi_company_service_modules:(opts.partial?keys.slice(0,5):keys).map((module_key,i)=>({company_id:'company-1',module_key,enabled:i===0}))};
   window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:uid}}})},from(table){const data=values[table];
   return {select(){return this},order(){return this},eq(){return this},limit(){return Promise.resolve({data,error:null})}};},
   rpc:async(name,args)=>{window.__actions.push({name,args});return {data:'draft-created-uuid',error:null}}};
 },{keys,opts});
 await page.addScriptTag({content:src});await page.locator('#owner421 summary').click();await page.locator('#owner421Refresh').click();
}
test('enabled service only, company is authenticated, mobile safe',async({page})=>{
 await setup(page);
 await expect(page.locator('#owner421Status')).toContainText('Server-controlled services loaded');
 await expect(page.locator('[data-owner421-create]')).toHaveCount(1);
 await expect(page.locator('[data-owner421-service] option')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__actions)).toHaveLength(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('owner explicitly confirms authorized draft, RPC governs create',async({page})=>{
 await setup(page);
 await expect(page.locator('#owner421Status')).toContainText('Server-controlled services loaded');
 await page.locator('[data-owner421-title]').fill('Seasonal first visit');
 page.once('dialog',d=>d.accept());
 await page.locator('[data-owner421-create]').click();
 await expect(page.locator('[data-owner421-receipt]')).toContainText('server-authorized draft');
 const list=await page.evaluate(()=>window.__actions);
 expect(list).toHaveLength(1);
 expect(list[0]).toEqual({name:'ywi_rpc_create_scoped_estimate_421',
 args:{p_company_id:'company-1',p_module_key:'landscape',p_title:'Seasonal first visit'}});
});
test('wrong tenant and incomplete source withhold new work',async({page})=>{
 await setup(page,{foreign:true});
 await expect(page.locator('#owner421Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner421-create]')).toHaveCount(0);
});
test('signed-out users cannot load or draft',async({page})=>{
 await setup(page,{noAuth:true});
 await expect(page.locator('#owner421Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner421-create]')).toHaveCount(0);
});
