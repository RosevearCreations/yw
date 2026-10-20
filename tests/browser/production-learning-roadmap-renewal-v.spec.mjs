import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const help=fs.readFileSync('help.html','utf8');
const owner=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
test('Build 417 review fits 390px phone and states dated limits',async({page})=>{
 await page.setViewportSize({width:390,height:900});await page.setContent(help);
 const section=page.locator('#production-learning-roadmap-renewal-v');
 await expect(section.getByRole('heading',{name:'Build 417 — Production Learning & Autonomous Roadmap Renewal V'})).toBeVisible();
 await expect(section).toContainText('October 19, 2026');
 await expect(section).toContainText('All six inspected tables returned zero rows');
 await expect(section).toContainText('no first-job improvement');
 await expect(section).toContainText('418–429');
 await expect(section.locator('button,input,select,textarea')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('Build 417 owner notice is read-only and links to source help',async({page})=>{
 await page.setContent(help);
 await expect(page.locator('#production-learning-roadmap-renewal-v')).toContainText('No customer, payment, invoice, dispatch or external message');
 expect(owner).toContain('data-build="417"');
 expect(owner).toContain('/help.html#production-learning-roadmap-renewal-v');
});
