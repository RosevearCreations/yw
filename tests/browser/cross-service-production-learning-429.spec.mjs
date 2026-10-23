import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const help=fs.readFileSync('help.html','utf8');
const owner=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');

test('Build 429 read-only six-service trial review is readable at 390px',async({page})=>{
  await page.setViewportSize({width:390,height:900});
  await page.setContent(help);
  const section=page.locator('#production-learning-cross-service-429');
  await expect(section.getByRole('heading',{name:'Build 429 — Production Learning & Cross-Service Trial Review VI'})).toBeVisible();
  await expect(section).toContainText('October 23, 2026');
  await expect(section).toContainText('seventeen inspected');
  for(const label of ['landscaping','construction','water parks','snow removal','snow plowing','septic'])
    await expect(section).toContainText(label);
  await expect(section).toContainText('not measured');
  await expect(section).toContainText('430–442');
  await expect(section.locator('button,input,select,textarea')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('Build 429 owner cockpit notice has truthful limits and one help destination',async({page})=>{
  await page.setContent(help);
  const section=page.locator('#production-learning-cross-service-429');
  await expect(section).toContainText('No company toggles, dispatches, invoices, payments, messages or Safety approvals');
  expect(owner).toContain('data-build="429"');
  expect(owner).toContain('/help.html#production-learning-cross-service-429');
  expect(owner).toContain('not measured');
});
