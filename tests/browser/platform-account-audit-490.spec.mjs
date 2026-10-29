import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/platform-account-audit-490.js','utf8');
async function setup(page,{deny=false,wrongIdentity=false,extraPlatformAdmin=false}={}){
 await page.setContent('<html><body><section id="admin"></section></body></html>');
 await page.evaluate(({deny,wrongIdentity,extraPlatformAdmin})=>{
  const uid='primary';window.__rpcCalls=[];
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:uid},role:'admin'})};
  const accounts=[
   {profile_id:'primary',account_name:'Primary Administrator',account_email:'veardev@live.ca',global_role:'admin',curated_platform_admin:true,owned_company_count:0,profile_email_matches_auth:true},
   {profile_id:'legacy',account_name:'Jordan Rosevear',account_email:'veardan@hotmail.com',global_role:'admin',curated_platform_admin:extraPlatformAdmin,owned_company_count:0,profile_email_matches_auth:true},
   {profile_id:'owner',account_name:'Jordan Rosevear',account_email:'jfrosevear@outlook.com',global_role:'employee',curated_platform_admin:false,owned_company_count:1,profile_email_matches_auth:true}
  ];
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:wrongIdentity?'different':uid}}})},
   rpc:async(name)=>{window.__rpcCalls.push(name);return deny?{error:{message:'denied'}}:{data:accounts,error:null};}};
 },{deny,wrongIdentity,extraPlatformAdmin});
 await page.addScriptTag({content:ui});
 await page.locator('#platform490 summary').click();
}
test('curated platform admin sees legacy exception and separate company owner',async({page})=>{
 await setup(page);await page.locator('#platform490Refresh').click();
 await expect(page.locator('[data-platform490-role]')).toHaveCount(3);
 await expect(page.locator('[data-platform490-role^="LEGACY"]')).toHaveCount(1);
 await expect(page.locator('#platform490Status')).toContainText('1 legacy global admin exception');
 expect(await page.evaluate(()=>window.__rpcCalls)).toEqual(['ywi_platform_account_audit_490']);
});
test('server denial, identity mismatch and duplicate platform admins fail closed',async({page})=>{
 for(const opts of [{deny:true},{wrongIdentity:true},{extraPlatformAdmin:true}]){
  await setup(page,opts);await page.locator('#platform490Refresh').click();
  await expect(page.locator('#platform490Status')).toContainText('WITHHELD');
  await expect(page.locator('[data-platform490-role]')).toHaveCount(0);
 }
});
