import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const script=fs.readFileSync('js/contextual-help.js','utf8');
test('Build 377 inserts accessible circled Help links beside existing and dynamic sections',async({page})=>{
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><head></head><body><main id="adminHub"><section><h3>Management outcome confidence & cohort trend</h3></section></main></body></html>');
 await page.addScriptTag({content:script});
 const link=page.getByRole('link',{name:'Help: Management outcome confidence & cohort trend'});
 await expect(link).toHaveAttribute('href','/help.html#management-outcome-confidence-cohort-trend');
 await expect(link).toContainText('ⓘ');
 await page.evaluate(()=>document.querySelector('main').insertAdjacentHTML('beforeend','<section><h4>Equipment maintenance</h4></section>'));
 await expect(page.getByRole('link',{name:'Help: Equipment maintenance'})).toHaveAttribute('href','/help.html#equipment-registry-qr-v2');
 await expect(page.locator('.yw-contextual-help')).toHaveCount(2);
 await expect(page.getByRole('heading',{name:'Management outcome confidence & cohort trend'})).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(1);
});
test('Build 377 does not invent unknown Help topics',async({page})=>{
 await page.setContent('<main><h2>Custom tenant feature</h2></main>');
 await page.addScriptTag({content:script});
 await expect(page.getByRole('link',{name:'Help: Custom tenant feature'})).toHaveAttribute('href','/help.html');
});
