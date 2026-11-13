import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const js=fs.readFileSync('js/operations-command-565.js','utf8');
const css=fs.readFileSync('theme-operations-command-565.css','utf8');
async function setup(page,{width=1440,theme='futuristic',authorized=true,sysop=false}={}){
 await page.route('http://ywcmd565.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html data-yw-theme="'+theme+'"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>'+
   '<header class="app-header"><nav><a href="#company">Company</a></nav></header>'+
   '<nav id="workspace550Nav"><a id="workspace550SysopLink" href="#sysop" hidden>Sysop</a></nav>'+
   '<main class="container" style="max-width:1200px;margin:auto"><div class="card">Original Yard Workers operations</div></main>'+
   '</body></html>'}));
 await page.setViewportSize({width,height:900});await page.goto('http://ywcmd565.test/#company');
 await page.evaluate(({authorized,sysop})=>{
  window.YWI_AUTH={getState:()=>({isAuthenticated:authorized})};
  document.getElementById('workspace550SysopLink').hidden=!sysop;
 },{authorized,sysop});
 await page.addStyleTag({content:css});await page.addScriptTag({content:js});
}
for(const width of [390,768,1440]){
 test('YW565 Futuristic Operations Command is responsive and role-gated at '+width+'px',async({page})=>{
  await setup(page,{width});
  await expect(page.locator('#yw565Command')).toBeVisible();
  await expect(page.locator('.yw565-command-card')).toHaveCount(3);
  await expect(page.locator('.yw565-command-link[data-route="#sysop"]')).toBeHidden();
  await expect(page.locator('.yw565-command-link[data-route="#company"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#yw565Command')).toContainText('OPERATIONS COMMAND');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.locator('.yw565-command-link[data-route="#finance"]').click();
  await expect(page.locator('.yw565-command-link[data-route="#finance"]')).toHaveAttribute('aria-current','page');
 });
}
test('YW565 original Standard Blue unchanged and unauthenticated command hidden',async({page})=>{
 await setup(page,{theme:'standard'});
 await expect(page.locator('#yw565Command')).toBeHidden();
 await page.evaluate(()=>{document.documentElement.dataset.ywTheme='futuristic';
  document.dispatchEvent(new Event('yw:theme-changed'));});
 await expect(page.locator('#yw565Command')).toBeVisible();
 await page.evaluate(()=>{window.YWI_AUTH={getState:()=>({isAuthenticated:false})};
  document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#yw565Command')).toBeHidden();
});
test('YW565 verified Sysop shortcut appears only after curated YW550 authority',async({page})=>{
 await setup(page);
 const link=page.locator('.yw565-command-link[data-route="#sysop"]');
 await expect(link).toBeHidden();
 await page.evaluate(()=>{document.getElementById('workspace550SysopLink').hidden=false;});
 await expect(link).toBeVisible();
 await link.click();
 await expect(link).toHaveAttribute('aria-current','page');
 await page.evaluate(()=>{document.getElementById('workspace550SysopLink').hidden=true;});
 await expect(link).toBeHidden();
});
