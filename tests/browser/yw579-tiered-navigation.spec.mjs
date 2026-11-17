import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const tier=html.slice(html.indexOf('<div id="yw579TierHost"'),html.indexOf('  </header>',html.indexOf('<div id="yw579TierHost"')));
const nav=fs.readFileSync('js/yw579-tiered-navigation.js','utf8');
const css=fs.readFileSync('theme-tiers-579.css','utf8');
const theme=fs.readFileSync('js/theme-switcher-564.js','utf8');
const actor='a1111111-1111-4111-8111-111111111111';
const company='b2222222-2222-4222-8222-222222222222';
async function setup(page,{width=1366,foreign=false,denied=false}={}){
 await page.setViewportSize({width,height:900});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body data-authenticated="true"><header class="app-header"><div class="header-top"><h1>Yard Workers</h1><div class="header-session-actions"><a href="/help.html">Help</a></div></div>'+tier+'</header><main><section id="today"></section><section id="admin"><details id="owner450Snow"><summary>Snow</summary></details></section></main></body></html>');
 await page.evaluate(({actor,company,foreign,denied})=>{
  const auth={isAuthenticated:true,role:'admin',user:{id:actor}};
  window.__session=auth;
  window.YWI_AUTH={getState:()=>auth};
  window.YWIDualWorkspace={snapshot:()=>({ownedCompanies:auth.isAuthenticated?1:0})};
  window.YWISecurity={canViewModule:()=>true,canViewSection:()=>true};
  window.YWIRouter={showSection:(id)=>{location.hash='#'+id;document.dispatchEvent(new CustomEvent('ywi:route-shown',{detail:{allowed:id}}));}};
  const services=[
   {key:'landscape',label:'Lawn & Grounds',target:'owner449'},
   {key:'snow_removal',label:'Snow Removal',target:'owner450Snow'},
   {key:'septic',label:'Septic Services',target:'owner451Septic'}];
  const modules=[...services];
  window.YWI443={modules,specialties:[
    {key:'ponds',label:'Custom Ponds',route:'ponds'},
    {key:'skateparks',label:'Skateparks',route:'skateparks'}],
   inspect:(data,options)=>data.company_id===options.companyId&&options.jobsAllowed?{
    state:'verified_navigation_only',companyId:options.companyId,
    capturedAt:new Date().toISOString(),services,
    disabled:['construction','water_parks','snow_plowing','arboriculture']
   }:{state:'withheld',reason:'Foreign source'}};
  window.__queries=[];window.__writes=[];
  window._sb={auth:{getUser:async()=>({data:{user:auth.user},error:null})},
   from:table=>{window.__queries.push(table);return{
    select(){return this},order(){return this},
    limit:async()=>({data:[{id:company,name:'Rosevear Landscaping',owner_user_id:foreign?'foreign':actor}],error:null}),
    insert(){window.__writes.push('insert')},update(){window.__writes.push('update')}
   }},
   rpc:async(name,params)=>{window.__queries.push(name);
    return denied?{data:null,error:{message:'Not authorized'}}:
     {data:{company_id:params.p_company_id},error:null};}
  };
 },{actor,company,foreign,denied});
 await page.addStyleTag({content:css});
 await page.addScriptTag({content:nav});
}
for(const width of [390,1366]){
 test('YW579 tiers and verified seven-service owner scope at '+width+'px',async({page})=>{
  await setup(page,{width});
  await expect.poll(()=>page.locator('#yw579ServiceNav [data-yw579-service]').count()).toBe(3);
  await expect(page.locator('#yw579ServiceNav [data-yw579-service="snow_removal"]')).toBeVisible();
  await expect(page.locator('#yw579ServiceNav [data-yw579-service="snow_plowing"]')).toHaveCount(0);
  await expect(page.locator('#yw579PlanningNav button')).toHaveCount(2);
  const ids=await page.evaluate(()=>['yw579WorkspaceTier','yw579ModuleTier','yw579ToolsTier'].map(x=>document.getElementById(x).getBoundingClientRect().top));
  expect(ids[0]).toBeLessThan(ids[1]);expect(ids[1]).toBeLessThan(ids[2]);
  await page.locator('[data-yw579-service="snow_removal"]').click();
  await expect(page.locator('#yw579ServiceTools')).toBeVisible();
  await expect(page.locator('[data-yw579-tool="today"]')).toBeVisible();
  await page.locator('[data-yw579-tool="today"]').click();
  expect(await page.evaluate(()=>location.hash)).toBe('#today');
  expect(await page.evaluate(()=>window.YW579Navigation.snapshot().selectedService)).toBe('snow_removal');
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW579 owner mismatch and provider denial cannot expose enabled company service chips',async({page})=>{
 for(const opts of [{foreign:true},{denied:true}]){
  await setup(page,opts);
  await expect(page.locator('#yw579ServiceNav button')).toHaveCount(0);
  await expect(page.locator('#yw579ServiceStatus')).toContainText('HOLD');
 }
});
test('YW579 signed-out session clears company service navigation and cannot impersonate platform',async({page})=>{
 await setup(page);
 await expect.poll(()=>page.locator('#yw579ServiceNav button').count()).toBe(3);
 await page.evaluate(()=>{window.__session.isAuthenticated=false;window.__session.user=null;
  document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#yw579ServiceNav button')).toHaveCount(0);
 expect(await page.evaluate(()=>window.YW579Navigation.snapshot().verified)).toBe(false);
});
test('YW579 Forest Green and Antique Gold themes preserve UI-only appearance',async({page})=>{
 await setup(page);
 await page.addScriptTag({content:theme});
 await expect(page.locator('#yw564ThemeChoice option[value="forest"]')).toHaveCount(1);
 await expect(page.locator('#yw564ThemeChoice option[value="gilded"]')).toHaveCount(1);
 for(const key of ['forest','gilded']){
  await page.locator('#yw564ThemeChoice').selectOption(key);
  expect(await page.evaluate(()=>document.documentElement.dataset.ywTheme)).toBe(key);
 }
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});
