import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const command=fs.readFileSync('js/operations-command-565.js','utf8');
const accept=fs.readFileSync('js/command-navigation-acceptance-566.js','utf8');
const drill=fs.readFileSync('js/operations-command-drilldown-567.js','utf8');
const css=fs.readFileSync('theme-operations-drilldown-567.css','utf8');
async function setup(page,{width=1440,theme='futuristic',auth=true,sysop=false}={}){
 await page.route('http://ywcmd567.test/**',r=>r.fulfill({status:200,contentType:'text/html',
  body:'<!doctype html><html data-yw-theme="'+theme+'"><head>'+
   '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+
   '<header class="app-header"><nav>'+
   '<a href="#today" data-module="jobs">Jobs</a>'+
   '<a href="#toolbox" data-module="safety">Safety</a>'+
   '<a href="#finance" data-module="finance">Finance</a>'+
   '<a href="#admin" data-module="admin">Admin</a>'+
   '<a href="#settings" id="headerSettingsLink">Settings</a>'+
   '</nav></header>'+
   '<nav id="workspace550Nav"><a href="#company" id="workspace550CompanyLink">Company</a>'+
   '<a href="#sysop" id="workspace550SysopLink" hidden>Sysop</a></nav>'+
   '<main class="container"><section id="company"><h2>Company workspace</h2></section>'+
   '<section id="today"><h2>Today’s jobs</h2></section>'+
   '<section id="finance"><h2>Finance workspace</h2></section>'+
   '<section id="admin"><h2>Management</h2></section>'+
   '<section id="toolbox"><h2>Safety & tools</h2></section>'+
   '<section id="settings"><h2>Settings</h2></section>'+
   '<section id="sysop"><h2>Sysop workspace</h2></section></main></body></html>'}));
 await page.setViewportSize({width,height:900});await page.goto('http://ywcmd567.test/#company');
 await page.evaluate(({auth,sysop})=>{
  window.YWI_AUTH={getState:()=>({isAuthenticated:auth})};
  document.getElementById('workspace550SysopLink').hidden=!sysop;
 },{auth,sysop});
 await page.addStyleTag({content:css});
 await page.addScriptTag({content:command});
 await page.addScriptTag({content:accept});
 await page.addScriptTag({content:drill});
}
for(const width of [390,768,1440]){
 test('YW567 accessible drilldown validates actual routes and keyboard navigation at '+width+'px',async({page})=>{
  await setup(page,{width});
  const groups=page.locator('#yw565Command .yw567-drilldown');
  await expect(groups).toHaveCount(3);
  await expect(page.locator('#yw565Command')).toBeVisible();
  const company=groups.first(),summary=company.locator('summary');
  await summary.focus();await page.keyboard.press('Enter');
  await expect(company).toHaveAttribute('open','');
  const companyLink=company.locator('a[href="#company"]');
  await expect(companyLink).toBeVisible();
  await expect(companyLink).toHaveAttribute('aria-current','page');
  await company.locator('a[href="#today"]').click();
  await expect(page.locator('#today h2')).toBeFocused();
  await expect(company.locator('a[href="#today"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#yw565Command .yw567-drilldown a[href="#sysop"]')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW567 drilldown hides unauthorized Sysop and hidden original module, exposes only curated entitlement',async({page})=>{
 await setup(page);
 const sysop=page.locator('#yw565Command .yw567-drilldown a[href="#sysop"]');
 await expect(sysop).toBeHidden();
 await page.evaluate(()=>{document.getElementById('workspace550SysopLink').hidden=false;});
 await expect(sysop).toBeVisible();
 await page.evaluate(()=>{document.querySelector('.app-header nav a[href="#finance"]').hidden=true;});
 await expect(page.locator('#yw565Command .yw567-drilldown a[href="#finance"]')).toBeHidden();
 await page.evaluate(()=>{document.getElementById('workspace550SysopLink').hidden=true;});
 await expect(sysop).toBeHidden();
});
test('YW567 Standard Blue unchanged and logout closes all operational drilldowns',async({page})=>{
 await setup(page,{theme:'standard'});
 await expect(page.locator('#yw565Command')).toBeHidden();
 await page.evaluate(()=>{document.documentElement.dataset.ywTheme='futuristic';
  document.dispatchEvent(new Event('yw:theme-changed'));});
 await expect(page.locator('#yw565Command')).toBeVisible();
 await page.locator('.yw567-drilldown summary').first().click();
 await expect(page.locator('.yw567-drilldown').first()).toHaveAttribute('open','');
 await page.evaluate(()=>{window.YWI_AUTH={getState:()=>({isAuthenticated:false})};
  document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#yw565Command')).toBeHidden();
 await expect(page.locator('.yw567-drilldown').first()).not.toHaveAttribute('open','');
 await expect(page.locator('#workspace550CompanyLink')).toHaveAttribute('href','#company');
});
