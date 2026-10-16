import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const help=fs.readFileSync('help.html','utf8');
const ownerSource=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
test('Build 405 dated Production review and 12 future releases fit a 390px phone',async({page})=>{
 await page.setViewportSize({width:390,height:900});
 await page.setContent(help);
 const section=page.locator('#production-learning-roadmap-renewal-iv');
 await expect(section.getByRole('heading',{name:'Build 405 — Production Learning & Autonomous Roadmap Renewal IV'})).toBeVisible();
 await expect(section).toContainText('All six inspected tables returned zero rows');
 await expect(section).toContainText('No ROI');
 await expect(section).toContainText('406–417');
 await expect(section).toContainText('First-Customer Intake Receipt');
 await expect(section.locator('button,input,select,textarea')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('Build 405 shows only dated read-only evidence and preserves missing-outcome honesty',async({page})=>{
 await page.setContent(help);
 const section=page.locator('#production-learning-roadmap-renewal-iv');
 await expect(section).toContainText('not a claim that the entire business');
 await expect(section).toContainText('No ROI');
 await expect(section).toContainText('this review creates no records');
 await expect(section).toContainText('Missing, unauthorized, failed, stale or query-capped source reads');
 expect(ownerSource).toContain('data-build="405"');
 expect(ownerSource).toContain('/help.html#production-learning-roadmap-renewal-iv');
});
