import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const html=readFileSync('public/customer.html','utf8')
 .replace(/<script src="\/customer-585\.js[^"]*" defer><\/script>/,'')
 .replace(/<link rel="stylesheet" href="\/customer-585\.css[^"]*"\/>/,'')
 .replace(/<link rel="icon" href="\/favicon\.ico"\/>/,'');
const css=readFileSync('public/customer-585.css','utf8');
const js=readFileSync('public/customer-585.js','utf8');
async function mount(page,width){
 const calls=[];page.on('request',r=>calls.push(r.url()));
 await page.setViewportSize({width,height:900});
 await page.setContent(html);
 await page.addStyleTag({content:css});
 await page.addScriptTag({content:js});
 return calls;
}
for(const width of [390,768,1440]){
 test('YW585 local-only customer planning is usable at '+width+'px',async({page})=>{
  const calls=await mount(page,width);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
  await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
  await expect(page.locator('.service-grid article')).toHaveCount(9);
  await expect(page.locator('.service-grid article.concept')).toHaveCount(2);
  await page.locator('#yw585-service').selectOption('arboriculture');
  await page.locator('#yw585-property').selectOption('rural');
  await page.locator('#yw585-when').selectOption('next-season');
  await page.locator('#yw585-frequency').selectOption('recurring');
  await page.locator('#yw585-notes').fill('Seasonal tree assessment and pruning on a rural lot.');
  await page.getByRole('button',{name:'Create planning sheet'}).click();
  await expect(page.locator('#yw585-summary')).toBeVisible();
  await expect(page.locator('#yw585-summary-text')).toContainText('Tree care');
  await expect(page.locator('#yw585-summary-text')).toContainText('NOT SUBMITTED');
  await expect(page.locator('#yw585-summary-text')).not.toContainText('payment accepted');
  expect(calls).toEqual([]);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button',{name:'Clear details'}).click();
  await expect(page.locator('#yw585-summary')).toBeHidden();
  await expect(page.locator('#yw585-notes')).toHaveValue('');
  expect(calls).toEqual([]);
 });
}
test('YW585 conceptual services cannot silently become orders or online requests',async({page})=>{
 const calls=await mount(page,430);
 await page.locator('#yw585-service').selectOption('ponds');
 await page.getByRole('button',{name:'Create planning sheet'}).click();
 await expect(page.locator('#yw585-summary-text')).toContainText('planning-only');
 await expect(page.locator('#yw585-summary-text')).toContainText('NOT SUBMITTED');
 await expect(page.locator('input[type="email"]')).toHaveCount(0);
 await expect(page.locator('input[type="file"]')).toHaveCount(0);
 await expect(page.locator('form[action]')).toHaveCount(0);
 expect(calls).toEqual([]);
});
test('YW585 copy and print controls are local, functional and do not submit',async({page})=>{
 const calls=await mount(page,1100);
 await page.evaluate(()=>{
  window.__copies=[];window.__prints=0;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
    writeText:async v=>{window.__copies.push(v);}
  }});
  window.print=()=>{window.__prints++};
 });
 await page.locator('#yw585-service').selectOption('snow_removal');
 await page.getByRole('button',{name:'Create planning sheet'}).click();
 await page.getByRole('button',{name:'Copy sheet'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__copies.length)).toBe(1);
 await page.getByRole('button',{name:'Print sheet'}).click();
 expect(await page.evaluate(()=>window.__prints)).toBe(1);
 expect(calls).toEqual([]);
});
