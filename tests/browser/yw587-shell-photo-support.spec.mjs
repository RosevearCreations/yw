import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const engine=read('js/yw587-photo-incident-engine.js');
const fixture=read('js/yw587-rosevear-synthetic-case.js');
const workspace=read('js/yw587-shell-case-workspace.js');
const css=read('theme-shell-photo-587.css');
const actor='58700000-0000-4587-8587-000000000098';
async function mount(page,{sysop=false,owner=false,denied=false}={}){
 await page.setContent('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="yw584Sysop"></section><details id="yw584Tenant"><summary>Company</summary></details></body></html>');
 await page.addStyleTag({content:css});
 await page.evaluate(({actor,sysop,owner,denied})=>{
  window.__platform=sysop;window.__owner=owner;
  document.documentElement.dataset.ywSurface=sysop?'platform':'tenant';
  if(sysop)window.location.hash='#sysop';
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:actor}})};
  window.YWIDualWorkspace={
   isSysopVerified:()=>sysop,
   snapshot:()=>({ownedCompanies:owner?1:0})
  };
  window.YW579Navigation={snapshot:()=>({verified:owner,
   companyId:'03bcf48e-a4f5-4427-9aba-b0f91f39b16b'})};
  const client={
   auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
   rpc:async name=>({data:!denied&&sysop,error:null}),
   from:table=>{
    const q={select(){return q},eq(){return q},limit:async()=>({
     data:!denied&&owner?[{id:'03bcf48e-a4f5-4427-9aba-b0f91f39b16b',
      owner_user_id:actor,name:'Rosevear Landscaping'}]:[],error:null
    })};return q;
   }
  };
  window.YWI_SB=client;
 },{actor,sysop,owner,denied});
 await page.addScriptTag({content:engine});
 await page.addScriptTag({content:fixture});
 await page.addScriptTag({content:workspace});
}
for(const width of [390,768,1440]){
 test('YW587 Sysop synthetic missing-photo diagnosis and redaction '+width,async({page})=>{
  await page.setViewportSize({width,height:860});await mount(page,{sysop:true});
  await page.locator('#yw587ShellPanel summary').click();
  await page.locator('#yw587ShellPanel button').click();
  await expect(page.locator('#yw587ShellStatus')).toContainText('Synthetic support cycle PASS');
  await expect(page.locator('#yw587ShellOutput .yw587-timeline li')).toHaveCount(9);
  await expect(page.locator('#yw587ShellOutput')).toContainText('Dispatcher: job and invoice count unchanged');
  await expect(page.locator('#yw587ShellOutput')).toContainText('REHEARSAL PASS is NOT production acceptance');
  const output=await page.locator('#yw587ShellOutput .yw587-redacted').textContent();
  expect(output).toContain('"photos_included": false');
  expect(output).toContain('"master_ack_received": false');
  expect(output).not.toContain('billing_email');
  expect(output).not.toContain('service_address');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
 });
}
test('YW587 Rosevear Landscaping owner sees isolated crew→dispatcher recovery rehearsal',async({page})=>{
 await mount(page,{owner:true});
 await page.locator('#yw584Tenant summary').first().click();
 await page.locator('#yw587TenantPanel summary').click();
 await page.locator('#yw587TenantPanel button').click();
 await expect(page.locator('#yw587TenantStatus')).toContainText('Synthetic support cycle PASS');
 await expect(page.locator('#yw587TenantOutput .yw587-timeline li')).toHaveCount(9);
 await expect(page.locator('#yw587TenantOutput')).toContainText('Original job: NOT CREATED');
 await expect(page.locator('#yw587TenantOutput')).toContainText('Live crew/storage ACK');
 await page.evaluate(()=>document.dispatchEvent(new Event('ywi:auth-changed')));
 await expect(page.locator('#yw587TenantOutput')).toBeEmpty();
});
test('YW587 unapproved Shell actor gets no incident data',async({page})=>{
 await mount(page,{sysop:true,denied:true});
 await page.locator('#yw587ShellPanel summary').click();
 await page.locator('#yw587ShellPanel button').click();
 await expect(page.locator('#yw587ShellStatus')).toContainText('HOLD');
 await expect(page.locator('#yw587ShellOutput')).toBeEmpty();
});
test('YW587 user without tenant ownership receives no client/job summary',async({page})=>{
 await mount(page,{owner:false,sysop:false});
 await page.locator('#yw584Tenant summary').first().click();
 await page.locator('#yw587TenantPanel summary').click();
 await page.locator('#yw587TenantPanel button').click();
 await expect(page.locator('#yw587TenantStatus')).toContainText('HOLD');
 await expect(page.locator('#yw587TenantOutput')).toBeEmpty();
});
