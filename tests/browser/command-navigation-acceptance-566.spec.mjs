import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const command=fs.readFileSync('js/operations-command-565.js','utf8');
const theme=fs.readFileSync('js/theme-switcher-564.js','utf8');
const guard=fs.readFileSync('js/command-navigation-acceptance-566.js','utf8');
const css=fs.readFileSync('theme-navigation-acceptance-566.css','utf8');
async function setup(page,{width=1440,active=true,futuristic=true}={}){
 await page.route('http://ywcmd566.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+
   '<header class="app-header"><div class="header-top"><h1>Yard Workers</h1><div class="header-session-actions"></div></div>'+
   '<nav><a href="#today" data-module="jobs">Jobs</a>'+
   '<a href="#toolbox" data-module="safety">Safety</a>'+
   '<a href="#finance" data-module="finance">Finance</a>'+
   '<a href="#admin" data-module="admin">Admin</a>'+
   '<a href="#settings" id="headerSettingsLink">Settings</a></nav></header>'+
   '<nav id="workspace550Nav"><a id="workspace550CompanyLink" href="#company">Company</a>'+
   '<a id="workspace550SysopLink" href="#sysop" hidden>Sysop</a></nav>'+
   '<div id="headerSession"></div>'+
   '<main class="container" style="max-width:1250px;margin:auto">'+
   '<section id="company">Company workspace</section><section id="today">Today</section>'+
   '<section id="finance">Finance</section><section id="admin">Admin</section>'+
   '<section id="toolbox">Safety</section><section id="settings">Settings</section>'+
   '<section id="sysop">Platform</section></main></body></html>'}));
 await page.setViewportSize({width,height:900});await page.goto('http://ywcmd566.test/#company');
 await page.evaluate(({active,futuristic})=>{
  localStorage.setItem('yw-theme-v1',futuristic?'futuristic':'standard');
  window.YWI_AUTH={getState:()=>({isAuthenticated:active})};
 },{active,futuristic});
 await page.addStyleTag({content:css});
 await page.addScriptTag({content:theme});
 await page.addScriptTag({content:command});
 await page.addScriptTag({content:guard});
 await page.evaluate(()=>document.dispatchEvent(new Event('yw:theme-changed')));
}
for(const width of [390,768,1440]){
 test('YW566 accepted command routes point to real module sections, with no fake I.T. or unverified Sysop at '+width+'px',async({page})=>{
  await setup(page,{width});
  const cmd=page.locator('#yw565Command');
  await expect(cmd).toBeVisible();
  await expect(page.locator('#yw566NavigationStatus')).toContainText('Module navigation:');
  const routes=await cmd.locator('a[data-route]:visible').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  expect(routes).not.toContain('#it');expect(routes).not.toContain('#sysop');
  expect(routes).toContain('#settings');
  for(const route of routes){
   const accepted=await page.evaluate(href=>({
    ok:window.YWNavigationAcceptance566.isOffered(href),
    section:!!document.getElementById(href.slice(1))
   }),route);
   expect(accepted.ok).toBe(true);expect(accepted.section).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await cmd.locator('a[data-route="#finance"]').click();
  await expect(cmd.locator('a[data-route="#finance"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#yw566NavigationStatus')).toContainText('Master connectivity');
 });
}
test('YW566 original module visibility is respected, and deliberately stale route cannot navigate',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{const a=document.querySelector('.app-header nav a[href="#finance"]');a.hidden=true;});
 await expect(page.locator('#yw565Command a[href="#finance"]')).toBeHidden();
 await expect(page.locator('#yw564Rail a[href="#finance"]')).toBeHidden();
 expect(await page.evaluate(()=>window.YWNavigationAcceptance566.isOffered('#finance'))).toBe(false);
 await page.evaluate(()=>{document.getElementById('workspace550SysopLink').hidden=false;});
 await expect(page.locator('#yw565Command a[href="#sysop"]')).toBeVisible();
 await page.evaluate(()=>{document.getElementById('workspace550SysopLink').hidden=true;});
 await expect(page.locator('#yw565Command a[href="#sysop"]')).toBeHidden();
});
test('YW566 Standard Blue and logout hide command without modifying original navigation',async({page})=>{
 await setup(page,{futuristic:false});
 await expect(page.locator('#yw565Command')).toBeHidden();
 await page.locator('#yw564ThemeChoice').selectOption('futuristic');
 await expect(page.locator('#yw565Command')).toBeVisible();
 await page.evaluate(()=>{window.YWI_AUTH={getState:()=>({isAuthenticated:false})};
  document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#yw565Command')).toBeHidden();
 expect(await page.evaluate(()=>window.YWNavigationAcceptance566.isOffered('#company'))).toBe(false);
 await expect(page.locator('#workspace550CompanyLink')).toHaveAttribute('href','#company');
});
