import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const help=fs.readFileSync('help.html','utf8');
test('Build 390 Production learning dated snapshot and future roadmap remain readable on 390px phone',async({page})=>{
 await page.setViewportSize({width:390,height:900});
 await page.setContent(help);
 const section=page.locator('#production-learning-roadmap-renewal-iii');
 await expect(section.getByRole('heading',{name:'Build 390 — Production Learning & Autonomous Roadmap Renewal III'})).toBeVisible();
 await expect(section).toContainText('zero rows across ten inspected operational tables');
 await expect(section).toContainText('not a fleet-wide or company-wide claim');
 await expect(section).toContainText('Build 391');
 await expect(section).toContainText('391–405');
 await expect(section).toContainText('winter snow/storm/ice');
 await expect(section.locator('button,input,select,textarea')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('Build 390 does not imply an outcome improvement or autonomous operational write',async({page})=>{
 await page.setContent(help);
 const section=page.locator('#production-learning-roadmap-renewal-iii');
 await expect(section).toContainText('no source-supported operational improvement');
 await expect(section).toContainText('No ROI, fewer errors, faster job completion');
 await expect(section).toContainText('This review creates no records, invoices, payments, messages');
 await expect(section).toContainText('one-time snapshot');
});
