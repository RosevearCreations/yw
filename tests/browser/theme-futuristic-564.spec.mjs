import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const js=fs.readFileSync('js/theme-switcher-564.js','utf8');
const css=fs.readFileSync('theme-futuristic-564.css','utf8');
async function setup(page,width=1440){
 await page.setViewportSize({width,height:900});
 await page.route('http://ywtheme564.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>'+
   '<header class="app-header"><div class="header-top"><h1>Yard Workers</h1>'+
   '<div class="header-session-actions"><button type="button">Login</button></div></div>'+
   '<nav><a href="#today">Jobs</a></nav></header>'+
   '<nav id="workspace550Nav"><a href="#company">Company</a>'+
   '<a id="workspace550SysopLink" href="#sysop" hidden>Platform</a></nav>'+
   '<div id="headerSession"></div><main class="container"><section class="card active">'+
   '<h2>Original operation dashboard</h2><button class="primary">View jobs</button></section></main>'+
   '</body></html>'}));
 await page.goto('http://ywtheme564.test');
 await page.evaluate(()=>{window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'11111111-1111-4111-8111-111111111111'}})};});
 await page.addStyleTag({content:css});
 await page.addScriptTag({content:js});
}
for(const width of [390,768,1440]){
 test('YW564 Standard blue preserved with reversible Futuristic theme at '+width+'px',async({page})=>{
  await setup(page,width);
  await expect(page.locator('#yw564ThemeChoice')).toHaveValue('standard');
  expect(await page.evaluate(()=>document.documentElement.dataset.ywTheme)).toBe('standard');
  await page.locator('#yw564ThemeChoice').selectOption('futuristic');
  await expect(page.locator('#yw564ThemeChoice')).toHaveValue('futuristic');
  expect(await page.evaluate(()=>document.documentElement.dataset.ywTheme)).toBe('futuristic');
  const rail=page.locator('#yw564Rail');
  if(width>=1120)await expect(rail).toBeVisible();
  else await expect(rail).toBeHidden();
  await expect(page.locator('#yw564Rail a[href="#sysop"]')).toBeHidden();
  await expect(page.locator('button.primary')).toHaveCSS('border-radius','10px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.locator('#yw564ThemeChoice').selectOption('standard');
  expect(await page.evaluate(()=>document.documentElement.dataset.ywTheme)).toBe('standard');
  await expect(rail).toBeHidden();
 });
}
test('YW564 stored theme restores and Sysop shortcut remains contingent on verified shell link',async({page})=>{
 await setup(page);
 await page.locator('#yw564ThemeChoice').selectOption('futuristic');
 expect(await page.evaluate(()=>localStorage.getItem('yw-theme-v1'))).toBe('futuristic');
 await page.reload();
 await page.evaluate(()=>{window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'11111111-1111-4111-8111-111111111111'}})};});
 await page.addStyleTag({content:css});
 await page.addScriptTag({content:js});
 await expect(page.locator('#yw564ThemeChoice')).toHaveValue('futuristic');
 await expect(page.locator('#yw564Rail a[href="#sysop"]')).toBeHidden();
 await page.evaluate(()=>document.getElementById('workspace550SysopLink').hidden=false);
 await expect(page.locator('#yw564Rail a[href="#sysop"]')).toBeVisible();
 await page.locator('#yw564Rail a[href="#finance"]').click();
 await expect(page.locator('#yw564Rail a[href="#finance"]')).toHaveAttribute('aria-current','page');
});
test('YW564 unauthenticated shell never exposes sidebar shortcuts',async({page})=>{
 await setup(page);
 await page.locator('#yw564ThemeChoice').selectOption('futuristic');
 await page.evaluate(()=>{window.YWI_AUTH={getState:()=>({isAuthenticated:false,user:null})};
  document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#yw564Rail')).toBeHidden();
});
