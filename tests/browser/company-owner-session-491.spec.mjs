import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const owner=readFileSync('js/company-owner-workspace-490.js','utf8');
const audit=readFileSync('js/platform-account-audit-490.js','utf8');
const registry=readFileSync('js/company-service-registry-420.js','utf8');
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];

async function ownerFixture(page,{deferAuth=false}={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<html><body><section id="settings"><h2>Settings</h2><details id="owner420"><summary>Services</summary><button id="owner420Refresh">Refresh</button><section data-owner420-company="first"></section><section data-owner420-company="second"></section></details></section></body></html>');
 await page.evaluate(({keys,deferAuth})=>{
  const companies=[{id:'first',name:'First Company',owner_user_id:'owner'},
   {id:'second',name:'Rosevear Landscaping',owner_user_id:'owner'}];
  window.__auth={isAuthenticated:true,user:{id:'owner'}};
  window.YWI_AUTH={getState:()=>window.__auth};
  window.__modulesEnabled=false;
  window.__resolveOwnerAuth=null;
  const deferred=deferAuth?new Promise(resolve=>{window.__resolveOwnerAuth=()=>resolve({data:{user:{id:'owner'}}});}):null;
  window.YWI_SB={auth:{getUser:()=>deferred||Promise.resolve({data:{user:{id:'owner'}}})},
   from(table){const state={company:null};return {
    select(){return this},order(){return this},eq(_key,value){state.company=value;return this},
    async limit(){return {error:null,data:table==='ywi_companies'?companies:
     keys.map(module_key=>({company_id:state.company,module_key,enabled:window.__modulesEnabled&&module_key==='landscape'}))};}
   };}}
  };
 },{keys,deferAuth});
 await page.addScriptTag({content:owner});
}

test('session change while owner read is pending cannot repaint previous tenant',async({page})=>{
 await ownerFixture(page,{deferAuth:true});
 await page.locator('#owner490Load').click();
 await page.waitForFunction(()=>typeof window.__resolveOwnerAuth==='function');
 await page.evaluate(()=>{
  window.__auth={isAuthenticated:false,user:null};
  document.dispatchEvent(new Event('ywi:auth-changed'));
  window.__resolveOwnerAuth();
 });
 await expect(page.locator('#owner490Status')).toContainText('Session changed');
 await expect(page.locator('[data-owner490-company]')).toHaveCount(0);
 await expect(page.locator('#owner490Load')).toBeEnabled();
});

test('second owned company opens its own verified service controls',async({page})=>{
 await ownerFixture(page);
 await page.locator('#owner490Load').click();
 await expect(page.locator('[data-owner490-company]')).toHaveCount(2);
 await page.evaluate(()=>{
  document.getElementById('owner420Refresh').addEventListener('click',()=>{
   document.dispatchEvent(new CustomEvent('ywi:company-registry-loaded-491',{
    detail:{ownerUserId:'owner',companyIds:['first','second']}}));
  });
 });
 await page.locator('[data-owner490-company="second"] button').click();
 await expect(page.locator('#owner420')).toHaveAttribute('open','');
 await expect(page.locator('#owner490Status')).toContainText('Verified service controls opened');
});

test('service change refreshes verified count; foreign company event does not',async({page})=>{
 await ownerFixture(page);
 await page.locator('#owner490Load').click();
 await expect(page.locator('#owner490List')).toContainText('Enabled services: 0 of 7');
 await page.evaluate(()=>{
  window.__modulesEnabled=true;
  document.dispatchEvent(new CustomEvent('ywi:company-service-offering-changed',{detail:{company_id:'foreign'}}));
 });
 await expect(page.locator('#owner490List')).toContainText('Enabled services: 0 of 7');
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('ywi:company-service-offering-changed',{detail:{company_id:'second'}})));
 await expect(page.locator('#owner490List')).toContainText('Enabled services: 1 of 7');
});

test('platform audit results from a previous login never repaint after logout',async({page})=>{
 await page.setContent('<html><body><section id="admin"></section></body></html>');
 await page.evaluate(()=>{
  window.__auth={isAuthenticated:true,user:{id:'primary'}};
  window.YWI_AUTH={getState:()=>window.__auth};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'primary'}}})},
   rpc:()=>new Promise(resolve=>{window.__resolveAudit=()=>resolve({error:null,data:[{
    profile_id:'primary',account_name:'Primary Administrator',account_email:'veardev@live.ca',
    global_role:'admin',curated_platform_admin:true,owned_company_count:0,profile_email_matches_auth:true
   }]});})};
 });
 await page.addScriptTag({content:audit});
 await page.locator('#platform490 summary').click();
 await page.locator('#platform490Refresh').click();
 await page.waitForFunction(()=>typeof window.__resolveAudit==='function');
 await page.evaluate(()=>{
  window.__auth={isAuthenticated:false,user:null};
  document.dispatchEvent(new Event('ywi:auth-changed'));
  window.__resolveAudit();
 });
 await expect(page.locator('#platform490Status')).toContainText('Session changed');
 await expect(page.locator('[data-platform490-role]')).toHaveCount(0);
 await expect(page.locator('#platform490Refresh')).toBeEnabled();
});

test('company module registry does not restore stale tenant after sign-out',async({page})=>{
 await page.setContent('<html><body><section id="settings"></section></body></html>');
 await page.evaluate(()=>{
  window.__auth={isAuthenticated:true,user:{id:'owner'}};
  window.YWI_AUTH={getState:()=>window.__auth};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},
   from(){return {select(){return this},order(){return this},limit(){
    return new Promise(resolve=>{window.__resolveCompanies=()=>resolve({data:[{id:'first',name:'First',owner_user_id:'owner'}],error:null});});
   }};}};
 });
 await page.addScriptTag({content:registry});
 await page.locator('#owner420 summary').click();
 await page.locator('#owner420Refresh').click();
 await page.waitForFunction(()=>typeof window.__resolveCompanies==='function');
 await page.evaluate(()=>{
  window.__auth={isAuthenticated:false,user:null};
  document.dispatchEvent(new Event('ywi:auth-changed'));
  window.__resolveCompanies();
 });
 await expect(page.locator('#owner420Status')).toContainText('Session changed');
 await expect(page.locator('[data-owner420-company]')).toHaveCount(0);
});
