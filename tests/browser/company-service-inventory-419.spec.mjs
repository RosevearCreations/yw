import{test,expect}from'@playwright/test';import fs from'node:fs';
const ui=fs.readFileSync('js/company-service-inventory-419.js','utf8');
const src=JSON.parse(fs.readFileSync('public/data/company-service-inventory-419.json','utf8'));
async function open(page,payload=src,success=true){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="admin"></div></body></html>');
 await page.evaluate(({data,success})=>{
  window.__mutations=0;window.__fetches=[];
  window.fetch=async(url,options)=>{window.__fetches.push({url,options});return {ok:success,json:async()=>structuredClone(data)};};
  window.YWIAPI={manageAdminEntity(){window.__mutations++;throw Error('Write disallowed');}};
 },{data:payload,success});
 await page.addScriptTag({content:ui});
 await page.locator('#owner419 summary').click();
 await page.locator('#owner419Load').click();
}
test('six offerings are unverified, pricing/modules are explicitly separate and layout mobile-safe',async({page})=>{
 await open(page);
 await expect(page.locator('[data-owner419-key]')).toHaveCount(6);
 await expect(page.locator('#owner419Status')).toContainText('Not a live tenant entitlement check');
 await expect(page.locator('#owner419Results')).toContainText('admin, jobs, finance, safety');
 await expect(page.locator('#owner419Results')).toContainText('MOW_WEEKLY');
 await expect(page.locator('#owner419Results')).toContainText('NOT VERIFIED');
 expect(await page.evaluate(()=>window.__mutations)).toBe(0);
 const f=await page.evaluate(()=>window.__fetches);
 expect(f).toHaveLength(1);expect(f[0].options.cache).toBe('no-store');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('forged company entitlement is withheld rather than presented as live',async({page})=>{
 const bad=structuredClone(src);bad.company_offerings[0].company_entitlement=true;
 await open(page,bad);
 await expect(page.locator('#owner419Status')).toContainText('WITHHELD');
 await expect(page.locator('[data-owner419-key]')).toHaveCount(0);
});
test('unavailable source fails closed and allows deliberate retry',async({page})=>{
 await open(page,src,false);
 await expect(page.locator('#owner419Status')).toContainText('WITHHELD');
 await expect(page.locator('#owner419Load')).toBeEnabled();
});
