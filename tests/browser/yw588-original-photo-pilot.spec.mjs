import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const actor='58800000-0000-4588-8588-000000000099';
async function pageFor(page,{shell=false,owner=false,deny=false}={}){
 await page.setContent('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="yw584Sysop"></section><details id="yw584Tenant"><summary>Owner</summary></details></body></html>');
 await page.addStyleTag({content:read('public/yw588-pilot.css')});
 await page.evaluate(({actor,shell,owner,deny})=>{
  document.documentElement.dataset.ywSurface=shell?'platform':'tenant';
  if(shell)window.location.hash='#sysop';
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:actor}})};
  window.YWIDualWorkspace={isSysopVerified:()=>shell,snapshot:()=>({ownedCompanies:owner?1:0})};
  window.YW579Navigation={snapshot:()=>({verified:owner,companyId:'03bcf48e-a4f5-4427-9aba-b0f91f39b16b'})};
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
   rpc:async name=>{
    if(name==='ywi_is_platform_administrator_489')return {data:shell&&!deny,error:null};
    if(name==='ywi_rpc_customer_history_422')return {data:deny?null:{
     company_id:'03bcf48e-a4f5-4427-9aba-b0f91f39b16b',
     client_id:'58700000-0000-4587-8587-000000000001',
     legacy_unscoped_excluded:true,history_limit_per_type:80,
     properties:[{id:'58700000-0000-4587-8587-000000000002',name:'TEST ONLY'}],
     work_orders:[]},error:deny?{message:'denied'}:null};
    return {data:null,error:{message:'not enrolled'}};
   },
   from:()=>{const q={select(){return q},eq(){return q},limit:async()=>({
    data:owner&&!deny?[{id:'03bcf48e-a4f5-4427-9aba-b0f91f39b16b',
    owner_user_id:actor,name:'Rosevear Landscaping'}]:[],error:null})};return q;}
  };
 },{actor,shell,owner,deny});
 await page.addScriptTag({content:read('js/yw588-pilot-evidence.js')});
 await page.addScriptTag({content:read('js/yw588-pilot-workspace.js')});
}
for(const width of [390,768,1440]){
 test('YW588 original owner live-record HOLD without real work order '+width,async({page})=>{
  await page.setViewportSize({width,height:900});await pageFor(page,{owner:true});
  await page.locator('#yw588TenantPanel summary').click();
  await page.locator('#yw588TenantPanel button').click();
  await expect(page.locator('#yw588TenantStatus')).toContainText('Original test work order not yet authorized');
  await expect(page.locator('#yw588TenantResult')).toContainText('0 independently verified');
  await expect(page.locator('#yw588TenantResult')).not.toContainText('billing_email');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
 });
}
test('YW588 unapproved tenant cannot inspect client or job',async({page})=>{
 await pageFor(page,{owner:false});
 await page.locator('#yw588TenantPanel summary').click();
 await page.locator('#yw588TenantPanel button').click();
 await expect(page.locator('#yw588TenantStatus')).toContainText('HOLD');
 await expect(page.locator('#yw588TenantResult')).toBeEmpty();
});
test('YW588 platform operator cannot fetch tenant data without signed redacted receiver',async({page})=>{
 await pageFor(page,{shell:true});
 await page.locator('#yw588ShellPanel summary').click();
 await page.locator('#yw588ShellPanel button').click();
 await expect(page.locator('#yw588ShellStatus')).toContainText('HOLD');
 await expect(page.locator('#yw588ShellResult')).toBeEmpty();
});
test('YW588 unapproved platform actor sees no technical data',async({page})=>{
 await pageFor(page,{shell:true,deny:true});
 await page.locator('#yw588ShellPanel summary').click();
 await page.locator('#yw588ShellPanel button').click();
 await expect(page.locator('#yw588ShellStatus')).toContainText('HOLD');
 await expect(page.locator('#yw588ShellResult')).toBeEmpty();
});
