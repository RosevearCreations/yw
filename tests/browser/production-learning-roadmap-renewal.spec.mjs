import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const help=fs.readFileSync('help.html','utf8');

test('Build 362 help exposes the renewed autonomous learning cycle on phone',async({page})=>{
  await page.setViewportSize({width:390,height:900});
  await page.setContent(help);
  const section=page.locator('#production-learning-roadmap-renewal');
  await expect(section).toBeVisible();
  await expect(section.getByRole('heading',{name:'Build 362 — Production Learning & Autonomous Roadmap Renewal'})).toBeVisible();
  await expect(section).toContainText('Builds 363–375');
  await expect(section).toContainText('Build 376 renews the roadmap again');
  await expect(section).toContainText('must not require live payments');
  await expect(section.locator('button,input,select,textarea')).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('Build 362 help keeps outcome-learning and authority boundaries together',async({page})=>{
  await page.setContent(help);
  const text=await page.locator('#production-learning-roadmap-renewal').innerText();
  expect(text).toContain('outcome learning');
  expect(text).toContain('Jobs, Safety, Equipment, Employment, CRM, Finance, Auth and provider authorities remain canonical');
  expect(text).toContain('schedule recovery');
  expect(text).toContain('estimate accuracy');
  expect(text).toContain('mobile reliability trends');
});
