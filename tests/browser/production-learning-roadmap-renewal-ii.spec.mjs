import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const help=fs.readFileSync('help.html','utf8');
test('Build 376 outcome review and roadmap are readable on phone',async({page})=>{
 await page.setViewportSize({width:390,height:900});
 await page.setContent(help);
 const section=page.locator('#production-learning-roadmap-renewal-ii');
 await expect(section).toBeVisible();
 await expect(section.getByRole('heading',{name:'Build 376 — Production Learning & Autonomous Roadmap Renewal II'})).toBeVisible();
 await expect(section).toContainText('Builds 363–375');
 await expect(section).toContainText('Build 390');
 await expect(section).toContainText('Build 377');
 await expect(section).toContainText('permission-hidden, capped, stale');
 await expect(section).toContainText('winter snow/storm/ice');
 await expect(section.locator('button,input,select,textarea')).toHaveCount(0);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(1);
});
test('Build 376 does not imply live outcome proof or grant autonomous writes',async({page})=>{
 await page.setContent(help);
 const section=page.locator('#production-learning-roadmap-renewal-ii');
 await expect(section).toContainText('not proof of live Production improvements');
 await expect(section).toContainText('No automatic Finance posting');
 await expect(section).toContainText('No automatic Finance posting, payments, provider delivery');
 await expect(section).toContainText('must not require live customer messages');
});
