import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/company-owner-workspace-490.js','utf8');
async function setup(page,{foreign=false,missingModules=false,notSignedIn=false}={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="settings"><h2>Settings</h2><details id="owner420"><summary>Services</summary><button id="owner420Refresh">Refresh</button></details></section><section id="admin"></section></body></html>');
 await page.evaluate(({foreign,missingModules,notSignedIn})=>{
  const uid='jordan-user';window.__writes=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:!notSignedIn,user:{id:uid},role:'employee'})};
  const company=[{id:'rosevear-company',name:'Rosevear Landscaping',owner_user_id:foreign?'foreign-owner':uid}];
  const services=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']
   .map(module_key=>({company_id:'rosevear-company',module_key,enabled:false}));
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:uid}}})},
   from(name){return {select(){return this},order(){return this},eq(){return this},
    limit:async()=>({data:name==='ywi_companies'?company:\n     name==='ywi_company_service_module_audit'?[]:missingModules?services.slice(1):services,error:null})};}
  };
 },{foreign,missingModules,notSignedIn});
 await page.addScriptTag({content:ui});
}
test('non-admin Jordan sees owned company dashboard in Settings and no platform panel',async({page})=>{
 await setup(page);
 await page.locator('#owner490Load').click();
 await expect(page.locator('[data-owner490-company]')).toHaveCount(1);
 await expect(page.locator('#owner490Status')).toContainText('1 owned company workspace');
 await expect(page.locator('#owner490List')).toContainText('Rosevear Landscaping');
 await expect(page.locator('#owner490List')).toContainText('Enabled services: 0 of 7');
 await expect(page.locator('#admin #owner490')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('owner can reach existing service control without platform admin access',async({page})=>{
 await setup(page);
 await page.locator('#owner490Load').click();
 await page.locator('#owner490List button').click();
 await expect(page.locator('#owner420')).toHaveAttribute('open','');
});
test('foreign company, incomplete registry and missing session deny workspace',async({page})=>{
 for(const opts of [{foreign:true},{missingModules:true},{notSignedIn:true}]){
  await setup(page,opts);
  await page.locator('#owner490Load').click();
  await expect(page.locator('#owner490Status')).toContainText('WITHHELD');
  await expect(page.locator('[data-owner490-company]')).toHaveCount(0);
 }
});
